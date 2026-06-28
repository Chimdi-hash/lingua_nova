"use client";

import { useState, useEffect } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import dynamic from "next/dynamic";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });

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

  const handleDisconnect = () => {
    setAccount(null);
    setClient(null);
    setHistory([]);
  };

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
      await fetchHistory(client, account!);
      
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
    <>
      <nav className="navbar">
        <div className="logo-text">LinguaNova</div>
        <div className="wallet-container">
          {account ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="connected-badge">
                <span className="dot"></span>
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
              <button className="nav-btn disconnect-button" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className="nav-btn" onClick={() => initClient(true)}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <div className="container">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>

      <header className="header">
        {/* Floating rotating canvas globe */}
        <div className="globe-wrapper" aria-hidden="true">
          <GlobeCanvas />
        </div>

        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          AI Consensus · 5 Validators · Studio Network
        </div>
        <h1 className="title">
          <span className="title-line1 animate-title-1">Decentralized</span>
          <span className="title-line2 animate-title-2">Language Intelligence</span>
        </h1>
        <p className="subtitle">
          Real-time translation powered by <span className="subtitle-highlight">GenLayer's</span> multi-validator AI consensus
        </p>
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">5</span>
            <span className="stat-label">Validators</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-number">50+</span>
            <span className="stat-label">Languages</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">On-Chain</span>
          </div>
        </div>
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
            <optgroup label="🌍 African Languages">
              <option value="Afrikaans">Afrikaans</option>
              <option value="Amharic">Amharic</option>
              <option value="Hausa">Hausa</option>
              <option value="Igbo">Igbo</option>
              <option value="Shona">Shona</option>
              <option value="Somali">Somali</option>
              <option value="Swahili">Swahili</option>
              <option value="Xhosa">Xhosa</option>
              <option value="Yoruba">Yoruba</option>
              <option value="Zulu">Zulu</option>
            </optgroup>
            <optgroup label="🌏 Asian Languages">
              <option value="Bengali">Bengali</option>
              <option value="Burmese">Burmese (Myanmar)</option>
              <option value="Cantonese">Cantonese</option>
              <option value="Filipino">Filipino (Tagalog)</option>
              <option value="Hindi">Hindi</option>
              <option value="Indonesian">Indonesian</option>
              <option value="Japanese">Japanese</option>
              <option value="Javanese">Javanese</option>
              <option value="Khmer">Khmer</option>
              <option value="Korean">Korean</option>
              <option value="Lao">Lao</option>
              <option value="Malay">Malay</option>
              <option value="Mandarin Chinese">Mandarin Chinese</option>
              <option value="Marathi">Marathi</option>
              <option value="Nepali">Nepali</option>
              <option value="Punjabi">Punjabi</option>
              <option value="Sinhala">Sinhala</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Thai">Thai</option>
              <option value="Urdu">Urdu</option>
              <option value="Vietnamese">Vietnamese</option>
            </optgroup>
            <optgroup label="🌐 Middle Eastern Languages">
              <option value="Arabic">Arabic</option>
              <option value="Azerbaijani">Azerbaijani</option>
              <option value="Farsi">Farsi (Persian)</option>
              <option value="Hebrew">Hebrew</option>
              <option value="Kurdish">Kurdish</option>
              <option value="Pashto">Pashto</option>
              <option value="Turkish">Turkish</option>
            </optgroup>
            <optgroup label="🌎 European Languages">
              <option value="Albanian">Albanian</option>
              <option value="Bosnian">Bosnian</option>
              <option value="Bulgarian">Bulgarian</option>
              <option value="Croatian">Croatian</option>
              <option value="Czech">Czech</option>
              <option value="Danish">Danish</option>
              <option value="Dutch">Dutch</option>
              <option value="Estonian">Estonian</option>
              <option value="Finnish">Finnish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Greek">Greek</option>
              <option value="Hungarian">Hungarian</option>
              <option value="Icelandic">Icelandic</option>
              <option value="Irish">Irish (Gaelic)</option>
              <option value="Italian">Italian</option>
              <option value="Latvian">Latvian</option>
              <option value="Lithuanian">Lithuanian</option>
              <option value="Macedonian">Macedonian</option>
              <option value="Maltese">Maltese</option>
              <option value="Norwegian">Norwegian</option>
              <option value="Polish">Polish</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Romanian">Romanian</option>
              <option value="Russian">Russian</option>
              <option value="Serbian">Serbian</option>
              <option value="Slovak">Slovak</option>
              <option value="Slovenian">Slovenian</option>
              <option value="Spanish">Spanish</option>
              <option value="Swedish">Swedish</option>
              <option value="Ukrainian">Ukrainian</option>
              <option value="Welsh">Welsh</option>
            </optgroup>
            <optgroup label="🌎 Americas Languages">
              <option value="Haitian Creole">Haitian Creole</option>
              <option value="Quechua">Quechua</option>
            </optgroup>
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

        <div className="built-on">
          <span className="built-on-dot"></span>
          Built on <span className="built-on-highlight">GenLayer Studio</span>
        </div>

      </div>
    </>
  );
}
