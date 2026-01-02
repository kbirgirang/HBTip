"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getTeamFlag } from "@/lib/teamFlags";

type Pick = "1" | "X" | "2";
type BonusType = "number" | "choice";

type ViewData = {
  room: { code: string; name: string };
  me: { id: string; display_name: string; is_owner: boolean };
  pointsPerCorrect1x2: number;
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

      // my existing answer (from DB)
      my_answer_number?: number | null;
      my_answer_choice?: string | null;
    };
  }>;
  leaderboard: Array<{ memberId: string; displayName: string; points: number; correct1x2: number; bonusPoints: number }>;
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
  }, []);

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

  const header = useMemo(() => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {data.room.name} <span className="text-neutral-500 dark:text-neutral-400">({data.room.code})</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-neutral-300">
          Skráður inn sem <span className="font-semibold">{data.me.display_name}</span>. Stig per rétt 1X2:{" "}
          <span className="font-semibold">{data.pointsPerCorrect1x2}</span>
        </p>
      </div>
    );
  }, [data]);

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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6 shadow-sm">
          {!data && !err && <p className="text-slate-600 dark:text-neutral-300">Hleð...</p>}

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {data && tab === "matches" && (
            <div className="space-y-3">
              {data.matches.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">⚽</div>
                  <p className="text-slate-600 dark:text-neutral-300 font-medium">Engir leikir komnir inn ennþá</p>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Admin setur inn leiki</p>
                </div>
              ) : (
                data.matches.map((m) => {
                  const started = new Date(m.starts_at).getTime() <= Date.now();
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

                  return (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:shadow-lg p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {m.match_no != null && (
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded">
                                #{m.match_no}
                              </span>
                            )}
                            {m.stage && (
                              <span className="text-xs text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-900/40 px-2 py-0.5 rounded">
                                {m.stage}
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-bold mb-1">
                            <span className="inline-flex items-center gap-1.5">
                              {getTeamFlag(m.home_team) && <span className="text-xl">{getTeamFlag(m.home_team)}</span>}
                              <span>{m.home_team}</span>
                            </span>
                            <span className="mx-2 text-slate-400 dark:text-neutral-500 font-normal">vs</span>
                            <span className="inline-flex items-center gap-1.5">
                              {getTeamFlag(m.away_team) && <span className="text-xl">{getTeamFlag(m.away_team)}</span>}
                              <span>{m.away_team}</span>
                            </span>
                            {!m.allow_draw && (
                              <span className="ml-3 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20 px-2 py-0.5 rounded">
                                X óvirkt
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            {new Date(m.starts_at).toLocaleString("is-IS", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2 justify-center md:justify-end">
                          <PickButton selected={m.myPick === "1"} disabled={locked} onClick={() => pick("1")}>
                            1
                          </PickButton>

                          {m.allow_draw && (
                            <PickButton selected={m.myPick === "X"} disabled={locked} onClick={() => pick("X")}>
                              X
                            </PickButton>
                          )}

                          <PickButton selected={m.myPick === "2"} disabled={locked} onClick={() => pick("2")}>
                            2
                          </PickButton>
                        </div>
                      </div>

                      {(m.result != null || m.myPick) && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-4 flex-wrap">
                          {m.result != null && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">Úrslit:</span>
                              <span className="rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-1.5 font-bold text-lg text-slate-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
                                {m.result}
                              </span>
                            </div>
                          )}

                          {m.myPick && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-600 dark:text-neutral-400">Þín spá:</span>
                              <span
                                className={[
                                  "font-bold text-lg px-3 py-1.5 rounded-lg border-2",
                                  m.result != null
                                    ? m.myPick === m.result
                                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400"
                                      : "bg-red-500/20 text-red-700 border-red-500/50 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400"
                                    : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400",
                                ].join(" ")}
                              >
                                {m.myPick}
                              </span>
                              {m.result != null && m.myPick === m.result && (
                                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">✓ Rétt!</span>
                              )}
                              {m.result != null && m.myPick !== m.result && (
                                <span className="text-red-600 dark:text-red-400 text-sm font-medium">✗ Rangt</span>
                              )}
                            </div>
                          )}

                          {locked && !m.result && (
                            <span className="text-xs text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-900 px-2 py-1 rounded">
                              Lokað
                            </span>
                          )}
                        </div>
                      )}

                      {/* ✅ BÓNUS UNDER EACH MATCH (svar UI) */}
                      {m.bonus && (
                        <BonusAnswerCard
                          bonus={m.bonus}
                          matchStartsAt={m.starts_at}
                          matchResult={m.result}
                          onSaved={() => void load()}
                        />
                      )}
                    </div>
                  );
                })
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
                          <div className="flex gap-2">
                            {editingMemberId === m.id ? (
                              <>
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
                              </>
                            ) : (
                              <>
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
                                  onClick={() => handleRemoveMember(m.id)}
                                  disabled={removingMemberId === m.id}
                                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-60"
                                >
                                  {removingMemberId === m.id ? "Fjarlægi..." : "Fjarlægja"}
                                </button>
                              </>
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
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-blue-600 text-white dark:bg-neutral-950/60 dark:text-neutral-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Nafn</th>
                    <th className="px-4 py-3 text-right font-semibold">Stig</th>
                    <th className="px-4 py-3 text-right font-semibold">1X2</th>
                    <th className="px-4 py-3 text-right font-semibold">Bónus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((p, idx) => {
                    const isTop3 = idx < 3;
                    const isCurrentUser = p.memberId === data.me.id;
                    return (
                      <tr
                        key={p.memberId}
                        className={[
                          "border-t border-slate-200 transition-colors dark:border-neutral-800",
                          isCurrentUser
                            ? "bg-blue-50 dark:bg-blue-500/10 border-l-4 border-l-blue-500"
                            : isTop3
                            ? "bg-slate-50 dark:bg-neutral-900/60"
                            : "bg-white dark:bg-neutral-950/40 hover:bg-slate-50 dark:hover:bg-neutral-900/60",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3">
                          {isTop3 ? (
                            <span className="text-lg font-bold">
                              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-neutral-400 font-medium">{idx + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={[
                            "font-medium",
                            isCurrentUser ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-neutral-100"
                          ].join(" ")}>
                            {p.displayName}
                            {isCurrentUser && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Þú)</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-lg font-bold text-slate-900 dark:text-neutral-100">{p.points}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-neutral-400 font-medium">{p.correct1x2}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-neutral-400 font-medium">{p.bonusPoints || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

  const started = useMemo(() => new Date(matchStartsAt).getTime() <= Date.now(), [matchStartsAt]);
  const bonusClosed = useMemo(() => new Date(bonus.closes_at).getTime() <= Date.now(), [bonus.closes_at]);
  const locked = started || bonusClosed || matchResult != null;

  const [answerNumber, setAnswerNumber] = useState<string>(
    bonus.my_answer_number != null ? String(bonus.my_answer_number) : ""
  );
  const [answerChoice, setAnswerChoice] = useState<string>(bonus.my_answer_choice || "");

  // ✅ mikilvægt: ef load() kemur með ný gögn, sync-a state
  useEffect(() => {
    setAnswerNumber(bonus.my_answer_number != null ? String(bonus.my_answer_number) : "");
    setAnswerChoice(bonus.my_answer_choice || "");
  }, [bonus.id, bonus.my_answer_number, bonus.my_answer_choice]);

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


    setSaving(true);
    try {
      const payload: any = { questionId: bonus.id };

      if (bonus.type === "number") payload.answerNumber = Number(answerNumber);
      if (bonus.type === "choice") payload.answerChoice = answerChoice;

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

      onSaved?.();
    } catch {
      setLocalErr("Tenging klikkaði.");
    } finally {
      setSaving(false);
    }
  }

  const myAnswerLabel =
    bonus.type === "number" ? bonus.my_answer_number : bonus.my_answer_choice;

  const correctAnswerLabel = bonus.type === "number" ? bonus.correct_number : bonus.correct_choice;

  const isCorrect = locked && myAnswerLabel != null && correctAnswerLabel != null && String(myAnswerLabel) === String(correctAnswerLabel);
  const isWrong = locked && myAnswerLabel != null && correctAnswerLabel != null && !isCorrect;

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
          <span className="text-slate-400 dark:text-neutral-500">·</span>
          <span className="text-slate-500 dark:text-neutral-400">Rétt:</span>
          {correctAnswerLabel != null ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{String(correctAnswerLabel)}</span>
          ) : (
            <span className="text-slate-500">-</span>
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
        <div className="mt-2 text-sm text-neutral-200">
          Þitt svar:{" "}
          <span className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono">
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
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
          />
        )}

        {bonus.type === "choice" && (
          <div className="space-y-2">
            {(bonus.choice_options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
                <input
                  type="radio"
                  name={`bonus_${bonus.id}`}
                  value={opt}
                  checked={answerChoice === opt}
                  onChange={() => setAnswerChoice(opt)}
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


        {localErr && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {localErr}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {saving ? "Vistast..." : "Vista bónus svar"}
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-12 w-12 rounded-xl border-2 text-base font-bold transition-all duration-200 shadow-sm",
        disabled
          ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
          : selected
          ? "border-blue-500 bg-blue-500 text-white shadow-md scale-105 dark:border-blue-400 dark:bg-blue-500 dark:text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md active:scale-95 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-blue-500/20 dark:hover:border-blue-500",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
