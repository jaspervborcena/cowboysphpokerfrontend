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
- [ ] Validate owner/manager controls and agent desk actions against verified role checks.
- [ ] Add regression tests around role gating, auth flow, and table lifecycle behavior.

## Definition of done

The next phase is complete when:

- the app starts cleanly in development,
- the frontend uses real backend data instead of placeholders,
- `PLAYER` users only see player-only actions,
- `AGENT`, `MANAGER`, and `OWNER` users see the appropriate elevated menu,
- server-side role enforcement blocks unauthorized access,
- all privileged actions are covered by regression tests.
