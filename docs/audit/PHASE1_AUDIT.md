# Phase 1 audit — Ba'Oré Cosmetics Inventory

Read-only audit of `BaOre-Cosmetics-Admin/StockEase-React-Frontend`. No application file was edited. The production build was run and its `dist` output was restored afterward so this report is the only audit change.

Verification labels used below:

- **[VERIFIED BY CODE]** — read in source, with `file:line`.
- **[VERIFIED BY RUNNING]** — a command was executed (build, dev server boot, or a Node formatter check).
- **[NOT VERIFIED]** — not exercised. No browser session was used, so runtime UI behavior is **NOT VERIFIED**.

---

## 1. Backend / database status

**NO BACKEND FOUND.**

Search evidence:

- Repository root contains one directory: `BaOre-Cosmetics-Admin`. There is no `server/`, `backend/`, or API package.
- `src/App.jsx` and `src/main.jsx` contain no `fetch`, `axios`, `XMLHttpRequest`, or `/api` call. **[VERIFIED BY CODE]**
- A search for `express` and `mongoose` outside `node_modules` returned no application files. **[VERIFIED BY CODE]**
- Glob `**/.env*` returned zero files. No environment variable names exist to list. **[VERIFIED BY CODE]**
- Persistence is four `localStorage` keys written from React effects (`baore-items`, `baore-users`, `baore-movements`, `baore-session`). `src/App.jsx:138-148`, `src/App.jsx:190`. **[VERIFIED BY CODE]**
- `docs/mongodb-setup.md` describes a future MongoDB shape. No driver, model, or connection string is in the app. **[VERIFIED BY CODE]**

---

## 2. Repo and architecture summary

### 2a. Folder tree

Excludes `node_modules` and `dist`.

```
BaOre-Cosmetics-Admin/StockEase-React-Frontend/
  index.html
  package.json
  package-lock.json
  docs/
    baore-seed-data.json
    current-code-structure.md
    mern-project-plan.md
    mongodb-setup.md
    audit/
      PHASE1_AUDIT.md
  src/
    App.jsx
    main.jsx
    styles.css
```

No `vite.config.*`. Vite is running on defaults. **[VERIFIED BY CODE]**

### 2b. package.json

| Field | Value |
| --- | --- |
| name | `stockease-react-frontend` |
| version | `1.0.0` |
| private | true |
| type | `module` |
| scripts | `dev`: `vite --host 0.0.0.0`; `build`: `vite build`; `preview`: `vite preview --host 0.0.0.0` |
| dependencies | `@vitejs/plugin-react` ^4.3.4, `lucide-react` ^0.468.0, `react` ^18.3.1, `react-dom` ^18.3.1, `vite` ^6.0.5 |
| devDependencies | `{}` |

`vite` and `@vitejs/plugin-react` are runtime dependencies, not devDependencies. `package.json:11-18`. **[VERIFIED BY CODE]**

### 2c. What the app is

One React 18 screen (`src/App.jsx`, 896 lines) mounted from `src/main.jsx` in `React.StrictMode`. There is no router. Page id is `useState("dashboard")`. Role is a string on each user (`admin` or `user`). All catalogue, movement, and account data lives in `localStorage`.

### 2d. App.jsx map

`src/App.jsx` total lines: **896**.

Module helpers (outside the component):

| Symbol | Lines | Role |
| --- | --- | --- |
| `starterItems` | 26–35 | Eight seed products |
| `categories` | 37 | Face, Eyes, Lips, Cheeks, Tools & Brushes, Skincare |
| `emptyProduct` | 38 | Add-product defaults, including `quantity: 12` |
| `emptyAccount` | 39 | Add-account defaults, role `user` |
| `LOW_STOCK` | 40 | Constant `5` |
| `money` | 41 | `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })` |
| `starterUsers` | 43–46 | Admin One (`admin` / `baore-admin`) and User One (`employee` / `baore-staff`) |
| `employeeMovementTypes` | 48–51 | `stock_out`, `stock_in` |
| `adminMovementTypes` | 53–58 | `restock`, `sale`, `adjustment`, `return` |
| `stockStatus` | 60–65 | `<= 0` out, `<= 5` low, else in stock |
| `movementDelta` | 67–71 | Sign of a movement; legacy `sale` / `return` still recognized |
| `movementLabel` | 73–76 | Human label, including Stock in / Stock out |
| `roleLabel` | 78–80 | Admin / User |
| `readStorage` | 82–93 | JSON parse with fallback |
| `readSession` | 95–101 | Reads `baore-session` |

