import { HttpError } from "../http/errors.js";
import { Product, deriveStockStatus } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { runTransaction } from "./transaction.js";

const NOT_FOUND = "Product not found.";
const DUPLICATE_SKU = "That SKU is already in use.";
export const OPENING_STOCK_NOTE = "Opening stock";

function isoDate(value) {
  return value instanceof Date ? value.toISOString() : null;
}

export function productProfile(product) {
  return {
    id: String(product._id),
    name: product.name,
    category: product.category,
    sku: product.sku,
    brand: product.brand,
    shade: product.shade,
    quantity: product.quantity,
    price: product.price,
    stockStatus: deriveStockStatus(product.quantity),
    createdAt: isoDate(product.createdAt),
    updatedAt: isoDate(product.updatedAt),
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function rethrowDuplicate(task) {
  try {
    return await task();
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, DUPLICATE_SKU);
    throw error;
  }
}

async function assertSkuAvailable(sku, exceptId, session) {
  const filter = exceptId ? { sku, _id: { $ne: exceptId } } : { sku };
  const query = Product.exists(filter);
  if (session) query.session(session);
  if (await query) throw new HttpError(409, DUPLICATE_SKU);
}

export async function listProducts({ search, category } = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }, { category: pattern }, { shade: pattern }];
  }
  const products = await Product.find(filter).sort({ createdAt: 1, _id: 1 });
  return products.map(productProfile);
}

export async function getProduct(id) {
  const product = await Product.findById(id);
  if (!product) throw new HttpError(404, NOT_FOUND);
  return productProfile(product);
}

export async function createProduct(input, { actorId }) {
  return rethrowDuplicate(() => runTransaction(async (session) => {
    await assertSkuAvailable(input.sku, null, session);
    const [product] = await Product.create([input], { session, ordered: true });
    if (product.quantity > 0) {
      await StockMovement.create([{
        productId: product._id,
        userId: actorId,
        type: "restock",
        quantity: product.quantity,
        note: OPENING_STOCK_NOTE,
        quantityBefore: 0,
        quantityAfter: product.quantity,
        productName: product.name,
        sku: product.sku,
      }], { session, ordered: true });
    }
    return productProfile(product);
  }));
}

export async function updateProduct(id, changes) {
  return rethrowDuplicate(async () => {
    if (changes.sku !== undefined) await assertSkuAvailable(changes.sku, id);
    const product = await Product.findOneAndUpdate(
      { _id: id },
      { $set: changes },
      { new: true, runValidators: true },
    );
    if (!product) throw new HttpError(404, NOT_FOUND);
    return productProfile(product);
  });
}

export async function deleteProduct(id) {
  const result = await Product.deleteOne({ _id: id });
  if (result.deletedCount !== 1) throw new HttpError(404, NOT_FOUND);
}
