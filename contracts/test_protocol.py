"""Integration tests for LinguaNova Translation Verification Protocol.

Run with: gltest contracts/test_protocol.py -v -s
"""

import pytest
import json
from gltest import get_contract_factory
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded

@pytest.mark.integration
def deploy_contract():
    factory = get_contract_factory("linguanova", directory="contracts")
    contract = factory.deploy()
    return contract

@pytest.mark.integration
def test_linguanova_happy_path_and_replay_prevention():
    contract = load_fixture(deploy_contract)
    
    # 1. Create Bounty with value
    bounty_req = {
        "title": "Translate short greeting",
        "source_text": "Hello, how are you?",
        "source_language": "English",
        "target_language": "Spanish",
        "domain": "GENERAL",
        "tone_requirements": "Friendly",
        "glossary_terms": "",
        "quality_requirements": "Must sound natural",
        "reward_amount": 10.0,
        "currency": "GEN"
    }
    
    # Attach 10 GEN (10 * 10**18 wei)
    result = contract.create_bounty(args=[json.dumps(bounty_req)], value=int(10 * 10**18))
    assert tx_execution_succeeded(result)
    
    # 2. Submit Translation (Strong)
    submission_req = {
        "translated_text": "Hola, ¿cómo estás?",
        "translator_notes": "Standard friendly greeting in Spanish.",
        "glossary_choices": "",
        "cultural_context_notes": "",
        "self_assessed_confidence": 100
    }
    
    result_sub = contract.submit_translation(args=["B-1", json.dumps(submission_req)])
    assert tx_execution_succeeded(result_sub)
    
    # 3. Review Translation
    result_rev = contract.review_translation(
        args=["S-1"],
        wait_interval=10000,
        wait_retries=20,
    )
    assert tx_execution_succeeded(result_rev)
    
    # Check outcomes
    sub = json.loads(contract.get_submission(args=["S-1"]))
    assert sub["status"] in ["APPROVED", "APPROVED_WITH_MINOR_ISSUES"]
    assert sub["payment_status"] == "PAID"
    
    rev = json.loads(contract.get_submission_review(args=["S-1"]))
    assert float(rev["quality_score"]) > 80
    
    bounty = json.loads(contract.get_bounty(args=["B-1"]))
    assert float(bounty["escrow_balance"]) == 0
    assert bounty["status"] == "CLOSED"
    
    # 4. Attempt Replay (Second submission should fail or get 0 payout)
    submission_req_2 = {
        "translated_text": "Hola, ¿qué tal?",
        "translator_notes": "Another valid greeting.",
        "glossary_choices": "",
        "cultural_context_notes": "",
        "self_assessed_confidence": 100
    }
    
    # Because status is CLOSED, this should fail at submission
    with pytest.raises(Exception):
        contract.submit_translation(args=["B-1", json.dumps(submission_req_2)])


@pytest.mark.integration
def test_linguanova_weak_translation_dispute_and_limits():
    contract = load_fixture(deploy_contract)
    
    # 1. Create Bounty
    bounty_req = {
        "title": "Translate technical phrase",
        "source_text": "The smart contract executes the bytecode",
        "source_language": "English",
        "target_language": "French",
        "domain": "TECHNICAL",
        "tone_requirements": "Formal",
        "glossary_terms": "smart contract -> contrat intelligent",
        "quality_requirements": "Must be technically accurate",
        "reward_amount": 20.0,
        "currency": "GEN"
    }
    contract.create_bounty(args=[json.dumps(bounty_req)], value=int(20 * 10**18))
    
    # 2. Submit Translation (Weak)
    submission_req = {
        "translated_text": "Le contrat stupide execute la pizza",
        "translator_notes": "",
        "glossary_choices": "",
        "cultural_context_notes": "",
        "self_assessed_confidence": 10
    }
    contract.submit_translation(args=["B-1", json.dumps(submission_req)])
    
    # 3. Review Translation
    result_rev = contract.review_translation(
        args=["S-1"],
        wait_interval=10000,
        wait_retries=20,
    )
    assert tx_execution_succeeded(result_rev)
    
    # Check outcomes
    sub = json.loads(contract.get_submission(args=["S-1"]))
    assert sub["status"] in ["REJECTED", "NEEDS_REVISION"]
    assert sub["payment_status"] == "BURNED"
    
    # 4. Translator opens a dispute
    dispute_req = {
        "dispute_reason": "I think my translation is actually correct.",
        "explanation": "Pizza means bytecode in my dialect.",
        "requested_outcome": "APPROVE"
    }
    contract.open_dispute(args=["S-1", json.dumps(dispute_req)])
    
    # 5. Review Dispute
    result_disp = contract.review_dispute(
        args=["D-1"],
        wait_interval=10000,
        wait_retries=20,
    )
    assert tx_execution_succeeded(result_disp)
    
    disp = json.loads(contract.get_dispute(args=["D-1"]))
    assert disp["status"] in ["ORIGINAL_UPHELD", "DISPUTE_REJECTED"]
    
    bounty = json.loads(contract.get_bounty(args=["B-1"]))
    assert float(bounty["escrow_balance"]) == 20.0  # Escrow remains untouched because it was burned/not paid out