State inside `App` (104–130):

| State | Line | Initial |
| --- | --- | --- |
| `items` | 104 | `readStorage("baore-items", starterItems)` |
| `users` | 105–115 | stored users, with the two starter accounts merged back if missing |
| `movements` | 116 | `readStorage("baore-movements", [])` |
| `sessionUserId` | 117 | `readSession()` |
| `username` | 118 | `""` |
| `password` | 118 | `""` |
| `loginError` | 118 | `""` |
| `page` | 119 | `"dashboard"` — not read from storage |
| `search` | 120 | `""` |
| `filter` | 121 | `"All categories"` |
| `productModal` | 122 | `false` |
| `editId` | 123 | `null` |
| `form` | 124 | `emptyProduct` |
| `movementModal` | 125 | `null` |
| `movementForm` | 126 | `{ type: "sale", quantity: "", note: "", direction: "out" }` — replaced when a movement opens |
| `accountModal` | 127 | `false` |
| `accountForm` | 128 | `emptyAccount` |
| `toast` | 129 | `""` |
| `mobileOpen` | 130 | `false` |

Derived values: `currentUser` 132, `isAdmin` 133, `activePage` 134 (non-admin on `activity` or `team` is forced to `dashboard`), `displayName` 135, `movementTypes` 136. Pages are only `dashboard`, `inventory`, `activity`, and `team` (`369–385`). There is no low-stock page.

Effects: persist items 138–140, users 142–144, movements 146–148, clear a session id that no longer matches a user 150–155, clear toast after 2200 ms 157–161.

Handlers:

| Function | Lines |
| --- | --- |
| `goTo` | 176–179 |
| `handleLogin` | 181–194 |
| `handleLogout` | 196–207 |
| `openAddAccount` | 209–213 |
| `saveAccount` | 215–248 |
| `removeAccount` | 250–260 |
| `openAddProduct` | 262–267 |
| `openEditProduct` | 269–282 |
| `saveProduct` | 284–314 |
| `deleteProduct` | 316–322 |
| `openMovement` | 324–332 |
| `saveMovement` | 334–367 |

### 2e. localStorage

| Key | Read | Write |
| --- | --- | --- |
| `baore-items` | `readStorage` at 104 | effect 138–140 |
| `baore-users` | `readStorage` at 106 | effect 142–144 |
| `baore-movements` | `readStorage` at 116 | effect 146–148 |
| `baore-session` | `readSession` 95–101, used at 117 | `setItem` on login 190; `removeItem` on logout 197 and on a stale id 153 |

No other keys. **[VERIFIED BY CODE]**

### 2f. Navigation

There is no React Router and no URL path per page. `goTo` sets `page` and closes the mobile drawer (`176–179`). `activePage` (`134`) hides Activity and Team from a user even if `page` was set to those ids. `page` is not written to `localStorage` or the URL, so a reload remounts at `"dashboard"` (`119`). The session id is restored, so the same account stays signed in. **[VERIFIED BY CODE].** A real browser refresh was **[NOT VERIFIED]**.

### 2g. Interactive controls

