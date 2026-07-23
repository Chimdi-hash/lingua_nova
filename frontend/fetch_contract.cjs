async function main() {
  const res = await fetch("https://studio.genlayer.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "gen_getContract",
      params: ["0xEA0cD7A21D12fbd6c6e75b75a1e2B4E914295330"],
      id: 1,
    }),
  });
  const data = await res.json();
  const fs = require('fs');
  fs.writeFileSync('grey_market.json', JSON.stringify(data, null, 2));
  console.log("Done");
}
main();
