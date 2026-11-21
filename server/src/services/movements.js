import { HttpError } from "../http/errors.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { runTransaction } from "./transaction.js";

const NOT_FOUND = "Product not found.";
const FORBIDDEN = "You do not have access to this action.";
const INSUFFICIENT = "There is not enough stock for that movement.";

const ADMIN_MOVEMENT_TYPES = ["restock", "sale", "adjustment", "return"];
const USER_MOVEMENT_TYPES = ["stock_in", "stock_out"];

function isoDate(value) {
  return value instanceof Date ? value.toISOString() : null;
}

// Same effect as src/lib/stock.js movementDelta. The server does not import the frontend module.
export function movementDelta(movement) {
  if (movement.type === "sale" || movement.type === "stock_out") return -movement.quantity;
  if (movement.type === "restock" || movement.type === "return" || movement.type === "stock_in") return movement.quantity;
  return movement.direction === "out" ? -movement.quantity : movement.quantity;
}

export function movementProfile(movement) {
  const profile = {
    id: String(movement._id),
    productId: String(movement.productId),
    productName: movement.productName,
    sku: movement.sku,
    userId: String(movement.userId),
    type: movement.type,
    quantity: movement.quantity,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    createdAt: isoDate(movement.createdAt),
  };
  if (movement.direction) profile.direction = movement.direction;
  if (movement.note) profile.note = movement.note;
  return profile;
}

export async function listMovements({ userId } = {}) {
  const filter = userId ? { userId } : {};
  const movements = await StockMovement.find(filter).sort({ createdAt: -1, _id: -1 });
  return movements.map(movementProfile);
}

export async function recordMovement(input, { actorId, actorRole }) {
  return runTransaction(async (session) => {
    const product = await Product.findById(input.productId).session(session);
    if (!product) throw new HttpError(404, NOT_FOUND);

    const allowed = actorRole === "admin" ? ADMIN_MOVEMENT_TYPES : USER_MOVEMENT_TYPES;
    if (!allowed.includes(input.type)) throw new HttpError(403, FORBIDDEN);

    const delta = movementDelta(input);
    const filter = delta < 0
      ? { _id: product._id, quantity: { $gte: input.quantity } }
      : { _id: product._id };
    const before = await Product.findOneAndUpdate(
      filter,
      { $inc: { quantity: delta } },
      { session, returnDocument: "before", timestamps: true },
    );
    if (!before) throw new HttpError(delta < 0 ? 409 : 404, delta < 0 ? INSUFFICIENT : NOT_FOUND);

    const [movement] = await StockMovement.create([{
      productId: before._id,
      userId: actorId,
      type: input.type,
      quantity: input.quantity,
      ...(input.type === "adjustment" ? { direction: input.direction } : {}),
      ...(input.note ? { note: input.note } : {}),
      quantityBefore: before.quantity,
      quantityAfter: before.quantity + delta,
      productName: before.name,
      sku: before.sku,
    }], { session, ordered: true });
    return movementProfile(movement);
  });
}
