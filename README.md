# Cowboys Poker Frontend

Angular 20 member client for the Cowboys PH poker experience. This workspace focuses on the clubhouse flow, role-based member UI, lobby browsing, and the live table experience in a portrait-first layout.

## Current status

The frontend is in a demo-ready state for UX and role presentation:

- The session store exposes member identity and role state using Angular signals.
- Supported roles are `OWNER`, `MANAGER`, `AGENT`, and `PLAYER`.
- Union admin rights are separately scoped as `UNION_ADMIN`; they do not replace or elevate a club role.
- The app includes a role sheet that shows each permission set and highlights the current demo role.
- The member flow starts at the clubhouse/home screen, goes to the club lobby, and can open a live table view.
- The bottom navigation is role-aware: regular players only see the `ROLES` action, while `AGENT` and higher roles see the full member menu.
- Table actions, seat creation, hand start, and websocket updates are wired in the client.
- Completed hands can be opened in a per-player replay with frame stepping, playback, speed control, and an action log.
- The lobby separates Club Tables from Union Tables, labels shared-table players with their home club, and exposes table management only to union admins.
- The current demo account is `joppy2024` with member ID `player-a` and the active role `PLAYER`.

## Role model

`src/app/core/user-session.store.ts` is the source of truth for the demo identity and role permissions.

- `OWNER`: club-wide management, table control, and access to admin-level actions
- `MANAGER`: table operational controls and access oversight
- `AGENT`: chip desk and downline-facing functions
- `PLAYER`: table participation and personal-game access only
- `UNION_ADMIN`: union-scoped creation/start/deletion of empty shared tables; it does not grant club administration.

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
- `GET /clubs/{club_id}/unions` and `GET /clubs/{club_id}/unions/{union_id}/tables` for joined-union lobby data
- `POST /unions/{union_id}/tables/{table_id}` and union seat/hand/socket routes for shared games

The replay feature is split into a token-authenticated API service, signal store, smart container, and dumb replay controls/table/action-log components under `src/app/features/hand-replay/`. It requires the active Firebase ID token to be provided to `UserSessionStore.setVerifiedMember`; the demo identity alone is intentionally insufficient to load private hand history.

When Firebase returns a real ID token, the app loads club and union table lists from the backend. Demo lobby rows remain a fallback. Union seats are debited from the selected home club; the shared socket URL omits the player ID and authenticates with the token plus `club_id` in its first message.

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

The Angular production build and unit tests validate replay and union UI behavior. A host must configure `window.__COWBOYS_FIREBASE_CONFIG__` and establish a Firebase Auth session before protected club/union API calls can succeed. Union and club membership documents must be provisioned in Firestore before they appear in the lobby.

## Next phase focus

The next phase should focus on integration and hardening rather than more visual polish:

1. wire the host Firebase Auth sign-in/configuration into the current Firebase token service
2. replace demo fallback lobby rows with live data only
3. build union formation, club invitations, and member provisioning workflows
4. define and implement rake rates and traffic-based rake allocation
5. move live table state to a durable single-writer runtime for multi-instance hosting
6. add sit-out, leave-seat, cash-out, and full club/union cashier flows

## Files to watch

- `src/app/app.ts` — main app state, lobby flow, table flow, websocket connection
- `src/app/table.html` — member UI, lobby renderer, live table, role modal
- `src/app/core/user-session.store.ts` — role and member identity signals
- `src/app/features/hand-replay/` — replay API, signal store, smart container, and presentation components
- `src/app/app.spec.ts` — role and UI behavior tests