import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  const res = await client.readContract({
    address: "0x66Fe970AED201432Ab19bF276c09eEE04d04f492",
    functionName: "get_protocol_stats",
    args: [],
  });
  console.log(res);
}

main().catch(console.error);
