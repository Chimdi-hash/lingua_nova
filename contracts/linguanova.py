# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *
import genlayer.gl.vm as glvm


class LinguaNova(gl.Contract):
    # All records stored as JSON strings inside a single flat TreeMap
    records: TreeMap[str, str]

    def __init__(self):
        pass

    def _translate(self, text: str, target_language: str) -> str:
        def leader_fn() -> str:
            prompt = f"""You are an expert translator.

Translate the text below into {target_language}.

Text: {text}

Respond with ONLY this JSON (no other text):
{{"translation": "<translated text here>"}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(result, sort_keys=True)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, glvm.Return):
                return False
            
            try:
                data = json.loads(leader_result.calldata)
                translated_text = data.get("translation", "")
            except Exception:
                return False

            prompt = f"""Is the following text a valid and accurate translation of the original text into {target_language}?
Original Text: {text}
Translation: {translated_text}
Answer with ONLY a valid JSON object containing a boolean field "is_valid".
Example: {{"is_valid": true}}"""
            
            try:
                result = gl.nondet.exec_prompt(prompt, response_format="json")
                return bool(result.get("is_valid", False))
            except Exception:
                return False

        consensus_json = glvm.run_nondet_unsafe(leader_fn, validator_fn)
        data = json.loads(consensus_json)
        return data.get("translation", "").strip()

    @gl.public.write
    def translate(self, text: str, target_language: str) -> str:
        if len(text) == 0:
            raise Exception("Text cannot be empty.")
        if len(text) > 200:
            raise Exception("Text exceeds 200 characters.")

        translated = self._translate(text, target_language)

        sender = gl.message.sender_address.as_hex
        # Use a unique key per record
        existing_raw = self.records.get(f"count_{sender}") or "0"
        idx = int(existing_raw)

        record_key = f"{sender}_{idx}"
        self.records[record_key] = json.dumps({
            "user": sender,
            "original_text": text,
            "target_language": target_language,
            "translated_text": translated,
        })
        self.records[f"count_{sender}"] = str(idx + 1)

        return translated

    @gl.public.view
    def get_translation_history(self, user_address: str) -> list:
        try:
            sender = Address(user_address).as_hex
        except Exception:
            sender = user_address.lower()

        count_raw = self.records.get(f"count_{sender}") or "0"
        total = int(count_raw)

        history = []
        for i in range(total):
            key = f"{sender}_{i}"
            raw = self.records.get(key)
            if raw:
                try:
                    history.append(json.loads(raw))
                except Exception:
                    continue
        return history

    @gl.public.view
    def get_total_translations(self) -> int:
        count = 0
        for key in self.records:
            if not key.startswith("count_"):
                count += 1
        return count
