"use client";

import { useState, useEffect } from "react";
import { createClient } from "genlayer-js";
import { createAccount } from "viem/accounts";
import { studionet } from "genlayer-js/chains";

// Contract Address from Env or Fallback
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xA919893DEEcf2B67f6De79476a1205Ce6a560021";

// Minimal Viem configuration for Wallet Connection
import { createWalletClient, custom, publicActions, parseEther, formatEther } from "viem";

export default function Dashboard() {
  const [account, setAccount] = useState<string | null>(null);
  const [client, setClient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [balance, setBalance] = useState<string>("0.00");
  const [loading, setLoading] = useState(false);
  const [bounties, setBounties] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [selectedBounty, setSelectedBounty] = useState<any | null>(null);

  // Form states
  const [bountyForm, setBountyForm] = useState({
    title: "", source_text: "", source_language: "", target_language: "",
    domain: "GENERAL", tone_requirements: "", glossary_terms: "",
    quality_requirements: "", reward_amount: "10"
  });
  const [submissionForm, setSubmissionForm] = useState({
    translated_text: "", translator_notes: "", glossary_choices: "", cultural_context_notes: ""
  });

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (err) {
        console.error("Wallet check error:", err);
      }
    }
  };

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask to use LinguaNova Protocol.");
      return;
    }
    try {
      setLoading(true);
      
      await (window as any).ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xf22f",
            chainName: "GenLayer Studio",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: ["https://studio.genlayer.com/api"],
          },
        ],
      });
      await (window as any).ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xf22f" }] });
      
      const walletClient = createWalletClient({
        chain: studionet,
        transport: custom((window as any).ethereum),
      }).extend(publicActions);

      const accounts = await walletClient.requestAddresses();
      setAccount(accounts[0]);
      
      const gClient = createClient({
        chain: studionet,
        transport: custom((window as any).ethereum),
        account: accounts[0] as `0x${string}`,
      });
      setClient(gClient);
      
      const bal = await walletClient.getBalance({ address: accounts[0] });
      setBalance(Number(formatEther(bal)).toFixed(2));
      
      await fetchBounties(gClient);
    } catch (err: any) {
      console.error(err);
      alert("Connection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBounties = async (genClient: any) => {
    try {
      const res = await genClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_all_bounties",
        args: [],
      });
      setBounties(JSON.parse(res));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBalance = async () => {
    if (!account) return;
    try {
      const walletClient = createWalletClient({
        chain: studionet,
        transport: custom((window as any).ethereum),
      }).extend(publicActions);
      const bal = await walletClient.getBalance({ address: account as `0x${string}` });
      setBalance(Number(formatEther(bal)).toFixed(2));
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  };

  const fetchMySubmissions = async () => {
    if (!client || !account) return;
    try {
      const res = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_user_submissions",
        args: [account],
      });
      setUserSubmissions(JSON.parse(res));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    try {
      setLoading(true);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "create_bounty",
        args: [JSON.stringify(bountyForm)],
        value: parseEther(bountyForm.reward_amount.toString()),
      });
      alert("Transaction submitted! Waiting for receipt...");
      await waitForTx(hash);
      alert("Bounty created successfully!");
      setActiveTab("browse");
      fetchBounties(client);
      fetchBalance();
    } catch (err: any) {
      alert("Failed to create bounty: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedBounty) return;
    try {
      setLoading(true);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "submit_translation",
        args: [selectedBounty.bounty_id, JSON.stringify(submissionForm)],
        value: BigInt(0),
      });
      alert("Translation submitted! Waiting for receipt...");
      await waitForTx(hash);
      alert("Translation submitted successfully!");
      fetchBounties(client);
      fetchBalance();
      setSelectedBounty(null);
    } catch (err: any) {
      alert("Failed to submit translation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewTranslation = async (submissionId: string) => {
    if (!client) return;
    try {
      setLoading(true);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "review_translation",
        args: [submissionId],
        value: BigInt(0),
      });
      alert("Review process initiated on GenLayer. Validators are judging...");
      await waitForTx(hash);
      alert("Review complete! Check your submissions or bounty details for the verdict.");
      fetchMySubmissions();
      fetchBounties(client);
      fetchBalance();
    } catch (err: any) {
      alert("Failed to review: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const waitForTx = async (hash: string) => {
    try {
      await client.waitForTransactionReceipt({ 
        hash,
        status: "ACCEPTED" as any,
        retries: 60,
        interval: 3000,
      });
    } catch (e) {
      console.warn("Polling error, continuing assuming success due to network sync.", e);
    }
  };

  if (!account) {
    return (
      <div className="container hero-container">
        <h1 className="hero-title">LinguaNova Protocol</h1>
        <p className="hero-subtitle">
          THE DECENTRALIZED TRANSLATION VERIFICATION NETWORK. 
          <br /><br />
          Translators submit work. GenLayer AI validators independently judge quality, accuracy, and tone to reach on-chain consensus for payment and reputation.
        </p>
        <button className="btn-primary hero-btn" onClick={connectWallet} disabled={loading}>
          {loading ? "INITIALIZING NEURAL LINK..." : "CONNECT METAMASK"}
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="header-title-container">
          <h2 className="header-title">LinguaNova Protocol</h2>
          <div className="header-subtitle">GENLAYER VERIFICATION NETWORK</div>
        </div>
        <div className="header-badge-container">
          <span className="badge badge-account">
            {balance} GEN | {account.substring(0, 6)}...{account.substring(38)}
          </span>
          <button className="btn-secondary btn-disconnect" onClick={() => setAccount(null)}>DISCONNECT</button>
        </div>
      </div>

      <div className="nav-tabs">
        <div className={`nav-tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => { setActiveTab('browse'); fetchBounties(client); fetchBalance(); }}>Browse Bounties</div>
        <div className={`nav-tab ${activeTab === 'post' ? 'active' : ''}`} onClick={() => { setActiveTab('post'); fetchBalance(); }}>Post a Bounty</div>
        <div className={`nav-tab ${activeTab === 'my_submissions' ? 'active' : ''}`} onClick={() => { setActiveTab('my_submissions'); fetchMySubmissions(); fetchBalance(); }}>My Submissions</div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: "1rem", color: "#94a3b8" }}>Interacting with GenLayer blockchain...</p>
        </div>
      )}

      {!loading && activeTab === 'browse' && !selectedBounty && (
        <div>
          <h3>Open Translation Bounties</h3>
          {bounties.length === 0 ? <p>No bounties available right now.</p> : (
            <div className="grid">
              {bounties.map(b => (
                <div key={b.bounty_id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <h4>{b.title}</h4>
                    <span className={`badge ${b.status === 'OPEN' ? 'badge-open' : 'badge-in-progress'}`}>{b.status}</span>
                  </div>
                  <div className="detail-row"><span className="detail-label">Route</span> <span>{b.source_language} ➔ {b.target_language}</span></div>
                  <div className="detail-row"><span className="detail-label">Reward</span> <span className="text-success">{b.reward_amount} GEN</span></div>
                  <div className="detail-row"><span className="detail-label">Domain</span> <span>{b.domain}</span></div>
                  
                  <button className="btn-secondary" style={{ width: "100%", marginTop: "1rem" }} onClick={() => setSelectedBounty(b)}>
                    View & Submit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && selectedBounty && (
        <div className="card">
          <button className="btn-secondary" style={{ marginBottom: "1rem" }} onClick={() => setSelectedBounty(null)}>← Back</button>
          <h3>{selectedBounty.title}</h3>
          <div className="grid">
            <div>
              <div className="detail-row"><span className="detail-label">Source Language</span> <span>{selectedBounty.source_language}</span></div>
              <div className="detail-row"><span className="detail-label">Target Language</span> <span>{selectedBounty.target_language}</span></div>
              <div className="detail-row"><span className="detail-label">Reward</span> <span className="text-success">{selectedBounty.reward_amount} GEN</span></div>
              <div className="detail-row"><span className="detail-label">Status</span> <span>{selectedBounty.status}</span></div>
            </div>
            <div>
              <div className="detail-row"><span className="detail-label">Domain</span> <span>{selectedBounty.domain}</span></div>
              <div className="detail-row"><span className="detail-label">Tone</span> <span>{selectedBounty.tone_requirements || 'Standard'}</span></div>
              <div className="detail-row"><span className="detail-label">Glossary</span> <span>{selectedBounty.glossary_terms || 'None'}</span></div>
            </div>
          </div>
          
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#0f172a", borderRadius: "6px" }}>
            <h5 style={{ marginBottom: "0.5rem", color: "#94a3b8" }}>Source Text to Translate:</h5>
            <p style={{ margin: 0 }}>{selectedBounty.source_text}</p>
          </div>

          {(selectedBounty.status === 'OPEN' || selectedBounty.status === 'IN_PROGRESS') && (
            <form onSubmit={handleSubmitTranslation} style={{ marginTop: "2rem", borderTop: "1px solid #334155", paddingTop: "2rem" }}>
              <h4>Submit Translation</h4>
              <textarea 
                rows={5} 
                placeholder="Enter your translation here..." 
                required
                value={submissionForm.translated_text}
                onChange={e => setSubmissionForm({...submissionForm, translated_text: e.target.value})}
              />
              <textarea 
                rows={2} 
                placeholder="Translator notes (explain your choices to the AI validators)..." 
                value={submissionForm.translator_notes}
                onChange={e => setSubmissionForm({...submissionForm, translator_notes: e.target.value})}
              />
              <button type="submit" className="btn-primary">Submit to Validators</button>
            </form>
          )}
        </div>
      )}

      {!loading && activeTab === 'post' && (
        <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h3>Create Translation Bounty</h3>
          <form onSubmit={handleCreateBounty}>
            <div className="grid">
              <div>
                <label className="detail-label">Title</label>
                <input required value={bountyForm.title} onChange={e => setBountyForm({...bountyForm, title: e.target.value})} placeholder="e.g., Translate Medical Abstract" />
              </div>
              <div>
                <label className="detail-label">Reward Amount (GEN)</label>
                <input type="number" required value={bountyForm.reward_amount} onChange={e => setBountyForm({...bountyForm, reward_amount: e.target.value})} />
              </div>
            </div>
            
            <div className="grid">
              <div>
                <label className="detail-label">Source Language</label>
                <input required value={bountyForm.source_language} onChange={e => setBountyForm({...bountyForm, source_language: e.target.value})} />
              </div>
              <div>
                <label className="detail-label">Target Language</label>
                <input required value={bountyForm.target_language} onChange={e => setBountyForm({...bountyForm, target_language: e.target.value})} />
              </div>
            </div>

            <label className="detail-label">Source Text</label>
            <textarea rows={4} required value={bountyForm.source_text} onChange={e => setBountyForm({...bountyForm, source_text: e.target.value})}></textarea>
            
            <label className="detail-label">Tone & Quality Requirements (Guides the Validators)</label>
            <input value={bountyForm.tone_requirements} onChange={e => setBountyForm({...bountyForm, tone_requirements: e.target.value})} placeholder="e.g., Formal, professional, no slang" />

            <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }}>Post Bounty to Network</button>
          </form>
        </div>
      )}

      {!loading && activeTab === 'my_submissions' && (
        <div>
          <h3>My Translation Submissions</h3>
          {userSubmissions.length === 0 ? <p>You haven't submitted any translations yet.</p> : (
            <div className="grid">
              {userSubmissions.map(sub => (
                <div key={sub.submission_id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <h4>Bounty: {sub.bounty_id}</h4>
                    <span className={`badge ${
                      sub.status === 'SUBMITTED' ? 'badge-in-progress' : 
                      sub.status === 'APPROVED' ? 'badge-approved' : 
                      sub.status === 'REJECTED' ? 'badge-rejected' : 'badge-review'
                    }`}>{sub.status}</span>
                  </div>
                  
                  <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "6px", marginBottom: "1rem" }}>
                    <h5 style={{ margin: "0 0 0.5rem 0", color: "#94a3b8", fontSize: "0.8rem" }}>YOUR TRANSLATION</h5>
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>{sub.translated_text}</p>
                  </div>
                  
                  {sub.status === 'SUBMITTED' && (
                    <button className="btn-primary" style={{ width: "100%" }} onClick={() => handleReviewTranslation(sub.submission_id)}>
                      Trigger Validator Review
                    </button>
                  )}
                  
                  {sub.status !== 'SUBMITTED' && (
                    <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem", marginTop: "1rem" }}>
                      <div className="detail-row">
                        <span className="detail-label">Payment Status</span> 
                        <span className={sub.payment_status === 'PAYABLE' ? 'text-success' : 'text-danger'}>
                          {sub.payment_status}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                        The GenLayer validators independently judged your translation and reached consensus on this verdict.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
