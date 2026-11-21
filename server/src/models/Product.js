import mongoose from "mongoose";
import { CATEGORIES, LOW_STOCK_THRESHOLD } from "./constants.js";
import { hasAtMostTwoDecimalPlaces, isNonnegativeInteger } from "./validators.js";

export function deriveStockStatus(quantity) {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    sku: { type: String, required: true, trim: true, uppercase: true },
    brand: { type: String, trim: true, default: "Ba'Oré" },
    shade: { type: String, trim: true, default: "" },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonnegativeInteger,
        message: "Quantity must be a nonnegative integer.",
      },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: hasAtMostTwoDecimalPlaces,
        message: "Price must be a nonnegative peso amount with at most two decimal places.",
      },
    },
  },
  {
    collection: "products",
    timestamps: true,
    autoCreate: false,
    autoIndex: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productSchema.virtual("stockStatus").get(function stockStatus() {
  return deriveStockStatus(this.quantity);
});

productSchema.index({ sku: 1 }, { unique: true });

export const Product = mongoose.model("Product", productSchema);
