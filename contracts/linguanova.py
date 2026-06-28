# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *
import genlayer.gl.vm as glvm


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
    # Nested TreeMap workaround: store list of IDs as JSON string per user
    user_index: TreeMap[str, str]
    total_count: u256

    def __init__(self):
        self.user_index = TreeMap()
        self.total_count = u256(0)

    def _do_translate(self, text: str, target_language: str) -> str:
        """
        Leader validator translates the text via LLM.
        Each of the other 4 validators independently checks whether the
        leader's translation is accurate — this is the consensus mechanism.
        """

        def leader_fn() -> dict:
            prompt = f"""You are an expert professional translator.

Translate the following text into {target_language}.

Rules:
- Return ONLY a valid JSON object with a single key "translation"
- The value must be the complete, accurate translation in {target_language}
- Do NOT include explanations, notes, or any extra text
- Preserve the original tone, meaning, and style
- If the text is already in {target_language}, return it as-is

Text to translate:
{text}

Required JSON format:
{{"translation": "<your translation here>"}}

It is mandatory that you respond only using the JSON format above, nothing else.
Your output must be perfectly parsable by a JSON parser without errors."""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return result

        def validator_fn(leader_result) -> bool:
            """
            Each validator independently verifies the leader's translation
            by asking the LLM to judge its accuracy and naturalness.
            """
            if not isinstance(leader_result, glvm.Return):
                return False

            try:
                leader_translation = leader_result.calldata.get("translation", "").strip()
                if not leader_translation:
                    return False
            except Exception:
                return False

            # Each validator runs their own independent quality check
            validation_prompt = f"""You are an expert linguist and translator.

Evaluate whether this translation is accurate and natural.

Original text (source): {text}
Target language: {target_language}
Translation to evaluate: {leader_translation}

Criteria:
1. Is the meaning accurately preserved?
2. Is the translation natural and fluent in {target_language}?
3. Is it complete (nothing missing)?

Return ONLY this JSON:
{{"is_valid": true}} if the translation passes all criteria
{{"is_valid": false}} if it fails any criterion

It is mandatory that you respond only using the JSON format above, nothing else."""

            validation_result = gl.nondet.exec_prompt(
                validation_prompt, response_format="json"
            )

            try:
                return bool(validation_result.get("is_valid", False))
            except Exception:
                return False

        # Run: leader translates, validators independently judge
        result = glvm.run_nondet_unsafe(leader_fn, validator_fn)

        try:
            return result.get("translation", "").strip()
        except Exception:
            return str(result).strip()

    @gl.public.write
    def translate(self, text: str, target_language: str) -> str:
        if len(text) == 0:
            raise Exception("Text cannot be empty.")
        if len(text) > 200:
            raise Exception("Text exceeds 200 character limit.")

        translated_text = self._do_translate(text, target_language)

        sender = gl.message.sender_address
        sender_hex = sender.as_hex
        count = int(self.total_count)
        record_id = f"{sender_hex}_{count}"

        record = TranslationRecord(
            id=record_id,
            user=sender_hex,
            original_text=text,
            target_language=target_language,
            translated_text=translated_text,
        )
        self.translations[record_id] = record

        # Update user index (stored as JSON list of IDs)
        existing = json.loads(self.user_index.get(sender_hex) or "[]")
        existing.append(record_id)
        self.user_index[sender_hex] = json.dumps(existing)

        self.total_count = u256(count + 1)

        return translated_text

    @gl.public.view
    def get_translation_history(self, user_address: str) -> list:
        try:
            addr = Address(user_address)
            sender_hex = addr.as_hex
        except Exception:
            sender_hex = user_address.lower()

        ids = json.loads(self.user_index.get(sender_hex) or "[]")
        history = []
        for rid in ids:
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
