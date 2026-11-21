import mongoose from "mongoose";
import { ADJUSTMENT_DIRECTIONS, MOVEMENT_TYPES } from "./constants.js";
import { isNonnegativeInteger, isPositiveInteger } from "./validators.js";

const stockMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true, enum: MOVEMENT_TYPES },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: isPositiveInteger,
        message: "Movement quantity must be a positive integer.",
      },
    },
    direction: {
      type: String,
      enum: ADJUSTMENT_DIRECTIONS,
      required() {
        return this.type === "adjustment";
      },
      validate: {
        validator(value) {
          if (this.type === "adjustment") {
            return value === "in" || value === "out";
          }
          return value === undefined || value === null;
        },
        message: "Direction is required for adjustments and must be omitted for other movement types.",
      },
    },
    note: { type: String, trim: true },
    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonnegativeInteger,
        message: "quantityBefore must be a nonnegative integer.",
      },
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isNonnegativeInteger,
        message: "quantityAfter must be a nonnegative integer.",
      },
    },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
  },
  {
    collection: "stockMovements",
    timestamps: { createdAt: true, updatedAt: false },
    autoCreate: false,
    autoIndex: false,
  },
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ userId: 1, createdAt: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
