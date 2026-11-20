import { LOW_STOCK } from "./constants";

export function stockStatus(quantity) {
  const qty = Number(quantity);
  if (qty <= 0) return { label: "Out of stock", className: "out" };
  if (qty <= LOW_STOCK) return { label: "Low stock", className: "low" };
  return { label: "In stock", className: "ok" };
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
  return role === "admin" ? "Admin" : "User";
}
