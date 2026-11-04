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

export default async function HomePage() {
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
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">Book a treatment</h1>
      <p className="mt-2 text-gray-600">
        Choose from our available treatments.
      </p>

      <ul className="mt-6 space-y-4">
        {result.rows.map((treatment) => (
          <li
            key={treatment.id}
            className="rounded-lg border border-gray-300 p-4"
          >
            <h2 className="text-xl font-medium">{treatment.name}</h2>
            <p className="mt-1 text-gray-600">
              {treatment.durationMinutes} minutes
            </p>
            <p className="mt-2 font-semibold">
              {currency.format(treatment.pricePence / 100)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}