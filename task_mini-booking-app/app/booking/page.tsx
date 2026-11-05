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
    <main className="mx-auto max-w-2xl p-8">
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
        <div className="mt-6 space-y-5">
          <div>
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
              className="mt-1 w-full rounded border border-gray-400 p-2"
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

          <div>
            <label htmlFor="date" className="block font-medium">
              Date
            </label>
            <input
              id="date"
              type="date"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedTime("");
                setAvailableTimes([]);
                setLoadingTimes(false);
                setError("");
                setBooking(null);
              }}
              className="mt-1 w-full rounded border border-gray-400 p-2"
            />
          </div>

          {error && <p role="alert">{error}</p>}

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
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-5">
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