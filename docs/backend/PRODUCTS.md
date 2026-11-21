# Product API

The server manages the product catalogue through this API. The React app still reads and writes products in `localStorage` (`baore-items`). Switching the frontend to this API is a later phase.

## Access

Every route uses `requireAuth(env)`. A request without a valid session returns `401` with `Authentication required.`

| Action | Roles |
|---|---|
| List and retrieve | `admin` and `user` (Employee) |
| Create, edit, delete | `admin` only. A `user` receives `403` with `You do not have access to this action.` |

Roles are read from MongoDB on each request.

## Endpoints

All responses are JSON. Errors use `{ "error": "..." }`.

| Method and path | Body or query | Success |
|---|---|---|
| `GET /api/products` | Optional query `search`, `category` | `200` `{ "products": [product, ...] }`, oldest first |
| `GET /api/products/:id` | None | `200` `{ "product": product }` |
| `POST /api/products` | `name`, `category`, `sku`, `price`, optional `brand`, `shade`, `quantity` | `201` `{ "product": product }` |
| `PATCH /api/products/:id` | One or more of `name`, `category`, `sku`, `brand`, `shade`, `price` | `200` `{ "product": product }` |
| `DELETE /api/products/:id` | None | `200` `{ "message": "Product deleted." }` |

A product object has exactly these fields:

```json
{
  "id": "…",
  "name": "Velvet Matte Lipstick",
  "category": "Lips",
  "sku": "LIP-001",
  "brand": "Ba'Oré",
  "shade": "Rosewood",
  "quantity": 28,
  "price": 399,
  "stockStatus": "in_stock",
  "createdAt": "2026-11-21T00:00:00.000Z",
  "updatedAt": "2026-11-21T00:00:00.000Z"
}
```

`stockStatus` is derived and not stored: `out_of_stock` at 0, `low_stock` from 1 to 5, `in_stock` above 5 (Decision D11).

`search` matches name, SKU, category, or shade, case-insensitively, as plain text. `category` must be one of the six categories. Any other query parameter returns `400` with `Invalid request.`

## Validation

Bodies are strict Zod schemas. Unknown fields, malformed JSON, and non-object bodies return `400` with `Invalid request.` Other failures return `400` with the first field message.

| Field | Rule |
|---|---|
| `name` | Required on create. Trimmed, 1 to 120 characters. |
| `category` | Face, Eyes, Lips, Cheeks, Tools & Brushes, or Skincare. |
| `sku` | Required on create. Trimmed and stored uppercase, 1 to 40 characters. Unique. |
| `brand` | Optional text, at most 80 characters. Defaults to `Ba'Oré`. |
| `shade` | Optional text, at most 80 characters. Defaults to empty. |
| `quantity` | Create only. A JSON whole number from 0 up to the safe-integer limit. Defaults to 0. Strings, decimals, and negatives are rejected. |
| `price` | Required on create. A JSON number in pesos, at least 0, with at most two decimal places (Decision D9). |

The numeric checks reuse `server/src/models/validators.js`, the same functions the Mongoose schema uses.

An `:id` that is not a 24-character hex ObjectId returns `400` with `Invalid product id.` An unknown id returns `404` with `Product not found.` A SKU already used by another product, compared after uppercasing, returns `409` with `That SKU is already in use.` The unique `sku_1` index backs that check, and a duplicate-key error maps to the same response.

## Quantity is not editable

`PATCH /api/products/:id` rejects any body that contains `quantity`, even alongside valid fields, with `400` and `Quantity cannot be edited here. Record a stock movement to change it.` Nothing is written. Stock changes go through stock movements, which arrive in Phase 3D.2 (Decision D4).

The original plan said the field would be ignored. Rejecting it was chosen in Phase 3D.1 so a client never believes a quantity change was saved.

## Creation and opening stock

`POST /api/products` runs in one MongoDB transaction (`runTransaction` in `server/src/services/transaction.js`):

1. Check the SKU is free.
2. Insert the product.
3. If `quantity` is greater than 0, insert a `restock` movement with note `Opening stock`, `quantityBefore` 0, `quantityAfter` equal to the quantity, `productName` and `sku` snapshots, and `userId` of the admin (Decision D12).
4. Commit.

Any failure aborts the transaction, so a product is never left without its opening movement. A quantity of 0 inserts no movement. A transient transaction error reruns the whole transaction up to 5 times, then returns `503`. There is no non-transactional fallback.

## Edit and delete

An edit is a single-document `$set` of the validated fields. It changes `updatedAt` and never touches `quantity`. Existing movement snapshots are not rewritten when the name or SKU changes.

Delete is a hard delete of the product only (Decision D3). Stock movements stay, and their `productName`, `sku`, `quantityBefore`, and `quantityAfter` snapshots keep the history readable.

## Limitations

- The frontend still uses `localStorage` for products. Products created through this API do not appear in the UI yet.
- There is no pagination. The catalogue is small.
- Prices are stored as peso numbers, so binary floating point applies. Two-decimal validation limits the effect (see section 15 of `PHASE3_PLAN.md`).
- Stock movement endpoints are Phase 3D.2.
