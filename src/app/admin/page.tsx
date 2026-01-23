// src/app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getTeamFlag } from "@/lib/teamFlags";
import ThemeToggle from "@/components/ThemeToggle";

type BonusType = "number" | "choice" | "player";

type MatchRow = {
  id: string;
  stage: string | null;
  match_no: number | null;
  home_team: string;
  away_team: string;
  starts_at: string;
  allow_draw: boolean;
  result: "1" | "X" | "2" | null;
  underdog_team: "1" | "2" | null;
  underdog_multiplier: number | null;
  home_score: number | null;
  away_score: number | null;
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

type Tab = "create" | "results" | "settings" | "tournaments";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("results");

  // Authentication state
  const [authenticated, setAuthenticated] = useState<boolean | null>(null); // null = checking
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

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

  // Check authentication on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/check-auth");
        const json = await res.json();
        setAuthenticated(json.authenticated === true);
      } catch {
        setAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  // Login handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!loginPassword.trim()) {
      return setErr("Admin lykilorð vantar.");
    }

    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: loginPassword }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return setErr(json?.error || "Rangt admin lykilorð.");
      }

      setAuthenticated(true);
      setLoginPassword("");
      flash("Innskráning tókst ✅");
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoggingIn(false);
    }
  }

  // Logout handler
  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      setAuthenticated(false);
      flash("Útskráning tókst ✅");
    } catch {
      // Ignore errors on logout
    }
  }

  // -----------------------------
  // TOURNAMENTS
  // -----------------------------
  const [tournaments, setTournaments] = useState<Array<{
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
  }>>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [tournamentSlug, setTournamentSlug] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [creatingTournament, setCreatingTournament] = useState(false);

  // Selected tournament for match/bonus operations
  const [selectedTournamentForOperations, setSelectedTournamentForOperations] = useState<string>("");
  
  // Selected tournament for settings
  const [selectedTournamentForSettings, setSelectedTournamentForSettings] = useState<string>("");

  // Statistics
  const [statistics, setStatistics] = useState<{
    totalUsers: number;
    totalRooms: number;
  } | null>(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  async function loadStatistics() {
    setLoadingStatistics(true);
    try {
      const res = await fetch("/api/admin/statistics");
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að sækja tölfræði");
        return;
      }
      setStatistics({
        totalUsers: json.totalUsers || 0,
        totalRooms: json.totalRooms || 0,
      });
    } catch {
      setErr("Tenging klikkaði við tölfræði.");
    } finally {
      setLoadingStatistics(false);
    }
  }

  async function loadTournaments() {
    setLoadingTournaments(true);
    try {
      const res = await fetch("/api/admin/tournaments/list");
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að sækja keppnir");
        return;
      }
      setTournaments(json.tournaments || []);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoadingTournaments(false);
    }
  }

  // Load tournaments and statistics when authenticated
  useEffect(() => {
    if (authenticated) {
      loadTournaments();
      loadStatistics();
    }
  }, [authenticated]);

  // Set default tournament when tournaments load
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournamentForOperations) {
      const activeTournament = tournaments.find(t => t.is_active);
      if (activeTournament) {
        setSelectedTournamentForOperations(activeTournament.slug);
      } else if (tournaments[0]) {
        setSelectedTournamentForOperations(tournaments[0].slug);
      }
    }
    // Set default tournament for settings
    if (tournaments.length > 0 && !selectedTournamentForSettings) {
      const activeTournament = tournaments.find(t => t.is_active);
      if (activeTournament) {
        setSelectedTournamentForSettings(activeTournament.slug);
      } else if (tournaments[0]) {
        setSelectedTournamentForSettings(tournaments[0].slug);
      }
    }
  }, [tournaments, selectedTournamentForOperations, selectedTournamentForSettings]);

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!tournamentSlug.trim()) return setErr("Slug vantar");
    if (!tournamentName.trim()) return setErr("Nafn vantar");

    setCreatingTournament(true);
    try {
      const res = await fetch("/api/admin/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: tournamentSlug.trim().toLowerCase(),
          name: tournamentName.trim(),
          isActive: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að búa til keppni");

      setTournamentSlug("");
      setTournamentName("");
      flash("Keppni búin til ✅");
      loadTournaments();
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setCreatingTournament(false);
    }
  }

  async function toggleTournamentActive(tournamentId: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/admin/tournaments/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          isActive: !currentActive,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að uppfæra keppni");
        return;
      }

      flash(currentActive ? "Keppni gerð óvirk ✅" : "Keppni gerð virk ✅");
      loadTournaments();
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  // Edit tournament state
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editingTournamentName, setEditingTournamentName] = useState<string>("");
  const [updatingTournament, setUpdatingTournament] = useState(false);

  function startEditingTournament(tournament: { id: string; name: string }) {
    setEditingTournamentId(tournament.id);
    setEditingTournamentName(tournament.name);
  }

  function cancelEditingTournament() {
    setEditingTournamentId(null);
    setEditingTournamentName("");
  }

  async function updateTournament(tournamentId: string) {
    if (!editingTournamentName.trim()) {
      setErr("Nafn vantar");
      return;
    }

    setUpdatingTournament(true);
    try {
      const res = await fetch("/api/admin/tournaments/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          name: editingTournamentName.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að uppfæra keppni");
        return;
      }

      flash("Keppni uppfærð ✅");
      cancelEditingTournament();
      loadTournaments();
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setUpdatingTournament(false);
    }
  }

  async function deleteTournament(tournamentId: string, tournamentName: string) {
    const ok = confirm(`Ertu viss um að eyða keppni "${tournamentName}"?\n\nAth: Aðeins hægt ef keppnin er ekki með deildir eða leiki.`);
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/tournaments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að eyða keppni");
        return;
      }

      flash("Keppni eytt ✅");
      loadTournaments();
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  const [deletingMatches, setDeletingMatches] = useState<string | null>(null);

  async function deleteAllMatches(tournamentId: string, tournamentName: string) {
    const ok = confirm(
      `Ertu viss um að eyða ÖLLUM leikjum úr keppni "${tournamentName}"?\n\n` +
      `Þetta eyðir einnig öllum spám (predictions) og bónus spurningum sem tengjast þessum leikjum.\n\n` +
      `Þessi aðgerð er ÓSNUÐNINNLEG!`
    );
    if (!ok) return;

    setDeletingMatches(tournamentId);
    try {
      const res = await fetch("/api/admin/matches/delete-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að eyða leikjum");
        return;
      }

      const deletedCount = json.deletedCount ?? 0;
      flash(`${deletedCount} leikir eytt úr keppni ✅`);
      loadTournaments();
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setDeletingMatches(null);
    }
  }

  // -----------------------------
  // SETTINGS
  // -----------------------------
  const [pointsPer1x2, setPointsPer1x2] = useState<number>(1);
  const [pointsPerX, setPointsPerX] = useState<number | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingPredictions, setSyncingPredictions] = useState(false);
  const [syncingBonusAnswers, setSyncingBonusAnswers] = useState(false);

  // Push notifications state
  const [pushUsers, setPushUsers] = useState<any[]>([]);
  const [loadingPushUsers, setLoadingPushUsers] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [selectedPushMemberId, setSelectedPushMemberId] = useState<string | null>(null);
  const [sendingPush, setSendingPush] = useState(false);
  const [sendPushToAll, setSendPushToAll] = useState(true);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!selectedTournamentForSettings) return setErr("Veldu keppni.");
    if (!Number.isFinite(pointsPer1x2) || pointsPer1x2 < 0) return setErr("Stig þurfa að vera 0 eða hærra.");
    if (pointsPerX != null && (!Number.isFinite(pointsPerX) || pointsPerX < 0)) {
      return setErr("X stig þurfa að vera 0 eða hærra eða tómur.");
    }

    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsPerCorrect1x2: pointsPer1x2,
          pointsPerCorrectX: pointsPerX === null || pointsPerX === 0 ? null : pointsPerX,
          tournamentSlug: selectedTournamentForSettings,
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

  async function syncPredictions() {
    if (!confirm("Ertu viss um að þú viljir samstilla spár fyrir alla meðlimi með sama username? Þetta bætir aðeins við spám sem vantar, ekki yfirskrifa fyrirliggjandi spár.")) {
      return;
    }

    clearAlerts();
    setSyncingPredictions(true);
    try {
      const res = await fetch("/api/admin/sync-predictions", {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að samstilla spár.");

      flash(json.message || `Samstillt ${json.predictionsSynced || 0} spár ✅`);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setSyncingPredictions(false);
    }
  }

  async function syncBonusAnswers() {
    if (!confirm("Ertu viss um að þú viljir samstilla bónus svör fyrir alla meðlimi með sama username? Þetta bætir aðeins við svörum sem vantar, ekki yfirskrifa fyrirliggjandi svör.")) {
      return;
    }

    clearAlerts();
    setSyncingBonusAnswers(true);
    try {
      const res = await fetch("/api/admin/sync-bonus-answers", {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að samstilla bónus svör.");

      flash(json.message || `Samstillt ${json.answersSynced || 0} bónus svör ✅`);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setSyncingBonusAnswers(false);
    }
  }

  // Load push users function
  async function loadPushUsers() {
    setLoadingPushUsers(true);
    try {
      const res = await fetch("/api/admin/push/list");
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setPushUsers(json.users || []);
      } else {
        setErr(json.error || "Ekki tókst að sækja push notendur");
      }
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoadingPushUsers(false);
    }
  }

  // Load push users when settings tab opens
  useEffect(() => {
    if (tab === "settings") {
      void loadPushUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Send push notification
  async function sendPushNotification() {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      setErr("Titill og skilaboð þurfa að vera til staðar");
      return;
    }

    if (!sendPushToAll && !selectedPushMemberId) {
      setErr("Veldu notanda eða veldu 'Send til allra'");
      return;
    }

    clearAlerts();
    setSendingPush(true);
    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pushTitle.trim(),
          message: pushMessage.trim(),
          memberId: sendPushToAll ? null : selectedPushMemberId,
          sendToAll: sendPushToAll,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error || "Ekki tókst að senda push notification");
        return;
      }

      // Búa til detailed message
      let message = `Push notification sent! (${json.sent}/${json.total} successful)`;
      if (json.iosSubscriptions !== undefined) {
        message += `\n\niOS/Safari: ${json.iosSubscriptions} subscriptions (${json.iosFailed || 0} failed)`;
        message += `\nOther browsers: ${json.otherSubscriptions} subscriptions (${json.otherFailed || 0} failed)`;
      }
      if (json.failed > 0 && json.failedDetails) {
        message += `\n\nFailed details:`;
        json.failedDetails.forEach((fail: any) => {
          message += `\n- Member ${fail.memberId}: ${fail.statusCode || "unknown"} - ${fail.message || "error"}`;
        });
      }

      flash(message);
      
      // Ef iOS failed, birtum warning
      if (json.iosFailed > 0) {
        setTimeout(() => {
          setErr(`iOS push notifications klikkaði fyrir ${json.iosFailed} notanda. Athugaðu að iOS þarft að vera í PWA mode (á Home Screen) og iOS 16.4+`);
        }, 3000);
      }

      setPushTitle("");
      setPushMessage("");
      setSelectedPushMemberId(null);
      setSendPushToAll(true);
      await loadPushUsers(); // Reload to update list
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setSendingPush(false);
    }
  }

  // -----------------------------
  // CREATE MATCH (single)
  // -----------------------------
  const [stage, setStage] = useState("Riðill A");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(""); // datetime-local
  const [allowDraw, setAllowDraw] = useState(true);
  const [matchNo, setMatchNo] = useState<number | "">("");
  const [creatingMatch, setCreatingMatch] = useState(false);

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!homeTeam.trim() || !awayTeam.trim()) return setErr("Vantar lið.");
    if (!startsAtLocal) return setErr("Vantar dagsetningu/tíma.");

    const iso = new Date(startsAtLocal).toISOString();

    setCreatingMatch(true);
    try {
      const res = await fetch("/api/admin/match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: stage.trim() || null,
          homeTeam: homeTeam.trim(),
          awayTeam: awayTeam.trim(),
          startsAt: iso,
          allowDraw,
          matchNo: matchNo === "" ? null : matchNo,
          tournamentSlug: selectedTournamentForOperations || undefined,
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
      "Riðill A | Ísland | Svíþjóð | 2026-01-16 15:00 | draw | 1",
      "Riðill A | Danmörk | Þýskaland | 2026-01-21 16:00 | draw | 2",
      "Útsláttur | Ísland | Finnland | 2026-01-22 15:23 | nodraw | 3",
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
            stage: r.stage,
            homeTeam: r.homeTeam,
            awayTeam: r.awayTeam,
            startsAt: r.startsAtIso,
            allowDraw: r.allowDraw,
            matchNo: r.matchNo,
            tournamentSlug: selectedTournamentForOperations || undefined,
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
  const [showCompletedMatches, setShowCompletedMatches] = useState(false);

  async function loadMatches(silent?: boolean) {
    if (!silent) clearAlerts();
    setLoadingMatches(true);
    try {
      const url = selectedTournamentForOperations 
        ? `/api/admin/matches?tournamentSlug=${encodeURIComponent(selectedTournamentForOperations)}`
        : "/api/admin/matches";
      const res = await fetch(url, { cache: "no-store" });
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

  async function setResult(matchId: string, result: "1" | "X" | "2" | null, homeScore?: number | null, awayScore?: number | null) {
    clearAlerts();

    try {
      const res = await fetch("/api/admin/match/set-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, result, homeScore, awayScore }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að vista úrslit.");

      setMatches((prev) => prev.map((m) => 
        (m.id === matchId ? { ...m, result, home_score: homeScore ?? null, away_score: awayScore ?? null } : m)
      ));
      flash("Úrslit vistuð ✅");
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  async function setUnderdog(matchId: string, underdogTeam: "1" | "2" | null, underdogMultiplier: number | null) {
    clearAlerts();

    try {
      const res = await fetch("/api/admin/match/set-underdog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, underdogTeam, underdogMultiplier }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að vista underdog.");

      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, underdog_team: underdogTeam, underdog_multiplier: underdogMultiplier } : m)));
      flash(underdogTeam ? `Underdog settur (${underdogMultiplier}x stig) ✅` : "Underdog hreinsaður ✅");
    } catch {
      setErr("Tenging klikkaði.");
    }
  }

  async function deleteMatch(matchId: string) {
    clearAlerts();

    const m = matches.find((x) => x.id === matchId);
    const ok = confirm(
      `Eyða leik?\n\n${m ? `${m.home_team} vs ${m.away_team}\n${new Date(m.starts_at).toLocaleString()}` : matchId}`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/match/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
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

  async function deleteBonus(bonusId: string) {
    clearAlerts();

    const matchWithBonus = matchesWithBonus.find((x) => x.bonus?.id === bonusId);
    const bonus = matchWithBonus?.bonus;
    const match = matchWithBonus;
    
    const ok = confirm(
      `Eyða bónus spurningu?\n\n${match ? `${match.home_team} vs ${match.away_team}\n` : ""}${bonus ? `Bónus: ${bonus.title}` : bonusId}`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/bonus/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(json?.error || "Ekki tókst að eyða bónus spurningu.");

      // Uppfæra lista - fjarlægja bonus úr match
      setMatchesWithBonus((prev) =>
        prev.map((m) => (m.bonus?.id === bonusId ? { ...m, bonus: null } : m))
      );
      flash("Bónus spurning eytt ✅");
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
      const url = selectedTournamentForOperations 
        ? `/api/admin/bonus/list?tournamentSlug=${encodeURIComponent(selectedTournamentForOperations)}`
        : "/api/admin/bonus/list";
      const res = await fetch(url, { cache: "no-store" });
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
    
    // Player options from JSON
    if (q.type === "player") {
      const playerOpts = (q as any).player_options;
      if (playerOpts && Array.isArray(playerOpts)) {
        setPlayerOptionsJson(JSON.stringify(playerOpts, null, 2));
        setParsedPlayerOptions(playerOpts);
      } else {
        setPlayerOptionsJson("");
        setParsedPlayerOptions([]);
      }
      // Set correct player name (from correct_choice for player type)
      if (q.correct_choice) {
        setCorrectPlayerName(q.correct_choice);
      } else if ((q as any).correct_player_name) {
        setCorrectPlayerName((q as any).correct_player_name);
      } else {
        setCorrectPlayerName("");
      }
    }

    flash("Bónus sett í form (Breyta) ✏️");
  }

  // Check if ADMIN_PASSWORD is configured on mount and load settings
  useEffect(() => {
    async function checkEnv() {
      try {
        const res = await fetch("/api/admin/check-env");
        const json = (await res.json()) as { adminPasswordConfigured: boolean };
        if (!json.adminPasswordConfigured) setErr("ADMIN_PASSWORD not set");
      } catch {}
    }
    void checkEnv();

    async function loadSettings() {
      if (!selectedTournamentForSettings) return;
      try {
        const res = await fetch(`/api/admin/settings/get?tournamentSlug=${encodeURIComponent(selectedTournamentForSettings)}`);
        const json = (await res.json()) as { pointsPerCorrect1x2: number; pointsPerCorrectX: number | null };
        if (res.ok) {
          setPointsPer1x2(json.pointsPerCorrect1x2 ?? 1);
          setPointsPerX(json.pointsPerCorrectX ?? null);
        }
      } catch {}
    }
    void loadSettings();
  }, [selectedTournamentForSettings]);

  useEffect(() => {
    if (tab === "results" && selectedTournamentForOperations) {
      void loadMatches(true);
      void loadBonusList(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedTournamentForOperations]);

  // -----------------------------
  // BONUS FORM
  // -----------------------------
  const [showBonusForm, setShowBonusForm] = useState<boolean>(false);
  const [bonusMatchId, setBonusMatchId] = useState<string>("");
  const [bonusTitle, setBonusTitle] = useState<string>("");
  const [bonusType, setBonusType] = useState<BonusType>("number");
  const [bonusPoints, setBonusPoints] = useState<number>(5);
  const [bonusOptionsText, setBonusOptionsText] = useState<string>("");
  const [playerOptionsJson, setPlayerOptionsJson] = useState<string>("");

  // ✅ correct answer inputs
  const [correctNumber, setCorrectNumber] = useState<string>("");
  const [correctChoice, setCorrectChoice] = useState<string>("");
  const [correctPlayerName, setCorrectPlayerName] = useState<string>("");

  // Players state (from JSON)
  const [parsedPlayerOptions, setParsedPlayerOptions] = useState<Array<{ name: string; team?: string }>>([]);

  const [savingBonus, setSavingBonus] = useState(false);

  // Parse player options JSON
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    if (bonusType === "player" && playerOptionsJson.trim()) {
      try {
        const parsed = JSON.parse(playerOptionsJson);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((p: any) => p && typeof p.name === "string");
          setParsedPlayerOptions(valid);
          setJsonError(null);
          // Warn if some entries were invalid
          if (valid.length !== parsed.length) {
            setJsonError(`${parsed.length - valid.length} ógild(ur) leikmaður(ir) í listanum`);
          }
        } else {
          setParsedPlayerOptions([]);
          setJsonError("JSON verður að vera array");
        }
      } catch (e) {
        setParsedPlayerOptions([]);
        setJsonError(e instanceof Error ? e.message : "Ógildur JSON");
      }
    } else {
      setParsedPlayerOptions([]);
      setJsonError(null);
    }
  }, [bonusType, playerOptionsJson]);

  // þegar type skiptir: hreinsa óviðkomandi correct fields
  useEffect(() => {
    if (bonusType !== "choice") {
      setBonusOptionsText("");
      setCorrectChoice("");
    }
    if (bonusType !== "number") setCorrectNumber("");
    if (bonusType !== "player") {
      setPlayerOptionsJson("");
      setCorrectPlayerName("");
    }
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
    setCorrectPlayerName("");
    setPlayerOptionsJson("");
  }

  async function saveBonus(e: React.FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!bonusMatchId) return setErr("Veldu leik.");
    if (!bonusTitle.trim()) return setErr("Bónus spurning vantar.");
    if (!Number.isFinite(bonusPoints) || bonusPoints <= 0) return setErr("Points þarf að vera > 0.");

    let options: string[] = [];
    if (bonusType === "choice") {
      options = parsedChoiceOptions;

      // Debug: sýna hvað er í raun í textarea
      const rawLines = bonusOptionsText.split("\n");
      const trimmedLines = rawLines.map((x) => x.trim()).filter(Boolean);

      if (options.length < 2 || options.length > 6) {
        return setErr(
          `Valmöguleikar þurfa að vera 2–6 línur (1 per línu).\n\nNúverandi: ${options.length} línur\nRá línur í textarea: ${rawLines.length}\nLínur eftir trim: ${trimmedLines.length}\n\nLínur sem eru taldar: ${options.length > 0 ? options.map((o, i) => `${i + 1}. "${o}"`).join(", ") : "engar"}`
        );
      }
      const norm = options.map((x) => x.toLowerCase());
      if (new Set(norm).size !== options.length) {
        const duplicates = options.filter((opt, idx) => norm.indexOf(opt.toLowerCase()) !== idx);
        return setErr(`Valmöguleikar mega ekki vera tvíteknir. Tvíteknir: ${duplicates.join(", ")}`);
      }

      if (correctChoice && !options.includes(correctChoice)) return setErr("Rétt val er ekki í valmöguleikum.");
    }

    if (bonusType === "number" && correctNumber.trim()) {
      const n = Number(correctNumber);
      if (!Number.isFinite(n)) return setErr("Rétt tala er ógild.");
    }

    if (bonusType === "player") {
      if (!playerOptionsJson.trim()) {
        return setErr("Skrifaðu inn leikmenn í JSON field.");
      }
      try {
        const parsed = JSON.parse(playerOptionsJson);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return setErr("player_options verður að vera array með að minnsta kosti einum leikmanni.");
        }
        for (const p of parsed) {
          if (!p || typeof p.name !== "string" || !p.name.trim()) {
            return setErr("Hver leikmaður verður að hafa 'name' field.");
          }
        }
      } catch (e) {
        return setErr(`Ógildur JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!correctPlayerName.trim()) {
        return setErr("Skrifaðu inn nafn rétts leikmanns.");
      }
      // Verify correct player name is in options
      const parsed = JSON.parse(playerOptionsJson);
      const playerNames = parsed.map((p: any) => p.name.trim().toLowerCase());
      if (!playerNames.includes(correctPlayerName.trim().toLowerCase())) {
        return setErr("Réttur leikmaður verður að vera í player_options listanum.");
      }
    }

    setSavingBonus(true);
    try {
      const payload: any = {
        matchId: bonusMatchId,
        title: bonusTitle.trim(),
        type: bonusType,
        points: bonusPoints,
        options: bonusType === "choice" ? options : [],

        // correct fields (optional)
        correctNumber: bonusType === "number" && correctNumber.trim() ? Number(correctNumber) : null,
        correctChoice: bonusType === "choice" && correctChoice ? correctChoice : null,
        correctPlayerName: bonusType === "player" && correctPlayerName ? correctPlayerName.trim() : null,
        playerOptions: bonusType === "player" && playerOptionsJson.trim() ? JSON.parse(playerOptionsJson) : null,
      };

      const res = await fetch("/api/admin/bonus/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = json?.error || "Ekki tókst að vista bónus.";
        // Check if it's the enum error and provide helpful message
        if (errorMsg.includes("invalid input value for enum bonus_type") || errorMsg.includes("player")) {
          return setErr("Villa: 'player' er ekki í bonus_type enum í gagnagrunninum.\n\nKeyrðu MIGRATION_add_player_bonus_type.sql í Supabase SQL Editor.\n\n" + errorMsg);
        }
        return setErr(errorMsg);
      }

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

  // Inline theme toggle state
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("theme") as "light" | "dark" | null;
      const initial = saved || "dark";
      setTheme(initial);
    } catch (e) {
      // Ignore
    }
  }, []);

  const handleThemeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    try {
      localStorage.setItem("theme", newTheme);
    } catch (e) {
      // Ignore
    }
    
    const html = document.documentElement;
    const body = document.body;
    html.classList.remove("light", "dark");
    html.classList.add(newTheme);
    
    if (newTheme === "light") {
      body.style.backgroundColor = "#ffffff";
      body.style.color = "#171717";
    } else {
      body.style.backgroundColor = "#0a0a0a";
      body.style.color = "#ededed";
    }
    void html.offsetHeight;
  };

  const headerRight = useMemo(() => {
    if (!authenticated) return null;
    return (
      <div className="relative z-50 flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-3">
        <div className="flex items-center gap-2">
          {mounted && (
            <button
              type="button"
              onClick={handleThemeToggle}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 bg-white shadow-lg transition hover:scale-105 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-amber-500"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-slate-600"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            Útskrá
          </button>
        </div>
      </div>
    );
  }, [authenticated, theme, mounted]);


  // Show login form if not authenticated
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

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="rounded-3xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/30 p-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Admin Innskráning</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">
              Skráðu inn admin lykilorð til að komast inn á stjórnborðið.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-slate-700 dark:text-neutral-300">Admin lykilorð</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  autoFocus
                />
              </div>

              {(err || msg) && (
                <div className="space-y-2">
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

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                {loggingIn ? "Innskráning..." : "Innskrá"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">Settu inn leiki, úrslit og stillingar.</p>
          </div>
          {headerRight}
        </div>

        <div className="mt-6 flex gap-2">
          <TabButton active={tab === "results"} onClick={() => setTab("results")}>
            Úrslit + bónus
          </TabButton>
          <TabButton active={tab === "create"} onClick={() => setTab("create")}>
            Setja inn leiki
          </TabButton>
          <TabButton active={tab === "tournaments"} onClick={() => setTab("tournaments")}>
            Keppnir
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

        {/* Statistics */}
        {statistics !== null && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-neutral-400">Heildarfjöldi notenda</h3>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-neutral-100">
                    {loadingStatistics ? "..." : statistics.totalUsers.toLocaleString("is-IS")}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-100 p-3 dark:bg-blue-900/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-neutral-400">Heildarfjöldi deilda</h3>
                  <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-neutral-100">
                    {loadingStatistics ? "..." : statistics.totalRooms.toLocaleString("is-IS")}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-3 dark:bg-emerald-900/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <path d="M20 8v6" />
                    <path d="M23 11h-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CREATE */}
        {tab === "create" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Búa til leik (stakur)" subtitle="Fljótleg leið fyrir einn leik í einu.">
              <form onSubmit={createMatch} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Keppni</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={selectedTournamentForOperations}
                    onChange={(e) => setSelectedTournamentForOperations(e.target.value)}
                    disabled={loadingTournaments || tournaments.length === 0}
                  >
                    {loadingTournaments ? (
                      <option>Sæki keppnir...</option>
                    ) : tournaments.length === 0 ? (
                      <option>Engar keppnir tiltækar</option>
                    ) : (
                      tournaments
                        .filter(t => t.is_active)
                        .map((t) => (
                          <option key={t.id} value={t.slug}>
                            {t.name}
                          </option>
                        ))
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                    Veldu keppni sem leikurinn tilheyrir
                  </p>
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Riðill</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-700 dark:text-neutral-300">Heimalið</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={homeTeam}
                      onChange={(e) => setHomeTeam(e.target.value)}
                      placeholder="Iceland"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-700 dark:text-neutral-300">Útilið</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={awayTeam}
                      onChange={(e) => setAwayTeam(e.target.value)}
                      placeholder="Svíþjóð"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-700 dark:text-neutral-300">Byrjar</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={startsAtLocal}
                      onChange={(e) => setStartsAtLocal(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">Vistað sem ISO/UTC.</p>
                  </div>

                  <div>
                    <label className="text-sm text-slate-700 dark:text-neutral-300">Nr. leiks (valfrjálst)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={matchNo}
                      onChange={(e) => setMatchNo(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
                  <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
                  Leyfa jafntefli (X) — riðlar ✅ / útsláttur ❌
                </label>

                <button
                  disabled={creatingMatch}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  {creatingMatch ? "Bý til..." : "Búa til leik"}
                </button>
              </form>
            </Card>

            <Card title="Setja inn marga leiki (bulk)" subtitle="Límdu inn línur — einn leikur per lína.">
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 p-3">
                  <div className="text-xs text-slate-600 dark:text-neutral-400">Snið:</div>
                  <div className="mt-1 font-mono text-xs text-slate-900 dark:text-neutral-200">
                    Riðill | Heimalið | Útilið | YYYY-MM-DD HH:mm | draw/nodraw | matchNo?
                  </div>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={10}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                />

                <div className="flex items-center gap-2">
                  <button
                    disabled={bulkLoading}
                    onClick={bulkCreate}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    {bulkLoading ? "Set inn..." : "Setja inn alla"}
                  </button>

                  <button
                    disabled={bulkLoading}
                    onClick={() => setBulkText("")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
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
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-4">
              <label className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Veldu keppni</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                value={selectedTournamentForOperations}
                onChange={(e) => {
                  setSelectedTournamentForOperations(e.target.value);
                  // useEffect will handle reloading when selectedTournamentForOperations changes
                }}
                disabled={loadingTournaments || tournaments.length === 0}
              >
                {loadingTournaments ? (
                  <option>Sæki keppnir...</option>
                ) : tournaments.length === 0 ? (
                  <option>Engar keppnir tiltækar</option>
                ) : (
                  tournaments
                    .filter(t => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name}
                      </option>
                    ))
                )}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                Veldu keppni til að vinna með leiki og bónus spurningar
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/30">
                <button
                  onClick={() => setShowBonusForm(!showBonusForm)}
                  className="flex w-full items-center justify-between p-6 text-left"
                >
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">
                      {editingBonusId ? "Breyta bónus" : "Setja bónus (eitt field)"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
                      Veldu leik, skrifaðu bónus og vistaðu. Lokar sjálfkrafa þegar leikur byrjar.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void loadMatches();
                        void loadBonusList(true);
                      }}
                      disabled={loadingMatches || loadingBonusList}
                      className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900/60 disabled:opacity-60"
                    >
                      {loadingMatches || loadingBonusList ? "Hleð..." : "Endurlesa"}
                    </button>
                    <span className={`transform transition-transform ${showBonusForm ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>
                
                {showBonusForm && (
                  <div id="bonus-form-section" className="border-t border-slate-200 dark:border-neutral-800 p-6">
                {matches.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-neutral-300">Engir leikir ennþá. Settu inn leiki fyrst.</p>
                ) : (
                  <form onSubmit={saveBonus} className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-700 dark:text-neutral-300">Leikur</label>
                      <select
                        value={bonusMatchId}
                        onChange={(e) => onSelectBonusMatch(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      >
                        {matches.map((m) => {
                          const homeFlag = getTeamFlag(m.home_team);
                          const awayFlag = getTeamFlag(m.away_team);
                          return (
                            <option key={m.id} value={m.id}>
                              {(m.match_no != null ? `#${m.match_no} · ` : "") +
                                `${homeFlag ? homeFlag + " " : ""}${m.home_team} vs ${awayFlag ? awayFlag + " " : ""}${m.away_team} · ${new Date(m.starts_at).toLocaleString()}`}
                            </option>
                          );
                        })}
                      </select>
                      {selectedBonusMatch && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                          {selectedBonusMatch.stage ? `${selectedBonusMatch.stage} · ` : ""}
                          {selectedBonusMatch.allow_draw ? "X leyft" : "X óvirkt"} · Lokar:{" "}
                          {new Date(selectedBonusMatch.starts_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm text-slate-700 dark:text-neutral-300">Bónus spurning</label>
                      <input
                        value={bonusTitle}
                        onChange={(e) => setBonusTitle(e.target.value)}
                        placeholder="t.d. Hver skorar flest mörk?"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm text-slate-700 dark:text-neutral-300">Tegund</label>
                        <select
                          value={bonusType}
                          onChange={(e) => setBonusType(e.target.value as BonusType)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                        >
                          <option value="number">Tala</option>
                          <option value="choice">Krossa</option>
                          <option value="player">Leikmaður</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-slate-700 dark:text-neutral-300">Stig</label>
                        <input
                          type="number"
                          min={1}
                          value={bonusPoints}
                          onChange={(e) => setBonusPoints(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                        />
                      </div>
                    </div>

                    {/* correct answer inputs */}
                    {bonusType === "number" && (
                      <div>
                        <label className="text-sm text-slate-700 dark:text-neutral-300">Rétt tala (valfrjálst)</label>
                        <input
                          value={correctNumber}
                          onChange={(e) => setCorrectNumber(e.target.value)}
                          inputMode="decimal"
                          placeholder="t.d. 7"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                        />
                      </div>
                    )}

                    {bonusType === "choice" && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-slate-700 dark:text-neutral-300">Valmöguleikar (1 per línu, 2–6)</label>
                          <textarea
                            value={bonusOptionsText}
                            onChange={(e) => setBonusOptionsText(e.target.value)}
                            rows={4}
                            placeholder={"Dæmi:\nIceland\nSweden\nDraw"}
                            className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                          />
                        </div>

                        <div>
                          <label className="text-sm text-slate-700 dark:text-neutral-300">Rétt val (valfrjálst)</label>
                          <select
                            value={correctChoice}
                            onChange={(e) => setCorrectChoice(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
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
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-sm text-slate-700 dark:text-neutral-300">
                              Leikmenn (JSON array) - krafist
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const icelandTeam = [
                                  { "name": "Björgvin Páll Gústavsson", "team": "Iceland" },
                                  { "name": "Viktor Gísli Hallgrímsson", "team": "Iceland" },
                                  { "name": "Andri Már Rúnarsson", "team": "Iceland" },
                                  { "name": "Arnar Freyr Arnarsson", "team": "Iceland" },
                                  { "name": "Bjarki Már Elísson", "team": "Iceland" },
                                  { "name": "Einar Þorsteinn Ólafsson", "team": "Iceland" },
                                  { "name": "Elliði Snær Viðarsson", "team": "Iceland" },
                                  { "name": "Elvar Örn Jónsson", "team": "Iceland" },
                                  { "name": "Gísli Þorgeir Kristjánsson", "team": "Iceland" },
                                  { "name": "Haukur Þrastarsson", "team": "Iceland" },
                                  { "name": "Janus Daði Smárason", "team": "Iceland" },
                                  { "name": "Orri Freyr Þorkelsson", "team": "Iceland" },
                                  { "name": "Óðinn Þór Ríkharðsson", "team": "Iceland" },
                                  { "name": "Ómar Ingi Magnússon", "team": "Iceland" },
                                  { "name": "Teitur Örn Einarsson", "team": "Iceland" },
                                  { "name": "Viggó Kristjánsson", "team": "Iceland" },
                                  { "name": "Ýmir Örn Gíslason", "team": "Iceland" }
                                ]
                                ;
                                setPlayerOptionsJson(JSON.stringify(icelandTeam, null, 2));
                                flash("Íslenska landsliðið sett inn ✅");
                              }}
                              className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/15"
                            >
                              🇮🇸 Setja inn íslenska landsliðið
                            </button>
                          </div>
                          <textarea
                            value={playerOptionsJson}
                            onChange={(e) => setPlayerOptionsJson(e.target.value)}
                            rows={8}
                            placeholder={`[\n  { "name": "Atli", "team": "Iceland" },\n  { "name": "Jón", "team": "Iceland" },\n  { "name": "Pétur" }\n]`}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                          />
                          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                            JSON array með leikmönnum. Hver leikmaður verður að hafa "name" field. "team" er valfrjálst.
                          </p>
                          {parsedPlayerOptions.length > 0 && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-neutral-700 dark:bg-neutral-900/40">
                              <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                                {parsedPlayerOptions.length} leikmaður{parsedPlayerOptions.length !== 1 ? "ir" : ""} greindir:
                              </p>
                              <ul className="mt-1 space-y-1">
                                {parsedPlayerOptions.map((p, i) => (
                                  <li key={i} className="text-xs text-slate-600 dark:text-neutral-400">
                                    • {p.name}
                                    {p.team ? ` (${p.team})` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-sm text-slate-700 dark:text-neutral-300">Rétt leikmaður (krafist)</label>
                          <select
                            value={correctPlayerName}
                            onChange={(e) => setCorrectPlayerName(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                          >
                            <option value="">— veldu leikmann —</option>
                            {parsedPlayerOptions.map((p, i) => (
                              <option key={i} value={p.name}>
                                {p.name}
                                {p.team ? ` (${p.team})` : ""}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                            Veldu leikmann sem er rétt svar úr listanum hér að ofan.
                          </p>
                          {parsedPlayerOptions.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                              Engir leikmenn í JSON. Bættu við leikmönnum í JSON field hér að ofan.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        disabled={savingBonus}
                        className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                      >
                        {savingBonus ? "Vista..." : editingBonusId ? "Uppfæra bónus" : "Vista bónus"}
                      </button>

                      {editingBonusId && (
                        <button
                          type="button"
                          onClick={() => {
                            resetBonusForm();
                            flash("Hætti við breytingu");
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                        >
                          Hætta við breytingu
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-neutral-500">
                      Þetta er “upsert” — ef bónus er þegar til á þessum leik, þá uppfærist hún.
                    </p>
                  </form>
                )}
                  </div>
                )}
              </div>

              <Card title="Setja úrslit + eyða leikjum" subtitle="Veldu úrslit og hreinsaðu tvítekningar með Eyða.">
              {matches.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-neutral-300">Engir leikir ennþá. Settu inn leiki fyrst.</p>
              ) : (() => {
                // Flokka leiki í: Í gangi, Framundan, Búnir
                const now = Date.now();
                const inProgress = matches
                  .filter(m => {
                    const matchTime = new Date(m.starts_at).getTime();
                    return matchTime <= now && m.result === null;
                  })
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                
                const upcoming = matches
                  .filter(m => new Date(m.starts_at).getTime() > now)
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                
                const completed = matches
                  .filter(m => m.result !== null)
                  .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

                // Flokka komandi leiki í Dag, Morgun, Dagsetning
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const upcomingToday = upcoming.filter(m => {
                  const matchDate = new Date(m.starts_at);
                  matchDate.setHours(0, 0, 0, 0);
                  return matchDate.getTime() === today.getTime();
                });

                const upcomingTomorrow = upcoming.filter(m => {
                  const matchDate = new Date(m.starts_at);
                  matchDate.setHours(0, 0, 0, 0);
                  return matchDate.getTime() === tomorrow.getTime();
                });

                const upcomingOther = upcoming.filter(m => {
                  const matchDate = new Date(m.starts_at);
                  matchDate.setHours(0, 0, 0, 0);
                  return matchDate.getTime() !== today.getTime() && matchDate.getTime() !== tomorrow.getTime();
                });

                // Flokka "other" eftir dagsetningu
                const upcomingByDate = new Map<string, MatchRow[]>();
                upcomingOther.forEach(m => {
                  const matchDate = new Date(m.starts_at);
                  matchDate.setHours(0, 0, 0, 0);
                  const dateKey = matchDate.toLocaleDateString('is-IS', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  });
                  if (!upcomingByDate.has(dateKey)) {
                    upcomingByDate.set(dateKey, []);
                  }
                  upcomingByDate.get(dateKey)!.push(m);
                });

                const renderMatch = (m: MatchRow) => {
                  // Finna bónus spurningu fyrir þennan leik
                  const matchWithBonus = matchesWithBonus.find((mb) => mb.id === m.id);
                  const bonus = matchWithBonus?.bonus;
                  const bonusClosed = bonus ? new Date(bonus.closes_at).getTime() <= Date.now() : false;

                  return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/40 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-neutral-100">
                          <span className="inline-flex items-center gap-1">
                            {(() => {
                              const flag = getTeamFlag(m.home_team);
                              return flag && <span className="flag-emoji">{flag}</span>;
                            })()}
                            {m.home_team}
                          </span>{" "}
                          vs{" "}
                          <span className="inline-flex items-center gap-1">
                            {(() => {
                              const flag = getTeamFlag(m.away_team);
                              return flag && <span className="flag-emoji">{flag}</span>;
                            })()}
                            {m.away_team}
                          </span>
                          {!m.allow_draw && <span className="ml-2 text-xs text-amber-600 dark:text-amber-200">X óvirkt</span>}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-neutral-400">
                          {(m.stage ? `${m.stage} · ` : "") + new Date(m.starts_at).toLocaleString()}
                          {m.match_no != null ? ` · #${m.match_no}` : ""}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-neutral-700 dark:bg-neutral-900/30 p-3">
                        <div className="grid gap-4 md:grid-cols-3">
                          {/* Úrslit */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-neutral-400 h-5 flex items-center">Úrslit:</span>
                            <div className="flex flex-wrap items-center gap-1.5">
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
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60 h-7 w-7 flex items-center justify-center"
                                title="Hreinsa úrslit"
                              >
                                ↺
                              </button>

                              <button
                                onClick={() => deleteMatch(m.id)}
                                className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20 dark:text-red-100 dark:hover:bg-red-500/15 h-7 w-7 flex items-center justify-center"
                                title="Eyða leik"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {/* Underdog */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-neutral-400 h-5 flex items-center">🎯 Underdog:</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={() => setUnderdog(m.id, "1", m.underdog_multiplier ?? 3.0)}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition h-7 flex items-center ${
                                  m.underdog_team === "1"
                                    ? "border-blue-500 bg-blue-500 text-white dark:bg-blue-600"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                                }`}
                              >
                                {(() => {
                                  const flag = getTeamFlag(m.home_team);
                                  return flag && <span className="flag-emoji mr-1">{flag}</span>;
                                })()}
                                1
                              </button>

                              <button
                                onClick={() => setUnderdog(m.id, "2", m.underdog_multiplier ?? 3.0)}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition h-7 flex items-center ${
                                  m.underdog_team === "2"
                                    ? "border-blue-500 bg-blue-500 text-white dark:bg-blue-600"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                                }`}
                              >
                                {(() => {
                                  const flag = getTeamFlag(m.away_team);
                                  return flag && <span className="flag-emoji mr-1">{flag}</span>;
                                })()}
                                2
                              </button>

                              {m.underdog_team && (
                                <>
                                  <input
                                    type="number"
                                    min="1.0"
                                    max="10.0"
                                    step="0.1"
                                    value={m.underdog_multiplier ?? 3.0}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val >= 1.0 && val <= 10.0) {
                                        setUnderdog(m.id, m.underdog_team, val);
                                      }
                                    }}
                                    className="w-16 h-7 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                                    placeholder="3.0"
                                  />
                                  <span className="text-xs text-slate-600 dark:text-neutral-400">x</span>
                                </>
                              )}

                              {m.underdog_team && (
                                <button
                                  onClick={() => setUnderdog(m.id, null, null)}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60 h-7 w-7 flex items-center justify-center"
                                  title="Hreinsa underdog"
                                >
                                  ↺
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stöða */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-neutral-400 h-5 flex items-center">📊 Stöða:</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={m.home_score ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  if (val !== null && (isNaN(val) || val < 0)) return;
                                  setMatches((prev) => prev.map((match) => 
                                    match.id === m.id ? { ...match, home_score: val } : match
                                  ));
                                }}
                                onBlur={() => {
                                  const match = matches.find((match) => match.id === m.id);
                                  if (match) {
                                    setResult(match.id, match.result, match.home_score, match.away_score);
                                  }
                                }}
                                className="w-14 h-7 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
                                placeholder="0"
                              />
                              
                              <span className="text-xs text-slate-600 dark:text-neutral-400">-</span>
                              
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={m.away_score ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  if (val !== null && (isNaN(val) || val < 0)) return;
                                  setMatches((prev) => prev.map((match) => 
                                    match.id === m.id ? { ...match, away_score: val } : match
                                  ));
                                }}
                                onBlur={() => {
                                  const match = matches.find((match) => match.id === m.id);
                                  if (match) {
                                    setResult(match.id, match.result, match.home_score, match.away_score);
                                  }
                                }}
                                className="w-14 h-7 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
                                placeholder="0"
                              />
                              
                              <button
                                onClick={() => {
                                  const match = matches.find((match) => match.id === m.id);
                                  if (match) {
                                    setResult(match.id, match.result, null, null);
                                  }
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60 h-7 w-7 flex items-center justify-center"
                                title="Hreinsa stöðu"
                              >
                                ↺
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bónus spurning kafli */}
                    {bonus ? (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/60 p-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-neutral-100">🎁 {bonus.title}</span>
                            <span
                              className={[
                                "rounded border px-1.5 py-0.5 text-xs whitespace-nowrap",
                                bonusClosed
                                  ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
                              ].join(" ")}
                            >
                              {bonusClosed ? "Lokað" : "Opið"}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-neutral-400">
                              +{bonus.points} · {bonus.type === "number" ? "tala" : bonus.type === "choice" ? "krossa" : "leikmaður"}
                            </span>
                            {bonus.type === "number" && bonus.correct_number != null && (
                              <span className="text-xs text-slate-600 dark:text-neutral-300">
                                Rétt: <span className="font-mono">{bonus.correct_number}</span>
                              </span>
                            )}
                            {bonus.type === "choice" && bonus.correct_choice && (
                              <span className="text-xs text-slate-600 dark:text-neutral-300">
                                Rétt: <span className="font-semibold">{bonus.correct_choice}</span>
                              </span>
                            )}
                            {bonus.type === "player" && ((bonus as any).correct_player_name || bonus.correct_choice) && (
                              <span className="text-xs text-slate-600 dark:text-neutral-300">
                                Rétt: <span className="font-semibold">
                                  {(bonus as any).correct_player_name || bonus.correct_choice || bonus.correct_player_id}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                if (matchWithBonus) {
                                  prefillBonusFromRow(matchWithBonus);
                                  setShowBonusForm(true);
                                  setTimeout(() => {
                                    document.getElementById("bonus-form-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                  }, 100);
                                }
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                            >
                              Breyta
                            </button>
                            <button
                              onClick={() => deleteBonus(bonus.id)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20 dark:text-red-100 dark:hover:bg-red-500/15"
                            >
                              Eyða
                            </button>
                          </div>
                        </div>
                        {bonus.type === "choice" && bonus.choice_options && (
                          <div className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                            Valmöguleikar: {(bonus.choice_options || []).join(" · ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-900/30 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-neutral-400">Engin bónus spurning</span>
                          <button
                            onClick={() => {
                              setBonusMatchId(m.id);
                              setBonusTitle(`Bónus: ${m.home_team} vs ${m.away_team}`);
                              setShowBonusForm(true);
                              // Scroll to bonus form
                              setTimeout(() => {
                                document.getElementById("bonus-form-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              }, 100);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                          >
                            Bæta við bónus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                };

                return (
                  <div className="space-y-6">
                    {/* Búnir leikir (dropdown) */}
                    {completed.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowCompletedMatches(!showCompletedMatches)}
                          className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-base font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900/60"
                        >
                          <span>
                            ✅ Búnir ({completed.length})
                          </span>
                          <span className={`transform transition-transform ${showCompletedMatches ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </button>
                        {showCompletedMatches && (
                          <div className="space-y-3">
                            {completed.map(renderMatch)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Í gangi */}
                    {inProgress.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-neutral-100">
                          ⏳ Í gangi ({inProgress.length})
                        </h3>
                        <div className="space-y-3">
                          {inProgress.map(renderMatch)}
                        </div>
                      </div>
                    )}

                    {/* Framundan */}
                    {upcoming.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-neutral-100">
                          📅 Framundan ({upcoming.length})
                        </h3>
                        <div className="space-y-4">
                          {/* Í dag */}
                          {upcomingToday.length > 0 && (
                            <div>
                              <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-neutral-300">
                                Í dag
                              </h4>
                              <div className="space-y-3">
                                {upcomingToday.map(renderMatch)}
                              </div>
                            </div>
                          )}

                          {/* Á morgun */}
                          {upcomingTomorrow.length > 0 && (
                            <div>
                              <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-neutral-300">
                                Á morgun
                              </h4>
                              <div className="space-y-3">
                                {upcomingTomorrow.map(renderMatch)}
                              </div>
                            </div>
                          )}

                          {/* Aðrar dagsetningar */}
                          {Array.from(upcomingByDate.entries())
                            .sort(([, matchesA], [, matchesB]) => {
                              const dateA = new Date(matchesA[0].starts_at);
                              const dateB = new Date(matchesB[0].starts_at);
                              return dateA.getTime() - dateB.getTime();
                            })
                            .map(([dateKey, matchesForDate]) => (
                              <div key={dateKey}>
                                <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-neutral-300">
                                  {dateKey}
                                </h4>
                                <div className="space-y-3">
                                  {matchesForDate.map(renderMatch)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
            </div>
          </div>
        )}

        {/* TOURNAMENTS */}
        {tab === "tournaments" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Búa til keppni" subtitle="Búðu til nýja keppni sem hægt er að velja við stofnun deildar.">
              <form onSubmit={createTournament} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">
                    Slug (kóði)
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={tournamentSlug}
                    onChange={(e) => setTournamentSlug(e.target.value)}
                    placeholder="t.d. premier-league-2024-25"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                    Lágstafir, tölur og bandstrik. Notaður sem kóði í kerfinu.
                  </p>
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">
                    Nafn keppni
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="t.d. Enska deildin í fótbolta 2024/25"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                    Nafn sem birtist á heimasíðunni.
                  </p>
                </div>

                <button
                  disabled={creatingTournament}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  {creatingTournament ? "Bý til..." : "Búa til keppni"}
                </button>
              </form>
            </Card>

            <Card title="Yfirlit keppna" subtitle="Listi yfir allar keppnir. Virkja/óvirkja með því að smella á stöðu.">
              {loadingTournaments ? (
                <p className="text-sm text-slate-600 dark:text-neutral-400">Hleð...</p>
              ) : tournaments.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-neutral-400">Engar keppnir.</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"
                    >
                      {editingTournamentId === t.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Nafn keppni</label>
                            <input
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                              value={editingTournamentName}
                              onChange={(e) => setEditingTournamentName(e.target.value)}
                              placeholder="t.d. Enska deildin í fótbolta 2024/25"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                              Slug: {t.slug} (ekki hægt að breyta)
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateTournament(t.id)}
                              disabled={updatingTournament}
                              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                            >
                              {updatingTournament ? "Vista..." : "Vista"}
                            </button>
                            <button
                              onClick={cancelEditingTournament}
                              disabled={updatingTournament}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
                            >
                              Hætta við
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900 dark:text-neutral-100">
                              {t.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-neutral-400">
                              {t.slug}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleTournamentActive(t.id, t.is_active)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                t.is_active
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              }`}
                            >
                              {t.is_active ? "Virk" : "Óvirk"}
                            </button>
                            <button
                              onClick={() => startEditingTournament(t)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                            >
                              Breyta
                            </button>
                            <button
                              onClick={() => deleteAllMatches(t.id, t.name)}
                              disabled={deletingMatches === t.id}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 disabled:opacity-60 dark:text-amber-200 dark:hover:bg-amber-500/15"
                              title="Eyða öllum leikjum úr keppni"
                            >
                              {deletingMatches === t.id ? "Eyði..." : "Eyða leikjum"}
                            </button>
                            <button
                              onClick={() => deleteTournament(t.id, t.name)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-100 dark:hover:bg-red-500/15"
                            >
                              Eyða
                            </button>
                          </div>
                        </div>
                      )}
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
            <Card title="Stigagjöf" subtitle="Breyttu stigum fyrir rétt 1X2 (gildir fyrir valda keppni).">
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Keppni</label>
                  <select
                    value={selectedTournamentForSettings}
                    onChange={(e) => setSelectedTournamentForSettings(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  >
                    {loadingTournaments ? (
                      <option>Sæki keppnir...</option>
                    ) : tournaments.length === 0 ? (
                      <option>Engar keppnir tiltækar</option>
                    ) : (
                      tournaments.map((t) => (
                        <option key={t.id} value={t.slug}>
                          {t.name} {t.is_active ? "(Active)" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Stig per rétt 1X2</label>
                  <input
                    type="number"
                    min={0}
                    value={pointsPer1x2}
                    onChange={(e) => setPointsPer1x2(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">Dæmi: 1, 2 eða 3.</p>
                </div>

                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">
                    Stig per rétt X (valfrjálst)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pointsPerX === null ? "" : pointsPerX}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setPointsPerX(val);
                    }}
                    placeholder="Tómur = sama og 1X2"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                    Ef tómur, nota sama stig og 1X2. Ef sett, nota þetta stig fyrir X.
                  </p>
                </div>

                <button
                  disabled={savingSettings}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  {savingSettings ? "Vista..." : "Vista stillingar"}
                </button>
              </form>
            </Card>

            <Card title="Samstilla" subtitle="Samstilla spár og bónus svör fyrir alla meðlimi með sama username. Bætir aðeins við sem vantar, ekki yfirskrifa fyrirliggjandi gögn.">
              <div className="space-y-4">
                <div>
                  <button
                    onClick={syncPredictions}
                    disabled={syncingPredictions}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    {syncingPredictions ? "Samstilla..." : "Samstilla spár"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-neutral-500">
                    Finnur alla meðlimi með sama username og bætir við spám sem vantar. Fyrirliggjandi spár verða ekki breyttar.
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-4 dark:border-neutral-700">
                  <button
                    onClick={syncBonusAnswers}
                    disabled={syncingBonusAnswers}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    {syncingBonusAnswers ? "Samstilla..." : "Samstilla bónus svör"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-neutral-500">
                    Finnur alla meðlimi með sama username og bætir við bónus svörum sem vantar. Fyrirliggjandi svör verða ekki breytt.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              title="Push Notifications"
              subtitle="Sendir tilkynningar til notenda í vafranum/tölvu þeirra."
            >
              <div className="space-y-4">
                {/* Listi af notendum með push subscriptions */}
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">
                    Notendur með push subscriptions ({pushUsers.length})
                  </label>
                  {loadingPushUsers ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-neutral-500">Hleð...</p>
                  ) : pushUsers.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-neutral-500">
                      Engir notendur með push subscriptions.
                    </p>
                  ) : (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/40">
                      {pushUsers.map((user: any) => (
                        <div
                          key={user.subscriptionId}
                          className="rounded bg-white px-2 py-1 text-xs dark:bg-neutral-950"
                        >
                          <span className="font-medium">{user.displayName}</span>{" "}
                          <span className="text-slate-500">(@{user.username})</span>{" "}
                          {user.type && (
                            <span className={`ml-1 rounded px-1 text-[10px] ${
                              user.type === "iOS/Safari" 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}>
                              {user.type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={loadPushUsers}
                    disabled={loadingPushUsers}
                    className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Endurnýja lista
                  </button>
                </div>

                {/* Send to all or one user */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
                    <input
                      type="radio"
                      checked={sendPushToAll}
                      onChange={() => setSendPushToAll(true)}
                      className="rounded"
                    />
                    Send til allra notenda
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
                    <input
                      type="radio"
                      checked={!sendPushToAll}
                      onChange={() => setSendPushToAll(false)}
                      className="rounded"
                    />
                    Send til einstaklings
                  </label>
                </div>

                {/* Velja notanda (ef ekki "send to all") */}
                {!sendPushToAll && (
                  <div>
                    <label className="text-sm text-slate-700 dark:text-neutral-300">Veldu notanda</label>
                    <select
                      value={selectedPushMemberId || ""}
                      onChange={(e) => setSelectedPushMemberId(e.target.value || null)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    >
                      <option value="">-- Veldu notanda --</option>
                      {pushUsers.map((user) => (
                        <option key={user.memberId} value={user.memberId}>
                          {user.displayName} (@{user.username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Titill */}
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Titill</label>
                  <input
                    type="text"
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="T.d. Ný bónusspurning!"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  />
                </div>

                {/* Skilaboð */}
                <div>
                  <label className="text-sm text-slate-700 dark:text-neutral-300">Skilaboð</label>
                  <textarea
                    value={pushMessage}
                    onChange={(e) => setPushMessage(e.target.value)}
                    placeholder="T.d. Ný bónusspurning hefur verið búin til fyrir leikinn!"
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                  />
                </div>

                {/* Send takki */}
                <button
                  onClick={sendPushNotification}
                  disabled={sendingPush || !pushTitle.trim() || !pushMessage.trim()}
                  className="w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 dark:bg-green-500 dark:text-neutral-900 dark:hover:bg-green-400"
                >
                  {sendingPush ? "Sendi..." : "Senda push notification"}
                </button>
              </div>
            </Card>
          </div>
        )}

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
          ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-500 dark:text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Card({
  id,
  title,
  subtitle,
  right,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-3xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/30 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">{subtitle}</p>}
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
        "h-7 w-7 rounded-lg border text-xs font-bold transition flex items-center justify-center",
        selected
          ? "border-emerald-300 bg-emerald-300 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-500 dark:text-white"
          : "border-neutral-700 bg-neutral-100 text-neutral-900 hover:bg-white dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
