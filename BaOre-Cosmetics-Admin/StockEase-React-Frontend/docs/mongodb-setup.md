# MongoDB setup for Ba'Oré Inventory

This is the database-only setup step. No backend code is added here.

## 1. Choose your MongoDB environment

### Option A: MongoDB Atlas (recommended for team work)
1. Create a free Atlas account.
2. Create a new project named `baore-cosmetics`.
3. Build a cluster.
4. Create a database user with a username and password.
5. Allow access from your IP address.
6. Copy the connection string.

### Option B: Local MongoDB installation
1. Install MongoDB Community Edition.
2. Start the local MongoDB service.
3. Connect to MongoDB using the shell or Compass.

## 2. Database name
Use this database name for the project:

```text
baore_cosmetics
```

## 3. Collections to create
Create these collections in MongoDB:

- `products`
- `categories`
- `stockMovements`
- `users` (for future admin/user roles)

## 4. Product schema
The product collection should store inventory data like this:

```json
{
  "_id": "ObjectId",
  "name": "Velvet Matte Lipstick",
  "category": "Lips",
  "sku": "LIP-001",
  "brand": "Ba'Oré",
  "shade": "Rosewood",
  "quantity": 28,
  "price": 399,
  "status": "in_stock",
  "createdAt": "2026-11-13T00:00:00.000Z",
  "updatedAt": "2026-11-13T00:00:00.000Z"
}
```

### Required fields
- `name` - product name
- `category` - group name
- `sku` - unique identifier for stock tracking
- `brand` - seller or brand name
- `shade` - product shade/color name
- `quantity` - current inventory count
- `price` - unit price in PHP
- `status` - can be `in_stock`, `low_stock`, or `out_of_stock`
- `createdAt` - creation time
- `updatedAt` - last update time

## 5. Category schema

```json
{
  "_id": "ObjectId",
  "name": "Lips",
  "description": "Lip products",
  "createdAt": "2026-11-13T00:00:00.000Z"
}
```

## 6. Stock movement schema
Use this for stock changes later:

```json
{
  "_id": "ObjectId",
  "productId": "ObjectId",
  "type": "restock",
  "quantity": 15,
  "note": "New shipment",
  "createdAt": "2026-11-13T00:00:00.000Z"
}
```

## 7. User schema (future admin layer)

```json
{
  "_id": "ObjectId",
  "name": "Store Admin",
  "email": "admin@baore.com",
  "username": "admin",
  "passwordHash": "hashed_value",
  "role": "admin",
  "createdAt": "2026-11-13T00:00:00.000Z"
}
```

## 8. Relationship cardinality
Use the following cardinality logic for the database design:

- `categories` to `products`: one-to-many
  - One category can have many products.
  - Each product belongs to exactly one category.
  - Recommended field: `products.category` stores the category name or category ID.
  - Use a normalized approach: `products.categoryId` as a reference to `categories._id` is the cleaner design.

- `products` to `stockMovements`: one-to-many
  - One product can have many stock movement records.
  - Each stock movement belongs to one product.
  - Recommended field: `stockMovements.productId` references `products._id`.

- `users` to `stockMovements`: one-to-many (optional if tracking who updated stock)
  - One user can create many stock movements.
  - Each movement may be created by one user.
  - Recommended field: `stockMovements.userId` references `users._id`.

- `users` to `products` (for future admin-only workflows): many-to-many if multiple users can manage multiple products
  - In a simple inventory setup, this is usually not required.
  - Most cases keep product ownership under the store, not per-user.

### Recommended cardinality summary
- `Category 1 --- N Product`
- `Product 1 --- N StockMovement`
- `User 1 --- N StockMovement` (optional tracking)
- `User N --- N Product` only if a product-team ownership model is later introduced

## 9. MongoDB validation rules
These rules should be enforced in the backend later:
- `sku` must be unique
- `quantity` cannot be negative
- `price` must be greater than or equal to 0
- `status` should be derived from quantity
- `category` should match an existing category record

## 10. Example Mongo shell commands
Use this in MongoDB shell after connecting to the database:

```javascript
use baore_cosmetics;

db.createCollection("products");
db.createCollection("categories");
db.createCollection("stockMovements");
db.createCollection("users");

db.products.createIndex({ sku: 1 }, { unique: true });
```

## 11. Seed data approach
The frontend currently uses mock product data. For the database step, the data can be imported from the seed JSON file in this folder:

- `docs/baore-seed-data.json`

## 12. Recommended next step
Before the backend is added, confirm the database structure with this checklist:
- product fields are final
- category names are finalized
- SKU uniqueness rule is agreed
- low-stock threshold is set to 5 units
- relationship cardinality is approved

Once this is approved, the backend integration can be done in the next phase without changing the frontend design.
