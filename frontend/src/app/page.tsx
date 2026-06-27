"use client";

import { useState, useEffect } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// We assume the contract address will be provided in production, or hardcoded for the studio test
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // Placeholder

export default function Home() {
  const [text, setText] = useState("");
  const [targetLang, setTargetLang] = useState("Spanish");
  const [translation, setTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    // Attempt to connect to Genlayer on mount if wallet is available
    if (typeof window !== "undefined" && (window as any).ethereum) {
      initClient();
    }
  }, []);

  const initClient = async (forceConnect = false) => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        if (forceConnect) alert("MetaMask is required.");
        return;
      }
      
      const accounts = await eth.request({ method: forceConnect ? "eth_requestAccounts" : "eth_accounts" });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const genClient = createClient({
          chain: studionet,
          account: accounts[0] as `0x${string}`,
        });
        setClient(genClient);
        // We could fetch history here
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async (genClient: any, userAccount: string) => {
    if (!genClient || !CONTRACT_ADDRESS) return;
    try {
      const result = await genClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_translation_history",
        args: [userAccount],
      });
      setHistory(result as any[]);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    if (client && account) {
      fetchHistory(client, account);
    }
  }, [client, account]);

  const handleTranslate = async () => {
    if (!text) return;
    if (text.length > 200) {
      alert("Text exceeds 200 characters.");
      return;
    }
    if (!client || !account) {
      await initClient(true);
      if (!client) return;
    }

    setIsTranslating(true);
    setTranslation("");
    try {
      // Trigger the contract transaction
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "translate",
        args: [text, targetLang],
      });
      
      // Wait for transaction receipt
      const receipt = await client.waitForTransactionReceipt({ hash });
      
      // We assume the translated text is in the event logs or we can just fetch the history.
      // Since our contract returns the string, we might not easily get the return value from writeContract 
      // in all cases without an event, but let's refresh history to get the latest.
      await fetchHistory(client, account);
      
      // For simplicity in this demo, since we didn't emit an event, we'll grab the latest history item
      alert("Translation completed successfully!");
    } catch (error) {
      console.error("Translation error:", error);
      alert("Error performing translation.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="container">
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      
      <header className="header">
        <h1 className="title">LinguaNova</h1>
        <p className="subtitle">Decentralized AI Translator Powered by GenLayer</p>
        
        {account ? (
          <p style={{ marginTop: '1rem', color: 'var(--primary-hover)', fontSize: '0.9rem' }}>
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        ) : (
          <button 
            className="button" 
            style={{ marginTop: '1rem', width: 'auto', padding: '0.5rem 1.5rem' }}
            onClick={() => initClient(true)}
          >
            Connect Wallet
          </button>
        )}
      </header>

      <div className="glass-panel">
        <div className="input-group">
          <label className="label">Source Text (Max 200 chars)</label>
          <textarea
            className="textarea"
            placeholder="Enter text to translate..."
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
          ></textarea>
          <div className="char-count">{text.length} / 200</div>
        </div>

        <div className="input-group">
          <label className="label">Target Language</label>
          <select 
            className="select"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Japanese">Japanese</option>
            <option value="Mandarin">Mandarin (Chinese)</option>
            <option value="Arabic">Arabic</option>
            <option value="Russian">Russian</option>
            <option value="Italian">Italian</option>
            <option value="Portuguese">Portuguese</option>
            <option value="Hindi">Hindi</option>
          </select>
        </div>

        <button 
          className="button" 
          onClick={handleTranslate} 
          disabled={isTranslating || !text || text.length > 200}
        >
          {isTranslating ? (
            <><span className="loader"></span> Awaiting Validators Consensus...</>
          ) : (
            "Translate via GenLayer"
          )}
        </button>

        {(history.length > 0) && (
          <div className="result-container">
            <label className="label">Recent Translations</label>
            <div className="result-box">
              {history.map((record, idx) => (
                <div key={idx} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    {record.target_language} Translation:
                  </div>
                  <div className="result-text">{record.translated_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
