# Next Phase TODO

## Goal

Close the frontend/backend contract gaps and complete a real authenticated member-to-table flow. Treat UI permission checks as presentation only; backend authorization remains authoritative.

## Implemented in the frontend

- Firebase email/password and Google sign-in, email account creation, Firebase token session, and club membership lookup for server-assigned roles.
- Email signup creates a global Firebase account; email password recovery uses Firebase reset links. Club membership is separate and requires an invitation/acceptance relationship. Phone account creation is unavailable.
- Phone/password client flow normalizes supported Philippine number formats, calls `POST /auth/phone/sign-in`, then signs in with the returned Firebase custom token. This endpoint is not present in the supplied backend API contract yet.
- Password recovery is split by identifier: email uses Firebase reset links; phone uses backend OTP request/confirm endpoints, separate from sign-in.
- A blocking authentication gate protects member screens; signed-in accounts without club membership remain global accounts and do not receive club-table data.
- API base URL, club ID, and optional Firebase web config are loaded from `/app-config.json` before app bootstrap, with Firebase defaults in `src/environments/environment.ts`.
- Club and union table list requests, table create/seat/start/delete requests, `buy_in_id` generation, authenticated local/union WebSockets, table actions, and replay API calls.
- Role-aware menus and baseline `PLAYER` permissions while membership verification is pending.
- Empty/error responses no longer preserve sample lobby rows; explicit empty states are shown for club and union table lists.
- Mock club and Global Room cards open isolated preview lobbies without loading configured-club data; global games and invitation-backed club switching are not connected.
- The home icon opens Create A Club and Friend Table actions. Created profiles persist in browser storage and reopen for their creator as a local OWNER room with local-only table previews; no backend club provisioning, table play, or friend-invite endpoint is wired.
- Every role sees the same table-create entry point; only verified Owners/Managers can submit. The picker loads `GET /games`, defaults to `active_game_id`, and offers only `create_supported` games. If the catalog fails or contains no supported games, creation is disabled.
- Table cards resolve summary/snapshot `game_id` values through the catalog and show `Unknown game` rather than inferring NLH when an ID is missing. Cards also show status, blinds, buy-in range, and seat counts.
- Lobby tables default to a two-column grid; the floating layout shortcut toggles between grid and full-width list rows and always indicates the next layout action.
- Creator-owned local preview clubs can add local tables only for catalog-supported games. Their cards open the local table view, and the creator can take a local seat; these previews do not connect to server gameplay.
- The connected table-create request includes `game_id`, `small_blind`, `big_blind`, `buy_in_min`, `buy_in_max`, and `table_size`. The UI exposes the documented fields and capacities 2-9; unsupported tournament modes and advanced template settings are not offered for server-created tables.
- Game-specific behavior lives in `src/app/features/table/rules/`, with separate Hold’em Ring and PLO4 Ring rule files registered by `TableRulesService`.
- Selecting an empty chair opens a buy-in confirmation defaulted to the table minimum; the seat is shown only after the server confirms it. The wallet preflight validates member/club/currency plus finite nonnegative available and in-play balances, uses request-scoped idempotency keys, and refreshes available balance after seat confirmation. After seating, server-provided `blind_decision_pending` opens the player's post-blind or wait-for-big-blind choice.
- The table view is table-only: its setup drawer is removed, seat and game actions stay on the table surface, and verified table managers can start a hand from the table action bar.
- Table creation defaults remain in `src/app/data/table-creation-defaults.json`; the backend catalog determines the actual active and create-supported game IDs.
- WebSocket v1 messages use version/topic/event/correlation envelopes. Authentication carries a freshly refreshed Firebase token; `PLAYER_ACTION` messages include `action_id`; `PRE_ACTION_SET` is correlated; selected pre-actions and complete table state come from player-specific `TABLE_SNAPSHOT` payloads. The client replies to `PING` with matching `PONG` and replaces state after reconnect.
- Standard numeric backend errors map to client-safe messages with `trace_id` retained. `40101` refreshes Firebase and retries once only for safe reads or requests with an idempotency ID; `40301` refreshes membership state.
- The table shows a 20-second avatar ring from server-supplied `turn_seconds_left` or `disconnect_seconds_left`; it does not locally decide actions or sit-out. “I'm back” sends correlated `SIT_IN` and waits for a full snapshot before changing state.
- Unit coverage includes the game catalog, create request fields, wallet preflight identity/balance validation, seat idempotency and post-seat balance refresh, local-preview table entry, table-only rendering, action IDs, correlation IDs, `PING`/`PONG`, snapshot capacity mapping, token refresh, and non-idempotent retry prevention.
- Unit tests for role gating, API request shape, table UI, and replay behavior.
- The fixture-backed wallet dashboard is implemented at `public/ui-mocks/wallet-dashboard.json` and covered by frontend tests. It is explicitly mock-only; global, treasury, agent, player, and table-stack values stay separate, and table stacks are not double-counted in player balances. The seat preflight calls a newly defined live wallet-summary contract, but that backend route is not implemented yet.