@pytest.mark.integration
def test_linguanova_revision_flow():
    contract = load_fixture(deploy_contract)
    
    # 1. Create Bounty
    bounty_req = {
        "title": "Translate technical phrase",
        "source_text": "The smart contract executes the bytecode",
        "source_language": "English",
        "target_language": "French",
        "domain": "TECHNICAL",
        "tone_requirements": "Formal",
        "glossary_terms": "smart contract -> contrat intelligent",
        "quality_requirements": "Must be technically accurate",
        "reward_amount": 15.0,
        "currency": "GEN"
    }
    contract.create_bounty(args=[json.dumps(bounty_req)], value=int(15 * 10**18))
    
    # 2. Submit Translation (Slightly off to trigger revision)
    submission_req = {
        "translated_text": "Le contrat intelligent execute le bytecode",
        "translator_notes": "Need revision maybe",
        "glossary_choices": "",
        "cultural_context_notes": "",
        "self_assessed_confidence": 70
    }
    contract.submit_translation(args=["B-1", json.dumps(submission_req)])
    
    # 3. Review Translation - Assuming this triggers NEEDS_REVISION because "execute" is missing accent (exécute)
    result_rev = contract.review_translation(
        args=["S-1"],
        wait_interval=10000,
        wait_retries=20,
    )
    assert tx_execution_succeeded(result_rev)
    
    sub = json.loads(contract.get_submission(args=["S-1"]))
    
    # 4. Request Revision if necessary
    if sub["status"] == "NEEDS_REVISION":
        revision_req = {
            "revised_translated_text": "Le contrat intelligent exécute le bytecode",
            "response_to_issues": "Added missing accent"
        }
        contract.request_revision(args=["S-1", json.dumps(revision_req)])
        
        # 5. Review Revision
        result_rev_rev = contract.review_revision(
            args=["S-1"],
            wait_interval=10000,
            wait_retries=20,
        )
        assert tx_execution_succeeded(result_rev_rev)
        
        sub = json.loads(contract.get_submission(args=["S-1"]))
        assert sub["status"] in ["APPROVED", "APPROVED_WITH_MINOR_ISSUES"]
        assert sub["payment_status"] == "PAID"
        
        bounty = json.loads(contract.get_bounty(args=["B-1"]))
        assert float(bounty["escrow_balance"]) == 0
        assert bounty["status"] == "CLOSED"


@pytest.mark.integration
def test_linguanova_transfer_failure_preserves_escrow():
    contract = load_fixture(deploy_contract)
    
    # Deploy rejector contract natively
    rejector_factory = get_contract_factory("rejector", directory="contracts")
    rejector_contract = rejector_factory.deploy()
    
    bounty_req = {
        "title": "Translate short greeting",
        "source_text": "Hello world",
        "source_language": "English",
        "target_language": "Spanish",
        "domain": "GENERAL",
        "tone_requirements": "Friendly",
        "glossary_terms": "",
        "quality_requirements": "Must sound natural",
        "reward_amount": 10.0,
        "currency": "GEN"
    }
    
    # Attach 10 GEN
    contract.create_bounty(args=[json.dumps(bounty_req)], value=int(10 * 10**18))
    
    submission_req = {
        "translated_text": "Hola mundo",
        "translator_notes": "Standard",
        "glossary_choices": "",
        "cultural_context_notes": "",
        "self_assessed_confidence": 100
    }
    
    # Use rejector contract as the translator (this address has no payable fallback)
    # The transaction will use the rejector contract's address as the sender
    contract.submit_translation(args=["B-1", json.dumps(submission_req)], from_=rejector_contract.address)
    
    # Review should execute cleanly, but the payout inside will natively fail
    # because rejector_contract cannot receive GEN.
    contract.review_translation(
        args=["S-1"],
        wait_interval=10000,
        wait_retries=20,
    )
    
    # Check outcomes
    sub = json.loads(contract.get_submission(args=["S-1"]))
    assert sub["status"] in ["APPROVED", "APPROVED_WITH_MINOR_ISSUES"]
    assert sub["payment_status"] == "FAILED" # Payment status should explicitly be FAILED
    
    bounty = json.loads(contract.get_bounty(args=["B-1"]))
    # ESCROW SHOULD BE PRESERVED (NOT REDUCED)
    assert float(bounty["escrow_balance"]) == 10.0
    assert bounty["status"] == "IN_PROGRESS" # Not closed, because escrow still exists
