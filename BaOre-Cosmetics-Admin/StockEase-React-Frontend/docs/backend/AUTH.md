# Authentication API

The React app signs in through this API. The browser keeps the JWT in the httpOnly `baore_token` cookie and does not store it in `localStorage`. Product and movement records still use their existing browser storage. There is no public registration.

## Endpoints

All responses are JSON. Errors use `{ "error": "..." }`. No response includes `passwordHash`, the JWT, or the submitted password.

| Method and path | Auth | Behavior |
|---|---|---|
| `POST /api/auth/login` | Public | Body: `username` and `password`. Username is trimmed and compared in lowercase. Password is not trimmed. A wrong password and an unknown username both return `401` with `Invalid username or password.` |
| `POST /api/auth/logout` | None required | Clears the session cookie and returns `{ "message": "Logged out." }`. |
| `GET /api/auth/me` | Session cookie | Returns the current user from MongoDB. Missing, invalid, expired, and deleted-account tokens return `401` with `Authentication required.` |

A successful login or `me` response looks like:

```json
{
  "user": {
    "id": "…",
    "name": "Admin One",
    "username": "admin",
    "email": "admin@baore.com",
    "role": "admin"
  }
}
```

The stored role remains `admin` or `user`. The Employee label is a frontend display name for `user`. There is no database role named `employee`.

Login accepts only those two fields. A missing field, an empty username or password, a non-string value, or an extra field such as `role` returns `400` with `Invalid request.` The role used by later requests is loaded from MongoDB. A role embedded in an old token is ignored.

`POST /api/auth/login` allows 10 attempts per 15 minutes for each client address. The next attempt returns `429` with `Too many login attempts.` The counter is kept in memory for that server process.

## Cookie

The session is a signed JWT in the cookie `baore_token`. Page scripts cannot read it.

| Option | Value |
|---|---|
| `HttpOnly` | Always |
| `SameSite` | `Lax` |
| `Secure` | On when `NODE_ENV` is `production`. Off for local HTTP development and tests. |
| `Path` | `/` |
| `Max-Age` | The same lifetime as the JWT |

The token uses HS256. Its subject is the user id, and its issuer and audience are `baore-inventory`. Its `sv` claim is the account's session version. An admin password reset increments that version, which ends the account's existing sessions. See `ACCOUNTS.md`. Logout clears the cookie with the same `HttpOnly`, `SameSite`, `Secure`, and `Path` values and `Max-Age=0`.

CORS allows only `CLIENT_ORIGIN`, with credentials enabled. A wildcard origin is rejected.

## Environment

Set these in `server/.env`. That file stays untracked.

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Yes | At least 32 characters. The example placeholder and a repeated character are rejected. The value is never printed. |
| `JWT_EXPIRES_IN` | No | A duration such as `8h`, from `1m` through `30d`. Omitted means `8h`. |
| `CLIENT_ORIGIN` | Yes | Exact frontend origin, for example `http://127.0.0.1:5173`. Host and port must match the browser address. |
| `MONGODB_URI` | Yes | Must select `baore_cosmetics` and `replicaSet=rs0` for the running server. |
| `PORT` | Yes | API port, for example `5000`. |
| `NODE_ENV` | Yes | `development`, `test`, or `production`. |
| `BCRYPT_COST` | No | bcrypt cost for account passwords, an integer from 4 to 31. Omitted means 12. |

The server process validates this configuration before it connects. Seed passwords are not read by login.

## Local development

Run the API and the Vite app in two terminals. Open the site on `127.0.0.1` when `VITE_API_BASE_URL` is `http://127.0.0.1:5000`, so the session cookie stays on the same site. CORS accepts only the exact `CLIENT_ORIGIN` in every environment. If Vite starts on another port, update `CLIENT_ORIGIN` in `server/.env` to that address and restart the API.

```bash
cd server
npm run dev
```

```bash
npm run dev
```

The frontend command runs from `BaOre-Cosmetics-Admin/StockEase-React-Frontend`. Copy `.env.example` to `.env` only if the API should use a different origin. The default is `VITE_API_BASE_URL=http://127.0.0.1:5000`.

On startup the app calls `GET /api/auth/me` once. A 401 shows the sign-in screen. A network failure shows a retry screen and does not treat the person as signed out. `baore-session` is no longer read or written.

## Local checks

From `server/`:

```bash
npm test
```

Automated tests use `mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0` and their own accounts. They do not log in to `baore_cosmetics`.

With the API running on port 5000, a manual session looks like this. Replace the password locally; do not commit it.

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:5173" -d "{\"username\":\"admin\",\"password\":\"YOUR_PASSWORD\"}" http://127.0.0.1:5000/api/auth/login
curl -i -b cookies.txt -H "Origin: http://127.0.0.1:5173" http://127.0.0.1:5000/api/auth/me
curl -i -c cookies.txt -b cookies.txt -X POST http://127.0.0.1:5000/api/auth/logout
```

## Authorization

`requireAuth(env)` remains the only authentication step. It verifies the cookie and sets `req.user` from MongoDB. `requireRole(...allowedRoles)` then reads `req.user.role`. It does not read a role from the request body, query, headers, or token claims.

Place `requireAuth` first:

```javascript
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin, requireAdminOrUser } from "../middleware/requireRole.js";

router.post("/products", requireAuth(env), requireAdmin, createProduct);
router.get("/products", requireAuth(env), requireAdminOrUser, listProducts);
router.get("/me", requireAuth(env), currentUser);
```

| Pattern | Middleware | Who can pass |
|---|---|---|
| Admin only | `requireAuth(env)`, `requireAdmin` | Database role `admin` |
| Admin and Employee | `requireAuth(env)`, `requireAdminOrUser` | Database roles `admin` and `user` |
| Any signed-in account | `requireAuth(env)` | Either database role |

`requireAdmin` is `requireRole("admin")`. `requireAdminOrUser` is `requireRole("admin", "user")`. A route that calls `requireRole` without `requireAuth` has no `req.user`, so it returns `401`. An authenticated account whose database role is outside the allowed list returns `403` with `You do not have access to this action.`

`requireRole()` and any value other than `admin` or `user`, including `employee`, throw when the route is registered. A role change in MongoDB applies on the next request. The existing cookie does not need to be reissued.

The account routes under `/api/users` use `requireAuth(env)` and `requireAdmin`. These middleware functions are not attached to product or stock routes yet.

## Not in this stage

Product and stock movement routes are not implemented. Account management is described in `ACCOUNTS.md`. The React sign-in screen keeps its existing layout and now calls this API. The login limit is not shared across multiple server processes, and the API does not add a separate CSRF token beyond `SameSite=Lax`.
