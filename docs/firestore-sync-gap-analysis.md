# Firestore sync status and missing collections

This document is based on the schema and sample payloads provided in the attached backend UI contract. It is a practical gap review for the current frontend and for the next backend sync work.

## 1) Source of truth

The current API model supports one club-member balance pair (`chip_balance` and `in_play_balance`) for both AGENT and PLAYER roles, plus separate treasury and global-playmoney balances. Player/table state is stored in club and union collections; runtime and audit data remain backend-owned.

Keep these purposes distinct in the UI and any future normalized storage:

- `GLOBAL_PLAYMONEY`
- `CLUB_TREASURY`
- `CLUB_MEMBER` (`CLUB_CHIPS`), shared by members with AGENT or PLAYER roles
- `TABLE_ESCROW`

`DIAMONDS` is a separate proposed premium currency, not a club-table balance. AGENT and PLAYER are authorization roles, not separate wallet types in the current API. A normalized account/ledger schema would require an explicit backend contract and migration plan; it is not a frontend requirement today.

---

## 2) Already synced / already present

These collections are already present in the current schema and map directly to the UI fields currently in use.

| Collection | Status | UI fit | Notes |
|---|---|---|---|
| `platform_wallets/global-playmoney-reserve` | Synced | Internal only | Legacy/platform reserve record; global-wallet ensure does not debit it under the current API contract |
| `platform_wallets/global-playmoney-reserve/transactions/{transaction_id}` | Synced | Logging/debug only | Not shown to the app UI |
| `global_wallets/{user_id}` | Synced | Global play-money wallet | Matches the global wallet feature |
| `global_wallets/{user_id}/transactions/{transaction_id}` | Synced | Logging/debug only | Not exposed to the UI |
| `clubs/{club_id}` | Synced | Club context | Core club identity |
| `clubs/{club_id}/members/{user_id}` | Synced | Primary club member state | Contains `role`, `chip_balance`, `in_play_balance` |
| `clubs/{club_id}/members/{user_id}/transactions/{buy_in_id}` | Synced | Buy-in audit trail | Useful for buy-in logs and debugging |
| `clubs/{club_id}/transactions/{transaction_id}` | Synced | Audit/history | Acceptable as audit record |
| `clubs/{club_id}/treasury/wallet` | Synced | Owner/manager treasury | Treasury display |
| `clubs/{club_id}/treasury/pools` | Synced | Optional display | Optional owner/admin reporting |
| `clubs/{club_id}/tables/{table_id}` | Synced | Lobby rendering | Core table metadata |
| `clubs/{club_id}/tables/{table_id}/seats/{seat_index}` | Synced | Seat assignment | Needs `stack`, `user_id`, `seat_index`, `buy_in_id` |
| `clubs/{club_id}/tables/{table_id}/hands/{hand_id}` | Synced | Replay/audit summary | Use replay API instead of reading raw hand data |
| `unions/{union_id}` | Synced | Union lobby | Shared union identity |
| `unions/{union_id}/admins/{user_id}` | Synced | Admin controls | UI can display admin options, but server decides |
| `unions/{union_id}/clubs/{club_id}` | Synced | Union membership mapping | Needed to list union-linked clubs |
| `unions/{union_id}/tables/{table_id}` | Synced | Shared table list | Shared lobby rendering |
| `unions/{union_id}/tables/{table_id}/seats/{seat_index}` | Synced | Union seat state | Includes `club_id` and `stack` |
| `unions/{union_id}/tables/{table_id}/hands/{hand_id}` | Synced | Shared hand summaries | Good for settlement summary |
| `unions/{union_id}/settlements/{YYYY-MM-DD}` | Synced | Settlement reporting | Optional reporting |
| `unions/{union_id}/settlements/{YYYY-MM-DD}/clubs/{club_id}` | Synced | Reporting | Optional settlement detail |
| `unions/{union_id}/settlements/{YYYY-MM-DD}/hands/{hand_id}` | Synced | Reporting | Optional settlement detail |

### Safe and syncable frontend fields

The following fields are already represented sufficiently and are safe for frontend logging/display:

