import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return Response.json({ app: "ok", database: "ok" });
  } catch (error) {
    console.error("Database health check failed:", error);
    return Response.json(
      { app: "ok", database: "error" },
      { status: 503 }
    );
  }
}