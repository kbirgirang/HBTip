"use client";

import { useState } from "react";

type CreateResp =
  | { roomCode: string; roomName: string; ownerPassword: string }
  | { error: string };

type JoinResp = { ok: true; roomCode: string } | { error: string };

export default function HomePage() {
  // Create form state
  const [cRoomName, setCRoomName] = useState("");
  const [cJoinPassword, setCJoinPassword] = useState("");
  const [cDisplayName, setCDisplayName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ roomCode: string; ownerPassword: string } | null>(null);

  // Join form state
  const [jRoomCode, setJRoomCode] = useState("");
  const [jJoinPassword, setJJoinPassword] = useState("");
  const [jDisplayName, setJDisplayName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreated(null);

    if (cRoomName.trim().length < 2) return setCreateError("Room name þarf að vera amk 2 stafir.");
    if (cDisplayName.trim().length < 2) return setCreateError("Nafn þarf að vera amk 2 stafir.");
    if (cJoinPassword.trim().length < 6) return setCreateError("Join password þarf að vera amk 6 stafir.");

    setCreateLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: cRoomName,
          joinPassword: cJoinPassword,
          displayName: cDisplayName,
        }),
      });

      const data = (await res.json()) as CreateResp;

      if (!res.ok || "error" in data) {
        setCreateError("error" in data ? data.error : "Ekki tókst að búa til deildina.");
        return;
      }

      setCreated({ roomCode: data.roomCode, ownerPassword: data.ownerPassword });
      // Clear inputs (optional)
      // setCRoomName(""); setCJoinPassword(""); setCDisplayName("");
    } catch (err) {
      setCreateError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);

    if (jRoomCode.trim().length < 2) return setJoinError("Room code vantar.");
    if (jDisplayName.trim().length < 2) return setJoinError("Nafn þarf að vera amk 2 stafir.");
    if (jJoinPassword.trim().length < 1) return setJoinError("Join password vantar.");

    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: jRoomCode,
          joinPassword: jJoinPassword,
          displayName: jDisplayName,
        }),
      });

      const data = (await res.json()) as JoinResp;

      if (!res.ok || "error" in data) {
        setJoinError("error" in data ? data.error : "Ekki tókst að join-a room.");
        return;
      }

      // redirect to room page
      window.location.href = `/r/${encodeURIComponent(data.roomCode)}`;
    } catch {
      setJoinError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">EHF EURO 2026 – Office Pool</h1>
          <p className="mt-2 text-neutral-300">
            Búðu til deild fyrir vinnustaðinn eða join-aðu með room code + join password.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow">
            <h2 className="text-xl font-semibold">Búa til deild</h2>
            <p className="mt-1 text-sm text-neutral-300">
              Þú verður owner og færð owner password (geymdu það).
            </p>

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-neutral-200">Nafn deildar</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={cRoomName}
                  onChange={(e) => setCRoomName(e.target.value)}
                  placeholder="t.d. Marel"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-200">Þitt nafn (í stigatöflu)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={cDisplayName}
                  onChange={(e) => setCDisplayName(e.target.value)}
                  placeholder="t.d. Kári"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-200">Lykilorð til að skrá sig inná deildina</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={cJoinPassword}
                  onChange={(e) => setCJoinPassword(e.target.value)}
                  placeholder="minnst 6 stafir"
                />
              </div>

              {createError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {createError}
                </div>
              )}

              <button
                disabled={createLoading}
                className="w-full rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
              >
                {createLoading ? "Bý til..." : "Búa til deild"}
              </button>
            </form>

            {created && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-100">
                  <span className="font-semibold">Númer deildar:</span> {created.roomCode}
                </p>
                <p className="mt-2 text-sm text-emerald-100">
                  <span className="font-semibold">Owner password (geymdu):</span>{" "}
                  <span className="font-mono">{created.ownerPassword}</span>
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-200"
                    onClick={() => (window.location.href = `/r/${encodeURIComponent(created.roomCode)}`)}
                  >
                    Fara í deildina
                  </button>
                  <button
                    className="rounded-xl border border-emerald-400/40 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/10"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `Room code: ${created.roomCode}\nJoin password: (þú valdir)\nOwner password: ${created.ownerPassword}`
                      );
                      alert("Afritað í clipboard (ath: join password er ekki vistað hér).");
                    }}
                  >
                    Afrita info
                  </button>
                </div>
                <p className="mt-3 text-xs text-emerald-100/80">
                  Ath: Join passwordið er það sem þú slóst inn. Owner password birtist bara hér, einu sinni.
                </p>
              </div>
            )}
          </section>

          {/* Join */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow">
            <h2 className="text-xl font-semibold">Skrá sig inná deildina</h2>
            <p className="mt-1 text-sm text-neutral-300">Sláðu inn deildanúmer og lykilorð.</p>

            <form onSubmit={handleJoin} className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-neutral-200">Númer deildar</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={jRoomCode}
                  onChange={(e) => setJRoomCode(e.target.value)}
                  placeholder="t.d. MAREL-9647"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-200">Þitt nafn (í stigatöflu)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={jDisplayName}
                  onChange={(e) => setJDisplayName(e.target.value)}
                  placeholder="t.d. Elís"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-200">Lykilorð deildar</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={jJoinPassword}
                  onChange={(e) => setJJoinPassword(e.target.value)}
                />
              </div>

              {joinError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {joinError}
                </div>
              )}

              <button
                disabled={joinLoading}
                className="w-full rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
              >
                {joinLoading ? "Join-a..." : "Join-a deildina"}
              </button>

              <p className="text-xs text-neutral-400">
                Ef nafnið þitt er þegar til í roominu, færðu villu (til að forðast tvítekningu).
              </p>
            </form>
          </section>
        </div>

        <footer className="mt-10 text-xs text-neutral-500">
          MVP: handvirk úrslit + global bónusspurningar. Rooms eru fyrir vinnustaði.
        </footer>
      </div>
    </main>
  );
}
