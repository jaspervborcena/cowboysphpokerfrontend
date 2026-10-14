# Next phase plan

## Goal

Move the Angular demo from a polished frontend concept to a real, backend-connected, authenticated club poker client with enforced role access.

## Priority work

- [ ] Implement backend `POST /auth/phone/sign-in`: validate phone/password, rate-limit failures, and return a Firebase custom token.
- [ ] Implement OTP-based phone password reset; OTP is for account recovery, not normal sign-in.
- [ ] Configure Firebase web settings at host startup and verify email/password, Google, and phone/password sign-in against the real Firebase project.
- [ ] Confirm and integration-test backend contracts for health, membership, tables, seating, hand actions, and websocket snapshots.
- [ ] Replace sample lobby rows, hardcoded club/table IDs, and empty/error fallbacks with configured live data and explicit empty/error states.
- [ ] Enforce `PLAYER`, `AGENT`, `MANAGER`, `OWNER`, and union-admin permissions on every privileged REST and websocket action.
- [ ] Verify websocket authentication, token expiry, reconnect behavior, and server-authoritative identity/role checks.
- [ ] Move disconnect grace periods, auto-check/fold, sit-out, and reconnect state to the backend; remove claims based solely on optimistic browser state.
- [ ] Complete seat lifecycle and ledger flows: buy-in idempotency, leave seat, cash-out, and club/union cashier reconciliation.
- [ ] Complete union formation, invitations, and member provisioning workflows.
- [ ] Define rake policy and allocation; use durable single-writer table state for multi-instance hosting.
- [ ] Expand integration tests for auth lifecycle, API errors/empty states, role authorization, and websocket/table lifecycle behavior.

## Definition of done

The next phase is complete when:

- the app starts with configured Firebase and backend endpoints,
- the frontend uses real backend data and has explicit loading, empty, and error states,
- email/password, Google, and phone/password sign-in complete against the real auth setup,
- phone password reset uses OTP without requiring OTP during normal sign-in,
- `PLAYER` users only see player-only actions,
- `AGENT`, `MANAGER`, and `OWNER` users see the appropriate elevated menu,
- server-side role and table-state enforcement blocks unauthorized or stale actions,
- cash, seat, and hand lifecycle flows are covered by integration tests.
