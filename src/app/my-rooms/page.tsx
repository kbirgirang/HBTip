"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Room = {
  roomId: string;
  roomCode: string;
  roomName: string;
  displayName: string;
  isOwner: boolean;
  memberId: string;
};

export default function MyRoomsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join form state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Check auth and load rooms
  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const res = await fetch("/api/user/check-auth");
        const json = await res.json();
        if (!json.authenticated) {
          router.push("/");
          return;
        }
        setAuthenticated(true);
        await loadRooms();
      } catch {
        router.push("/");
      }
    }
    checkAuthAndLoad();
  }, [router]);

  async function loadRooms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/my-rooms");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Ekki tókst að sækja deildir");
        return;
      }
      setRooms(json.rooms || []);
    } catch {
      setError("Tenging klikkaði");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);

    if (!joinRoomCode.trim()) return setJoinError("Númer deildar vantar.");
    if (!joinPassword.trim()) return setJoinError("Lykilorð deildar vantar.");
    if (!joinDisplayName.trim()) return setJoinError("Nafn vantar.");

    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: joinRoomCode.trim(),
          joinPassword: joinPassword.trim(),
          displayName: joinDisplayName.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || "error" in json) {
        setJoinError("error" in json ? json.error : "Ekki tókst að joina deild");
        return;
      }

      // Reload rooms and close form
      setShowJoinForm(false);
      setJoinRoomCode("");
      setJoinPassword("");
      setJoinDisplayName("");
      await loadRooms();
    } catch {
      setJoinError("Tenging klikkaði");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/user/logout", { method: "POST" });
      router.push("/");
    } catch {
      router.push("/");
    }
  }

  async function enterRoom(roomCode: string) {
    // Set room session and redirect
    try {
      const res = await fetch("/api/room/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Ekki tókst að fara inn í deild");
        return;
      }

      router.push(`/r/${encodeURIComponent(roomCode)}`);
    } catch {
      alert("Tenging klikkaði");
    }
  }

  if (authenticated === null || loading) {
    return (
      <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-slate-600 dark:text-neutral-400">Hleð...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mínar deildir</h1>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            Útskrá
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {!showJoinForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowJoinForm(true)}
              className="rounded-xl border-2 border-blue-500 bg-blue-50 px-6 py-3 font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
            >
              + Joina deild
            </button>
          </div>
        )}

        {showJoinForm && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Joina deild</h2>
              <button
                onClick={() => {
                  setShowJoinForm(false);
                  setJoinError(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                ✕ Loka
              </button>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Númer deildar
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value)}
                  placeholder="t.d. Rafganistan-1234"
                />
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Lykilorð deildar
                </label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Aðgangsorð deildarinnar"
                />
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Nafn (í stigatöflu)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  placeholder="t.d. Rafgani"
                />
              </div>

              {joinError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                {joinLoading ? "Joina..." : "Joina deild"}
              </button>
            </form>
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6">
            <p className="text-slate-600 dark:text-neutral-400">
              Þú ert ekki í neinum deildum ennþá. Joina deild til að byrja.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-neutral-100">
                      {room.roomName}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-neutral-400">
                      {room.roomCode} · {room.displayName}
                      {room.isOwner && (
                        <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">
                          Stjórnandi
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => enterRoom(room.roomCode)}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    Fara inn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

