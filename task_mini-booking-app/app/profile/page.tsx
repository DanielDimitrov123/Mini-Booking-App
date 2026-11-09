import { redirect } from "next/navigation";
import { auth, signOut } from "../../auth";
import { pool } from "../../lib/db";
import { canCancelBooking } from "../../lib/booking-rules";
import { CancelButton } from "./cancel-button";
import { ProfileEditForm } from "./profile-edit-form";
export const instant = false;

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

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userResult = await pool.query<{
    id: number;
    fullName: string;
    email: string;
  }>(
    `SELECT id, full_name AS "fullName", email
     FROM users
     WHERE id = $1`,
    [Number(session.user.id)]
  );

  const user = userResult.rows[0];
  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

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
  <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-3xl font-semibold">My profile</h1>

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

    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
      <section
        aria-labelledby="information-heading"
        className="md:border-r md:border-gray-300 md:pr-8"
      >
        <h2 id="information-heading" className="text-2xl font-medium">
          My Information
        </h2>

        <ProfileEditForm fullName={user.fullName} email={user.email} />
      </section>

      <section aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-2xl font-medium">
          My bookings
        </h2>

        {bookingsResult.rows.length === 0 ? (
          <p className="mt-6">
            You have no upcoming bookings.{" "}
            <a href="/booking" className="underline">
              Book a treatment
            </a>
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {bookingsResult.rows.map((booking) => (
              <li
                key={booking.reference}
                className="rounded-2xl border border-gray-200 p-5 shadow-sm"
              >
                <h3 className="text-xl font-medium">
                  {booking.treatmentName}
                </h3>
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

        <a
          href="/booking"
          className="mt-6 inline-block rounded-full bg-black px-5 py-3 font-medium text-white"
        >
          Book a treatment
        </a>
      </section>
    </div>
  </main>
);
}