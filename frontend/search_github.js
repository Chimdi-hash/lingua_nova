async function main() {
  const res = await fetch("https://api.github.com/search/code?q=gl.evm.contract_interface+language:python", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  console.log(await res.json());
}
main();
