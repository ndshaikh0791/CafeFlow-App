import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { authenticate, managers, operators } from "./middleware/auth.js";
import * as auth from "./controllers/auth.js";
import { resourceRoutes } from "./routes/resources.js";
import {
  Order,
  Product,
  Table,
  Category,
  Payment,
  Customer,
} from "./models/index.js";
import {
  createOrder,
  payOrder,
  changeStatus,
  getSettings,
  priceOrder,
} from "./services/orders.js";
import { orderInput } from "./utils/validation.js";
import { report } from "./services/reports.js";
import { assert } from "./utils/errors.js";
export function createApp(io) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "https:", "http:"],
          "script-src": ["'self'"],
          "connect-src": ["'self'", "ws:", "wss:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "upgrade-insecure-requests":
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !==
        (process.env.FRONTEND_URL || "http://localhost:5173")
    )
      return res.status(403).json({ error: "Untrusted request origin" });
    next();
  });
  app.get("/api/health", async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error("Database offline");
      await mongoose.connection.db.admin().ping({ timeoutMS: 2000 });
      res.json({ data: { status: "ok", database: "connected" } });
    } catch {
      res.status(503).json({ data: { status: "unavailable", database: "disconnected" } });
    }
  });
  app.use("/api", (req, res, next) => {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({ error: "Database is unavailable. Please start the database and try again." });
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post("/api/auth/login", authLimiter, auth.login);
  app.post("/api/auth/logout", auth.logout);
  app.get("/api/auth/me", authenticate, (req, res) =>
    res.json({ data: req.user }),
  );
  app.post("/api/auth/forgot-password", authLimiter, auth.forgot);
  app.post("/api/auth/reset-password", authLimiter, auth.reset);
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/public", publicLimiter);
  app.get("/api/public/menu/:token", async (req, res) => {
    const table = await Table.findOne({ qrToken: req.params.token }).select(
      "name capacity status qrToken",
    );
    assert(table, "Table not found", 404);
    const settings = await getSettings();
    assert(settings.qrEnabled, "QR ordering is disabled", 403);
    const [products, categories] = await Promise.all([
      Product.find({ active: true }).select("-costPrice").populate("category"),
      Category.find(),
    ]);
    res.json({
      data: { table, products, categories, settings: publicSettings(settings) },
    });
  });
  app.post("/api/public/menu/:token/orders", async (req, res) => {
    const order = await createOrder(req.body, null, "qr", req.params.token);
    emit(order, "New QR order");
    res.status(201).json({ data: publicOrder(order) });
  });
  app.get("/api/public/orders/:token", async (req, res) => {
    const order = await Order.findOne({ trackingToken: req.params.token });
    assert(order, "Order not found", 404);
    res.json({ data: publicOrder(order) });
  });
  app.get("/api/orders", authenticate, async (req, res) => {
    const filter = {};
    if (req.query.status && req.query.status !== "all")
      filter.status = req.query.status;
    if (
      req.query.active === "true" ||
      (req.user.role === "kitchen" && !req.query.status)
    )
      filter.status = { $in: ["new", "accepted", "preparing", "ready"] };
    if (req.query.search)
      filter.number = {
        $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [data, total] = await Promise.all([
      Order.find(filter)
        .populate("customer", "name phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    res.json({
      data,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });
  app.get("/api/orders/:id", authenticate, async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
      "customer",
      "name phone",
    );
    assert(order, "Order not found", 404);
    res.json({
      data: {
        ...order.toObject(),
        payments: await Payment.find({ order: order._id }),
      },
    });
  });
  app.post("/api/orders/quote", authenticate, operators, async (req, res) => {
    const input = orderInput.parse(req.body);
    const { settings, ...quote } = await priceOrder(
      input,
      null,
      req.user,
      "pos",
    );
    res.json({ data: quote });
  });
  app.post("/api/orders", authenticate, operators, async (req, res) => {
    const order = await createOrder(req.body, req.user);
    emit(order, "New kitchen order");
    res.status(201).json({ data: order });
  });
  app.post("/api/orders/:id/pay", authenticate, operators, async (req, res) => {
    const order = await payOrder(req.params.id, req.body, req.user);
    emit(order, "Payment recorded");
    res.json({ data: order });
  });
  app.patch("/api/orders/:id/status", authenticate, async (req, res) => {
    const { status, reason } = z
      .object({
        status: z.enum([
          "accepted",
          "preparing",
          "ready",
          "served",
          "completed",
          "cancelled",
        ]),
        reason: z.string().max(500).default(""),
      })
      .parse(req.body);
    const order = await changeStatus(req.params.id, status, req.user, reason);
    emit(order, status === "ready" ? "Order ready" : "Order updated");
    res.json({ data: order });
  });
  app.get("/api/dashboard", authenticate, managers, async (req, res) =>
    res.json({ data: await report(req.query) }),
  );
  app.get("/api/reports", authenticate, managers, async (req, res) =>
    res.json({ data: await report(req.query) }),
  );
  app.use("/api", resourceRoutes(io));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err.code === 11000)
      return res
        .status(409)
        .json({ error: "A record with that unique value already exists" });
    if (err.name === "CastError" || err.name === "ValidationError")
      return res
        .status(400)
        .json({ error: "Invalid record data or identifier" });
    if (["MongoServerSelectionError", "MongooseServerSelectionError", "MongoNetworkError", "MongoNotConnectedError"].includes(err.name))
      return res.status(503).json({ error: "Database is unavailable. Please start the database and try again." });
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : "Unexpected server error. Please try again.",
    });
  });
  return app;
  function emit(order, message) {
    io?.to("staff").emit("refresh", {
      resource: "orders",
      message,
      number: order.number,
    });
    io?.to(`order:${order.trackingToken}`).emit("tracking", publicOrder(order));
  }
}
function publicSettings(s) {
  return {
    name: s.name,
    logo: s.logo,
    address: s.address,
    phone: s.phone,
    currency: s.currency,
    serviceCharge: s.serviceCharge,
  };
}
function publicOrder(o) {
  return {
    currency: o.currency,
    _id: o._id,
    number: o.number,
    trackingToken: o.trackingToken,
    status: o.status,
    paymentStatus: o.paymentStatus,
    items: o.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      variant: i.variant,
      addons: i.addons,
      notes: i.notes,
      price: i.price,
    })),
    total: o.total,
    subtotal: o.subtotal,
    tax: o.tax,
    discount: o.discount,
    serviceCharge: o.serviceCharge,
    tableName: o.tableName,
    createdAt: o.createdAt,
  };
}
