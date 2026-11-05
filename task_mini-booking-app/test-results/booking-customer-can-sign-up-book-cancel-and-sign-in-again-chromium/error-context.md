# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking.spec.ts >> customer can sign up, book, cancel, and sign in again
- Location: e2e\booking.spec.ts:36:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/my-bookings$/
Received string:  "http://localhost:3000/register"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="en" class="geist_a71539c9-module__T19VSG__variable geist_mono_8d43a2aa-module__8Li5zG__variable h-full antialiased">…</html>
       - unexpected value "http://localhost:3000/register"

```

```yaml
- main:
  - heading "Create an account" [level=1]
  - text: Full name
  - textbox "Full name": Playwright Customer
  - text: Email
  - textbox "Email": e2e-ebccfa3f-2bf9-4906-840b-c97f14f0de38@example.test
  - text: Password
  - textbox "Password": Playwright-Test-2030!
  - button "Creating account…" [disabled]
  - paragraph:
    - text: Already have an account?
    - link "Sign in":
      - /url: /login
- alert
```

# Test source

```ts
  1  | import { randomUUID } from "node:crypto";
  2  | import { Pool } from "pg";
  3  | import dotenv from "dotenv";
  4  | import { expect, test } from "@playwright/test";
  5  | 
  6  | dotenv.config({ path: ".env.local" });
  7  | 
  8  | const databaseUrl = process.env.DATABASE_URL;
  9  | if (!databaseUrl) {
  10 |   throw new Error("DATABASE_URL is missing from .env.local");
  11 | }
  12 | 
  13 | const testDatabase = new Pool({ connectionString: databaseUrl });
  14 | let emailForCleanup: string | null = null;
  15 | 
  16 | test.afterEach(async () => {
  17 |   if (!emailForCleanup) return;
  18 | 
  19 |   await testDatabase.query(
  20 |     `DELETE FROM bookings
  21 |      WHERE customer_email = $1
  22 |         OR user_id IN (SELECT id FROM users WHERE email = $1)`,
  23 |     [emailForCleanup]
  24 |   );
  25 |   await testDatabase.query(`DELETE FROM users WHERE email = $1`, [
  26 |     emailForCleanup,
  27 |   ]);
  28 | 
  29 |   emailForCleanup = null;
  30 | });
  31 | 
  32 | test.afterAll(async () => {
  33 |   await testDatabase.end();
  34 | });
  35 | 
  36 | test("customer can sign up, book, cancel, and sign in again", async ({
  37 |   page,
  38 | }) => {
  39 |   test.setTimeout(60_000);
  40 | 
  41 |   const email = `e2e-${randomUUID()}@example.test`;
  42 |   const password = "Playwright-Test-2030!";
  43 |   emailForCleanup = email;
  44 | 
  45 |   await page.goto("/register");
  46 |   await page.getByLabel("Full name").fill("Playwright Customer");
  47 |   await page.getByLabel("Email").fill(email);
  48 |   await page.getByLabel("Password").fill(password);
  49 |   await page.getByRole("button", { name: "Create account" }).click();
  50 | 
> 51 |   await expect(page).toHaveURL(/\/my-bookings$/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  52 |   await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
  53 | 
  54 |   await page.goto("/booking");
  55 |   await page.getByLabel("Treatment").selectOption({ index: 1 });
  56 |   await page.getByLabel("Date").fill("2030-01-07");
  57 | 
  58 |   const firstAvailableTime = page
  59 |     .getByRole("button", { name: /^\d{2}:\d{2}$/ })
  60 |     .first();
  61 |   await expect(firstAvailableTime).toBeVisible();
  62 |   await firstAvailableTime.click();
  63 | 
  64 |   await page.getByLabel("Full name").fill("Playwright Customer");
  65 |   await page.getByLabel("Email").fill(email);
  66 |   await page.getByLabel("London postcode").fill("E1 6AN");
  67 |   await page.getByRole("button", { name: "Confirm booking" }).click();
  68 | 
  69 |   await expect(
  70 |     page.getByRole("heading", { name: "Booking confirmed" })
  71 |   ).toBeVisible();
  72 | 
  73 |   const referenceLine = await page.getByText(/^Reference: RB-/).innerText();
  74 |   const reference = referenceLine.replace("Reference:", "").trim();
  75 | 
  76 |   await page.goto("/my-bookings");
  77 |   await expect(page.getByText(`Reference: ${reference}`)).toBeVisible();
  78 | 
  79 |   await page.getByRole("button", { name: "Cancel booking" }).click();
  80 |   await expect(page.getByText(`Reference: ${reference}`)).toHaveCount(0);
  81 | 
  82 |   await page.getByRole("button", { name: "Sign out" }).click();
  83 |   await expect(page).toHaveURL("/");
  84 | 
  85 |   await page.goto("/my-bookings");
  86 |   await expect(page).toHaveURL(/\/login$/);
  87 | 
  88 |   await page.getByLabel("Email").fill(email);
  89 |   await page.getByLabel("Password").fill(password);
  90 |   await page.getByRole("button", { name: "Sign in" }).click();
  91 | 
  92 |   await expect(page).toHaveURL(/\/my-bookings$/);
  93 |   await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
  94 | });
```