| Control | Where | Handler | Does the label match? |
| --- | --- | --- | --- |
| Login username / password | 396–414 | controlled inputs | Yes. Submit calls `handleLogin` 181–194. Match is trimmed lowercase username and exact password. |
| Sign in | 416 | `handleLogin` | Yes. Sets `baore-session` and `page` to dashboard (`190–191`). |
| Sidebar / mobile nav buttons | 436–441 | `goTo(item.id)` | Yes. User list omits Activity and Team (`425–432`). |
| Sidebar X | 434 | `setMobileOpen(false)` | Closes the drawer. Icon only, no `aria-label`. |
| Close menu shade | 460 | `setMobileOpen(false)` | Yes. Has `aria-label="Close menu"`. |
| Open menu | 464 | `setMobileOpen(true)` | Yes. Icon only, no `aria-label`. |
| Sign out | 456–458 | `handleLogout` | Yes. Clears session, form fields, and returns page to dashboard. Has `aria-label`. |
| “Add product” | 481, 603 | `openAddProduct` | Admin only. Opens the product modal. A non-admin call returns immediately (`263`). It does not toast. |
| “Manage stock” / “Review floor stock” | 559 | `goTo("inventory")` | Yes. The low-stock stat (`495–498`) is not a button, and there is no low-stock route. |
| Inventory search | 623 | `setSearch` | Yes. Filters name, SKU, category, and shade (`171–172`). |
| Category `<select>` | 624–627 | `setFilter` | Yes. |
| Update stock (icon) | 664 | `openMovement` | Yes for both roles. Sets type to `stock_out` for a user and `restock` for an admin (`327`). `title` only, no `aria-label`. |
| Edit product (icon) | 665 | `openEditProduct` | Admin only. Loads the product into the form, including quantity (`273–280`). `title` only. |
| Delete product (icon) | 666 | `deleteProduct` | Admin only. `window.confirm`, then removes the product (`317–320`). Does not touch movements. `title` only. |
| Team “Add account” | 748 | `openAddAccount` | Admin page. Opens the account modal. |
| Remove account (icon) | 761–768 | `removeAccount` | Hidden for the signed-in account. Confirms, blocks removing the last admin (`252–255`). Has `aria-label`. |
| Modal shade | 774, 810, 856 | close if `target === currentTarget` | Yes, mouse only. |
| Modal X and Cancel | 782–784, 803, 819–821, 849, 864–866, 886 | close the matching modal | Yes. X buttons have no `aria-label`. |
| Save product | 804 | `saveProduct` | Creates or replaces the product. Writes quantity directly. No movement row. |
| Save movement | 850 | `saveMovement` | Applies delta and appends a movement in one handler (`351–364`). |
| Create account | 887 | `saveAccount` | Appends a user. No later edit UI exists. |
| Toast | 892 | none (effect clears it) | Display only. |

Login no longer renders demo account cards. **[VERIFIED BY CODE]** at the login return `380–421`.

---

## 3. Findings

Severity: **Critical** = data integrity, security, or core function. **High** = important behavior or usability. **Medium** = consistency or UX. **Low** = polish.

