import { redirect } from "next/navigation";
import { auth, signOut } from "../../auth";
import { pool } from "../../lib/db";
import { canCancelBooking } from "../../lib/booking-rules";
import { CancelButton } from "./cancel-button";

type UpcomingBooking = {
  status: string;
  reference: string;
  treatmentName: string;
  startsAt: Date;
  pricePence: number;
};

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/London",
});

const currencyFormat = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export default async function MyBookingsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const userResult = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE email = $1`,
    [session.user.email.toLowerCase()]
  );

  const userId = userResult.rows[0]?.id;
  if (!userId) {
    redirect("/login");
  }

  const bookingsResult = await pool.query<UpcomingBooking>(
    `SELECT
       b.reference,
       t.name AS "treatmentName",
       b.starts_at AS "startsAt",
       b.status,
       b.price_pence AS "pricePence"
     FROM bookings b
     JOIN treatments t ON t.id = b.treatment_id
     WHERE b.user_id = $1
       AND b.status = 'booked'
       AND b.starts_at > NOW()
     ORDER BY b.starts_at ASC`,
    [userId]
  );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">My bookings</h1>
          <p className="mt-2">
            Signed in as {session.user.name ?? session.user.email}
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded border border-gray-400 px-3 py-2"
          >
            Sign out
          </button>
        </form>
      </div>

      {bookingsResult.rows.length === 0 ? (
        <p className="mt-8">
          You have no upcoming bookings.{" "}
          <a href="/booking" className="underline">
            Book a treatment
          </a>
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {bookingsResult.rows.map((booking) => (
            <li
              key={booking.reference}
              className="rounded-lg border border-gray-300 p-4"
            >
              <h2 className="text-xl font-medium">{booking.treatmentName}</h2>
              <p className="mt-2">
                {dateTimeFormat.format(new Date(booking.startsAt))}
              </p>
              <p className="mt-1">
                {currencyFormat.format(booking.pricePence / 100)}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Reference: {booking.reference}
              </p>
                {canCancelBooking(booking.startsAt, booking.status) ? (
                    <CancelButton reference={booking.reference} />
                ) : (
                    <p className="mt-4 text-sm text-gray-600">
                        Cancellation closes 24 hours before the appointment.
                    </p>
                )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}