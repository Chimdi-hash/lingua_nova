# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class LinguaNova(gl.Contract):
    # Persistent storage - each user maps to a list of translation records
    # Each record stored as a JSON string for simplicity
    translations: DynArray[str]
    user_tx_count: TreeMap[str, int]

    def __init__(self):
        self.translations = DynArray[str]()
        self.user_tx_count = TreeMap()

    @gl.public.write
    def translate(self, text: str, target_language: str) -> str:
        """
        Translates text into the target language.
        The 5 GenLayer validators each independently call the LLM,
        then reach consensus on the best translation via validator_fn.
        """
        if len(text) == 0:
            raise Exception("Text cannot be empty.")
        if len(text) > 200:
            raise Exception("Text exceeds 200 character limit.")

        # --- Non-deterministic leader function (run by the leader validator) ---
        def leader_fn() -> str:
            prompt = f"""You are an expert professional translator with deep knowledge of linguistics.

Task: Translate the text below into {target_language}.

Rules:
- Return ONLY a valid JSON object with a single key "translation"
- The value must be the translated text in {target_language}
- Do NOT include any explanation, notes, or extra text
- Preserve the original tone and style

Text to translate:
\"\"\"{text}\"\"\"

Response format:
{{"translation": "<translated text here>"}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return result

        # --- Validator function (run by each of the other 4 validators) ---
        def validator_fn(leader_result) -> bool:
            """
            Each validator independently translates the text and checks if
            the leader's result is semantically equivalent to their own.
            """
            if not isinstance(leader_result, gl.vm.Return):
                return False

            try:
                leader_data = json.loads(leader_result.calldata)
                leader_translation = leader_data.get("translation", "").strip()
                if not leader_translation:
                    return False
            except Exception:
                return False

            # Each validator does their own independent translation
            validation_prompt = f"""You are an expert professional translator.

Your job is to validate a translation.

Original text: \"\"\"{text}\"\"\"
Target language: {target_language}
Translation to validate: \"\"\"{leader_translation}\"\"\"

Is this translation accurate, natural, and complete in {target_language}?

Return ONLY this JSON:
{{"is_valid": true}} if the translation is correct and high quality
{{"is_valid": false}} if the translation is wrong, incomplete, or unnatural"""

            validation_result = gl.nondet.exec_prompt(
                validation_prompt, response_format="json"
            )

            try:
                validation_data = json.loads(validation_result)
                return validation_data.get("is_valid", False)
            except Exception:
                return False

        # Run the non-deterministic block — leader translates, validators judge
        consensus_result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Parse the consensus translation
        try:
            result_data = json.loads(consensus_result)
            translated_text = result_data.get("translation", "").strip()
        except Exception:
            translated_text = str(consensus_result).strip()

        # Store the record
        sender = str(gl.message.sender_address)
        record = json.dumps({
            "user": sender,
            "original_text": text,
            "target_language": target_language,
            "translated_text": translated_text,
        })
        self.translations.append(record)

        # Track count per user
        current_count = self.user_tx_count.get(sender, 0)
        self.user_tx_count[sender] = current_count + 1

        return translated_text

    @gl.public.view
    def get_translation_history(self, user_address: str) -> list:
        """Returns all translations made by a specific user address."""
        history = []
        for raw in self.translations:
            try:
                record = json.loads(raw)
                if record.get("user", "").lower() == user_address.lower():
                    history.append(record)
            except Exception:
                continue
        return history

    @gl.public.view
    def get_all_translations(self) -> list:
        """Returns all translations ever made (admin/debug view)."""
        results = []
        for raw in self.translations:
            try:
                results.append(json.loads(raw))
            except Exception:
                continue
        return results

    @gl.public.view
    def get_total_count(self) -> int:
        """Returns total number of translations performed."""
        return len(self.translations)
