import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { spawn } from "node:child_process";
import { io as connectSocket } from "socket.io-client";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../server/app.js";
import * as M from "../server/models/index.js";
let repl,
  app,
  owner,
  cashier,
  kitchen,
  product,
  table,
  ingredient,
  customer,
  qrOrder;
const password = crypto.randomBytes(18).toString("base64url");
before(
  async () => {
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    repl = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(repl.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    app = createApp();
    await M.Settings.create({
      name: "Test Cafe",
      pointsPerAmount: 10,
      minRedeem: 2,
      pointValue: 1,
    });
    for (const role of ["owner", "cashier", "kitchen"])
      await M.User.create({
        name: role,
        email: `${role}@test.local`,
        role,
        password: await bcrypt.hash(password, 4),
      });
    owner = request.agent(app);
    cashier = request.agent(app);
    kitchen = request.agent(app);
    for (const [agent, role] of [
      [owner, "owner"],
      [cashier, "cashier"],
      [kitchen, "kitchen"],
    ]) {
      const login = await agent
        .post("/api/auth/login")
        .send({ email: `${role}@test.local`, password });
      assert.equal(login.status, 200);
      assert.match(login.headers["set-cookie"][0], /HttpOnly/);
      assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
    }
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

test("Live HTTP and Socket.IO transport share the server and deliver staff/guest updates", async () => {
  const child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, MONGODB_URI: repl.getUri(), PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let staff, guest;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Live server startup timed out")),
        20000,
      );
      child.stdout.on("data", (data) => {
        const match = data.toString().match(/port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}`));
      });
    });
    const endpoint = `http://127.0.0.1:${port}`;
    const login = await request(endpoint)
      .post("/api/auth/login")
      .send({ email: "owner@test.local", password });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    staff = connectSocket(endpoint, {
      extraHeaders: { Cookie: cookie },
      autoConnect: false,
    });
    const ready = socketEvent(staff, "staff-ready");
    staff.connect();
    await ready;
    guest = connectSocket(endpoint, { autoConnect: false });
    const connected = socketEvent(guest, "connect");
    guest.connect();
    await connected;
    const token = crypto.randomBytes(24).toString("hex");
    await new Promise((resolve, reject) =>
      guest
        .timeout(5000)
        .emit("track", token, (err) => (err ? reject(err) : resolve())),
    );
    const notification = socketEvent(staff, "refresh");
    const category = await request(endpoint)
      .post("/api/categories")
      .set("Cookie", cookie)
      .send({ name: "Socket test category" });
    assert.equal(category.status, 201);
    assert.equal((await notification).resource, "categories");
    assert.equal((await request(endpoint).get("/api/health")).status, 200);
  } finally {
    staff?.disconnect();
    guest?.disconnect();
    child.kill();
  }
});
function socketEvent(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${name}`)),
      10000,
    );
    socket.once(name, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

test("Recipe snapshots, complimentary payments and one-use password reset", async () => {
  // Standalone fixtures keep this edge-case check independent of the journey fixtures below.
  const category = await M.Category.create({ name: "Edge cases" });
  const ingredient = await M.InventoryItem.create({
    name: "Snapshot beans",
    sku: "SNAP-BEANS",
    quantity: 100,
    unit: "g",
    costPerUnit: 1,
  });
  const product = await M.Product.create({
    name: "Complimentary coffee",
    sku: "COMP-1",
    category: category._id,
    price: 100,
    tax: 5,
  });
  const recipe = await M.Recipe.create({
    product: product._id,
    ingredients: [{ ingredient: ingredient._id, quantity: 18 }],
  });
  const response = await owner
    .post("/api/orders")
    .send({
      idempotencyKey: crypto.randomUUID(),
      type: "takeaway",
      manualDiscount: 100,
      items: [{ product: product.id, quantity: 1 }],
    });
  assert.equal(response.status, 201, response.text);
  const order = response.body.data;
  assert.equal(order.total, 0);
  await M.Recipe.updateOne(
    { _id: recipe._id },
    { $set: { ingredients: [{ ingredient: ingredient._id, quantity: 1 }] } },
  );
  const paid = await owner
    .post(`/api/orders/${order._id}/pay`)
    .send({ payments: [{ method: "cash", amount: 0 }] });
  assert.equal(paid.status, 200, paid.text);
  assert.equal((await M.InventoryItem.findById(ingredient._id)).quantity, 82);
  // Remove these isolated records so the subsequent A–F assertions retain exact totals.
  await M.Payment.deleteMany({ order: order._id });
  await M.StockTransaction.deleteMany({ order: order._id });
  await M.Order.deleteOne({ _id: order._id });
  await M.Recipe.deleteOne({ _id: recipe._id });
  await product.deleteOne();
  await ingredient.deleteOne();
  await category.deleteOne();
  const token = crypto.randomBytes(32).toString("hex"),
    newPassword = crypto.randomBytes(18).toString("hex");
  const resetUser = await M.User.create({
    name: "Reset test",
    email: "reset@test.local",
    role: "cashier",
    password: await bcrypt.hash(password, 4),
    resetHash: crypto.createHash("sha256").update(token).digest("hex"),
    resetExpires: new Date(Date.now() + 60000),
  });
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: newPassword })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ token, password: newPassword })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: resetUser.email, password: newPassword })
    ).status,
    200,
  );
});
test("Authentication, origin checks and role boundaries", async () => {
  assert.equal((await request(app).get("/api/products")).status, 401);
  assert.equal((await cashier.post("/api/products").send({})).status, 403);
  assert.equal((await kitchen.get("/api/customers")).status, 403);
  assert.equal((await cashier.get("/api/staff")).status, 403);
  assert.equal(
    (
      await owner
        .post("/api/categories")
        .set("Origin", "https://evil.example")
        .send({ name: "No" })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "owner@test.local", password: "wrong" })
    ).status,
    401,
  );
});
test("Flow A: create category, menu product, table and public QR menu", async () => {
  const category = await owner
    .post("/api/categories")
    .send({ name: "Coffee", description: "Fresh coffee" });
  assert.equal(category.status, 201);
  const p = await owner.post("/api/products").send({
    name: "Cappuccino",
    category: category.body.data._id,
    price: 100,
    costPrice: 20,
    tax: 5,
    sku: "CAP-1",
    variants: [{ name: "Large", price: 130 }],
    addons: [{ name: "Extra shot", price: 20 }],
    modifiers: ["Less sugar"],
  });
  assert.equal(p.status, 201, p.text);
  product = p.body.data;
  const t = await owner.post("/api/tables").send({ name: "T01", capacity: 4 });
  assert.equal(t.status, 201);
  table = t.body.data;
  const menu = await request(app).get(`/api/public/menu/${table.qrToken}`);
  assert.equal(menu.status, 200);
  assert.equal(menu.body.data.products[0].name, "Cappuccino");
  assert.equal(menu.body.data.products[0].costPrice, undefined);
  assert.equal(
    (await request(app).get("/api/public/menu/invalid")).status,
    404,
  );
  const inv = await owner.post("/api/inventory").send({
    name: "Beans",
    sku: "BEANS",
    quantity: 1000,
    unit: "g",
    minStock: 970,
    costPerUnit: 1,
  });
  assert.equal(inv.status, 201);
  ingredient = inv.body.data;
  assert.equal(
    (
      await owner.post("/api/recipes").send({
        product: product._id,
        ingredients: [{ ingredient: ingredient._id, quantity: 18 }],
      })
    ).status,
    201,
  );
  const c = await cashier
    .post("/api/customers")
    .send({ name: "Cafe Guest", phone: "1234567890" });
  customer = c.body.data;
});
test("Flow B: QR customization, authoritative totals and duplicate prevention", async () => {
  const body = {
    idempotencyKey: crypto.randomUUID(),
    type: "dine-in",
    items: [
      {
        product: product._id,
        quantity: 2,
        variant: "Large",
        addons: ["Extra shot"],
        modifiers: ["Less sugar"],
        notes: "Warm, please",
        price: 1,
      },
    ],
    notes: "Thanks",
  };
  const response = await request(app)
    .post(`/api/public/menu/${table.qrToken}/orders`)
    .send(body);
  assert.equal(response.status, 201, response.text);
  qrOrder = response.body.data;
  assert.equal(qrOrder.subtotal, 300);
  assert.equal(qrOrder.total, 315);
  assert.equal(qrOrder.items[0].notes, "Warm, please");
  assert.equal(qrOrder.items[0].cost, undefined);
  const duplicate = await request(app)
    .post(`/api/public/menu/${table.qrToken}/orders`)
    .send(body);
  assert.equal(duplicate.body.data._id, qrOrder._id);
  assert.equal(await M.Order.countDocuments(), 1);
  assert.equal((await M.Table.findById(table._id)).status, "occupied");
  const changed = await request(app)
    .post(`/api/public/menu/${table.qrToken}/orders`)
    .send({ ...body, notes: "Different order" });
  assert.equal(changed.status, 409);
});
test("Flow C: QR kitchen progression is visible in anonymous tracking", async () => {
  const orders = await kitchen.get("/api/orders");
  assert.equal(orders.body.data[0]._id, qrOrder._id);
  assert.equal(
    (
      await kitchen
        .patch(`/api/orders/${qrOrder._id}/status`)
        .send({ status: "ready" })
    ).status,
    409,
  );
  for (const status of ["accepted", "preparing", "ready"]) {
    assert.equal(
      (
        await kitchen
          .patch(`/api/orders/${qrOrder._id}/status`)
          .send({ status })
      ).status,
      200,
    );
    const track = await request(app).get(
      `/api/public/orders/${qrOrder.trackingToken}`,
    );
    assert.equal(track.body.data.status, status);
  }
  assert.equal(
    (
      await kitchen
        .patch(`/api/orders/${qrOrder._id}/status`)
        .send({ status: "served" })
    ).status,
    403,
  );
  assert.equal(
    (
      await cashier
        .patch(`/api/orders/${qrOrder._id}/status`)
        .send({ status: "served" })
    ).status,
    200,
  );
  assert.equal(
    (
      await cashier
        .patch(`/api/orders/${qrOrder._id}/status`)
        .send({ status: "completed" })
    ).status,
    400,
  );
});
test("Flows D/E/F: split payment, atomic ingredient deduction, low stock and reports", async () => {
  const pay = await cashier.post(`/api/orders/${qrOrder._id}/pay`).send({
    payments: [
      { method: "cash", amount: 100 },
      { method: "upi", amount: 215, reference: "TEST-REF" },
    ],
  });
  assert.equal(pay.status, 200, pay.text);
  assert.equal((await M.InventoryItem.findById(ingredient._id)).quantity, 964);
  assert.equal(await M.Payment.countDocuments({ order: qrOrder._id }), 2);
  assert.equal(
    (
      await cashier
        .post(`/api/orders/${qrOrder._id}/pay`)
        .send({ payments: [{ method: "cash", amount: 315 }] })
    ).status,
    200,
  );
  assert.equal((await M.InventoryItem.findById(ingredient._id)).quantity, 964);
  assert.equal(await M.Payment.countDocuments({ order: qrOrder._id }), 2);
  assert.equal(
    (
      await cashier
        .patch(`/api/orders/${qrOrder._id}/status`)
        .send({ status: "completed" })
    ).status,
    200,
  );
  assert.equal((await M.Table.findById(table._id)).status, "cleaning");
  const low = await owner.get("/api/inventory?low=true");
  assert.equal(low.body.data.length, 1);
  const report = await owner.get("/api/reports");
  assert.equal(report.body.data.sales, 315);
  assert.equal(report.body.data.ordersCount, 1);
  assert.equal(report.body.data.cost, 36);
  assert.equal(report.body.data.payments.length, 2);
});
test("POS offers, loyalty, held orders, payment validation and stock rollback", async () => {
  await owner.post("/api/discounts").send({
    code: "SAVE10",
    type: "percentage",
    value: 10,
    minOrder: 100,
    maxDiscount: 20,
    startDate: new Date(Date.now() - 1000),
    endDate: new Date(Date.now() + 86400000),
    active: true,
  });
  const body = {
    idempotencyKey: crypto.randomUUID(),
    type: "takeaway",
    customer: customer._id,
    discountCode: "SAVE10",
    items: [{ product: product._id, quantity: 2 }],
  };
  const result = await cashier.post("/api/orders").send(body);
  assert.equal(result.status, 201, result.text);
  const o = result.body.data;
  assert.equal(o.subtotal, 200);
  assert.equal(o.discount, 20);
  assert.equal(o.tax, 9);
  assert.equal(o.total, 189);
  assert.equal(
    (
      await cashier
        .post(`/api/orders/${o._id}/pay`)
        .send({ payments: [{ method: "cash", amount: 1 }] })
    ).status,
    400,
  );
  const before = (await M.InventoryItem.findById(ingredient._id)).quantity;
  await M.InventoryItem.updateOne(
    { _id: ingredient._id },
    { $set: { quantity: 1 } },
  );
  assert.equal(
    (
      await cashier
        .post(`/api/orders/${o._id}/pay`)
        .send({ payments: [{ method: "card", amount: 189 }] })
    ).status,
    409,
  );
  assert.equal((await M.Order.findById(o._id)).paymentStatus, "unpaid");
  assert.equal(await M.Payment.countDocuments({ order: o._id }), 0);
  await M.InventoryItem.updateOne(
    { _id: ingredient._id },
    { $set: { quantity: before } },
  );
  assert.equal(
    (
      await cashier
        .post(`/api/orders/${o._id}/pay`)
        .send({ payments: [{ method: "card", amount: 189 }] })
    ).status,
    200,
  );
  const c = await M.Customer.findById(customer._id);
  assert.equal(c.points, 18);
  assert.equal(c.totalSpend, 189);
  const hold = await cashier
    .post("/api/held-orders")
    .send({ name: "Guest order", cart: { items: body.items } });
  assert.equal(hold.status, 201);
  assert.equal((await cashier.get("/api/held-orders")).body.data.length, 1);
  await cashier.delete(`/api/held-orders/${hold.body.data._id}`);
  assert.equal((await cashier.get("/api/held-orders")).body.data.length, 0);
  const redeem = await cashier.post("/api/orders").send({
    ...body,
    idempotencyKey: crypto.randomUUID(),
    discountCode: "",
    redeemPoints: 10,
  });
  assert.equal(redeem.status, 201, redeem.text);
  assert.equal((await M.Customer.findById(customer._id)).points, 8);
  assert.equal(
    (
      await cashier
        .patch(`/api/orders/${redeem.body.data._id}/status`)
        .send({ status: "cancelled", reason: "Guest changed their mind" })
    ).status,
    200,
  );
  assert.equal((await M.Customer.findById(customer._id)).points, 18);
});
test("Concurrent payments deduct stock once; concurrent loyalty redemptions cannot overspend", async () => {
  const res = await cashier.post("/api/orders").send({
    idempotencyKey: crypto.randomUUID(),
    type: "takeaway",
    items: [{ product: product._id, quantity: 1 }],
  });
  const o = res.body.data;
  const before = (await M.InventoryItem.findById(ingredient._id)).quantity;
  const responses = await Promise.all(
    [1, 2].map(() =>
      cashier
        .post(`/api/orders/${o._id}/pay`)
        .send({ payments: [{ method: "cash", amount: o.total }] }),
    ),
  );
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(
    (await M.InventoryItem.findById(ingredient._id)).quantity,
    before - 18,
  );
  assert.equal(await M.Payment.countDocuments({ order: o._id }), 1);
  const redemptions = await Promise.all(
    [1, 2].map(() =>
      cashier.post("/api/orders").send({
        idempotencyKey: crypto.randomUUID(),
        type: "takeaway",
        customer: customer._id,
        redeemPoints: 15,
        items: [{ product: product._id, quantity: 1 }],
      }),
    ),
  );
  assert.equal(redemptions.filter((r) => r.status === 201).length, 1);
  assert.equal((await M.Customer.findById(customer._id)).points, 3);
});
test("CRUD validations, reference integrity, stock history and disabled accounts", async () => {
  assert.equal(
    (
      await owner.post("/api/expenses").send({
        title: "Electric bill",
        category: "Electricity",
        amount: -1,
        date: new Date(),
        paymentMethod: "cash",
      })
    ).status,
    400,
  );
  const expense = await owner.post("/api/expenses").send({
    title: "Electric bill",
    category: "Electricity",
    amount: 100,
    date: new Date(),
    paymentMethod: "cash",
  });
  assert.equal(expense.status, 201);
  assert.equal(
    (await owner.delete(`/api/expenses/${expense.body.data._id}`)).status,
    200,
  );
  assert.equal(
    (await owner.delete(`/api/inventory/${ingredient._id}`)).status,
    400,
  );
  assert.equal(
    (
      await owner
        .post(`/api/inventory/${ingredient._id}/adjust`)
        .send({ delta: -10000, reason: "Bad adjustment" })
    ).status,
    400,
  );
  assert.equal(
    (await owner.get(`/api/inventory/${ingredient._id}/history`)).body.data
      .length > 0,
    true,
  );
  const cashierUser = await M.User.findOne({ role: "cashier" });
  assert.equal(
    (
      await owner.put(`/api/staff/${cashierUser._id}`).send({
        name: cashierUser.name,
        email: cashierUser.email,
        role: "cashier",
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await cashier.get("/api/orders")).status, 401);
});
