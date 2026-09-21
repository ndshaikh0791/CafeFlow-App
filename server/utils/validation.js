import { z } from "zod";
const text = z.string().trim().min(1).max(200),
  optional = z.string().trim().max(2000).default(""),
  num = z.coerce.number().finite().nonnegative(),
  id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID"),
  bool = z.boolean();
const option = z.object({ name: text, price: num });
export const schemas = {
  categories: z.object({ name: text, description: optional }),
  products: z.object({
    name: text,
    description: optional,
    category: id,
    price: num,
    costPrice: num.default(0),
    tax: num.max(100).default(5),
    image: z
      .string()
      .max(2000)
      .refine(
        (v) =>
          !v || /^https?:\/\//.test(v) || /^\/menu-art\/[a-z-]+\.svg$/.test(v),
        "Use an http(s) image URL or a bundled /menu-art/name.svg asset",
      )
      .default(""),
    sku: text,
    prepTime: num.max(240).default(5),
    veg: bool.default(true),
    active: bool.default(true),
    available: bool.default(true),
    variants: z.array(option).max(20).default([]),
    addons: z.array(option).max(30).default([]),
    modifiers: z.array(text).max(20).default([]),
  }),
  tables: z.object({
    name: text,
    capacity: num.int().min(1).max(50),
    status: z.enum(["available", "reserved", "cleaning"]).default("available"),
  }),
  customers: z.object({
    name: text,
    phone: optional,
    email: z.union([z.email(), z.literal("")]).default(""),
    notes: optional,
  }),
  inventory: z.object({
    name: text,
    sku: text,
    category: optional,
    quantity: num.default(0),
    unit: z.enum(["kg", "g", "L", "ml", "pcs"]),
    minStock: num,
    costPerUnit: num,
    supplier: optional,
  }),
  recipes: z.object({
    product: id,
    ingredients: z
      .array(z.object({ ingredient: id, quantity: num.positive() }))
      .min(1)
      .max(50),
  }),
  expenses: z.object({
    title: text,
    category: z.enum([
      "Rent",
      "Electricity",
      "Ingredients",
      "Salary",
      "Maintenance",
      "Marketing",
      "Other",
    ]),
    amount: num.positive(),
    date: z.coerce.date(),
    paymentMethod: z.enum(["cash", "upi", "card"]),
    notes: optional,
  }),
  discounts: z
    .object({
      code: text.transform((v) => v.toUpperCase()),
      description: optional,
      type: z.enum(["percentage", "flat"]),
      value: num.positive(),
      minOrder: num.default(0),
      maxDiscount: num.default(0),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      active: bool.default(true),
      product: z
        .union([id, z.literal("")])
        .optional()
        .transform((v) => v || null),
    })
    .refine((v) => v.endDate >= v.startDate, "End date must follow start date")
    .refine(
      (v) => v.type !== "percentage" || v.value <= 100,
      "Percentage cannot exceed 100",
    ),
  staff: z.object({
    name: text,
    email: z.email().transform((v) => v.toLowerCase()),
    phone: optional,
    role: z.enum(["owner", "manager", "cashier", "kitchen"]),
    active: bool.default(true),
    password: z.string().min(10).max(100).optional(),
  }),
  settings: z.object({
    name: text,
    logo: z
      .string()
      .max(2000)
      .refine((v) => !v || /^https?:\/\//.test(v), "Use an http(s) logo URL")
      .default(""),
    phone: optional,
    email: optional,
    address: optional,
    currency: z.enum(["INR", "USD", "EUR", "GBP"]),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
    tax: num.max(100),
    serviceCharge: num.max(100),
    orderPrefix: z.string().regex(/^[A-Z0-9-]{1,10}$/),
    allowNegativeStock: bool,
    defaultOrderType: z.enum(["dine-in", "takeaway", "delivery"]),
    receiptHeader: optional,
    receiptFooter: optional,
    showTax: bool,
    receiptSize: z.enum(["58", "80"]),
    qrEnabled: bool,
    loyaltyEnabled: bool,
    pointsPerAmount: num.positive(),
    minRedeem: num.int().positive(),
    pointValue: num.positive(),
  }),
};
export const orderInput = z.object({
  idempotencyKey: z.string().uuid(),
  type: z.enum(["dine-in", "takeaway", "delivery"]),
  table: id.optional(),
  customer: id.optional(),
  items: z
    .array(
      z.object({
        product: id,
        quantity: num.int().min(1).max(100),
        variant: z.string().max(200).default(""),
        addons: z.array(z.string().max(200)).max(30).default([]),
        modifiers: z.array(z.string().max(200)).max(20).default([]),
        notes: z.string().max(500).default(""),
      }),
    )
    .min(1)
    .max(100),
  notes: z.string().max(2000).default(""),
  deliveryAddress: z.string().max(1000).default(""),
  discountCode: z.string().max(200).default(""),
  redeemPoints: num.int().default(0),
  manualDiscount: num.default(0),
});
export const paymentInput = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "upi", "card"]),
        amount: num,
        reference: z.string().max(200).default(""),
      }),
    )
    .min(1)
    .max(5),
});
