# Refactor notes

Phase 2A moved helpers out of `src/App.jsx` without changing behavior. These oddities were left in place.

1. `movementForm` is still created with `type: "sale"` at `src/App.jsx:55`. `openMovement` replaces that with `restock` or `stock_out` at `src/App.jsx:256` before the modal can be submitted. A signed-in user still cannot save `sale`, because `saveMovement` only allows ids from `employeeMovementTypes` (`src/App.jsx:266`).
2. `handleLogout` clears the username, password, and login error (`src/App.jsx:125`) and does not clear `toast`. A toast already on screen can still sit on the sign-in view until the 2200ms timer at `src/App.jsx:88`.
3. The toast "Keep at least one admin account." (`src/App.jsx:183`) is not reachable from the current buttons. The signed-in account has no remove button (`user.id !== currentUser.id`), and removing any other admin still leaves the signed-in admin, so `adminsLeft` is not 0.
