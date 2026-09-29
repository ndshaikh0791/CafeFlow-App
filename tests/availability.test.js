import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";

test("health reports unavailable when MongoDB is disconnected", async () => {
  const response = await request(createApp()).get("/api/health");
  assert.equal(response.status, 503);
  assert.equal(response.body.data.database, "disconnected");
});

test("login reports a database outage without waiting for a query timeout", async () => {
  const response = await request(createApp())
    .post("/api/auth/login")
    .send({ email: "owner@cafeflow.local", password: "test-password" });
  assert.equal(response.status, 503);
  assert.match(response.body.error, /Database is unavailable/);
});