## Backend capabilities described in the supplied API docs

These are documented by the backend contract attachment, but have not been independently verified against backend source or a running server:

- Firebase ID-token verification and active club/union membership checks, including role-gated table and wallet routes.
- Local and union table create/list/seat/start flows, buy-in idempotency, authenticated sockets, per-player card masking, and replay.
- Earlier supplied API notes mentioned club transfers and treasury operations, but the latest UI guide says wallet APIs and separate persistent `CLUB_AGENT` / `CLUB_PLAYER` accounts do not exist yet. Treat wallet endpoints and account semantics as unverified until the backend contract is reconciled; the provided dashboard remains mock-only and must not be read from Firestore.
- Server turn timeout that checks when possible and folds when facing a bet.
- The docs do not define the 20-second disconnect grace policy, `SIT_IN`, `BLIND_DECISION`, leave-seat, top-up, cash-out, union formation/invitation, or global-wallet routes; live table state is in process memory.

## P0: Resolve contract blockers

- [ ] **Backend + integration:** Implement `GET /clubs/{club_id}/members/me/wallet` with Firebase-token and verified-membership checks. Return the authenticated member's `club_id`, `user_id`, `currency_type: CLUB_CHIPS`, `available_balance`, and `in_play_balance`; seat requests must atomically re-check and reserve funds. The frontend preflight fails closed if the wallet summary is missing or does not match the signed-in member.
- [ ] **Backend:** Implement and document phone sign-in and reset endpoints. Validate phone/password, rate-limit failures, issue Firebase custom tokens, and enforce OTP expiry, single use, attempt limits, and password policy. The frontend recovery screens and requests are wired, but these routes are not in the supplied backend API contract.
- [x] **Wallet contract decision:** The supplied UI guide says `POST /platform/clubs` grants 10,000 `CLUB_CHIPS` to `CLUB_TREASURY`; the owner's personal member balance starts at zero. Backend source and idempotency behavior still need verification.
- [x] **Wallet mock decision:** Show a 20,000 `GLOBAL_PLAYMONEY` onboarding grant after Firebase account creation; the supplied UI guide says no persistent grant/read API exists.
- [ ] **Backend:** Implement the persistent 20,000 global grant and define an idempotent backfill for existing Firebase accounts.
- [ ] **Table-close contract:** Choose the club timezone and exact close-boundary behavior. Define each table's assigned `scheduled_close_at` (including variable lifetimes such as 6 or 24 hours), distinguish it from actual `closed_at`, and specify how the weekly settlement cutoff acts as an additional boundary.
- [x] **Contract:** Use `table_size` for local and union table create/list flows; the frontend sends it and temporarily reads `max_seats` as a compatibility fallback.
- [x] **Contract:** Include `game_id` in table summaries and expose `/games` fields `active_game_id`, `display_name`, and `create_supported`; the frontend resolves labels through the catalog and does not infer NLH when the ID is absent.
- [ ] **Backend + contract:** Build and test the game-variant engine/adapters, then define API fields for table name, game variants, SNG/MTT modes, and all fields in `src/app/data/table-creation-defaults.json` before sending those settings for server-created tables.
- [ ] **Contract:** Confirm or document `GET /unions/{union_id}/membership/me`; the frontend uses it to identify union admins, but it is absent from the supplied API guide.
- [ ] **Deployment:** Configure the Firebase web settings in `src/environments/environment.ts` (or runtime override) and `apiBase`/`clubId` in `public/app-config.json` for each environment; verify email/password, Google, and phone/password sign-in plus membership lookup against live services.
- [x] **Frontend:** Replace the remaining hardcoded table ID/default selection with configured or API-selected table state.
- [x] **Frontend:** Load `GET /games`, default to `active_game_id`, include `game_id` on create requests, and only offer `create_supported` catalog entries.
- [ ] **Frontend:** Replace the mock home-carousel club/global preview cards with invitation-backed clubs and connected global-game data when those services exist.
- [ ] **Backend + frontend:** Persist club creation, assign the creator's authoritative OWNER membership, and implement friend-table invitations before connecting the local home-menu previews to live services.
- [x] **Frontend:** Remove the pre-buy-in check against `currentPlayer.stack`. The API contract says the server checks the member's ledger balance and that buy-in amount is the requested amount, not an assigned stack. Display the server's insufficient-balance response instead.

