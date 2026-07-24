import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  try {
    const userAddress = "0x283606Fca4506EA75665e33BEc233698b80Af91d".toLowerCase();
    
    // Fetch latest 10 blocks
    const response = await fetch("https://studio.genlayer.com/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1
        })
    });
    const { result: blockNumHex } = await response.json();
    const latestBlock = parseInt(blockNumHex, 16);
    console.log("Latest block:", latestBlock);

    for (let i = latestBlock; i > Math.max(0, latestBlock - 50); i--) {
        const res = await fetch("https://studio.genlayer.com/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBlockByNumber",
                params: ["0x" + i.toString(16), true],
                id: i
            })
        });
        const { result: block } = await res.json();
        if (block && block.transactions) {
            for (const tx of block.transactions) {
                if (tx.from.toLowerCase() === userAddress) {
                    console.log(`Found user tx: ${tx.hash}`);
                    
                    // Fetch GenLayer trace or receipt
                    const rcptRes = await fetch("https://studio.genlayer.com/api", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            method: "gen_getTransactionReceipt",
                            params: [tx.hash],
                            id: 100
                        })
                    });
                    console.log(await rcptRes.json());
                }
            }
        }
    }

  } catch (e) {
    console.error("Error:", e);
  }
}
main();
