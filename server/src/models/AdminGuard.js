import mongoose from "mongoose";
import { ADMIN_GUARD_ID } from "./constants.js";
import { isNonnegativeInteger } from "./validators.js";

const adminGuardSchema = new mongoose.Schema(
  {
    _id: { type: String, default: ADMIN_GUARD_ID },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: isNonnegativeInteger,
        message: "Revision must be a nonnegative integer.",
      },
    },
  },
  {
    collection: "adminGuards",
    timestamps: false,
    autoCreate: false,
    autoIndex: false,
  },
);

adminGuardSchema.pre("validate", function enforceSingletonId() {
  if (this._id !== ADMIN_GUARD_ID) {
    this.invalidate("_id", "Admin guard identifier must be admin-membership.");
  }
});

export const AdminGuard = mongoose.model("AdminGuard", adminGuardSchema);
