import { Suspense } from "react";
import { pool } from "../lib/db";

type Treatment = {
  id: number;
  name: string;
  durationMinutes: number;
  pricePence: number;
};

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
      <h1 className="text-3xl font-semibold">Book a treatment</h1>
      <p className="mt-2 text-gray-600">
        Choose from our available treatments.
      </p>

      <Suspense fallback={<p className="mt-6">Loading treatments…</p>}>
        <TreatmentList />
      </Suspense>

      <a
        href="/booking"
        className="mx-auto mt-8 block w-fit rounded-full bg-black px-6 py-3 font-medium text-white"
      >
        Start booking
      </a>
    </main>
  );
}

async function TreatmentList() {
  const result = await pool.query<Treatment>(`
    SELECT
      id,
      name,
      duration_minutes AS "durationMinutes",
      price_pence AS "pricePence"
    FROM treatments
    WHERE active = TRUE
    ORDER BY name
  `);

  return (
    <ul className="mt-8 grid gap-5 sm:grid-cols-2">
      {result.rows.map((treatment) => (
        <li
          key={treatment.id}
          className="flex min-h-44 flex-col justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-2xl font-semibold">{treatment.name}</h2>
          <p className="mt-1 text-gray-600">
            {treatment.durationMinutes} minutes
          </p>
          <p className="mt-2 font-semibold">
            {currency.format(treatment.pricePence / 100)}
          </p>
        </li>
      ))}
    </ul>
  );
}