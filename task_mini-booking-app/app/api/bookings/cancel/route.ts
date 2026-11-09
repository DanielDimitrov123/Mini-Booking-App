import { auth } from "../../../../auth";
import { pool } from "../../../../lib/db";
import { canCancelBooking } from "../../../../lib/booking-rules";

export async function POST(request: Request) {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json(
      { error: "Sign in to cancel a booking." },
      { status: 401 }
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    Array.isArray(rawBody)
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";

  if (!reference || reference.length > 20) {
    return Response.json({ error: "Invalid booking reference." }, { status: 400 });
  }

  try {
    const bookingResult = await pool.query<{
      startsAt: Date;
      status: string;
    }>(
      `SELECT starts_at AS "startsAt", status
       FROM bookings
       WHERE reference = $1
         AND user_id = $2
         AND status = 'booked'`,
      [reference, userId]
    );

    const booking = bookingResult.rows[0];
    if (!booking) {
      return Response.json({ error: "Booking not found." }, { status: 404 });
    }

    if (!canCancelBooking(booking.startsAt, booking.status)) {
      return Response.json(
        { error: "Bookings can only be cancelled at least 24 hours before they start." },
        { status: 409 }
      );
    }

    // Recheck the cutoff in the update itself to handle requests near the boundary.
    const updateResult = await pool.query(
      `UPDATE bookings
       SET status = 'cancelled'
       WHERE reference = $1
         AND user_id = $2
         AND status = 'booked'
         AND starts_at >= NOW() + INTERVAL '24 hours'`,
      [reference, userId]
    );

    if (updateResult.rowCount === 0) {
      return Response.json(
        { error: "This booking can no longer be cancelled." },
        { status: 409 }
      );
    }

    return Response.json({ cancelled: true, reference });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return Response.json(
      { error: "Could not cancel the booking." },
      { status: 500 }
    );
  }
}