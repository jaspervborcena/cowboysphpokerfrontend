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
- Every role sees the same Create/Private lobby action row; Create is disabled outside authorized Owner/Manager club rooms. Owners and Managers can also start the wizard from the empty-state action.
- Table cards show per-table game labels, status, blinds, buy-in range, and seat counts. The client uses the API `game` field when present and defaults older responses to NLH.
- The existing create-table endpoint is used only for Regular NLH with all extra rules disabled; other choices are UI drafts pending backend support.
- Default Regular NLH micro settings are defined in `src/app/data/table-creation-defaults.json`. The current create request schema is only `small_blind`, `big_blind`, `buy_in_min`, `buy_in_max`, and `table_size`; update the backend schema before transmitting the remaining template fields.
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
- [ ] **Contract:** Confirm the backend accepts `table_size` on local and union table creation; the frontend sends it, but the supplied request examples omit it.
- [ ] **Contract:** Include a `game` label in each club/union table-list summary so lobby filters and cards can display the actual variant instead of the legacy NLH fallback.
- [ ] **Contract:** Define backend fields and behavior for table name, game variants, SNG/MTT modes, and all fields in `src/app/data/table-creation-defaults.json` before applying the full template to server-created tables.
- [ ] **Contract:** Confirm or document `GET /unions/{union_id}/membership/me`; the frontend uses it to identify union admins, but it is absent from the supplied API guide.
- [ ] **Deployment:** Configure the Firebase web settings in `src/environments/environment.ts` (or runtime override) and `apiBase`/`clubId` in `public/app-config.json` for each environment; verify email/password, Google, and phone/password sign-in plus membership lookup against live services.
- [ ] **Frontend:** Replace the remaining hardcoded table ID/default selection with configured or API-selected table state.
- [ ] **Frontend:** Replace the mock home-carousel club/global preview cards with invitation-backed clubs and connected global-game data when those services exist.
- [ ] **Backend + frontend:** Persist club creation, assign the creator's authoritative OWNER membership, and implement friend-table invitations before connecting the local home-menu previews to live services.
- [ ] **Frontend:** Remove the pre-buy-in check against `currentPlayer.stack`. The API contract says the server checks the member's ledger balance and that buy-in amount is the requested amount, not an assigned stack. Display the server's insufficient-balance response instead.

## P1: Match the documented live-table protocol

- [ ] **Frontend:** Send server pre-actions using `{ "type": "pre_action", "action": "CHECK_FOLD" | "FOLD" | "CALL_ANY" | null }`; consume the server acknowledgement and snapshot instead of locally firing the action on turn change.
- [ ] **Frontend/contract:** Remove the unsupported `SIT_IN` action from “I'm Back” or add a server sit-in route/message and document its rules. Do not optimistically mark the player seated/connected as if it were accepted.
- [ ] **Frontend:** Fetch a fresh Firebase ID token for each new socket and implement reconnect/resync with a new socket and fresh snapshot. Do not claim a disconnected action succeeded when it could not be sent.
- [ ] **Backend:** Add disconnect-specific grace period, auto-sit-out, reconnect, and seat-state policy. The documented turn timeout does not by itself provide disconnect protection.
- [ ] **Frontend:** Add request methods and UI for the documented club wallet endpoints: balance, send-out, claim-back, treasury read, and treasury transfer; cover `transaction_id` idempotency and role-specific downline rules.
- [ ] **Frontend:** Show verified home-club tags for union players and validate that snapshot/table-size configuration maps correctly to the seat layout.

## P2: Complete money and operations workflows

- [ ] **Backend + frontend:** Implement leave-seat, top-up/rebuy, cash-out, sit-out/sit-in, and reconciliation flows with idempotent ledger operations.
- [ ] **Backend:** Add durable single-writer live table state and restart recovery before multi-instance deployment; session affinity alone is insufficient.
- [ ] **Backend + frontend:** Complete club invitation/acceptance and union creation/invitation flows. Accepting a club invite creates or activates club membership for an existing global account; define union fee/rake allocation and remaining BBJ/promotion payout rules.
- [ ] **Frontend:** Add structured handling for `401`, `403`, `404`, `409`, `422`, and `503`; refresh an expired Firebase token and retry only operations that are safe/idempotent.
- [ ] **Integration:** Run the frontend against the backend and Firestore emulator/project; cover sign-in, membership, buy-in, wallet transfer, socket reconnect, turn timeout, replay masking, and failure/retry cases.

## Definition of done

- Runtime config points to the intended Firebase project and backend; no demo data is presented as live data.
- Phone/password login works through the backend-issued Firebase custom token, and account recovery uses a separate OTP flow.
- Empty/loading/error states reflect actual API responses; server balance is authoritative for buy-in.
- WebSocket pre-actions and reconnect behavior match the documented protocol; disconnect/sit-out outcomes come from the server.
- Documented wallet operations are accessible to the correct roles, while server-side role checks remain authoritative.
- Frontend/backend integration tests pass for the real contract, including idempotent financial operations.
