import { TZDate } from "@date-fns/tz";
import { pool } from "../../../lib/db";
import { getAvailableStartTimes } from "../../../lib/booking-rules";

const LONDON_TIME_ZONE = "Europe/London";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get("date");
  const treatmentId = Number(searchParams.get("treatmentId"));

  if (!date || !Number.isInteger(treatmentId) || treatmentId <= 0) {
    return Response.json(
      { error: "A valid date and treatment are required." },
      { status: 400 }
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

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
    const treatmentResult = await pool.query<{ duration_minutes: number }>(
      `SELECT duration_minutes
       FROM treatments
       WHERE id = $1 AND active = TRUE`,
      [treatmentId]
    );

    const treatment = treatmentResult.rows[0];
    if (!treatment) {
      return Response.json({ error: "Treatment not found." }, { status: 404 });
    }

    // Find the UTC instants that bound this calendar day in London.
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

    return Response.json({ availableTimes });
  } catch (error) {
    console.error("Failed to calculate availability:", error);
    return Response.json(
      { error: "Could not load available times." },
      { status: 500 }
    );
  }
}