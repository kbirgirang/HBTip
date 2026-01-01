"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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

    if (!ownerPassword) return setOwnerError("Owner password vantar");
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
    if (!ownerPassword) return setOwnerError("Owner password vantar");
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

      setOwnerSuccess("Member hefur verið fjarlægður");
      setOwnerPassword("");
      void loadMembers();
    } catch {
      setOwnerError("Tenging klikkaði");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleChangeMemberName(memberId: string) {
    if (!ownerPassword) return setOwnerError("Owner password vantar");
    if (editingMemberName.trim().length < 2) return setOwnerError("Display name þarf að vera amk 2 stafir");

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
        setOwnerError(json.error || "Ekki tókst að breyta display name");
        return;
      }

      setOwnerSuccess("Display name hefur verið breytt");
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
              Owner
            </TabButton>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-6">
          {!data && !err && <p className="text-slate-600 dark:text-neutral-300">Hleð...</p>}

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {data && tab === "matches" && (
            <div className="space-y-3">
              {data.matches.length === 0 ? (
                <p className="text-slate-600 dark:text-neutral-300">Engir leikir komnir inn ennþá (admin setur inn).</p>
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
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold">
                            {m.home_team} vs {m.away_team}{" "}
                            {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            {m.stage ? `${m.stage} · ` : ""}
                            {new Date(m.starts_at).toLocaleString()}
                            {m.match_no != null ? ` · #${m.match_no}` : ""}
                          </div>
                        </div>

                        <div className="flex gap-2">
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
                <h2 className="text-lg font-semibold">Owner stjórnun</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">Stjórna deildinni með owner password.</p>
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
              <div className="rounded-xl border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Breyta join password</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-neutral-400">Breyttu lykilorði sem notendur nota til að skrá sig inná deildina.</p>
                <form onSubmit={handleChangeJoinPassword} className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-700 dark:text-neutral-300">Owner password</label>
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Owner password"
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
              <div className="rounded-xl border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Members</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-neutral-400">Stjórna members í deildinni.</p>

                {loadingMembers ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-neutral-400">Hleð...</p>
                ) : members.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-neutral-400">Engir members fundust.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900/40 p-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-neutral-100">{m.display_name}</span>
                            {m.is_owner && (
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300">Owner</span>
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
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900/20 p-3">
                    <p className="text-xs text-slate-600 dark:text-neutral-400">
                      <strong>Ath:</strong> Til að breyta nafni eða fjarlægja member, þarftu að setja inn owner password fyrst.
                    </p>
                    <input
                      type="password"
                      className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-500"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Owner password"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {data && tab === "leaderboard" && (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-blue-600 text-white dark:bg-neutral-950/60 dark:text-neutral-300">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Nafn</th>
                    <th className="px-3 py-2 text-right">Stig</th>
                    <th className="px-3 py-2 text-right">1X2</th>
                    <th className="px-3 py-2 text-right">Bónus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((p, idx) => (
                    <tr key={p.memberId} className="border-t border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40">
                      <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">{p.displayName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-neutral-100">{p.points}</td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.correct1x2}</td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.bonusPoints || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data && !err && roomCode && <p className="mt-4 text-xs text-neutral-500">Room param: {roomCode}</p>}
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
        "h-10 w-10 rounded-lg border text-sm font-bold transition",
        disabled
          ? "border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600"
          : selected
          ? "border-blue-500 bg-blue-100 text-blue-700 dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
