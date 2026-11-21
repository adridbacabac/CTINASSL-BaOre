import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProductRequest,
  deleteProductRequest,
  listMovementsRequest,
  listMyMovementsRequest,
  listProductsRequest,
  recordMovementRequest,
  updateProductRequest,
} from "./api.js";
import { visibleMovements } from "./accounts.js";
import { adminMovementTypes, employeeMovementTypes } from "./constants.js";
import {
  activityView,
  applyMovement,
  catalogView,
  createProductPayload,
  movementPayload,
  movementProductLabel,
  openingStockNeedsRefresh,
  removeProduct,
  sortProducts,
  updateProductPayload,
  upsertProduct,
  validateMovementForm,
  validateProductForm,
} from "./products.js";
import { catalogueTotals, lowStockProducts, roleLabel, stockStatus } from "./stock.js";

function walkSources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkSources(path);
    if (!/\.(js|jsx)$/.test(entry.name) || entry.name.endsWith(".test.js")) return [];
    return [path];
  });
}

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function recorder(status, payload) {
  const calls = [];
  return {
    calls,
    dependencies: {
      env: {},
      fetchImpl: async (url, options) => {
        calls.push({ url, method: options.method, body: options.body, credentials: options.credentials });
        return jsonResponse(status, payload);
      },
    },
  };
}

const lipstick = {
  id: "6740a1b2c3d4e5f678901234",
  name: "Velvet Matte Lipstick",
  category: "Lips",
  sku: "LIP-001",
  brand: "Ba'Oré",
  shade: "Rosewood",
  quantity: 28,
  price: 399,
  stockStatus: "in_stock",
  createdAt: "2026-11-21T00:00:00.000Z",
  updatedAt: "2026-11-21T00:00:00.000Z",
};

const form = {
  name: " Glow Serum ",
  category: "Skincare",
  sku: " skn-100 ",
  brand: "Ba'Oré",
  shade: "Clear",
  quantity: "12",
  price: "549.50",
};