| ID | Severity | Area | Description | Evidence | Verification | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Critical | Security | Passwords are stored and compared as plain strings in `localStorage` (`baore-users`). Seed passwords ship in source. | `src/App.jsx:43-46`, `src/App.jsx:142-144`, `src/App.jsx:183`, `src/App.jsx:220` | [VERIFIED BY CODE] | Hash on a server. Do not persist passwords in the browser. | L |
| F02 | Critical | Security | Admin access is `currentUser.role === "admin"` after users are loaded from `localStorage`. Changing `baore-users` so a user's `role` is `"admin"`, or setting `baore-session` to `admin-1`, grants Activity, Team, add/edit/delete, and admin movement types. Every gate (`activePage`, `openAddProduct`, `saveProduct`, `deleteProduct`, `saveAccount`, `removeAccount`) trusts that same client flag. | `src/App.jsx:105-115`, `src/App.jsx:132-134`, `src/App.jsx:217`, `src/App.jsx:251`, `src/App.jsx:263`, `src/App.jsx:286`, `src/App.jsx:317` | [VERIFIED BY CODE]. Exploit click-through [NOT VERIFIED] | Enforce role on a server. Treat client role as display only. | L |
| F03 | High | Logic | Edit Product writes `quantity` on the product and does not append a stock movement. The ledger can no longer explain the quantity. | `src/App.jsx:273-280`, `src/App.jsx:284-310`, `src/App.jsx:797` | [VERIFIED BY CODE] | Keep quantity changes on the movement form only, or record an adjustment when quantity changes. | M |
| F04 | High | Logic | Price accepts hundredths (`step="0.01"`). `money()` sets `maximumFractionDigits: 0`, so stored `399.5` formats as `₱400`. | `src/App.jsx:41`, `src/App.jsx:294`, `src/App.jsx:798` | Formatter [VERIFIED BY RUNNING] (`Intl` in Node printed `₱400` for `399.5`). On-screen labels [NOT VERIFIED] | Show two fraction digits, or reject non-integers if whole pesos are required. | S |
| F05 | High | Logic | Product quantity is only checked as finite and `>= 0`. `1.5` is saved. `Number("1e3")` is `1000` and is saved. Movement quantity uses `Number.isInteger`, so decimals fail, but `"1e3"` passes as `1000`. Empty movement quantity becomes `0` and fails the `<= 0` check. `NaN` fails `isInteger`. | `src/App.jsx:289-297`, `src/App.jsx:339-341`, `src/App.jsx:797`, `src/App.jsx:840` | [VERIFIED BY CODE]. Browser input of `1e3` [NOT VERIFIED] | Reject non-integers with `Number.isInteger` after rejecting exponent notation (`/[eE]/`). | S |
| F06 | High | Logic | A movement updates React state in one handler (`setItems` then `setMovements`), then two separate effects write two keys. There is no transaction. If the second `setItem` throws (quota, private mode), one key can be ahead of the other. | `src/App.jsx:138-148`, `src/App.jsx:351-364` | [VERIFIED BY CODE]. A forced quota failure [NOT VERIFIED] | Write both keys in one `try`, or one JSON document. | M |
| F07 | Medium | Logic | Deleting a product filters `items` only. Movements remain. Activity and “Your recent updates” show `Removed product` when the lookup misses. | `src/App.jsx:316-320`, `src/App.jsx:574-579`, `src/App.jsx:715-722` | [VERIFIED BY CODE] | Decide: keep the name snapshot on the movement, or block delete while history exists. | S |
| F08 | Medium | UX | Refresh returns to the dashboard because `page` starts at `"dashboard"` and is never stored. Session still restores. | `src/App.jsx:117-119`, `src/App.jsx:176-179` | [VERIFIED BY CODE]. Live refresh [NOT VERIFIED] | Persist `page` or reflect it in the URL. | S |
| F09 | Medium | Logic | “Recently” is `items.slice(0, 5)`. New products are prepended (`309`), so they show up first. There is no date sort. Seed order is the starter array order. | `src/App.jsx:309`, `src/App.jsx:518` | [VERIFIED BY CODE] | Sort by a `createdAt` field. | S |
| F10 | Medium | Logic | Low-stock list and count use `quantity <= 5`, so quantity `0` is included. The badge for `0` still says “Out of stock”. | `src/App.jsx:60-64`, `src/App.jsx:163`, `src/App.jsx:482` | [VERIFIED BY CODE] | Split “out” and “low” if the count should mean “still on the shelf but low”. | S |
| F11 | Medium | UX | After create, no account field can be edited. There is no edit handler. Self-removal is blocked in the handler and the button is hidden. The last admin cannot be removed. | `src/App.jsx:215-260`, `src/App.jsx:761` | [VERIFIED BY CODE] | Add an edit form if password or role changes are required. | M |
| F12 | Medium | A11y | `window.confirm` is used for delete product and remove account. Modals have no `role="dialog"`, no `aria-modal`, no Escape handler, and no focus trap. Shade click and Cancel do close them. | `src/App.jsx:257`, `src/App.jsx:318`, `src/App.jsx:773-807`, `src/App.jsx:809-853`, `src/App.jsx:855-890` | [VERIFIED BY CODE]. Keyboard behavior [NOT VERIFIED] | Replace `confirm` with a dialog that handles Escape and focus. | M |
| F13 | Medium | A11y | Toast is a plain `div` with no `aria-live`. It is cleared after 2200 ms. Icon-only Update stock, Edit, Delete, modal X, sidebar X, and the menu button use `title` or nothing, not `aria-label`. Sign out, the mobile shade, and Remove account do have `aria-label`. | `src/App.jsx:157-161`, `src/App.jsx:434`, `src/App.jsx:456`, `src/App.jsx:460`, `src/App.jsx:464`, `src/App.jsx:664-666`, `src/App.jsx:762`, `src/App.jsx:783`, `src/App.jsx:820`, `src/App.jsx:865`, `src/App.jsx:892` | [VERIFIED BY CODE] | Add `aria-live="polite"` and `aria-label` on icon buttons. | S |
| F14 | Medium | UX | Browser tab title is `StockEase \| Inventory Management`. `theme-color` is `#f5f7fb`. Package name is `stockease-react-frontend`. Sidebar brand text is Ba'Oré. | `index.html:6-7`, `package.json:2`, `src/App.jsx:434` | [VERIFIED BY CODE] | Rename title, theme color, and package when a rename is intended. | S |
| F15 | Medium | Logic | Email uniqueness is case-insensitive, but the only format check is `includes("@")`. Username is trimmed and compared case-insensitively. Password is not trimmed. | `src/App.jsx:221-236` | [VERIFIED BY CODE] | Validate email shape. Trim password or document that spaces count. | S |
| F16 | Medium | Docs | `docs/mern-project-plan.md` still describes a categories collection, a future users layer, optional stock movements, a database preview, and a configurable low-stock threshold. The app has none of those. | `docs/mern-project-plan.md:67-96` vs `src/App.jsx:37-40` | [VERIFIED BY CODE] | Mark the plan as historical or rewrite it from the current screen. | S |
| F17 | Low | UX | Activity heading says “Restocks, sales, adjustments, and returns” (`696`). The empty state says “Sales, restocks, and adjustments will be listed here.” (`736`). Neither mentions stock in / stock out, which users can record. | `src/App.jsx:696`, `src/App.jsx:736` | [VERIFIED BY CODE] | Match the copy to `movementLabel`. | S |
| F18 | Low | UX | CSS defines many classes that JSX never uses (login hero, demo cards, database preview, profile). Listed in section 4. | `src/styles.css` | [VERIFIED BY CODE] | Remove after a visual pass. | M |
| F19 | Low | UX | Several selectors are declared twice. The later block wins. Media queries at 760px override the earlier 980px sidebar rules. | `src/styles.css:447` and `:571`, `:592-664` | [VERIFIED BY CODE] | Delete the earlier copies. | S |
| F20 | Low | A11y | Many labels use 8–11px type. | `src/styles.css:44`, `:56`, `:61`, `:129-130`, `:162`, `:226`, `:250`, `:287`, `:291`, `:351`, `:355`, `:363`, `:383`, `:414`, `:500`, `:502`, `:514`, `:639` | [VERIFIED BY CODE] | Raise body-adjacent text to at least 12px. | S |

