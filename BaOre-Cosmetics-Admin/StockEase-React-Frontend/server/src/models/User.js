import mongoose from "mongoose";
import { ROLES } from "./constants.js";

function hidePasswordHash(_doc, ret) {
  delete ret.passwordHash;
  return ret;
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value) => value.includes("@"),
        message: "Email must contain @.",
      },
    },
    username: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES },
  },
  {
    collection: "users",
    timestamps: { createdAt: true, updatedAt: false },
    autoCreate: false,
    autoIndex: false,
    toJSON: { transform: hidePasswordHash },
    toObject: { transform: hidePasswordHash },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