describe("product and movement API client", () => {
  test("loads the product envelope with credentials and keeps the public id", async () => {
    const { calls, dependencies } = recorder(200, { products: [lipstick] });
    const result = await listProductsRequest(dependencies);
    assert.equal(result.ok, true);
    assert.equal(result.products[0].id, lipstick.id);
    assert.equal(calls[0].url, "http://127.0.0.1:5000/api/products");
    assert.equal(calls[0].credentials, "include");
    assert.equal(JSON.stringify(result).includes("_id"), false);
  });

  test("creates with an opening quantity and edits without quantity", async () => {
    const create = recorder(201, { product: { ...lipstick, quantity: 12 } });
    const created = await createProductRequest(createProductPayload(form), create.dependencies);
    assert.equal(created.ok, true);
    assert.equal(create.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(create.calls[0].body), {
      name: "Glow Serum",
      category: "Skincare",
      sku: "SKN-100",
      brand: "Ba'Oré",
      shade: "Clear",
      price: 549.5,
      quantity: 12,
    });

    const changes = updateProductPayload({ ...form, name: "Glow Serum", quantity: "999", price: "399" }, lipstick);
    assert.equal(Object.hasOwn(changes, "quantity"), false);
    const update = recorder(200, { product: { ...lipstick, name: "Glow Serum", price: 399 } });
    const updated = await updateProductRequest(lipstick.id, changes, update.dependencies);
    assert.equal(updated.product.name, "Glow Serum");
    assert.equal(update.calls[0].method, "PATCH");
    assert.equal(update.calls[0].url.endsWith(`/api/products/${lipstick.id}`), true);
    assert.equal(update.calls[0].body.includes("quantity"), false);

    const removed = recorder(200, { message: "Product deleted." });
    const deleted = await deleteProductRequest(lipstick.id, removed.dependencies);
    assert.equal(deleted.ok, true);
    assert.equal(removed.calls[0].method, "DELETE");
  });

  test("surfaces duplicate SKU, insufficient stock, and session errors", async () => {
    const duplicate = await createProductRequest({}, recorder(409, { error: "That SKU is already in use." }).dependencies);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.error, "That SKU is already in use.");
    const short = await createProductRequest({}, recorder(400, { error: "Product name must be 120 characters or fewer." }).dependencies);
    assert.equal(short.error, "Product name must be 120 characters or fewer.");
    const missing = await updateProductRequest("gone", { name: "X" }, recorder(404, { error: "Product not found." }).dependencies);
    assert.equal(missing.status, 404);
    const denied = await deleteProductRequest(lipstick.id, recorder(403, { error: "You do not have access to this action." }).dependencies);
    assert.equal(denied.status, 403);
    const expired = await listProductsRequest(recorder(401, { error: "Authentication required." }).dependencies);
    assert.equal(expired.status, 401);
    const offline = await listProductsRequest({ env: {}, fetchImpl: async () => { throw new Error("offline"); } });
    assert.equal(offline.status, 0);
  });

  test("records stock movements and reads the role-specific lists", async () => {
    const movement = {
      id: "m1",
      productId: lipstick.id,
      productName: lipstick.name,
      sku: lipstick.sku,
      userId: "employee-id",
      type: "stock_out",
      quantity: 2,
      quantityBefore: 28,
      quantityAfter: 26,
      createdAt: "2026-11-21T01:00:00.000Z",
    };
    const recorded = recorder(201, { movement });
    const result = await recordMovementRequest(
      movementPayload({ type: "stock_out", quantity: "2", note: " Counter ", direction: "out" }, lipstick.id),
      recorded.dependencies,
    );
    assert.equal(result.ok, true);
    assert.equal(result.movement.quantityAfter, 26);
    assert.deepEqual(JSON.parse(recorded.calls[0].body), {
      productId: lipstick.id,
      type: "stock_out",
      quantity: 2,
      note: "Counter",
    });
    assert.equal(recorded.calls[0].credentials, "include");

    const stockIn = movementPayload({ type: "stock_in", quantity: "3", note: "", direction: "out" }, lipstick.id);
    assert.deepEqual(stockIn, { productId: lipstick.id, type: "stock_in", quantity: 3 });
    const adjustment = movementPayload({ type: "adjustment", quantity: "1", note: "", direction: "out" }, lipstick.id);
    assert.equal(adjustment.direction, "out");

    const insufficient = await recordMovementRequest({}, recorder(409, { error: "There is not enough stock for that movement." }).dependencies);
    assert.equal(insufficient.error, "There is not enough stock for that movement.");

    const all = await listMovementsRequest(recorder(200, { movements: [movement] }).dependencies);
    assert.equal(all.movements[0].id, "m1");
    const mine = recorder(200, { movements: [] });
    const own = await listMyMovementsRequest(mine.dependencies);
    assert.deepEqual(own.movements, []);
    assert.equal(mine.calls[0].url.endsWith("/api/movements/mine"), true);
    const forbidden = await listMovementsRequest(recorder(403, { error: "You do not have access to this action." }).dependencies);
    assert.equal(forbidden.status, 403);
  });
});