---

## 4. The 14 claims

1. **Edit Product changes quantity without a stock movement. CONFIRMED.** `openEditProduct` copies `quantity` into the form (`269–280`). `saveProduct` assigns that number onto the product (`301–307`) and never calls `setMovements`. The quantity input is on the form (`797`). **[VERIFIED BY CODE]**

2. **Refresh returns to the dashboard. CONFIRMED by initialization.** `page` is `useState("dashboard")` (`119`) and is never read from storage. Session id is read (`95–101`, `117`), so the user stays signed in on the dashboard. A physical refresh was **[NOT VERIFIED]**.

3. **Price decimals vs display. CONFIRMED.** The price input is `type="number"` `step="0.01"` (`798`). `saveProduct` accepts any finite price `>= 0` (`294`). `money()` uses `maximumFractionDigits: 0` (`41`). Node `Intl` formatted `399.5` as `₱400`. **[VERIFIED BY RUNNING]** for the formatter. The painted UI was **[NOT VERIFIED]**.

4. **Whole-number validation. PARTIAL.**
   - Product form: empty is rejected (`289–291`). Negative and `NaN` fail `Number.isFinite` / `< 0` (`294–297`). Decimals such as `1.5` pass. `Number("1e3")` is `1000` and passes. There is no `step` on the quantity input (`797`).
   - Movement form: `Number.isInteger(amount) && amount > 0` is required (`339–341`). Decimals, empty (`Number("") === 0`), `NaN`, and negatives fail. `"1e3"` passes because `Number("1e3")` is the integer `1000`. The toast says “whole number” for the `<= 0` case too (`340`).
   - **[VERIFIED BY CODE].** Whether the browser’s number input surfaces `1e3` as a string is **[NOT VERIFIED]**.

