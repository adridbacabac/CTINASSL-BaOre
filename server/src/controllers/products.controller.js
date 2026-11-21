import { z } from "zod";
import { HttpError } from "../http/errors.js";
import { parseBody, parseObjectId } from "../http/validation.js";
import { CATEGORIES } from "../models/constants.js";
import { hasAtMostTwoDecimalPlaces, isNonnegativeInteger } from "../models/validators.js";
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "../services/products.js";

const CATEGORY_MESSAGE = `Category must be one of: ${CATEGORIES.join(", ")}.`;
const QUANTITY_MESSAGE = "Quantity must be a nonnegative whole number.";
const PRICE_MESSAGE = "Price must be a nonnegative peso amount with at most two decimal places.";
const QUANTITY_EDIT_MESSAGE = "Quantity cannot be edited here. Record a stock movement to change it.";

const nameSchema = z.string({ error: "Product name is required." })
  .trim()
  .min(1, "Product name is required.")
  .max(120, "Product name must be 120 characters or fewer.");

const categorySchema = z.enum(CATEGORIES, { error: CATEGORY_MESSAGE });

const skuSchema = z.string({ error: "SKU is required." })
  .trim()
  .toUpperCase()
  .min(1, "SKU is required.")
  .max(40, "SKU must be 40 characters or fewer.");

const brandSchema = z.string({ error: "Brand must be text." })
  .trim()
  .max(80, "Brand must be 80 characters or fewer.");

const shadeSchema = z.string({ error: "Shade must be text." })
  .trim()
  .max(80, "Shade must be 80 characters or fewer.");

const quantitySchema = z.number({ error: QUANTITY_MESSAGE })
  .refine((value) => isNonnegativeInteger(value) && Number.isSafeInteger(value), QUANTITY_MESSAGE);

const priceSchema = z.number({ error: PRICE_MESSAGE })
  .refine(hasAtMostTwoDecimalPlaces, PRICE_MESSAGE);

const createSchema = z.strictObject({
  name: nameSchema,
  category: categorySchema,
  sku: skuSchema,
  brand: brandSchema.optional(),
  shade: shadeSchema.optional(),
  quantity: quantitySchema.optional().default(0),
  price: priceSchema,
});

const updateSchema = z.strictObject({
  name: nameSchema.optional(),
  category: categorySchema.optional(),
  sku: skuSchema.optional(),
  brand: brandSchema.optional(),
  shade: shadeSchema.optional(),
  price: priceSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "Send at least one field to update.");

const listQuerySchema = z.strictObject({
  search: z.string({ error: "Search must be text." }).trim().max(100, "Search must be 100 characters or fewer.").optional(),
  category: categorySchema.optional(),
});

function productId(req) {
  return parseObjectId(req.params.id, "Invalid product id.");
}

function rejectQuantityEdit(body) {
  if (body && typeof body === "object" && !Array.isArray(body) && Object.hasOwn(body, "quantity")) {
    throw new HttpError(400, QUANTITY_EDIT_MESSAGE);
  }
}

export const productsController = {
  async list(req, res) {
    const query = parseBody(listQuerySchema, req.query);
    res.json({ products: await listProducts(query) });
  },

  async get(req, res) {
    res.json({ product: await getProduct(productId(req)) });
  },

  async create(req, res) {
    const input = parseBody(createSchema, req.body);
    const product = await createProduct(input, { actorId: req.user.id });
    res.status(201).json({ product });
  },

  async update(req, res) {
    const id = productId(req);
    rejectQuantityEdit(req.body);
    const changes = parseBody(updateSchema, req.body);
    res.json({ product: await updateProduct(id, changes) });
  },

  async remove(req, res) {
    await deleteProduct(productId(req));
    res.json({ message: "Product deleted." });
  },
};
