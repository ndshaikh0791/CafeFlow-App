import "dotenv/config";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
try {
  const productName = "Form check latte " + Date.now();
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto("http://localhost:5173/login");
  await page.getByLabel("Email address").fill("owner@cafeflow.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  const category = (
    await (
      await context.request.post("http://localhost:5173/api/categories", {
        data: { name: `Form check ${Date.now()}` },
      })
    ).json()
  ).data;
  await page.goto("http://localhost:5173/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill(productName);
  await page.getByLabel("SKU", { exact: true }).fill(`FORM-${Date.now()}`);
  await page.getByLabel("Category", { exact: true }).selectOption(category._id);
  await page.getByLabel("Selling price", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: productName });
  await row.waitFor();
  await row.getByTitle("Edit", { exact: true }).click();
  await page
    .getByLabel("Category", { exact: true })
    .locator("option")
    .last()
    .waitFor({ state: "attached" });
  assert.equal(
    await page.getByLabel("Category", { exact: true }).inputValue(),
    category._id,
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("Updated browser form");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  console.log("PASS product create/edit and retained category relationship");
  const product = (
    await (
      await context.request.get(
        "http://localhost:5173/api/products?search=" +
          encodeURIComponent(productName),
      )
    ).json()
  ).data[0];
  const ingredient = (
    await (
      await context.request.get("http://localhost:5173/api/inventory?limit=200")
    ).json()
  ).data[0];
  await page.goto("http://localhost:5173/recipes");
  await page.getByRole("button", { name: "Add recipe", exact: true }).click();
  await page
    .getByLabel("Menu product", { exact: true })
    .selectOption(product._id);
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Ingredient", exact: true })
    .selectOption(ingredient._id);
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  const recipeRow = page.getByRole("row").filter({ hasText: productName });
  await recipeRow.waitFor();
  await recipeRow.getByTitle("Edit", { exact: true }).click();
  await page
    .getByLabel("Menu product", { exact: true })
    .locator("option")
    .last()
    .waitFor({ state: "attached" });
  assert.equal(
    await page.getByLabel("Menu product", { exact: true }).inputValue(),
    product._id,
  );
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await recipeRow.getByTitle("Delete", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await recipeRow.waitFor({ state: "detached" });
  await context.request.delete(
    `http://localhost:5173/api/products/${product._id}`,
  );
  await context.request.delete(
    `http://localhost:5173/api/categories/${category._id}`,
  );
  console.log(
    "PASS recipe create/edit/delete and retained ingredient relationships",
  );
  await page.goto("http://localhost:5173/settings");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Settings saved", { exact: true }).waitFor();
  console.log("PASS settings save with zero service charge");
  for (const [role, destination] of [
    ["manager", "dashboard"],
    ["cashier", "pos"],
    ["kitchen", "kitchen"],
  ]) {
    const isolated = await browser.newContext(),
      staff = await isolated.newPage();
    await staff.goto("http://localhost:5173/login");
    await staff.getByLabel("Email address").fill(`${role}@cafeflow.local`);
    await staff
      .getByLabel("Password", { exact: true })
      .fill(process.env.SEED_PASSWORD);
    await staff.getByRole("button", { name: "Sign in", exact: true }).click();
    await staff.waitForURL(`**/${destination}`);
    await staff.goto("http://localhost:5173/staff");
    await staff.waitForURL(`**/${destination}`);
    console.log(`PASS ${role} login and restricted staff route`);
    await isolated.close();
  }
} finally {
  await browser.close();
}
