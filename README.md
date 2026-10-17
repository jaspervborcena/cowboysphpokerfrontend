# Cowboys Poker Frontend

Angular 20 member client for the Cowboys PH poker experience. This workspace focuses on the clubhouse flow, role-based member UI, lobby browsing, and the live table experience in a portrait-first layout.

## Current status

The Angular client implements clubhouse, lobby, live-table, union-table, and hand-replay UI flows. It includes:

- Role-aware UI for `OWNER`, `MANAGER`, `AGENT`, `PLAYER`, and union-scoped `UNION_ADMIN` permissions.
- Firebase email/password and Google sign-in, email account creation, and email-link password recovery.
- Phone/password sign-in through a backend endpoint that returns a Firebase custom token, plus a separate phone OTP password-recovery flow. Phone account creation is not available.
- One auth gate for member content, Philippine phone-number normalization, and explicit global-account state when a signed-in user has no club membership.
- A least-privilege `PLAYER` state while membership is loading; elevated roles come from the backend membership response.
- Configurable API base URL, club ID, and Firebase web config loaded before Angular starts.
- A home-icon menu with Create A Club and Friend Table actions. A created profile is saved in browser storage, its creator can reopen the local room as OWNER, and enter its local table previews; local seating is creator-only and does not connect to server gameplay. Server-side club creation and friend-table invites are not connected.
- A consistent Club lobby action row for every role. Anyone can open the game picker; only verified Owners and Managers can submit creation. The picker is loaded from `GET /games` and offers only entries with `create_supported: true`. When the catalog is unavailable, creation is disabled instead of guessing supported variants.
- Table creation defaults live in [src/app/data/table-creation-defaults.json](src/app/data/table-creation-defaults.json): NLH, 1/2 blinds, 50-1,000 buy-in, and 9 seats. Create requests include `game_id`, blinds, buy-in limits, and `table_size`; unsupported modes and advanced template settings are not offered for server-created tables.
- Game behavior is separated into per-game rule files under [src/app/features/table/rules](src/app/features/table/rules). Hold’em Ring and PLO4 Ring currently share the buy-in confirmation, blind-entry choices, and 20-second timing policy; add another file and register it in `TableRulesService` to define another game/format.
- Selecting an empty chair opens a buy-in confirmation prefilled to that table's minimum. The UI validates the verified member's wallet summary, fails closed on mismatched identity or invalid balances, and checks available funds before requesting a seat. Idempotency keys stay tied to the member and exact seat request; the available balance refreshes after the server confirms seating.
- After seating, if the server marks `blind_decision_pending`, the player can choose to post the blind or wait for the big blind. The client sends correlated `BLIND_DECISION` and does not apply the choice optimistically.
- Each returned table is shown in its own card with the catalog-resolved `game_id`, status, blinds, buy-in range, and seat counts. Missing game identifiers are not presented as NLH.
- The lobby defaults to a two-column table grid. The floating layout shortcut toggles to full-width list rows and changes its icon to indicate the action that will switch back; a second click restores the grid.
- The table route is table-only: setup and connection fields are not shown beside the felt. Players select open seats and use game actions on the table surface; verified table managers can start a hand there.
- Table creation/seating/hand-start requests, authenticated websocket setup, and replay API integration.
- Live-table sockets use WebSocket protocol v1 envelopes, force-refresh Firebase tokens for each connection, answer `PING`, and reconnect with a new full server snapshot. Player actions include `action_id`; pre-actions use `PRE_ACTION` and are displayed from the player's snapshot. The table UI renders the server's 20-second action and disconnect timers but never locally resolves turns or changes seat/connectivity state.
- Live club tables are membership-gated and show actual empty/error results rather than demo rows. Mock Club and Global Room cards open isolated preview lobbies; only the configured club connects to backend data, and global play/invitation-based club switching are not connected.
- Server-provided disconnect and sit-out state only. Disconnect protection, timers, and actions remain backend-authoritative.
- An authenticated wallet dashboard that ensures/reads global playmoney, reads the signed-in member's club balance and authorized treasury balance, and submits idempotent member and inter-club transfers. It uses the documented wallet APIs, never reads wallet documents from Firestore, and keeps global playmoney separate from club chips.

