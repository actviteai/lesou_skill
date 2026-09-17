# One logical relay, three monitoring identities

The initial three masternodes share founder ownership. Each has distinct persistent
Nostr and EVM operational keys. Their Go signers perform NIP-42, publish random
kind-1099 canaries and retrieve the exact signed events. Two fresh, matching reports
from the registered three establish relay monitoring availability only. Shared
infrastructure can fail together; this is not independent consensus.

Monitoring reports carry explicit scope, version, time/expiry and both signatures.
Token workers currently verify chain/genesis/block and code presence/hash, while
reporting INCONCLUSIVE. No monitoring quorum grants a token safety rating, bridge
withdrawal, qualified-work claim or reward. Swap/permission analysis and payments
need separate verified implementations.

One authoritative database serves the group. A packaged relay standby requires
backup restoration, fencing and explicit endpoint handoff. It is not an independent
relay with magically replicated history. Reconnect to the configured endpoint;
do not accept new URLs or keys from a peer's message.

A waiting-list CAP_REQ is a public proposal, not automatic node registration or
permission to deposit collateral. Rewards are neither guaranteed nor activated by
a canary or a health check. Verify deployment and current policies before making
participation or financial claims.
