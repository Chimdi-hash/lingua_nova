# MILESTONE: Translation Verification Protocol Pivot

## Rejection Reason
The previous iteration of LinguaNova was rejected because: 
*"Simple translating by consensus is a bad practice; GenLayer is designed for solutions that entail consequences, like verifying a translation and paying its author."*

## What Changed
LinguaNova is no longer an AI translator. It is now a **Translation Bounty and Verification Protocol**.
- Instead of using GenLayer to generate translations, GenLayer is used to **audit** human-submitted translations.
- We implemented a complex bounty lifecycle (`OPEN` -> `IN_PROGRESS` -> `SUBMITTED` -> `APPROVED` / `REJECTED`).
- We utilized `gl.eq_principle.prompt_comparative` for the validators to independently score the human translation on multiple metrics (accuracy, fluency, terminology) and agree on a verdict and payment recommendation.
- We added a full dispute lifecycle.
- We implemented an on-chain reputation system.

## Why this is a better GenLayer fit
This uses GenLayer exactly as intended: as a Decentralized Autonomous Oracle that evaluates subjective real-world work (a translation) and executes high-stakes on-chain consequences (approving/rejecting payment and modifying reputation) based on AI consensus.

## Important Links
- **New Contract Address (Studio Network)**: `0x25B27F69f83927C07FA8f3567aE79B481AD5f2BB`
- **Live App URL**: (Deployed via Vercel)
- **Deployment Tx Hash**: `0xd72f62b5670c94fe24b7a0ed770286aac4d4959afbcc3c16ec38f266fb718397`

## Test Commands
Run the integration tests (assuming GenLayer test environment is configured):
```bash
python -m pytest contracts/test_protocol.py -v -s
```