This is not yet a production-ready end-to-end client. The API and websocket backend must implement and enforce the contracts below. Home-screen club cards are mock previews; the live lobby does not substitute sample rows when table data is empty or unavailable.

## Done and still to do

The frontend currently covers authentication flows, membership-gated club and union lobbies, table setup and seating requests, the v1 live-table socket protocol, hand replay, and authenticated wallet reads/transfers. These are frontend integrations against documented contracts; production authorization and backend behavior still require live integration verification.

The main remaining work is backend and integration: implement and verify phone sign-in/reset routes, authoritative authorization and disconnect handling, durable table and wallet ledgers, the remaining seat and club-invitation workflows, and end-to-end tests against the intended services. The detailed prioritized checklist is in [todo.md](todo.md).

## Table creation defaults

The defaults and full UI template are maintained in [src/app/data/table-creation-defaults.json](src/app/data/table-creation-defaults.json). A name-only Regular NLH table starts with these defaults:

```json
{
	"schema_version": 1,
	"default_table": {
		"game": "NLH",
		"mode": "Regular",
		"create_request_defaults": {
			"small_blind": 1,
			"big_blind": 2,
			"buy_in_min": 50,
			"buy_in_max": 1000,
			"table_size": 9
		}
	}
}
```

After an Owner or Manager enters a table name, the client slugifies it for `{table_id}` and sends `POST /clubs/{club_id}/tables/{table_id}` with the current supported body:

```json
{
	"game_id": "no_limit_texas_holdem",
	"small_blind": 1,
	"big_blind": 2,
	"buy_in_min": 50,
	"buy_in_max": 1000,
	"table_size": 9
}
```

The JSON also defines defaults for modes and advanced settings, but current create endpoints support only `game_id`, blinds, buy-in bounds, and table capacity. The UI obtains playable game choices from `GET /games`; only entries marked `create_supported` are offered. Table capacity must be between 2 and 9 for the current frontend layout. The client temporarily accepts `max_seats` from older table summaries, but uses `table_size` when supplied.

## Role model

`src/app/core/user-session.store.ts` holds the current client identity and role state. A Firebase identity starts with baseline `PLAYER` access while the app loads `GET /clubs/{club_id}/members/me`; the verified backend response then sets the club role.

- `OWNER`: club-wide management, table control, and access to admin-level actions
- `MANAGER`: table operational controls and access oversight
- `AGENT`: chip desk and downline-facing functions
- `PLAYER`: table participation and personal-game access only
- `UNION_ADMIN`: union-scoped creation/start/deletion of empty shared tables; it does not grant club administration.

The current navigation rule is intentional:

- `PLAYER` only sees the `ROLES` item in the member nav
- `AGENT`, `MANAGER`, and `OWNER` can access the member menu for shop, message, MTT, career, and roles; MTT is disabled until tournament endpoints exist

These checks are currently UI-level only. They are not security controls. The backend must re-validate identity and role on every REST and WebSocket endpoint before allowing privileged actions.

## Wallet Dashboard

The dashboard uses authenticated Firebase ID tokens for wallet API requests. Global scope calls `POST /me/wallets/global-playmoney/ensure` when opened and `GET /me/wallets/global-playmoney` on refresh. The ensure operation is idempotent and grants 20,000 `GLOBAL_PLAYMONEY` only when the wallet is missing. The supplied OpenAPI explicitly says this grant does not debit the displayed platform reserve; do not present it as reserve-backed funding.

Club scope reads `GET /clubs/{club_id}/members/me/wallet` for the authenticated member's `available_balance` and `in_play_balance`. The API states agent and player roles share these balances. Owners and managers can also read the club treasury and initiate inter-club treasury transfers. Owners, managers, and assigned agents can submit `send-out` and `claim-back` operations with a `transaction_id`; the backend remains authoritative for authorization, balance checks, idempotency, and the in-play claim-back restriction.

