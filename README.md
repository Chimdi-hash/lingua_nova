# LinguaNova: Decentralized Translation Verification Protocol

LinguaNova is a decentralized verification network built on **GenLayer**. Unlike simple LLM wrappers that merely translate text, LinguaNova acts as a robust bounty, escrow, and validation protocol where independent AI validators evaluate human work and execute real consequences.

## Why GenLayer?
GenLayer's unique `prompt_comparative` consensus mechanism allows for decentralized subjective evaluation. 

In LinguaNova, a requester posts a translation bounty. A human translator submits their translation. Then, instead of just passing the text through an LLM, the GenLayer validators are prompted to act as an expert linguistic auditing panel. They independently judge the human's translation against the requester's constraints (tone, glossary, accuracy). 

If they reach consensus that the translation is accurate and acceptable, they issue an `APPROVED` verdict and flag the payment as `PAYABLE`. If not, they issue `REJECTED` or `NEEDS_REVISION`. The smart contract stores all verdicts, scores, reasoning, and translator reputation completely on-chain.

## Features
- **Bounty System**: Create translation jobs with specific constraints (Domain, Tone, Glossary).
- **Human Submission**: Translators submit their work with context notes.
- **AI Validator Consensus**: Using GenLayer's `gl.eq_principle.prompt_comparative`, validators independently score the submission across metrics like Fluency, Accuracy, and Safety, converging on a final verdict.
- **Dispute Resolution**: Full appellate path for disputed verdicts.
- **Reputation**: Fully automated on-chain translator reputation.

## Tech Stack
- **Smart Contracts**: Python (GenLayer `glvm`)
- **Frontend**: Next.js, React, Viem, wagmi, GenLayer-JS
- **Blockchain**: GenLayer Studio Network
