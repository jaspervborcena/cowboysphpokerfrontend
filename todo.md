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
- The Staff Desk cashier preview supports selecting multiple mock members, splitting send-out/claim-back totals into whole-chip shares, previewing each allocation, updating mock fund/member balances after confirmation, and adding one mock trade record per recipient. Its 10,000 starting fund and all member balances are local sample data; it does not change real wallets or home balances.

## Backend capabilities described in the supplied API docs

These are documented by the backend contract attachment, but have not been independently verified against backend source or a running server:

- Firebase ID-token verification and active club/union membership checks, including role-gated table and wallet routes.
- Local and union table create/list/seat/start flows, buy-in idempotency, authenticated sockets, per-player card masking, and replay.
- The supplied Wallet API OpenAPI defines authenticated member-summary, global-wallet ensure/read, treasury read/inter-club transfer, and member send-out/claim-back operations. It states AGENT and PLAYER share a member balance and that global ensure does not debit the platform reserve. These routes have not been independently verified against backend source or a running service.
- Server turn timeout that checks when possible and folds when facing a bet.
- The docs do not define the 20-second disconnect grace policy, `SIT_IN`, `BLIND_DECISION`, leave-seat, top-up, player-initiated cash-out, or union formation/invitation; live table state is in process memory. The supplied wallet OpenAPI now defines global-wallet routes but has no transaction-history or member-search endpoint.

## P0: Resolve contract blockers

- [ ] **Backend + integration:** Verify `GET /clubs/{club_id}/members/me/wallet` against the supplied OpenAPI with Firebase-token and active-membership checks. Return `club_id`, `user_id`, server role, `currency_type: CLUB_CHIPS`, `available_balance`, and `in_play_balance`; seat requests must atomically re-check and reserve funds. The frontend preflight fails closed if identity, role, or balances are invalid.
- [ ] **Backend:** Implement and document phone sign-in and reset endpoints. Validate phone/password, rate-limit failures, issue Firebase custom tokens, and enforce OTP expiry, single use, attempt limits, and password policy. The frontend recovery screens and requests are wired, but these routes are not in the supplied backend API contract.
- [x] **Wallet API contract:** The supplied OpenAPI defines global wallet ensure/read, member summary, treasury, inter-club transfer, send-out, and claim-back schemas. Global ensure creates a missing wallet with 20,000 chips and explicitly does not debit the platform reserve.
- [ ] **Backend + integration:** Verify global ensure/read persistence, authenticated ownership, and idempotent one-time funding against the running service; confirm behavior for existing Firebase accounts without wallets.
- [ ] **Backend + integration:** Verify `POST /platform/clubs` treasury funding and owner membership semantics against backend source and retry behavior.
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
- [x] **Frontend:** Replace the wallet fixture with authenticated global ensure/read, member-summary, treasury read, inter-club transfer, send-out, and claim-back API flows. Show treasury balance to owners/managers and available member balance to agents/players in the lobby header, including the temporary Cowboys Global Room alias to the configured club ID. Use Firebase ID tokens, `transaction_id` idempotency, identity/role checks, and no direct Firestore reads. The UI does not invent transaction history or player cash-out requests because those APIs are absent.
- [ ] **Backend + integration:** Verify all wallet routes, role/downline authorization, idempotent retries, balance updates, claim-back rejection while funds are in play, and global ensure behavior against the deployed service.
- [x] **Frontend:** Show home-club IDs provided by union snapshots and map server table sizes from 2 through 9 to the seat layout.

## P2: Complete money and operations workflows

- [ ] **Backend:** Define Firestore wallet accounts for `GLOBAL_PLAYMONEY`, `CLUB_TREASURY`, `CLUB_AGENT`, `CLUB_PLAYER`, and table escrow with explicit owner, club/table scope, and currency type.
- [x] **Backend contract:** The supplied OpenAPI specifies one club-member balance shared across AGENT and PLAYER roles; the frontend uses that member summary rather than separate role wallets.
- [ ] **Backend + integration:** Verify persistent `GLOBAL_PLAYMONEY` wallet creation and one-time 20,000-chip grant on ensure, with separation from club chips and no platform-reserve debit as documented.
- [ ] **Backend + integration:** Verify that `POST /platform/clubs` atomically creates the documented 10,000 `CLUB_CHIPS` treasury grant, leaves the owner's personal member balance at zero, and cannot grant twice on retries.
- [ ] **Backend:** Specify double-entry movements for treasury-to-agent funding, agent-to-player distribution/claim-back, player buy-in to table escrow, hand settlement, and cash-out. Commit ledger entries and cached balances atomically and idempotently.
- [ ] **Backend + frontend:** Add authenticated member lookup/search and transaction-history APIs. Define an atomic multi-recipient send-out/claim-back contract with per-recipient ledger records, authoritative member/treasury balance updates, idempotency, and a response that supports refreshing home balances; current OpenAPI accepts one `user_id` per transfer and the Staff Desk cashier remains mock-only.
- [x] **Frontend:** Integrate Wallet Dashboard operator `send-out`, `claim-back`, and inter-club treasury transfer requests with UUID `transaction_id` values. The separate Staff Desk cashier supports mock multi-recipient flows only. The backend must remain authoritative for role/downline access, available funds, and claim-back while in-play balance is nonzero.
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
- Wallet summary and transfer views use authenticated APIs; transaction history, table stacks, and player cash-out requests remain unavailable until APIs are defined. Never read wallet documents directly from Firestore; server-side checks remain authoritative.
- Frontend/backend integration tests pass for the real contract, including idempotent financial operations.
