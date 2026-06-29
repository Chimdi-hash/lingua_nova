"use client";

import { useState, useEffect } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import dynamic from "next/dynamic";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });

// We assume the contract address will be provided in production, or hardcoded for the studio test
const CONTRACT_ADDRESS = "0x8cd7Ff658C6771c4e2Db1351Dd9EE8fb4124B19A";

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

  const ensureNetwork = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xf22f" }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await eth.request({
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
        } catch (addError) {
          console.error("Error adding network:", addError);
        }
      } else {
        console.error("Error switching network:", switchError);
      }
    }
  };

  const handleTranslate = async () => {
    if (!text) return;
    if (text.length > 200) {
      alert("Text exceeds 200 characters.");
      return;
    }
    if (!account) {
      await initClient(true);
      if (!account) return;
    }

    await ensureNetwork();

    setIsTranslating(true);
    setTranslation("");
    try {
      // Re-create client to ensure fresh nonce/state
      const currentClient = createClient({
        chain: studionet,
        account: account as `0x${string}`,
      });

      // Trigger the contract transaction
      const hash = await currentClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "translate",
        args: [text, targetLang],
        value: BigInt(0),
      });
      
      // Wait for transaction receipt
      const receipt = await currentClient.waitForTransactionReceipt({ 
        hash,
        status: "ACCEPTED" as any,
        retries: 30,
        interval: 3000,
      });
      
      await fetchHistory(currentClient, account);
      
      alert("Translation completed successfully!");
      setText(""); // Clear text to prevent duplicate identical transactions
    } catch (error: any) {
      console.error("Translation error:", error);
      const errMsg = error.message || String(error);
      alert(
        "Translation failed.\n\n" +
        "If you are running back-to-back translations, the Studio network AI rate limit might be kicking in, or the 5 validators could not reach 100% identical consensus on the translation.\n\n" +
        "Details: " + errMsg.substring(0, 150) + "..."
      );
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
