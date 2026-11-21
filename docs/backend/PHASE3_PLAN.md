# Phase 3 plan — Ba'Oré backend

Planning only. This document does not add a server, change the frontend, or change `docs/DECISIONS.md`.

The approved decisions in `docs/DECISIONS.md` take precedence over `docs/mongodb-setup.md` and `docs/mern-project-plan.md` where they disagree. Disagreements are listed below and are not resolved by rewriting those decisions.

## 1. Current project structure and findings

Git root contains `README.md` and `BaOre-Cosmetics-Admin/StockEase-React-Frontend/`. There is no `server/` directory anywhere in the repository.

The frontend is a Vite + React 18 app. `package.json` scripts are `dev`, `build`, and `preview`. There is no test script. Installed dependencies are React, React DOM, Vite, the React Vite plugin, `lucide-react`, and `react-router-dom`. `recharts` is named in decision D7 and is not installed. Backend packages are not installed.

Current source layout:

- `src/main.jsx` mounts `App`.
- `src/App.jsx` is the composition layer: `BrowserRouter`, `AppStateProvider`, and routes.
- `src/state/AppState.jsx` owns products, movements, users, the session, forms, search, toasts, localStorage effects, and the product, movement, and account handlers.
- `src/components/auth/LoginScreen.jsx`
- `src/components/layout/Sidebar.jsx`, `Topbar.jsx`, `Toast.jsx`
- `src/components/modals/ProductModal.jsx`, `MovementModal.jsx`, `AccountModal.jsx`
- `src/components/pages/DashboardPage.jsx`, `InventoryPage.jsx`, `ActivityPage.jsx`, `TeamPage.jsx`
- `src/lib/constants.js`, `format.js`, `stock.js`, `storage.js`
- `src/data/starterData.js`

Routes that exist today:

| Path | Access |
|---|---|
| `/login` | Signed-out visitors. A signed-in visitor is sent to `/dashboard`. |
| `/` | Sent to `/dashboard` or `/login`. |
| `/dashboard` | Any signed-in account. |
| `/inventory` | Any signed-in account. The label is Inventory for an admin and Floor stock for a user. |
| `/activity` | Admin only. Other accounts are sent to `/dashboard`. |
| `/team` | Admin only. Other accounts are sent to `/dashboard`. |

Those checks use `currentUser.role === "admin"` in the browser. They are display rules, not a security boundary.

Persistence is still the browser. `src/lib/storage.js` and `src/state/AppState.jsx` use four keys: `baore-items`, `baore-users`, `baore-movements`, and `baore-session`. The session value is the user id. Users are stored with a plaintext `password` field. Seed accounts are hardcoded in `src/data/starterData.js`. Decision D13 says this browser data will not be migrated.

Behavior the current handlers actually implement:

- Login compares a trimmed, case-insensitive username with an exact password.
- Product SKU is trimmed and stored uppercase. Uniqueness is case-insensitive.
- Product quantity and price use `Number()`. Quantity must be finite and at least 0. Decimals and exponent notation such as `1e3` are accepted. Movement quantity must be a positive integer. `1e3` also passes that integer check.
- Edit Product writes quantity directly and does not create a movement.
- Admin movement types are `restock`, `sale`, `adjustment`, and `return`. User types are `stock_in` and `stock_out`. `adjustment` uses `direction` `in` or `out`.
- Deleting a product removes the product only. Movements remain, and the screen shows "Removed product" when the product lookup fails.
- Creating an account requires `@` in the email. Username and email uniqueness are case-insensitive. Password is not trimmed. There is no account-edit screen.
- The signed-in account cannot remove itself. The last-admin toast exists, but the only admin has no remove button, so that toast is not reachable from the current UI.
- `roleLabel()` returns "User" for every non-admin. Decision D6 says the UI label is Employee. The stored role value is already `user`.
- `money()` formats PHP with `maximumFractionDigits: 0`. A price of `399.5` displays as ₱400. Decision D9 requires centavo display.
- Low stock on the dashboard list is `quantity <= 5`, so zero is included in that list. `stockStatus()` separately labels `<= 0` as Out of stock and `1` through `5` as Low stock. Decision D11 asks for a separate Out of Stock card.
- `docs/baore-seed-data.json` repeats the eight products and adds a `status` field the UI does not store.
- `docs/mongodb-setup.md` describes `products`, `stockMovements`, and `users`, unique indexes, and `passwordHash`. It does not yet include `createdAt` / `updatedAt` on products, or movement `quantityBefore`, `quantityAfter`, `productName`, and `sku`. `docs/mern-project-plan.md` is older and still describes a categories collection and a configurable threshold. Those older statements are not the Phase 3 spec.

