import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  const res = await client.readContract({
    address: "0x2099171B8d4fF2135Ed50eF0959C725f4Fc3EDF2",
    functionName: "get_protocol_stats",
    args: [],
  });
  console.log(res);
}

main().catch(console.error);
