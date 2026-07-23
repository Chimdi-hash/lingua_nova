import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  const res = await client.readContract({
    address: "0xA919893DEEcf2B67f6De79476a1205Ce6a560021",
    functionName: "get_protocol_stats",
    args: [],
  });
  console.log(res);
}

main().catch(console.error);
