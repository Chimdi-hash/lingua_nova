const fs = require('fs');
const data = JSON.parse(fs.readFileSync('grey_market.json', 'utf8'));
if (data.error) {
  console.log("Error:", data.error);
} else {
  // If the result has base64 source code
  const result = data.result;
  console.log("Result keys:", Object.keys(result));
  if (result.source) {
    console.log("Source code length:", result.source.length);
    fs.writeFileSync('grey_market.py', result.source);
  }
}
