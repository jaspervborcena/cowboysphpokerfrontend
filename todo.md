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
- Creator-owned local preview clubs can add local tables only for catalog-supported games. These cards remain non-joinable previews with no server gameplay.
- The connected table-create request includes `game_id`, `small_blind`, `big_blind`, `buy_in_min`, `buy_in_max`, and `table_size`. The UI exposes the documented fields and capacities 2-9; unsupported tournament modes and advanced template settings are not offered for server-created tables.
- Table creation defaults remain in `src/app/data/table-creation-defaults.json`; the backend catalog determines the actual active and create-supported game IDs.
- WebSocket v1 messages use version/topic/event/correlation envelopes. Authentication carries a freshly refreshed Firebase token; `PLAYER_ACTION` messages include `action_id`; `PRE_ACTION_SET` is correlated; selected pre-actions and complete table state come from player-specific `TABLE_SNAPSHOT` payloads. The client replies to `PING` with matching `PONG` and replaces state after reconnect.
- Standard numeric backend errors map to client-safe messages with `trace_id` retained. `40101` refreshes Firebase and retries once only for safe reads or requests with an idempotency ID; `40301` refreshes membership state.
- Disconnects do not change local connectivity, sit-out, or action state. Reconnect displays only server-supplied state; unsupported sit-in actions and fabricated client countdowns are removed.
- Unit coverage includes the game catalog, create request fields, action IDs, correlation IDs, `PING`/`PONG`, snapshot capacity mapping, token refresh, and non-idempotent retry prevention.
- Unit tests for role gating, API request shape, table UI, and replay behavior.

## Backend capabilities described in the supplied API docs

These are documented by the backend contract attachment, but have not been independently verified against backend source or a running server:

- Firebase ID-token verification and active club/union membership checks, including role-gated table and wallet routes.
- Local and union table create/list/seat/start flows, buy-in idempotency, authenticated sockets, per-player card masking, and replay.
- Club wallet send-out/claim-back, treasury transfers, platform club provisioning, and Firestore hand settlement.
- Server turn timeout that checks when possible and folds when facing a bet.
- The docs explicitly say there are no sit-out, leave-seat, top-up, cash-out, union formation/invitation, or global-wallet routes; live table state is in process memory.

## P0: Resolve contract blockers

- [ ] **Backend:** Implement and document phone sign-in and reset endpoints. Validate phone/password, rate-limit failures, issue Firebase custom tokens, and enforce OTP expiry, single use, attempt limits, and password policy. The frontend recovery screens and requests are wired, but these routes are not in the supplied backend API contract.
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
- [x] **Frontend/contract:** Remove the unsupported `SIT_IN` action from “I'm Back” or add a server sit-in route/message and document its rules. Do not optimistically mark the player seated/connected as if it were accepted.
- [x] **Frontend:** Fetch a fresh Firebase ID token for each new socket and implement reconnect/resync with a new socket and fresh snapshot. Do not claim a disconnected action succeeded when it could not be sent.
- [ ] **Backend:** Add disconnect-specific grace period, auto-sit-out, reconnect, and seat-state policy. The documented turn timeout does not by itself provide disconnect protection.
- [ ] **Frontend:** Add request methods and UI for the club wallet endpoints: balance, send-out, claim-back, treasury read, and treasury transfer; cover `transaction_id` idempotency and role-specific downline rules. The workspace docs do not include the endpoint paths or request/response schemas, so this needs the exact API contract before implementation.
- [x] **Frontend:** Show home-club IDs provided by union snapshots and map server table sizes from 2 through 9 to the seat layout.

## P2: Complete money and operations workflows

- [ ] **Backend + frontend:** Implement leave-seat, top-up/rebuy, cash-out, sit-out/sit-in, and reconciliation flows with idempotent ledger operations.
- [ ] **Backend:** Add durable single-writer live table state and restart recovery before multi-instance deployment; session affinity alone is insufficient.
- [ ] **Backend + frontend:** Complete club invitation/acceptance and union creation/invitation flows. Accepting a club invite creates or activates club membership for an existing global account; define union fee/rake allocation and remaining BBJ/promotion payout rules.
- [x] **Frontend:** Handle the documented numeric error codes, retain `trace_id`, refresh Firebase and retry only safe reads or requests with idempotency IDs, and refresh membership after `40301`.
- [ ] **Integration:** Run the frontend against the backend and Firestore emulator/project; cover sign-in, membership, buy-in, wallet transfer, socket reconnect, turn timeout, replay masking, and failure/retry cases.

## Definition of done

- Runtime config points to the intended Firebase project and backend; no demo data is presented as live data.
- Phone/password login works through the backend-issued Firebase custom token, and account recovery uses a separate OTP flow.
- Empty/loading/error states reflect actual API responses; server balance is authoritative for buy-in.
- WebSocket pre-actions and reconnect behavior match the documented protocol; disconnect/sit-out outcomes come from the server.
- Documented wallet operations are accessible to the correct roles, while server-side role checks remain authoritative.
- Frontend/backend integration tests pass for the real contract, including idempotent financial operations.
