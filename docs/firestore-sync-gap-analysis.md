# Firestore sync status and missing collections

This document is based on the schema and sample payloads provided in the attached backend UI contract. It is a practical gap review for the current frontend and for the next backend sync work.

## 1) Source of truth

The current repo-backed implementation currently supports the following model:

- one club-member wallet pair: `chip_balance` and `in_play_balance`
- player and table state stored in the club and union collections
- runtime and audit data kept separate from the UI-facing state
- no separate agent/player/table-escrow wallet model yet

The target model described in the larger backend plan separates:

- `GLOBAL_PLAYMONEY`
- `CLUB_TREASURY`
- `CLUB_AGENT`
- `CLUB_PLAYER`
- `TABLE_ESCROW`

That target model is not the live repo state yet.

---

## 2) Already synced / already present

These collections are already present in the current schema and map directly to the UI fields currently in use.

| Collection | Status | UI fit | Notes |
|---|---|---|---|
| `platform_wallets/global-playmoney-reserve` | Synced | Internal only | Reserve wallet for demo/global funding |
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

### 5.1 Missing target wallet split

The current implementation still uses a single member wallet row. The target model separates:

- `GLOBAL_PLAYMONEY`
- `CLUB_TREASURY`
- `CLUB_AGENT`
- `CLUB_PLAYER`
- `TABLE_ESCROW`

This means the current backend is not yet aligned with the future money model.

Recommended new/backend target structure:

- `wallets/{wallet_id}` or `wallet_accounts/{wallet_id}`
- `wallets/{wallet_id}/ledger/{entry_id}`
- `clubs/{club_id}/treasury/{wallet_id}`
- `clubs/{club_id}/agents/{user_id}`
- `clubs/{club_id}/players/{user_id}`
- `tables/{table_id}/escrow`

This is the most important new collection model to create if the project is moving toward the target wallet architecture.

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

### 5.4 Missing explicit transfer-ledger collections

The current schema has generic transaction documents but not a dedicated transfer-ledger pattern for send-out, claim-back, inter-club transfer, and escrow movement.

Recommended additions:

- `club_wallet_transfers/{transaction_id}`
- `club_wallet_claimbacks/{transaction_id}`
- `club_wallet_sendouts/{transaction_id}`
- `table_escrow_movements/{movement_id}`

These would make the UI and backend traceability much cleaner.

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

### Current model

- member wallet is embedded on the member document
- no separate agent/player/table-escrow accounts
- transaction events are generic and not strongly partitioned by flow

### UI target model

- wallet state must be separated by scope and purpose
- treasury, member, and table funds must not be conflated
- send-out/claim-back and buy-in operations need ledger traceability with idempotency

This means the current Firestore model is partially aligned but not fully aligned with the intended new UI and money model.

---

## 8) Decision: what is missing today

### Already good enough for current UI

- club member and wallet summary
- lobby tables and seat maps
- union table state
- settlement and replay summary
- global play-money wallet

### Needs creation or redesign for the next-step backend

1. separate wallet/account collections for the target model
2. explicit invitation and membership activation tracking
3. transfer-ledger collections for send-out / claim-back / inter-club movement
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

- `wallet_accounts/{wallet_id}` or equivalent collection for target wallet split
- `club_invitations/{invitation_id}`
- `club_wallet_transfers/{transaction_id}`
- `table_escrow/{table_id}` or `tables/{table_id}/escrow`
- `table_lifecycle/{table_id}`

### Keep out of the UI

- `runtime/state`
- `runtime/lease`
- raw private hand audit docs
- action journal and deck state

---

## 10) Bottom line

The collection set already present is good for the current frontend workflow, and most of the important UI data is already represented. The true gap is not broad missing-state; it is that the schema has not yet been upgraded to the target financial and lifecycle model that the new UI expects.

So:

- yes, there are fields and flows that need a collection model behind them
- no, the app is not missing all collections
- but the project does need a new wallet/account split and clearer invitation / transfer / escrow collections before production-grade sync is complete
