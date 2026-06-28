# 🌍 LinguaNova

**Decentralized Language Intelligence Built on GenLayer**

LinguaNova is a 100% on-chain translation dApp powered by GenLayer's Intelligent Contracts. It leverages a network of independent AI validators to translate text across 50+ languages natively on the blockchain.

## ✨ Features
- **AI Consensus Translation**: 5 independent AI nodes must agree on the accuracy of a translation before it is committed on-chain.
- **50+ Languages Supported**: Broad language support covering Africa, Asia, Europe, the Americas, and the Middle East.
- **100% Decentralized**: No centralized APIs, databases, or traditional web2 backends.
- **Immutable History**: Every successful translation is permanently stored in the smart contract's state.
- **Responsive UI**: A beautiful, glassmorphism-inspired interface featuring a rotating 3D canvas globe.

## 🧠 How It Works (The GenLayer Architecture)
When a user requests a translation:
1. **The Request** is submitted on-chain along with the target language.
2. **The Leader Node** executes a non-deterministic LLM call to translate the text.
3. **4 Validator Nodes** independently execute the exact same prompt.
4. **Consensus Phase**: GenLayer's equivalence principle (`gl.eq_principle.strict_eq`) compares the outputs. If a majority of nodes return the exact same identical JSON response, consensus is achieved.
5. **On-Chain Commit**: The verified translation is stored on the GenLayer blockchain.

## 🛠 Tech Stack
- **Frontend**: Next.js, React, TypeScript, Vanilla CSS
- **Smart Contract**: Python (GenLayer SDK)
- **Blockchain/Infrastructure**: GenLayer Studio Network
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- MetaMask (Configured for the GenLayer Studio Network)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Chimdi-hash/lingua_nova.git
   cd lingua_nova/frontend
