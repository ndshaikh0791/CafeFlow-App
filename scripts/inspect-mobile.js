import "dotenv/config";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:5173/login");
await page.getByLabel("Email address").fill("owner@cafeflow.local");
await page
  .getByLabel("Password", { exact: true })
  .fill(process.env.SEED_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.goto("http://localhost:5173/pos");
await page.locator(".product-card").first().waitFor();
console.log(
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.right > innerWidth + 1 && r.width > 0;
      })
      .map((e) => ({
        tag: e.tagName,
        class: e.className,
        right: Math.round(e.getBoundingClientRect().right),
        width: Math.round(e.getBoundingClientRect().width),
      }))
      .slice(0, 30),
  ),
);
await page.screenshot({
  path: ".artifacts/pos-mobile-before.png",
  fullPage: true,
});
await browser.close();
