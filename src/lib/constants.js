export const categories = ["Face", "Eyes", "Lips", "Cheeks", "Tools & Brushes", "Skincare"];
export const emptyProduct = { name: "", category: "Face", sku: "", quantity: "", price: "", brand: "Ba'Oré", shade: "" };
export const emptyAccount = { name: "", email: "", username: "", password: "", role: "user" };
export const LOW_STOCK = 5;

export const employeeMovementTypes = [
  { id: "stock_out", label: "Stock out" },
  { id: "stock_in", label: "Stock in" },
];

export const adminMovementTypes = [
  { id: "restock", label: "Restock" },
  { id: "sale", label: "Sale" },
  { id: "adjustment", label: "Adjustment" },
  { id: "return", label: "Return" },
];
