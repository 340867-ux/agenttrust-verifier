# AgentTrust Verifier

Open verifier and receipt specification for AgentTrust Ledger.

AgentTrust receipts are independently verifiable Ed25519 statements that bind a component identity, an observed time, and the SHA-256 hash of a normalized trust snapshot.

## Verify a receipt

```bash
node verify.mjs receipt.json
```

Exit code `0` means the signature is valid for the bundled public key. Exit code `1` means verification failed.

## What verification means

A valid signature proves that AgentTrust signed the exact receipt payload. It does not mean the component is safe. Risk decisions remain evidence-based and separate from signature verification.

## Public key

The current public key is in `public-key.pem`.
Its SHA-256 DER fingerprint is:

`c4d9d804a2b89675fb5a6d5bf934c64bf7e7f5070469cd971018ffd57e83a922`

See `SPEC.md` for the canonicalization and receipt format.
