import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function main() {
  const client = createClient({
    chain: studionet,
  });

  const res = await client.readContract({
    address: "0xA54CA955b320DEa22dC08fa05af374edD3DF65e5",
    functionName: "get_protocol_stats",
    args: [],
  });
  console.log(res);
}

main().catch(console.error);
