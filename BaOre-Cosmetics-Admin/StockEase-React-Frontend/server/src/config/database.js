import mongoose from "mongoose";

export async function connectDatabase(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const { name, host } = mongoose.connection;
  console.log(`MongoDB connected: ${name} via ${host}`);
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
