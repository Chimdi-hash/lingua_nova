# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class TranslationRecord:
    id: str
    user: str
    original_text: str
    target_language: str
    translated_text: str


class LinguaNova(gl.Contract):
    translations: TreeMap[str, TranslationRecord]
    user_translation_ids: TreeMap[Address, TreeMap[str, bool]]
    total_count: u256

    def __init__(self):
        pass

    def _get_translation(self, text: str, target_language: str) -> str:
        """
        Non-deterministic translation function.
        Each of the 5 validators independently calls the LLM.
        gl.eq_principle.strict_eq ensures they all agree on the result.
        """
        def get_translation_result() -> str:
            prompt = f"""You are an expert professional translator.

Translate the text below into {target_language}.

Rules:
- Return ONLY a valid JSON object
- Use exactly this format: {{"translation": "<translated text>"}}
- Do not include any explanation, notes, quotes, or extra text
- The translation must be accurate, natural, and complete

Text to translate:
{text}

It is mandatory that you respond only using the JSON format above, nothing else.
Your output must be perfectly parsable by a JSON parser without errors."""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(result, sort_keys=True)

        # All 5 validators run get_translation_result independently and must agree
        consensus_json = gl.eq_principle.strict_eq(get_translation_result)
        result_data = json.loads(consensus_json)
        return result_data.get("translation", "").strip()

    @gl.public.write
    def translate(self, text: str, target_language: str) -> str:
        if len(text) == 0:
            raise Exception("Text cannot be empty.")
        if len(text) > 200:
            raise Exception("Text exceeds 200 character limit.")

        translated_text = self._get_translation(text, target_language)

        sender = gl.message.sender_address
        record_id = f"{sender.as_hex}_{int(self.total_count)}"

        record = TranslationRecord(
            id=record_id,
            user=sender.as_hex,
            original_text=text,
            target_language=target_language,
            translated_text=translated_text,
        )

        self.translations[record_id] = record

        if sender not in self.user_translation_ids:
            self.user_translation_ids.get_or_insert_default(sender)[record_id] = True
        else:
            self.user_translation_ids[sender][record_id] = True

        self.total_count += 1

        return translated_text

    @gl.public.view
    def get_translation_history(self, user_address: str) -> list:
        addr = Address(user_address)
        if addr not in self.user_translation_ids:
            return []

        history = []
        for rid in self.user_translation_ids[addr]:
            if rid in self.translations:
                rec = self.translations[rid]
                history.append({
                    "id": rec.id,
                    "user": rec.user,
                    "original_text": rec.original_text,
                    "target_language": rec.target_language,
                    "translated_text": rec.translated_text,
                })
        return history

    @gl.public.view
    def get_total_count(self) -> int:
        return int(self.total_count)
