"use client";

import { useEffect, useState } from "react";

type Treatment = {
  id: number;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

export default function BookingPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [treatmentId, setTreatmentId] = useState("");
  const [date, setDate] = useState("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTreatments() {
      try {
        const response = await fetch("/api/treatments");
        if (!response.ok) throw new Error("Could not load treatments.");

        setTreatments(await response.json());
      } catch {
        setError("Could not load treatments.");
      }
    }

    void loadTreatments();
  }, []);

  useEffect(() => {
    if (!treatmentId || !date) {
      setAvailableTimes([]);
      setSelectedTime("");
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setError("");
      setSelectedTime("");

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

        setAvailableTimes([]);
        setError(
          error instanceof Error
            ? error.message
            : "Could not load available times."
        );
      }
    }

    void loadAvailability();
    return () => controller.abort();
  }, [treatmentId, date]);

  const selectedTreatment = treatments.find(
    (treatment) => String(treatment.id) === treatmentId
  );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">Choose your appointment</h1>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="treatment" className="block font-medium">
            Treatment
          </label>
          <select
            id="treatment"
            value={treatmentId}
            onChange={(event) => setTreatmentId(event.target.value)}
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
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-2"
          />
        </div>

        {error && <p role="alert">{error}</p>}

        {treatmentId && date && (
          <section aria-labelledby="times-heading">
            <h2 id="times-heading" className="font-medium">
              Available start times
            </h2>

            {availableTimes.length === 0 ? (
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
                    onClick={() => setSelectedTime(time)}
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
          <p aria-live="polite">
            Selected: {selectedTreatment.name} on {date} at {selectedTime}
          </p>
        )}
      </div>
    </main>
  );
}