- `club_id`
- `table_id`
- `seat_index`
- `user_id`
- `username`
- `role`
- `game_id`
- `status`
- `chip_balance`
- `in_play_balance`
- `stack`
- `buy_in_id`
- `hand_id`
- `settlement_status`
- `pot_total`
- `owner_id`
- `union_id`

These are the main fields the current UI should log and display first.

---

## 3) Already present but should not be synced to the UI

These are backend-only and should not be exposed directly to the client UI.

| Collection | Status | Reason |
|---|---|---|
| `clubs/{club_id}/tables/{table_id}/runtime/state` | Present, backend-only | Internal table durability and ownership tracking |
| `clubs/{club_id}/tables/{table_id}/runtime/state/actions/{action_hash}` | Present, backend-only | Internal action journal |
| `clubs/{club_id}/tables/{table_id}/runtime/lease` | Present, backend-only | Internal lease/heartbeat state |
| raw hand audit payloads under `.../hands/{hand_id}` when containing private tables | Present, backend-only | Must use replay API instead |
| private card/deck snapshots | Present in backend model | Not for direct UI rendering |

These should remain server-side only. The frontend should use the replay API and snapshot payloads instead of reading raw Firestore hand state.

---

## 4) What can be synced cleanly

These are the areas that are straightforward to sync without changing the core platform model.

### 4.1 Club member and wallet state

This is already in good shape:

- `clubs/{club_id}/members/{user_id}`
- `clubs/{club_id}/treasury/wallet`
- `global_wallets/{user_id}`

This can be synced to:

- lobby wallet panel
- member balance summary
- treasury view for owner/manager
- global play-money wallet view

### 4.2 Table and lobby sync

This is already well-suited for the current UI:

- `clubs/{club_id}/tables/{table_id}`
- `clubs/{club_id}/tables/{table_id}/seats/{seat_index}`
- `unions/{union_id}/tables/{table_id}`
- `unions/{union_id}/tables/{table_id}/seats/{seat_index}`

These are the forms the app expects for lobby rendering and seat positions.

### 4.3 Hand replay and settlement summary

This is also a clean sync boundary:

- `clubs/{club_id}/tables/{table_id}/hands/{hand_id}`
- `unions/{union_id}/tables/{table_id}/hands/{hand_id}`

Use them as summarized sources for the replay/settlement views and keep private raw detail behind the replay API.

---

## 5) What is missing or needs creation

The current schema is close, but there are still missing pieces relative to the new UI and the future contract model.

### 5.1 Wallet model and possible normalization

The current API uses one club-member balance for both AGENT and PLAYER roles. Do not create separate agent/player balances or collections solely because a member has one of those roles. If the backend later normalizes wallet storage, preserve these distinct purposes:

- `GLOBAL_PLAYMONEY`
- `CLUB_TREASURY`
- `CLUB_MEMBER` (`CLUB_CHIPS`)
- `TABLE_ESCROW`

Possible storage, subject to backend design and migration planning:

- `wallet_accounts/{wallet_id}`
- `wallet_ledger/{entry_id}` with a required `wallet_id` reference
- `tables/{table_id}/escrow`

The current `clubs/{club_id}/members/{user_id}` balance and `clubs/{club_id}/transactions/{transaction_id}` records remain the existing contract. A normalized ledger is a backend migration decision; roles govern authorization and downline rules, not separate member balances.

### 5.2 Missing club invitation / membership activation flow

The README clearly states that club membership should begin after invitation acceptance. The current schema does not clearly define a separate invitation collection.

Recommended additions:

- `club_invitations/{invitation_id}`
- `club_invitations/{invitation_id}/events/{event_id}`
- `club_membership_requests/{request_id}`

Needs fields like:

- `club_id`
- `user_id`
- `status` (`pending`, `accepted`, `expired`, `revoked`)
- `invited_by`
- `accepted_at`
- `role`

### 5.3 Missing friend-table / lobby invite flow

The frontend also mentions local preview room creation and friend-table flows. Those are not represented in the current Firestore schema.

Recommended additions:

- `friend_tables/{table_id}`
- `friend_table_invites/{invite_id}`
- `local_rooms/{room_id}`

This is distinct from the real club table model.

### 5.4 Missing transaction-history and batch-transfer API contracts