## P1: Match the documented live-table protocol

- [x] **Frontend:** Use WebSocket v1 envelopes for `AUTHENTICATE`, `PLAYER_ACTION`, `PRE_ACTION`, `PONG`, and server events. Correlate responses, include `action_id` for game actions, and render selected pre-actions from full player snapshots.
- [x] **Frontend:** Render server-provided 20-second action/disconnect timer rings and show “I'm back” beside table chat when the snapshot marks the member sat out. Send correlated `SIT_IN` and wait for a server snapshot; do not optimistically change seat state.
- [x] **Frontend:** Open a minimum-prefilled buy-in confirmation when an empty chair is selected; validate available funds and buy-in bounds, then show the player in the seat only from the server response.
- [x] **Frontend:** Validate the complete wallet summary used by seat preflight, scope `buy_in_id` to unchanged request details, and refresh the displayed available balance after confirmed seating.
- [x] **Frontend:** Keep the table route focused on the table surface, with local-preview entry, seat selection, player actions, and manager hand-start controls available without the setup drawer.
- [x] **Frontend:** Keep Hold’em Ring and PLO4 Ring behaviors in separate registered rule files; offer post-blind or wait-for-big-blind only when the server snapshot requires a decision.
- [ ] **Backend + contract:** Add `BLIND_DECISION` with `POST_BLIND` and `WAIT_FOR_BIG_BLIND`, plus `blind_decision_pending` and `blind_amount_to_post` in player snapshots. Apply the choice authoritatively and return a full snapshot or correlated error.
- [ ] **Backend + contract:** Define and implement `SIT_IN` plus the timeout policy: 20-second action time, then check when legal or fold; on disconnect, a fresh 20-second grace window, then auto-fold; sit out after two expired disconnect windows. Include `turn_seconds_left`, `disconnect_seconds_left`, `disconnect_timeout_count`, `is_connected`, and `is_sat_out` in snapshots, and send correlated sit-in errors.
- [x] **Frontend:** Fetch a fresh Firebase ID token for each new socket and implement reconnect/resync with a new socket and fresh snapshot. Do not claim a disconnected action succeeded when it could not be sent.
- [ ] **Backend:** Implement the 20-second action deadline and disconnect grace, automatic check/fold for action expiry, auto-fold on disconnect-grace expiry, two-timeout sit-out, reconnect, and snapshot-confirmed `SIT_IN` policy defined above.
- [x] **Frontend mock:** Build the fixture-backed wallet dashboard at `public/ui-mocks/wallet-dashboard.json` with `mock_only: true`. Keep `GLOBAL_PLAYMONEY`, `CLUB_TREASURY`, `CLUB_AGENT`, `CLUB_PLAYER`, and table stacks distinct; the sample's 1,200 stack is already included in its 1,200 `in_play_balance`. Preview the 20,000 global onboarding grant, the documented 10,000 treasury creation grant (owner personal balance zero), and a pending player cash-out request. Mock requests do not change balances; never connect this fixture to Firestore or represent it as live data.
- [ ] **Backend + frontend:** Replace wallet fixtures with authenticated APIs only after wallet account models, endpoint schemas, role/downline permissions, and `transaction_id` idempotency rules are documented. The persistent global wallet and separate agent/player accounts are not implemented; never read wallet documents directly from Firestore.
- [x] **Frontend:** Show home-club IDs provided by union snapshots and map server table sizes from 2 through 9 to the seat layout.

