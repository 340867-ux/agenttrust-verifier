#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

const receiptPath = process.argv[2];
const keyPath = process.argv[3] || new URL("./public-key.pem", import.meta.url);
if (!receiptPath) {
  console.error("usage: node verify.mjs <receipt.json> [public-key.pem]");
  process.exit(2);
}

const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipt.algorithm !== "Ed25519" || !receipt.payload || !receipt.signature) {
  console.error("invalid receipt envelope");
  process.exit(2);
}

const publicKey = createPublicKey(await readFile(keyPath, "utf8"));
const data = Buffer.from(canonicalJson(receipt.payload));
const signature = decodeBase64Url(receipt.signature);
const valid = verify(null, data, publicKey, signature);
console.log(JSON.stringify({
  valid,
  keyId: receipt.payload.keyId,
  snapshotHash: receipt.payload.snapshotHash,
  component: receipt.payload.component,
}, null, 2));
process.exit(valid ? 0 : 1);
