# Cowboys Poker Frontend

Angular 20 member client for the Cowboys PH poker experience. This workspace focuses on the clubhouse flow, role-based member UI, lobby browsing, and the live table experience in a portrait-first layout.

## Current status

The Angular client implements clubhouse, lobby, live-table, union-table, and hand-replay UI flows. It includes:

- Role-aware UI for `OWNER`, `MANAGER`, `AGENT`, `PLAYER`, and union-scoped `UNION_ADMIN` permissions.
- Firebase email/password and Google sign-in, followed by backend club-membership lookup.
- Phone/password sign-in through a backend endpoint that returns a Firebase custom token.
- A least-privilege `PLAYER` state while membership is loading; elevated roles come from the backend membership response.
- Table creation/seating/hand-start requests, authenticated websocket setup, and replay API integration.
- A client-side disconnect/sit-out presentation. It is not authoritative disconnect protection; the server must enforce timers and actions.

This is not yet a production-ready end-to-end client. The API and websocket backend must implement and enforce the contracts below. Sample lobby rows are still used when live table data is unavailable.

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

The phone sign-in route is a frontend contract, not proof that the backend route exists. Phone account provisioning and OTP-based password reset are not implemented in this frontend yet. Do not authenticate based only on a client-supplied phone number.

The replay feature is split into a token-authenticated API service, signal store, container, and presentation components under `src/app/features/hand-replay/`. Private hand history requests require the active Firebase ID token from the authenticated session.

The host must set `window.__COWBOYS_FIREBASE_CONFIG__` before the app starts. Protected club and union requests use the Firebase ID token. The lobby currently retains sample rows when live table requests fail or return an empty list; remove that fallback before production. Union seats are debited from the selected home club; the shared socket URL omits the player ID and authenticates with the token plus `club_id` in its first message.

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

The Angular production build and unit tests validate frontend behavior and API request shapes; they do not prove that backend routes or security enforcement are live. Configure `window.__COWBOYS_FIREBASE_CONFIG__`, implement the API contracts, and provision club/union membership records before integration testing.

## Next phase focus

The next phase should focus on integration and hardening rather than more visual polish:

1. Implement and integration-test phone/password sign-in and OTP-based password reset on the backend.
2. Replace sample lobby/table data and hardcoded development IDs with configured, live backend data.
3. Enforce club/union roles and all privileged REST/websocket actions on the server.
4. Move disconnect protection, auto-sit-out, reconnect, and turn resolution to authoritative server logic.
5. Add seat-leave, cash-out, buy-in ledger, and club/union cashier flows.
6. Add union formation, invitations, member provisioning, rake allocation, and durable multi-instance table state.

## Files to watch

- `src/app/app.ts` — main app state, lobby flow, table flow, websocket connection
- `src/app/table.html` — member UI, lobby renderer, live table, role modal
- `src/app/core/user-session.store.ts` — role and member identity signals
- `src/app/features/hand-replay/` — replay API, signal store, smart container, and presentation components
- `src/app/app.spec.ts` — role and UI behavior tests