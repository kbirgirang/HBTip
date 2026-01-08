"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getTeamFlag } from "@/lib/teamFlags";

// Athuga hvort Ísland sé í leiknum
function isIcelandPlaying(homeTeam: string, awayTeam: string): boolean {
  const icelandNames = ["Ísland", "Iceland"];
  return icelandNames.includes(homeTeam) || icelandNames.includes(awayTeam);
}

type Pick = "1" | "X" | "2";
type BonusType = "number" | "choice" | "player";

type ViewData = {
  room: { code: string; name: string };
  me: { id: string; display_name: string; is_owner: boolean; username: string };
  pointsPerCorrect1x2: number;
  pointsPerCorrectX: number | null;
  matches: Array<{
    id: string;
    match_no: number | null;
    stage: string | null;
    home_team: string;
    away_team: string;
    starts_at: string;
    allow_draw: boolean;
    result: Pick | null;
    myPick?: Pick | null;
    underdog_team?: "1" | "2" | null;
    underdog_multiplier?: number | null;

    bonus?: null | {
      id: string;
      match_id: string;
      title: string;
      type: BonusType;
      points: number;
      closes_at: string;

      // correct answers (not used by user UI now, but fine to keep)
      correct_number: number | null;

      // choice
      choice_options?: string[] | null;
      correct_choice?: string | null;

      // player
      player_options?: Array<{ name: string; team?: string }> | null;
      correct_player_name?: string | null; // For display

      // my existing answer (from DB)
      my_answer_number?: number | null;
      my_answer_choice?: string | null;
      my_answer_player_name?: string | null; // For display
    };
  }>;
  leaderboard: Array<{ memberId: string; displayName: string; username: string; points: number; correct1x2: number; bonusPoints: number }>;
};

