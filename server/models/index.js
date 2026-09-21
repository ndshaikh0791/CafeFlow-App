import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = false) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const money = { type: Number, min: 0, default: 0 };
const schema = (fields) => new Schema(fields, { timestamps: true });
const variantSchema = schema({
  name: { type: String, required: true },
  price: money,
});
const addonSchema = schema({
  name: { type: String, required: true },
  price: money,
});
export const Variant = model("Variant", variantSchema);
export const Addon = model("Addon", addonSchema);
export const User = model(
  "User",
  schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: String,
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["owner", "manager", "cashier", "kitchen"],
      default: "cashier",
    },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    resetHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  }),
);
export const Staff = User;
export const Category = model(
  "Category",
  schema({
    name: { type: String, required: true, unique: true },
    description: String,
  }),
);
export const Product = model(
  "Product",
  schema({
    name: { type: String, required: true },
    description: String,
    category: ref("Category", true),
    price: money,
    costPrice: money,
    tax: { type: Number, min: 0, max: 100, default: 5 },
    image: String,
    sku: { type: String, required: true, unique: true },
    prepTime: { type: Number, min: 0, default: 5 },
    veg: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
    variants: [variantSchema],
    addons: [addonSchema],
    modifiers: [String],
  }),
);
export const Table = model(
  "Table",
  schema({
    name: { type: String, required: true, unique: true },
    capacity: { type: Number, min: 1, default: 2 },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "cleaning"],
      default: "available",
    },
    currentOrder: ref("Order"),
    qrToken: { type: String, required: true, unique: true },
  }),
);
export const Customer = model(
  "Customer",
  schema({
    name: { type: String, required: true },
    phone: String,
    email: String,
    notes: String,
    points: { type: Number, default: 0, min: 0 },
    earnedPoints: { type: Number, default: 0 },
    redeemedPoints: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSpend: money,
    lastVisit: Date,
  }),
);
export const InventoryItem = model(
  "InventoryItem",
  schema({
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    category: String,
    quantity: { type: Number, default: 0 },
    unit: { type: String, enum: ["kg", "g", "L", "ml", "pcs"], required: true },
    minStock: money,
    costPerUnit: money,
    supplier: String,
  }),
);
export const Recipe = model(
  "Recipe",
  schema({
    product: { ...ref("Product", true), unique: true },
    ingredients: [
      {
        ingredient: ref("InventoryItem", true),
        quantity: { type: Number, required: true, min: 0.000001 },
      },
    ],
  }),
);
export const Expense = model(
  "Expense",
  schema({
    title: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "Rent",
        "Electricity",
        "Ingredients",
        "Salary",
        "Maintenance",
        "Marketing",
        "Other",
      ],
      required: true,
    },
    amount: money,
    date: { type: Date, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card"],
      default: "cash",
    },
    notes: String,
  }),
);
export const Discount = model(
  "Discount",
  schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    description: String,
    type: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    value: money,
    minOrder: money,
    maxDiscount: money,
    startDate: Date,
    endDate: Date,
    active: { type: Boolean, default: true },
    product: ref("Product"),
  }),
);
const orderItemSchema = new Schema({
  product: ref("Product", true),
  name: String,
  category: String,
  quantity: { type: Number, min: 1, required: true },
  price: money,
  tax: money,
  variant: String,
  addons: [{ name: String, price: money }],
  modifiers: [String],
  notes: String,
  cost: money,
});
export const OrderItem = model("OrderItem", orderItemSchema);
export const Order = model(
  "Order",
  schema({
    number: { type: String, unique: true, required: true },
    idempotencyKey: { type: String, unique: true, required: true },
    requestHash: String,
    trackingToken: { type: String, required: true },
    source: { type: String, enum: ["pos", "qr"], required: true },
    type: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      required: true,
    },
    table: ref("Table"),
    tableName: String,
    customer: ref("Customer"),
    cashier: ref("User"),
    cashierName: String,
    items: [orderItemSchema],
    notes: String,
    deliveryAddress: String,
    status: {
      type: String,
      enum: [
        "new",
        "accepted",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      default: "new",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    subtotal: money,
    discount: money,
    discountCode: String,
    tax: money,
    serviceCharge: money,
    total: money,
    redeemedPoints: { type: Number, default: 0 },
    stockDeducted: { type: Boolean, default: false },
    stockUsage: [{ ingredient: ref("InventoryItem"), quantity: Number }],
    recipeSnapshot: { type: Boolean, default: false },
    currency: { type: String, default: "INR" },
    paidAt: Date,
    completedAt: Date,
    cancelReason: String,
  }),
);
export const Payment = model(
  "Payment",
  schema({
    order: ref("Order", true),
    method: { type: String, enum: ["cash", "upi", "card"], required: true },
    amount: money,
    reference: String,
  }),
);
export const StockTransaction = model(
  "StockTransaction",
  schema({
    ingredient: ref("InventoryItem", true),
    delta: Number,
    reason: String,
    order: ref("Order"),
    user: ref("User"),
  }),
);
export const Settings = model(
  "Settings",
  schema({
    key: { type: String, unique: true, default: "main" },
    name: { type: String, default: "The Daily Grind" },
    logo: String,
    phone: String,
    email: String,
    address: String,
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    tax: { type: Number, min: 0, max: 100, default: 5 },
    serviceCharge: { type: Number, min: 0, max: 100, default: 0 },
    orderPrefix: { type: String, default: "CF" },
    allowNegativeStock: { type: Boolean, default: false },
    defaultOrderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      default: "dine-in",
    },
    receiptHeader: {
      type: String,
      default: "Freshly brewed. Thoughtfully served.",
    },
    receiptFooter: {
      type: String,
      default: "Thank you for spending a little of your day with us.",
    },
    showTax: { type: Boolean, default: true },
    receiptSize: { type: String, enum: ["58", "80"], default: "80" },
    qrEnabled: { type: Boolean, default: true },
    loyaltyEnabled: { type: Boolean, default: true },
    pointsPerAmount: { type: Number, min: 1, default: 100 },
    minRedeem: { type: Number, min: 1, default: 10 },
    pointValue: { type: Number, min: 0.01, default: 1 },
  }),
);
export const Counter = model(
  "Counter",
  new Schema({ _id: String, value: { type: Number, default: 0 } }),
);
export const HeldOrder = model(
  "HeldOrder",
  schema({
    user: ref("User", true),
    name: String,
    cart: { type: Schema.Types.Mixed, required: true },
  }),
);
Order.schema.index({ createdAt: -1, status: 1 });
