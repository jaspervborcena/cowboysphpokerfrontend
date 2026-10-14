# Next phase plan

## Goal

Move the Angular demo from a polished frontend concept to a real, backend-connected, authenticated club poker client with enforced role access.

## Priority work

- [ ] Diagnose and fix the current local `npm start` startup failure in this workspace.
- [ ] Confirm the backend contract for health, club data, seat creation, hand actions, and websocket table updates.
- [ ] Replace sample lobby and table data with real API-backed data.
- [ ] Add real authentication and member verification before setting session role state.
- [ ] Enforce `PLAYER`, `AGENT`, `MANAGER`, and `OWNER` permission checks on the server for all privileged actions.
- [ ] Secure websocket and table routes so identity and role are validated on every request.
- [ ] Finalize the lower navigation behavior so players only see the minimal role menu, while agents and higher roles keep the full menu.
- [ ] Integrate Firebase web sign-in and pass the refreshed ID token into the authenticated session store.
- [ ] Replace hardcoded member/role state with `GET /clubs/{club_id}/members/me` data and server-authoritative role checks.
- [ ] Rewrite the table websocket flow to match the backend contract: authenticate on open, remove user IDs from the URL, and handle `authenticated` acknowledgements.
- [ ] Add `buy_in_id` idempotency handling to seat requests and retry-safe balance flows.
- [ ] Connect the lobby to real club and table APIs instead of static sample data.
- [ ] Wire completed-hand replay flow to `GET /clubs/{club_id}/hands/{hand_id}/replay` with token-authenticated requests.
- [ ] Validate owner/manager controls and agent desk actions against verified role checks.
- [ ] Add regression tests around role gating, auth flow, table lifecycle behavior, and replay access.

## Definition of done

The next phase is complete when:

- the app starts cleanly in development,
- the frontend uses real backend data instead of placeholders,
- `PLAYER` users only see player-only actions,
- `AGENT`, `MANAGER`, and `OWNER` users see the appropriate elevated menu,
- server-side role enforcement blocks unauthorized access,
- all privileged actions are covered by regression tests.
