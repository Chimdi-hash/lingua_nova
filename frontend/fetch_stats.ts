import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  const res = await client.readContract({
    address: "0x09b75d55747bE79D0Eeb0d4d5539aE276D6d4f5E",
    functionName: "get_protocol_stats",
    args: [],
  });
  console.log(res);
}

main().catch(console.error);
