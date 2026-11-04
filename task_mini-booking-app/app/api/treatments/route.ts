import { pool } from "../../../lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        duration_minutes AS "durationMinutes",
        price_pence AS "pricePence"
      FROM treatments
      WHERE active = TRUE
      ORDER BY name
    `);

    return Response.json(result.rows);
  } catch (error) {
    console.error("Failed to load treatments:", error);

    return Response.json(
      { error: "Could not load treatments" },
      { status: 500 }
    );
  }
}