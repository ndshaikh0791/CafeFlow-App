import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import * as M from "../models/index.js";
import {
  authenticate,
  authorize,
  managers,
  operators,
} from "../middleware/auth.js";
import { schemas } from "../utils/validation.js";
import { assert } from "../utils/errors.js";
const models = {
  products: M.Product,
  categories: M.Category,
  tables: M.Table,
  customers: M.Customer,
  inventory: M.InventoryItem,
  recipes: M.Recipe,
  staff: M.User,
  expenses: M.Expense,
  discounts: M.Discount,
};
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function resourceRoutes(io) {
  const router = Router();
  router.use(authenticate);
  for (const [name, Model] of Object.entries(models)) {
    const read = [
      "products",
      "categories",
      "tables",
      "customers",
      "discounts",
    ].includes(name)
      ? operators
      : name === "staff"
        ? authorize("owner")
        : managers;
    const write =
      name === "staff"
        ? authorize("owner")
        : name === "customers"
          ? operators
          : managers;
    router.get(`/${name}`, read, async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
      const filter = {};
      if (req.query.search) {
        const fields =
          name === "expenses"
            ? ["title", "category"]
            : name === "discounts"
              ? ["code", "description"]
              : name === "recipes"
                ? []
                : [
                    "name",
                    ...(name === "staff" || name === "customers"
                      ? ["email", "phone"]
                      : []),
                  ];
        if (fields.length)
          filter.$or = fields.map((f) => ({
            [f]: {
              $regex: escaped(String(req.query.search).slice(0, 200)),
              $options: "i",
            },
          }));
      }
      if (name === "products" && req.query.category)
        filter.category = req.query.category;
      if (name === "recipes" && req.query.search) {
        const matches = await M.Product.find({
          name: {
            $regex: escaped(String(req.query.search).slice(0, 200)),
            $options: "i",
          },
        }).select("_id");
        filter.product = { $in: matches.map((p) => p._id) };
      }
      if (name === "inventory" && req.query.low === "true")
        filter.$expr = { $lte: ["$quantity", "$minStock"] };
      let query = Model.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      if (name === "products") query = query.populate("category");
      if (name === "recipes")
        query = query.populate("product").populate("ingredients.ingredient");
      if (name === "tables")
        query = query.populate("currentOrder", "number total status");
      const [data, total] = await Promise.all([
        query,
        MappedCount(Model, filter),
      ]);
      res.json({
        data,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    });
    router.post(`/${name}`, write, async (req, res) => {
      const data = schemas[name].parse(req.body);
      await references(name, data);
      if (name === "tables")
        data.qrToken = crypto.randomBytes(24).toString("hex");
      if (name === "staff") {
        assert(
          data.password,
          "A password of at least 10 characters is required",
        );
        data.password = await bcrypt.hash(data.password, 12);
      }
      const doc = await Model.create(data);
      if (name === "inventory" && data.quantity)
        await M.StockTransaction.create({
          ingredient: doc._id,
          delta: data.quantity,
          reason: "Opening stock",
          user: req.user._id,
        });
      io?.to("staff").emit("refresh", { resource: name });
      const safe = doc.toObject();
      delete safe.password;
      res.status(201).json({ data: safe });
    });
    router.put(`/${name}/:id`, write, async (req, res) => {
      const data = schemas[name].parse(req.body);
      const doc = await Model.findById(req.params.id);
      assert(doc, "Record not found", 404);
      await references(name, data);
      if (name === "tables")
        assert(
          doc.status !== "occupied",
          "Finish active orders before editing this table",
        );
      if (name === "inventory") {
        delete data.quantity;
        if (doc.unit !== data.unit)
          assert(
            !(await M.Recipe.exists({ "ingredients.ingredient": doc._id })),
            "Unit cannot change while this ingredient is used in a recipe",
          );
      }
      if (name === "staff") {
        assert(
          doc.id !== req.user.id || (data.active && data.role === "owner"),
          "You cannot disable or demote your own owner account",
        );
        if (data.password) data.password = await bcrypt.hash(data.password, 12);
        else delete data.password;
        data.tokenVersion = doc.tokenVersion + 1;
      }
      Object.assign(doc, data);
      await doc.save();
      io?.to("staff").emit("refresh", { resource: name });
      const safe = doc.toObject();
      delete safe.password;
      res.json({ data: safe });
    });
    router.delete(`/${name}/:id`, write, async (req, res) => {
      const doc = await Model.findById(req.params.id);
      assert(doc, "Record not found", 404);
      if (name === "staff")
        assert(false, "Disable staff accounts to retain the audit history");
      if (name === "categories")
        assert(
          !(await M.Product.exists({ category: doc._id })),
          "Move products to another category first",
        );
      if (name === "products") {
        assert(
          !(await M.Order.exists({
            "items.product": doc._id,
            status: { $nin: ["completed", "cancelled"] },
          })),
          "This product has active orders",
        );
        await M.Recipe.deleteMany({ product: doc._id });
      }
      if (name === "tables")
        assert(doc.status !== "occupied", "Finish active table orders first");
      if (name === "inventory")
        assert(
          !(await M.Recipe.exists({ "ingredients.ingredient": doc._id })) &&
            !(await M.Order.exists({
              "stockUsage.ingredient": doc._id,
              paymentStatus: "unpaid",
              status: { $ne: "cancelled" },
            })),
          "This ingredient is used in a recipe or an unpaid order",
        );
      if (name === "customers")
        assert(
          !(await M.Order.exists({ customer: doc._id })),
          "Customers with order history cannot be deleted",
        );
      await doc.deleteOne();
      io?.to("staff").emit("refresh", { resource: name });
      res.json({ data: true });
    });
  }
  router.post("/inventory/:id/adjust", managers, async (req, res) => {
    const { delta, reason } = z
      .object({
        delta: z
          .number()
          .finite()
          .refine((v) => v !== 0, "Quantity must not be zero"),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const session = await mongoose.startSession();
    let item;
    try {
      await session.withTransaction(async () => {
        const settings = await M.Settings.findOne({ key: "main" }).session(
          session,
        );
        const filter = { _id: req.params.id };
        if (!settings?.allowNegativeStock && delta < 0)
          filter.quantity = { $gte: -delta };
        item = await M.InventoryItem.findOneAndUpdate(
          filter,
          { $inc: { quantity: delta } },
          { new: true, session },
        );
        assert(
          item,
          "Ingredient missing or adjustment would make stock negative",
        );
        await M.StockTransaction.create(
          [{ ingredient: item._id, delta, reason, user: req.user._id }],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    io?.to("staff").emit("refresh", { resource: "inventory" });
    res.json({ data: item });
  });
  router.get("/inventory/:id/history", managers, async (req, res) =>
    res.json({
      data: await M.StockTransaction.find({ ingredient: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("user", "name"),
    }),
  );
  router.get("/customers/:id/orders", operators, async (req, res) =>
    res.json({
      data: await M.Order.find({ customer: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100),
    }),
  );
  router.get("/settings", operators, async (req, res) =>
    res.json({
      data: (await M.Settings.findOne({ key: "main" })) || new M.Settings(),
    }),
  );
  router.put("/settings", authorize("owner"), async (req, res) => {
    const data = schemas.settings.parse(req.body);
    res.json({
      data: await M.Settings.findOneAndUpdate({ key: "main" }, data, {
        upsert: true,
        new: true,
        runValidators: true,
      }),
    });
    io?.to("staff").emit("refresh", { resource: "settings" });
  });
  router.get("/held-orders", operators, async (req, res) =>
    res.json({
      data: await M.HeldOrder.find({ user: req.user._id }).sort({
        createdAt: -1,
      }),
    }),
  );
  router.post("/held-orders", operators, async (req, res) => {
    const data = z
      .object({
        name: z.string().max(200),
        cart: z.record(z.string(), z.unknown()),
      })
      .parse(req.body);
    res.status(201).json({
      data: await M.HeldOrder.create({ ...data, user: req.user._id }),
    });
  });
  router.delete("/held-orders/:id", operators, async (req, res) => {
    await M.HeldOrder.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ data: true });
  });
  return router;
}
function MappedCount(Model, filter) {
  return Model.countDocuments(filter);
}
async function references(name, data) {
  if (name === "products")
    assert(
      await M.Category.exists({ _id: data.category }),
      "Category not found",
    );
  if (name === "discounts" && data.product)
    assert(await M.Product.exists({ _id: data.product }), "Product not found");
  if (name === "recipes") {
    assert(await M.Product.exists({ _id: data.product }), "Product not found");
    assert(
      new Set(data.ingredients.map((i) => i.ingredient)).size ===
        data.ingredients.length,
      "Use each ingredient only once",
    );
    assert(
      (await M.InventoryItem.countDocuments({
        _id: { $in: data.ingredients.map((i) => i.ingredient) },
      })) === data.ingredients.length,
      "Ingredient not found",
    );
  }
}
