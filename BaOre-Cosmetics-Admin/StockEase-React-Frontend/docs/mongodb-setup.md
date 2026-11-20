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
The current site keeps three record types. Create these collections in MongoDB:

- `products`
- `stockMovements`
- `users`

Category is a text field on each product. The site does not manage a separate categories collection. The fixed category names are Face, Eyes, Lips, Cheeks, Tools & Brushes, and Skincare.

## 3.1 Roles in the current site
Sign-in uses `username` and `password`. The account `role` decides the screens.

Both roles can:
- open the dashboard (product count, units on hand, low-stock count)
- search and filter the catalogue
- see price, shade, SKU, and stock status
- sign out

Stock status is calculated from quantity, with a low-stock line at 5 units:
- `out_of_stock` when quantity is 0
- `low_stock` when quantity is 1 to 5
- `in_stock` when quantity is above 5

### Admin (`role: "admin"`)
- inventory value on the dashboard and inventory page
- add, edit, and delete products
- stock movements of type `restock`, `sale`, `adjustment`, and `return`
- Activity page for every stock movement and who recorded it
- Team page to add an account and choose `admin` or `user`
- remove another account
- the signed-in admin cannot remove their own account
- the store keeps at least one admin account

### User (`role: "user"`)
- Floor stock page for the same catalogue
- stock movements of type `stock_in` and `stock_out` only
- a personal list of their own recent stock updates
- no inventory value, no product add/edit/delete, no Activity page, and no Team page

Starter accounts in the frontend:
- Admin One, username `admin`, role `admin`
- User One, username `employee`, role `user`

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
  "price": 399
}
```

The site does not save `status`, `createdAt`, or `updatedAt` on the product. Status is calculated from `quantity` when the page renders.

### Required fields
- `name` - product name
- `category` - one of the fixed category names
- `sku` - unique identifier for stock tracking
- `brand` - seller or brand name
- `shade` - product shade/color name
- `quantity` - current inventory count, whole number, zero or higher
- `price` - unit price in PHP, zero or higher

## 5. Stock movement schema
Each sale, return, restock, or adjustment is one record:

```json
{
  "_id": "ObjectId",
  "productId": "ObjectId",
  "userId": "ObjectId",
  "type": "sale",
  "quantity": 2,
  "note": "Counter sale",
  "createdAt": "2026-11-20T00:00:00.000Z"
}
```

### Fields
- `productId` - product that changed
- `userId` - account that recorded the change
- `type` - `restock`, `sale`, `adjustment`, or `return` for an admin; `stock_in` or `stock_out` for a user
- `quantity` - positive whole number of units
- `direction` - only for `adjustment`: `in` adds units, `out` removes units
- `note` - optional text
- `createdAt` - when the movement was saved

`sale` and `stock_out` subtract units. `restock`, `return`, and `stock_in` add units. The resulting product quantity cannot go below zero.

## 6. User schema
Accounts used by the sign-in screen and the Team page:

```json
{
  "_id": "ObjectId",
  "name": "Admin One",
  "email": "admin@baore.com",
  "username": "admin",
  "passwordHash": "hashed_value",
  "role": "admin",
  "createdAt": "2026-11-20T00:00:00.000Z"
}
```

### Fields
- `name` - display name
- `email` - unique email
- `username` - unique sign-in name
- `passwordHash` - store a hash in MongoDB. The current frontend keeps a plain `password` in browser storage until the API exists
- `role` - `admin` or `user`
- `createdAt` - when the account was added

A second starter account is User One, email `user@baore.com`, username `employee`, role `user`.

## 7. Relationship cardinality
Use the following cardinality logic for the database design:

- `products` to `stockMovements`: one-to-many
  - One product can have many stock movement records.
  - Each stock movement belongs to one product.
  - Field: `stockMovements.productId` references `products._id`.

- `users` to `stockMovements`: one-to-many
  - One user can create many stock movements.
  - Each movement is created by one user.
  - Field: `stockMovements.userId` references `users._id`.

Products belong to the store. The site does not assign a product to a particular user.

### Cardinality summary
- `Product 1 --- N StockMovement`
- `User 1 --- N StockMovement`

## 8. Validation rules
These rules match the current site and should be enforced in the backend later:
- `sku` must be unique
- product `quantity` cannot be negative
- `price` must be greater than or equal to 0
- `category` must be one of the fixed category names
- stock status is derived from quantity, using 5 units as the low-stock line
- movement `quantity` must be a whole number greater than 0
- a movement cannot reduce product quantity below 0
- `username` must be unique
- `email` must be unique and contain `@`
- `role` must be `admin` or `user`
- user accounts can record only `stock_in` and `stock_out`
- admin accounts can record `restock`, `sale`, `adjustment`, and `return`

## 9. Example Mongo shell commands
Use this in MongoDB shell after connecting to the database:

```javascript
use baore_cosmetics;

db.createCollection("products");
db.createCollection("stockMovements");
db.createCollection("users");

db.products.createIndex({ sku: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
```

## 10. Seed data approach
The frontend currently uses mock product data in browser storage. For the database step, product data can be imported from the seed JSON file in this folder:

- `docs/baore-seed-data.json`

That file includes a `status` field. The site ignores stored status and calculates it from `quantity`.

User records are created in the app: the two starter accounts, plus any account an admin adds on the Team page.

## 11. Recommended next step
Before the backend is added, confirm this checklist:
- product fields match the inventory form
- category names stay the fixed list used by the site
- SKU, username, and email are unique
- low-stock threshold stays at 5 units
- stock movements store `userId`, `type`, and `quantity`
- admin and user access stay split as described above

Once this is approved, the backend can replace browser storage with API calls without changing the screens.
