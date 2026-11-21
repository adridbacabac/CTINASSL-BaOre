# Smoke test — Ba'Oré Cosmetics Inventory

Human script for the current React app. No result below was produced by an automated browser run. Leave **Result** and **Notes** blank while you click through.

Start from a cleared origin so the seed is the eight products in `src/data/starterData.js`. Seed sign-in: username `admin` / password `baore-admin` (Admin One), username `employee` / password `baore-staff` (User One). Password match is exact. Username match is trimmed and case-insensitive.

Fresh seed totals, before any edit: 8 products, 127 units, inventory value ₱59,783. Low stock (`quantity <= 5`) is Cloud Nine Blush (4) and Silk Touch Setting Powder (3).

| ID | Area | Steps | Expected per spec | Expected TODAY (current code) | Result (leave blank) | Notes (leave blank) |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Auth | Reload on a cleared origin. Username `admin`, password `baore-admin`, Sign in. | Dashboard for Admin One. Nav: Dashboard, Inventory, Activity, Team. | Same. |  |  |
| A2 | Auth | Sign out. Username `employee`, password `baore-staff`, Sign in. | Dashboard for User One. Nav: Dashboard and Floor stock only. | Same. |  |  |
| A3 | Auth | Sign out. Username `admin`, password `nope`, Sign in. | Stay on the sign-in form. Message: "Those sign-in details don’t match a store account." | Same. |  |  |
| A4 | Auth | Username `ADMIN`, password `baore-admin`, Sign in. Then try password `Baore-admin`. | `ADMIN` signs in as Admin One. The changed password does not. | Same. |  |  |
| A5 | Auth | While signed in, reload the browser. | The same account is still signed in. | Same. `baore-session` stores the user id. |  |  |
| A6 | Auth | Open Inventory (or Team as admin), then reload. | The same page is still open. | FAILS today - F08. `page` starts at `"dashboard"` and is not stored, so the reload shows the dashboard. The session stays. |  |  |
| A7 | Auth | Sign in, then use the Sign out button. | Username and password on the sign-in form are empty. | Same. Both fields and the login error are cleared. |  |  |
| B1 | Admin products | As admin, Inventory → Add product. Name `Rose Glow Lip Tint`, SKU `lip-009`, category Lips, shade `Berry Rose`, quantity `10`, price `250`. Add to inventory. | One new row. SKU stored as `LIP-009`. It is first in the list. | Same. |  |  |
| B2 | Admin products | Add another product with SKU `lip-001` and a new name. | Rejected. No second `LIP-001` row. | Toast "That SKU already exists." |  |  |
| B3 | Admin products | Add a product with the name left blank, SKU `LIP-010`, quantity `1`, price `1`. | Rejected. | Toast "Please complete all required fields." |  |  |
| B4 | Admin products | Add a product with quantity `-1` and the other required fields filled. | Rejected. | Toast "Enter valid quantity and price." if that value is submitted. The quantity input has `min="0"`, so the browser may block the minus key first. |  |  |
| B5 | Admin products | Add a product with quantity `1.5`, a new SKU, and a price. | Rejected. Quantity must be a whole number. | FAILS today - F05. `1.5` is finite and not negative, so the product is saved. |  |  |
| B6 | Admin products | Add a product with quantity `1e3` and a new SKU. | Rejected. | FAILS today - F05. If the field value reaches the handler as `1e3`, `Number("1e3")` is `1000` and the product is saved. The number input may coerce or block that text first. |  |  |
| B7 | Admin products | Add or edit a product with price `399.5`. Read the price in the inventory table and on the dashboard. | The price shows ₱399.50. | FAILS today - F04. `money()` uses `maximumFractionDigits: 0`, so the screen shows ₱400. |  |  |
| B8 | Admin products | Add a product with price `0` and a new SKU. | Allowed. Non-negative price. | Saved. The table shows ₱0. |  |  |
| B9 | Admin products | Edit Velvet Matte Lipstick. Change only the shade to `Rose`. Save changes. | The same single row remains. Shade is `Rose`. | Same. The row keeps its id. |  |  |
| B10 | Admin products | Edit a product quantity from its current value to another whole number. Open Activity. | A stock movement records that quantity change. | FAILS today - F03. The product quantity changes and Activity gets no new row. |  |  |
| B11 | Admin products | Choose Delete on a product, then cancel the browser confirm. | The product remains. | Same. |  |  |
| B12 | Admin products | Choose Delete on a product you just added, then confirm. | The product is gone. Toast "Product deleted." | Same. |  |  |
| B13 | Admin products | Restock a product, then delete that product, then open Activity. | The history row still names the product, or the movement is removed with it. | FAILS today - F07. The movement remains and the product cell says "Removed product". |  |  |
| C1 | Admin movements | Update stock on a product with enough units. Restock `2`. Leave the note blank. Save. | Quantity increases by 2. Activity type Restock, change +2. | Same. A blank note renders as "—". |  |  |
| C2 | Admin movements | Sale `1` on that product. | Quantity decreases by 1. Activity type Sale, change -1. | Same. |  |  |
| C3 | Admin movements | Adjustment, direction Add units, `1`. | Quantity increases by 1. Activity type Adjustment, change +1. | Same. |  |  |
| C4 | Admin movements | Adjustment, direction Remove units, `1`. | Quantity decreases by 1. Activity type Adjustment, change -1. | Same. |  |  |
| C5 | Admin movements | Return `1`. | Quantity increases by 1. Activity type Return, change +1. | Same. |  |  |
| C6 | Admin movements | Sale a number larger than the units on hand. | Rejected. Quantity unchanged. | Toast "That would take stock below zero." |  |  |
| C7 | Admin movements | Units `0`. Save. | Rejected. | Toast "Enter a whole number of units." |  |  |
| C8 | Admin movements | Units `-1`. Save. | Rejected. | Toast "Enter a whole number of units." The input has `min="1"`, so the browser may block the minus key first. |  |  |
| C9 | Admin movements | Units `1.5`. Save. | Rejected. | Toast "Enter a whole number of units." |  |  |
| C10 | Admin movements | Leave Units empty. Save. | Rejected. | Toast "Enter a whole number of units." `Number("")` is 0. |  |  |
| C11 | Admin movements | Restock with Units `1e3`. | Rejected as not a plain whole-number entry. | FAILS today - F05. If the value reaches the handler as `1e3`, it is the integer 1000 and the restock is saved. Use Restock so the below-zero check does not hide this. |  |  |
| C12 | Admin movements | Restock `1` with the note left empty. | Saved. Note is optional. | Same. Activity shows "—". |  |  |
| D1 | Employee | Sign in as `employee`. Floor stock → update-stock button on any row. | The movement list offers only Stock out and Stock in. Stock out is selected. | Same. |  |  |
| D2 | Employee | On the dashboard and on Floor stock, look for add, edit, and delete. | Those controls are absent. The update-stock button remains. | Same. No Add product button, no pencil, no trash. |  |  |
| D3 | Employee | Read the dashboard stats and the floor-stock summary. | No inventory-value figure. | Same. Three figures only: products, units, low stock. |  |  |
| D4 | Employee | As the employee, save one Stock out. Sign in as admin and save one Sale. Sign back in as the employee and open the dashboard. | "Your recent updates" lists only the employee movement. | Same. The list is movements whose `userId` is the signed-in account, first five. |  |  |
| D5 | Employee | Read the sidebar as the employee. | No Activity item. No Team item. | Same. |  |  |
| E1 | Team | As admin, Team → Add account. Name `Floor Two`, email `floor2@baore.com`, username `floor2`, password `floor-pass`, Access User. | The new row appears with role User. | Same. Toast "Account added." |  |  |
| E2 | Team | Add another account with username `FLOOR2` and a different email. | Rejected as a duplicate username. | Toast "That username or email is already in use." |  |  |
| E3 | Team | Add another account with email `Floor2@baore.com` and a new username. | Rejected as a duplicate email. | Same toast. |  |  |
| E4 | Team | Add Name `A`, email `a@`, username `atuser`, password `secret`, Access User. | Rejected. `a@` is not a valid email. | FAILS today - F15. The check is only `includes("@")`, so the account is created. |  |  |
| E5 | Team | Remove Floor Two and confirm. | That row is gone. | Same. Toast "Account removed." |  |  |
| E6 | Team | While signed in as Admin One, look at Admin One's own row. | There is no remove button on that row. | Same. |  |  |
| E7 | Team | With Admin One as the only admin, try to remove that admin. | The last admin cannot be removed. | No remove button is rendered on the signed-in row, so Admin One cannot be removed that way. |  |  |
| E8 | Team | After an account exists, look for a way to change its role or password. | Role and password can be edited. | FAILS today - F11. There is no edit control. Add and Remove are the only account actions. |  |  |
| F1 | Search | Inventory search `velvet`. | Velvet Matte Lipstick. | Same. Search covers name, SKU, category, and shade, case-insensitive. |  |  |
| F2 | Search | Search `fac-002`. | Dewy Glow Foundation. | Same. |  |  |
| F3 | Search | Search `pink quartz`. | Petal Shine Lip Gloss. | Same. |  |  |
| F4 | Filter | Category `Lips`. Clear the search box. | Lip products only. On a fresh seed that is Velvet Matte Lipstick and Petal Shine Lip Gloss. | Same. |  |  |
| F5 | Filter | Category `Lips` and search `gloss`. | Petal Shine Lip Gloss only. | Same. |  |  |
| F6 | Search | Search `zzzzz`. | Empty state "No products found". | Same. Admin detail: "Try another search or add a new product." Employee detail: "Try another search or shade." |  |  |
| G1 | Dashboard | On a fresh seed, before edits, read Total products, Stock units, and Inventory value. Compare with the inventory table. | 8 products. Units equal the sum of the quantity column (127). Inventory value equals the sum of quantity times price (₱59,783). | Same, while every price is a whole peso. After a decimal price, the card rounds the grand total and each shown unit price hides cents (F04). |  |  |
| G2 | Dashboard | Edit any in-stock product to quantity `0`. Read the low-stock count, its badge, and "Needs a little love". | Quantity 0 is out of stock and is not included in the low-stock count. | FAILS today - F10. The count is `quantity <= 5`, so 0 is included. The badge text is "Out of stock". The preview lists the first four of that same set. |  |  |
| H1 | Persistence | Change a quantity, then reload. | The new quantity is still there and the account is still signed in. | Data and session survive. The page itself returns to the dashboard (A6, F08). |  |  |
| H2 | Persistence | DevTools → Application → Local Storage → Clear for this origin, then reload. | The eight starter products are back. | Same, after the reload. Clearing keys while the page stays open does not reseed until the next load. Starter Admin One and User One are written back when their usernames are missing. Movements start empty. |  |  |
| I1 | Security | 1. Sign in as `employee` / `baore-staff`. 2. DevTools → Application → Local Storage → this origin. 3. Edit the `baore-users` value. 4. In the object with `"username":"employee"` and `"id":"user-1"`, change `"role"` from `"user"` to `"admin"`. 5. Save that value. Do not edit `baore-session` (it stays the JSON string `"user-1"`). 6. Reload. | The account still has user access. Activity, Team, add, edit, and delete stay unavailable. | FAILS today - F02. After reload this account sees Inventory, Activity, Team, Add product, edit, delete, inventory value, and the admin movement list (Restock, Sale, Adjustment, Return). |  |  |
| J1 | Responsive | Set the viewport to 1280px wide. Open and close nothing yet. Open a product modal. Scroll the inventory table if it overflows. | Sidebar is on screen. The table scrolls inside its container. The modal fits the width. | Sidebar is in the layout. The menu button is hidden above 980px. `.table-wrap` is `overflow-x: auto`. The modal width is `min(720px, 100%)`. |  |  |
| J2 | Responsive | Set the viewport to 768px. Use the menu button, then close the sidebar. Open a modal. | Sidebar is hidden until the menu button. It closes from its close control or the shade. The table scrolls. The modal fits. | 768px matches the 980px rule and not the 760px rule. Sidebar starts off-canvas. Menu, close, and shade are shown. Modal width stays within the screen with 18px shade padding. |  |  |
| J3 | Responsive | Set the viewport to 390px. Open and close the sidebar. Open Add product or Update stock. | Sidebar toggles. The table scrolls. The modal and its actions fit the width. | The 760px rules also apply. Stats, summary, and the form grid are one column. Form buttons stack full width. Modal padding is 18px and its width is 100% of the shade. |  |  |
| K1 | Keyboard | Open Add product. Press Escape. | The modal closes. | FAILS today - F12. There is no Escape handler. The shade, X, and Cancel still close it. Delete product and Remove account use `window.confirm`. |  |  |
| K2 | Keyboard | With a modal open, press Tab past the last control. | Focus stays inside the dialog. | FAILS today - F12. There is no focus trap, no `role="dialog"`, and no `aria-modal`. |  |  |
| K3 | Keyboard | Save a product with the name left blank so a toast appears. Watch how long it stays. | The toast is announced and stays long enough to read. | FAILS today - F13. The toast is a plain div with no `aria-live`. It is cleared after 2200ms. |  |  |
