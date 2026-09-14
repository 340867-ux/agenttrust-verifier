import { appendFile } from "node:fs/promises";

const input = name => process.env[`INPUT_${name.toUpperCase()}`] || "";
const api = input("api_url").replace(/\/$/, "");
const kind = input("kind");
const component = input("component");
const expected = input("expected_hash").toLowerCase();

if (!api || !kind || !component) {
  console.error("api_url, kind and component are required");
  process.exit(2);
}

const url = new URL(`${api}/v1/resolve`);
url.searchParams.set("kind", kind);
url.searchParams.set("id", component);
const response = await fetch(url, { headers: { "user-agent": "agenttrust-github-action" } });
if (!response.ok) {
  console.error(`AgentTrust API returned ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const report = await response.json();
const current = String(report.hash || "").toLowerCase();
if (!/^[a-f0-9]{64}$/.test(current)) {
  console.error("AgentTrust API did not return a valid SHA-256 hash");
  process.exit(1);
}

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `current_hash=${current}\n`);
}
console.log(`AgentTrust current hash: ${current}`);

if (expected) {
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    console.error("expected_hash must be a 64-character SHA-256 hex string");
    process.exit(2);
  }
  if (current !== expected) {
    console.error(`Material drift: trusted ${expected}, current ${current}`);
    process.exit(1);
  }
  console.log("No snapshot drift from the trusted hash.");
}
