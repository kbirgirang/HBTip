"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Pick = "1" | "X" | "2";

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
      type: "number" | "player";
      points: number;
      closes_at: string;
      correct_number: number | null;
      correct_player_id: string | null;
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
    const res = await fetch("/api/room/view");
    const json = await res.json();

    if (!res.ok) {
      setErr(json?.error || "Ekki tókst að sækja gögn.");
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

                  async function pick(p: Pick) {
                    if (started) return;

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
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <PickButton selected={m.myPick === "1"} disabled={started} onClick={() => pick("1")}>
                            1
                          </PickButton>

                          {m.allow_draw && (
                            <PickButton selected={m.myPick === "X"} disabled={started} onClick={() => pick("X")}>
                              X
                            </PickButton>
                          )}

                          <PickButton selected={m.myPick === "2"} disabled={started} onClick={() => pick("2")}>
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

                        {started && <span className="text-xs text-neutral-400">(lokað)</span>}
                      </div>

                      {/* ✅ BÓNUS UNDER EACH MATCH */}
                      {m.bonus && (
                        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">Bónus: {m.bonus.title}</div>
                            <div className="text-xs text-neutral-300">
                              +{m.bonus.points} stig · {m.bonus.type === "number" ? "tala" : "leikmaður"}
                            </div>
                          </div>

                          <div className="mt-1 text-xs text-neutral-400">Lokar þegar leikur byrjar.</div>

                          {/* MVP: bara birta. Næst bætum við við input til að svara hér. */}
                          <div className="mt-2 text-xs text-neutral-500">(Svar við bónus kemur næst)</div>
                        </div>
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

          {!data && !err && roomCode && (
            <p className="mt-4 text-xs text-neutral-500">Room param: {roomCode}</p>
          )}
        </div>
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
