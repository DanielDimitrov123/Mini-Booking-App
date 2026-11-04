import { hash } from "bcryptjs";
import { pool } from "../../../lib/db";

export async function POST(request: Request) {
  const rawBody: unknown = await request.json().catch(() => null);

  if (
    typeof rawBody !== "object" ||
    rawBody === null ||
    Array.isArray(rawBody)
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (
    fullName.length < 2 ||
    fullName.length > 150 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    password.length > 128
  ) {
    return Response.json(
      { error: "Enter a name, valid email, and password of 8–128 characters." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await hash(password, 12);

    const result = await pool.query<{
      id: number;
      full_name: string;
      email: string;
    }>(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email`,
      [fullName, email, passwordHash]
    );

    return Response.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Failed to register account:", error);
    return Response.json(
      { error: "Could not create the account." },
      { status: 500 }
    );
  }
}