import { LOW_STOCK } from "./constants.js";

export function stockStatus(quantity) {
  const qty = Number(quantity);
  if (qty <= 0) return { label: "Out of stock", className: "out" };
  if (qty <= LOW_STOCK) return { label: "Low stock", className: "low" };
  return { label: "In stock", className: "ok" };
}

export function catalogueTotals(products) {
  return products.reduce((totals, product) => {
    const units = Number(product.quantity);
    const price = Number(product.price);
    const quantity = Number.isFinite(units) ? units : 0;
    const pesos = Number.isFinite(price) ? price : 0;
    totals.productCount += 1;
    totals.totalUnits += quantity;
    totals.inventoryValue += quantity * pesos;
    if (quantity <= 0) totals.outOfStock += 1;
    else if (quantity <= LOW_STOCK) totals.lowStock += 1;
    if (quantity <= LOW_STOCK) totals.needsAttention += 1;
    return totals;
  }, {
    productCount: 0,
    totalUnits: 0,
    inventoryValue: 0,
    lowStock: 0,
    outOfStock: 0,
    needsAttention: 0,
  });
}

export function movementDelta(movement) {
  if (movement.type === "sale" || movement.type === "stock_out") return -Number(movement.quantity);
  if (movement.type === "restock" || movement.type === "return" || movement.type === "stock_in") return Number(movement.quantity);
  return movement.direction === "out" ? -Number(movement.quantity) : Number(movement.quantity);
}

export function movementLabel(type) {
  const labels = { restock: "Restock", sale: "Sale", adjustment: "Adjustment", return: "Return", stock_in: "Stock in", stock_out: "Stock out" };
  return labels[type] || type;
}

export function roleLabel(role) {
  return role === "admin" ? "Admin" : "Employee";
}
