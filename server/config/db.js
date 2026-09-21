import mongoose from "mongoose";
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error("MONGODB_URI is required. See .env.example.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}
