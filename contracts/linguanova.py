# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

@allow_storage
@dataclass
class TranslationRecord:
    id: int
    user: str
    original_text: str
    target_language: str
    translated_text: str

class Linguanova(gl.Contract):
    translations: TreeMap[int, TranslationRecord]
    user_translations: TreeMap[Address, gl.Array[int]]
    next_id: int

    def __init__(self):
        self.next_id = 1
        self.translations = TreeMap()
        self.user_translations = TreeMap()

    @gl.public.write
    def translate(self, text: str, target_language: str) -> str:
        if len(text) > 200:
            raise Exception("Text exceeds 200 characters.")
        if len(text) == 0:
            raise Exception("Text cannot be empty.")
            
        def get_translation() -> str:
            task = f"""
Translate the following text into the target language.
Original Text: {text}
Target Language: {target_language}

Respond only with the translated text, nothing else. Do not include any quotation marks, prefixes, suffixes, or conversational text.
"""
            result = gl.nondet.exec_prompt(task)
            return result

        # We use strict_eq to ensure validators reach consensus on the translated text.
        # Since translations can be non-deterministic, we instruct the LLM strictly to output only the translation.
        translated_text = gl.eq_principle.strict_eq(get_translation)
        
        sender = gl.message.sender_address
        
        record = TranslationRecord(
            id=self.next_id,
            user=sender.as_hex,
            original_text=text,
            target_language=target_language,
            translated_text=translated_text
        )
        self.translations[self.next_id] = record
        
        if sender not in self.user_translations:
            self.user_translations[sender] = gl.Array[int]()
            
        self.user_translations[sender].append(self.next_id)
        self.next_id += 1
        
        return translated_text

    @gl.public.view
    def get_translation_history(self, user_address: str) -> list:
        addr = Address(user_address)
        if addr not in self.user_translations:
            return []
        
        # We need to construct a list of dicts to return, because returning custom dataclasses directly 
        # might need explicit conversion for RPC calls.
        history = []
        for rid in self.user_translations[addr]:
            record = self.translations[rid]
            history.append({
                "id": record.id,
                "user": record.user,
                "original_text": record.original_text,
                "target_language": record.target_language,
                "translated_text": record.translated_text
            })
            
        return history
