import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import dotenv from "dotenv";
import { expect, test } from "@playwright/test";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const testDatabase = new Pool({ connectionString: databaseUrl });
let emailForCleanup: string | null = null;

test.afterEach(async () => {
  if (!emailForCleanup) return;

  await testDatabase.query(
    `DELETE FROM bookings
     WHERE customer_email = $1
        OR user_id IN (SELECT id FROM users WHERE email = $1)`,
    [emailForCleanup]
  );
  await testDatabase.query(`DELETE FROM users WHERE email = $1`, [
    emailForCleanup,
  ]);

  emailForCleanup = null;
});

test.afterAll(async () => {
  await testDatabase.end();
});

test("customer can sign up, book, cancel, and sign in again", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const email = `e2e-${randomUUID()}@example.test`;
  const password = "Playwright-Test-2030!";
  emailForCleanup = email;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Playwright Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/my-bookings$/, { timeout: 30_000 });
  await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();

  await page.goto("/booking");
  await page.getByLabel("Treatment").selectOption({ index: 1 });
  await page.getByLabel("Date").fill("2030-01-07");

  const firstAvailableTime = page
    .getByRole("button", { name: /^\d{2}:\d{2}$/ })
    .first();
  await expect(firstAvailableTime).toBeVisible();
  await firstAvailableTime.click();

  await page.getByLabel("Full name").fill("Playwright Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("London postcode").fill("E1 6AN");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(
    page.getByRole("heading", { name: "Booking confirmed" })
  ).toBeVisible();

  const referenceLine = await page.getByText(/^Reference: RB-/).innerText();
  const reference = referenceLine.replace("Reference:", "").trim();

  await page.goto("/my-bookings");
  await expect(page.getByText(`Reference: ${reference}`)).toBeVisible();

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText(`Reference: ${reference}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/my-bookings");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/my-bookings$/);
  await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
});

test("availability rejects past dates and Sundays and respects closing time", async ({
  request,
}) => {
  const treatmentsResponse = await request.get("/api/treatments");
  expect(treatmentsResponse.ok()).toBeTruthy();

  const treatments = await treatmentsResponse.json();
  const massage = treatments.find(
    (treatment: { name: string }) => treatment.name === "Deep Tissue Massage"
  );

  if (!massage) throw new Error("Deep Tissue Massage was not seeded");

  const sundayResponse = await request.get(
    `/api/availability?treatmentId=${massage.id}&date=2030-01-06`
  );
  expect(sundayResponse.ok()).toBeTruthy();
  expect(await sundayResponse.json()).toEqual({ availableTimes: [] });

  const pastDateResponse = await request.get(
    `/api/availability?treatmentId=${massage.id}&date=2020-01-06`
  );
  expect(pastDateResponse.ok()).toBeTruthy();
  expect(await pastDateResponse.json()).toEqual({ availableTimes: [] });

  const mondayResponse = await request.get(
    `/api/availability?treatmentId=${massage.id}&date=2030-01-07`
  );
  const mondayTimes = (await mondayResponse.json()).availableTimes as string[];

  // A 90-minute massage can start at 16:30 and finish by 18:00, but not at 17:00.
  expect(mondayTimes).toContain("16:30");
  expect(mondayTimes).not.toContain("17:00");
});

test("booking API rejects a non-London postcode", async ({ request }) => {
  const treatmentsResponse = await request.get("/api/treatments");
  const treatments = await treatmentsResponse.json();
  const treatment = treatments.find(
    (item: { name: string }) => item.name === "Gel Manicure"
  );

  if (!treatment) throw new Error("Gel Manicure was not seeded");

  const response = await request.post("/api/bookings", {
    data: {
      treatmentId: treatment.id,
      date: "2030-01-07",
      time: "09:00",
      fullName: "Invalid Postcode Test",
      email: `e2e-invalid-${randomUUID()}@example.test`,
      postcode: "W",
    },
  });

  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("postcode");
});

test("booking API rejects a time that has already been booked", async ({
  request,
}) => {
  const treatmentsResponse = await request.get("/api/treatments");
  const treatments = await treatmentsResponse.json();
  const massage = treatments.find(
    (item: { name: string }) => item.name === "Deep Tissue Massage"
  );

  if (!massage) throw new Error("Deep Tissue Massage was not seeded");

  const email = `e2e-overlap-${randomUUID()}@example.test`;
  emailForCleanup = email;

  const booking = {
    treatmentId: massage.id,
    date: "2030-01-07",
    time: "16:30",
    fullName: "Overlap Test",
    email,
    postcode: "E1 6AN",
  };

  const firstResponse = await request.post("/api/bookings", {
    data: booking,
  });
  expect(firstResponse.status()).toBe(201);

  const duplicateResponse = await request.post("/api/bookings", {
    data: booking,
  });
  expect(duplicateResponse.status()).toBe(409);
});