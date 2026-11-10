import Link from "next/link";
import { auth } from "../auth";
import { connection } from "next/server";
  
export async function SiteHeader() {
  await connection();
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <header className="border-b border-gray-300">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      >
        <Link href="/" aria-label="Home" className="rounded p-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9v12h14V9M9 21v-7h6v7" />
          </svg>
        </Link>

        {signedIn ? (
          <Link
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className="rounded p-1"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="rounded border border-gray-400 px-3 py-2"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded border border-gray-400 px-3 py-2"
            >
              Log in
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}