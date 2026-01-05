"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/user/check-auth");
        const json = await res.json();
        if (json.authenticated) {
          // Redirect to first room
          try {
            const roomRes = await fetch("/api/user/first-room");
            const roomData = await roomRes.json();
            if (roomData.roomCode) {
              router.push(`/r/${encodeURIComponent(roomData.roomCode)}`);
            } else {
              setAuthenticated(false); // No rooms, show login
            }
          } catch {
            setAuthenticated(false);
          }
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    if (!username.trim()) return setLoginError("Notandanafn vantar.");
    if (!password.trim()) return setLoginError("Lykilorð vantar.");

    setLoginLoading(true);
    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || "error" in data) {
        setLoginError("error" in data ? data.error : "Ekki tókst að skrá sig inn.");
        return;
      }

      // Redirect to first room or my-rooms if no rooms
      try {
        const roomRes = await fetch("/api/user/first-room");
        const roomData = await roomRes.json();
        if (roomData.roomCode) {
          router.push(`/r/${encodeURIComponent(roomData.roomCode)}`);
        } else {
          // No rooms yet, show message or redirect to register
          setLoginError("Þú ert ekki í neinum deildum. Joina deild til að byrja.");
        }
      } catch {
        router.push("/my-rooms");
      }
    } catch {
      setLoginError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setLoginLoading(false);
    }
  }

  if (authenticated === null) {
    return (
      <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="text-center">
            <p className="text-slate-600 dark:text-neutral-400">Athuga innskráningu...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-md px-4 py-20">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Evrópumótið í handbolta 2026 – Vinnustaðatips</h1>
          <p className="mt-2 text-slate-600 dark:text-neutral-300">
            Skráðu þig inn til að taka þátt
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6 shadow">
          <h2 className="text-2xl font-semibold mb-4">Innskráning</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-slate-700 dark:text-neutral-200">
                Notandanafn
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="t.d. Rafgani"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-sm text-slate-700 dark:text-neutral-200">
                Lykilorð
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Lykilorð þitt"
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              {loginLoading ? "Skrái inn..." : "Skrá inn"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600 dark:text-neutral-400">
            Ef þú átt ekki aðgang,{" "}
            <a href="/register" className="text-blue-600 hover:underline dark:text-blue-400">
              skráðu þig hér
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
