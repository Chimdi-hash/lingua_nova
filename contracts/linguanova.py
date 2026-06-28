# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class LinguaNova(gl.Contract):
    # All records stored as JSON strings inside a single flat TreeMap
    records: TreeMap[str, str]

    def __init__(self):
        pass

    def _translate(self, text: str, target_language: str) -> str:
        def get_translation() -> str:
            prompt = f"""You are an expert translator.

Translate the text below into {target_language}.

Text: {text}

Respond with ONLY this JSON (no other text):
{{"translation": "<translated text here>"}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(result, sort_keys=True)

        consensus_json = gl.eq_principle.strict_eq(get_translation)
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
