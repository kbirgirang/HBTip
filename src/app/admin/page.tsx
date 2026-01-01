// src/app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type BonusType = "number" | "player" | "choice";

type MatchRow = {
  id: string;
  stage: string | null;
  match_no: number | null;
  home_team: string;
  away_team: string;
  starts_at: string;
  allow_draw: boolean;
  result: "1" | "X" | "2" | null;
};

type AdminMatchesResponse = {
  matches: MatchRow[];
};

type BonusRow = {
  id: string;
  match_id: string;
  title: string;
  type: BonusType;
  points: number;
  closes_at: string;
  choice_options?: string[] | null;

  // ✅ correct fields (admin can set)
  correct_number?: number | null;
  correct_choice?: string | null;
  correct_player_id?: string | null;
};

type MatchWithBonus = MatchRow & { bonus: BonusRow | null };
type AdminBonusListResponse = { matches: MatchWithBonus[] };

type Tab = "create" | "results" | "settings";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("create");

  // Shared admin password for all actions
  const [adminPassword, setAdminPassword] = useState("");

  // Global message/error
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function flash(message: string) {
    setMsg(message);
    setTimeout(() => setMsg(null), 2500);
  }
  function clearAlerts() {
    setErr(null);
    setMsg(null);
  }

  // -----------------------------
  // SETTINGS
  // -----------------------------
  const [pointsPer1x2, setPointsPer1x2] = useState<number>(1);
  const [savingSettings, setSavingSettings] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!adminPassword) return setErr("Admin password vantar.");
    if (!Number.isFinite(pointsPer1x2) || pointsPer1x2 < 0) return setErr("Stig þurfa að vera 0 eða hærra.");

    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword,
          pointsPerCorrect1x2: pointsPer1x2,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að vista stillingar.");

      flash("Stillingar vistaðar ✅");
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setSavingSettings(false);
    }
  }

  // -----------------------------
  // CREATE MATCH (single)
  // -----------------------------
  const [stage, setStage] = useState("Group A");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(""); // datetime-local
  const [allowDraw, setAllowDraw] = useState(true);
  const [matchNo, setMatchNo] = useState<number | "">("");
  const [creatingMatch, setCreatingMatch] = useState(false);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!adminPassword) return setErr("Admin password vantar.");
    if (!homeTeam.trim() || !awayTeam.trim()) return setErr("Vantar lið.");
    if (!startsAtLocal) return setErr("Vantar dagsetningu/tíma.");

    const iso = new Date(startsAtLocal).toISOString();

    setCreatingMatch(true);
    try {
      const res = await fetch("/api/admin/match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword,
          stage: stage.trim() || null,
          homeTeam: homeTeam.trim(),
          awayTeam: awayTeam.trim(),
          startsAt: iso,
          allowDraw,
          matchNo: matchNo === "" ? null : matchNo,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að búa til leik.");

      setHomeTeam("");
      setAwayTeam("");
      setStartsAtLocal("");
      setMatchNo("");

      flash("Leikur búinn til ✅");
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setCreatingMatch(false);
    }
  }

  // -----------------------------
  // BULK INSERT
  // -----------------------------
  const [bulkText, setBulkText] = useState(
    [
      "Group A | Iceland | Sweden | 2026-01-16 15:00 | draw | 1",
      "Group A | Denmark | Germany | 2026-01-21 16:00 | draw | 2",
      "Knockout | Iceland | Finland | 2026-01-22 15:23 | nodraw | 3",
    ].join("\n")
  );
  const [bulkLoading, setBulkLoading] = useState(false);

  function parseBulkLines(text: string) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: Array<{
      stage: string | null;
      homeTeam: string;
      awayTeam: string;
      startsAtIso: string;
      allowDraw: boolean;
      matchNo: number | null;
      raw: string;
    }> = [];

    for (const raw of lines) {
      const parts = raw.split("|").map((p) => p.trim());
      if (parts.length < 5) throw new Error(`Lína ólögleg (vantar dálka): "${raw}"`);

      const [st, home, away, dt, drawFlag, maybeNo] = parts;

      if (!home || !away) throw new Error(`Lína ólögleg (vantar lið): "${raw}"`);

      const normalized = dt.includes("T") ? dt : dt.replace(" ", "T");
      const d = new Date(normalized);
      if (Number.isNaN(d.getTime())) throw new Error(`Lína ólögleg (tími): "${raw}"`);

      const flag = drawFlag.toLowerCase();
      const allow = flag === "draw" ? true : flag === "nodraw" ? false : null;
      if (allow === null) throw new Error(`Lína ólögleg (draw/nodraw): "${raw}"`);

      const no = maybeNo ? Number(maybeNo) : null;
      const matchNo = maybeNo ? (Number.isFinite(no) ? no : null) : null;

      rows.push({
        stage: st ? st : null,
        homeTeam: home,
        awayTeam: away,
        startsAtIso: d.toISOString(),
        allowDraw: allow,
        matchNo,
        raw,
      });
    }

    return rows;
  }

  async function bulkCreate() {
    clearAlerts();
    if (!adminPassword) return setErr("Admin password vantar.");

    let rows: ReturnType<typeof parseBulkLines>;
    try {
      rows = parseBulkLines(bulkText);
    } catch (e: any) {
      setErr(e?.message || "Villa í bulk texta.");
      return;
    }

    if (rows.length === 0) return setErr("Engar línur til að setja inn.");

    setBulkLoading(true);
    try {
      let ok = 0;
      const failed: string[] = [];

      for (const r of rows) {
        const res = await fetch("/api/admin/match/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminPassword,
            stage: r.stage,
            homeTeam: r.homeTeam,
            awayTeam: r.awayTeam,
            startsAt: r.startsAtIso,
            allowDraw: r.allowDraw,
            matchNo: r.matchNo,
          }),
        });

        if (res.ok) ok += 1;
        else {
          const j = await res.json().catch(() => ({}));
          failed.push(`${r.raw}  →  ${j?.error || "unknown error"}`);
        }
      }

      if (failed.length) setErr(`Setti inn ${ok}/${rows.length}. Villur:\n- ` + failed.join("\n- "));
      else flash(`Setti inn ${ok} leiki ✅`);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setBulkLoading(false);
    }
  }

  // -----------------------------
  // RESULTS + DELETE
  // -----------------------------
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  async function loadMatches(silent?: boolean) {
    if (!silent) clearAlerts();
    setLoadingMatches(true);
    try {
      const res = await fetch("/api/admin/matches", { cache: "no-store" });
      const json = (await res.json()) as Partial<AdminMatchesResponse> & { error?: string };

      if (!res.ok) return setErr(json?.error || "Ekki tókst að sækja leiki.");

      const list = json.matches || [];
      setMatches(list);
      setBonusMatchId((prev) => prev || (list[0]?.id ?? ""));

      if (!silent) flash("Leikir uppfærðir ✅");
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoadingMatches(false);
    }
  }

  async function setResult(matchId: string, result: "1" | "X" | "2" | null) {
    clearAlerts();
    if (!adminPassword) return setErr("Admin password vantar.");

    try {
      const res = await fetch("/api/admin/match/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword, matchId, result }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að vista úrslit.");

      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, result } : m)));
      flash("Úrslit vistuð ✅");
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  async function deleteMatch(matchId: string) {
    clearAlerts();
    if (!adminPassword) return setErr("Admin password vantar.");

    const m = matches.find((x) => x.id === matchId);
    const ok = confirm(
      `Eyða leik?\n\n${m ? `${m.home_team} vs ${m.away_team}\n${new Date(m.starts_at).toLocaleString()}` : matchId}`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/match/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword, matchId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að eyða leik.");

      setMatches((prev) => prev.filter((x) => x.id !== matchId));
      setMatchesWithBonus((prev) => prev.filter((x) => x.id !== matchId));
      flash("Leik eytt ✅");
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  // -----------------------------
  // BONUS LIST
  // -----------------------------
  const [matchesWithBonus, setMatchesWithBonus] = useState<MatchWithBonus[]>([]);
  const [loadingBonusList, setLoadingBonusList] = useState(false);

  async function loadBonusList(silent?: boolean) {
    if (!silent) clearAlerts();
    setLoadingBonusList(true);
    try {
      const res = await fetch("/api/admin/bonus/list", { cache: "no-store" });
      const json = (await res.json()) as Partial<AdminBonusListResponse> & { error?: string };

      if (!res.ok) return setErr(json?.error || "Ekki tókst að sækja bónus lista.");

      setMatchesWithBonus(json.matches || []);
      if (!silent) flash("Bónus listi uppfærður ✅");
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoadingBonusList(false);
    }
  }

  // ✅ FIX: editing mode so dropdown doesn't overwrite title, and Edit always fills everything
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);

  function prefillBonusFromRow(row: MatchWithBonus) {
    const q = row?.bonus;
    if (!q) return;

    clearAlerts();

    setEditingBonusId(q.id);
    setBonusMatchId(row.id);

    setBonusTitle(q.title || `Bónus: ${row.home_team} vs ${row.away_team}`);
    setBonusType(q.type);
    setBonusPoints(q.points ?? 5);

    // choice options
    if (q.type === "choice") setBonusOptionsText((q.choice_options || []).join("\n"));
    else setBonusOptionsText("");

    // correct fields
    setCorrectNumber(q.correct_number != null ? String(q.correct_number) : "");
    setCorrectChoice(q.correct_choice || "");
    setCorrectPlayerId(q.correct_player_id || "");

    flash("Bónus sett í form (Edit) ✏️");
  }

  // Check if ADMIN_PASSWORD is configured on mount
  useEffect(() => {
    async function checkEnv() {
      try {
        const res = await fetch("/api/admin/check-env");
        const json = (await res.json()) as { adminPasswordConfigured: boolean };
        if (!json.adminPasswordConfigured) setErr("ADMIN_PASSWORD not set");
      } catch {}
    }
    void checkEnv();
  }, []);

  useEffect(() => {
    if (tab === "results") {
      void loadMatches(true);
      void loadBonusList(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // -----------------------------
  // BONUS FORM
  // -----------------------------
  const [bonusMatchId, setBonusMatchId] = useState<string>("");
  const [bonusTitle, setBonusTitle] = useState<string>("");
  const [bonusType, setBonusType] = useState<BonusType>("number");
  const [bonusPoints, setBonusPoints] = useState<number>(5);
  const [bonusOptionsText, setBonusOptionsText] = useState<string>("");

  // ✅ correct answer inputs
  const [correctNumber, setCorrectNumber] = useState<string>("");
  const [correctChoice, setCorrectChoice] = useState<string>("");
  const [correctPlayerId, setCorrectPlayerId] = useState<string>("");

  const [savingBonus, setSavingBonus] = useState(false);

  // þegar type skiptir: hreinsa óviðkomandi correct fields
  useEffect(() => {
    if (bonusType !== "choice") {
      setBonusOptionsText("");
      setCorrectChoice("");
    }
    if (bonusType !== "number") setCorrectNumber("");
    if (bonusType !== "player") setCorrectPlayerId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonusType]);

  // derived choice options list
  const parsedChoiceOptions = useMemo(() => {
    return bonusOptionsText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [bonusOptionsText]);

  // keep correctChoice valid (if options changed)
  useEffect(() => {
    if (bonusType !== "choice") return;
    if (!correctChoice) return;
    if (!parsedChoiceOptions.includes(correctChoice)) setCorrectChoice("");
  }, [bonusType, parsedChoiceOptions, correctChoice]);

  const selectedBonusMatch = useMemo(() => matches.find((m) => m.id === bonusMatchId) ?? null, [matches, bonusMatchId]);

  function onSelectBonusMatch(id: string) {
    setBonusMatchId(id);

    // ✅ only auto template title if NOT editing
    if (!editingBonusId) {
      const m = matches.find((x) => x.id === id);
      if (m) setBonusTitle(`Bónus: ${m.home_team} vs ${m.away_team}`);
    }
  }

  function resetBonusForm() {
    setEditingBonusId(null);
    setBonusTitle("");
    setBonusType("number");
    setBonusPoints(5);
    setBonusOptionsText("");

    setCorrectNumber("");
    setCorrectChoice("");
    setCorrectPlayerId("");
  }

  async function saveBonus(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!adminPassword) return setErr("Admin password vantar.");
    if (!bonusMatchId) return setErr("Veldu leik.");
    if (!bonusTitle.trim()) return setErr("Bónus spurning vantar.");
    if (!Number.isFinite(bonusPoints) || bonusPoints <= 0) return setErr("Points þarf að vera > 0.");

    let options: string[] = [];
    if (bonusType === "choice") {
      options = parsedChoiceOptions;

      if (options.length < 2 || options.length > 6) {
        return setErr("Valmöguleikar þurfa að vera 2–6 línur (1 per línu).");
      }
      const norm = options.map((x) => x.toLowerCase());
      if (new Set(norm).size !== options.length) return setErr("Valmöguleikar mega ekki vera tvíteknir.");

      if (correctChoice && !options.includes(correctChoice)) return setErr("Rétt val er ekki í valmöguleikum.");
    }

    if (bonusType === "number" && correctNumber.trim()) {
      const n = Number(correctNumber);
      if (!Number.isFinite(n)) return setErr("Rétt tala er ógild.");
    }

    setSavingBonus(true);
    try {
      const payload: any = {
        adminPassword,
        matchId: bonusMatchId,
        title: bonusTitle.trim(),
        type: bonusType,
        points: bonusPoints,
        options: bonusType === "choice" ? options : [],

        // correct fields (optional)
        correctNumber: bonusType === "number" && correctNumber.trim() ? Number(correctNumber) : null,
        correctChoice: bonusType === "choice" && correctChoice ? correctChoice : null,
        correctPlayerId: bonusType === "player" && correctPlayerId ? correctPlayerId : null,
      };

      const res = await fetch("/api/admin/bonus/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að vista bónus.");

      flash(editingBonusId ? "Bónus uppfærð ✅" : "Bónus vistuð ✅");
      setEditingBonusId(null);

      await loadMatches(true);
      await loadBonusList(true);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setSavingBonus(false);
    }
  }

  const headerRight = useMemo(() => {
    return (
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Admin password</span>
          <input
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            className="w-56 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>
      </div>
    );
  }, [adminPassword]);

  const bonusCount = useMemo(() => {
    return (matchesWithBonus || []).reduce((acc, m) => acc + (m.bonus ? 1 : 0), 0);
  }, [matchesWithBonus]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-neutral-400">Settu inn leiki, úrslit og stillingar.</p>
          </div>
          {headerRight}
        </div>

        <div className="mt-6 flex gap-2">
          <TabButton active={tab === "create"} onClick={() => setTab("create")}>
            Setja inn leiki
          </TabButton>
          <TabButton active={tab === "results"} onClick={() => setTab("results")}>
            Úrslit + bónus
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            Stillingar
          </TabButton>
        </div>

        {(err || msg) && (
          <div className="mt-6 space-y-2">
            {err && (
              <div className="whitespace-pre-wrap rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {msg}
              </div>
            )}
          </div>
        )}

        {/* CREATE */}
        {tab === "create" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Búa til leik (stakur)" subtitle="Fljótleg leið fyrir einn leik í einu.">
              <form onSubmit={createMatch} className="space-y-4">
                <div>
                  <label className="text-sm text-neutral-300">Stage</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-neutral-300">Home</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      value={homeTeam}
                      onChange={(e) => setHomeTeam(e.target.value)}
                      placeholder="Iceland"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-neutral-300">Away</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      value={awayTeam}
                      onChange={(e) => setAwayTeam(e.target.value)}
                      placeholder="Sweden"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-neutral-300">Starts at</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      value={startsAtLocal}
                      onChange={(e) => setStartsAtLocal(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-neutral-500">Vistað sem ISO/UTC.</p>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-300">Match no (valfrjálst)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      value={matchNo}
                      onChange={(e) => setMatchNo(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
                  Allow draw (X) — riðlar ✅ / útsláttur ❌
                </label>

                <button
                  disabled={creatingMatch}
                  className="w-full rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                >
                  {creatingMatch ? "Bý til..." : "Búa til leik"}
                </button>
              </form>
            </Card>

            <Card title="Setja inn marga leiki (bulk)" subtitle="Límdu inn línur — einn leikur per lína.">
              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <div className="text-xs text-neutral-400">Format:</div>
                  <div className="mt-1 font-mono text-xs text-neutral-200">
                    Stage | Home | Away | YYYY-MM-DD HH:mm | draw/nodraw | matchNo?
                  </div>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={10}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500"
                />

                <div className="flex items-center gap-2">
                  <button
                    disabled={bulkLoading}
                    onClick={bulkCreate}
                    className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                  >
                    {bulkLoading ? "Set inn..." : "Setja inn alla"}
                  </button>

                  <button
                    disabled={bulkLoading}
                    onClick={() => setBulkText("")}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 disabled:opacity-60"
                  >
                    Hreinsa
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* RESULTS + BONUS */}
        {tab === "results" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card
                title={editingBonusId ? "Edit bónus" : "Setja bónus (eitt field)"}
                subtitle="Veldu leik, skrifaðu bónus og vistaðu. Lokar sjálfkrafa á match start."
                right={
                  <button
                    onClick={() => {
                      void loadMatches();
                      void loadBonusList(true);
                    }}
                    disabled={loadingMatches || loadingBonusList}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 disabled:opacity-60"
                  >
                    {loadingMatches || loadingBonusList ? "Hleð..." : "Refresh"}
                  </button>
                }
              >
                {matches.length === 0 ? (
                  <p className="text-sm text-neutral-300">Engir leikir ennþá. Settu inn leiki fyrst.</p>
                ) : (
                  <form onSubmit={saveBonus} className="space-y-4">
                    <div>
                      <label className="text-sm text-neutral-300">Leikur</label>
                      <select
                        value={bonusMatchId}
                        onChange={(e) => onSelectBonusMatch(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      >
                        {matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {(m.match_no != null ? `#${m.match_no} · ` : "") +
                              `${m.home_team} vs ${m.away_team} · ${new Date(m.starts_at).toLocaleString()}`}
                          </option>
                        ))}
                      </select>
                      {selectedBonusMatch && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {selectedBonusMatch.stage ? `${selectedBonusMatch.stage} · ` : ""}
                          {selectedBonusMatch.allow_draw ? "X leyft" : "X óvirkt"} · Lokar:{" "}
                          {new Date(selectedBonusMatch.starts_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm text-neutral-300">Bónus spurning</label>
                      <input
                        value={bonusTitle}
                        onChange={(e) => setBonusTitle(e.target.value)}
                        placeholder="t.d. Hver skorar flest mörk?"
                        className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm text-neutral-300">Tegund</label>
                        <select
                          value={bonusType}
                          onChange={(e) => setBonusType(e.target.value as BonusType)}
                          className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        >
                          <option value="number">Tala</option>
                          <option value="player">Leikmaður</option>
                          <option value="choice">Krossa</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-neutral-300">Stig</label>
                        <input
                          type="number"
                          min={1}
                          value={bonusPoints}
                          onChange={(e) => setBonusPoints(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>
                    </div>

                    {/* correct answer inputs */}
                    {bonusType === "number" && (
                      <div>
                        <label className="text-sm text-neutral-300">Rétt tala (valfrjálst)</label>
                        <input
                          value={correctNumber}
                          onChange={(e) => setCorrectNumber(e.target.value)}
                          inputMode="decimal"
                          placeholder="t.d. 7"
                          className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                        />
                      </div>
                    )}

                    {bonusType === "choice" && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-neutral-300">Valmöguleikar (1 per línu, 2–6)</label>
                          <textarea
                            value={bonusOptionsText}
                            onChange={(e) => setBonusOptionsText(e.target.value)}
                            rows={4}
                            placeholder={"Dæmi:\nIceland\nSweden\nDraw"}
                            className="mt-1 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500"
                          />
                        </div>

                        <div>
                          <label className="text-sm text-neutral-300">Rétt val (valfrjálst)</label>
                          <select
                            value={correctChoice}
                            onChange={(e) => setCorrectChoice(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                          >
                            <option value="">— ekki sett —</option>
                            {parsedChoiceOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {bonusType === "player" && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                        Player bónus: þú þarft players lista til að velja “réttan leikmann”.
                        <div className="mt-2">
                          <label className="text-sm text-neutral-200">Rétt player_id (valfrjálst)</label>
                          <input
                            value={correctPlayerId}
                            onChange={(e) => setCorrectPlayerId(e.target.value)}
                            placeholder="player uuid..."
                            className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        disabled={savingBonus}
                        className="w-full rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                      >
                        {savingBonus ? "Vista..." : editingBonusId ? "Uppfæra bónus" : "Vista bónus"}
                      </button>

                      {editingBonusId && (
                        <button
                          type="button"
                          onClick={() => {
                            resetBonusForm();
                            flash("Hætti í Edit");
                          }}
                          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                        >
                          Hætta í Edit
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500">
                      Þetta er “upsert” — ef bónus er þegar til á þessum leik, þá uppfærist hún.
                    </p>
                  </form>
                )}
              </Card>

              <Card
                title={`Bónus spurningar (í gangi) · ${bonusCount}`}
                subtitle="Sjáðu hvaða leikir eru með bónus. Edit setur í formið."
                right={
                  <button
                    onClick={() => loadBonusList()}
                    disabled={loadingBonusList}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 disabled:opacity-60"
                  >
                    {loadingBonusList ? "Hleð..." : "Refresh"}
                  </button>
                }
              >
                {matchesWithBonus.filter((x) => x.bonus).length === 0 ? (
                  <p className="text-sm text-neutral-300">Engar bónus spurningar komnar inn ennþá.</p>
                ) : (
                  <div className="space-y-3">
                    {matchesWithBonus
                      .filter((x) => x.bonus)
                      .map((m) => {
                        const q = m.bonus!;
                        const closed = new Date(q.closes_at).getTime() <= Date.now();

                        return (
                          <div
                            key={q.id}
                            className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold">
                                  {m.home_team} vs {m.away_team}{" "}
                                  {m.match_no != null ? (
                                    <span className="text-xs text-neutral-400">· #{m.match_no}</span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-neutral-400">
                                  {(m.stage ? `${m.stage} · ` : "") + new Date(m.starts_at).toLocaleString()}
                                </div>
                              </div>

                              <div className="text-xs">
                                <span
                                  className={[
                                    "rounded-lg border px-2 py-1",
                                    closed
                                      ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
                                  ].join(" ")}
                                >
                                  {closed ? "Lokað" : "Opið"}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold">Bónus: {q.title}</div>
                                <div className="text-xs text-neutral-300">
                                  +{q.points} stig ·{" "}
                                  {q.type === "number" ? "tala" : q.type === "player" ? "leikmaður" : "krossa"}
                                </div>
                              </div>

                              <div className="mt-1 text-xs text-neutral-400">
                                Lokar: {new Date(q.closes_at).toLocaleString()}
                              </div>

                              {q.type === "choice" && (
                                <div className="mt-2 text-xs text-neutral-400">
                                  Valmöguleikar: {(q.choice_options || []).join(" · ")}
                                </div>
                              )}

                              {q.type === "number" && q.correct_number != null && (
                                <div className="mt-2 text-xs text-neutral-300">
                                  Rétt tala: <span className="font-mono">{q.correct_number}</span>
                                </div>
                              )}
                              {q.type === "choice" && q.correct_choice && (
                                <div className="mt-2 text-xs text-neutral-300">
                                  Rétt val: <span className="font-semibold">{q.correct_choice}</span>
                                </div>
                              )}
                              {q.type === "player" && q.correct_player_id && (
                                <div className="mt-2 text-xs text-neutral-300">
                                  Rétt player_id: <span className="font-mono">{q.correct_player_id}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => prefillBonusFromRow(m)}
                                className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            </div>

            <Card title="Setja úrslit + eyða leikjum" subtitle="Veldu úrslit og hreinsaðu tvítekningar með Delete.">
              {matches.length === 0 ? (
                <p className="text-sm text-neutral-300">Engir leikir ennþá. Settu inn leiki fyrst.</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-semibold">
                          {m.home_team} vs {m.away_team}
                          {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {(m.stage ? `${m.stage} · ` : "") + new Date(m.starts_at).toLocaleString()}
                          {m.match_no != null ? ` · #${m.match_no}` : ""}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-neutral-300">Úrslit:</span>

                        <ResultButton selected={m.result === "1"} onClick={() => setResult(m.id, "1")}>
                          1
                        </ResultButton>

                        {m.allow_draw && (
                          <ResultButton selected={m.result === "X"} onClick={() => setResult(m.id, "X")}>
                            X
                          </ResultButton>
                        )}

                        <ResultButton selected={m.result === "2"} onClick={() => setResult(m.id, "2")}>
                          2
                        </ResultButton>

                        <button
                          onClick={() => setResult(m.id, null)}
                          className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60"
                        >
                          Clear
                        </button>

                        <button
                          onClick={() => deleteMatch(m.id)}
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/15"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Stigagjöf" subtitle="Breyttu stigum fyrir rétt 1X2 (gildir fyrir allt tournament).">
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="text-sm text-neutral-300">Stig per rétt 1X2</label>
                  <input
                    type="number"
                    min={0}
                    value={pointsPer1x2}
                    onChange={(e) => setPointsPer1x2(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                  <p className="mt-1 text-xs text-neutral-500">Dæmi: 1, 2 eða 3.</p>
                </div>

                <button
                  disabled={savingSettings}
                  className="w-full rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
                >
                  {savingSettings ? "Vista..." : "Vista stillingar"}
                </button>
              </form>
            </Card>

            <Card title="Hraðleið" subtitle="Mælt: bulk innsetning → bónus (eitt field) → úrslit.">
              <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
                <li>Settu inn alla leiki í einu með “bulk”.</li>
                <li>Settu bónus með því að velja leik og skrifa spurningu.</li>
                <li>Ef þú setur tvítekningar: Delete í úrslita listanum.</li>
              </ul>
            </Card>
          </div>
        )}

        <p className="mt-8 text-xs text-neutral-600">
          MVP: admin password er bara hjá þér. Seinna getum við læst admin með session role eða Supabase RLS.
        </p>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold border transition",
        active
          ? "border-neutral-200 bg-neutral-100 text-neutral-900"
          : "border-neutral-800 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-900/70",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
        </div>
        {right}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function ResultButton({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 w-10 rounded-xl border text-sm font-bold transition",
        selected
          ? "border-emerald-300 bg-emerald-300 text-emerald-950"
          : "border-neutral-700 bg-neutral-100 text-neutral-900 hover:bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
