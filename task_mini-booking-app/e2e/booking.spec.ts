import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import dotenv from "dotenv";
import { expect, test, type Page } from "@playwright/test";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const testDatabase = new Pool({ connectionString: databaseUrl });
let emailForCleanup: string | null = null;
let additionalEmailForCleanup: string | null = null;

test.afterEach(async () => {
  const cleanupEmails = [emailForCleanup, additionalEmailForCleanup].filter(
    (email): email is string => email !== null
  );

  if (cleanupEmails.length === 0) return;

  await testDatabase.query(
    `DELETE FROM bookings
    WHERE customer_email = ANY($1::text[])
        OR user_id IN (
          SELECT id FROM users WHERE email = ANY($1::text[])
        )`,
    [cleanupEmails]
  );

  await testDatabase.query(
    `DELETE FROM users WHERE email = ANY($1::text[])`,
    [cleanupEmails]
  );

  emailForCleanup = null;
  additionalEmailForCleanup = null;
});

test.afterAll(async () => {
  await testDatabase.end();
});

async function createSignedInCustomer(
  page: Page,
  fullName: string,
  email: string
) {
  await page.goto("/register");

  const createAccountButton = page.getByRole("button", {
    name: "Create account",
  });
  await expect(createAccountButton).toBeEnabled();

  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Playwright-Test-2030!");
  await createAccountButton.click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30_000 });
}

test("guest can choose a slot, create a profile, book, cancel, and sign in again", async ({
  page,
}) => {
  test.setTimeout(240_000);

  const email = `e2e-${randomUUID()}@example.test`;
  const password = "Playwright-Test-2030!";
  emailForCleanup = email;

  await page.goto("/booking");
  const treatmentSelect = page.getByLabel("Treatment");

  await treatmentSelect.selectOption({
    label: "Deep Tissue Massage — 90 min — £75.00",
  });
  await expect(treatmentSelect).toHaveValue(/\d+/);

  for (let month = 0; month < 48; month++) {
    if (
      await page.getByRole("heading", { name: "January 2030" }).count()
    ) {
      break;
    }

    await page.getByRole("button", { name: "Next month" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "January 2030" })
  ).toBeVisible();

  // Select 09:00 on Monday, 7 January 2030.
  await page
    .getByRole("button", { name: "7 January 2030", exact: true })
    .click();
  const firstAvailableTime = page.getByRole("button", { name: "09:00" });
  await expect(firstAvailableTime).toBeVisible({ timeout: 20_000 });
  await firstAvailableTime.click();

  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page).toHaveURL(/\/register\?returnTo=/);

  const createAccountButton = page.getByRole("button", {
    name: "Create account",
  });

  await expect(createAccountButton).toBeEnabled();

  await page.getByLabel("Full name").fill("Playwright Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await expect(page.getByLabel("Full name")).toHaveValue("Playwright Customer");
  await expect(page.getByLabel("Email")).toHaveValue(email);
  
  await createAccountButton.click();

  await expect(page).toHaveURL(/\/booking\?resume=1$/, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "09:00" })
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("London postcode").fill("E1 6AN");

  const bookingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/bookings") &&
      response.request().method() === "POST",
    { timeout: 90_000 }
  );

  await page.getByRole("button", { name: "Finalize booking" }).click();

  const bookingResponse = await bookingResponsePromise;
  expect(bookingResponse.status()).toBe(201);

  await expect(
    page.getByRole("heading", { name: "Booking confirmed" })
  ).toBeVisible();

  const referenceLine = await page.getByText(/^Reference: RB-/).innerText();
  const reference = referenceLine.replace("Reference:", "").trim();

  await page.goto("/profile");
  await expect(page.getByText(`Reference: ${reference}`)).toBeVisible();

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText(`Reference: ${reference}`)).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/profile$/, { timeout: 30_000 });
  await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();
});

