# AgentTrust Receipt Specification v1

A receipt proves which normalized component snapshot AgentTrust observed at a stated time.
It does **not** assert that a component is safe, benign, or vulnerability-free.

## Envelope

```json
{
  "payload": {
    "schemaVersion": 1,
    "component": {"ecosystem":"npm","id":"example","version":"1.0.0"},
    "snapshotHash": "<64 hex SHA-256>",
    "observedAt": "<RFC3339 timestamp>",
    "keyId": "ed25519:<identifier>"
  },
  "algorithm": "Ed25519",
  "signature": "<base64url without padding>"
}
```

The signed bytes are UTF-8 of canonical JSON for `payload` only.
Objects are recursively sorted by key; arrays retain their order; undefined values are omitted.
The snapshot hash is SHA-256 of the canonical normalized snapshot JSON.