5. **Dashboard recent products. CONFIRMED: first five of the array.** `items.slice(0, 5)` at `518`. Not sorted by date. New rows are inserted at index 0 (`309`), so a just-added product appears in that slice. **[VERIFIED BY CODE]**

6. **Low stock includes quantity 0. CONFIRMED.** `lowStockItems` is `quantity <= LOW_STOCK` (`163`, `LOW_STOCK` is 5 at `40`). The dashboard count uses that array (`497`). The “Needs a little love” preview is the first four of the same array (`545`), so a zero-quantity product is included when it falls in that slice. **[VERIFIED BY CODE]**

7. **Plain-text passwords in localStorage. CONFIRMED.** Users keep a `password` field (`43–46`, `220`). The users effect writes `JSON.stringify(users)` to `baore-users` (`142–144`). Login compares `account.password !== password` (`183`). **[VERIFIED BY CODE]**

8. **Delete product vs movements. CONFIRMED.** `deleteProduct` filters `items` only (`319–320`). Movements stay. Activity uses `product?.name || "Removed product"` (`715–722`). The user dashboard does the same (`574–579`). **[VERIFIED BY CODE]**

9. **Confirms, modals, labels, toast. PARTIAL / CONFIRMED as follows.**
   - `window.confirm`: yes, lines `257` and `318`.
   - Escape, focus trap, `aria-modal`, `role="dialog"`: absent from `src/App.jsx`. Shade `onMouseDown` and Cancel close the modals (`774`, `803`, `810`, `849`, `856`, `886`).
   - `aria-label` exists on Sign out (`456`), Close menu (`460`), and Remove account (`762`). Update stock, Edit, Delete (`664–666`) and the three modal X buttons (`783`, `820`, `865`) do not have `aria-label`.
   - Toast has no `aria-live` (`892`). Lifetime is 2200 ms (`157–161`).
   - **[VERIFIED BY CODE].** Focus behavior in a browser is **[NOT VERIFIED]**.

10. **StockEase leftovers. CONFIRMED.** `index.html:7` title, `index.html:6` theme-color `#f5f7fb`, `package.json:2` name `stockease-react-frontend`. The same title string is described in `docs/current-code-structure.md`. Built `dist/index.html` is the Vite copy of that title. Sidebar text is Ba'Oré (`src/App.jsx:434`). **[VERIFIED BY CODE]**

11. **SKU, username, email uniqueness. CONFIRMED for the rules that exist.** SKU is trimmed and uppercased (`287`) and uniqueness uses `toLowerCase()` excluding the row being edited (`299–300`). Username is trimmed (`221`) and uniqueness is case-insensitive (`236`). Email uniqueness is case-insensitive (`236`). Email format is only `includes("@")` (`231`). Password is not trimmed. **[VERIFIED BY CODE]**

12. **Team rules. CONFIRMED.** Self-removal returns at `251` and the button is not rendered when `user.id === currentUser.id` (`761`). Last-admin removal toasts and returns (`252–255`). No function edits name, email, username, password, or role after `saveAccount`. **[VERIFIED BY CODE]**

13. **Movement save atomicity. PARTIAL.** `saveMovement` calls `setItems` and `setMovements` in the same handler (`351–364`), so one successful click updates both pieces of React state together. Persistence is two effects (`138–140` and `146–148`). A failure on the second write can leave the keys inconsistent. That failure was **[NOT VERIFIED]**.

14. **User role vs localStorage. CONFIRMED.** There is no server check. `isAdmin` is `currentUser.role === "admin"` (`133`). `currentUser` comes from the `users` array loaded from `baore-users` (`105–115`, `132`). Setting that user's `role` to `"admin"` and reloading, or setting `baore-session` to the seed admin id `admin-1`, loads an admin session. UI then shows Team, Activity, product edit/delete, and admin movement types. Handlers also check `isAdmin`, but that flag is the same browser data. **[VERIFIED BY CODE].** Performing the edit in a browser was **[NOT VERIFIED]**.

---

## 5. Docs vs code

Code is the source of truth.

