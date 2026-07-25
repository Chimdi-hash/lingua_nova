# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import hashlib
from genlayer import *
import genlayer.gl.vm as glvm

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass

class LinguaNova(gl.Contract):
    # State mapping using TreeMap to store JSON strings
    bounties: TreeMap[str, str]
    submissions: TreeMap[str, str]
    reviews: TreeMap[str, str]
    disputes: TreeMap[str, str]
    dispute_reviews: TreeMap[str, str]
    reputations: TreeMap[str, str]
    stats: TreeMap[str, str]

    def __init__(self):
        self.bounties = TreeMap()
        self.submissions = TreeMap()
        self.reviews = TreeMap()
        self.disputes = TreeMap()
        self.dispute_reviews = TreeMap()
        self.reputations = TreeMap()
        self.stats = TreeMap()
        
        # Initialize stats
        self.stats["protocol"] = json.dumps({
            "total_bounties": 0,
            "total_submissions": 0,
            "total_reviews": 0,
            "total_disputes": 0,
            "total_payable_amount": 0.0
        })
        self.stats["bounty_counter"] = "0"
        self.stats["submission_counter"] = "0"
        self.stats["dispute_counter"] = "0"

    # --- 1. BOUNTIES ---

    @gl.public.write.payable
    def create_bounty(self, bounty_json: str) -> str:
        data = json.loads(bounty_json)
        source_text = data.get("source_text", "").strip()
        target_language = data.get("target_language", "").strip()
        reward_amount = float(data.get("reward_amount", 0.0))

        if not source_text:
            raise Exception("source_text cannot be empty")
        if not target_language:
            raise Exception("target_language cannot be empty")
        if reward_amount < 0:
            raise Exception("reward_amount cannot be negative")
        
        required_wei = int(reward_amount * 10**18)
        if gl.message.value < required_wei:
            raise Exception("Insufficient GEN attached to fund bounty")

        counter = int(self.stats.get("bounty_counter", "0")) + 1
        bounty_id = f"B-{counter}"
        self.stats["bounty_counter"] = str(counter)

        requester = gl.message.sender_address.as_hex

        data["bounty_id"] = bounty_id
        data["requester"] = requester
        data["status"] = "OPEN"
        data["submissions"] = []
        data["reference_status"] = "NOT_PROVIDED"

        if data.get("reference_url") and data.get("reference_hash"):
            data["reference_status"] = "PENDING_VERIFICATION"

        self.bounties[bounty_id] = json.dumps(data)

        # Update stats
        protocol_stats = json.loads(self.stats["protocol"])
        protocol_stats["total_bounties"] += 1
        self.stats["protocol"] = json.dumps(protocol_stats)

        return bounty_id

    # --- 2. VERIFY REFERENCE URL ---

    @gl.public.write
    def verify_reference_url(self, bounty_id: str) -> str:
        bounty_str = self.bounties.get(bounty_id)
        if not bounty_str:
            raise Exception("Bounty not found")
        
        bounty = json.loads(bounty_str)
        if bounty["reference_status"] not in ["PENDING_VERIFICATION", "FAILED_FETCH"]:
            raise Exception("Reference URL does not need verification")

        url = bounty["reference_url"]
        expected_hash = bounty["reference_hash"]

        def fetch_and_hash() -> str:
            try:
                response = gl.nondet.web.request(url)
                body = response.body if hasattr(response, 'body') else b""
                if isinstance(body, str):
                    body = body.encode('utf-8')
                return hashlib.sha256(body).hexdigest()
            except Exception:
                return "FETCH_FAILED"

        actual_hash = gl.eq_principle.strict_eq(fetch_and_hash)
        actual_hash = str(actual_hash)

        if actual_hash == "FETCH_FAILED":
            bounty["reference_status"] = "FAILED_FETCH"
        elif actual_hash == expected_hash:
            bounty["reference_status"] = "VERIFIED"
        else:
            bounty["reference_status"] = "HASH_MISMATCH"

        self.bounties[bounty_id] = json.dumps(bounty)
        return bounty["reference_status"]

    # --- 3. SUBMIT TRANSLATION ---

    @gl.public.write
    def submit_translation(self, bounty_id: str, submission_json: str) -> str:
        bounty_str = self.bounties.get(bounty_id)
        if not bounty_str:
            raise Exception("Bounty not found")
        bounty = json.loads(bounty_str)

        if bounty["status"] not in ["OPEN", "IN_PROGRESS"]:
            raise Exception("Bounty is not open for submissions")

        data = json.loads(submission_json)
        translated_text = data.get("translated_text", "").strip()

        if not translated_text:
            raise Exception("translated_text cannot be empty")

        counter = int(self.stats.get("submission_counter", "0")) + 1
        submission_id = f"S-{counter}"
        self.stats["submission_counter"] = str(counter)

        translator = gl.message.sender_address.as_hex

        data["submission_id"] = submission_id
        data["bounty_id"] = bounty_id
        data["translator"] = translator
        data["status"] = "SUBMITTED"
        data["payment_status"] = "PENDING"
        data["revisions"] = []

        self.submissions[submission_id] = json.dumps(data)

        # Update bounty
        bounty["status"] = "IN_PROGRESS"
        if "submissions" not in bounty:
            bounty["submissions"] = []
        bounty["submissions"].append(submission_id)
        self.bounties[bounty_id] = json.dumps(bounty)

        # Init translator reputation if empty
        if not self.reputations.get(translator):
            self.reputations[translator] = json.dumps({
                "address": translator,
                "total_submissions": 0,
                "approved_count": 0,
                "rejected_count": 0,
                "revision_count": 0,
                "dispute_count": 0,
                "average_quality_score": 0.0,
                "total_payable_amount": 0.0,
                "last_submission_id": ""
            })

        rep = json.loads(self.reputations[translator])
        rep["total_submissions"] += 1
        rep["last_submission_id"] = submission_id
        self.reputations[translator] = json.dumps(rep)

        # Update stats
        protocol_stats = json.loads(self.stats["protocol"])
        protocol_stats["total_submissions"] += 1
        self.stats["protocol"] = json.dumps(protocol_stats)

        return submission_id

    # --- 4. REVIEW TRANSLATION ---

    @gl.public.write
    def review_translation(self, submission_id: str) -> str:
        submission_str = self.submissions.get(submission_id)
        if not submission_str:
            raise Exception("Submission not found")
        submission = json.loads(submission_str)

        if submission["status"] not in ["SUBMITTED"]:
            raise Exception("Submission already reviewed or in invalid state")

        bounty = json.loads(self.bounties[submission["bounty_id"]])

        def leader_fn() -> dict:
            prompt = f"""You are an expert, impartial linguistic auditor and quality assurance system.
You are tasked with independently reviewing a human-submitted translation against the source requirements.

Bounty Requirements:
- Source Text: {bounty.get('source_text')}
- Source Language: {bounty.get('source_language')}
- Target Language: {bounty.get('target_language')}
- Domain: {bounty.get('domain')}
- Tone Requirements: {bounty.get('tone_requirements')}
- Glossary Terms: {bounty.get('glossary_terms')}
- Quality Requirements: {bounty.get('quality_requirements')}
- Reward Amount: {bounty.get('reward_amount')}

Translator Submission:
- Translated Text: {submission.get('translated_text')}
- Translator Notes: {submission.get('translator_notes')}
- Glossary Choices: {submission.get('glossary_choices')}
- Cultural Context Notes: {submission.get('cultural_context_notes')}

Instructions:
Evaluate the translation thoroughly. You must decide the verdict based on accuracy, fluency, terminology adherence, tone preservation, and completeness.
Return ONLY valid JSON matching this schema exactly. Do not output markdown code blocks, just raw JSON:

{{
  "verdict": "APPROVED|APPROVED_WITH_MINOR_ISSUES|NEEDS_REVISION|REJECTED|ESCALATE",
  "quality_score": 85,
  "confidence": 95,
  "release_payment": true,
  "recommended_payment_amount": 100.0,
  "accuracy": {{"score": 90, "reason": "Accurate overall"}},
  "fluency": {{"score": 80, "reason": "Flows well"}},
  "terminology": {{"score": 100, "reason": "Followed glossary"}},
  "tone_preservation": {{"score": 85, "reason": "Tone matched"}},
  "completeness": {{"score": 100, "reason": "All text translated"}},
  "safety_and_risk": {{"score": 100, "reason": "No malicious content"}},
  "accepted_strengths": ["string"],
  "issues_found": ["string"],
  "revision_instructions": ["string"],
  "reasoning_summary": "string"
}}
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(res, str):
                try:
                    res = json.loads(res)
                except Exception:
                    pass
            return res if isinstance(res, dict) else {"verdict": "REJECTED"}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, glvm.Return):
                return False
            my_res = leader_fn()
            # Consensus is reached if they agree on the final verdict and payment action
            return (
                leader_result.calldata.get("verdict") == my_res.get("verdict")
                and leader_result.calldata.get("release_payment") == my_res.get("release_payment")
            )

        review_data = glvm.run_nondet_unsafe(leader_fn, validator_fn)

        self.reviews[submission_id] = json.dumps(review_data)

        verdict = review_data.get("verdict", "REJECTED")
        submission["status"] = verdict

        if review_data.get("release_payment"):
            submission["payment_status"] = "PAYABLE"
        else:
            submission["payment_status"] = "BURNED"

        self.submissions[submission_id] = json.dumps(submission)

        try:
            rep = json.loads(self.reputations[submission["translator"]])
            if verdict in ["APPROVED", "APPROVED_WITH_MINOR_ISSUES"]:
                rep["approved_count"] += 1
                if submission["payment_status"] == "PAYABLE":
                    payable_val = review_data.get("recommended_payment_amount")
                    if payable_val is None:
                        payable_val = bounty.get("reward_amount", 0)
                    payable = float(payable_val)
                    rep["total_payable_amount"] += payable
                    protocol_stats = json.loads(self.stats["protocol"])
                    protocol_stats["total_payable_amount"] += payable
                    self.stats["protocol"] = json.dumps(protocol_stats)
                    try:
                        _Recipient(Address(submission["translator"])).emit(value=u256(int(payable * 10**18)), on='finalized')
                    except Exception as e:
                        protocol_stats["last_payout_error"] = str(e)
                        self.stats["protocol"] = json.dumps(protocol_stats)
            elif verdict == "REJECTED":
                rep["rejected_count"] += 1
            elif verdict == "NEEDS_REVISION":
                rep["revision_count"] += 1

            qs = float(review_data.get("quality_score", 0))
            if rep["total_submissions"] > 0:
                current_avg = rep["average_quality_score"]
                n = rep["total_submissions"]
                rep["average_quality_score"] = ((current_avg * (n - 1)) + qs) / n
            else:
                rep["average_quality_score"] = qs

            self.reputations[submission["translator"]] = json.dumps(rep)

            protocol_stats = json.loads(self.stats["protocol"])
            protocol_stats["total_reviews"] += 1
            self.stats["protocol"] = json.dumps(protocol_stats)
        except Exception as e:
            # If reputation update fails, we log it into the submission for visibility
            submission["status"] = "ERROR_IN_REP_UPDATE"
            submission["translator_notes"] = str(e)
            self.submissions[submission_id] = json.dumps(submission)

        return verdict

    # --- 5. REQUEST REVISION ---

    @gl.public.write
    def request_revision(self, submission_id: str, revision_json: str) -> str:
        submission_str = self.submissions.get(submission_id)
        if not submission_str:
            raise Exception("Submission not found")
        submission = json.loads(submission_str)

        if submission["translator"] != gl.message.sender_address.as_hex:
            raise Exception("Only the translator can submit a revision")

        if submission["status"] != "NEEDS_REVISION":
            raise Exception("Submission does not require revision")

        revision_data = json.loads(revision_json)
        
        if "revisions" not in submission:
            submission["revisions"] = []
        
        submission["revisions"].append(revision_data)
        
        if revision_data.get("revised_translated_text"):
            submission["translated_text"] = revision_data["revised_translated_text"]
        
        submission["status"] = "REVISION_SUBMITTED"
        self.submissions[submission_id] = json.dumps(submission)

        return "REVISION_SUBMITTED"

    # --- 6. REVIEW REVISION ---

    @gl.public.write
    def review_revision(self, submission_id: str) -> str:
        submission_str = self.submissions.get(submission_id)
        if not submission_str:
            raise Exception("Submission not found")
        submission = json.loads(submission_str)

        if submission["status"] != "REVISION_SUBMITTED":
            raise Exception("No pending revision to review")

        bounty = json.loads(self.bounties[submission["bounty_id"]])
        old_review = json.loads(self.reviews.get(submission_id, "{}"))
        latest_revision = submission["revisions"][-1]

        def leader_fn() -> dict:
            prompt = f"""You are an expert linguistic auditor reviewing a REVISED human translation.

