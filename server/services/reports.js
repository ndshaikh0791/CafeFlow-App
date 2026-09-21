import {
  Order,
  Expense,
  InventoryItem,
  Table,
  Payment,
  Settings,
} from "../models/index.js";
import { assert } from "../utils/errors.js";
export async function report(query) {
  const settings = await Settings.findOne({ key: "main" });
  const end = query.to ? new Date(query.to) : new Date();
  const start = query.from
    ? new Date(query.from)
    : new Date(new Date().setHours(0, 0, 0, 0));
  assert(
    Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      start <= end,
    "Invalid date range",
  );
  const [orders, expenses, inventory, activeTables, pending, recentOrders] =
    await Promise.all([
      Order.find({
        paidAt: { $gte: start, $lte: end },
        paymentStatus: "paid",
      }).lean(),
      Expense.find({ date: { $gte: start, $lte: end } }).lean(),
      InventoryItem.find().lean(),
      Table.countDocuments({ status: "occupied" }),
      Order.countDocuments({ status: { $nin: ["completed", "cancelled"] } }),
      Order.find().sort({ createdAt: -1 }).limit(6).lean(),
    ]);
  const payments = await Payment.find({
    order: { $in: orders.map((o) => o._id) },
  }).lean();
  const sales = orders.reduce((s, o) => s + o.total, 0),
    expenseTotal = expenses.reduce((s, e) => s + e.amount, 0),
    cost = orders.reduce(
      (s, o) => s + o.items.reduce((a, i) => a + i.cost * i.quantity, 0),
      0,
    );
  const productMap = Object.create(null),
    categoryMap = Object.create(null),
    dailyMap = Object.create(null),
    paymentMap = Object.create(null);
  for (const o of orders) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings?.timezone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(o.paidAt);
    dailyMap[day] ??= { date: day, sales: 0, orders: 0 };
    dailyMap[day].sales += o.total;
    dailyMap[day].orders++;
    for (const i of o.items) {
      productMap[i.name] ??= { name: i.name, quantity: 0, sales: 0 };
      productMap[i.name].quantity += i.quantity;
      productMap[i.name].sales += i.quantity * i.price;
      categoryMap[i.category] =
        (categoryMap[i.category] || 0) + i.quantity * i.price;
    }
  }
  for (const p of payments)
    paymentMap[p.method] = (paymentMap[p.method] || 0) + p.amount;
  const netSales = orders.reduce(
    (s, o) => s + o.subtotal - o.discount + o.serviceCharge,
    0,
  );
  return {
    range: { from: start, to: end },
    sales,
    netSales,
    ordersCount: orders.length,
    averageOrder: orders.length ? sales / orders.length : 0,
    activeTables,
    pending,
    lowStock: inventory.filter((i) => i.quantity <= i.minStock),
    expenseTotal,
    cost,
    profit: netSales - cost - expenseTotal,
    orders,
    expenses,
    inventory,
    recentOrders,
    products: Object.values(productMap).sort((a, b) => b.sales - a.sales),
    categories: Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value,
    })),
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    payments: Object.entries(paymentMap).map(([name, value]) => ({
      name,
      value,
    })),
  };
}
