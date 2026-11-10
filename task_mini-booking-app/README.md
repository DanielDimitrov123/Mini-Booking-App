# Mini Booking App

A single-therapist appointment booking app built with Next.js, TypeScript, PostgreSQL, and Playwright.

Customers can browse treatments, check available times, make bookings, create an account, view their upcoming bookings, and cancel eligible bookings.

## Requirements

- Node.js and npm
- Docker Desktop with Docker Compose
- PostgreSQL is run through Docker Compose; a separate local PostgreSQL installation is not required

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

   In Windows PowerShell, if `npm` reports that script execution is disabled, use `npm.cmd` instead.

2. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

3. Create `.env.local` in the project root with:

   ```dotenv
   DATABASE_URL=postgres://booking:booking_dev_password@localhost:5432/mini_booking
   AUTH_SECRET=replace-with-a-random-secret
   ```

   Generate a secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Copy the generated value after `AUTH_SECRET=`. Keep `.env.local` private; do not commit it.

4. Create the database tables and seed the treatments:

   ```bash
   npm run db:setup
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

In Windows PowerShell, prefix npm commands with `npm.cmd` if the `npm` command is blocked by the execution policy.

## Useful commands

| Command               | Purpose                             |
| --------------------- | ----------------------------------- |
| `npm run dev`         | Start the development server        |
| `npm run build`       | Build the production app            |
| `npm run lint`        | Run ESLint                          |
| `npm run db:migrate`  | Apply pending database migrations   |
| `npm run db:rollback` | Roll back the latest migration      |
| `npm run db:seed`     | Seed treatment data                 |
| `npm run db:setup`    | Run migrations and seed treatments  |
| `npm run test:e2e`    | Run the Playwright end-to-end tests |
| `npm run test:e2e:ui` | Open the Playwright test UI         |

Install the Playwright Chromium browser once before running E2E tests:

```bash
npx playwright install chromium
```

## Main routes

- `/` — browse treatments
- `/booking` — choose a treatment, date, time, and enter customer details
- `/register` — create an account
- `/login` — sign in
- `/profile` — view and manage your profile and upcoming bookings

The app also provides API routes for treatments, availability, bookings, authentication, and a database health check.

## Booking rules

- Appointments are available Monday to Saturday, from 09:00 to 18:00 London time.
- Start times use a 30-minute grid; the whole treatment must finish by 18:00.
- Past dates and unavailable or conflicting times cannot be booked.
- Customer postcodes must be in the supported London postcode areas.
- A booking can be cancelled at least 24 hours before it starts.
- Prices and durations are saved with each booking so later treatment changes do not alter existing bookings.

## End-to-end tests

The Playwright tests cover the customer journey, availability rules, postcode validation, duplicate bookings, cancellation cutoff, and booking ownership.

The tests use the database configured in `.env.local` and create temporary test accounts and bookings. Run them against a local development database, not a production database.

```bash
npm run test:e2e
```