The lobby's `CLUB WALLET` control shows the treasury amount to owners/managers and the member's available club-chip amount to agents/players. Cowboys Global Room currently uses the configured runtime `clubId` for this wallet read because the global-room preview has no backend club ID of its own; other preview rooms do not show a wallet amount. The displayed value refreshes after returning from wallet operations.

The current UI requires a recipient member ID or destination club ID because the supplied API has no member/club search endpoint. It does not expose platform-admin club provisioning. The API also has no transaction-history, table-stack, or player-initiated cash-out request endpoint, so those views/actions are not fabricated. Wallet data is never read directly from Firestore.

## Backend contract and known gaps

This frontend assumes a backend exists for the following endpoints and behavior:

- health check at `/health`
- game catalog at `GET /games`; the UI uses `active_game_id`, `game_id`, `display_name`, and `create_supported`
- table creation and setup
- seat assignment with `buy_in_amount`
- authenticated wallet summary at `GET /clubs/{club_id}/members/me/wallet`, returning `club_id`, `user_id`, server-assigned `role`, `currency_type: "CLUB_CHIPS"`, `available_balance`, and `in_play_balance`
- authenticated global wallet provisioning/read at `POST /me/wallets/global-playmoney/ensure` and `GET /me/wallets/global-playmoney`; ensure grants 20,000 only for a missing wallet and does not debit the platform reserve
- authorized treasury read and inter-club transfer at `GET /clubs/{club_id}/wallet` and `POST /clubs/{club_id}/wallet/transfers`
- authorized member `send-out` and `claim-back` at `POST /clubs/{club_id}/wallet/send-out` and `POST /clubs/{club_id}/wallet/claim-back`, with UUID `transaction_id` idempotency
- club creation at `POST /platform/clubs`, which the supplied UI guide says credits 10,000 `CLUB_CHIPS` to `CLUB_TREASURY` and leaves the owner's personal member balance at zero
- table list or club-lobby data
- hand start and table update streams
- authenticated websocket access for table state
- `GET /clubs/{club_id}/hands/{hand_id}/replay` for authenticated, player-filtered hand replays
- `GET /clubs/{club_id}/unions` and `GET /clubs/{club_id}/unions/{union_id}/tables` for joined-union lobby data
- `POST /unions/{union_id}/tables/{table_id}` and union seat/hand/socket routes for shared games
- `POST /auth/phone/sign-in` accepts `{ "phone_number": "+639123456789", "password": "..." }` and returns `{ "firebase_custom_token": "..." }`. The backend must verify the credential, normalize phone numbers, rate-limit failures, and issue the token with Firebase Admin SDK. The frontend then signs into Firebase with that custom token; no SMS code is used during sign-in.
- `POST /auth/phone/password-reset/request` accepts `{ "phone_number": "+639123456789" }` and should return the same generic `202` response whether or not the account exists.
- `POST /auth/phone/password-reset/confirm` accepts `{ "phone_number": "+639123456789", "otp": "123456", "new_password": "..." }`. The backend must enforce code expiry, single use, attempt limits, rate limits, and password policy before updating credentials.
- Email password recovery uses Firebase `sendPasswordResetEmail`; it sends a reset link. Phone recovery uses the backend OTP flow. OTP is not part of normal sign-in.

An authenticated Firebase account is globally valid; club membership is separate and begins when a club invitation is accepted. A missing club membership must not invalidate the global account. Phone/password sign-in and reset routes are frontend contracts, not proof that the backend routes exist. Phone account creation is not implemented yet. Do not authenticate based only on a client-supplied phone number.

Before seating, the client fetches the signed-in member's wallet summary from the home club and validates its club, member, role, currency, and both balances. `available_balance` must cover both the table minimum and requested buy-in; `in_play_balance` is not spendable for another buy-in. The request idempotency key is reused only for an identical member/table/seat/amount request, and the displayed available balance refreshes after server confirmation. This is a UI preflight only: the seat endpoint must atomically re-check and reserve/debit the funds. The supplied OpenAPI now documents the wallet-summary route; backend behavior still requires live integration verification.

