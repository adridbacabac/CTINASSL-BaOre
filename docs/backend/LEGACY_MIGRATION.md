# Legacy sample migration

This is a one-time preparation for the three sample documents already stored in `baore_cosmetics`. It is not part of server startup or `npm run seed`.

## Why it is needed

The sample documents were inserted from the setup notes with the literal string `ObjectId` as their identifiers. The Mongoose schemas expect real ObjectIds. Loading those documents drops `_id`, and the movement's `productId` and `userId` cannot be populated.

The movement also has no `quantityBefore`, `quantityAfter`, `productName`, or `sku` snapshots. The product has no `createdAt` or `updatedAt`. Decision D5 requires those fields on records the application will use.

The administrator's `passwordHash` is the placeholder `hashed_value`, which is not a bcrypt hash. Replacing that hash is a separate explicit repair. Ordinary seed runs already refuse to change it.

## Approved historical sale

The existing product quantity stays 28. The existing movement is a sale of 2 units. The approved reading of that history is:

- `quantityBefore`: 30
- `quantityAfter`: 28
- `productName`: Velvet Matte Lipstick
- `sku`: LIP-001

The migration does not change the stored quantity and does not add another movement.

## Records affected

Exactly these three documents, and no others:

| Collection | Identity | What changes |
|---|---|---|
| `users` | Admin One, `admin`, `admin@baore.com`, role `admin` | `_id` becomes a new ObjectId. Profile, placeholder password hash, and created-at instant stay. |
| `products` | Velvet Matte Lipstick, `LIP-001`, quantity 28, price 399 | `_id` becomes a new ObjectId. Catalogue fields and quantity stay. `createdAt` and `updatedAt` become `2026-11-20T00:00:00.000Z`, the timestamp already stored on the administrator and the sale. The product itself has no timestamp. |
| `stockMovements` | sale of 2, note `Counter sale` | `_id` becomes a new ObjectId. `productId` and `userId` point at the replacement documents. Type, quantity, note, and original instant stay. Snapshots are set to the approved 30 → 28 values. |

The string `ObjectId` values currently link the sale to the administrator and the product only because all four identifiers are that same placeholder. The replacement documents keep that relationship with the new ObjectIds.

## Commands

From `server/`:

```text
npm run migrate:legacy
npm run migrate:legacy -- --execute
npm run repair:admin
npm run repair:admin -- --execute
```

The default command is a dry-run. It reads the database, checks the replica set, validates the legacy documents, and checks that the replacement documents satisfy the schemas. It does not write.

`--execute` is the only switch that opens the write transaction. Do not add it until the dry-run has been reviewed and a backup has been taken.

The repair command reads `REPAIR_ADMIN_PASSWORD` only when `--execute` is present. It does not read `SEED_ADMIN_PASSWORD` or `SEED_EMPLOYEE_PASSWORD`. Set the variable in the environment for that command. Do not commit it.

Run the migration first. The repair refuses while the administrator still has the legacy string id, and it refuses if the hash is already bcrypt. After migration, it updates only the replacement administrator whose hash is still `hashed_value`.

## Transaction and rollback

Both operations use one MongoDB transaction on replica set `rs0`. Every read and write in the operation uses that session. There is no non-transactional fallback.

If validation, insertion, reference checks, or deletion do not match the expected result, the transaction aborts. Uncommitted inserts and deletes disappear. The original three documents remain.

The password repair hashes the supplied password, checks it with `bcrypt.compare`, updates only `passwordHash`, and checks the hash and profile again before commit. A failed check aborts the transaction, so the placeholder hash remains. The password and hash are not logged.

After a migration commits, this tool does not contain a reverse migration. Take a backup before `--execute`. Recovery from a committed migration is restoring that backup. The tool never drops a collection, never deletes an index, and never clears the database.

The migration refuses to run unless the database is still exactly the three legacy sample documents. A second execution finds the replacement records instead and stops without writing.
