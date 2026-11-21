# Account Management API

The Team page manages store accounts through this API. MongoDB is the only source of account data. The browser no longer keeps an account list, and `baore-users` is removed from `localStorage` when the app loads.

## Access

Every route below uses `requireAuth(env)` and then `requireAdmin`. A request without a valid session returns `401` with `Authentication required.` A signed-in Employee (database role `user`) returns `403` with `You do not have access to this action.` The role is read from MongoDB on each request.

## Endpoints

All responses are JSON. Errors use `{ "error": "..." }`. No response includes `passwordHash`, a password, or a JWT.

| Method and path | Body | Success |
|---|---|---|
| `GET /api/users` | None | `200` `{ "users": [account, ...] }`, oldest first |
| `POST /api/users` | `name`, `username`, `email`, `password`, `role` | `201` `{ "user": account }` |
| `PATCH /api/users/:id` | One or more of `name`, `username`, `email`, `role` | `200` `{ "user": account }` |
| `PATCH /api/users/:id/password` | `password` | `200` `{ "user": account, "message": "..." }` |
| `DELETE /api/users/:id` | None | `200` `{ "message": "Account deleted." }` |

An account object has exactly these fields:

```json
{
  "id": "…",
  "name": "User One",
  "username": "employee",
  "email": "user@baore.com",
  "role": "user",
  "createdAt": "2026-11-21T08:00:00.000Z"
}
```

## Validation

Bodies are parsed with strict Zod schemas before any database call. Unknown fields, including `passwordHash` and `password` on the details route, return `400` with `Invalid request.` Malformed JSON returns the same response. Other validation failures return `400` with the first field message.

| Field | Rule |
|---|---|
| `name` | Trimmed, 1 to 100 characters |
| `username` | Trimmed and lowercased, 3 to 40 characters of `a-z`, `0-9`, `.`, `_`, `-` |
| `email` | Trimmed and lowercased, at most 254 characters, `name@domain.tld` shape |
| `password` | 8 characters or more and at most 72 UTF-8 bytes. Not trimmed. |
| `role` | `admin` or `user`. There is no `employee` role. |

`PATCH /api/users/:id` needs at least one field. An `:id` that is not a 24-character hex ObjectId returns `400` with `Invalid account id.` An unknown id returns `404` with `Account not found.`

Username and email must be unique. A clash returns `409` with `That username is already in use.` or `That email is already in use.` The unique indexes `username_1` and `email_1` back this check, and a duplicate-key error from MongoDB maps to the same responses.

Passwords are hashed with bcryptjs using `BCRYPT_COST` from `server/.env`, an integer from 4 to 31, defaulting to 12. Updating details never touches `passwordHash`.

## Administrator protection

Creating, updating, and deleting accounts all run in `runAdminMembershipChange` (`server/src/services/adminMembership.js`). Each call is one MongoDB transaction:

1. Increment `revision` on the `adminGuards` document `admin-membership`.
2. Check that the caller is still an admin.
3. Load and change the target account.
4. Count accounts with role `admin` in the same transaction.
5. If the count is below 1, abort with `409` `Keep at least one administrator account.` Otherwise commit.

Step 1 is a write every membership change shares. Two concurrent changes therefore cannot both commit from the same snapshot. MongoDB aborts one with a transient write conflict, and the API reruns the whole transaction, at most 8 times with a short delay. The rerun sees the committed change, so its count check is accurate. If the retries run out, the request returns `503` with `Another account change was in progress. Try again.` There is no fallback to a write outside a transaction.

If the guard document is missing, the request stops with `503` and the server logs the problem. The API does not create the guard.

The caller cannot delete their own account (`403` `You cannot delete your own account.`) or change their own role away from admin (`403` `You cannot remove your own administrator access.`). These checks run before the transaction. The id is compared in lowercase.

## Password reset

`PATCH /api/users/:id/password` stores a new bcrypt hash and increments the account's `sessionVersion`. Session tokens carry that version in the `sv` claim, and `requireAuth` rejects a token whose version no longer matches the database. Every existing session for that account ends on its next request with `401`.

When an admin resets their own password, the response sets a new cookie for the current browser, so that session continues. Other sessions for the same account end.

Tokens issued before this change have no `sv` claim and match accounts with no `sessionVersion`. Both count as version 0, so existing sessions keep working until a reset.

Changing a role or deleting an account also applies on the next request, because `requireAuth` reloads the account from MongoDB each time.

## Frontend

`src/lib/api.js` adds `listAccountsRequest`, `createAccountRequest`, `updateAccountRequest`, `resetAccountPasswordRequest`, and `deleteAccountRequest`. All send `credentials: "include"`. `src/lib/accounts.js` holds form validation, payload building, and the self and last-admin checks the UI uses to explain a blocked action. The server enforces the same rules independently.

The Team page loads accounts only for an admin session. A `401` from an account call signs the browser out. A `403` re-checks the session, so a demoted admin loses Team access at once.

## Limitations

- Password reset is the only action that ends existing sessions early. A deleted or demoted account loses access on its next request, but a reset is needed to cut off a stolen cookie for an account that keeps its role.
- Every account write waits on the guard document, not only admin changes. This keeps the rules in one place and is not a concern at store scale.
- Stock movements still live in browser storage. Movements recorded with the old browser ids `admin-1` and `user-1` are shown under the `admin` and `employee` usernames. Movements from other browser-only accounts show `Unknown`.
- There is no self-service password change and no email verification.
