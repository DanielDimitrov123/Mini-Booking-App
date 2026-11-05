"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function cancelBooking() {
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not cancel the booking.");
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not cancel the booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={cancelBooking}
        disabled={submitting}
        className="rounded border border-red-700 px-3 py-2 text-red-700 disabled:opacity-50"
      >
        {submitting ? "Cancelling…" : "Cancel booking"}
      </button>
      {error && <p role="alert" className="mt-2">{error}</p>}
    </div>
  );
}