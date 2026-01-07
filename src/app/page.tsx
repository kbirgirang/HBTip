"use client";

import { useState, useEffect, useRef } from "react";

// Tooltip component
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block z-10">
      <button
        type="button"
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 relative z-10"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        onTouchStart={() => setShow(!show)}
      >
        ℹ️
      </button>
      {show && (
        <div 
          className="absolute left-0 top-6 z-[9999] w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          style={{ pointerEvents: 'auto' }}
        >
          {text}
          <div className="absolute -top-1 left-3 h-2 w-2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"></div>
        </div>
      )}
    </div>
  );
}

// Help box tooltip component
function HelpBoxTooltip({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block z-10">
      <span
        className="cursor-help font-semibold underline decoration-dotted relative z-10"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        onTouchStart={() => setShow(!show)}
      >
        Hvað þarf ég?
      </span>
      {show && (
        <div 
          className="absolute left-full ml-3 top-0 z-[9999] w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-slate-700 shadow-2xl dark:border-blue-800 dark:bg-blue-950/30 dark:text-neutral-300"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          style={{ pointerEvents: 'auto' }}
        >
          {children}
          <div className="absolute -left-1 top-3 h-2 w-2 rotate-45 border-l border-b border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"></div>
        </div>
      )}
    </div>
  );
}

type CreateResp =
  | { roomCode: string; roomName: string; ownerPassword: string }
  | { error: string };

type JoinResp = { ok: true; roomCode: string } | { error: string };

type SimpleLoginResp = { ok: true; roomCode: string } | { error: string };

