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
Received string:  "http://localhost:3000/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="en" class="geist_a71539c9-module__T19VSG__variable geist_mono_8d43a2aa-module__8Li5zG__variable h-full antialiased">…</html>
       - unexpected value "http://localhost:3000/login"

```

```yaml
- main:
  - heading "Sign in" [level=1]
  - text: Email
  - textbox "Email": e2e-ec383d84-2a91-4643-97d6-1425efafada3@example.test
  - text: Password
  - textbox "Password": Playwright-Test-2030!
  - button "Sign in"
  - paragraph:
    - text: Need an account?
    - link "Create one":
      - /url: /register
- alert
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto";
  2   | import { Pool } from "pg";
  3   | import dotenv from "dotenv";
  4   | import { expect, test } from "@playwright/test";
  5   | 
  6   | dotenv.config({ path: ".env.local" });
  7   | 
  8   | const databaseUrl = process.env.DATABASE_URL;
  9   | if (!databaseUrl) {
  10  |   throw new Error("DATABASE_URL is missing from .env.local");
  11  | }
  12  | 
  13  | const testDatabase = new Pool({ connectionString: databaseUrl });
  14  | let emailForCleanup: string | null = null;
  15  | 
  16  | test.afterEach(async () => {
  17  |   if (!emailForCleanup) return;
  18  | 
  19  |   await testDatabase.query(
  20  |     `DELETE FROM bookings
  21  |      WHERE customer_email = $1
  22  |         OR user_id IN (SELECT id FROM users WHERE email = $1)`,
  23  |     [emailForCleanup]
  24  |   );
  25  |   await testDatabase.query(`DELETE FROM users WHERE email = $1`, [
  26  |     emailForCleanup,
  27  |   ]);
  28  | 
  29  |   emailForCleanup = null;
  30  | });
  31  | 
  32  | test.afterAll(async () => {
  33  |   await testDatabase.end();
  34  | });
  35  | 
  36  | test("customer can sign up, book, cancel, and sign in again", async ({
  37  |   page,
  38  | }) => {
  39  |   test.setTimeout(60_000);
  40  | 
  41  |   const email = `e2e-${randomUUID()}@example.test`;
  42  |   const password = "Playwright-Test-2030!";
  43  |   emailForCleanup = email;
  44  | 
  45  |   await page.goto("/register");
  46  |   await page.getByLabel("Full name").fill("Playwright Customer");
  47  |   await page.getByLabel("Email").fill(email);
  48  |   await page.getByLabel("Password").fill(password);
  49  |   await page.getByRole("button", { name: "Create account" }).click();
  50  | 
  51  |   await expect(page).toHaveURL(/\/my-bookings$/, { timeout: 30_000 });
  52  |   await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
  53  | 
  54  |   await page.goto("/booking");
  55  |   await page.getByLabel("Treatment").selectOption({ index: 1 });
  56  |   await page.getByLabel("Date").fill("2030-01-07");
  57  | 
  58  |   const firstAvailableTime = page
  59  |     .getByRole("button", { name: /^\d{2}:\d{2}$/ })
  60  |     .first();
  61  |   await expect(firstAvailableTime).toBeVisible();
  62  |   await firstAvailableTime.click();
  63  | 
  64  |   await page.getByLabel("Full name").fill("Playwright Customer");
  65  |   await page.getByLabel("Email").fill(email);
  66  |   await page.getByLabel("London postcode").fill("E1 6AN");
  67  |   await page.getByRole("button", { name: "Confirm booking" }).click();
  68  | 
  69  |   await expect(
  70  |     page.getByRole("heading", { name: "Booking confirmed" })
  71  |   ).toBeVisible();
  72  | 
  73  |   const referenceLine = await page.getByText(/^Reference: RB-/).innerText();
  74  |   const reference = referenceLine.replace("Reference:", "").trim();
  75  | 
  76  |   await page.goto("/my-bookings");
  77  |   await expect(page.getByText(`Reference: ${reference}`)).toBeVisible();
  78  | 
  79  |   await page.getByRole("button", { name: "Cancel booking" }).click();
  80  |   await expect(page.getByText(`Reference: ${reference}`)).toHaveCount(0);
  81  | 
  82  |   await page.getByRole("button", { name: "Sign out" }).click();
  83  |   await expect(page).toHaveURL("/");
  84  | 
  85  |   await page.goto("/my-bookings");
  86  |   await expect(page).toHaveURL(/\/login$/);
  87  | 
  88  |   await page.getByLabel("Email").fill(email);
  89  |   await page.getByLabel("Password").fill(password);
  90  |   await page.getByRole("button", { name: "Sign in" }).click();
  91  | 
> 92  |   await expect(page).toHaveURL(/\/my-bookings$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  93  |   await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
  94  | });
  95  | 
  96  | test("availability rejects past dates and Sundays and respects closing time", async ({
  97  |   request,
  98  | }) => {
  99  |   const treatmentsResponse = await request.get("/api/treatments");
  100 |   expect(treatmentsResponse.ok()).toBeTruthy();
  101 | 
  102 |   const treatments = await treatmentsResponse.json();
  103 |   const massage = treatments.find(
  104 |     (treatment: { name: string }) => treatment.name === "Deep Tissue Massage"
  105 |   );
  106 | 
  107 |   if (!massage) throw new Error("Deep Tissue Massage was not seeded");
  108 | 
  109 |   const sundayResponse = await request.get(
  110 |     `/api/availability?treatmentId=${massage.id}&date=2030-01-06`
  111 |   );
  112 |   expect(sundayResponse.ok()).toBeTruthy();
  113 |   expect(await sundayResponse.json()).toEqual({ availableTimes: [] });
  114 | 
  115 |   const pastDateResponse = await request.get(
  116 |     `/api/availability?treatmentId=${massage.id}&date=2020-01-06`
  117 |   );
  118 |   expect(pastDateResponse.ok()).toBeTruthy();
  119 |   expect(await pastDateResponse.json()).toEqual({ availableTimes: [] });
  120 | 
  121 |   const mondayResponse = await request.get(
  122 |     `/api/availability?treatmentId=${massage.id}&date=2030-01-07`
  123 |   );
  124 |   const mondayTimes = (await mondayResponse.json()).availableTimes as string[];
  125 | 
  126 |   // A 90-minute massage can start at 16:30 and finish by 18:00, but not at 17:00.
  127 |   expect(mondayTimes).toContain("16:30");
  128 |   expect(mondayTimes).not.toContain("17:00");
  129 | });
  130 | 
  131 | test("booking API rejects a non-London postcode", async ({ request }) => {
  132 |   const treatmentsResponse = await request.get("/api/treatments");
  133 |   const treatments = await treatmentsResponse.json();
  134 |   const treatment = treatments.find(
  135 |     (item: { name: string }) => item.name === "Gel Manicure"
  136 |   );
  137 | 
  138 |   if (!treatment) throw new Error("Gel Manicure was not seeded");
  139 | 
  140 |   const response = await request.post("/api/bookings", {
  141 |     data: {
  142 |       treatmentId: treatment.id,
  143 |       date: "2030-01-07",
  144 |       time: "09:00",
  145 |       fullName: "Invalid Postcode Test",
  146 |       email: `e2e-invalid-${randomUUID()}@example.test`,
  147 |       postcode: "W",
  148 |     },
  149 |   });
  150 | 
  151 |   expect(response.status()).toBe(400);
  152 |   expect((await response.json()).error).toContain("postcode");
  153 | });
  154 | 
  155 | test("booking API rejects a time that has already been booked", async ({
  156 |   request,
  157 | }) => {
  158 |   const treatmentsResponse = await request.get("/api/treatments");
  159 |   const treatments = await treatmentsResponse.json();
  160 |   const massage = treatments.find(
  161 |     (item: { name: string }) => item.name === "Deep Tissue Massage"
  162 |   );
  163 | 
  164 |   if (!massage) throw new Error("Deep Tissue Massage was not seeded");
  165 | 
  166 |   const email = `e2e-overlap-${randomUUID()}@example.test`;
  167 |   emailForCleanup = email;
  168 | 
  169 |   const booking = {
  170 |     treatmentId: massage.id,
  171 |     date: "2030-01-07",
  172 |     time: "16:30",
  173 |     fullName: "Overlap Test",
  174 |     email,
  175 |     postcode: "E1 6AN",
  176 |   };
  177 | 
  178 |   const firstResponse = await request.post("/api/bookings", {
  179 |     data: booking,
  180 |   });
  181 |   expect(firstResponse.status()).toBe(201);
  182 | 
  183 |   const duplicateResponse = await request.post("/api/bookings", {
  184 |     data: booking,
  185 |   });
  186 |   expect(duplicateResponse.status()).toBe(409);
  187 | });
```