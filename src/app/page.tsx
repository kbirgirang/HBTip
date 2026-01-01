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
  const [cOwnerUsername, setCOwnerUsername] = useState("");
  const [cOwnerPassword, setCOwnerPassword] = useState("");
  const [cDisplayName, setCDisplayName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ roomCode: string; ownerPassword: string } | null>(null);

  // Join section - tabs
  const [joinTab, setJoinTab] = useState<"login" | "register">("login");

  // Register form state
  const [rRoomCode, setRRoomCode] = useState("");
  const [rJoinPassword, setRJoinPassword] = useState("");
  const [rUsername, setRUsername] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rDisplayName, setRDisplayName] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Login form state
  const [lRoomCode, setLRoomCode] = useState("");
  const [lJoinPassword, setLJoinPassword] = useState("");
  const [lUsername, setLUsername] = useState("");
  const [lPassword, setLPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreated(null);

    if (cRoomName.trim().length < 2) return setCreateError("Room name þarf að vera amk 2 stafir.");
    if (cOwnerUsername.trim().length < 3) return setCreateError("Username þarf að vera amk 3 stafir.");
    if (cOwnerPassword.trim().length < 6) return setCreateError("Password þarf að vera amk 6 stafir.");
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
          ownerUsername: cOwnerUsername,
          ownerPassword_user: cOwnerPassword,
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError(null);

    if (rRoomCode.trim().length < 2) return setRegisterError("Room code vantar.");
    if (rJoinPassword.trim().length < 1) return setRegisterError("Join password vantar.");
    if (rUsername.trim().length < 3) return setRegisterError("Username þarf að vera amk 3 stafir.");
    if (rPassword.trim().length < 6) return setRegisterError("Password þarf að vera amk 6 stafir.");
    if (rDisplayName.trim().length < 2) return setRegisterError("Nafn þarf að vera amk 2 stafir.");

    setRegisterLoading(true);
    try {
      const res = await fetch("/api/room/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: rRoomCode,
          joinPassword: rJoinPassword,
          username: rUsername,
          password: rPassword,
          displayName: rDisplayName,
        }),
      });

      const data = (await res.json()) as JoinResp;

      if (!res.ok || "error" in data) {
        setRegisterError("error" in data ? data.error : "Ekki tókst að skrá sig.");
        return;
      }

      window.location.href = `/r/${encodeURIComponent(data.roomCode)}`;
    } catch {
      setRegisterError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    if (lRoomCode.trim().length < 2) return setLoginError("Room code vantar.");
    if (lJoinPassword.trim().length < 1) return setLoginError("Join password vantar.");
    if (lUsername.trim().length < 1) return setLoginError("Username vantar.");
    if (lPassword.trim().length < 1) return setLoginError("Password vantar.");

    setLoginLoading(true);
    try {
      const res = await fetch("/api/room/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: lRoomCode,
          joinPassword: lJoinPassword,
          username: lUsername,
          password: lPassword,
        }),
      });

      const data = (await res.json()) as JoinResp;

      if (!res.ok || "error" in data) {
        setLoginError("error" in data ? data.error : "Ekki tókst að skrá sig inn.");
        return;
      }

      window.location.href = `/r/${encodeURIComponent(data.roomCode)}`;
    } catch {
      setLoginError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Evrópukeppnin í handbolta 2026 - Vinnustaðatip</h1>
          <p className="mt-2 text-neutral-300">
            Búðu til deild fyrir vinnustaðinn eða join-aðu með deildar kóða + lykilorði
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
                <label className="text-sm text-neutral-200">Þitt username</label>
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={cOwnerUsername}
                  onChange={(e) => setCOwnerUsername(e.target.value)}
                  placeholder="t.d. kari"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-200">Þitt password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                  value={cOwnerPassword}
                  onChange={(e) => setCOwnerPassword(e.target.value)}
                  placeholder="minnst 6 stafir"
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

          {/* Join - Register/Login */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow">
            <h2 className="text-xl font-semibold">Skrá sig inná deildina</h2>
            <p className="mt-1 text-sm text-neutral-300">Skráðu þig inn eða búðu til nýjan aðgang.</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setJoinTab("login")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                  joinTab === "login"
                    ? "border-neutral-200 bg-neutral-100 text-neutral-900"
                    : "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-900/70",
                ].join(" ")}
              >
                Innskráning
              </button>
              <button
                type="button"
                onClick={() => setJoinTab("register")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                  joinTab === "register"
                    ? "border-neutral-200 bg-neutral-100 text-neutral-900"
                    : "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-900/70",
                ].join(" ")}
              >
                Nýr aðgangur
              </button>
            </div>

            {/* Login Form */}
            {joinTab === "login" && (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm text-neutral-200">Númer deildar</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={lRoomCode}
                    onChange={(e) => setLRoomCode(e.target.value)}
                    placeholder="t.d. MAREL-9647"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Lykilorð deildar</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={lJoinPassword}
                    onChange={(e) => setLJoinPassword(e.target.value)}
                    placeholder="Join password fyrir deildina"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Username</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={lUsername}
                    onChange={(e) => setLUsername(e.target.value)}
                    placeholder="t.d. kari"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={lPassword}
                    onChange={(e) => setLPassword(e.target.value)}
                  />
                </div>

                {loginError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {loginError}
                  </div>
                )}

                <button
                  disabled={loginLoading}
                  className="w-full rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                >
                  {loginLoading ? "Skrái inn..." : "Skrá inn"}
                </button>
              </form>
            )}

            {/* Register Form */}
            {joinTab === "register" && (
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm text-neutral-200">Númer deildar</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={rRoomCode}
                    onChange={(e) => setRRoomCode(e.target.value)}
                    placeholder="t.d. MAREL-9647"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Lykilorð deildar</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={rJoinPassword}
                    onChange={(e) => setRJoinPassword(e.target.value)}
                    placeholder="Join password fyrir deildina"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Username</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={rUsername}
                    onChange={(e) => setRUsername(e.target.value)}
                    placeholder="t.d. kari"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={rPassword}
                    onChange={(e) => setRPassword(e.target.value)}
                    placeholder="minnst 6 stafir"
                  />
                </div>

                <div>
                  <label className="text-sm text-neutral-200">Þitt nafn (í stigatöflu)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-500"
                    value={rDisplayName}
                    onChange={(e) => setRDisplayName(e.target.value)}
                    placeholder="t.d. Kári"
                  />
                </div>

                {registerError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {registerError}
                  </div>
                )}

                <button
                  disabled={registerLoading}
                  className="w-full rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                >
                  {registerLoading ? "Skrái..." : "Búa til aðgang"}
                </button>
              </form>
            )}
          </section>
        </div>

        <footer className="mt-10 text-xs text-neutral-500">
          MVP: handvirk úrslit + global bónusspurningar. Rooms eru fyrir vinnustaði.
        </footer>
      </div>
    </main>
  );
}
