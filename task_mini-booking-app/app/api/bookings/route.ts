import { randomBytes } from "node:crypto";
import { TZDate } from "@date-fns/tz";
import { pool } from "../../../lib/db";
import {
  getAvailableStartTimes,
  isLondonPostcode,
} from "../../../lib/booking-rules";
import { auth } from "../../../auth";

const LONDON_TIME_ZONE = "Europe/London";

type TreatmentRow = {
  id: number;
  name: string;
  duration_minutes: number;
  price_pence: number;
};

export async function POST(request: Request) {
  const rawBody: unknown = await request.json().catch(() => null);

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    Array.isArray(rawBody)
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const treatmentId = Number(body.treatmentId);
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const postcode =
    typeof body.postcode === "string"
      ? body.postcode.trim().toUpperCase()
      : "";

  if (
    !Number.isInteger(treatmentId) ||
    treatmentId <= 0 ||
    fullName.length < 2 ||
    fullName.length > 150 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !isLondonPostcode(postcode) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return Response.json(
      { error: "Check your name, email, postcode, and selected time." },
      { status: 400 }
    );
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const londonNoon = new TZDate(
    year,
    month - 1,
    day,
    12,
    0,
    LONDON_TIME_ZONE
  );

  if (
    londonNoon.getFullYear() !== year ||
    londonNoon.getMonth() !== month - 1 ||
    londonNoon.getDate() !== day
  ) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  try {
    const treatmentResult = await pool.query<TreatmentRow>(
      `SELECT id, name, duration_minutes, price_pence
       FROM treatments
       WHERE id = $1 AND active = TRUE`,
      [treatmentId]
    );

    const treatment = treatmentResult.rows[0];
    if (!treatment) {
      return Response.json({ error: "Treatment not found." }, { status: 404 });
    }

    const londonDayStart = new TZDate(
      year,
      month - 1,
      day,
      0,
      0,
      LONDON_TIME_ZONE
    );
    const londonNextDay = new TZDate(
      year,
      month - 1,
      day + 1,
      0,
      0,
      LONDON_TIME_ZONE
    );

    const session = await auth();
    const userId = Number(session?.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json(
        { error: "Sign in or create a profile to finish booking." },
        { status: 401 }
      );
    }

    const bookingsResult = await pool.query<{
      startsAt: Date;
      endsAt: Date;
      status: string;
    }>(
      `SELECT
         starts_at AS "startsAt",
         ends_at AS "endsAt",
         status
       FROM bookings
       WHERE status = 'booked'
         AND starts_at < $2
         AND ends_at > $1`,
      [londonDayStart.toISOString(), londonNextDay.toISOString()]
    );

    const availableTimes = getAvailableStartTimes({
      date,
      durationMinutes: treatment.duration_minutes,
      existingBookings: bookingsResult.rows,
    });

    if (!availableTimes.includes(time)) {
      return Response.json(
        { error: "That time is no longer available. Choose another time." },
        { status: 409 }
      );
    }

    const [hours, minutes] = time.split(":").map(Number);
    const startsAt = new TZDate(
      year,
      month - 1,
      day,
      hours,
      minutes,
      LONDON_TIME_ZONE
    );
    const endsAt = new Date(
      startsAt.getTime() + treatment.duration_minutes * 60_000
    );
    const reference = `RB-${randomBytes(5).toString("hex").toUpperCase()}`;

    await pool.query(
        `INSERT INTO bookings (
            reference,
            treatment_id,
            user_id,
            customer_name,
            customer_email,
            postcode,
            starts_at,
            ends_at,
            price_pence,
            duration_minutes,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'booked')`,
        [
            reference,
            treatment.id,
            userId,
            fullName,
            email,
            postcode,
            startsAt.toISOString(),
            endsAt.toISOString(),
            treatment.price_pence,
            treatment.duration_minutes,
        ]
    );

    return Response.json(
      {
        booking: {
          reference,
          treatment: treatment.name,
          date,
          time,
          pricePence: treatment.price_pence,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create booking:", error);
    return Response.json(
      { error: "Could not create the booking." },
      { status: 500 }
    );
  }
}