describe("inventory form and state rules", () => {
  test("validates product fields the way the API does", () => {
    assert.equal(validateProductForm(form, "create"), "");
    assert.equal(validateProductForm({ ...form, name: "n".repeat(121) }, "create"), "Product name must be 120 characters or fewer.");
    assert.equal(validateProductForm({ ...form, sku: "s".repeat(41) }, "create"), "SKU must be 40 characters or fewer.");
    assert.equal(validateProductForm({ ...form, brand: "b".repeat(81) }, "create"), "Brand must be 80 characters or fewer.");
    assert.equal(validateProductForm({ ...form, shade: "h".repeat(81) }, "create"), "Shade must be 80 characters or fewer.");
    assert.equal(validateProductForm({ ...form, category: "Hair" }, "create"), "Choose one of the store categories.");
    assert.match(validateProductForm({ ...form, price: "10.999" }, "create"), /two decimal places/);
    assert.match(validateProductForm({ ...form, price: "-1" }, "create"), /nonnegative/);
    assert.equal(validateProductForm({ ...form, quantity: "1.5" }, "create"), "Opening quantity must be a nonnegative whole number.");
    assert.equal(validateProductForm({ ...form, quantity: "" }, "edit"), "");
  });

  test("keeps edit payloads free of quantity and refreshes quantity only from a movement", () => {
    const edited = updateProductPayload({ ...form, name: lipstick.name, category: lipstick.category, sku: lipstick.sku, brand: lipstick.brand, shade: lipstick.shade, price: String(lipstick.price), quantity: "1" }, lipstick);
    assert.equal(edited, null);
    const next = applyMovement([lipstick], { productId: lipstick.id, quantityAfter: 26 });
    assert.equal(next[0].quantity, 26);
    assert.equal(next[0].id, lipstick.id);
    assert.deepEqual(removeProduct(next, lipstick.id), []);
    const added = upsertProduct([], { ...lipstick, createdAt: "2026-11-21T02:00:00.000Z" });
    const older = upsertProduct(added, { ...lipstick, id: "older", createdAt: "2026-11-20T00:00:00.000Z" });
    assert.deepEqual(sortProducts(older).map((product) => product.id), [lipstick.id, "older"]);
  });

  test("restricts movement types by role and describes catalogue states", () => {
    assert.deepEqual(adminMovementTypes.map((type) => type.id), ["restock", "sale", "adjustment", "return"]);
    assert.deepEqual(employeeMovementTypes.map((type) => type.id), ["stock_out", "stock_in"]);
    assert.equal(validateMovementForm({ type: "restock", quantity: "1", note: "", direction: "out" }, employeeMovementTypes), "You do not have access to this action.");
    assert.equal(validateMovementForm({ type: "stock_out", quantity: "2", note: "", direction: "out" }, employeeMovementTypes), "");
    assert.equal(validateMovementForm({ type: "stock_out", quantity: "0", note: "", direction: "out" }, employeeMovementTypes), "Enter a whole number of units.");
    assert.equal(validateMovementForm({ type: "adjustment", quantity: "1", note: "", direction: "sideways" }, adminMovementTypes), "Direction must be in or out for an adjustment.");
    assert.equal(catalogView("loading", []), "loading");
    assert.equal(catalogView("idle", []), "loading");
    assert.equal(catalogView("error", []), "error");
    assert.equal(catalogView("ready", []), "empty");
    assert.equal(catalogView("ready", [lipstick]), "ready");
  });

  test("frontend source no longer persists products, movements, accounts, or tokens", () => {
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");
    const sources = walkSources(srcDir);
    assert.equal(sources.some((file) => file.endsWith("storage.js")), false);
    assert.equal(sources.some((file) => file.endsWith("starterData.js")), false);
    const retired = ["baore-session", "baore-users", "baore-items", "baore-movements"];
    const storageFiles = [];
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      if (source.includes("localStorage") || source.includes("sessionStorage")) storageFiles.push(file);
      assert.equal(source.includes("sessionStorage"), false, file);
      for (const key of retired) {
        assert.equal(source.includes(`localStorage.setItem("${key}"`), false, file);
        assert.equal(source.includes(`localStorage.getItem("${key}"`), false, file);
      }
    }
    assert.deepEqual(storageFiles.map((file) => file.replaceAll("\\", "/")).filter((file) => file.endsWith("src/state/AppState.jsx")).length, 1);
    assert.equal(storageFiles.length, 1);
    const appState = readFileSync(join(srcDir, "state", "AppState.jsx"), "utf8");
    for (const key of retired) {
      assert.equal(appState.includes(`localStorage.removeItem("${key}")`), true);
    }
    assert.equal(appState.includes("localStorage.setItem"), false);
    assert.equal(appState.includes("localStorage.getItem"), false);
    assert.equal(appState.includes("Date.now()"), false);
    assert.equal(appState.includes("openingStockNeedsRefresh"), true);
    assert.equal(appState.includes("catalogueTotals"), true);
    const api = readFileSync(join(srcDir, "lib", "api.js"), "utf8");
    assert.equal(api.includes("localStorage"), false);
    assert.equal(api.includes("sessionStorage"), false);
    assert.match(api, /rememberSession\(status, user = null\)/);
    const activity = readFileSync(join(srcDir, "components", "pages", "ActivityPage.jsx"), "utf8");
    const dashboard = readFileSync(join(srcDir, "components", "pages", "DashboardPage.jsx"), "utf8");
    assert.equal(activity.includes("movementProductLabel"), true);
    assert.equal(activity.includes("product?.name"), false);
    assert.equal(dashboard.includes("product?.name"), false);
    assert.equal(dashboard.includes("lowStockItems.length"), true);
    assert.equal(dashboard.includes("isAdmin ? lowStockCount"), false);
    assert.equal(appState.includes("lowStockProducts"), true);
    assert.equal(appState.includes("quantity) <= LOW_STOCK"), false);
    const inventory = readFileSync(join(srcDir, "components", "pages", "InventoryPage.jsx"), "utf8");
    assert.match(inventory, /Low stock alerts[\s\S]*lowStockItems\.length/);
  });

  test("derives dashboard totals and keeps movement snapshots after rename or delete", () => {
    const soldOut = { ...lipstick, id: "sold", quantity: 0, price: 10 };
    const low = { ...lipstick, id: "low", quantity: 5, price: 2.5 };
    const totals = catalogueTotals([lipstick, soldOut, low]);
    assert.equal(totals.productCount, 3);
    assert.equal(totals.totalUnits, 33);
    assert.equal(totals.inventoryValue, 28 * 399 + 12.5);
    assert.equal(totals.lowStock, 1);
    assert.equal(totals.outOfStock, 1);
    assert.equal(totals.inStock, 1);
    const shelf = [
      soldOut,
      { ...lipstick, id: "one", quantity: 1 },
      low,
      { ...lipstick, id: "six", quantity: 6 },
    ];
    assert.deepEqual(lowStockProducts(shelf).map((product) => product.quantity), [1, 5]);
    assert.equal(catalogueTotals(shelf).lowStock, lowStockProducts(shelf).length);
    assert.equal(catalogueTotals(shelf).outOfStock, 1);
    assert.equal(catalogueTotals(shelf).inStock, 1);
    assert.equal(stockStatus(0).label, "Out of stock");
    assert.notEqual(stockStatus(0).label, "Low stock");
    assert.deepEqual(catalogueTotals([]), {
      productCount: 0,
      totalUnits: 0,
      inventoryValue: 0,
      lowStock: 0,
      outOfStock: 0,
      inStock: 0,
    });
    assert.equal(catalogView("ready", []), "empty");
    assert.equal(roleLabel("user"), "Employee");
    assert.equal(roleLabel("admin"), "Admin");
    assert.equal(stockStatus(0).label, "Out of stock");
    assert.equal(stockStatus(1).label, "Low stock");
    assert.equal(stockStatus(5).label, "Low stock");
    assert.equal(stockStatus(6).label, "In stock");

    const movement = {
      id: "m1",
      productId: lipstick.id,
      productName: lipstick.name,
      sku: lipstick.sku,
      userId: "employee-id",
      type: "stock_out",
      quantity: 2,
      quantityAfter: 26,
    };
    const renamed = upsertProduct([lipstick], { ...lipstick, name: "Renamed Lipstick", sku: "LIP-999" });
    assert.equal(renamed[0].name, "Renamed Lipstick");
    assert.deepEqual(movementProductLabel(movement), { name: lipstick.name, sku: lipstick.sku });
    assert.equal(removeProduct(renamed, lipstick.id).length, 0);
    assert.equal(movementProductLabel(movement).name, lipstick.name);
    assert.equal(movementProductLabel({ productName: "  ", sku: "" }).name, "Removed product");

    const afterMovement = applyMovement([lipstick], movement);
    assert.equal(catalogueTotals(afterMovement).totalUnits, 26);
    assert.equal(catalogueTotals(afterMovement).inventoryValue, 26 * 399);
    const repriced = upsertProduct(afterMovement, { ...afterMovement[0], price: 10 });
    assert.equal(catalogueTotals(repriced).inventoryValue, 260);

    const employee = { id: "employee-id", username: "employee", role: "user" };
    const other = { ...movement, id: "m2", userId: "admin-id", productName: "Other shelf name" };
    assert.deepEqual(visibleMovements([movement, other], employee, "user").map((item) => item.id), ["m1"]);
    assert.equal(visibleMovements([movement, other], { id: "admin-id", role: "admin" }, "admin").length, 2);

    assert.equal(activityView("idle", []), "loading");
    assert.equal(activityView("loading", []), "loading");
    assert.equal(activityView("error", [movement]), "error");
    assert.equal(activityView("ready", []), "empty");
    assert.equal(activityView("ready", [movement]), "ready");
    assert.equal(openingStockNeedsRefresh({ quantity: 12 }), true);
    assert.equal(openingStockNeedsRefresh({ quantity: 0 }), false);
    assert.equal(catalogView("error", []), "error");
  });
});