export default function HomePage() {
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [cRoomName, setCRoomName] = useState("");
  const [cJoinPassword, setCJoinPassword] = useState("");
  const [cOwnerUsername, setCOwnerUsername] = useState("");
  const [cOwnerPassword, setCOwnerPassword] = useState("");
  const [cDisplayName, setCDisplayName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ roomCode: string; ownerPassword: string } | null>(null);

  // Join section - tabs
  const [joinTab, setJoinTab] = useState<"login" | "join" | "register">("login");

  // Simple login form state (just username/password)
  const [slUsername, setSlUsername] = useState("");
  const [slPassword, setSlPassword] = useState("");
  const [simpleLoginLoading, setSimpleLoginLoading] = useState(false);
  const [simpleLoginError, setSimpleLoginError] = useState<string | null>(null);

  // Join department form state (username, password, room code, join password)
  const [jRoomCode, setJRoomCode] = useState("");
  const [jJoinPassword, setJJoinPassword] = useState("");
  const [jUsername, setJUsername] = useState("");
  const [jPassword, setJPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  
  // Register form room dropdown state
  const [registerRoomSearchQuery, setRegisterRoomSearchQuery] = useState("");
  const [showRegisterRoomDropdown, setShowRegisterRoomDropdown] = useState(false);
  const registerRoomDropdownRef = useRef<HTMLDivElement>(null);

  // Register form state
  const [rRoomCode, setRRoomCode] = useState("");
  const [rJoinPassword, setRJoinPassword] = useState("");
  const [rUsername, setRUsername] = useState("");
  const [rPassword, setRPassword] = useState("");
  const [rDisplayName, setRDisplayName] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Rooms list for dropdown
  const [roomsList, setRoomsList] = useState<Array<{ room_code: string; room_name: string }>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Tournaments for create form
  const [tournaments, setTournaments] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  // Load rooms list on mount
  useEffect(() => {
    async function loadRooms() {
      setLoadingRooms(true);
      try {
        const res = await fetch("/api/room/list-all");
        const data = await res.json();
        if (res.ok && data.rooms) {
          setRoomsList(data.rooms);
        }
      } catch (err) {
        console.error("Failed to load rooms:", err);
      } finally {
        setLoadingRooms(false);
      }
    }
    loadRooms();
  }, []);

  // Load tournaments when create form opens
  useEffect(() => {
    async function loadTournaments() {
      if (!showCreateForm) return;
      
      setLoadingTournaments(true);
      try {
        const res = await fetch("/api/tournaments/list");
        const data = await res.json();
        if (res.ok && data.tournaments) {
          setTournaments(data.tournaments);
          if (data.tournaments.length > 0 && !selectedTournament) {
            // Set first tournament as default
            setSelectedTournament(data.tournaments[0].slug);
          }
        }
      } catch (err) {
        console.error("Failed to load tournaments:", err);
      } finally {
        setLoadingTournaments(false);
      }
    }
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm]);

  // Close room dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setShowRoomDropdown(false);
      }
      if (registerRoomDropdownRef.current && !registerRoomDropdownRef.current.contains(event.target as Node)) {
        setShowRegisterRoomDropdown(false);
      }
    }
    if (showRoomDropdown || showRegisterRoomDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showRoomDropdown, showRegisterRoomDropdown]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreated(null);

    if (cRoomName.trim().length < 2) return setCreateError("Nafn deildar þarf að vera amk 2 stafir.");
    if (cOwnerUsername.trim().length < 3) return setCreateError("Notandanafn þarf að vera amk 3 stafir.");
    if (cOwnerPassword.trim().length < 6) return setCreateError("Lykilorð þarf að vera amk 6 stafir.");
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
          tournamentSlug: selectedTournament,
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

    if (rRoomCode.trim().length < 2) return setRegisterError("Númer deildar vantar.");
    if (rJoinPassword.trim().length < 1) return setRegisterError("Join password vantar.");
    if (rUsername.trim().length < 3) return setRegisterError("Notandanafn þarf að vera amk 3 stafir.");
    if (rPassword.trim().length < 6) return setRegisterError("Lykilorð þarf að vera amk 6 stafir.");
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

  async function handleSimpleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSimpleLoginError(null);

    if (slUsername.trim().length < 1) return setSimpleLoginError("Notandanafn vantar.");
    if (slPassword.trim().length < 1) return setSimpleLoginError("Lykilorð vantar.");

    setSimpleLoginLoading(true);
    try {
      const res = await fetch("/api/room/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: slUsername,
          password: slPassword,
        }),
      });

      const data = (await res.json()) as SimpleLoginResp;

      if (!res.ok || "error" in data) {
        setSimpleLoginError("error" in data ? data.error : "Ekki tókst að skrá sig inn.");
        return;
      }

      // Fara beint í deildina
      if ("roomCode" in data) {
        window.location.href = `/r/${encodeURIComponent(data.roomCode)}`;
      }
    } catch {
      setSimpleLoginError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setSimpleLoginLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);

    if (jRoomCode.trim().length < 2) return setJoinError("Númer deildar vantar.");
    if (jJoinPassword.trim().length < 1) return setJoinError("Join password vantar.");
    if (jUsername.trim().length < 1) return setJoinError("Notandanafn vantar.");
    if (jPassword.trim().length < 1) return setJoinError("Lykilorð vantar.");

    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: jRoomCode,
          joinPassword: jJoinPassword,
          username: jUsername,
          password: jPassword,
        }),
      });

      const data = (await res.json()) as JoinResp;

      if (!res.ok || "error" in data) {
        setJoinError("error" in data ? data.error : "Ekki tókst að skrá sig í deild.");
        return;
      }

      window.location.href = `/r/${encodeURIComponent(data.roomCode)}`;
    } catch {
      setJoinError("Tenging klikkaði. Prófaðu aftur.");
    } finally {
      setJoinLoading(false);
    }
  }


  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Velkominn á Tippistan 2026</h1>
          {/* <p className="mt-2 text-slate-600 dark:text-neutral-300">
            Skráðu þig í deild eða búðu til nýja
          </p> */}
        </header>

        <div className="mx-auto max-w-lg">
          {/* Create Form - Show when button clicked */}
          {showCreateForm && !created && (
            <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Búðu til nýja deild</h2>
                  {/*<p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                    Þú verður stjórnandi og færð lykilorð stjórnanda (geymdu það).
                  </p>*/}
                </div>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  ✕ Loka
                </button>
              </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Tegund keppni
                  <InfoTooltip text="Veldu hvaða keppni deildin á að vera fyrir. T.d. Evrópumótið í handbolta eða Enska deildin í fótbolta." />
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  disabled={loadingTournaments}
                >
                  {loadingTournaments ? (
                    <option>Sæki keppnir...</option>
                  ) : tournaments.length === 0 ? (
                    <option>Engar keppnir tiltækar</option>
                  ) : (
                    tournaments.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Nafn deildar
                  <InfoTooltip text="Nafn á deildinni sem birtist í kerfinu. Getur verið nafn vinnustaðar, deildar eða hóps. Þetta nafn er notað til að búa til deildar númerið." />
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={cRoomName}
                  onChange={(e) => setCRoomName(e.target.value)}
                  placeholder="t.d. Rafganistan"
                />
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Þitt notandanafn
                  <InfoTooltip text="Global notandanafn sem þú notar í öllum deildum. Þú getur notað sama notandanafn í fleiri deildum. Ef þú ert með aðgang, notaðu sama notandanafn og lykilorð." />
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={cOwnerUsername}
                  onChange={(e) => setCOwnerUsername(e.target.value)}
                  placeholder="t.d. Rafgani"
                />
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Þitt lykilorð
                  <InfoTooltip text="Lykilorð fyrir þitt notandanafn. Þetta lykilorð er notað í öllum deildum sem þú ert í. Minnst 6 stafir." />
                </label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={cOwnerPassword}
                  onChange={(e) => setCOwnerPassword(e.target.value)}
                  placeholder="minnst 6 stafir"
                />
              </div>

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Þitt nafn (í stigatöflu)
                  <InfoTooltip text="Nafn sem birtist í stigatöflu fyrir þessa deild. Þetta getur verið breytt per deild, svo þú getur haft mismunandi nöfn í mismunandi deildum." />
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  value={cDisplayName}
                  onChange={(e) => setCDisplayName(e.target.value)}
                  placeholder="t.d. Rafgani"
                />
              </div>  

              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-200">
                  Lykilorð til að skrá sig inná deildina
                  <InfoTooltip text="Lykilorð sem aðrir nota til að joina þessari deild. Deildu þessu lykilorði með þeim sem eiga að vera í deildinni. Minnst 6 stafir." />
                </label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
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
                className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                {createLoading ? "Bý til..." : "Búa til deild"}
              </button>
            </form>

          </section>
          )}

          {/* Show success message if created */}
          {created && (
            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-100">
                <span className="font-semibold">Númer deildar:</span> {created.roomCode}
              </p>
              <p className="mt-2 text-sm text-emerald-100">
                <span className="font-semibold">Lykilorð stjórnanda (geymdu):</span>{" "}
                <span className="font-mono">{created.ownerPassword}</span>
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-200"
                  onClick={() => {
                    window.location.href = `/r/${encodeURIComponent(created.roomCode)}`;
                  }}
                >
                  Fara í deildina
                </button>
                <button
                  className="rounded-xl border border-emerald-400/40 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `Númer deildar: ${created.roomCode}\nJoin password: (þú valdir)\nLykilorð stjórnanda: ${created.ownerPassword}`
                    );
                    alert("Afritað í clipboard (ath: join password er ekki vistað hér).");
                  }}
                >
                  Afrita info
                </button>
              </div>
              <p className="mt-3 text-xs text-emerald-100/80">
                Ath: Join passwordið er það sem þú slóst inn. Lykilorð stjórnanda birtist bara hér, einu sinni.
              </p>
            </div>
          )}

          {/* Join - Register/Login - Main section */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6 shadow">
            <h2 className="text-2xl font-semibold mb-2">Viltu vera besti tipparinn!!! </h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-neutral-300">
              Skráðu þig inn og/eða búðu til nýjan aðgang til að taka þátt í deildum.  
            </p>

            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setJoinTab("login")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                  joinTab === "login"
                    ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/70",
                ].join(" ")}
              >
                Innskráning
              </button>
              <button
                type="button"
                onClick={() => setJoinTab("join")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                  joinTab === "join"
                    ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/70",
                ].join(" ")}
              >
                Skrá sig í deild
              </button>
              <button
                type="button"
                onClick={() => setJoinTab("register")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border transition",
                  joinTab === "register"
                    ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/70",
                ].join(" ")}
              >
                Nýskráning
              </button>
            </div>

            {/* Simple Login Form - just username and password */}
            {joinTab === "login" && (
              <form onSubmit={handleSimpleLogin} className="space-y-4">
                <div>
                  {/*<label className="text-sm text-slate-700 dark:text-neutral-200">
                    Notandanafn
                    <InfoTooltip text="Notandanafn sem þú notar. Þú verður skráður inn á fyrstu deild sem þú ert í." />
                  </label>*/}
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={slUsername}
                    onChange={(e) => setSlUsername(e.target.value)}
                    placeholder="t.d. Rafgani"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Lykilorð
                    <InfoTooltip text="Lykilorð fyrir þitt notandanafn. Þetta er lykilorðið sem þú valdir þegar þú bjóst til aðganginn." />
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={slPassword}
                    onChange={(e) => setSlPassword(e.target.value)}
                    placeholder="Lykilorð þitt"
                  />
                </div>

                {simpleLoginError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {simpleLoginError}
                  </div>
                )}

                <button
                  disabled={simpleLoginLoading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  {simpleLoginLoading ? "Skrái inn..." : "Skrá inn"}
                </button>
              </form>
            )}

            {/* Join Department Form - username, password, department number, department password */}
            {joinTab === "join" && (
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="relative" ref={roomDropdownRef}>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Númer deildar
                    <InfoTooltip text="Númer deildar sem stjórnandi deildarinnar gefur þér. Dæmi: Rafganistan-1234. Þetta númer er notað til að finna rétta deildina." />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoomDropdown(!showRoomDropdown);
                      if (!showRoomDropdown) {
                        setRoomSearchQuery("");
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 flex items-center justify-between"
                  >
                    <span className={jRoomCode ? "" : "text-slate-500 dark:text-neutral-400"}>
                      {jRoomCode
                        ? roomsList.find((r) => r.room_code === jRoomCode)?.room_name + ` (${jRoomCode})`
                        : "— veldu deild —"}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-4 w-4 transition-transform ${showRoomDropdown ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {showRoomDropdown && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Leita að deild..."
                          value={roomSearchQuery}
                          onChange={(e) => setRoomSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {loadingRooms ? (
                          <div className="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400">Hleð...</div>
                        ) : (() => {
                          const filteredRooms = roomsList.filter(
                            (room) =>
                              room.room_name.toLowerCase().includes(roomSearchQuery.toLowerCase()) ||
                              room.room_code.toLowerCase().includes(roomSearchQuery.toLowerCase())
                          );
                          if (filteredRooms.length === 0) {
                            return (
                              <div className="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400">
                                Engar deildir fundust
                              </div>
                            );
                          }
                          return filteredRooms.map((room) => (
                            <button
                              key={room.room_code}
                              type="button"
                              onClick={() => {
                                setJRoomCode(room.room_code);
                                setShowRoomDropdown(false);
                                setRoomSearchQuery("");
                              }}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                jRoomCode === room.room_code
                                  ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="font-medium">{room.room_name}</div>
                              <div className="text-xs text-slate-500 dark:text-neutral-400">{room.room_code}</div>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Lykilorð deildar
                    <InfoTooltip text="Aðgangsorð sem stjórnandi deildarinnar gaf þér. Þetta er lykilorðið sem stjórnandi valdi þegar deildin var búin til." />
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={jJoinPassword}
                    onChange={(e) => setJJoinPassword(e.target.value)}
                    placeholder="Aðgangsorð deildarinnar"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Notandanafn
                    <InfoTooltip text="Notandanafn sem þú notar. Ef þú ert með aðgang, notaðu sama notandanafn og lykilorð. Ef ekki, búðu til nýjan aðgang með 'Nýskráning' flipanum." />
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={jUsername}
                    onChange={(e) => setJUsername(e.target.value)}
                    placeholder="t.d. Rafgani"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Lykilorð
                    <InfoTooltip text="Lykilorð fyrir þitt notandanafn. Þetta er lykilorðið sem þú valdir þegar þú bjóst til aðganginn." />
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={jPassword}
                    onChange={(e) => setJPassword(e.target.value)}
                    placeholder="Lykilorð þitt"
                  />
                </div>

                {joinError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {joinError}
                  </div>
                )}

                <button
                  disabled={joinLoading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  {joinLoading ? "Skrá sig í deild..." : "Skrá sig í deild"}
                </button>
              </form>
            )}


            {/* Register Form */}
            {joinTab === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Notandanafn
                    <InfoTooltip text="Global notandanafn sem þú notar. Þú getur notað sama notandanafn í fleiri deildum. Ef notandanafn er þegar til, verður þú að nota sama lykilorð." />
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={rUsername}
                    onChange={(e) => setRUsername(e.target.value)}
                    placeholder="t.d. Rafgani"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Lykilorð
                    <InfoTooltip text="Lykilorð fyrir þitt notandanafn. Minnst 6 stafir. Ef notandanafn er þegar til, verður þú að nota sama lykilorð." />
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={rPassword}
                    onChange={(e) => setRPassword(e.target.value)}
                    placeholder="minnst 6 stafir"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Þitt nafn (í stigatöflu)
                    <InfoTooltip text="Nafn sem birtist í stigatöflu fyrir þessa deild. Þetta getur verið breytt per deild, svo þú getur haft mismunandi nöfn í mismunandi deildum." />
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={rDisplayName}
                    onChange={(e) => setRDisplayName(e.target.value)}
                    placeholder="t.d. Rafgani"
                  />
                </div>

                <div className="relative" ref={registerRoomDropdownRef}>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Númer deildar
                    <InfoTooltip text="Númer deildar sem stjórnandi deildarinnar gefur þér. Dæmi: Rafganistan-1234. Þetta númer er notað til að finna rétta deildina." />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterRoomDropdown(!showRegisterRoomDropdown);
                      if (!showRegisterRoomDropdown) {
                        setRegisterRoomSearchQuery("");
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500 flex items-center justify-between"
                  >
                    <span className={rRoomCode ? "" : "text-slate-500 dark:text-neutral-400"}>
                      {rRoomCode
                        ? roomsList.find((r) => r.room_code === rRoomCode)?.room_name + ` (${rRoomCode})`
                        : "— veldu deild —"}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-4 w-4 transition-transform ${showRegisterRoomDropdown ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {showRegisterRoomDropdown && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Leita að deild..."
                          value={registerRoomSearchQuery}
                          onChange={(e) => setRegisterRoomSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {loadingRooms ? (
                          <div className="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400">Hleð...</div>
                        ) : (() => {
                          const filteredRooms = roomsList.filter(
                            (room) =>
                              room.room_name.toLowerCase().includes(registerRoomSearchQuery.toLowerCase()) ||
                              room.room_code.toLowerCase().includes(registerRoomSearchQuery.toLowerCase())
                          );
                          if (filteredRooms.length === 0) {
                            return (
                              <div className="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400">
                                Engar deildir fundust
                              </div>
                            );
                          }
                          return filteredRooms.map((room) => (
                            <button
                              key={room.room_code}
                              type="button"
                              onClick={() => {
                                setRRoomCode(room.room_code);
                                setShowRegisterRoomDropdown(false);
                                setRegisterRoomSearchQuery("");
                              }}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                rRoomCode === room.room_code
                                  ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="font-medium">{room.room_name}</div>
                              <div className="text-xs text-slate-500 dark:text-neutral-400">{room.room_code}</div>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-200">
                    Lykilorð deildar
                    <InfoTooltip text="Aðgangsorð sem stjórnandi deildarinnar gaf þér. Þetta er lykilorðið sem stjórnandi valdi þegar deildin var búin til." />
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={rJoinPassword}
                    onChange={(e) => setRJoinPassword(e.target.value)}
                    placeholder="Aðgangsorð deildarinnar"
                  />
                </div>

                {registerError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {registerError}
                </div>
              )}

              <button
                  disabled={registerLoading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                  {registerLoading ? "Skrái..." : "Búa til aðgang"}
              </button>
            </form>
            )}

            {/* Create Room Button - Inside join section */}
            {!showCreateForm && !created && (
              <div className="mt-6 flex justify-center border-t border-slate-200 pt-6 dark:border-neutral-800">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="rounded-xl border-2 border-blue-500 bg-blue-50 px-6 py-3 font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                  + Búa til nýja deild
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
