import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { connectDB } from "./config/db.js";
import * as M from "./models/index.js";
import { createOrder, payOrder, changeStatus } from "./services/orders.js";
export async function seed(password) {
  if (!password || password.length < 10)
    throw new Error(
      "Set SEED_PASSWORD to a password of at least 10 characters",
    );
  if (await M.User.exists({}))
    throw new Error(
      "Database already contains users. Seed only a fresh database.",
    );
  const users = await M.User.create(
    await Promise.all(
      ["owner", "manager", "cashier", "kitchen"].map(async (role) => ({
        name: {
          owner: "Alex Morgan",
          manager: "Sam Patel",
          cashier: "Jamie Lee",
          kitchen: "Taylor Brooks",
        }[role],
        email: `${role}@cafeflow.local`,
        role,
        password: await bcrypt.hash(password, 12),
      })),
    ),
  );
  await M.Settings.create({
    name: "The Daily Grind",
    address: "24 Park Lane, Bengaluru",
    phone: "+91 80 5550 2400",
    email: "hello@dailygrind.example",
  });
  const cats = await M.Category.create(
    [
      "Coffee",
      "Tea",
      "Cold Beverages",
      "Breakfast",
      "Snacks",
      "Pizza",
      "Desserts",
    ].map((name) => ({
      name,
      description: `Freshly made ${name.toLowerCase()}`,
    })),
  );
  const ingredients = await M.InventoryItem.create([
    {
      name: "Coffee beans",
      sku: "INV-BEANS",
      quantity: 8000,
      unit: "g",
      minStock: 1000,
      costPerUnit: 1.2,
      supplier: "Hill Country Roasters",
    },
    {
      name: "Whole milk",
      sku: "INV-MILK",
      quantity: 25000,
      unit: "ml",
      minStock: 3000,
      costPerUnit: 0.06,
      supplier: "Morning Dairy",
    },
    {
      name: "Takeaway cups",
      sku: "INV-CUP",
      quantity: 180,
      unit: "pcs",
      minStock: 200,
      costPerUnit: 5,
      supplier: "Green Pack",
    },
    {
      name: "Bread",
      sku: "INV-BREAD",
      quantity: 60,
      unit: "pcs",
      minStock: 15,
      costPerUnit: 8,
      supplier: "Rise Bakery",
    },
    {
      name: "Pizza dough",
      sku: "INV-DOUGH",
      quantity: 20,
      unit: "pcs",
      minStock: 5,
      costPerUnit: 40,
      supplier: "In-house",
    },
    {
      name: "Chocolate",
      sku: "INV-CHOCO",
      quantity: 4000,
      unit: "g",
      minStock: 500,
      costPerUnit: 0.7,
      supplier: "Cocoa Works",
    },
  ]);
  const rows = [
    ["Espresso", 0, 120, "A rich double shot with a golden crema.", "espresso"],
    [
      "Americano",
      0,
      150,
      "Our signature espresso, lengthened with hot water.",
      "americano",
    ],
    [
      "Cappuccino",
      0,
      190,
      "Equal parts espresso, steamed milk, and silky foam.",
      "cappuccino",
    ],
    [
      "Cafe Latte",
      0,
      210,
      "Smooth espresso meets beautifully textured milk.",
      "latte",
    ],
    [
      "Cold Coffee",
      2,
      220,
      "Slow brewed, chilled, and poured over ice.",
      "cold-coffee",
    ],
    [
      "Masala Tea",
      1,
      90,
      "Warming Indian spices, black tea, and milk.",
      "masala-tea",
    ],
    [
      "Green Tea",
      1,
      100,
      "Delicate green tea with a clean, refreshing finish.",
      "green-tea",
    ],
    [
      "Veg Sandwich",
      3,
      180,
      "Garden vegetables and cheese on toasted sourdough.",
      "sandwich",
    ],
    [
      "French Fries",
      4,
      140,
      "Golden fries with sea salt and house dip.",
      "fries",
    ],
    [
      "Margherita Pizza",
      5,
      360,
      "Tomato, fresh mozzarella, and fragrant basil.",
      "pizza",
    ],
    [
      "Chocolate Brownie",
      6,
      160,
      "Fudgy dark chocolate with a delicate crisp top.",
      "brownie",
    ],
  ];
  const products = await M.Product.create(
    rows.map(([name, cat, price, description, img], i) => ({
      name,
      category: cats[cat]._id,
      price,
      description,
      sku: `MENU-${String(i + 1).padStart(3, "0")}`,
      costPrice: price * 0.3,
      image: `/menu-art/${img}.svg`,
      prepTime: cat === 5 ? 15 : 5,
      variants:
        cat === 0
          ? [
              { name: "Regular", price },
              { name: "Large", price: price + 40 },
            ]
          : [],
      addons:
        cat === 0
          ? [
              { name: "Extra shot", price: 40 },
              { name: "Caramel", price: 30 },
            ]
          : [],
      modifiers: cat === 0 ? ["Decaf", "Less sugar", "Extra hot"] : [],
    })),
  );
  await M.Recipe.create(
    products.slice(0, 5).map((p, i) => ({
      product: p._id,
      ingredients: [
        { ingredient: ingredients[0]._id, quantity: 18 },
        ...(i > 1 ? [{ ingredient: ingredients[1]._id, quantity: 180 }] : []),
        { ingredient: ingredients[2]._id, quantity: 1 },
      ],
    })),
  );
  await M.Recipe.create({
    product: products[7]._id,
    ingredients: [{ ingredient: ingredients[3]._id, quantity: 2 }],
  });
  await M.Table.create(
    Array.from({ length: 8 }, (_, i) => ({
      name: `T${String(i + 1).padStart(2, "0")}`,
      capacity: i < 4 ? 2 : 4,
      status: i === 7 ? "reserved" : "available",
      qrToken: crypto.randomBytes(24).toString("hex"),
    })),
  );
  const customers = await M.Customer.create([
    {
      name: "Priya Sharma",
      phone: "9876543210",
      email: "priya@example.com",
      notes: "Prefers oat milk",
    },
    { name: "Arjun Mehta", phone: "9876543211", email: "arjun@example.com" },
    { name: "Maya Chen", phone: "9876543212", email: "maya@example.com" },
  ]);
  await M.Discount.create({
    code: "WELCOME10",
    description: "A little welcome from us",
    type: "percentage",
    value: 10,
    minOrder: 200,
    maxDiscount: 100,
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 365 * 86400000),
    active: true,
  });
  await M.Expense.create([
    {
      title: "Monthly studio rent",
      category: "Rent",
      amount: 24000,
      date: new Date(),
      paymentMethod: "upi",
    },
    {
      title: "Weekly produce delivery",
      category: "Ingredients",
      amount: 1800,
      date: new Date(),
      paymentMethod: "cash",
    },
  ]);
  for (let i = 0; i < 16; i++) {
    const order = await createOrder(
      {
        idempotencyKey: crypto.randomUUID(),
        type: "takeaway",
        customer: customers[i % 3].id,
        items: [
          { product: products[i % products.length].id, quantity: 1 + (i % 3) },
        ],
      },
      users[0],
    );
    if (i < 13) {
      await payOrder(
        order.id,
        {
          payments: [
            { method: ["cash", "upi", "card"][i % 3], amount: order.total },
          ],
        },
        users[0],
      );
      for (const status of [
        "accepted",
        "preparing",
        "ready",
        "served",
        "completed",
      ])
        await changeStatus(order.id, status, users[0]);
      if (i < 9) {
        const date = new Date(Date.now() - (1 + (i % 6)) * 86400000);
        await M.Order.updateOne(
          { _id: order._id },
          { $set: { paidAt: date, completedAt: date, createdAt: date } },
        );
      }
    }
  }
  return { users: users.length, products: products.length };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await connectDB();
    console.log(await seed(process.env.SEED_PASSWORD));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
