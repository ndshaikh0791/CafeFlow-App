import "dotenv/config";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
mkdirSync(".artifacts", { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("401"))
    errors.push(m.text() + " " + m.location().url);
});
try {
  await page.goto("http://localhost:5173/login");
  await page.getByLabel("Email address").fill("owner@cafeflow.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("Sales overview", { exact: true }).waitFor();
  await page.screenshot({
    path: ".artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  console.log("PASS owner login and dashboard");
  for (const path of [
    "products",
    "categories",
    "tables",
    "inventory",
    "recipes",
    "customers",
    "staff",
    "expenses",
    "reports",
    "discounts",
    "settings",
    "orders",
    "kitchen",
    "pos",
  ]) {
    await page.goto(`http://localhost:5173/${path}`);
    await page.locator(".page-heading h1").waitFor();
    await page.waitForTimeout(400);
    assert.equal(
      await page.getByText("We couldn’t load this", { exact: true }).count(),
      0,
      `${path} failed to load`,
    );
    console.log(`PASS page ${path}`);
  }
  await page.locator(".product-card").filter({ hasText: "Cappuccino" }).click();
  await page.getByLabel("Size", { exact: true }).selectOption("Large");
  await page.getByLabel("Extra shot").check();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("button", { name: "Takeaway", exact: true }).click();
  await page.getByPlaceholder("Promo code").fill("WELCOME10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByText("Discounts and totals verified", { exact: true })
    .waitFor();
  await page.screenshot({ path: ".artifacts/pos-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Place order & pay" }).click();
  await page.getByRole("button", { name: /Confirm payment/ }).click();
  await page
    .getByRole("button", { name: "Print receipt", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Print receipt", exact: true })
    .click();
  await page
    .frameLocator("iframe")
    .getByText("PAID", { exact: false })
    .waitFor();
  assert.ok(
    (await page.frameLocator("iframe").locator("body").innerText()).includes(
      "Cappuccino",
    ),
  );
  await page.getByRole("button", { name: "New order", exact: true }).click();
  console.log("PASS POS customization, offer, order and payment");
  await page.goto("http://localhost:5173/categories");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  const category = `Browser test ${Date.now()}`;
  await page.getByLabel("Category name").fill(category);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Created and removed by browser verification");
  await page.getByRole("button", { name: "Save category" }).click();
  await page.getByRole("cell", { name: category, exact: true }).waitFor();
  const row = page.getByRole("row").filter({ hasText: category });
  await row.getByTitle("Edit", { exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Updated through the browser");
  await page.getByRole("button", { name: "Save category" }).click();
  await page
    .getByRole("cell", { name: "Updated through the browser", exact: true })
    .waitFor();
  await row.getByTitle("Delete", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page
    .getByRole("cell", { name: category, exact: true })
    .waitFor({ state: "detached" });
  console.log("PASS browser category create/edit/delete");
  const tables = await (
    await context.request.get("http://localhost:5173/api/tables?limit=200")
  ).json();
  const table = tables.data.find((t) => t.status === "available");
  assert.ok(table, "Available seed table required");
  await page.goto("http://localhost:5173/tables");
  await page
    .locator(".table-card")
    .filter({ has: page.getByText(table.name, { exact: true }) })
    .getByTitle("Table QR code")
    .click();
  await page.getByAltText(`QR code for table ${table.name}`).waitFor();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download", exact: true }).click();
  assert.equal((await downloaded).suggestedFilename(), `${table.name}-qr.png`);
  await page.getByRole("button", { name: "Print QR", exact: true }).click();
  await page
    .frameLocator("iframe")
    .getByText("Your table. Your favorites.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  console.log("PASS receipt, QR download and print layouts");
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await guest.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(`http://localhost:5173/menu/${table.qrToken}`);
  await mobile.getByText("Something for every mood", { exact: true }).waitFor();
  await mobile.screenshot({
    path: ".artifacts/qr-menu-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Mobile menu overflow",
  );
  await mobile
    .locator(".product-card")
    .filter({ hasText: "Cappuccino" })
    .click();
  await mobile.getByLabel("Size", { exact: true }).selectOption("Large");
  await mobile.getByLabel("Extra shot").check();
  await mobile.getByRole("button", { name: /Add to order/ }).click();
  await mobile.getByRole("button", { name: /View order/ }).click();
  await mobile
    .getByRole("button", { name: "Place order", exact: true })
    .click();
  await mobile.getByText("You’re in good hands.", { exact: true }).waitFor();
  await mobile.screenshot({
    path: ".artifacts/qr-tracking-mobile.png",
    fullPage: true,
  });
  console.log("PASS mobile QR customization and order tracking");
  const trackingLink = await mobile
    .getByRole("link", { name: "Save this tracking link" })
    .getAttribute("href");
  const token = trackingLink.split("/").pop();
  const order = (
    await (
      await guest.request.get(
        `http://localhost:5173/api/public/orders/${token}`,
      )
    ).json()
  ).data;
  for (const status of ["accepted", "preparing", "ready"]) {
    const result = await context.request.patch(
      `http://localhost:5173/api/orders/${order._id}/status`,
      { data: { status } },
    );
    assert.equal(result.status(), 200);
  }
  await mobile
    .getByText("Ready for you!", { exact: true })
    .waitFor({ timeout: 15000 });
  console.log("PASS kitchen updates reach customer tracking");
  await context.request.patch(
    `http://localhost:5173/api/orders/${order._id}/status`,
    {
      data: { status: "cancelled", reason: "Automated browser check complete" },
    },
  );
  await context.request.put(`http://localhost:5173/api/tables/${table._id}`, {
    data: { name: table.name, capacity: table.capacity, status: "available" },
  });
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["dashboard", "pos", "kitchen", "tables", "settings"]) {
      await page.goto(`http://localhost:5173/${path}`);
      await page.locator(".page-heading h1").waitFor();
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${path} overflow at ${viewport.width}`,
      );
    }
    await page.goto("http://localhost:5173/dashboard");
    await page.getByText("Sales overview", { exact: true }).waitFor();
    await page.screenshot({
      path: `.artifacts/dashboard-${viewport.width}.png`,
      fullPage: true,
    });
    console.log(`PASS responsive admin ${viewport.width}px`);
  }
  assert.deepEqual(errors, [], "Browser runtime errors");
  writeFileSync(
    ".artifacts/browser-result.json",
    JSON.stringify(
      { passed: true, runtimeErrors: errors, date: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log("PASS no browser runtime errors");
  await guest.close();
} finally {
  await browser.close();
}
