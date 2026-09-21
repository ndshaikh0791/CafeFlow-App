import mongoose from "mongoose";
import crypto from "node:crypto";
import {
  Order,
  Product,
  Table,
  Customer,
  Recipe,
  InventoryItem,
  StockTransaction,
  Settings,
  Counter,
  Discount,
  Payment,
} from "../models/index.js";
import { assert } from "../utils/errors.js";
import { orderInput, paymentInput } from "../utils/validation.js";
export const round = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export async function getSettings(session) {
  return (
    (await Settings.findOne({ key: "main" }).session(session || null)) ||
    new Settings()
  );
}
export async function priceOrder(input, session, user, source) {
  const settings = await getSettings(session);
  const items = [];
  for (const item of input.items) {
    const product = await Product.findById(item.product)
      .populate("category")
      .session(session || null);
    assert(
      product?.active && product.available,
      `${product?.name || "Product"} is unavailable`,
    );
    const variant = item.variant
      ? product.variants.find((v) => v.name === item.variant)
      : null;
    assert(!item.variant || variant, "Invalid variant");
    assert(
      new Set(item.addons).size === item.addons.length,
      "Duplicate add-ons",
    );
    const addons = item.addons.map((name) => {
      const a = product.addons.find((v) => v.name === name);
      assert(a, "Invalid add-on");
      return { name: a.name, price: a.price };
    });
    assert(
      item.modifiers.every((m) => product.modifiers.includes(m)),
      "Invalid modifier",
    );
    const recipe = await Recipe.findOne({ product: product._id })
      .populate("ingredients.ingredient")
      .session(session || null);
    const cost = recipe
      ? recipe.ingredients.reduce(
          (s, i) => s + i.quantity * (i.ingredient?.costPerUnit || 0),
          0,
        )
      : product.costPrice;
    items.push({
      ...item,
      name: product.name,
      category: product.category?.name || "Uncategorized",
      price: round(
        (variant ? variant.price : product.price) +
          addons.reduce((s, a) => s + a.price, 0),
      ),
      tax: product.tax,
      addons,
      cost: round(cost),
    });
  }
  const subtotal = round(
    items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  );
  let discount = 0;
  if (input.discountCode) {
    const offer = await Discount.findOne({
      code: input.discountCode.toUpperCase(),
      active: true,
    }).session(session || null);
    const now = new Date();
    assert(
      offer &&
        (!offer.startDate || offer.startDate <= now) &&
        (!offer.endDate || offer.endDate >= now),
      "Promo code is invalid or expired",
    );
    assert(subtotal >= offer.minOrder, `Minimum order is ${offer.minOrder}`);
    const base = offer.product
      ? items
          .filter((i) => i.product === String(offer.product))
          .reduce((s, i) => s + i.price * i.quantity, 0)
      : subtotal;
    assert(base > 0, "This offer does not apply to these products");
    discount =
      offer.type === "percentage"
        ? (base * offer.value) / 100
        : Math.min(base, offer.value);
    if (offer.maxDiscount > 0) discount = Math.min(discount, offer.maxDiscount);
  }
  if (input.manualDiscount) {
    assert(
      source === "pos" && ["owner", "manager"].includes(user?.role),
      "Only managers can apply a manual discount",
      403,
    );
    discount += input.manualDiscount;
  }
  if (input.redeemPoints) {
    assert(
      source === "pos" && input.customer && settings.loyaltyEnabled,
      "Loyalty redemption is unavailable",
    );
    const customer = await Customer.findById(input.customer).session(
      session || null,
    );
    assert(
      customer &&
        input.redeemPoints >= settings.minRedeem &&
        customer.points >= input.redeemPoints,
      "Insufficient points or minimum redemption not reached",
    );
    discount += input.redeemPoints * settings.pointValue;
  }
  assert(discount <= subtotal, "Discount exceeds subtotal");
  discount = round(discount);
  const tax = round(
    items.reduce(
      (s, i) =>
        s +
        (i.price *
          i.quantity *
          (subtotal ? 1 - discount / subtotal : 1) *
          i.tax) /
          100,
      0,
    ),
  );
  const serviceCharge = round(
    ((subtotal - discount) * settings.serviceCharge) / 100,
  );
  return {
    items,
    subtotal,
    discount,
    tax,
    serviceCharge,
    total: round(subtotal - discount + tax + serviceCharge),
    settings,
  };
}
export async function createOrder(body, user, source = "pos", qrToken) {
  const input = orderInput.parse(body);
  if (source === "qr") {
    input.customer = undefined;
    input.redeemPoints = 0;
    input.manualDiscount = 0;
    input.type = "dine-in";
    const table = await Table.findOne({ qrToken });
    assert(table, "Table not found", 404);
    input.table = table.id;
    assert(
      (await getSettings()).qrEnabled,
      "QR ordering is currently disabled",
      403,
    );
  }
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ input, source, actor: user?.id || qrToken }))
    .digest("hex");
  const existing = await Order.findOne({
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) {
    assert(
      existing.requestHash === requestHash,
      "This submission key was already used for another order",
      409,
    );
    return existing;
  }
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const priced = await priceOrder(input, session, user, source);
      const table = input.table
        ? await Table.findById(input.table).session(session)
        : null;
      if (input.type === "dine-in") assert(table, "Select a table");
      if (table)
        assert(
          ["available", "occupied"].includes(table.status),
          "Table is reserved or needs cleaning",
        );
      if (input.type === "delivery")
        assert(input.deliveryAddress.trim(), "Delivery address is required");
      if (input.customer)
        assert(
          await Customer.exists({ _id: input.customer }).session(session),
          "Customer not found",
        );
      if (input.redeemPoints) {
        const customer = await Customer.findOneAndUpdate(
          { _id: input.customer, points: { $gte: input.redeemPoints } },
          {
            $inc: {
              points: -input.redeemPoints,
              redeemedPoints: input.redeemPoints,
            },
          },
          { session },
        );
        assert(customer, "Insufficient loyalty points");
      }
      const seq = await Counter.findOneAndUpdate(
        { _id: "orders" },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session },
      );
      const { settings, ...totals } = priced;
      const usage = new Map();
      for (const item of totals.items) {
        const recipe = await Recipe.findOne({ product: item.product }).session(
          session,
        );
        for (const entry of recipe?.ingredients || []) {
          const id = String(entry.ingredient);
          usage.set(id, (usage.get(id) || 0) + entry.quantity * item.quantity);
        }
      }
      [result] = await Order.create(
        [
          {
            ...input,
            ...totals,
            requestHash,
            number: `${settings.orderPrefix}-${String(seq.value).padStart(5, "0")}`,
            trackingToken: crypto.randomBytes(24).toString("hex"),
            source,
            cashier: user?._id,
            cashierName: user?.name || "QR guest",
            table: input.type === "dine-in" ? table?._id : null,
            tableName: input.type === "dine-in" ? table?.name : null,
            redeemedPoints: input.redeemPoints,
            currency: settings.currency,
            recipeSnapshot: true,
            stockUsage: Array.from(usage, ([ingredient, quantity]) => ({
              ingredient,
              quantity,
            })),
          },
        ],
        { session },
      );
      if (input.type === "dine-in") {
        table.status = "occupied";
        table.currentOrder = result._id;
        await table.save({ session });
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Order.findOne({
        idempotencyKey: input.idempotencyKey,
        requestHash,
      });
      if (duplicate) return duplicate;
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return result;
}
export async function payOrder(id, body, user) {
  const { payments } = paymentInput.parse(body);
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      assert(order, "Order not found", 404);
      assert(order.status !== "cancelled", "Cancelled orders cannot be paid");
      if (order.paymentStatus === "paid") {
        result = order;
        return;
      }
      assert(
        Math.abs(
          round(payments.reduce((s, p) => s + p.amount, 0)) - order.total,
        ) < 0.01,
        "Payments must equal the order total",
      );
      const settings = await getSettings(session);
      assert(
        payments.every((p) => p.amount > 0) ||
          (order.total === 0 &&
            payments.length === 1 &&
            payments[0].amount === 0),
        "Each tender must have a positive amount",
      );
      const usage = new Map();
      if (order.recipeSnapshot) {
        for (const entry of order.stockUsage)
          usage.set(String(entry.ingredient), entry.quantity);
      } else
        for (const item of order.items) {
          const recipe = await Recipe.findOne({
            product: item.product,
          }).session(session);
          for (const entry of recipe?.ingredients || [])
            usage.set(
              String(entry.ingredient),
              (usage.get(String(entry.ingredient)) || 0) +
                entry.quantity * item.quantity,
            );
        }
      for (const [ingredient, quantity] of usage) {
        const filter = { _id: ingredient };
        if (!settings.allowNegativeStock) filter.quantity = { $gte: quantity };
        const stock = await InventoryItem.findOneAndUpdate(
          filter,
          { $inc: { quantity: -quantity } },
          { new: true, session },
        );
        assert(
          stock,
          "Insufficient ingredient stock. Restock before taking payment.",
          409,
        );
        await StockTransaction.create(
          [
            {
              ingredient,
              delta: -quantity,
              reason: `Sale ${order.number}`,
              order: order._id,
              user: user._id,
            },
          ],
          { session },
        );
      }
      order.stockUsage = Array.from(usage, ([ingredient, quantity]) => ({
        ingredient,
        quantity,
      }));
      order.stockDeducted = true;
      order.paymentStatus = "paid";
      order.paidAt = new Date();
      if (order.customer) {
        const earned = settings.loyaltyEnabled
          ? Math.floor(order.total / settings.pointsPerAmount)
          : 0;
        await Customer.updateOne(
          { _id: order.customer },
          {
            $inc: {
              totalOrders: 1,
              totalSpend: order.total,
              points: earned,
              earnedPoints: earned,
            },
            $set: { lastVisit: new Date() },
          },
          { session },
        );
      }
      await Payment.insertMany(
        payments.map((p) => ({ ...p, order: order._id })),
        { session },
      );
      await order.save({ session });
      result = order;
    });
  } finally {
    await session.endSession();
  }
  return result;
}
const nextStatus = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: ["completed", "cancelled"],
};
export async function changeStatus(id, status, user, reason = "") {
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      assert(order, "Order not found", 404);
      assert(
        nextStatus[order.status]?.includes(status),
        "Invalid order status transition",
        409,
      );
      if (user.role === "kitchen")
        assert(
          ["accepted", "preparing", "ready"].includes(status),
          "Kitchen may only accept, prepare, or mark ready",
          403,
        );
      if (status === "completed")
        assert(
          order.paymentStatus === "paid",
          "Record payment before completing an order",
        );
      if (status === "cancelled") {
        assert(
          order.paymentStatus !== "paid",
          "Paid orders cannot be cancelled; refunds require an external reconciliation",
        );
        assert(reason.trim(), "A cancellation reason is required");
        order.cancelReason = reason;
        if (order.redeemedPoints && order.customer)
          await Customer.updateOne(
            { _id: order.customer },
            {
              $inc: {
                points: order.redeemedPoints,
                redeemedPoints: -order.redeemedPoints,
              },
            },
            { session },
          );
      }
      order.status = status;
      if (status === "completed") order.completedAt = new Date();
      await order.save({ session });
      if (order.table && ["completed", "cancelled"].includes(status)) {
        const remaining = await Order.findOne({
          _id: { $ne: order._id },
          table: order.table,
          status: { $nin: ["completed", "cancelled"] },
        }).session(session);
        await Table.updateOne(
          { _id: order.table },
          {
            $set: {
              status: remaining ? "occupied" : "cleaning",
              currentOrder: remaining?._id || null,
            },
          },
          { session },
        );
      }
      result = order;
    });
  } finally {
    await session.endSession();
  }
  return result;
}