MongoDB for development is already recorded in `docs/DECISIONS.md`: Community Server 8.3.7, database `baore_cosmetics`, replica set `rs0`, member `127.0.0.1:27017`, transactions verified with a rollback test, authentication disabled, bound to localhost. This plan does not change that configuration.

## 2. Proposed backend folder structure

Add a separate package so the Express app is not mixed into the Vite dependency tree:

```text
BaOre-Cosmetics-Admin/StockEase-React-Frontend/server/
  package.json
  .env.example
  src/
    index.js                 process start, listen on localhost
    app.js                   Express app without listening
    config/env.js            read and validate environment
    db/connect.js            Mongoose connection
    models/User.js
    models/Product.js
    models/StockMovement.js
    models/AdminGuard.js
    middleware/requireAuth.js
    middleware/requireAdmin.js
    middleware/errorHandler.js
    routes/auth.js
    routes/products.js
    routes/movements.js
    routes/users.js
    services/withTransaction.js
    services/stock.js
    services/adminMembership.js
    validation/schemas.js
    seed/seed.js
```

`server/` matches decision D1. Placing it beside the frontend, with its own `package.json`, keeps `npm install` for the API separate from Vite. A repo-root `server/` would also satisfy the decision. That location is listed as an open choice in section 15. No server files are created by this plan.

## 3. Required dependencies and their purposes

Install these only in `server/` when implementation is approved. Do not add them to the Vite `package.json`.

| Package | Purpose |
|---|---|
| `express` | HTTP API. |
| `mongoose` | Schemas, queries, and transaction sessions. |
| `bcryptjs` | Password hashes. Pure JavaScript, no native build. |
| `jsonwebtoken` | Sign and verify the session JWT. |
| `helmet` | Baseline response headers. |
| `cors` | Allow the Vite origin with credentials. |
| `dotenv` | Load the local `.env`. |
| `express-rate-limit` | Limit login attempts. |
| `zod` | Request body and query validation. |

Decision D7 also allows test tooling when justified. Recommended later, not in the first install: Node's built-in test runner plus `supertest`. Do not add `mongodb-memory-server` unless it is started as a replica set. A standalone in-memory server cannot prove the transaction behavior this API depends on.

`recharts` stays a frontend decision. It is not part of the API.

## 4. Environment variables and safe configuration practices

`server/.env` is local only. The repository `.gitignore` already ignores `.env` and `.env.*` and does not ignore `.env.example`. Commit `server/.env.example` with empty values and short comments. Never commit a filled `.env`.

Proposed names:

| Name | Purpose |
|---|---|
| `MONGODB_URI` | Development value is the connection string in section 5. |
| `JWT_SECRET` | Long random signing secret. Required outside a local sample. |
| `JWT_EXPIRES_IN` | Example: `8h`. |
| `CLIENT_ORIGIN` | Vite origin allowed by CORS, such as `http://localhost:5173`. |
| `PORT` | API port, separate from MongoDB `27017`. Example `4000`. |
| `NODE_ENV` | `development` or `production`. |
| `SEED_ADMIN_PASSWORD` | Initial password for Admin One. |
| `SEED_EMPLOYEE_PASSWORD` | Initial password for User One. |
| `BCRYPT_COST` | Optional. Default 12. |