The wallet UI does not use a dashboard fixture. The supplied API does not expose transaction history, table stacks, or player-initiated cash-out requests; those remain unavailable rather than being shown as live data. The current global-wallet ensure contract grants directly and does not debit a shared reserve.

The replay feature is split into a token-authenticated API service, signal store, container, and presentation components under `src/app/features/hand-replay/`. Private hand history requests require the active Firebase ID token from the authenticated session.

At startup, Firebase web configuration defaults to `src/environments/environment.ts`. The app fetches `/app-config.json` before Angular starts; `apiBase` and `clubId` come from that file, and its optional `firebase` object overrides the Firebase default. Firebase web config is public client configuration, not a server secret, and its API key should be restricted in Google Cloud Console. Protected club and union requests use the Firebase ID token. Club tables load only after club membership is verified, and there are no sample table rows when a list is empty or unavailable. Union seats are debited from the selected home club. The socket URL omits the player ID; its first v1 `AUTHENTICATE` envelope carries the token and, for union play, the home `club_id`.

The backend owns heartbeat deadlines, auto-check/fold behavior, sit-out state, reconnect rules, and table snapshots. It must provide `turn_seconds_left`, `disconnect_seconds_left`, and `disconnect_timeout_count` in player snapshots. A normal action gets 20 seconds; on expiry, the server checks when legal and otherwise folds. A disconnect starts a fresh 20-second recovery window; if it expires, the server auto-folds, and a second expired disconnect window marks the player sat out. The frontend only animates these server-provided timers. A sat-out player can send correlated `SIT_IN`; the UI clears sit-out only after a confirming `TABLE_SNAPSHOT`. The frontend replies to `PING` with `PONG`, authenticates again after reconnect, and replaces local state with the full snapshot.

WebSocket table messages use protocol version `1.0`, exact local/union topic names, and `event` envelopes with `correlation_id`. Actions are sent as `PLAYER_ACTION` with a fresh `action_id`; pre-actions use `PRE_ACTION`, and the selected value is read from the player's next full snapshot. `BLIND_DECISION` accepts `POST_BLIND` or `WAIT_FOR_BIG_BLIND`; only a server snapshot clears the pending choice. The backend must provide `blind_decision_pending` and `blind_amount_to_post` on the player snapshot and validate the requested choice.

## Local development

```powershell
npm install
npx ng serve
```

Open http://localhost:4200. The backend allows local Angular origins by default; configure `CORS_ALLOWED_ORIGINS` for deployment. Set `apiBase` and `clubId` in `public/app-config.json` before startup; the table-only view does not expose development connection fields.

## Validation

```powershell
npm run build
npx ng test --watch=false
```

The Angular production build and unit tests validate frontend behavior and API request shapes; they do not prove that backend routes or security enforcement are live. Configure Firebase for each deployment, implement the API contracts, and verify club invitation acceptance creates or activates the associated membership before integration testing.

## Next phase focus

The next phase should focus on integration and hardening rather than more visual polish:

1. Implement and integration-test phone/password sign-in and OTP-based password reset on the backend.
2. Replace sample lobby/table data and hardcoded development IDs with configured, live backend data.
3. Enforce club/union roles and all privileged REST/websocket actions on the server.
4. Move disconnect protection, auto-sit-out, reconnect, and turn resolution to authoritative server logic.
5. Add seat-leave, cash-out, buy-in ledger, and club/union cashier flows.
6. Add club invitation/acceptance and union formation workflows that link existing global accounts to club membership, plus rake allocation and durable multi-instance table state.

## Files to watch

- `src/app/app.ts` — main app state, lobby flow, table flow, websocket connection
- `src/app/table.html` — member UI, lobby renderer, live table, role modal
- `src/app/core/user-session.store.ts` — role and member identity signals
- `src/app/features/hand-replay/` — replay API, signal store, smart container, and presentation components
- `src/app/app.spec.ts` — role and UI behavior tests