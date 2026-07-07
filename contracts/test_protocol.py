"""Integration tests for LinguaNova Translation Verification Protocol.

Run with: gltest contracts/test_protocol.py -v -s
"""

import pytest
import json
from gltest import get_contract_factory, default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded

@pytest.mark.integration
def deploy_contract():
    factory = get_contract_factory("linguanova", directory="contracts")
    contract = factory.deploy()
    return contract

@pytest.mark.integration
def test_linguanova_happy_path():
    contract = load_fixture(deploy_contract)
    
    # 1. Create Bounty
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
        "currency": "USD"
    }
    
    result = contract.create_bounty(args=[json.dumps(bounty_req)])
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
    assert sub["payment_status"] == "PAYABLE"
    
    rev = json.loads(contract.get_submission_review(args=["S-1"]))
    assert float(rev["quality_score"]) > 80

@pytest.mark.integration
def test_linguanova_weak_translation():
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
        "currency": "USD"
    }
    contract.create_bounty(args=[json.dumps(bounty_req)])
    
    # 2. Submit Translation (Weak - completely ignores glossary and makes no sense)
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
    assert sub["payment_status"] == "WITHHELD"
    
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