`config/env.js` refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing. The seed script refuses to run if either seed password is missing. The seed script must not import `src/data/starterData.js`, because that module contains plaintext passwords.

Cookie `Secure` is on when `NODE_ENV` is `production`. Development on `http://localhost` leaves `Secure` off so the browser will store the cookie.

## 5. MongoDB connection strategy

Connect with Mongoose using:

```text
mongodb://127.0.0.1:27017/baore_cosmetics?replicaSet=rs0
```

The database name is `baore_cosmetics`. The `replicaSet=rs0` parameter is required. Without it, the driver talks to a standalone node and multi-document transactions fail.

Connection rules:

- Read the URI from `MONGODB_URI`. Do not hardcode a second production URI in source.
- Connect once at process start. Fail startup if the connection fails.
- Do not disable transactions when the connection fails. There is no non-transactional stock path.
- Keep the service on `127.0.0.1` during development. Authentication is currently disabled. Turn on MongoDB authentication before any non-localhost exposure. That is an operations step, not an application fallback.
- Use a different database name, `baore_cosmetics_test`, for automated tests so tests do not wipe development data.

## 6. Proposed Mongoose schemas and indexes

Collection names stay `users`, `products`, and `stockMovements`. One extra single-document collection, `adminGuards`, exists only to serialize admin-membership changes. It is not a business collection from the older setup notes. It is the concurrency mechanism in section 10.

### `users`

| Field | Rule |
|---|---|
| `name` | Required, trimmed string. |
| `email` | Required. Stored lowercase. Unique. |
| `username` | Required. Stored lowercase. Unique. |
| `passwordHash` | Required. Never selected by default. Never returned by the API. |
| `role` | `admin` or `user` only. |
| `createdAt` | Set on create. |

Indexes: unique `username`, unique `email`. Storing both values in a normalized case makes the unique index match the current case-insensitive checks. A case-sensitive index would allow `Admin` and `admin` as two accounts.

There is no plaintext `password` field.

### `products`

| Field | Rule |
|---|---|
| `name` | Required, trimmed. |
| `category` | One of Face, Eyes, Lips, Cheeks, Tools & Brushes, Skincare. |
| `sku` | Required. Stored uppercase. Unique. |
| `brand` | String. Default `Ba'Oré`. |
| `shade` | String. May be empty. |
| `quantity` | Integer, minimum 0. |
| `price` | Number, minimum 0, at most two decimal places. |
| `createdAt`, `updatedAt` | Decision D5. `updatedAt` changes on edit and on stock movement. |

Do not store `status`. The API derives it: quantity `0` is out of stock, `1` through `5` is low stock, above `5` is in stock. The threshold stays `5`.

Index: unique `sku`.

Price is stored in pesos, matching the seed file and `docs/mongodb-setup.md`. The validator rejects values with more than two decimal places. Binary floating point can still represent some decimal values poorly. An integer-centavo column would avoid that, but it would change the field shape those documents already describe. That alternative is an open choice in section 15, not a silent schema change.

### `stockMovements`

| Field | Rule |
|---|---|
| `productId` | ObjectId of the product at the time of the movement. Not a cascading delete. Remains after the product is hard-deleted. |
| `productName` | Snapshot. Decision D3 and D5. |
| `sku` | Snapshot. |
| `userId` | Account that recorded it. |
| `type` | `restock`, `sale`, `adjustment`, `return`, `stock_in`, or `stock_out`. |
| `quantity` | Integer greater than 0. |
| `direction` | `in` or `out`, required only for `adjustment`. Absent for other types. |
| `note` | Optional trimmed string. Opening stock uses `Opening stock`. |
| `quantityBefore` | Integer. Decision D5. |
| `quantityAfter` | Integer, minimum 0. |
| `createdAt` | Set when the movement is inserted. |

Indexes: `createdAt` descending, `userId` + `createdAt`, `productId` + `createdAt`.