export default function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ? decodeURIComponent(params.roomCode) : "";

  const [tab, setTab] = useState<"matches" | "leaderboard" | "owner">("matches");
  const [data, setData] = useState<ViewData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Owner management state
  const [members, setMembers] = useState<Array<{ id: string; username: string; display_name: string; is_owner: boolean }>>([]);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerSuccess, setOwnerSuccess] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Change join password
  const [newJoinPassword, setNewJoinPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Remove member
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Change member name
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState("");

  // Change member password
  const [changingPasswordMemberId, setChangingPasswordMemberId] = useState<string | null>(null);
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [changingMemberPassword, setChangingMemberPassword] = useState(false);

  // Toggle for "Eldri leikir" section
  const [showFinishedMatches, setShowFinishedMatches] = useState(false);

  // Room switcher
  const [myRooms, setMyRooms] = useState<Array<{ roomId: string; roomCode: string; roomName: string; isCurrentRoom: boolean }>>([]);
  const [showRoomSwitcher, setShowRoomSwitcher] = useState(false);

  // State fyrir hvaða leikjum eru með sýndum bónus
  const [showBonusForMatch, setShowBonusForMatch] = useState<Set<string>>(new Set());

  // Toggle function fyrir bónus
  const toggleBonus = (matchId: string) => {
    setShowBonusForMatch(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Real-time clock for checking if matches have started
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    setErr(null);
    const res = await fetch("/api/room/view", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr((json as any)?.error || "Ekki tókst að sækja gögn.");
      return;
    }
    setData(json as ViewData);
  }

  useEffect(() => {
    void load();
    void loadMyRooms();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      void load();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const roomSwitcherRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Loka dropdown þegar notandi klikkar utan um hann
    function handleClickOutside(event: MouseEvent) {
      if (showRoomSwitcher && roomSwitcherRef.current && !roomSwitcherRef.current.contains(event.target as Node)) {
        setShowRoomSwitcher(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoomSwitcher]);

  async function loadMyRooms() {
    setLoadingRooms(true);
    try {
      const res = await fetch("/api/room/list-my-rooms", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.rooms) {
        setMyRooms(json.rooms);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingRooms(false);
    }
  }

  async function switchRoom(roomCode: string) {
    if (!roomCode) {
      console.error("Room code is empty");
      return;
    }
    
    // Uppfæra session fyrst
    try {
      const res = await fetch("/api/room/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode }),
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Ekki tókst að skipta deild");
        return;
      }
      
      // Fara í nýju deildina
      window.location.href = `/r/${encodeURIComponent(roomCode)}`;
    } catch {
      alert("Tenging klikkaði. Prófaðu aftur.");
    }
  }

  async function handleLogout() {
    if (!confirm("Ertu viss um að þú viljir skrá þig út?")) return;
    
    try {
      const res = await fetch("/api/room/logout", {
        method: "POST",
      });
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Ekki tókst að skrá út");
        return;
      }
      
      // Fara á forsíðu eftir útskráningu
      window.location.href = "/";
    } catch {
      alert("Tenging klikkaði. Prófaðu aftur.");
    }
  }

  async function loadMembers() {
    if (!data?.me.is_owner) return;
    setLoadingMembers(true);
    setOwnerError(null);
    try {
      const res = await fetch("/api/room/owner/list-members");
      const json = await res.json();
      if (!res.ok) {
        setOwnerError(json.error || "Ekki tókst að sækja members");
        return;
      }
      setMembers(json.members || []);
    } catch {
      setOwnerError("Tenging klikkaði");
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    if (tab === "owner" && data?.me.is_owner) {
      void loadMembers();
    }
  }, [tab, data?.me.is_owner]);

  async function handleChangeJoinPassword(e: React.FormEvent) {
    e.preventDefault();
    setOwnerError(null);
    setOwnerSuccess(null);

    if (!ownerPassword) return setOwnerError("Lykilorð stjórnanda vantar");
    if (newJoinPassword.length < 6) return setOwnerError("Nýtt join password þarf að vera amk 6 stafir");

    setChangingPassword(true);
    try {
      const res = await fetch("/api/room/owner/change-join-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPassword, newJoinPassword }),
      });

      const json = await res.json();
      if (!res.ok) {
        setOwnerError(json.error || "Ekki tókst að breyta join password");
        return;
      }

      setOwnerSuccess("Join password hefur verið breytt");
      setNewJoinPassword("");
      setOwnerPassword("");
    } catch {
      setOwnerError("Tenging klikkaði");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!ownerPassword) return setOwnerError("Lykilorð stjórnanda vantar");
    if (!confirm("Ertu viss um að þú viljir fjarlægja þennan member?")) return;

    setRemovingMemberId(memberId);
    setOwnerError(null);
    setOwnerSuccess(null);

    try {
      const res = await fetch("/api/room/owner/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPassword, memberId }),
      });

      const json = await res.json();
      if (!res.ok) {
        setOwnerError(json.error || "Ekki tókst að fjarlægja member");
        return;
      }

      setOwnerSuccess("Meðlimur hefur verið fjarlægður");
      setOwnerPassword("");
      void loadMembers();
    } catch {
      setOwnerError("Tenging klikkaði");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleChangeMemberName(memberId: string) {
    if (!ownerPassword) return setOwnerError("Lykilorð stjórnanda vantar");
    if (editingMemberName.trim().length < 2) return setOwnerError("Nafn þarf að vera amk 2 stafir");

    setOwnerError(null);
    setOwnerSuccess(null);

    try {
      const res = await fetch("/api/room/owner/change-member-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPassword, memberId, newDisplayName: editingMemberName.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setOwnerError(json.error || "Ekki tókst að breyta nafni");
        return;
      }

      setOwnerSuccess("Nafn hefur verið breytt");
      setOwnerPassword("");
      setEditingMemberId(null);
      setEditingMemberName("");
      void loadMembers();
      void load(); // Reload main data to update leaderboard
    } catch {
      setOwnerError("Tenging klikkaði");
    }
  }

  async function handleChangeMemberPassword(memberId: string) {
    if (!ownerPassword) return setOwnerError("Lykilorð stjórnanda vantar");
    if (newMemberPassword.length < 6) return setOwnerError("Nýtt lykilorð þarf að vera amk 6 stafir");

    setOwnerError(null);
    setOwnerSuccess(null);
    setChangingMemberPassword(true);

    try {
      const res = await fetch("/api/room/owner/change-member-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPassword, memberId, newPassword: newMemberPassword }),
      });

      const json = await res.json();
      if (!res.ok) {
        setOwnerError(json.error || "Ekki tókst að breyta lykilorði");
        return;
      }

      setOwnerSuccess("Lykilorð breytt ✅");
      setChangingPasswordMemberId(null);
      setNewMemberPassword("");
      void loadMembers();
    } catch {
      setOwnerError("Tenging klikkaði");
    } finally {
      setChangingMemberPassword(false);
    }
  }

  const header = useMemo(() => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold flex-1">
            {data.room.name} <span className="text-neutral-500 dark:text-neutral-400">({data.room.code})</span>
        </h1>
          <div className="flex flex-col items-end gap-2 flex-shrink-0 w-auto">
            {myRooms.length > 1 && (
              <div className="relative z-10" ref={roomSwitcherRef}>
                <button
                  type="button"
                  onClick={() => setShowRoomSwitcher(!showRoomSwitcher)}
                  className="relative flex items-center gap-1 md:gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 md:px-4 md:py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:border-neutral-500"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 flex-shrink-0"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="hidden md:inline">{loadingRooms ? "Hleð..." : `Þínar deildir (${myRooms.length})`}</span>
                  <span className="md:hidden">{myRooms.length}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 transition-transform flex-shrink-0 ${showRoomSwitcher ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {showRoomSwitcher && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="p-2">
                      <div className="mb-2 px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-400">
                        Deildir sem þú ert í:
                      </div>
                      <div className="space-y-1">
                        {myRooms.map((room) => (
                          <button
                            key={room.roomId}
                            type="button"
                            onClick={() => void switchRoom(room.roomCode)}
                            className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                              room.isCurrentRoom
                                ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold">{room.roomName}</div>
                                <div className="text-xs text-slate-500 dark:text-neutral-400">{room.roomCode}</div>
                              </div>
                              {room.isCurrentRoom && (
                                <div className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white dark:bg-blue-600">
                                  Núverandi
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="relative z-0 flex items-center gap-1 md:gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 md:px-4 md:py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:border-neutral-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 flex-shrink-0"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              <span className="hidden md:inline">Útskrá</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-neutral-300">
          <span className="font-semibold">{data.me.display_name}</span>{" "}
          <span className="font-mono">(@{data.me.username})</span>
          {(() => {
            const myRank = data.leaderboard.findIndex((p) => p.memberId === data.me.id) + 1;
            const myStats = data.leaderboard.find((p) => p.memberId === data.me.id);
            if (myStats && myRank > 0) {
              return (
                <>
                  {" · "}
                  <span className="font-semibold">{myStats.points}</span> stig
                  {" · "}
                  <span className="font-semibold">{myRank}. sæti</span>
                </>
              );
            }
            return null;
          })()}
        </p>
      </div>
    );
  }, [data, myRooms, showRoomSwitcher, loadingRooms]);

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {header}

        <div className="mt-6 flex gap-2">
          <TabButton active={tab === "matches"} onClick={() => setTab("matches")}>
            Leikir
          </TabButton>
          <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
            Staða
          </TabButton>
          {data?.me.is_owner && (
            <TabButton active={tab === "owner"} onClick={() => setTab("owner")}>
              Stjórnandi
            </TabButton>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-3 md:mt-4 md:p-4">
          {!data && !err && <p className="text-slate-600 dark:text-neutral-300">Hleð...</p>}

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {data && tab === "matches" && (
            <div className="space-y-6">
              {data.matches.length === 0 ? (
                <p className="text-slate-600 dark:text-neutral-300">Engir leikir komnir inn ennþá (admin setur inn).</p>
              ) : (
                (() => {
                  // Komandi leikir: allir leikir sem ekki hafa niðurstöðu (sama hvort byrjaðir eða ekki)
                  const upcomingMatches = data.matches.filter((m) => m.result == null);
                  // Eldri leikir: allir leikir sem hafa niðurstöðu
                  const finishedMatches = data.matches.filter((m) => m.result != null);

                  return (
                    <>
                      {finishedMatches.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowFinishedMatches(!showFinishedMatches)}
                            className="mb-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-left hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/60"
                          >
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">
                              Eldri leikir ({finishedMatches.length})
                            </h2>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`h-5 w-5 text-slate-600 transition-transform dark:text-neutral-400 ${
                                showFinishedMatches ? "rotate-180" : ""
                              }`}
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          {showFinishedMatches && (
                            <div className="space-y-3">
                            {finishedMatches.map((m) => {
                              const started = new Date(m.starts_at).getTime() <= now;
                              const locked = started || m.result != null;

                  async function pick(p: Pick) {
                                if (locked) return;

                    const res = await fetch("/api/prediction/set", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ matchId: m.id, pick: p }),
                    });

                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      alert(j?.error || "Ekki tókst að vista spá.");
                      return;
                    }

                    setData((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        matches: prev.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                      };
                    });
                  }

                  const isIceland = isIcelandPlaying(m.home_team, m.away_team);
                  
                  return (
                                <div key={m.id} className={`rounded-xl border p-4 relative overflow-hidden ${
                                  isIceland 
                                    ? "border-blue-400 bg-gradient-to-br from-blue-50/80 to-red-50/80 dark:border-blue-500 dark:from-blue-950/40 dark:to-red-950/40" 
                                    : "border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40"
                                }`}>
                      {isIceland && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none overflow-hidden rounded-xl">
                          <span className="text-[30rem] leading-none scale-[2] -rotate-[30deg]">{getTeamFlag("Ísland")}</span>
                        </div>
                      )}
                      <div className="relative mb-3 text-xs text-slate-500 dark:text-neutral-400">
                        {m.stage ? `${m.stage} · ` : ""}
                        {new Date(m.starts_at).toLocaleString()}
                        {m.match_no != null ? ` · #${m.match_no}` : ""}
                      </div>
                      <div className="relative flex flex-col items-center gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                        <div className="text-center md:text-left">
                          <div className="font-semibold">
                                        <span>{m.home_team}</span>{" "}
                                        <span className="inline-flex items-center gap-1">
                                          {getTeamFlag(m.home_team) && <span>{getTeamFlag(m.home_team)}</span>}
                                          vs
                                          {getTeamFlag(m.away_team) && <span>{getTeamFlag(m.away_team)}</span>}
                                        </span>{" "}
                                        <span>{m.away_team}</span>{" "}
                            {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                          </div>
                        </div>

                        <div className="flex gap-2">
                                      <PickButton 
                            selected={m.myPick === "1"} 
                            disabled={locked} 
                            onClick={() => pick("1")}
                            underdogMultiplier={m.underdog_team === "1" ? m.underdog_multiplier : null}
                          >
                            1
                          </PickButton>

                          {m.allow_draw && (
                                        <PickButton selected={m.myPick === "X"} disabled={locked} onClick={() => pick("X")}>
                              X
                            </PickButton>
                          )}

                                      <PickButton 
                            selected={m.myPick === "2"} 
                            disabled={locked} 
                            onClick={() => pick("2")}
                            underdogMultiplier={m.underdog_team === "2" ? m.underdog_multiplier : null}
                          >
                            2
                          </PickButton>
                        </div>
                      </div>

                                  <div className="mt-2 text-sm text-slate-600 dark:text-neutral-300 flex items-center gap-2 flex-wrap">
                        <span>
                          Úrslit:{" "}
                                      <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-slate-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                            {m.result ?? "-"}
                          </span>
                        </span>

                        {m.myPick && (
                                      <span className="text-xs">
                                        Þín spá:{" "}
                                        <span
                                          className={[
                                            "font-mono px-2 py-0.5 rounded",
                                            m.result != null
                                              ? m.myPick === m.result
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                                              : "text-slate-500 dark:text-neutral-400",
                                          ].join(" ")}
                                        >
                                          {m.myPick}
                                        </span>
                          </span>
                        )}

                                    {locked && <span className="text-xs text-slate-500 dark:text-neutral-400">(lokað)</span>}
                      </div>

                      {m.bonus && (
                        <>
                          <button
                            onClick={() => toggleBonus(m.id)}
                            className="relative mt-3 rounded-lg border-2 border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                          >
                            {showBonusForMatch.has(m.id) ? "✕ Fela bónus" : "📋 Sýna bónus"}
                          </button>
                          {showBonusForMatch.has(m.id) && (
                            <BonusAnswerCard
                              bonus={m.bonus}
                              matchStartsAt={m.starts_at}
                              matchResult={m.result}
                              onSaved={() => void load()}
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                            })}
                            </div>
                          )}
                        </div>
                      )}

                      {upcomingMatches.length > 0 && (
                        <div>
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Leikir framundan</h2>
                            <div className="flex flex-col items-end gap-1">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/40">
                                {data.pointsPerCorrectX != null ? (
                                  <span className="text-slate-700 dark:text-neutral-300">
                                    <span className="font-semibold">1/2:</span> {data.pointsPerCorrect1x2} stig{" "}
                                    <span className="mx-1 text-slate-400 dark:text-neutral-500">·</span>{" "}
                                    <span className="font-semibold">X:</span> {data.pointsPerCorrectX} stig
                                  </span>
                                ) : (
                                  <span className="text-slate-700 dark:text-neutral-300">
                                    <span className="font-semibold">1X2:</span> {data.pointsPerCorrect1x2} stig
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {upcomingMatches.map((m) => {
                              const started = new Date(m.starts_at).getTime() <= now;
                              const locked = started || m.result != null;

                              async function pick(p: Pick) {
                                if (locked) return;

                                const res = await fetch("/api/prediction/set", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ matchId: m.id, pick: p }),
                                });

                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}));
                                  alert(j?.error || "Ekki tókst að vista spá.");
                                  return;
                                }

                                setData((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    matches: prev.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                                  };
                                });
                              }

                              const isIceland = isIcelandPlaying(m.home_team, m.away_team);
                              
                              return (
                                <div key={m.id} className={`rounded-xl border p-4 relative overflow-hidden ${
                                  isIceland 
                                    ? "border-blue-400 bg-gradient-to-br from-blue-50/80 to-red-50/80 dark:border-blue-500 dark:from-blue-950/40 dark:to-red-950/40" 
                                    : "border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40"
                                }`}>
                                  {isIceland && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none overflow-hidden rounded-xl">
                                      <span className="text-[30rem] leading-none scale-[2] -rotate-[30deg]">{getTeamFlag("Ísland")}</span>
                                    </div>
                                  )}
                                  <div className="relative mb-3 text-xs text-slate-500 dark:text-neutral-400">
                                    {m.stage ? `${m.stage} · ` : ""}
                                    {new Date(m.starts_at).toLocaleString()}
                                    {m.match_no != null ? ` · #${m.match_no}` : ""}
                                  </div>
                                  <div className="relative flex flex-col items-center gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                                    <div className="text-center md:text-left">
                                      <div className="font-semibold">
                                        <span>{m.home_team}</span>{" "}
                                        <span className="inline-flex items-center gap-1">
                                          {getTeamFlag(m.home_team) && <span>{getTeamFlag(m.home_team)}</span>}
                                          vs
                                          {getTeamFlag(m.away_team) && <span>{getTeamFlag(m.away_team)}</span>}
                                        </span>{" "}
                                        <span>{m.away_team}</span>{" "}
                                        {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                                      </div>
                                    </div>

                                    <div className="flex gap-2">
                                      <PickButton 
                                        selected={m.myPick === "1"} 
                                        disabled={locked} 
                                        onClick={() => pick("1")}
                                        underdogMultiplier={m.underdog_team === "1" ? m.underdog_multiplier : null}
                                      >
                                        1
                                      </PickButton>

                                      {m.allow_draw && (
                                        <PickButton selected={m.myPick === "X"} disabled={locked} onClick={() => pick("X")}>
                                          X
                                        </PickButton>
                                      )}

                                      <PickButton 
                                        selected={m.myPick === "2"} 
                                        disabled={locked} 
                                        onClick={() => pick("2")}
                                        underdogMultiplier={m.underdog_team === "2" ? m.underdog_multiplier : null}
                                      >
                                        2
                                      </PickButton>
                                    </div>
                                  </div>

                                  <div className="mt-2 text-sm text-slate-600 dark:text-neutral-300 flex items-center gap-2 flex-wrap">
                                    <span>
                                      Úrslit:{" "}
                                      <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-slate-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                                        {m.result ?? "-"}
                                      </span>
                                    </span>

                                    {m.myPick && (
                                      <span className="text-xs">
                                        Þín spá:{" "}
                                        <span
                                          className={[
                                            "font-mono px-2 py-0.5 rounded",
                                            m.result != null
                                              ? m.myPick === m.result
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                                              : "text-slate-500 dark:text-neutral-400",
                                          ].join(" ")}
                                        >
                                          {m.myPick}
                                        </span>
                                      </span>
                                    )}

                                    {locked && <span className="text-xs text-slate-500 dark:text-neutral-400">(lokað)</span>}
                                  </div>

                                  {m.bonus && (
                                    <>
                                      <button
                                        onClick={() => toggleBonus(m.id)}
                                        className="relative mt-3 rounded-lg border-2 border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                                      >
                                        {showBonusForMatch.has(m.id) ? "✕ Fela bónus" : "📋 Bónus Spurning"}
                                      </button>
                                      {showBonusForMatch.has(m.id) && (
                                        <BonusAnswerCard
                                          bonus={m.bonus}
                                          matchStartsAt={m.starts_at}
                                          matchResult={m.result}
                                          onSaved={() => void load()}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          )}

          {data && tab === "owner" && data.me.is_owner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Stjórnandi stjórnun</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">Stjórna deildinni með lykilorði stjórnanda.</p>
              </div>

              {ownerError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {ownerError}
                </div>
              )}

              {ownerSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {ownerSuccess}
                </div>
              )}

              {/* Change Join Password */}
              <div className="rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Breyta join password</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-neutral-400">Breyttu lykilorði sem notendur nota til að skrá sig inná deildina.</p>
                <form onSubmit={handleChangeJoinPassword} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-700 dark:text-neutral-300">Lykilorð stjórnanda</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Lykilorð stjórnanda"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 dark:text-neutral-300">Nýtt join password</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={newJoinPassword}
                      onChange={(e) => setNewJoinPassword(e.target.value)}
                      placeholder="minnst 6 stafir"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
                  >
                    {changingPassword ? "Breyta..." : "Breyta join password"}
                  </button>
                </form>
              </div>

              {/* Members List */}
              <div className="rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Meðlimir</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-neutral-400">Stjórna meðlimum í deildinni.</p>

                {loadingMembers ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-neutral-400">Hleð...</p>
                ) : members.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-neutral-400">Engir meðlimir fundust.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">{m.display_name}</span>
                            {m.is_owner && (
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">Stjórnandi</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">@{m.username}</p>
                        </div>

                        {!m.is_owner && (
                          <div className="flex flex-col gap-2">
                            {changingPasswordMemberId === m.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="password"
                                  className="w-32 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                                  value={newMemberPassword}
                                  onChange={(e) => setNewMemberPassword(e.target.value)}
                                  placeholder="Nýtt lykilorð"
                                />
                                <button
                                  onClick={() => handleChangeMemberPassword(m.id)}
                                  disabled={changingMemberPassword}
                                  className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                  {changingMemberPassword ? "Vista..." : "Vista"}
                                </button>
                                <button
                                  onClick={() => {
                                    setChangingPasswordMemberId(null);
                                    setNewMemberPassword("");
                                  }}
                                  className="rounded bg-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-400 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                                >
                                  Hætta
                                </button>
                              </div>
                            ) : editingMemberId === m.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="w-32 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                                  value={editingMemberName}
                                  onChange={(e) => setEditingMemberName(e.target.value)}
                                  placeholder="Nýtt nafn"
                                />
                                <button
                                  onClick={() => handleChangeMemberName(m.id)}
                                  className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                                >
                                  Vista
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMemberId(null);
                                    setEditingMemberName("");
                                  }}
                                  className="rounded bg-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-400 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                                >
                                  Hætta
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMemberId(m.id);
                                    setEditingMemberName(m.display_name);
                                  }}
                                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                                >
                                  Breyta nafni
                                </button>
                                <button
                                  onClick={() => {
                                    setChangingPasswordMemberId(m.id);
                                    setNewMemberPassword("");
                                  }}
                                  className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                                >
                                  Breyta lykilorði
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(m.id)}
                                  disabled={removingMemberId === m.id}
                                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-60"
                                >
                                  {removingMemberId === m.id ? "Fjarlægi..." : "Fjarlægja"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!loadingMembers && members.length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/20 p-3">
                    <p className="text-xs text-slate-600 dark:text-neutral-400">
                      <strong>Ath:</strong> Til að breyta nafni eða fjarlægja meðlim, þarftu að setja inn lykilorð stjórnanda fyrst.
                    </p>
                    <input
                      type="password"
                      className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Lykilorð stjórnanda"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {data && tab === "leaderboard" && (
            <>
              {/* Desktop Table View */}
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-800 md:block">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white dark:bg-neutral-950/60 dark:text-neutral-300">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Þitt nafn (í stigatöflu)</th>
                      <th className="px-3 py-2 text-right">Stig</th>
                      <th className="px-3 py-2 text-right">1X2</th>
                      <th className="px-3 py-2 text-right">Bónus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((p, idx) => {
                      const rank = idx + 1;
                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      return (
                        <tr key={p.memberId} className="border-t border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40">
                          <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">
                            {medal ? <span className="mr-1">{medal}</span> : null}
                            {rank}
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">{p.displayName}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-neutral-100">{p.points}</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.correct1x2}</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.bonusPoints || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="space-y-2 md:hidden">
                {data.leaderboard.map((p, idx) => {
                  const rank = idx + 1;
                  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                  return (
                    <div
                      key={p.memberId}
                      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-slate-900 dark:text-neutral-100">
                            {medal ? <span className="mr-1">{medal}</span> : null}
                            {rank}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-neutral-100">{p.displayName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-900 dark:text-neutral-100">{p.points}</div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">stig</div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xs dark:border-neutral-800">
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">1X2:</span>{" "}
                          <span className="font-medium text-slate-700 dark:text-neutral-300">{p.correct1x2}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-neutral-400">Bónus:</span>{" "}
                          <span className="font-medium text-slate-700 dark:text-neutral-300">{p.bonusPoints || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!data && !err && roomCode && <p className="mt-4 text-xs text-slate-500 dark:text-neutral-500">Deild param: {roomCode}</p>}
        </div>
      </div>
    </main>
  );
}

/* -----------------------------
   BONUS ANSWER UI (number + choice)
----------------------------- */

function BonusAnswerCard({
  bonus,
  matchStartsAt,
  matchResult,
  onSaved,
}: {
  bonus: NonNullable<ViewData["matches"][number]["bonus"]>;
  matchStartsAt: string; // ISO
  matchResult: Pick | null;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update now every second to check if match has started
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const started = new Date(matchStartsAt).getTime() <= now;
  const bonusClosed = new Date(bonus.closes_at).getTime() <= now;
  const locked = started || bonusClosed || matchResult != null;

  const [answerNumber, setAnswerNumber] = useState<string>(
    bonus.my_answer_number != null ? String(bonus.my_answer_number) : ""
  );
  const [answerChoice, setAnswerChoice] = useState<string>(bonus.my_answer_choice || "");
  const [answerPlayerName, setAnswerPlayerName] = useState<string>(bonus.my_answer_player_name || "");

  // ✅ mikilvægt: ef load() kemur með ný gögn, sync-a state
  useEffect(() => {
    setAnswerNumber(bonus.my_answer_number != null ? String(bonus.my_answer_number) : "");
    setAnswerChoice(bonus.my_answer_choice || "");
    setAnswerPlayerName(bonus.my_answer_player_name || "");
  }, [bonus.id, bonus.my_answer_number, bonus.my_answer_choice, bonus.my_answer_player_name]);

  async function save() {
    setLocalErr(null);

    if (locked) {
      setLocalErr("Bónus er lokað.");
      return;
    }

    // validate
    if (bonus.type === "number") {
      if (!answerNumber.trim()) return setLocalErr("Skrifaðu tölu.");
      const n = Number(answerNumber);
      if (!Number.isFinite(n)) return setLocalErr("Ógild tala.");
    }

    if (bonus.type === "choice") {
      if (!answerChoice) return setLocalErr("Veldu valmöguleika.");
      const options = bonus.choice_options || [];
      if (options.length < 2 || options.length > 6) return setLocalErr("Valmöguleikar þurfa að vera 2–6.");
      if (!options.includes(answerChoice)) return setLocalErr("Valið er ekki í listanum.");
    }

    if (bonus.type === "player") {
      if (!answerPlayerName.trim()) return setLocalErr("Skrifaðu inn nafn leikmanns.");
      const playerOptions = bonus.player_options || [];
      const playerNames = playerOptions.map((p) => p.name.trim().toLowerCase());
      if (!playerNames.includes(answerPlayerName.trim().toLowerCase())) {
        return setLocalErr("Leikmaður verður að vera í valmöguleikum.");
      }
    }

    setSaving(true);
    try {
      const payload: any = { questionId: bonus.id };

      if (bonus.type === "number") payload.answerNumber = Number(answerNumber);
      if (bonus.type === "choice") payload.answerChoice = answerChoice;
      if (bonus.type === "player") payload.answerPlayerName = answerPlayerName.trim();

      const res = await fetch("/api/bonus/answer/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalErr(j?.error || "Ekki tókst að vista bónus svar.");
        return;
      }

      // ✅ sýna strax (án þess að bíða eftir reload)
      if (bonus.type === "number") setAnswerNumber(String(Number(answerNumber)));
      if (bonus.type === "choice") setAnswerChoice(answerChoice);
      if (bonus.type === "player") setAnswerPlayerName(answerPlayerName.trim());

      onSaved?.();
    } catch {
      setLocalErr("Tenging klikkaði.");
    } finally {
      setSaving(false);
    }
  }

  const myAnswerLabel =
    bonus.type === "number" ? bonus.my_answer_number : 
    bonus.type === "choice" ? bonus.my_answer_choice : 
    bonus.type === "player" ? bonus.my_answer_player_name : null;

  const correctAnswerLabel = 
    bonus.type === "number" ? bonus.correct_number : 
    bonus.type === "choice" ? bonus.correct_choice : 
    bonus.type === "player" ? (bonus.correct_player_name || bonus.correct_choice) : null;

  // Rétt svar á aðeins að birtast ef matchResult er sett (admin hefur sett niðurstöðu)
  const showCorrectAnswer = matchResult != null;
  
  const isCorrect = showCorrectAnswer && myAnswerLabel != null && correctAnswerLabel != null && String(myAnswerLabel) === String(correctAnswerLabel);
  const isWrong = showCorrectAnswer && myAnswerLabel != null && correctAnswerLabel != null && !isCorrect;

  // Minimalist view when locked
  if (locked) {
  return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/40 p-2">
        <div className="text-xs font-medium text-slate-700 dark:text-neutral-300">{bonus.title}</div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {myAnswerLabel != null && myAnswerLabel !== "" ? (
            <>
              <span className="text-slate-500 dark:text-neutral-400">Þitt:</span>
              <span
                className={[
                  "font-semibold px-1.5 py-0.5 rounded",
                  isCorrect ? "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20" : isWrong ? "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/20" : "text-slate-600 dark:text-neutral-300",
                ].join(" ")}
              >
                {String(myAnswerLabel)}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Ekkert svar</span>
          )}
          {showCorrectAnswer && (
            <>
              <span className="text-slate-400 dark:text-neutral-500">·</span>
              <span className="text-slate-500 dark:text-neutral-400">Rétt:</span>
              {correctAnswerLabel != null ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{String(correctAnswerLabel)}</span>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Full form when open
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-slate-900 dark:text-neutral-100">Bónus: {bonus.title}</div>
        <div className="text-xs text-slate-600 dark:text-neutral-300">
          +{bonus.points} stig · {bonus.type === "number" ? "tala" : bonus.type === "choice" ? "krossa" : "leikmaður"}
        </div>
      </div>

      <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
        Lokar: {new Date(bonus.closes_at).toLocaleString()}
      </div>

      {/* ✅ sýna vistað svar ef til */}
      {myAnswerLabel != null && myAnswerLabel !== "" && (
        <div className="mt-2 text-sm text-slate-700 dark:text-neutral-300">
          Þitt svar:{" "}
          <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
            {String(myAnswerLabel)}
          </span>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {bonus.type === "number" && (
          <input
            value={answerNumber}
            onChange={(e) => setAnswerNumber(e.target.value)}
            inputMode="decimal"
            placeholder="Skrifaðu tölu..."
            disabled={locked}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
          />
        )}

        {bonus.type === "choice" && (
          <div className="space-y-2">
            {(bonus.choice_options || []).map((opt) => (
              <label key={opt} className={`flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200 ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <input
                  type="radio"
                  name={`bonus_${bonus.id}`}
                  value={opt}
                  checked={answerChoice === opt}
                  onChange={() => setAnswerChoice(opt)}
                  disabled={locked}
                  className="disabled:cursor-not-allowed"
                />
                <span>{opt}</span>
              </label>
            ))}

            {(!bonus.choice_options || bonus.choice_options.length === 0) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                Engir valmöguleikar í bónus (choice_options vantar).
              </div>
            )}
          </div>
        )}

        {bonus.type === "player" && (
          <div className="space-y-2">
            <select
              value={answerPlayerName}
              onChange={(e) => setAnswerPlayerName(e.target.value)}
              disabled={locked}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
            >
              <option value="">— veldu leikmann —</option>
              {(bonus.player_options || []).map((p, i) => (
                <option key={i} value={p.name}>
                  {p.name}
                  {p.team ? ` (${p.team})` : ""}
                </option>
              ))}
            </select>
            {bonus.player_options && bonus.player_options.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Engir leikmenn í valmöguleikum.
              </p>
            )}
          </div>
        )}

        {localErr && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {localErr}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || locked}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {locked ? "Lokað" : saving ? "Vistast..." : "Vista bónus svar"}
        </button>
      </div>
    </div>
  );
}

/* -----------------------------
   UI helpers
----------------------------- */

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
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PickButton({
  children,
  onClick,
  disabled,
  selected,
  underdogMultiplier,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
  underdogMultiplier?: number | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isUnderdog = underdogMultiplier != null;

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={onClick}
        style={{ touchAction: "manipulation" }}
        onMouseEnter={() => isUnderdog && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={[
          "relative h-10 w-10 rounded-lg border text-sm font-bold transition-all duration-150",
          disabled
            ? "border-neutral-300 bg-neutral-100 text-neutral-400 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
            : selected
            ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:border-blue-600 hover:shadow-md hover:scale-105 active:bg-blue-400 active:scale-[0.92] active:shadow-lg dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-400 dark:hover:border-emerald-400 dark:active:bg-emerald-500 dark:active:scale-[0.92]"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400 hover:shadow-md hover:scale-105 active:bg-slate-300 active:scale-[0.92] active:shadow-lg dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:hover:border-neutral-500 dark:active:bg-neutral-400 dark:active:scale-[0.92]",
        ].join(" ")}
      >
        {children}
        {isUnderdog && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-md dark:bg-amber-400 dark:text-amber-950">
            {underdogMultiplier}x
          </span>
        )}
      </button>
      {showTooltip && isUnderdog && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 shadow-lg dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          Underdog: {underdogMultiplier}x stig ef rétt
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-amber-300 dark:border-t-amber-600"></div>
        </div>
      )}
    </div>
  );
}