## P2: Complete money and operations workflows

- [ ] **Backend:** Define Firestore wallet accounts for `GLOBAL_PLAYMONEY`, `CLUB_TREASURY`, `CLUB_AGENT`, `CLUB_PLAYER`, and table escrow with explicit owner, club/table scope, and currency type.
- [ ] **Backend contract:** Reconcile role-wallet modeling: the supplied UI guide says AGENT and PLAYER currently use the same club-member balance, while the mock shows separate future-facing views. Define the authoritative account semantics before making those views live.
- [ ] **Backend + integration:** Implement the persistent `GLOBAL_PLAYMONEY` wallet and grant exactly 20,000 chips once on new account creation, with idempotent backfill and separation from club chips.
- [ ] **Backend + integration:** Verify that `POST /platform/clubs` atomically creates the documented 10,000 `CLUB_CHIPS` treasury grant, leaves the owner's personal member balance at zero, and cannot grant twice on retries.
- [ ] **Backend:** Specify double-entry movements for treasury-to-agent funding, agent-to-player distribution/claim-back, player buy-in to table escrow, hand settlement, and cash-out. Commit ledger entries and cached balances atomically and idempotently.
- [ ] **Backend + frontend:** Define authorized UI-facing wallet summary/history APIs before replacing current balance fields. Specify role/downline access and `transaction_id` idempotency; keep all wallet data fixture-backed until these contracts exist.
- [ ] **Frontend:** Integrate the documented operator `send-out` and `claim-back` endpoints after confirming their exact request/response schemas. Only an authorized owner, manager, or assigned agent can fund a member; claim-back is blocked while `in_play_balance` is nonzero.
- [ ] **Backend + frontend:** Define and implement a player-initiated cash-out request/approval workflow. The supplied guide says this API is absent; keep the UI request pending/mock-only until the contract exists, and do not change balances locally.
- [ ] **Backend + frontend:** Implement leave-seat, top-up/rebuy, cash-out, sit-out/sit-in, and reconciliation flows with idempotent ledger operations.
- [ ] **Contract:** Include `scheduled_close_at` and table lifetime configuration in the appropriate table API; treat weekly settlement cutoff as an additional close boundary, not the sole expiration schedule.
- [ ] **Backend:** Implement an idempotent table-expiration worker that stops new hands, defines handling for in-progress hands, settles or explicitly carries every seated stack, releases seats safely, and preserves hand/ledger audit history. Never delete live seats or reset balances without accounting for in-play chips.
- [ ] **Integration:** Test timezone/cutoff boundaries, scheduled-close boundaries, delayed and retried expiration jobs, active-hand policy, stack settlement/carry-forward, and service recovery after a missed cutoff.
- [ ] **Backend:** Add durable single-writer live table state and restart recovery before multi-instance deployment; session affinity alone is insufficient.
- [ ] **Backend + frontend:** Complete club invitation/acceptance and union creation/invitation flows. Accepting a club invite creates or activates club membership for an existing global account; define union fee/rake allocation and remaining BBJ/promotion payout rules.
- [x] **Frontend:** Handle the documented numeric error codes, retain `trace_id`, refresh Firebase and retry only safe reads or requests with idempotency IDs, and refresh membership after `40301`.
- [ ] **Integration:** Run the frontend against the backend and Firestore emulator/project; cover sign-in, membership, buy-in, wallet transfer, socket reconnect, turn timeout, replay masking, and failure/retry cases.

## Definition of done

- Runtime config points to the intended Firebase project and backend; no demo data is presented as live data.
- Phone/password login works through the backend-issued Firebase custom token, and account recovery uses a separate OTP flow.
- Empty/loading/error states reflect actual API responses; server balance is authoritative for buy-in.
- WebSocket pre-actions and reconnect behavior match the documented protocol; disconnect/sit-out outcomes come from the server.
- Wallet balances remain mock-only until authenticated summary/history APIs and account permissions are defined; never read wallet documents directly from Firestore. Once live wallet APIs exist, expose them only to authorized roles, with server-side checks remaining authoritative.
- Frontend/backend integration tests pass for the real contract, including idempotent financial operations.
