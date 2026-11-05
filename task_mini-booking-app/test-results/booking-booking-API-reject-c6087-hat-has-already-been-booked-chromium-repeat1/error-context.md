# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking.spec.ts >> booking API rejects a time that has already been booked
- Location: e2e\booking.spec.ts:155:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
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
  92  |   await expect(page).toHaveURL(/\/my-bookings$/, { timeout: 30_000 });
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
> 181 |   expect(firstResponse.status()).toBe(201);
      |                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  182 | 
  183 |   const duplicateResponse = await request.post("/api/bookings", {
  184 |     data: booking,
  185 |   });
  186 |   expect(duplicateResponse.status()).toBe(409);
  187 | });
  188 | 
  189 | test("cancellation is rejected less than 24 hours before the appointment", async ({
  190 |   page,
  191 | }) => {
  192 |   const email = `e2e-cancel-cutoff-${randomUUID()}@example.test`;
  193 |   const password = "Playwright-Test-2030!";
  194 |   emailForCleanup = email;
  195 | 
  196 |   // Create an account and stay signed in.
  197 |   await page.goto("/register");
  198 |   await page.getByLabel("Full name").fill("Cancellation Test");
  199 |   await page.getByLabel("Email").fill(email);
  200 |   await page.getByLabel("Password").fill(password);
  201 |   await page.getByRole("button", { name: "Create account" }).click();
  202 |   await expect(page).toHaveURL(/\/my-bookings$/, { timeout: 30_000 });
  203 | 
  204 |   // Find the new user and one seeded treatment.
  205 |   const userResult = await testDatabase.query<{ id: number }>(
  206 |     `SELECT id FROM users WHERE email = $1`,
  207 |     [email]
  208 |   );
  209 |   const treatmentResult = await testDatabase.query<{
  210 |     id: number;
  211 |     duration_minutes: number;
  212 |     price_pence: number;
  213 |   }>(
  214 |     `SELECT id, duration_minutes, price_pence
  215 |      FROM treatments
  216 |      WHERE name = 'Gel Manicure'`
  217 |   );
  218 | 
  219 |   const user = userResult.rows[0];
  220 |   const treatment = treatmentResult.rows[0];
  221 |   if (!user || !treatment) {
  222 |     throw new Error("Test user or seeded treatment was not found");
  223 |   }
  224 | 
  225 |   const reference = `RB-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  226 | 
  227 |   // Insert a booking just inside the 24-hour cancellation cutoff.
  228 |   await testDatabase.query(
  229 |     `INSERT INTO bookings (
  230 |        reference, user_id, treatment_id, customer_name, customer_email,
  231 |        postcode, starts_at, ends_at, price_pence, duration_minutes, status
  232 |      )
  233 |      VALUES (
  234 |        $1, $2, $3, $4, $5, $6,
  235 |        NOW() + INTERVAL '23 hours 59 minutes',
  236 |        NOW() + INTERVAL '23 hours 59 minutes'
  237 |          + ($7 * INTERVAL '1 minute'),
  238 |        $8, $7, 'booked'
  239 |      )`,
  240 |     [
  241 |       reference,
  242 |       user.id,
  243 |       treatment.id,
  244 |       "Cancellation Test",
  245 |       email,
  246 |       "E1 6AN",
  247 |       treatment.duration_minutes,
  248 |       treatment.price_pence,
  249 |     ]
  250 |   );
  251 | 
  252 |   // Use the signed-in browser session to call the cancellation API.
  253 |   const result = await page.evaluate(async (bookingReference) => {
  254 |     const response = await fetch("/api/bookings/cancel", {
  255 |       method: "POST",
  256 |       headers: { "Content-Type": "application/json" },
  257 |       body: JSON.stringify({ reference: bookingReference }),
  258 |     });
  259 |     return { status: response.status, body: await response.json() };
  260 |   }, reference);
  261 | 
  262 |   expect(result.status).toBe(409);
  263 |   expect(result.body.error).toContain("24 hours");
  264 | });
  265 | 
  266 | test("a customer cannot cancel another customer's booking", async ({
  267 |   page,
  268 | }) => {
  269 |   const customerAEmail = `e2e-owner-a-${randomUUID()}@example.test`;
  270 |   const customerBEmail = `e2e-owner-b-${randomUUID()}@example.test`;
  271 |   const password = "Playwright-Test-2030!";
  272 |   emailForCleanup = customerAEmail;
  273 | 
  274 |   await page.goto("/register");
  275 |   await page.getByLabel("Full name").fill("Customer A");
  276 |   await page.getByLabel("Email").fill(customerAEmail);
  277 |   await page.getByLabel("Password").fill(password);
  278 |   await page.getByRole("button", { name: "Create account" }).click();
  279 |   await expect(page).toHaveURL(/\/my-bookings$/, { timeout: 30_000 });
  280 | 
  281 |   const customerBResult = await testDatabase.query<{ id: number }>(
```