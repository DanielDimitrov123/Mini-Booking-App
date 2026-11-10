"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

function getSafeReturnTo() {
  const requested = new URLSearchParams(window.location.search).get("returnTo");

  return requested === "/booking?resume=1" ? requested : "/profile";
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setClientReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not create your account.");
      }

      const returnTo = getSafeReturnTo();

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: returnTo,
      });

      if (signInResult?.error || !signInResult?.url) {
        throw new Error("Account created, but automatic sign-in failed. Please sign in.");
      }

      window.location.assign(returnTo);
      return;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create your account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-3xl font-semibold">Create an account</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <label htmlFor="password" className="block font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-2"
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          disabled={!clientReady || submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}