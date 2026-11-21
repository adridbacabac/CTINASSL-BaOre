# Ba'Oré Inventory App - MERN Plan

## Project goal
This project is being built in phases so the frontend can be finalized first, then data persistence, API work, and final integration can be layered on top.

## Phase order
1. Frontend foundation
   - Inventory dashboard UI
   - Product table and stock monitoring
   - Search, filters, low-stock indicators
   - Add, edit, delete product actions
   - Local persistence for early testing

2. Database design
   - Define MongoDB collections and schema
   - Validate required product fields
   - Plan for stock movement tracking

3. Backend API
   - Express server
   - CRUD routes for products
   - Validation and error handling
   - MongoDB connection using Mongoose

4. Integration
   - Connect frontend to backend API
   - Replace localStorage with real database data
   - Final QA and deployment setup

## Frontend features to keep
- Purple luxury aesthetic matching the Ba'Oré brand
- Sidebar navigation and clean admin dashboard layout
- Inventory overview cards
- Product catalog list with search/filter controls
- Product add, edit, and delete operations
- Low-stock alerts
- Inventory value summary
- Database preview area for future backend connection

## Key product fields
Product document structure should include:
- id: unique Mongo ID or generated ID
- name: product name
- category: product group (Face, Eyes, Lips, etc.)
- sku: unique stock keeping unit
- brand: brand name
- shade: color/shade label
- quantity: current stock units
- price: unit price
- createdAt: product creation timestamp
- updatedAt: last update timestamp

## Recommended MongoDB collections
### products
- _id
- name
- category
- sku
- brand
- shade
- quantity
- price
- status (in_stock / low_stock / out_of_stock)
- createdAt
- updatedAt

### categories
- _id
- name
- description

### stock_movements (optional but recommended)
- _id
- productId
- type (restock / sale / adjustment / return)
- quantity
- note
- createdAt

### users (future admin/users layer)
- _id
- name
- email
- username
- passwordHash
- role
- createdAt

## Business rules
- SKU should be unique for each product.
- Quantity cannot be negative.
- Price should validate as a positive number.
- Low stock threshold should be configurable, with a default around 5 units.
- The inventory dashboard should display real-time stock summaries.

## Frontend state plan
Current frontend should keep these responsibilities:
- product list state
- search/filter state
- modal state for add/edit product
- inventory summary calculations
- local storage as temporary persistence layer

## MERN stack structure
- Frontend: React + Vite
- Database: MongoDB
- Backend: Express + Node.js
- ORM/ODM: Mongoose

## Important note
The current frontend is intentionally being built as a stock-monitoring interface first. The final connected backend will replace localStorage with API calls once the database and REST endpoints are ready.
