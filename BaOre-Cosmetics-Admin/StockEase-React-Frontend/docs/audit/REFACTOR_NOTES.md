# Refactor notes

Phase 2A moved helpers out of `src/App.jsx` without changing behavior. These oddities were left in place.

1. `movementForm` is still created with `type: "sale"` at `src/App.jsx:55`. `openMovement` replaces that with `restock` or `stock_out` at `src/App.jsx:256` before the modal can be submitted. A signed-in user still cannot save `sale`, because `saveMovement` only allows ids from `employeeMovementTypes` (`src/App.jsx:266`).
2. `handleLogout` clears the username, password, and login error (`src/App.jsx:125`) and does not clear `toast`. A toast already on screen can still sit on the sign-in view until the 2200ms timer at `src/App.jsx:88`.
3. The toast "Keep at least one admin account." (`src/App.jsx:183`) is not reachable from the current buttons. The signed-in account has no remove button (`user.id !== currentUser.id`), and removing any other admin still leaves the signed-in admin, so `adminsLeft` is not 0.

4. Phase 2B-1 moved chrome JSX out of `src/App.jsx`. The behaviors above are unchanged. Current lines: initial movement type `src/App.jsx:59`, `openMovement` `src/App.jsx:257`, the allowed-type check `src/App.jsx:270`, `handleLogout` `src/App.jsx:129`, the toast timer `src/App.jsx:92`, and the last-admin toast `src/App.jsx:187`. The sign-in toast and the signed-in toast are the same `Toast` element, and only one of those trees is mounted.

5. Phase 2B-2 moved the four page bodies out of `src/App.jsx`. The behaviors above are unchanged. Current lines: initial movement type `src/App.jsx:49`, toast timer `src/App.jsx:82`, `handleLogout` `src/App.jsx:119`, last-admin toast `src/App.jsx:177`, `openMovement` `src/App.jsx:247`, allowed-type check `src/App.jsx:260`. Product lookup and movement delta math that used to sit inside the dashboard and activity JSX moved with that JSX into `DashboardPage.jsx` and `ActivityPage.jsx`. It was not rewritten.

6. Phase 2C moved that same state into `src/state/AppState.jsx`. The behaviors above are unchanged. Current lines: initial movement type `src/state/AppState.jsx:34`, toast timer `src/state/AppState.jsx:66`, `handleLogout` `src/state/AppState.jsx:103`, last-admin toast `src/state/AppState.jsx:161`, `openMovement` `src/state/AppState.jsx:231`, allowed-type check `src/state/AppState.jsx:245`. The page is now the URL, so a refresh stays on the permitted route when `baore-session` is valid.