test("profile edits update customer details on existing bookings", async ({
  page,
}) => {
  const email = `e2e-profile-${randomUUID()}@example.test`;
  const updatedEmail = `e2e-profile-updated-${randomUUID()}@example.test`;
  const updatedName = "Updated Profile Customer";

  emailForCleanup = email;
  additionalEmailForCleanup = updatedEmail;

  await createSignedInCustomer(page, "Profile Test Customer", email);

  const treatmentsResponse = await page.request.get("/api/treatments");
  const treatments = await treatmentsResponse.json();
  const treatment = treatments.find(
    (item: { name: string }) => item.name === "Deep Tissue Massage"
  );

  if (!treatment) throw new Error("Deep Tissue Massage was not seeded");

  const bookingResponse = await page.request.post("/api/bookings", {
    data: {
      treatmentId: treatment.id,
      date: "2030-01-08",
      time: "09:00",
      fullName: "Profile Test Customer",
      email,
      postcode: "E1 6AN",
    },
  });

  expect(bookingResponse.status()).toBe(201);

  const result = (await bookingResponse.json()) as {
    booking: { reference: string };
  };

  await page.goto("/profile");
  await expect(
    page.getByText(`Reference: ${result.booking.reference}`)
  ).toBeVisible();

  await page.getByRole("button", { name: "Change name" }).click();
  await page.getByLabel("Full name").fill(updatedName);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Your profile has been updated."
  );

  await page.getByRole("button", { name: "Change email" }).click();
  await page.getByLabel("Email").fill(updatedEmail);
  await page.getByRole("button", { name: "Save email" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Your profile has been updated."
  );

  const updatedBooking = await testDatabase.query<{
    customerName: string;
    customerEmail: string;
  }>(
    `SELECT customer_name AS "customerName",
            customer_email AS "customerEmail"
     FROM bookings
     WHERE reference = $1`,
    [result.booking.reference]
  );

  expect(updatedBooking.rows[0]).toEqual({
    customerName: updatedName,
    customerEmail: updatedEmail,
  });
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

test("booking API rejects a guest without a profile", async ({ request }) => {
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
      fullName: "Guest Test",
      email: `e2e-guest-${randomUUID()}@example.test`,
      postcode: "E1 6AN",
    },
  });

  expect(response.status()).toBe(401);
});

test("booking API rejects a non-London postcode", async ({ page }) => {
  const email = `e2e-postcode-${randomUUID()}@example.test`;
  emailForCleanup = email;
  await createSignedInCustomer(page, "Invalid Postcode Test", email);

  const treatmentsResponse = await page.request.get("/api/treatments");
  const treatments = await treatmentsResponse.json();
  const treatment = treatments.find(
    (item: { name: string }) => item.name === "Gel Manicure"
  );

  if (!treatment) throw new Error("Gel Manicure was not seeded");

  const response = await page.request.post("/api/bookings", {
    data: {
      treatmentId: treatment.id,
      date: "2030-01-07",
      time: "09:00",
      fullName: "Invalid Postcode Test",
      email,
      postcode: "W",
    },
  });

  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("postcode");
});

test("booking API rejects a time that has already been booked", async ({
  page,
}) => {
  const email = `e2e-overlap-${randomUUID()}@example.test`;
  emailForCleanup = email;
  await createSignedInCustomer(page, "Overlap Test", email);

  const treatmentsResponse = await page.request.get("/api/treatments");
  const treatments = await treatmentsResponse.json();
  const massage = treatments.find(
    (item: { name: string }) => item.name === "Deep Tissue Massage"
  );

  if (!massage) throw new Error("Deep Tissue Massage was not seeded");

  const booking = {
    treatmentId: massage.id,
    date: "2030-01-07",
    time: "16:30",
    fullName: "Overlap Test",
    email,
    postcode: "E1 6AN",
  };

  const firstResponse = await page.request.post("/api/bookings", {
    data: booking,
  });
  expect(firstResponse.status()).toBe(201);

  const duplicateResponse = await page.request.post("/api/bookings", {
    data: booking,
  });
  expect(duplicateResponse.status()).toBe(409);
});