Bounty Requirements:
- Source Text: {bounty.get('source_text')}
- Target Language: {bounty.get('target_language')}

Previous Review Issues:
{old_review.get('issues_found', [])}
Previous Revision Instructions:
{old_review.get('revision_instructions', [])}

Revised Translation:
{latest_revision.get('revised_translated_text')}
Translator Response to Issues:
{latest_revision.get('response_to_issues')}

Instructions:
Evaluate if the revision successfully addressed the prior issues and meets quality standards.
Return ONLY valid JSON matching this schema exactly:
{{
  "verdict": "APPROVED|APPROVED_WITH_MINOR_ISSUES|NEEDS_REVISION|REJECTED|ESCALATE",
  "quality_score": 0,
  "confidence": 0,
  "release_payment": true,
  "recommended_payment_amount": 0,
  "accuracy": {{"score": 0, "reason": "string"}},
  "fluency": {{"score": 0, "reason": "string"}},
  "terminology": {{"score": 0, "reason": "string"}},
  "tone_preservation": {{"score": 0, "reason": "string"}},
  "completeness": {{"score": 0, "reason": "string"}},
  "safety_and_risk": {{"score": 0, "reason": "string"}},
  "accepted_strengths": ["string"],
  "issues_found": ["string"],
  "revision_instructions": ["string"],
  "reasoning_summary": "string"
}}
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(res, str):
                try:
                    res = json.loads(res)
                except Exception:
                    pass
            return res if isinstance(res, dict) else {"verdict": "REJECTED"}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, glvm.Return):
                return False
            my_res = leader_fn()
            return (
                leader_result.calldata.get("verdict") == my_res.get("verdict")
                and leader_result.calldata.get("release_payment") == my_res.get("release_payment")
            )

        review_data = glvm.run_nondet_unsafe(leader_fn, validator_fn)

        self.reviews[submission_id] = json.dumps(review_data)

        verdict = review_data.get("verdict", "REJECTED")
        submission["status"] = verdict

        if review_data.get("release_payment"):
            submission["payment_status"] = "PAYABLE"
        else:
            submission["payment_status"] = "BURNED"

        self.submissions[submission_id] = json.dumps(submission)

        rep = json.loads(self.reputations[submission["translator"]])
        if verdict in ["APPROVED", "APPROVED_WITH_MINOR_ISSUES"]:
            rep["approved_count"] += 1
            if submission["payment_status"] == "PAYABLE":
                payable = float(review_data.get("recommended_payment_amount", bounty.get("reward_amount", 0)))
                rep["total_payable_amount"] += payable
                protocol_stats = json.loads(self.stats["protocol"])
                protocol_stats["total_payable_amount"] += payable
                self.stats["protocol"] = json.dumps(protocol_stats)
                try:
                    _Recipient(Address(submission["translator"])).emit_transfer(value=u256(int(payable * 10**18)))
                except Exception as e:
                    protocol_stats["last_payout_error"] = str(e)
                    self.stats["protocol"] = json.dumps(protocol_stats)
        elif verdict == "REJECTED":
            rep["rejected_count"] += 1

        self.reputations[submission["translator"]] = json.dumps(rep)

        return verdict

    # --- 7. OPEN DISPUTE ---

    @gl.public.write
    def open_dispute(self, submission_id: str, dispute_json: str) -> str:
        submission_str = self.submissions.get(submission_id)
        if not submission_str:
            raise Exception("Submission not found")
        submission = json.loads(submission_str)
        bounty = json.loads(self.bounties[submission["bounty_id"]])

        caller = gl.message.sender_address.as_hex
        if caller != submission["translator"] and caller != bounty["requester"]:
            raise Exception("Only translator or requester can open a dispute")

        data = json.loads(dispute_json)
        
        counter = int(self.stats.get("dispute_counter", "0")) + 1
        dispute_id = f"D-{counter}"
        self.stats["dispute_counter"] = str(counter)

        data["dispute_id"] = dispute_id
        data["submission_id"] = submission_id
        data["opener"] = caller
        data["status"] = "OPEN"

        self.disputes[dispute_id] = json.dumps(data)

        rep = json.loads(self.reputations[submission["translator"]])
        rep["dispute_count"] += 1
        self.reputations[submission["translator"]] = json.dumps(rep)

        protocol_stats = json.loads(self.stats["protocol"])
        protocol_stats["total_disputes"] += 1
        self.stats["protocol"] = json.dumps(protocol_stats)

        return dispute_id

    # --- 8. REVIEW DISPUTE ---

    @gl.public.write
    def review_dispute(self, dispute_id: str) -> str:
        dispute_str = self.disputes.get(dispute_id)
        if not dispute_str:
            raise Exception("Dispute not found")
        dispute = json.loads(dispute_str)

        if dispute["status"] != "OPEN":
            raise Exception("Dispute already closed")

        submission_id = dispute["submission_id"]
        submission = json.loads(self.submissions[submission_id])
        bounty = json.loads(self.bounties[submission["bounty_id"]])
        review = json.loads(self.reviews.get(submission_id, "{}"))

        def leader_fn() -> dict:
            prompt = f"""You are the Supreme Dispute Resolution Node for LinguaNova Protocol.
A client has disputed an AI review that approved a translation.

Bounty Requirements:
- Source Text: {bounty.get('source_text')}
- Target Language: {bounty.get('target_language')}
- Domain: {bounty.get('domain')}

Translator Submission:
- Translated Text: {submission.get('translated_text')}

Dispute Details (Client claims the translation is incorrect):
- Explanation: {dispute.get('explanation')}
- Requested Outcome: {dispute.get('requested_outcome')}

Instructions:
Evaluate the dispute claims against the translation and the original review. Decide the final appellate verdict.
Return ONLY valid JSON matching this schema exactly:
{{
  "dispute_decision": "ORIGINAL_UPHELD|DECISION_ADJUSTED|REVISION_REQUIRED|DISPUTE_REJECTED|ESCALATE",
  "new_submission_decision": "APPROVED|APPROVED_WITH_MINOR_ISSUES|NEEDS_REVISION|REJECTED|ESCALATE",
  "new_quality_score": 0,
  "release_payment": true,
  "adjusted_payment_amount": 0,
  "confidence": 0,
  "accepted_arguments": ["string"],
  "rejected_arguments": ["string"],
  "reasoning_summary": "string",
  "final_recommendation": "string"
}}
"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(res, str):
                try:
                    res = json.loads(res)
                except Exception:
                    pass
            return res if isinstance(res, dict) else {"dispute_decision": "ESCALATE"}

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, glvm.Return):
                return False
            my_res = leader_fn()
            return (
                leader_result.calldata.get("dispute_decision") == my_res.get("dispute_decision")
                and leader_result.calldata.get("new_submission_decision") == my_res.get("new_submission_decision")
            )

        dispute_review_data = glvm.run_nondet_unsafe(leader_fn, validator_fn)

        self.dispute_reviews[dispute_id] = json.dumps(dispute_review_data)
        
        dispute["status"] = dispute_review_data.get("dispute_decision", "ESCALATE")
        self.disputes[dispute_id] = json.dumps(dispute)

        submission["status"] = dispute_review_data.get("new_submission_decision", submission["status"])
        if dispute_review_data.get("release_payment"):
            submission["payment_status"] = "PAYABLE"
            protocol_stats = json.loads(self.stats["protocol"])
            try:
                bounty_str = self.bounties.get(submission["bounty_id"])
                bounty = json.loads(bounty_str)
                payable = float(dispute_review_data.get("adjusted_payment_amount", bounty.get("reward_amount", 0)))
                _Recipient(Address(submission["translator"])).emit_transfer(value=u256(int(payable * 10**18)), on='finalized')
            except Exception as e:
                protocol_stats["last_payout_error"] = str(e)
                self.stats["protocol"] = json.dumps(protocol_stats)
        else:
            submission["payment_status"] = "BURNED"
            
        self.submissions[submission_id] = json.dumps(submission)

        return dispute["status"]

    # --- 9. VIEW METHODS ---

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> str:
        return self.bounties.get(bounty_id, "{}")

    @gl.public.view
    def get_submission(self, submission_id: str) -> str:
        return self.submissions.get(submission_id, "{}")

    @gl.public.view
    def get_submission_review(self, submission_id: str) -> str:
        return self.reviews.get(submission_id, "{}")

    @gl.public.view
    def get_bounty_submissions(self, bounty_id: str) -> str:
        bounty_str = self.bounties.get(bounty_id)
        if not bounty_str:
            return "[]"
        bounty = json.loads(bounty_str)
        sub_ids = bounty.get("submissions", [])
        
        results = []
        for sid in sub_ids:
            sub_str = self.submissions.get(sid)
            if sub_str:
                results.append(json.loads(sub_str))
        return json.dumps(results)

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        return self.disputes.get(dispute_id, "{}")

    @gl.public.view
    def get_dispute_review(self, dispute_id: str) -> str:
        return self.dispute_reviews.get(dispute_id, "{}")

    @gl.public.view
    def get_translator_reputation(self, address: str) -> str:
        try:
            addr = Address(address).as_hex
        except Exception:
            addr = address.lower()
        return self.reputations.get(addr, "{}")

    @gl.public.view
    def get_user_bounties(self, address: str) -> str:
        try:
            addr = Address(address).as_hex
        except Exception:
            addr = address.lower()
        
        results = []
        count = int(self.stats.get("bounty_counter", "0"))
        for i in range(1, count + 1):
            bid = f"B-{i}"
            b = self.bounties.get(bid)
            if b:
                data = json.loads(b)
                if data.get("requester") == addr:
                    results.append(data)
        return json.dumps(results)

    @gl.public.view
    def get_user_submissions(self, address: str) -> str:
        try:
            addr = Address(address).as_hex
        except Exception:
            addr = address.lower()
        
        results = []
        count = int(self.stats.get("submission_counter", "0"))
        for i in range(1, count + 1):
            sid = f"S-{i}"
            s = self.submissions.get(sid)
            if s:
                data = json.loads(s)
                if data.get("translator") == addr:
                    results.append(data)
        return json.dumps(results)

    @gl.public.view
    def get_protocol_stats(self) -> str:
        return self.stats.get("protocol", "{}")

    @gl.public.view
    def get_all_bounties(self) -> str:
        results = []
        count = int(self.stats.get("bounty_counter", "0"))
        start = max(1, count - 20)
        for i in range(count, start - 1, -1):
            bid = f"B-{i}"
            b = self.bounties.get(bid)
            if b:
                results.append(json.loads(b))
        return json.dumps(results)
