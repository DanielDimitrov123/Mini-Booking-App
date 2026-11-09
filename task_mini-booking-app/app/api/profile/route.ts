import { auth } from "../../../auth";
import { pool } from "../../../lib/db";

export async function GET() {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json(
      { error: "Sign in to view your profile." },
      { status: 401 }
    );
  }

  const result = await pool.query<{
    full_name: string;
    email: string;
  }>(
    `SELECT full_name, email
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    return Response.json({ error: "Account not found." }, { status: 404 });
  }

  return Response.json({
    user: {
      fullName: user.full_name,
      email: user.email,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: "Sign in to update your profile." }, { status: 401 });
  }

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

  if (
    fullName.length < 2 ||
    fullName.length > 150 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return Response.json(
      { error: "Enter a name and a valid email address." },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updateResult = await client.query<{
      id: number;
      full_name: string;
      email: string;
    }>(
      `UPDATE users
       SET full_name = $1, email = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, email`,
      [fullName, email, userId]
    );

    const updatedUser = updateResult.rows[0];

    if (!updatedUser) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    await client.query(
      `UPDATE bookings
       SET customer_name = $1, customer_email = $2
       WHERE user_id = $3`,
      [fullName, email, userId]
    );

    await client.query("COMMIT");

    return Response.json({
      user: {
        id: updatedUser.id,
        fullName: updatedUser.full_name,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

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

    console.error("Failed to update profile:", error);
    return Response.json(
      { error: "Could not update your profile." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}