Delta rules match `src/lib/stock.js`: `sale` and `stock_out` subtract; `restock`, `return`, and `stock_in` add; `adjustment` follows `direction`.

### `adminGuards`

One document:

```text
{ _id: "admin-membership", revision: 0 }
```

The seed script creates it if it is missing. Every transaction that can remove an admin role increments `revision`.

## 7. Authentication and authorization design

Decision D8: the session is a JWT in an httpOnly cookie.

- `POST /api/auth/login` checks the username and password hash. On success it sets cookie `baore_token`.
- Cookie flags: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` in production. The JavaScript app cannot read the token.
- The JWT subject is the user id. Expiry comes from `JWT_EXPIRES_IN`.
- `requireAuth` verifies the cookie, loads the user from MongoDB, and rejects a missing or inactive user. Role is taken from the database document on each request so a role change is not stuck inside an old token.
- `requireAdmin` allows only `role === "admin"`.
- `POST /api/auth/logout` clears the cookie.
- `GET /api/auth/me` returns id, name, email, username, and role. It does not return `passwordHash`.
- Login failures use one message for unknown user and bad password.
- Login is rate-limited.

The browser routes stay as they are until a later frontend cutover. Server checks are the authority. A user who can call the API directly must still be rejected from admin operations.

Role value stored in MongoDB remains `user`. The API does not rename it to `employee`. The Employee label is a frontend display change and is not part of the first server stages.

## 8. API endpoint plan

JSON only. Errors use the shape in section 11. List responses wrap the public records, `{ "products": [...] }` and `{ "movements": [...] }`. Nothing returns `passwordHash`.

### Auth

| Method and path | Who | Responsibility |
|---|---|---|
| `POST /api/auth/login` | Public | Body: `username`, `password`. Sets the cookie. Returns the public user. |
| `POST /api/auth/logout` | Signed in | Clears the cookie. |
| `GET /api/auth/me` | Signed in | Returns the current public user. |

### Products

| Method and path | Who | Responsibility |
|---|---|---|
| `GET /api/products` | Signed in | Query: `search`, `category`. Both roles can read the catalogue. Response includes derived `stockStatus`. |
| `POST /api/products` | Admin | Creates a product. Quantity is a nonnegative integer. If quantity is greater than 0, the same transaction writes the `restock` movement with note `Opening stock`, `quantityBefore` 0, and `quantityAfter` equal to the created quantity. |
| `PATCH /api/products/:id` | Admin | Updates name, category, SKU, brand, shade, and price. A body containing `quantity` is rejected with 400, so a client cannot believe a quantity change was saved. Decision D4. (Changed in Phase 3D.1; the original plan ignored the field.) |
| `DELETE /api/products/:id` | Admin | Hard-deletes the product. Does not delete movements. Snapshots keep the history readable. |

### Movements

| Method and path | Who | Responsibility |
|---|---|---|
| `GET /api/movements` | Admin | All movements, newest first, with snapshots. Response `{ "movements": [...] }`. |
| `GET /api/movements/mine` | Signed in | Movements whose `userId` is the caller. Same response shape. |
| `POST /api/movements` | Signed in | Body: `productId`, `type`, `quantity`, optional `note`, and `direction` for adjustments. Admin may send `restock`, `sale`, `adjustment`, `return`. A user may send only `stock_in` and `stock_out`. Success is `201` `{ "movement": movement }`. The handler runs the transaction in section 9. |

### Users

| Method and path | Who | Responsibility |
|---|---|---|
| `GET /api/users` | Admin | Public account fields. |
| `POST /api/users` | Admin | Creates an account with a hashed password and role `admin` or `user`. |
| `DELETE /api/users/:id` | Admin | Refuses the caller's own id. Runs the admin-membership transaction in section 10. |

No account-edit route is included yet. The current UI has none. A future role-change route must use the same guard. Section 10 specifies that so the protection exists before the screen does.

Dashboard totals, inventory value, and the low-stock list can stay derived in the client from `GET /api/products` and the movement lists. A separate statistics route is not required to replace the current pages.

## 9. Transaction strategy for product creation and stock movements

Use one helper around every stock write. Phase 3D.1 added it as `runTransaction` in `server/src/services/transaction.js`. It retries a transient transaction error a small fixed number of times, then returns 503, and it never repeats the work without a session. The steps are:

1. `startSession()`
2. `startTransaction()`
3. Run `work(session)` and pass that session into every `find`, `update`, `insert`, and `delete`
4. `commitTransaction()` on success
5. `abortTransaction()` on any failure
6. `endSession()` in `finally`

If the transaction cannot start, or it aborts, the request fails. The helper must not catch the error and repeat the work without a session.

### Stock movement

Inside the transaction:

1. Load the product with the session. If it is missing, abort with 404.
2. Reject a type the caller's role cannot use.
3. Compute `delta` with the same rules as `movementDelta`.
4. For a negative delta, conditional update:

```text
findOneAndUpdate(
  { _id, quantity: { $gte: amount } },
  { $inc: { quantity: delta } },
  { session, returnDocument: "before" }
)
```

5. For a positive delta, the filter is only `{ _id }` and the update is `$inc`.
6. If the conditional update returns null, abort with 409. Do not insert a movement. This is what stops a negative quantity when two stock-out requests race: only one update can match `quantity >= amount` for the last units.
7. Insert the movement with `quantityBefore` from the returned document, `quantityAfter = quantityBefore + delta`, and copies of `productName` and `sku`.
8. Commit.

The movement insert and the quantity update share the session, so a failed insert rolls the quantity back.

### Product creation

Inside one transaction:

1. Insert the product with the validated quantity.
2. If that quantity is greater than 0, insert one movement: type `restock`, note `Opening stock`, `quantityBefore` 0, `quantityAfter` equal to the quantity, snapshots filled from the new product, `userId` the admin.
3. If the movement insert fails, the product insert rolls back.
4. Quantity 0 creates the product and no movement. Decision D12 only requires the movement when quantity is greater than 0.

### Product edit and delete

Edit does not change quantity and does not need a stock transaction. Delete is a single-document hard delete. Movements are left in place. Do not wrap delete in a transaction that also deletes movements.

## 10. Safe last-admin protection under concurrent requests

### Why a count-then-delete check is not enough

MongoDB multi-document transactions use snapshot isolation. Two transactions conflict only when they write the same document.

This pair can both commit:

1. Transaction A reads two admins, then deletes admin A.
2. Transaction B reads two admins, then deletes admin B.
3. Each delete writes a different user document, so there is no write conflict.
4. Both commit. The store has zero admins.

The same hole exists if one transaction deletes an admin and another changes the other admin's role to `user`. Putting the count and the delete in separate transactions is worse. Putting them in one transaction still fails if the two transactions never write a shared document.

The current UI hides the last admin's remove button and blocks self-removal. That does not cover two admins acting at the same time, and it does not cover a future role-change request.

### Serialization strategy

Keep a single `adminGuards` document, `_id: "admin-membership"`.

Every operation that might remove the last admin acquires that document inside the transaction before it reads or writes users:

1. `updateOne({ _id: "admin-membership" }, { $inc: { revision: 1 } }, { session })`
2. Load the target user with the session.
3. Apply the delete or the role change with the session.
4. `countDocuments({ role: "admin" })` with the session.
5. If the count is less than 1, abort with 409 and do not commit.
6. Otherwise commit.

The increment is the shared write. The second transaction receives a write conflict and must abort. The API retries only that whole transaction when MongoDB reports a transient transaction error or a write conflict. The retry then sees the committed result and the count check rejects a change that would leave zero admins.

Rules for the operation itself:

- The caller cannot delete their own account, even when other admins exist.
- Deleting a non-admin does not reduce the admin count, but it still takes the guard. Otherwise a role change and a delete of the same user can pass each other.
- A role change from `admin` to `user` uses the same function. Creating another admin, or changing a user to admin, also takes the guard so membership changes stay in one queue.
- Do not cache the admin count in application memory.
- Do not skip the guard when the first count already shows more than one admin.
- A failed transaction is a failed request. It is not retried as a plain `deleteOne` outside a session.

Self-removal is rejected before the transaction. The guard still runs for every other membership change.

## 11. Validation and error-handling strategy

Zod parses every body and query before a handler talks to MongoDB.

Shared rules:

- Product quantity and movement quantity are nonnegative integers. Reject decimals and exponent strings. This is stricter than the current product form, which accepts `1.5` and `1e3`. A movement quantity is stricter still: the StockMovement schema requires an integer greater than 0, so zero is rejected.
- Price is at least 0 and has at most two decimal places.
- Category is one of the six fixed names.
- SKU is trimmed. The server stores it uppercase.
- Email must contain `@` and is stored lowercase. Username is trimmed and stored lowercase.
- Password is required and is not trimmed, matching the current login comparison, until a later decision says otherwise.
- Role is `admin` or `user`.

HTTP mapping:

| Status | When |
|---|---|
| 400 | Zod failure, bad movement type, or `quantity` in a product edit. Bodies are strict, so an unknown or forbidden field rejects the whole request instead of being dropped. |
| 401 | Missing or invalid cookie. |
| 403 | Signed in, wrong role, or removing the signed-in account. |
| 404 | Missing product or user. |
| 409 | Duplicate SKU, username, or email. Insufficient stock. Last-admin rejection. |
| 503 | Transaction retries exhausted after write conflicts. |
| 500 | Unexpected failure. Response body does not include the stack or the URI. |

Duplicate-key errors from MongoDB become 409. They are the backstop behind the pre-checks.

The central error middleware is the only place that sends these responses. Handlers throw typed errors.

## 12. Security considerations

- Hash passwords with bcrypt. Cost defaults to 12. Never log the password or the hash.
- Do not return `passwordHash` from any serializer.
- The cookie is httpOnly so the existing localStorage session cannot be copied into the token later by page scripts.
- Helmet sets the usual headers. CORS allows only `CLIENT_ORIGIN` and `credentials: true`.
- Rate-limit `POST /api/auth/login`.
- Bind the development listener to localhost.
- MongoDB has no authentication today and is on localhost. Do not deploy this URI. Enable database users before the process is reachable from another machine.
- `.env` stays untracked. Seed passwords exist only in the environment.
- The frontend still contains plaintext seed passwords and still trusts `localStorage` until the cutover stage. That is unchanged by building the server. It remains a risk until the UI stops being the authority.
- Generic login errors avoid telling an attacker which field was wrong.
- ObjectIds are validated before queries so a bad id is 400, not a cast exception page.

## 13. Testing strategy

No test package is added until the transaction paths exist and the tool is justified.

The useful tests need a replica set. Use the local `rs0` and database `baore_cosmetics_test`. Each test cleans only that database.

Cases to cover first:

- Login sets an httpOnly cookie and does not return the hash. A wrong password returns 401.
- A user token receives 403 on product create, product delete, account create, and `GET /api/movements`.
- Product create with quantity greater than 0 writes one product and one `Opening stock` movement. Forcing the movement insert to fail leaves no product.
- Product create with quantity 0 writes no movement.
- Product edit rejects quantity and leaves the stored quantity unchanged.
- Two concurrent stock-outs of the last unit: one 200, one 409, final quantity 0, one movement.
- A movement that would go below zero does not insert a movement.
- Product delete removes the product and leaves the movement snapshots.
- Two concurrent deletions of two different admins: one 200, one 409, one admin remains.
- A delete racing a role change from `admin` to `user` cannot leave zero admins.
- A user cannot delete their own account.
- Missing `MONGODB_URI` or seed passwords prevents start and seed. This can be a unit check of `config/env.js` without the database.

`supertest` against `app.js`, with `withTransaction` pointed at the test database, is enough. Do not mock Mongoose for the concurrency cases. A mock would hide write conflicts.

## 14. Proposed implementation stages

Each stage is reviewable on its own. Do not start a stage until the previous one is accepted. Do not switch the React app off localStorage during stages 1 through 8.

1. Create `server/package.json`, `.env.example`, env loading, and a localhost listener with `GET /api/health`. Connect to `baore_cosmetics` and fail if the replica set connection fails.
2. Add the four models and indexes. Seed the `admin-membership` guard document with an idempotent command. Do not seed users yet.
3. Add Zod schemas and the error middleware.
4. Add password hashing, login, logout, `me`, the cookie, and the auth middleware.
5. Add read routes for products, movements, and users.
6. Add product create, edit, and delete, including the opening-stock transaction.
7. Add movement create with the conditional quantity update and the no-fallback rule.
8. Add account create and delete through the admin-membership guard.
9. Add `seed.js`. Products come from the eight catalogue rows, without the JSON `status` field. The two accounts are Admin One and User One. Passwords come only from `SEED_ADMIN_PASSWORD` and `SEED_EMPLOYEE_PASSWORD`.
10. Add the transaction tests from section 13 against `baore_cosmetics_test`.
11. Frontend cutover is a separate approval. It would replace `AppState` persistence with credentialed `fetch`, stop writing the four localStorage keys, and only then change Employee labeling, centavo formatting, and the Out of Stock card. That work is not part of standing up the server. Phase 3D.3 switched products and movements to the API. Accounts had already left `localStorage` in Phase 3C.4. Employee labeling, centavo display, and the separate Out of Stock card were not part of that switch.

## 15. Potential risks, dependencies, and unresolved decisions

Documented here so they are not silently "fixed" in code.

| Topic | What the files say | What this plan does |
|---|---|---|
| Older MongoDB doc | `docs/mongodb-setup.md` omits D5 snapshot and timestamp fields. | Follow `docs/DECISIONS.md`. Leave the setup doc unchanged until a docs pass is requested. |
| Stale project plan | `docs/mern-project-plan.md` still describes a categories collection and a configurable threshold. | No categories collection. Threshold stays 5. |
| Money display | Frontend `money()` rounds to whole pesos. D9 requires centavos. | API stores two-decimal pesos. Display stays unchanged until stage 11. |
| Out of Stock card | D11 asks for a separate card. The dashboard list still treats `quantity <= 5` as the low-stock group, while `stockStatus()` already labels 0 as out of stock. | API returns derived status. The card is stage 11. |
| Employee label | D6. `roleLabel()` still returns "User". | Database value stays `user`. Label change is stage 11. |
| Product quantity | The current form accepts decimals. The approved server rule is nonnegative whole numbers. | API rejects non-integers. The form is not changed in this plan. |
| Price storage | Seed data and the setup doc use a peso number. Centavo integers avoid float error. | Keep a peso `price` field unless review chooses centavo storage. |
| `server/` location | D1 says `server/` in this repository. | Proposed path is inside `StockEase-React-Frontend/server/` with its own package. A git-root `server/` is the alternative. |
| Account edit | No UI and no approved field list for editing an account after create. | No edit endpoint until a decision names the fields. Role change, when added, must use section 10. |
| Password trimming | Current login does not trim passwords. | Server keeps that comparison until a decision says otherwise. |
| Frontend secrets | `starterData.js` still contains plaintext seed passwords. | The seed script must not import that file. Removing the passwords from the frontend is part of cutover, not this plan. |
| MongoDB auth | Development server has authentication disabled. | Accepted for localhost only. Must change before any other exposure. |
| Tests need `rs0` | An in-memory standalone node cannot run these transactions. | Tests use the existing local replica set and a separate database name. |
| Write-conflict retries | A bounded retry is not a non-transactional fallback. | Retry the same transaction a small fixed number of times, then return 503. |

No application code, dependencies, or database contents are changed by the creation of this plan.