| Doc | Discrepancy |
| --- | --- |
| `docs/mern-project-plan.md` | Still lists a `categories` collection, `users` as a future layer, `stock_movements` as optional, a database preview panel, and a configurable threshold. The screen has a fixed threshold of 5, required movements, roles, and no database panel. |
| `docs/mern-project-plan.md` | Says price should be a positive number. `saveProduct` allows `0` (`294`). |
| `docs/mongodb-setup.md` | Mostly matches the current roles and movement types, and it already says the frontend stores `password` until an API exists (`142`). The sample user document still shows `passwordHash` (`132`). Starter users in code have no `createdAt` (`43–46`); the doc says users have `createdAt`. |
| `docs/baore-seed-data.json` | Seed products include `status`. `saveProduct` does not write `status`. Status is derived by `stockStatus`. |
| `docs/current-code-structure.md` | Describes this tree, the four storage keys, role split, and unused CSS. It matches the code read for this audit. It also records the StockEase title, which is still true. |
| `index.html` theme-color `#f5f7fb` | `--bg` is `#faf8ff` (`src/styles.css:4`). |

---

## 6. Works correctly — do not touch

Verified from code unless noted.

- Login matches a trimmed, case-insensitive username and an exact password, then stores only the user id (`181–194`).
- Unknown session ids are removed (`150–155`).
- A user cannot open Activity or Team through `activePage` (`134`) without changing stored role (see F02).
- User movement choices are only Stock out and Stock in (`48–51`, `135`, `327`).
- Admin choices remain restock, sale, adjustment, and return (`53–58`).
- Movement math: stock out and sale subtract; stock in, restock, and return add; adjustment follows `in` / `out`. Result is clamped at 0 (`67–71`, `346–360`).
- SKU is trimmed, uppercased, and checked case-insensitively (`287`, `299–300`).
- Self-removal and last-admin removal are blocked (`250–255`, `761`).
- Starter Admin One and User One are reinserted if missing from stored users (`107–114`).
- The low-stock card is a count only (`495–498`). “Manage stock” / “Review floor stock” opens inventory (`559`). There is no separate low-stock page.
- `npm run build` completes with Vite 6.4.6 (see section 8).
- `npm run dev` reached `ready` on port 5173 (see section 8). The UI was not clicked.

---

## 7. File-by-file map for later phases

| File | Later change |
| --- | --- |
| `src/App.jsx` | Split screens only after behavior is fixed: quantity audit trail, integer checks, money formatting, persistence transaction, role no longer trusted from `localStorage`, modal/toast accessibility, account edit if required. |
| `src/styles.css` | Remove unused selectors and the earlier duplicate copies. Fix media-query order. Raise type under 12px. |
| `index.html` | Title and theme-color when branding is renamed. |
| `package.json` | Package name, and move Vite packages to devDependencies when the toolchain is cleaned up. |
| `docs/mern-project-plan.md` | Rewrite or mark historical so it stops contradicting the app. |
| `docs/mongodb-setup.md` | Align the sample user field with the real `password` field, and note missing `createdAt` on seed users. |
| `docs/baore-seed-data.json` | Drop `status` or start persisting it. Do not import it blindly. |
| `docs/current-code-structure.md` | Update only after the code changes. It is descriptive, not a spec. |
| Future `server/` | Does not exist. Auth, hashing, and multi-key writes belong there. Nothing in this repo can be “secured” while role stays in `localStorage`. |

---

## 8. Build, run, and open questions

### Build

`npm install` was not run. `node_modules` was already present.

`npm run build` (Vite 6.4.6) succeeded in 5.06s, 1572 modules transformed.

| Asset | Size | Gzip |
| --- | --- | --- |
| `dist/index.html` | 0.47 kB | 0.30 kB |
| `dist/assets/index-*.css` | 24.10 kB | 5.20 kB |
| `dist/assets/index-*.js` | 181.82 kB | 55.56 kB |

No compile error. npm printed `Unknown env config "devdir"` and an upgrade notice. Those are environment notices, not app errors. The new `dist` hashes were removed and tracked `dist` files were restored after the measurement. **[VERIFIED BY RUNNING]**

### Dev server

`npm run dev` printed `VITE v6.4.6 ready` and `Local: http://localhost:5173/`. The process was stopped after that line. **[VERIFIED BY RUNNING]**

