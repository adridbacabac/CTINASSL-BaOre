# Ba'Oré Inventory — Decision Log

Approved decisions. These are recorded as specified and are not implemented by this document.

| # | Decision |
|---|---|
| D1 | No backend existed at the start. Build `server/` using Express and Mongoose in this repository. |
| D2 | MongoDB multi-document transactions keep product quantity updates and their stock movement records consistent. Details are in “D2 — MongoDB transactions for inventory consistency” below. |
| D3 | Product deletion is a hard delete. Each movement stores `productName` and `sku` snapshots so history survives. |
| D4 | Product quantity is read-only in Edit Product. Stock changes happen only through stock movements. |
| D5 | Add product `createdAt` and `updatedAt`; add movement `quantityBefore`, `quantityAfter`, `productName`, and `sku`. |
| D6 | Database role value remains `user`. The UI label is Employee. |
| D7 | Frontend dependencies include `react-router-dom` and `recharts`. Backend dependencies include `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `helmet`, `cors`, `dotenv`, `express-rate-limit`, and `zod`. Add test tooling when justified. |
| D8 | Authentication uses a JWT stored in an httpOnly cookie. |
| D9 | Prices allow up to two decimal places and display with centavos. |
| D10 | Retire documented starter passwords. The seed script reads initial passwords from `.env`. Never commit real credentials. |
| D11 | Quantity zero means out of stock. Low stock means 1–5. The dashboard has a separate Out of Stock card. |
| D12 | Creating a product with quantity greater than zero creates a `restock` movement with note `Opening stock` as part of the same atomic operation. |
| D13 | Do not migrate browser localStorage data. The database starts from seed products and starter accounts. |
| D14 | `dist/` is generated build output and must remain untracked. `.env` must be Git-ignored. |

Fixed rules:

- Low-stock threshold: 5, not configurable.
- Categories: Face, Eyes, Lips, Cheeks, Tools & Brushes, Skincare.
- Last-admin protection must be enforced on the server, including concurrent deletion and future role changes.

## D2 — MongoDB transactions for inventory consistency

- Use MongoDB multi-document transactions for operations that modify product quantities and create stock movement records.
- The local MongoDB Community Server runs as a single-node replica set named `rs0`.
- The replica set member is `127.0.0.1:27017`.
- Transactions must ensure that product quantity updates and their corresponding stock movement records either both commit or both roll back.
- Use conditional stock updates to prevent negative inventory and protect against concurrent stock changes.
- Product creation with opening stock must also save the product and its opening-stock movement consistently within a transaction.
- Do not silently fall back to non-transactional stock updates if a transaction fails.
- Transaction sessions must be passed to all relevant Mongoose operations.
- Always commit, abort when appropriate, and end transaction sessions safely.

## MongoDB development configuration

- MongoDB Community Server 8.3.7.
- Local connection: `mongodb://127.0.0.1:27017/baore_cosmetics?replicaSet=rs0`
- Replica set: `rs0`.
- Transactions enabled and verified using a successful rollback test.
- The MongoDB service currently has authentication disabled.
- MongoDB is bound to `127.0.0.1` and should remain local-only during development.
- Database authentication must be configured before any deployment or exposure beyond localhost.
- Never commit database credentials or `.env` files.