The current schema already has `clubs/{club_id}/transactions/{transaction_id}` for member send-out and claim-back. The supplied Wallet API has no transaction-history or member-search endpoint, and accepts one recipient per transfer. This is an API/workflow gap, not evidence that separate ledger collections are needed.

Contract requirement:

Keep one authoritative transaction/ledger record per operation, keyed by `transaction_id`, with documented type and scope. Define transaction-history queries and any atomic multi-recipient contract before building UI; do not create parallel send-out/claim-back collections. Table escrow movements belong in the authoritative table/wallet ledger contract if and when that is introduced.

### 5.5 Missing admin/owner settlement or reporting structure for table lifecycle

The settlement collections exist for unions but are not yet a full lifecycle model for club/union table close, settlement, and expiration.

Recommended additions:

- `table_lifecycle/{table_id}`
- `table_settlements/{table_id}/{hand_id}`
- `club_close_jobs/{job_id}`

These are especially important once scheduled close / expiration logic is fully implemented.

---

## 6) Collections that are not missing but need stricter rules

These exist already and do not need a brand-new collection, but they need strong write validation and access control:

- `clubs/{club_id}/members/{user_id}`
- `clubs/{club_id}/tables/{table_id}/seats/{seat_index}`
- `clubs/{club_id}/transactions/{transaction_id}`
- `global_wallets/{user_id}`
- `unions/{union_id}/admins/{user_id}`
- `unions/{union_id}/tables/{table_id}/seats/{seat_index}`

The issue is not whether the collection exists; it is whether backend writes enforce:

- authorized role checks
- membership verification
- idempotent wallet writes
- atomic seat/stack updates
- table lifecycle rules

---

## 7) What is a true sync mismatch

The main mismatch is between the current schema and the latest UI/contract direction.

### Current API/storage model

- member wallet is embedded on the member document
- AGENT and PLAYER roles share the same member balance
- no separate agent/player/table-escrow accounts
- transaction events are generic and not strongly partitioned by flow

### UI/API requirements

- global play money, club treasury, member available/in-play balance, and per-table stack/escrow must remain separate values
- treasury, member, and table funds must not be conflated
- send-out/claim-back and buy-in operations need server-authoritative idempotency and traceability; existing club transaction records should not be duplicated into flow-specific collections

This is primarily an API visibility and verification gap. A storage redesign is not required to use the current UI contract; if pursued, it needs a backend-owned migration plan.

---

## 8) Decision: what is missing today

### Already good enough for current UI

- club member and wallet summary
- lobby tables and seat maps
- union table state
- settlement and replay summary
- global play-money wallet

### Needs creation or redesign for the next-step backend

1. verify current shared member-wallet and treasury contracts, and decide explicitly whether normalized wallet/account collections are needed
2. explicit invitation and membership activation tracking
3. transaction-history and atomic multi-recipient API contracts using the existing authoritative ledger model
4. table escrow and lifecycle collections
5. strict backend enforcement for all writes

---

## 9) Practical recommendation

### Keep as-is for now

- `clubs/{club_id}/members/{user_id}`
- `clubs/{club_id}/tables/{table_id}`
- `clubs/{club_id}/tables/{table_id}/seats/{seat_index}`
- `global_wallets/{user_id}`
- `unions/{union_id}/tables/{table_id}`

### Add next

- `club_invitations/{invitation_id}`
- transaction-history and atomic multi-recipient API support for existing transactions
- `table_escrow/{table_id}` or `tables/{table_id}/escrow`
- `table_lifecycle/{table_id}`

### Keep out of the UI

- `runtime/state`
- `runtime/lease`
- raw private hand audit docs
- action journal and deck state

---

## 10) Bottom line

The collection set already present supports much of the current frontend workflow. The main gaps are API verification/visibility, invitations, table lifecycle, and backend enforcement. The UI does not require separate AGENT and PLAYER wallets; any storage normalization is a separate backend decision.

So:

- yes, there are fields and flows that need a collection model behind them
- no, the app is not missing all collections
- but the project does need verified financial APIs, clear invitation/lifecycle contracts, and strict backend enforcement before production-grade sync is complete
