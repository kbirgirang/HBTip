"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Pick = "1" | "X" | "2";
type BonusType = "number" | "player" | "choice";

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
      correct_player_id: string | null;

      // choice
      choice_options?: string[] | null;
      correct_choice?: string | null;

      // my existing answer (from DB)
      my_answer_number?: number | null;
      my_answer_player_id?: string | null;
      my_answer_choice?: string | null;
    };
  }>;
  leaderboard: Array<{ memberId: string; displayName: string; points: number; correct1x2: number }>;
};

export default function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ? decodeURIComponent(params.roomCode) : "";

  const [tab, setTab] = useState<"matches" | "leaderboard">("matches");
  const [data, setData] = useState<ViewData | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const header = useMemo(() => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {data.room.name} <span className="text-neutral-400">({data.room.code})</span>
        </h1>
        <p className="text-sm text-neutral-300">
          Skráður inn sem <span className="font-semibold">{data.me.display_name}</span>. Stig per rétt 1X2:{" "}
          <span className="font-semibold">{data.pointsPerCorrect1x2}</span>
        </p>
      </div>
    );
  }, [data]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {header}

        <div className="mt-6 flex gap-2">
          <TabButton active={tab === "matches"} onClick={() => setTab("matches")}>
            Leikir
          </TabButton>
          <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
            Staða
          </TabButton>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
          {!data && !err && <p className="text-neutral-300">Hleð...</p>}

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {data && tab === "matches" && (
            <div className="space-y-3">
              {data.matches.length === 0 ? (
                <p className="text-neutral-300">Engir leikir komnir inn ennþá (admin setur inn).</p>
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
                    <div key={m.id} className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold">
                            {m.home_team} vs {m.away_team}{" "}
                            {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                          </div>
                          <div className="text-xs text-neutral-400">
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

                      <div className="mt-2 text-sm text-neutral-300 flex items-center gap-2 flex-wrap">
                        <span>
                          Úrslit:{" "}
                          <span className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono">
                            {m.result ?? "-"}
                          </span>
                        </span>

                        {m.myPick && (
                          <span className="text-xs text-neutral-400">
                            Þín spá: <span className="font-mono">{m.myPick}</span>
                          </span>
                        )}

                        {locked && <span className="text-xs text-neutral-400">(lokað)</span>}
                      </div>

                      {/* ✅ BÓNUS UNDER EACH MATCH (svar UI) */}
                      {m.bonus && (
                        <BonusAnswerCard bonus={m.bonus} matchStartsAt={m.starts_at} onSaved={() => void load()} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {data && tab === "leaderboard" && (
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-950/60 text-neutral-300">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Nafn</th>
                    <th className="px-3 py-2 text-right">Stig</th>
                    <th className="px-3 py-2 text-right">Rétt 1X2</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((p, idx) => (
                    <tr key={p.memberId} className="border-t border-neutral-800">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{p.displayName}</td>
                      <td className="px-3 py-2 text-right font-semibold">{p.points}</td>
                      <td className="px-3 py-2 text-right">{p.correct1x2}</td>
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
  onSaved,
}: {
  bonus: NonNullable<ViewData["matches"][number]["bonus"]>;
  matchStartsAt: string; // ISO
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const started = useMemo(() => new Date(matchStartsAt).getTime() <= Date.now(), [matchStartsAt]);
  const bonusClosed = useMemo(() => new Date(bonus.closes_at).getTime() <= Date.now(), [bonus.closes_at]);
  const locked = started || bonusClosed;

  const [answerNumber, setAnswerNumber] = useState<string>(
    bonus.my_answer_number != null ? String(bonus.my_answer_number) : ""
  );
  const [answerChoice, setAnswerChoice] = useState<string>(bonus.my_answer_choice || "");
  const [answerPlayerId, setAnswerPlayerId] = useState<string>(bonus.my_answer_player_id || "");

  // ✅ mikilvægt: ef load() kemur með ný gögn, sync-a state
  useEffect(() => {
    setAnswerNumber(bonus.my_answer_number != null ? String(bonus.my_answer_number) : "");
    setAnswerChoice(bonus.my_answer_choice || "");
    setAnswerPlayerId(bonus.my_answer_player_id || "");
  }, [bonus.id, bonus.my_answer_number, bonus.my_answer_choice, bonus.my_answer_player_id]);

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
      if (!answerPlayerId) return setLocalErr("Veldu leikmann.");
      // NOTE: user UI fyrir players er ekki komið hér (þú vantar lista af players í /api/room/view).
    }

    setSaving(true);
    try {
      const payload: any = { questionId: bonus.id };

      if (bonus.type === "number") payload.answerNumber = Number(answerNumber);
      if (bonus.type === "choice") payload.answerChoice = answerChoice;
      if (bonus.type === "player") payload.answerPlayerId = answerPlayerId;

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
    bonus.type === "number"
      ? bonus.my_answer_number
      : bonus.type === "choice"
      ? bonus.my_answer_choice
      : bonus.my_answer_player_id;

  return (
    <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold">Bónus: {bonus.title}</div>
        <div className="text-xs text-neutral-300">
          +{bonus.points} stig · {bonus.type === "number" ? "tala" : bonus.type === "choice" ? "krossa" : "leikmaður"}
        </div>
      </div>

      <div className="mt-1 text-xs text-neutral-400">
        {locked ? "Lokað" : `Lokar: ${new Date(bonus.closes_at).toLocaleString()}`}
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
            disabled={locked}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-60"
          />
        )}

        {bonus.type === "choice" && (
          <div className="space-y-2">
            {(bonus.choice_options || []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name={`bonus_${bonus.id}`}
                  value={opt}
                  checked={answerChoice === opt}
                  onChange={() => setAnswerChoice(opt)}
                  disabled={locked}
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Player-bónus er ekki tengdur players lista í user UI ennþá. (Segðu mér ef þú vilt það næst.)
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
          className="w-full rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
        >
          {locked ? "Bónus lokað" : saving ? "Vistast..." : "Vista bónus svar"}
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
        "rounded-xl px-4 py-2 text-sm font-semibold border",
        active
          ? "border-neutral-200 bg-neutral-100 text-neutral-900"
          : "border-neutral-800 bg-neutral-900/40 text-neutral-200 hover:bg-neutral-900/70",
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
          ? "border-neutral-800 bg-neutral-900 text-neutral-600"
          : selected
          ? "border-emerald-300 bg-emerald-300 text-emerald-950"
          : "border-neutral-600 bg-neutral-100 text-neutral-900 hover:bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
