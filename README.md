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
- A consistent Club lobby action row for every role; Create a new table is disabled unless the active role is an authorized Owner or Manager. Authorized users can open the game/settings wizard from the action row or empty state. Only Regular NLH with all special rules off is currently submitted; the backend contract does not yet support the other variants or settings.
- Table creation defaults live in [src/app/data/table-creation-defaults.json](src/app/data/table-creation-defaults.json): Regular NLH, 1/2 blinds, 50-1,000 buy-in, and 9 seats. Name-only creation uses these micro defaults. The API currently accepts only blinds, buy-in limits, and table size; advanced template settings are not sent.
- Each returned table is shown in its own card with game, status, blinds, buy-in range, and seat counts. The API's optional `game` label is displayed when present; older responses default to NLH.
- Table creation/seating/hand-start requests, authenticated websocket setup, and replay API integration.
- Live club tables are membership-gated and show actual empty/error results rather than demo rows. Mock Club and Global Room cards open isolated preview lobbies; only the configured club connects to backend data, and global play/invitation-based club switching are not connected.
- A client-side disconnect/sit-out presentation. It is not authoritative disconnect protection; the server must enforce timers and actions.

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
	"small_blind": 1,
	"big_blind": 2,
	"buy_in_min": 50,
	"buy_in_max": 1000,
	"table_size": 9
}
```

The full JSON also defines UI defaults for game variants, fees, restrictions, and advanced options. Those extra fields are not sent because the current backend create-table schema only supports the five fields above. Update the backend contract before expecting those settings to affect a server-created table. Preview-room tables remain local-only.

## Role model

`src/app/core/user-session.store.ts` holds the current client identity and role state. A Firebase identity starts with baseline `PLAYER` access while the app loads `GET /clubs/{club_id}/members/me`; the verified backend response then sets the club role.

- `OWNER`: club-wide management, table control, and access to admin-level actions
- `MANAGER`: table operational controls and access oversight
- `AGENT`: chip desk and downline-facing functions
- `PLAYER`: table participation and personal-game access only
- `UNION_ADMIN`: union-scoped creation/start/deletion of empty shared tables; it does not grant club administration.

The current navigation rule is intentional:

- `PLAYER` only sees the `ROLES` item in the member nav
- `AGENT`, `MANAGER`, and `OWNER` can access the full member menu for shop, message, MTT, career, and roles

These checks are currently UI-level only. They are not security controls. The backend must re-validate identity and role on every REST and WebSocket endpoint before allowing privileged actions.

## Backend contract and known gaps

This frontend assumes a backend exists for the following endpoints and behavior:

- health check at `/health`
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

At startup, Firebase web configuration defaults to `src/environments/environment.ts`. The app fetches `/app-config.json` before Angular starts; `apiBase` and `clubId` come from that file, and its optional `firebase` object overrides the Firebase default. Firebase web config is public client configuration, not a server secret, and its API key should be restricted in Google Cloud Console. Protected club and union requests use the Firebase ID token. Club tables load only after club membership is verified, and there are no sample table rows when a list is empty or unavailable. Union seats are debited from the selected home club; the shared socket URL omits the player ID and authenticates with the token plus `club_id` in its first message.

The browser's disconnect timer and optimistic seat flags are presentation only. The backend must own heartbeat deadlines, auto-check/fold behavior, sit-out state, reconnect rules, and table snapshots.

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