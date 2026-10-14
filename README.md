# Cowboys Poker Frontend

Angular 20 member client for the Cowboys PH poker experience. This workspace focuses on the clubhouse flow, role-based member UI, lobby browsing, and the live table experience in a portrait-first layout.

## Current status

The frontend is in a demo-ready state for UX and role presentation:

- The session store exposes member identity and role state using Angular signals.
- Supported roles are `OWNER`, `MANAGER`, `AGENT`, and `PLAYER`.
- The app includes a role sheet that shows each permission set and highlights the current demo role.
- The member flow starts at the clubhouse/home screen, goes to the club lobby, and can open a live table view.
- The bottom navigation is role-aware: regular players only see the `ROLES` action, while `AGENT` and higher roles see the full member menu.
- Table actions, seat creation, hand start, and websocket updates are wired in the client.
- Completed hands can be opened in a per-player replay with frame stepping, playback, speed control, and an action log.
- The current demo account is `joppy2024` with member ID `player-a` and the active role `PLAYER`.

## Role model

`src/app/core/user-session.store.ts` is the source of truth for the demo identity and role permissions.

- `OWNER`: club-wide management, table control, and access to admin-level actions
- `MANAGER`: table operational controls and access oversight
- `AGENT`: chip desk and downline-facing functions
- `PLAYER`: table participation and personal-game access only

The current navigation rule is intentional:

- `PLAYER` only sees the `ROLES` item in the member nav
- `AGENT`, `MANAGER`, and `OWNER` can access the full member menu for shop, message, MTT, career, and roles

These checks are currently UI-level only. They are not security controls. The backend must re-validate identity and role on every REST and WebSocket endpoint before allowing privileged actions.

## Backend assumptions and known gaps

This frontend assumes a backend exists for the following endpoints and behavior:

- health check at `/health`
- table creation and setup
- seat assignment with `buy_in_amount`
- table list or club-lobby data
- hand start and table update streams
- authenticated websocket access for table state
- `GET /clubs/{club_id}/hands/{hand_id}/replay` for authenticated, player-filtered hand replays

The replay feature is split into a token-authenticated API service, signal store, smart container, and dumb replay controls/table/action-log components under `src/app/features/hand-replay/`. It requires the active Firebase ID token to be provided to `UserSessionStore.setVerifiedMember`; the demo identity alone is intentionally insufficient to load private hand history.

The app currently uses sample lobby rows because there is no real table-list endpoint yet. The seat request currently sends `buy_in_amount` and intentionally omits `chip_stack`; the backend must validate and reconcile the member balance atomically before accepting the seat.

## Local development

```powershell
npm install
npm start
```

Open http://localhost:4200. If the backend is also running, ensure the frontend origin is allowed in the backend CORS configuration. The API base URL can be changed from the table setup drawer in the app.

## Validation

```powershell
npm run build
npx ng test --watch=false
```

The Angular production build and unit tests validate the replay flow and token handling. Firebase web sign-in/configuration is not included in this demo, so a host auth flow must provide the current Firebase ID token before replay API requests can succeed.

## Next phase focus

The next phase should focus on integration and hardening rather than more visual polish:

1. integrate Firebase web sign-in and provide the refreshed token to the session store
2. connect the frontend to real club membership and table APIs
3. replace demo lobby data with real table and member data
4. complete management flows for `OWNER` and `MANAGER` roles
5. verify role-aware navigation and access across all screens

## Files to watch

- `src/app/app.ts` — main app state, lobby flow, table flow, websocket connection
- `src/app/table.html` — member UI, lobby renderer, live table, role modal
- `src/app/core/user-session.store.ts` — role and member identity signals
- `src/app/features/hand-replay/` — replay API, signal store, smart container, and presentation components
- `src/app/app.spec.ts` — role and UI behavior tests