test("cancellation is rejected less than 24 hours before the appointment", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `e2e-cancel-cutoff-${randomUUID()}@example.test`;
  const password = "Playwright-Test-2030!";
  emailForCleanup = email;

  // Create an account and stay signed in.
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Cancellation Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30_000 });

  // Find the new user and one seeded treatment.
  const userResult = await testDatabase.query<{ id: number }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  const treatmentResult = await testDatabase.query<{
    id: number;
    duration_minutes: number;
    price_pence: number;
  }>(
    `SELECT id, duration_minutes, price_pence
     FROM treatments
     WHERE name = 'Gel Manicure'`
  );

  const user = userResult.rows[0];
  const treatment = treatmentResult.rows[0];
  if (!user || !treatment) {
    throw new Error("Test user or seeded treatment was not found");
  }

  const reference = `RB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

  // Insert a booking just inside the 24-hour cancellation cutoff.
  await testDatabase.query(
    `INSERT INTO bookings (
       reference, user_id, treatment_id, customer_name, customer_email,
       postcode, starts_at, ends_at, price_pence, duration_minutes, status
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       NOW() + INTERVAL '23 hours 59 minutes',
       NOW() + INTERVAL '23 hours 59 minutes'
         + ($7 * INTERVAL '1 minute'),
       $8, $7, 'booked'
     )`,
    [
      reference,
      user.id,
      treatment.id,
      "Cancellation Test",
      email,
      "E1 6AN",
      treatment.duration_minutes,
      treatment.price_pence,
    ]
  );

  // Use the signed-in browser session to call the cancellation API.
  const result = await page.evaluate(async (bookingReference) => {
    const response = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: bookingReference }),
    });
    return { status: response.status, body: await response.json() };
  }, reference);

  expect(result.status).toBe(409);
  expect(result.body.error).toContain("24 hours");
});

test("a customer cannot cancel another customer's booking", async ({
  page,
}) => {
  const customerAEmail = `e2e-owner-a-${randomUUID()}@example.test`;
  const customerBEmail = `e2e-owner-b-${randomUUID()}@example.test`;
  const password = "Playwright-Test-2030!";
  emailForCleanup = customerAEmail;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Customer A");
  await page.getByLabel("Email").fill(customerAEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 30_000 });

  const customerBResult = await testDatabase.query<{ id: number }>(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ["Customer B", customerBEmail, "test-only-placeholder-hash"]
  );
  const customerBId = customerBResult.rows[0]?.id;

  const treatmentResult = await testDatabase.query<{
    id: number;
    duration_minutes: number;
    price_pence: number;
  }>(
    `SELECT id, duration_minutes, price_pence
     FROM treatments
     WHERE name = 'Gel Manicure'`
  );
  const treatment = treatmentResult.rows[0];

  if (!customerBId || !treatment) {
    throw new Error("Test customer or seeded treatment was not found");
  }

  const reference = `RB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

  try {
    await testDatabase.query(
      `INSERT INTO bookings (
         reference, user_id, treatment_id, customer_name, customer_email,
         postcode, starts_at, ends_at, price_pence, duration_minutes, status
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         NOW() + INTERVAL '3 days',
         NOW() + INTERVAL '3 days' + ($7 * INTERVAL '1 minute'),
         $8, $7, 'booked'
       )`,
      [
        reference,
        customerBId,
        treatment.id,
        "Customer B",
        customerBEmail,
        "E1 6AN",
        treatment.duration_minutes,
        treatment.price_pence,
      ]
    );

    const result = await page.evaluate(async (bookingReference) => {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: bookingReference }),
      });
      return { status: response.status, body: await response.json() };
    }, reference);

    expect(result.status).toBe(404);
    expect(result.body.error).toContain("not found");
  } finally {
    await testDatabase.query(
      `DELETE FROM bookings WHERE reference = $1`,
      [reference]
    );
    await testDatabase.query(
      `DELETE FROM users WHERE email = $1`,
      [customerBEmail]
    );
  }
});