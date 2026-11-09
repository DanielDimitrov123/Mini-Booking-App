"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  fullName: string;
  email: string;
};

export function ProfileEditForm({ fullName: initialName, email: initialEmail }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [editing, setEditing] = useState<"name" | "email" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not update your profile.");
      }

      setFullName(result.user.fullName);
      setEmail(result.user.email);
      setEditing(null);
      setSaved("Your profile has been updated.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <div>
        <p className="text-sm text-gray-600">Email</p>
        {editing === "email" ? (
          <input
            aria-label="Email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded border border-gray-300 p-2"
          />
        ) : (
          <p className="mt-1 break-all">{email}</p>
        )}
        {editing === "email" ? (
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save email"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail(initialEmail);
                setEditing(null);
                setError("");
              }}
              className="rounded border border-gray-300 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing("email");
              setSaved("");
            }}
            className="mt-2 rounded border border-gray-300 px-3 py-1"
          >
            Change email
          </button>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-600">Name</p>
        {editing === "name" ? (
          <input
            aria-label="Full name"
            required
            minLength={2}
            maxLength={150}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 w-full rounded border border-gray-300 p-2"
          />
        ) : (
          <p className="mt-1">{fullName}</p>
        )}
        {editing === "name" ? (
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save name"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFullName(initialName);
                setEditing(null);
                setError("");
              }}
              className="rounded border border-gray-300 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing("name");
              setSaved("");
            }}
            className="mt-2 rounded border border-gray-300 px-3 py-1"
          >
            Change name
          </button>
        )}
      </div>

      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">{saved}</p>}
    </form>
  );
}