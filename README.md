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
- A home-icon menu with Create A Club and Friend Table actions. A created profile is saved in browser storage, its creator can reopen the local room as OWNER, and that room can contain non-joinable table previews; server-side club creation, table play, and friend-table invites are not connected.
- A consistent Club lobby action row for every role. Anyone can open the game picker; only verified Owners and Managers can submit creation. The picker is loaded from `GET /games` and offers only entries with `create_supported: true`. When the catalog is unavailable, creation is disabled instead of guessing supported variants.
- Table creation defaults live in [src/app/data/table-creation-defaults.json](src/app/data/table-creation-defaults.json): NLH, 1/2 blinds, 50-1,000 buy-in, and 9 seats. Create requests include `game_id`, blinds, buy-in limits, and `table_size`; unsupported modes and advanced template settings are not offered for server-created tables.
- Each returned table is shown in its own card with the catalog-resolved `game_id`, status, blinds, buy-in range, and seat counts. Missing game identifiers are not presented as NLH.
- Table creation/seating/hand-start requests, authenticated websocket setup, and replay API integration.
- Live-table sockets use WebSocket protocol v1 envelopes, force-refresh Firebase tokens for each connection, answer `PING`, and reconnect with a new full server snapshot. Player actions include `action_id`; pre-actions use `PRE_ACTION` and are displayed from the player's snapshot. The client does not locally resolve turns or change seat/connectivity state after disconnects.
- Live club tables are membership-gated and show actual empty/error results rather than demo rows. Mock Club and Global Room cards open isolated preview lobbies; only the configured club connects to backend data, and global play/invitation-based club switching are not connected.
- Server-provided disconnect and sit-out state only. Disconnect protection, timers, and actions remain backend-authoritative.

This is not yet a production-ready end-to-end client. The API and websocket backend must implement and enforce the contracts below. Home-screen club cards are mock previews; the live lobby does not substitute sample rows when table data is empty or unavailable.

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

## Backend contract and known gaps

This frontend assumes a backend exists for the following endpoints and behavior:

- health check at `/health`
- game catalog at `GET /games`; the UI uses `active_game_id`, `game_id`, `display_name`, and `create_supported`
- table creation and setup
- seat assignment with `buy_in_amount`
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

The replay feature is split into a token-authenticated API service, signal store, container, and presentation components under `src/app/features/hand-replay/`. Private hand history requests require the active Firebase ID token from the authenticated session.

At startup, Firebase web configuration defaults to `src/environments/environment.ts`. The app fetches `/app-config.json` before Angular starts; `apiBase` and `clubId` come from that file, and its optional `firebase` object overrides the Firebase default. Firebase web config is public client configuration, not a server secret, and its API key should be restricted in Google Cloud Console. Protected club and union requests use the Firebase ID token. Club tables load only after club membership is verified, and there are no sample table rows when a list is empty or unavailable. Union seats are debited from the selected home club. The socket URL omits the player ID; its first v1 `AUTHENTICATE` envelope carries the token and, for union play, the home `club_id`.

The backend owns heartbeat deadlines, auto-check/fold behavior, sit-out state, reconnect rules, and table snapshots. The frontend replies to `PING` with `PONG`, authenticates again after reconnect, and replaces local state with the full `TABLE_SNAPSHOT`. It does not claim that reconnecting performs a sit-in action.

WebSocket table messages use protocol version `1.0`, exact local/union topic names, and `event` envelopes with `correlation_id`. Actions are sent as `PLAYER_ACTION` with a fresh `action_id`; pre-actions use `PRE_ACTION`, and the selected value is read from the player's next full snapshot.

## Local development

```powershell
npm install
npm start
```

Open http://localhost:4200. The backend allows local Angular origins by default; configure `CORS_ALLOWED_ORIGINS` for deployment. The API base URL can be changed from the table setup drawer in the app.

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