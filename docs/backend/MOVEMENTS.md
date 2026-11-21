# Stock Movement API

Stock changes go through this API. Creating or editing a product cannot set quantity except for the opening quantity on create, which writes its own `Opening stock` movement. The React app still keeps movements in `localStorage` (`baore-movements`) and does not call these routes yet.

## Access

Every route uses `requireAuth(env)`. A missing or invalid session returns `401` with `Authentication required.`

| Method and path | Who |
|---|---|
| `GET /api/movements` | Admin. An Employee receives `403` with `You do not have access to this action.` |
| `GET /api/movements/mine` | Admin and Employee. Returns movements recorded by the caller. |
| `POST /api/movements` | Admin and Employee, for the types allowed to that role. |

The role is the database role loaded for the request.

## Endpoints

Errors use `{ "error": "..." }`. Lists use the same envelope as products.

| Method and path | Body | Success |
|---|---|---|
| `GET /api/movements` | None | `200` `{ "movements": [movement, ...] }`, newest first |
| `GET /api/movements/mine` | None | `200` `{ "movements": [movement, ...] }`, newest first |
| `POST /api/movements` | `productId`, `type`, `quantity`, optional `note`, and `direction` for an adjustment | `201` `{ "movement": movement }` |

A movement looks like:

```json
{
  "id": "…",
  "productId": "…",
  "productName": "Velvet Matte Lipstick",
  "sku": "LIP-001",
  "userId": "…",
  "type": "sale",
  "quantity": 2,
  "note": "Counter sale",
  "quantityBefore": 10,
  "quantityAfter": 8,
  "createdAt": "2026-11-21T00:00:00.000Z"
}
```

`direction` is present only for an adjustment, and is `in` or `out`. `note` is present only when one was saved. `userId` is the account that recorded the movement. The response does not include a password hash or the product's other fields.

## Movement types

The quantity effect matches `src/lib/stock.js`. The server keeps its own copy of that rule.

| Type | Who may record it | Effect |
|---|---|---|
| `restock` | Admin | Adds `quantity` |
| `sale` | Admin | Subtracts `quantity` |
| `return` | Admin | Adds `quantity` |
| `adjustment` | Admin | Adds when `direction` is `in`, subtracts when `direction` is `out` |
| `stock_in` | Employee | Adds `quantity` |
| `stock_out` | Employee | Subtracts `quantity` |

An admin sending `stock_in` or `stock_out`, or an Employee sending an admin type, returns `403` with `You do not have access to this action.` The product quantity is not changed. A type outside this list returns `400`.

## Validation

The body is a strict Zod object. Unknown fields, including a client-supplied `quantityAfter`, return `400` with `Invalid request.` Malformed JSON returns the same response.

| Field | Rule |
|---|---|
| `productId` | Required string. A value that is not a 24-character hex id returns `400` with `Invalid product id.` A well-formed id for a missing product returns `404` with `Product not found.` |
| `type` | One of the six types above. |
| `quantity` | A JSON whole number greater than 0, up to the safe-integer limit. Zero, negatives, decimals, and numeric strings are rejected. The StockMovement schema already requires a positive integer, which is stricter than the shared "nonnegative" wording in the plan. |
| `direction` | Required for `adjustment`, and must be `in` or `out`. Rejected for every other type. |
| `note` | Optional text. Trimmed. An empty note is not stored. |

There is no documented maximum length for a note, so this API does not add one. Express's JSON body limit still applies.

## Transaction

`POST /api/movements` runs in `runTransaction` (`server/src/services/transaction.js`). There is no write outside the transaction.

1. Load the product in the session. Missing means `404`.
2. Reject a type the caller's role cannot use.
3. Compute the delta.
4. For a negative delta, update the product only when `quantity` is at least the requested amount: `$inc` by the delta, and read the document from before the update.
5. For a positive delta, `$inc` with the product id as the only filter.
6. If the negative update matches nothing, abort with `409` `There is not enough stock for that movement.` No movement is inserted.
7. Insert the movement with `quantityBefore` from the pre-update product, `quantityAfter` equal to that plus the delta, and `productName` and `sku` copied from that same product. `userId` is the caller.
8. Commit.

A failed insert aborts the quantity change as well. A transient transaction error reruns the whole transaction up to 5 times, then returns `503`. Two stock-outs of the last units cannot both commit: only one update matches `quantity >= amount`.

The product's `updatedAt` changes with the quantity, per Decision D5.

## History

Movements are not updated when a product is renamed, and they are not deleted when the product is hard-deleted. `productName`, `sku`, `quantityBefore`, and `quantityAfter` stay as they were at recording time. Opening-stock movements created with a product use the same collection and appear in these lists.

## Limitations

- The React app does not call this API yet.
- There is no pagination and no filter by product.
- `GET` responses do not include the account's name. The client can match `userId` to the account list.
- A deleted product's id remains on the movement. Fetching that product returns `404`.
