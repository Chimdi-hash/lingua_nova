"use client";

import { useState, useEffect } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, custom, http, publicActions, parseEther, formatEther } from "viem";

// Contract Address from Env or Fallback
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x8a00E0F2DB8AF8A9A97055a159fcf6694f907FEB";
const RPC_URL = "https://studio.genlayer.com/api";

export default function Dashboard() {
  const [account, setAccount] = useState<string | null>(null);
  const [walletClient, setWalletClient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [balance, setBalance] = useState<string>("0.00");
  const [loading, setLoading] = useState(false);
  const [bounties, setBounties] = useState<any[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [selectedBounty, setSelectedBounty] = useState<any | null>(null);

  const [bountyForm, setBountyForm] = useState({
    title: "", source_text: "", source_language: "", target_language: "",
    domain: "GENERAL", tone_requirements: "", glossary_terms: "",
    quality_requirements: "", reward_amount: "10"
  });
  const [submissionForm, setSubmissionForm] = useState({
    translated_text: "", translator_notes: "", glossary_choices: "", cultural_context_notes: ""
  });

  // Read-only client: direct HTTP — no MetaMask needed
  const getReadClient = () => createClient({
    chain: studionet,
    transport: http(RPC_URL),
  });

  // Write client: MetaMask signs via provider pattern
  const getWriteClient = (userAccount: string) => createClient({
    chain: studionet,
    provider: (window as any).ethereum,
    account: userAccount as `0x${string}`,
  });

  // Load public data immediately on page load — no wallet required
  useEffect(() => {
    fetchBounties();
    fetchAllSubmissions();
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) await connectWallet();
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
        params: [{
          chainId: "0xf22f",
          chainName: "GenLayer Studio",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [RPC_URL],
        }],
      });
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xf22f" }],
      });

      const wClient = createWalletClient({
        chain: studionet,
        transport: custom((window as any).ethereum),
      }).extend(publicActions);

      const accounts = await wClient.requestAddresses();
      setAccount(accounts[0]);
      setWalletClient(wClient);

      const bal = await wClient.getBalance({ address: accounts[0] });
      setBalance(Number(formatEther(bal)).toFixed(2));

      // Load user-specific submissions after connecting
      await fetchMySubmissions(accounts[0]);
    } catch (err: any) {
      console.error(err);
      alert("Connection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const requireWallet = async (): Promise<boolean> => {
    if (account) return true;
    await connectWallet();
    return !!account;
  };

  const fetchBalance = async (wClient?: any) => {
    if (!account) return;
    try {
      const client = wClient || walletClient;
      if (!client) return;
      const bal = await client.getBalance({ address: account as `0x${string}` });
      setBalance(Number(formatEther(bal)).toFixed(2));
    } catch (err) {
      console.error("Failed to fetch balance", err);
    }
  };

  // PUBLIC: fetch all bounties — no wallet needed
  const fetchBounties = async () => {
    try {
      const rClient = getReadClient();
      const res = await rClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_all_bounties",
        args: [],
      });
      setBounties(JSON.parse(res as string));
    } catch (err) {
      console.error("fetchBounties error:", err);
    }
  };

  // PUBLIC: fetch all submissions by looking up submission IDs across bounties — no wallet needed
  const fetchAllSubmissions = async () => {
    try {
      const rClient = getReadClient();
      const res = await rClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_all_bounties",
        args: [],
      });
      const allBounties = JSON.parse(res as string);
      
      let subIds: string[] = [];
      for (const b of allBounties) {
        if (b.submissions && Array.isArray(b.submissions)) {
          subIds.push(...b.submissions);
        }
      }
      
      const promises = subIds.map(async (sid) => {
        const sRes = await rClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: "get_submission",
          args: [sid],
        });
        return JSON.parse(sRes as string);
      });
      
      const allSubs = await Promise.all(promises);
      allSubs.sort((a, b) => {
        const idA = parseInt(a.submission_id.split('-')[1] || "0");
        const idB = parseInt(b.submission_id.split('-')[1] || "0");
        return idB - idA;
      });
      setAllSubmissions(allSubs);
    } catch (err) {
      console.error("fetchAllSubmissions error:", err);
    }
  };

  // PRIVATE: fetch only the connected user's submissions
  const fetchMySubmissions = async (addr?: string) => {
    const target = addr || account;
    if (!target) return;
    try {
      const rClient = getReadClient();
      const res = await rClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_user_submissions",
        args: [target],
      });
      setUserSubmissions(JSON.parse(res as string));
    } catch (err) {
      console.error("fetchMySubmissions error:", err);
    }
  };

  const sendWrite = async (functionName: string, args: any[], value: bigint = BigInt(0)) => {
    if (!account) throw new Error("Wallet not connected");
    const writeClient = getWriteClient(account);
    return await writeClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName,
      args,
      value,
    });
  };

  const waitForTx = async (hash: string) => {
    try {
      if (walletClient) {
        await walletClient.waitForTransactionReceipt({ hash });
      }
    } catch (e) {
      console.warn("Tx polling warning (may still succeed):", e);
    }
  };

  const handleCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) { await connectWallet(); return; }
    try {
      setLoading(true);
      const hash = await sendWrite("create_bounty", [JSON.stringify(bountyForm)], parseEther(bountyForm.reward_amount.toString()));
      alert("Transaction submitted! Waiting for confirmation...");
      await waitForTx(hash);
      alert("Bounty created successfully!");
      setActiveTab("browse");
      await fetchBounties();
      await fetchBalance();
    } catch (err: any) {
      alert("Failed to create bounty: " + (err.shortMessage || err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBounty) return;
    if (!account) { await connectWallet(); return; }
    try {
      setLoading(true);
      const hash = await sendWrite("submit_translation", [selectedBounty.bounty_id, JSON.stringify(submissionForm)]);
      alert("Translation submitted! Waiting for confirmation...");
      await waitForTx(hash);
      alert("Translation submitted successfully!");
      await fetchBounties();
      await fetchAllSubmissions();
      await fetchBalance();
      setSelectedBounty(null);
    } catch (err: any) {
      alert("Failed to submit translation: " + (err.shortMessage || err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleReviewTranslation = async (submissionId: string) => {
    if (!account) { await connectWallet(); return; }
    try {
      setLoading(true);
      const hash = await sendWrite("review_translation", [submissionId]);
      alert("Review process initiated on GenLayer. Validators are judging...");
      await waitForTx(hash);
      alert("Review complete! Check your submissions for the verdict.");
      await fetchMySubmissions();
      await fetchAllSubmissions();
      await fetchBounties();
      await fetchBalance();
    } catch (err: any) {
      alert("Failed to trigger review: " + (err.shortMessage || err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* ── HEADER ── */}
      <div className="header">
        <div className="header-title-container">
          <h2 className="header-title">LinguaNova Protocol</h2>
          <div className="header-subtitle">GENLAYER VERIFICATION NETWORK</div>
        </div>
        <div className="header-badge-container">
          {account ? (
            <>
              <span className="badge badge-account">
                {balance} GEN | {account.substring(0, 6)}...{account.substring(38)}
              </span>
              <button className="btn-secondary btn-disconnect" onClick={() => { setAccount(null); setWalletClient(null); setUserSubmissions([]); }}>
                DISCONNECT
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={connectWallet} disabled={loading}>
              {loading ? "CONNECTING..." : "CONNECT WALLET"}
            </button>
          )}
        </div>
      </div>

      {/* ── HERO BANNER (shown only when not connected) ── */}
      {!account && (
        <div style={{ textAlign: "center", padding: "2rem 1rem", borderBottom: "1px solid #1e293b", marginBottom: "1rem" }}>
          <p style={{ color: "#94a3b8", maxWidth: "600px", margin: "0 auto", lineHeight: "1.7" }}>
            Translators submit work. GenLayer AI validators independently judge quality, accuracy, and tone to reach on-chain consensus for payment and reputation.
            <br /><br />
            <span style={{ color: "#38bdf8" }}>Browse bounties freely below — connect your wallet to post or submit.</span>
          </p>
        </div>
      )}

      {/* ── NAV TABS ── */}
      <div className="nav-tabs">
        <div className={`nav-tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => { setActiveTab('browse'); fetchBounties(); if (account) fetchBalance(); }}>
          Browse Bounties
        </div>
        <div className={`nav-tab ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => { setActiveTab('submissions'); fetchAllSubmissions(); if (account) fetchBalance(); }}>
          All Submissions
        </div>
        <div className={`nav-tab ${activeTab === 'post' ? 'active' : ''}`} onClick={() => { setActiveTab('post'); if (account) fetchBalance(); }}>
          Post a Bounty
        </div>
        {account && (
          <div className={`nav-tab ${activeTab === 'my_submissions' ? 'active' : ''}`} onClick={() => { setActiveTab('my_submissions'); fetchMySubmissions(); fetchBalance(); }}>
            My Submissions
          </div>
        )}
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: "1rem", color: "#94a3b8" }}>Interacting with GenLayer blockchain...</p>
        </div>
      )}

      {/* ── BROWSE BOUNTIES (public) ── */}
      {!loading && activeTab === 'browse' && !selectedBounty && (
        <div>
          <h3>Open Translation Bounties</h3>
          {bounties.length === 0 ? <p style={{ color: "#94a3b8" }}>No bounties available right now.</p> : (
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
                    View &amp; Submit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOUNTY DETAIL + SUBMISSION FORM ── */}
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
              {!account && (
                <p style={{ color: "#f59e0b", marginBottom: "1rem", fontSize: "0.9rem" }}>
                  ⚠️ You need to connect your wallet to submit a translation.
                </p>
              )}
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
              <button type="submit" className="btn-primary">
                {account ? "Submit to Validators" : "Connect Wallet & Submit"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── ALL SUBMISSIONS (public — derived from bounties data) ── */}
      {!loading && activeTab === 'submissions' && (
        <div>
          <h3>All Submissions</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Showing the actual translation submissions made across the network.
          </p>
          {allSubmissions.length === 0 ? <p style={{ color: "#94a3b8" }}>No submissions yet.</p> : (
            <div className="grid">
              {allSubmissions.map((sub: any) => {
                const bounty = bounties.find(b => b.bounty_id === sub.bounty_id);
                const reward = bounty ? bounty.reward_amount : "?";
                
                return (
                  <div key={sub.submission_id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h4>Bounty: {sub.bounty_id}</h4>
                      <span className={`badge ${
                        sub.status === 'SUBMITTED' ? 'badge-in-progress' :
                        sub.status === 'APPROVED' ? 'badge-approved' :
                        sub.status === 'REJECTED' ? 'badge-rejected' : 'badge-review'
                      }`}>{sub.status}</span>
                    </div>
                    
                    <div className="detail-row"><span className="detail-label">Translator</span> <span style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{sub.translator}</span></div>
                    
                    <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "6px", marginTop: "0.75rem" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>{sub.translated_text}</p>
                    </div>
                    
                    {sub.payment_status && sub.payment_status !== 'PENDING' && (
                      <div className="detail-row" style={{ marginTop: "1rem", borderTop: "1px solid #1e293b", paddingTop: "0.75rem" }}>
                        <span className="detail-label">Payment Result</span>
                        {sub.payment_status === 'PAID' ? (
                          <span className="text-success" style={{ fontWeight: 600 }}>{reward} GEN Paid to Translator</span>
                        ) : sub.payment_status === 'BURNED' ? (
                          <span className="text-danger" style={{ fontWeight: 600 }}>{reward} GEN Burned (Rejected)</span>
                        ) : (
                          <span>{sub.payment_status}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── POST A BOUNTY (wallet required) ── */}
      {!loading && activeTab === 'post' && (
        <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h3>Create Translation Bounty</h3>
          {!account ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>You need to connect your wallet to post a bounty.</p>
              <button className="btn-primary" onClick={connectWallet}>Connect Wallet</button>
            </div>
          ) : (
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

              <label className="detail-label">Tone &amp; Quality Requirements (Guides the Validators)</label>
              <input value={bountyForm.tone_requirements} onChange={e => setBountyForm({...bountyForm, tone_requirements: e.target.value})} placeholder="e.g., Formal, professional, no slang" />

              <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }}>Post Bounty to Network</button>
            </form>
          )}
        </div>
      )}

      {/* ── MY SUBMISSIONS (wallet required) ── */}
      {!loading && activeTab === 'my_submissions' && account && (
        <div>
          <h3>My Translation Submissions</h3>
          {userSubmissions.length === 0 ? <p style={{ color: "#94a3b8" }}>You haven&apos;t submitted any translations yet.</p> : (
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
                        <span className={sub.payment_status === 'PAID' ? 'text-success' : 'text-danger'}>
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