**Runtime UI behavior NOT VERIFIED.** No browser was driven for this audit (no click, no refresh, no form submit).

### CSS notes (method)

Duplicate selectors: a script listed class selectors whose rule text starts at column 0 and grouped by selector.

Later rule wins:

- `.toast` at 447, then 571 (solid `--main` background, `z-index: 50`).
- `.form-grid` at 443, then 529 (gap 16px).
- `.form-actions` at 444, then 535 (`margin-top: 8px`).
- `.db-grid` at 396 and 484.
- `.collection-row` at 402 and 490.
- `.app-footer` at 416 and 576.
- `.modal-shade` at 421 and 579.
- `.product-modal` at 424 and 582.
- `.stats-grid` at 251 and 654.
- `.close-nav` at 451 and 575.

`.brand-name strong` and `.brand-name span` are different selectors, not duplicates.

Media query order in `src/styles.css`:

1. `max-width: 980px` at 454
2. `max-width: 640px` at 472
3. `max-width: 1100px` at 592
4. `max-width: 760px` at 599
5. `max-width: 1100px` at 657
6. `max-width: 760px` at 661

Conflict: the 760px block at 599 comes after the 980px block, and both set `.sidebar` and `.menu-toggle`. At a 700px width the 760px rules win. The 1100px rule at 657 sets `.cols-3` to two columns; the 760px rule at 661 sets it back to one column. That pair is ordered so phones stay one column.

Unused-class method: collect class tokens from `src/styles.css` with `\.[A-Za-z][A-Za-z0-9_-]*`, then keep tokens whose exact text never appears in `src/App.jsx` or `src/main.jsx`. Dynamic classes `box-${index % 4}` and `icon-${index % 4}` (`src/App.jsx:520`, `src/App.jsx:649`) were treated as used (`box-0` … `box-3`, `icon-0` … `icon-3`). `googleapis` is a font URL, not a component class.

Unused tokens include: `auth-hero`, `auth-benefits`, `auth-tabs`, `auth-link-row`, `brand-auth`, `side-promo`, `promo-spark`, `hero-banner`, `hero-copy`, `hero-kicker`, `hero-art`, `orb`, `orb-one`, `orb-two`, `glow-bubble`, `jar`, `jar-one`, `jar-two`, `demo-block`, `demo-grid`, `demo-card`, `text-button`, `text-link`, `view-btn`, `notice-box`, `notice-icon`, `db-status`, `db-grid`, `db-card`, `collection-card`, `collection-row`, `collection-icon`, `collection-copy`, `record-pill`, `user-header`, `mini-grid`, `mini-card`, `feature-grid`, `feature-item`, `feature-badge`, `feature-meta`, `profile-card`, `profile-head`, `profile-form`, `profile-avatar`. `.feature-card` is used (`src/App.jsx:564`). `mini-icon`, `mini-box`, `box-0`–`box-3`, and `icon-0`–`icon-3` are used (`520`, `649`).

Hard-coded colors outside `:root` (summary): white and near-white surfaces (`#fff`, `#ffffff`, `#f7f4ff`, `#f3edff`), purple tints (`#f1e9ff`, `#efe7ff`, `#f6f1ff`, `#f7f2ff`, `#fbfaff`, `#171222`, `#120d1c`), and `rgba(...)` shadows and borders. They repeat the same purple family as `--purple` / `--main` but are not variables. `:root` itself holds `#faf8ff`, `#2b1b45`, `#72658b`, `#2f2349`, `#8a63d8`, `#cf7f20`, `#3ca96f`, `#df5d74`.

Font sizes below 12px: 8px (line 44), 9px (56, 61, 130, 291), 10px (162, 363, 383, 414, 502, 514), 11px (129, 226, 250, 287, 351, 355, 500, 639).

### Open questions

- Should quantity `0` count as low stock or only as out of stock? The code counts it as both a low-stock row and an “Out of stock” badge.
- Should cents be stored? The form allows them and the formatter hides them.
- Is a movement required for every quantity change, including the first quantity on create? Create also writes quantity with no movement (`301–310`).
- Account edit, password change, and role change are unspecified because the UI has no edit path.
- No browser was available to this audit pass, so focus order, Escape, toast announcement, and the live refresh were not observed.
