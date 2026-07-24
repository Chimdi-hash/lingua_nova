async function main() {
  try {
    const userAddress = "0x283606Fca4506EA75665e33BEc233698b80Af91d";
    
    // First, let's try to get transactions for this address
    console.log("Fetching transactions...");
    const res = await fetch(`https://studio.genlayer.com/api/transactions?address=${userAddress}&limit=10`);
    if (res.ok) {
        const data = await res.json();
        console.log("Transactions:");
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.error("Failed to fetch transactions:", res.status, await res.text());
        
        // Try GraphQL or other endpoints if REST fails?
        const rpcRes = await fetch("https://studio.genlayer.com/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionCount",
                params: [userAddress, "latest"],
                id: 1
            })
        });
        console.log("Tx count:", await rpcRes.json());
    }
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
