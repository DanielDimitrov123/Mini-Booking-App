"use client";

import { useEffect, useState, type FormEvent } from "react";

type Treatment = {
  id: number;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

type BookingConfirmation = {
  reference: string;
  treatment: string;
  date: string;
  time: string;
  pricePence: number;
};

function londonTodayKey() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function makeDateKey(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export default function BookingPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [treatmentId, setTreatmentId] = useState("");
  const [date, setDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [error, setError] = useState("");
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState<string | null>(null);

  useEffect(() => {
    const today = londonTodayKey();
    setTodayKey(today);

    const [year, month] = today.split("-").map(Number);
    setVisibleMonth(new Date(year, month - 1, 1));
  }, []);

  useEffect(() => {
    const [year, month] = londonTodayKey().split("-").map(Number);
    setVisibleMonth(new Date(year, month - 1, 1));
  }, []);

  useEffect(() => {
    async function loadTreatments() {
      try {
        const response = await fetch("/api/treatments");
        if (!response.ok) throw new Error();

        setTreatments(await response.json());
      } catch {
        setError("Could not load treatments.");
      }
    }

    void loadTreatments();
  }, []);

  useEffect(() => {
    if (!treatmentId || !date) {
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setError("");

      try {
        const params = new URLSearchParams({ treatmentId, date });
        const response = await fetch(`/api/availability?${params}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Could not load available times.");
        }

        setAvailableTimes(result.availableTimes);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setError(
          error instanceof Error
            ? error.message
            : "Could not load available times."
        );
      } finally {
        if (!controller.signal.aborted) setLoadingTimes(false);
      }
    }

    void loadAvailability();
    return () => controller.abort();
  }, [treatmentId, date]);

  const selectedTreatment = treatments.find(
    (treatment) => String(treatment.id) === treatmentId
  );

  const calendarCells: (number | null)[] = visibleMonth
    ? [
        ...Array(
          (new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth(),
            1
          ).getDay() + 6) %
            7
        ).fill(null),
        ...Array.from(
          {
            length: new Date(
              visibleMonth.getFullYear(),
              visibleMonth.getMonth() + 1,
              0
            ).getDate(),
          },
          (_, index) => index + 1
        ),
      ]
    : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentId: Number(treatmentId),
          date,
          time: selectedTime,
          fullName,
          email,
          postcode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not create the booking.");
      }

      setBooking(result.booking as BookingConfirmation);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create the booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
      <h1 className="text-3xl font-semibold">Choose your appointment</h1>
      <p className="mt-2 text-gray-600">
        Choose a treatment and a time that works for you.
      </p>
      {booking ? (
        <section className="mt-6 rounded-lg border border-gray-300 p-5">
          <h2 className="text-2xl font-semibold">Booking confirmed</h2>
          <p className="mt-3">
            Reference: <strong>{booking.reference}</strong>
          </p>
          <p className="mt-2">{booking.treatment}</p>
          <p>
            {booking.date} at {booking.time}
          </p>
          <p>
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
            }).format(booking.pricePence / 100)}
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:col-span-2">
            <label htmlFor="treatment" className="block font-medium">
              Treatment
            </label>
            <select
              id="treatment"
              required
              value={treatmentId}
              onChange={(event) => {
                setTreatmentId(event.target.value);
                setSelectedTime("");
                setAvailableTimes([]);
                setLoadingTimes(false);
                setError("");
                setBooking(null);
              }}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3"
            >
              <option value="">Choose a treatment</option>
              {treatments.map((treatment) => (
                <option key={treatment.id} value={treatment.id}>
                  {treatment.name} — {treatment.durationMinutes} min — £
                  {(treatment.pricePence / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <section
            aria-labelledby="date-heading"
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={
                  !visibleMonth ||
                  !todayKey ||
                  makeDateKey(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    1
                  ).slice(0, 7) <= todayKey.slice(0, 7)
                }
                onClick={() => {
                  setVisibleMonth((month) =>
                    month
                      ? new Date(month.getFullYear(), month.getMonth() - 1, 1)
                      : month
                  );
                }}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              >
                ‹
              </button>

              <h2 id="date-heading" className="font-medium">
                {visibleMonth
                  ? new Intl.DateTimeFormat("en-GB", {
                      month: "long",
                      year: "numeric",
                    }).format(visibleMonth)
                  : "Loading calendar…"}
              </h2>

              <button
                type="button"
                aria-label="Next month"
                disabled={!visibleMonth}
                onClick={() => {
                  setVisibleMonth((month) =>
                    month
                      ? new Date(month.getFullYear(), month.getMonth() + 1, 1)
                      : month
                  );
                }}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              >
                ›
                </button>
              </div>

            <div className="grid grid-cols-7 gap-2 text-center text-sm">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
                <div
                  key={weekday}
                className={weekday === "Sun" ? "py-2 text-red-600" : "py-2"}
                >
                  {weekday}
                </div>
              ))}

              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} aria-hidden="true" />;
                }

                const year = visibleMonth!.getFullYear();
                const monthIndex = visibleMonth!.getMonth();
                const dateKey = makeDateKey(year, monthIndex, day);
                const isSunday = index % 7 === 6;
                const isPast = !todayKey || dateKey < todayKey;
                const isDisabled = isSunday || isPast;
                const isSelected = date === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    aria-label={`${day} ${new Intl.DateTimeFormat("en-GB", {
                      month: "long",
                      year: "numeric",
                    }).format(visibleMonth!)}`}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    onClick={() => {
                      setDate(dateKey);
                      setSelectedTime("");
                      setAvailableTimes([]);
                      setLoadingTimes(false);
                      setError("");
                      setBooking(null);
                    }}
                    className={`aspect-square rounded-lg border text-sm ${
                      isSelected
                        ? "border-black bg-black text-white"
                        : isSunday
                          ? "border-gray-200 text-red-600"
                          : "border-gray-200 hover:border-black"
                    } disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>

          {error && <p role="alert" className="md:col-span-2">{error}</p>}

          {treatmentId && date && (
            <section aria-labelledby="times-heading">
              <h2 id="times-heading" className="font-medium">
                Available start times
              </h2>

              {loadingTimes ? (
                <p className="mt-2">Loading times…</p>
              ) : availableTimes.length === 0 ? (
                <p className="mt-2 text-gray-600">
                  No times are available for this date.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      aria-pressed={selectedTime === time}
                      onClick={() => {
                        setSelectedTime(time);
                        setBooking(null);
                      }}
                      className={`rounded border px-3 py-2 ${
                        selectedTime === time
                          ? "bg-black text-white"
                          : "border-gray-400"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {selectedTreatment && selectedTime && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-5 md:col-span-2">
              <h2 className="text-xl font-medium">Your details</h2>

              <div>
                <label htmlFor="fullName" className="block font-medium">
                  Full name
                </label>
                <input
                  id="fullName"
                  required
                  minLength={2}
                  maxLength={150}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-400 p-2"
                />
              </div>

              <div>
                <label htmlFor="email" className="block font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-400 p-2"
                />
              </div>

              <div>
                <label htmlFor="postcode" className="block font-medium">
                  London postcode
                </label>
                <input
                  id="postcode"
                  required
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-400 p-2"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}