import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  try {
    // The client might have a method to get contract code or details
    const result = await client.getContractCode("0x2099171B8d4fF2135Ed50eF0959C725f4Fc3EDF2");
    console.log(result);
  } catch (e: any) {
    console.error("Failed getContractCode:", e.message);
    
    // Try raw RPC call
    try {
        const response = await fetch("https://studio.genlayer.com/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getCode",
                params: ["0xEA0cD7A21D12fbd6c6e75b75a1e2B4E914295330", "latest"],
                id: 1
            })
        });
        const data = await response.json();
        console.log("eth_getCode result:", data);
        
        // Let's try gen_getCode or gen_getContractCode
        const response2 = await fetch("https://studio.genlayer.com/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "gen_getContractCode",
                params: ["0xEA0cD7A21D12fbd6c6e75b75a1e2B4E914295330"],
                id: 2
            })
        });
        const data2 = await response2.json();
        console.log("gen_getContractCode result:", data2);
    } catch (e2) {
        console.error("RPC failed:", e2);
    }
  }
}

main().catch(console.error);
