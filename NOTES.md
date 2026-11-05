# Project Notes

## Assumptions and decisions

- The app serves one therapist, so any active booking can conflict with any other booking.
- Customers can book as guests. If they are signed in when they book, the booking is associated with their account.
- A booking saves the customer details, price, and treatment duration at the time of booking.
- The business operates Monday to Saturday, 09:00–18:00 in the `Europe/London` time zone.
- Start times follow a 30-minute grid, and the full treatment must finish by 18:00.
- The server checks availability and validates the booking; browser-side checks are for convenience and do not replace server validation.
- The supported postcode areas are E, EC, N, NW, SE, SW, W, and WC.
- Cancellation is allowed when at least 24 hours remain before an appointment. The database update rechecks this cutoff when processing a cancellation.

## Known limitations and possible improvements

- The app is designed for one therapist and does not include staff calendars, payments, reminder emails, or an admin interface.
- Booking availability is checked on the server, but simultaneous requests could still race. For production, add database-level conflict protection or transaction locking.
- The E2E suite covers the main journey and important rules, but does not test every invalid input or the exact 24-hour cancellation boundary.
- The tests share a local database and use one Playwright worker because repeated copies of the duplicate-booking test use the same fixed slot. Keep the test database separate from any production data.
- The E2E tests use fixed future dates. Update those dates if they are no longer in the future.
- The local Docker Compose file uses a development password. Production credentials and secrets must be provided securely through the deployment environment.

## Walkthrough: one booking

1. The booking page requests treatments and available start times from the app’s API.
2. The customer submits the treatment, date, time, name, email, and postcode.
3. The booking API validates the submitted values and rechecks availability on the server.
4. If the booking is valid, the API saves it in PostgreSQL with a reference and price/duration snapshot.
5. The page displays the confirmation and booking reference.

## AI use reflection

I used AI as a learning aid while setting up the app, understanding Next.js routes and authentication, and writing Playwright tests. I checked suggestions against the project files, terminal output, and browser behavior. Some early guidance needed adjustment—for example, file paths and route naming had to match the actual project structure, and a Playwright redirect check needed a longer timeout. I treated AI suggestions as drafts and used the passing E2E suite to verify the main behavior.
