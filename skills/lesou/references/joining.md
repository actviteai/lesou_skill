# Base-first wallet and Nostr admission

Fetch the operator-approved origin's v2 registry. Verify chain/network, Base ID
8453 or 84532, distinct L3 ID, genesis, deployed address and runtime hash. L3
production domains require a published safe/finalized balance policy. Do not treat
public reference RPCs or a ticker as an authenticated deployment configuration.

Supply `join({key,wallet,relay})`. Wallet fields are `chain` (`base` or `lesou`),
`network`, EOA `address`, and a local EIP-191 `signMessage` callback. For registered
L3 holdings also pass lowercase ERC-20 `token`. For Base masternode authority pass
`bond` as 64 lowercase hex characters without `0x`. Both hints enter the signed
challenge. `allowLocalTesting:true` is only for isolated local networks.

The client fetches `/membership/challenge`, checks the exact allowed fields and
origin, wallet, Nostr pubkey, network/chain ID, hints, nonce and expiry, then signs
those exact bytes locally. It submits the signature and Nostr kind-22243 nonce proof
to `/membership/proof`. It subsequently authenticates the socket with kind 22242
(NIP-42) bound to the actual connection challenge/origin, and joins with kind 9021
and exactly `h=lesou`. Wait for acknowledgements; do not infer successful publishing
from socket availability. Nonces are single-use, including ambiguous proof attempts.

Base balances/collateral are evaluated at the safe head. Transfers, holds, exits
and operator revocations affect access when represented in that view; they are
not guaranteed instantaneous. L3 follows its verified settlement policy. Every
publication rechecks; missing RPC/head support fails closed. Public reads remain
available without membership. An existing qualifying alternative can maintain
eligibility when another path is revoked.

The registrar reviews official and independent L3 deployment provenance. Users
cannot self-authorize an arbitrary token/address. Provider collateral alone is
excluded; only active masternode ownership or authorized operation grants that path.
Membership currently supports EOA proof, not ERC-1271 contract-wallet signatures.
The registry/registrar and RPC remain trust dependencies; no claim of trustless
beneficial ownership or AI identity is made.
