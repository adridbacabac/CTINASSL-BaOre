import { categories } from "./constants.js";

const NAME_LIMIT = 120;
const SKU_LIMIT = 40;
const BRAND_LIMIT = 80;
const SHADE_LIMIT = 80;
const MOVEMENT_TYPES = ["restock", "sale", "adjustment", "return", "stock_in", "stock_out"];

function hasAtMostTwoDecimalPlaces(value) {
  if (!Number.isFinite(value) || value < 0) return false;
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-8;
}

export function normalizeProduct(product) {
  if (!product || typeof product !== "object" || typeof product.id !== "string") return null;
  if (!categories.includes(product.category)) return null;
  if (typeof product.name !== "string" || typeof product.sku !== "string") return null;
  if (!Number.isInteger(product.quantity) || product.quantity < 0) return null;
  if (typeof product.price !== "number" || !hasAtMostTwoDecimalPlaces(product.price)) return null;
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    sku: product.sku,
    brand: typeof product.brand === "string" ? product.brand : "",
    shade: typeof product.shade === "string" ? product.shade : "",
    quantity: product.quantity,
    price: product.price,
    stockStatus: typeof product.stockStatus === "string" ? product.stockStatus : null,
    createdAt: typeof product.createdAt === "string" ? product.createdAt : null,
    updatedAt: typeof product.updatedAt === "string" ? product.updatedAt : null,
  };
}

export function normalizeMovement(movement) {
  if (!movement || typeof movement !== "object") return null;
  if (typeof movement.id !== "string" || typeof movement.productId !== "string" || typeof movement.userId !== "string") return null;
  if (!MOVEMENT_TYPES.includes(movement.type)) return null;
  if (!Number.isInteger(movement.quantity) || movement.quantity <= 0) return null;
  if (!Number.isInteger(movement.quantityBefore) || movement.quantityBefore < 0) return null;
  if (!Number.isInteger(movement.quantityAfter) || movement.quantityAfter < 0) return null;
  const profile = {
    id: movement.id,
    productId: movement.productId,
    productName: typeof movement.productName === "string" ? movement.productName : "",
    sku: typeof movement.sku === "string" ? movement.sku : "",
    userId: movement.userId,
    type: movement.type,
    quantity: movement.quantity,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    createdAt: typeof movement.createdAt === "string" ? movement.createdAt : null,
  };
  if (movement.direction === "in" || movement.direction === "out") profile.direction = movement.direction;
  if (typeof movement.note === "string" && movement.note) profile.note = movement.note;
  return profile;
}

export function sortProducts(products) {
  return [...products].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id));
}

export function upsertProduct(products, product) {
  const exists = products.some((item) => item.id === product.id);
  const next = exists
    ? products.map((item) => (item.id === product.id ? product : item))
    : [product, ...products];
  return sortProducts(next);
}

export function removeProduct(products, id) {
  return products.filter((product) => product.id !== id);
}

export function applyMovement(products, movement) {
  return products.map((product) => (
    product.id === movement.productId ? { ...product, quantity: movement.quantityAfter } : product
  ));
}

export function catalogView(status, products) {
  if (status === "loading" || status === "idle") return "loading";
  if (status === "error") return "error";
  if (!products.length) return "empty";
  return "ready";
}

export function activityView(status, movements) {
  if (status === "loading" || status === "idle") return "loading";
  if (status === "error") return "error";
  if (!movements.length) return "empty";
  return "ready";
}

export function movementProductLabel(movement) {
  const name = typeof movement?.productName === "string" ? movement.productName.trim() : "";
  const sku = typeof movement?.sku === "string" ? movement.sku.trim() : "";
  return { name: name || "Removed product", sku };
}

export function openingStockNeedsRefresh(product) {
  return Number(product?.quantity) > 0;
}

export function validateProductForm(form, mode) {
  const name = form.name.trim();
  const sku = form.sku.trim();
  const brand = form.brand.trim();
  const shade = form.shade.trim();
  if (!name) return "Product name is required.";
  if (name.length > NAME_LIMIT) return "Product name must be 120 characters or fewer.";
  if (!sku) return "SKU is required.";
  if (sku.length > SKU_LIMIT) return "SKU must be 40 characters or fewer.";
  if (!categories.includes(form.category)) return "Choose one of the store categories.";
  if (brand.length > BRAND_LIMIT) return "Brand must be 80 characters or fewer.";
  if (shade.length > SHADE_LIMIT) return "Shade must be 80 characters or fewer.";
  const price = Number(form.price);
  if (form.price === "" || !Number.isFinite(price) || !hasAtMostTwoDecimalPlaces(price)) {
    return "Price must be a nonnegative peso amount with at most two decimal places.";
  }
  if (mode === "create") {
    const quantity = Number(form.quantity);
    if (form.quantity === "" || !Number.isInteger(quantity) || quantity < 0) {
      return "Opening quantity must be a nonnegative whole number.";
    }
  }
  return "";
}

export function createProductPayload(form) {
  const payload = {
    name: form.name.trim(),
    category: form.category,
    sku: form.sku.trim().toUpperCase(),
    price: Number(form.price),
    quantity: Number(form.quantity),
  };
  if (form.brand.trim()) payload.brand = form.brand.trim();
  if (form.shade.trim()) payload.shade = form.shade.trim();
  return payload;
}

export function updateProductPayload(form, product) {
  const changes = {};
  const name = form.name.trim();
  const sku = form.sku.trim().toUpperCase();
  const brand = form.brand.trim();
  const shade = form.shade.trim();
  const price = Number(form.price);
  if (name !== product.name) changes.name = name;
  if (sku !== product.sku) changes.sku = sku;
  if (form.category !== product.category) changes.category = form.category;
  if (brand !== (product.brand || "")) changes.brand = brand;
  if (shade !== (product.shade || "")) changes.shade = shade;
  if (price !== product.price) changes.price = price;
  return Object.keys(changes).length ? changes : null;
}

export function validateMovementForm(form, allowedTypes) {
  if (!allowedTypes.some((type) => type.id === form.type)) return "You do not have access to this action.";
  const quantity = Number(form.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return "Enter a whole number of units.";
  if (form.type === "adjustment" && form.direction !== "in" && form.direction !== "out") {
    return "Direction must be in or out for an adjustment.";
  }
  return "";
}

export function movementPayload(form, productId) {
  const payload = {
    productId,
    type: form.type,
    quantity: Number(form.quantity),
  };
  const note = form.note.trim();
  if (note) payload.note = note;
  if (form.type === "adjustment") payload.direction = form.direction === "out" ? "out" : "in";
  return payload;
}
