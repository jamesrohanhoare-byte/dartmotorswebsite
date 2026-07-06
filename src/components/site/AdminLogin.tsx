"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="px-page mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <h1 className="text-2xl font-bold">Dart Motors admin</h1>
      <p className="mt-2 text-sm text-muted">Enter the admin password to manage featured cars.</p>
      <form onSubmit={submit} className="mt-6">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-maroon">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
