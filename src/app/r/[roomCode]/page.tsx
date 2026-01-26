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

type RoomData = {
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
    home_score?: number | null;
    away_score?: number | null;
    // ✅ Spár allra meðlima fyrir þennan leik
    memberPicks?: Array<{ memberId: string; displayName: string; pick: Pick }>;

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
  leaderboard: Array<{ memberId: string; displayName: string; username: string; points: number; correct1x2: number; points1x2: number; bonusPoints: number }>;
};

type ViewData = RoomData & {
  allRooms?: RoomData[];
};

export default function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ? decodeURIComponent(params.roomCode) : "";

  const [tab, setTab] = useState<"matches" | "leaderboard" | "owner">("matches");
  const [data, setData] = useState<ViewData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Owner management state
  const [selectedOwnerRoomCode, setSelectedOwnerRoomCode] = useState<string>("");
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

  // State fyrir hvaða leikjum eru með sýndum bónus
  const [showBonusForMatch, setShowBonusForMatch] = useState<Set<string>>(new Set());

  // State fyrir valinn meðlim til að skoða spár (fyrir popup í leaderboard)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // State fyrir valið lið til að sýna leiki
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // State fyrir info popup
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  // State fyrir milliriðilastöðu
  const [showIntermediateStandings, setShowIntermediateStandings] = useState(false);
  const [intermediateStandings, setIntermediateStandings] = useState<{
    [key: number]: Array<{
      team: string;
      gp: number;
      win: number;
      draw: number;
      lose: number;
      dp: number;
      points: number;
    }>;
  } | null>(null);
  const [loadingIntermediateStandings, setLoadingIntermediateStandings] = useState(false);

  /**
   * Sækir milliriðilastöðu
   */
  async function loadIntermediateStandings() {
    setLoadingIntermediateStandings(true);
    try {
      const res = await fetch("/api/intermediate-round-standings");
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Ekki tókst að sækja milliriðilastöðu.");
        return;
      }
      setIntermediateStandings(json.standings || null);
    } catch {
      setErr("Tenging klikkaði.");
    } finally {
      setLoadingIntermediateStandings(false);
    }
  }

  /**
   * Opnar milliriðilastöðu modal og sækir gögn
   */
  function openIntermediateStandings() {
    setShowIntermediateStandings(true);
    if (!intermediateStandings) {
      loadIntermediateStandings();
    }
  }

  // Theme toggle state
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

  // Push notifications setup
  useEffect(() => {
    async function setupPushNotifications() {
      // Bíða eftir að notandinn sé skráður inn
      if (!mounted || !data) {
        return;
      }

      // Athuga hvort Service Worker og Push Manager séu studdir
      if (!("serviceWorker" in navigator)) {
        console.log("Service Worker er ekki studdur í þessum vafra");
        return;
      }

      // Athuga hvort Notification API sé aðgengilegt
      if (!("Notification" in window)) {
        console.warn("Notification API er ekki aðgengilegt");
        return;
      }

      // Athuga hvort PushManager sé aðgengilegt
      if (!("PushManager" in window)) {
        console.log("Push Manager er ekki studdur í þessum vafra");
        // Safari á iOS þarft iOS 16.4+ og PWA (standalone mode)
        if (navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")) {
          const nav = navigator as any;
          const win = window as any;
          let isStandalone = nav.standalone || false;
          if (!isStandalone && win.matchMedia) {
            try {
              isStandalone = win.matchMedia("(display-mode: standalone)").matches;
            } catch (e) {
              // Ignore
            }
          }
          if (!isStandalone) {
            console.warn("Safari á iOS þarft að nota Progressive Web App (PWA) - bættu við Home Screen og opna sem PWA");
          } else {
            console.warn("Notar PWA en Push Manager er ekki aðgengilegt - iOS version kannski of gamall eða eitthvað annað");
          }
        }
        return;
      }

      try {
        // Register Service Worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered:", registration);

        // Athuga hvort subscription sé þegar til staðar
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log("Push subscription er þegar til staðar, prófa að vista aftur");
          // Prófa að vista aftur í gagnagrunninum
          const res = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: existingSubscription.toJSON() }),
          });

          if (res.ok) {
            console.log("Push subscription vistað aftur");
          } else {
            const error = await res.json().catch(() => ({}));
            console.error("Failed to save push subscription:", error);
          }
          return;
        }

        // Request push subscription
        // Athuga fyrst hvort leyfi sé þegar gefið
        let permission = Notification.permission;
        console.log("Current notification permission:", permission);
        
        if (permission === "default") {
          // Ekki ennþá spurt um leyfi
          console.log("Requesting notification permission...");
          permission = await Notification.requestPermission();
          console.log("Permission result:", permission);
        }
        
        if (permission !== "granted") {
          console.warn("Notification permission denied or not granted:", permission);
          if (permission === "denied") {
            console.warn("Notification permission er bönnuð - notandinn þarf að leyfa það í stillingum");
          }
          return;
        }

        // Get VAPID public key from API
        const keyRes = await fetch("/api/push/vapid-key");
        if (!keyRes.ok) {
          console.error("Failed to get VAPID public key");
          return;
        }
        const keyData = await keyRes.json().catch(() => ({}));
        const vapidPublicKey = keyData.publicKey;
        if (!vapidPublicKey) {
          console.warn("VAPID public key not set");
          return;
        }

        // Convert VAPID key to Uint8Array
        function urlBase64ToUint8Array(base64String: string): Uint8Array {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        }

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
        });

        console.log("Push subscription created:", subscription.endpoint);

        // Save subscription to server
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        if (res.ok) {
          console.log("Push subscription saved successfully");
        } else {
          const error = await res.json().catch(() => ({}));
          console.error("Failed to save push subscription:", error);
        }
      } catch (error) {
        console.error("Push notification setup error:", error);
      }
    }

    // Bíða eftir að notandinn sé skráður inn (data er til staðar)
    if (mounted && data) {
      setupPushNotifications();
    }
  }, [mounted, data]);

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

  /** Létt sókn á stigatöflum – uppfærir bara leaderboard, ekki alla view. */
  async function loadLeaderboard() {
    const res = await fetch("/api/room/leaderboard", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const lb = json as { allRooms?: Array<{ room: { code: string }; leaderboard: RoomData["leaderboard"] }> };
    if (!Array.isArray(lb.allRooms)) return;
    setData((prev) => {
      if (!prev) return prev;
      const allRooms = prev.allRooms || [prev];
      const updated = allRooms.map((r) => {
        const from = lb.allRooms!.find((x) => x.room.code === r.room.code);
        return from ? { ...r, leaderboard: from.leaderboard } : r;
      });
      return { ...prev, allRooms: updated };
    });
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab !== "leaderboard") return;
    void loadLeaderboard();
    const interval = setInterval(() => void loadLeaderboard(), 5000);
    return () => clearInterval(interval);
  }, [tab]);

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

  async function switchRoom(roomData: RoomData) {
    try {
      const res = await fetch("/api/room/select-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: roomData.me.id }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Ekki tókst að skipta deild");
        return;
      }

      // Endurhlaða síðu með nýrri deild
      window.location.href = `/r/${encodeURIComponent(roomData.room.code)}`;
    } catch {
      alert("Tenging klikkaði. Prófaðu aftur.");
    }
  }

  async function loadMembers() {
    if (!data?.me.is_owner || !selectedOwnerRoomCode) return;
    
    // Finna memberId fyrir valda deild
    const allRooms = data.allRooms || [data];
    const selectedRoom = allRooms.find((r) => r.room.code === selectedOwnerRoomCode);
    if (!selectedRoom || !selectedRoom.me.is_owner) {
      setOwnerError("Ekki stjórnandi í þessari deild");
      return;
    }

    setLoadingMembers(true);
    setOwnerError(null);
    try {
      // Nota /api/room/select-room til að skipta yfir í valda deild
      const switchRes = await fetch("/api/room/select-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedRoom.me.id }),
      });
      
      if (!switchRes.ok) {
        const switchJson = await switchRes.json().catch(() => ({}));
        setOwnerError(switchJson.error || "Ekki tókst að skipta deild");
        return;
      }

      // Sækja members fyrir valda deild
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

  // Set default selected room when data loads
  useEffect(() => {
    if (data && tab === "owner") {
      const allRooms = data.allRooms || [data];
      const ownerRooms = allRooms.filter((r) => r.me.is_owner);
      if (ownerRooms.length > 0 && !selectedOwnerRoomCode) {
        // Set first owner room as default
        setSelectedOwnerRoomCode(ownerRooms[0].room.code);
      }
    }
  }, [data, tab]);

  useEffect(() => {
    if (tab === "owner" && data?.me.is_owner && selectedOwnerRoomCode) {
      void loadMembers();
    }
  }, [tab, data?.me.is_owner, selectedOwnerRoomCode]);

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
    if (newMemberPassword.length < 6) return setOwnerError("Nýtt lykilorð þarf að vera amk 6 stafir");

    setOwnerError(null);
    setOwnerSuccess(null);
    setChangingMemberPassword(true);

    try {
      const res = await fetch("/api/room/owner/change-member-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, newPassword: newMemberPassword }),
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

  // Helper function to get date string (YYYY-MM-DD) from match
  const getMatchDate = (startsAt: string): string => {
    const date = new Date(startsAt);
    return date.toISOString().split('T')[0];
  };

  // Helper function to format date in Icelandic
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today, tomorrow, or yesterday
    const dateOnly = date.toDateString();
    const todayOnly = today.toDateString();
    const tomorrowOnly = tomorrow.toDateString();
    const yesterdayOnly = yesterday.toDateString();

    if (dateOnly === todayOnly) {
      return "Í dag";
    } else if (dateOnly === tomorrowOnly) {
      return "Á morgun";
    } else if (dateOnly === yesterdayOnly) {
      return "Í gær";
    } else {
      // Format as "dd. MMMM yyyy" in Icelandic
      return date.toLocaleDateString('is-IS', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  };

  const header = useMemo(() => {
    if (!data) return null;
    const allRooms = data.allRooms || [data];
    const isInMultipleRooms = allRooms.length > 1;
    
    return (
      <div className="flex flex-col gap-1">
        <div className="mb-1 mt-1 flex items-center justify-between gap-2">
          <img 
            src="/Bet-logo-0126.svg" 
            alt="Betlihem" 
            className="h-16 w-auto dark:invert"
          />
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
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1 md:gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 md:px-4 md:py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:border-neutral-500"
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            <span className="font-semibold">{data.me.display_name}</span>{" "}
            <span className="font-mono">(@{data.me.username})</span>
            {allRooms.length > 1 && (
              <> · <span className="font-semibold">{allRooms.length}</span> deildir</>
            )}
          </p>
          {/* {isInMultipleRooms && (
            <select
              value={data.room.code}
              onChange={(e) => {
                const selectedRoom = allRooms.find((r) => r.room.code === e.target.value);
                if (selectedRoom) {
                  switchRoom(selectedRoom);
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:border-neutral-500 dark:focus:ring-blue-400"
            >
              {allRooms.map((room) => (
                <option key={room.room.code} value={room.room.code}>
                  {room.room.name} ({room.room.code})
                </option>
              ))}
            </select>
          )} */}
        </div>
      </div>
    );
  }, [data, mounted, theme]);

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
          {(() => {
            const allRooms = data?.allRooms || (data ? [data] : []);
            const hasOwnerRoom = allRooms.some((r) => r.me.is_owner);
            return hasOwnerRoom ? (
              <TabButton active={tab === "owner"} onClick={() => setTab("owner")}>
                Stjórnandi
              </TabButton>
            ) : null;
          })()}

          <button
            onClick={openIntermediateStandings}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            title="Milliriðilar"
          >
            Milliriðilar
          </button>
          <button
            onClick={() => setShowInfoPopup(true)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            title="Upplýsingar"
          >
            ℹ️
          </button>
        </div>

        {/* Info Popup */}
        {showInfoPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInfoPopup(false)}>
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Leyfa tilkynningar</h3>
                <button
                  onClick={() => setShowInfoPopup(false)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4 text-sm text-slate-600 dark:text-neutral-300">
                <div>
                  <p className="font-semibold mb-2">iPhone</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Safari → opna betlihem.com → ýtta á Share → More → Add to Home Screen</li>
                    <li>Opna Betlihem appið → skrá sig inn</li>
                    <li>Þá ætti að koma upp gluggi til að samþykkja tilkynningar (notifications) 🔔</li>
                  </ul>
                </div>
                <div className="border-t border-slate-200 pt-4 dark:border-neutral-700">
                  <p className="font-semibold mb-2">Android</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Opna síðuna í Chrome á Android</li>
                    <li>Samþykkja notification permission þegar beðið er um það.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Milliriðilastöða Modal */}
        {showIntermediateStandings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowIntermediateStandings(false)}>
            <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 p-6 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">Milliriðilar</h3>
                <button
                  onClick={() => setShowIntermediateStandings(false)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-6">
                {loadingIntermediateStandings ? (
                  <p className="text-center text-slate-600 dark:text-neutral-400">Hleð...</p>
                ) : !intermediateStandings || (Object.keys(intermediateStandings).length === 0) ? (
                  <p className="text-center text-slate-600 dark:text-neutral-400">Engin milliriðilastöða tiltæk.</p>
                ) : (
                  <>
                    {/* Milliriðil 1 */}
                    {intermediateStandings[1] && intermediateStandings[1].length > 0 && (
                      <div>
                        <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-neutral-100">Milliriðill 1</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-neutral-300">Lið</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Leikir</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Sigur</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Jafntefla</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Tap</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">+/-</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Stig</th>
                              </tr>
                            </thead>
                            <tbody>
                              {intermediateStandings[1].map((team, index) => {
                                const isIceland = team.team === "Ísland" || team.team === "Iceland";
                                return (
                                  <tr 
                                    key={index} 
                                    className={`border-b ${
                                      isIceland 
                                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" 
                                        : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/50"
                                    }`}
                                  >
                                    <td className={`px-4 py-3 text-sm font-medium ${
                                      isIceland 
                                        ? "text-blue-900 dark:text-blue-100 font-bold" 
                                        : "text-slate-900 dark:text-neutral-100"
                                    }`}>
                                      {getTeamFlag(team.team) && <span className="mr-2">{getTeamFlag(team.team)}</span>}
                                      {team.team}
                                    </td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.gp}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.win}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.draw}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.lose}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.dp > 0 ? `+${team.dp}` : team.dp}</td>
                                    <td className={`px-4 py-3 text-center text-sm font-semibold ${
                                      isIceland 
                                        ? "text-blue-900 dark:text-blue-100" 
                                        : "text-slate-900 dark:text-neutral-100"
                                    }`}>{team.points}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Milliriðil 2 */}
                    {intermediateStandings[2] && intermediateStandings[2].length > 0 && (
                      <div>
                        <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-neutral-100">Milliriðill 2</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800">
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-neutral-300">Lið</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Leikir</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Sigur</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Jafntefla</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Tap</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">+/-</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-neutral-300">Stig</th>
                              </tr>
                            </thead>
                            <tbody>
                              {intermediateStandings[2].map((team, index) => {
                                const isIceland = team.team === "Ísland" || team.team === "Iceland";
                                return (
                                  <tr 
                                    key={index} 
                                    className={`border-b ${
                                      isIceland 
                                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" 
                                        : "border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/50"
                                    }`}
                                  >
                                    <td className={`px-4 py-3 text-sm font-medium ${
                                      isIceland 
                                        ? "text-blue-900 dark:text-blue-100 font-bold" 
                                        : "text-slate-900 dark:text-neutral-100"
                                    }`}>
                                      {getTeamFlag(team.team) && <span className="mr-2">{getTeamFlag(team.team)}</span>}
                                      {team.team}
                                    </td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.gp}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.win}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.draw}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.lose}</td>
                                    <td className={`px-4 py-3 text-center text-sm ${
                                      isIceland 
                                        ? "text-blue-800 dark:text-blue-200" 
                                        : "text-slate-700 dark:text-neutral-300"
                                    }`}>{team.dp > 0 ? `+${team.dp}` : team.dp}</td>
                                    <td className={`px-4 py-3 text-center text-sm font-semibold ${
                                      isIceland 
                                        ? "text-blue-900 dark:text-blue-100" 
                                        : "text-slate-900 dark:text-neutral-100"
                                    }`}>{team.points}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900/40 p-3 md:mt-4 md:p-4">
          {!data && !err && <p className="text-slate-600 dark:text-neutral-300">Hleð...</p>}

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          )}

          {data && tab === "matches" && (
            <div className="space-y-6">
              {(() => {
                const allRooms = data.allRooms || [data];
                // Sameina allar leikir úr öllum deildum (unique by match id)
                const allMatchesMap = new Map<string, typeof data.matches[0]>();
                for (const roomData of allRooms) {
                  for (const match of roomData.matches) {
                    // Nota fyrsta myPick sem finnst (sama fyrir allar deildir)
                    if (!allMatchesMap.has(match.id)) {
                      allMatchesMap.set(match.id, match);
                    } else {
                      // Ef match er þegar til, uppfæra myPick og bonus my_answer ef þau eru til
                      const existing = allMatchesMap.get(match.id)!;
                      // ✅ Mikilvægt: Uppfæra myPick ef hann finnst í þessari deild (jafnvel ef hann var null áður)
                      if (match.myPick) {
                        existing.myPick = match.myPick;
                      }
                      // Uppfæra bonus my_answer ef það er til í þessari deild
                      if (match.bonus && existing.bonus) {
                        if (match.bonus.my_answer_choice && !existing.bonus.my_answer_choice) {
                          existing.bonus.my_answer_choice = match.bonus.my_answer_choice;
                        }
                        if (match.bonus.my_answer_number != null && existing.bonus.my_answer_number == null) {
                          existing.bonus.my_answer_number = match.bonus.my_answer_number;
                        }
                        if (match.bonus.my_answer_player_name && !existing.bonus.my_answer_player_name) {
                          existing.bonus.my_answer_player_name = match.bonus.my_answer_player_name;
                        }
                      }
                    }
                  }
                }
                const allMatches = Array.from(allMatchesMap.values());
                
                if (allMatches.length === 0) {
                  return <p className="text-slate-600 dark:text-neutral-300">Engir leikir komnir inn ennþá (admin setur inn).</p>;
                }

                // Komandi leikir: allir leikir sem ekki hafa niðurstöðu (sama hvort byrjaðir eða ekki)
                const upcomingMatches = allMatches.filter((m) => m.result == null);
                // Eldri leikir: allir leikir sem hafa niðurstöðu
                const finishedMatches = allMatches.filter((m) => m.result != null);

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
                            {(() => {
                              // Group finished matches by date
                              const matchesByDate = new Map<string, Array<typeof finishedMatches[0]>>();
                              for (const m of finishedMatches) {
                                const dateKey = getMatchDate(m.starts_at);
                                if (!matchesByDate.has(dateKey)) {
                                  matchesByDate.set(dateKey, []);
                                }
                                matchesByDate.get(dateKey)!.push(m);
                              }
                              
                              // Sort dates (newest first for finished matches)
                              const sortedDates = Array.from(matchesByDate.keys()).sort((a, b) => b.localeCompare(a));
                              
                              return sortedDates.flatMap((dateKey, dateIndex) => {
                                const matchesForDate = matchesByDate.get(dateKey)!;
                                const isLastDate = dateIndex === sortedDates.length - 1;
                                return [
                                  // Date header
                                  <div key={`date-${dateKey}`} className="mt-4 mb-2 first:mt-0">
                                    <div className="flex items-center gap-2">
                                      <div className="h-px flex-1 bg-slate-300 dark:bg-neutral-700"></div>
                                      <span className="text-sm font-semibold text-slate-600 dark:text-neutral-400 px-2">
                                        {formatDate(dateKey)}
                                      </span>
                                      <div className="h-px flex-1 bg-slate-300 dark:bg-neutral-700"></div>
                                    </div>
                                  </div>,
                                  // Matches for this date
                                  ...matchesForDate.map((m) => {
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

                    // Uppfæra allar deildir með nýrri spá
                    setData((prev) => {
                      if (!prev) return prev;
                      const allRooms = prev.allRooms || [prev];
                      return {
                        ...prev,
                        matches: prev.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                        allRooms: allRooms.map((room) => ({
                          ...room,
                          matches: room.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                        })),
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
                                        <button
                                          onClick={() => setSelectedTeam(m.home_team)}
                                          className="hover:underline cursor-pointer"
                                        >
                                          <span>{m.home_team}</span>{" "}
                                          {getTeamFlag(m.home_team) && <span>{getTeamFlag(m.home_team)}</span>}
                                        </button>
                                        <span className="inline-flex items-center gap-1 mx-2">
                                          vs
                                        </span>
                                        <button
                                          onClick={() => setSelectedTeam(m.away_team)}
                                          className="hover:underline cursor-pointer"
                                        >
                                          {getTeamFlag(m.away_team) && <span>{getTeamFlag(m.away_team)}</span>}{" "}
                                          <span>{m.away_team}</span>
                                        </button>
                                        {" "}
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

                      {m.home_score != null && m.away_score != null && (
                        <div className="mt-2 text-center">
                          <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                            Lokastaða:{" "}
                            <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                              {m.home_team} {m.home_score} - {m.away_score} {m.away_team}
                            </span>
                          </span>
                        </div>
                      )}

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
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => toggleBonus(m.id)}
                              className="relative rounded-lg border-2 border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 min-w-[140px]"
                            >
                              <span className="flex items-center justify-center gap-1.5">
                                {(() => {
                                  const myAnswer = 
                                    m.bonus.type === "number" ? m.bonus.my_answer_number : 
                                    m.bonus.type === "choice" ? m.bonus.my_answer_choice : 
                                    m.bonus.type === "player" ? m.bonus.my_answer_player_name : null;
                                  const hasAnswer = myAnswer != null && myAnswer !== "";
                                  return (
                                    <>
                                      {hasAnswer && <span className="text-base">✓</span>}
                                      {showBonusForMatch.has(m.id) ? "Fela bónus" : "Bónus Spurning"}
                                    </>
                                  );
                                })()}
                              </span>
                            </button>
                            {(() => {
                              const myAnswer = 
                                m.bonus.type === "number" ? m.bonus.my_answer_number : 
                                m.bonus.type === "choice" ? m.bonus.my_answer_choice : 
                                m.bonus.type === "player" ? m.bonus.my_answer_player_name : null;
                              
                              if (myAnswer != null && myAnswer !== "") {
                                return (
                                  <span className="text-sm text-slate-600 dark:text-neutral-300">
                                    Þitt svar: <span className="font-semibold text-slate-900 dark:text-neutral-100">{String(myAnswer)}</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
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
                                  }),
                                  // Advertisement slot every 4th match day (indices: 0, 4, 8...)
                                  dateIndex % 4 === 0 && (
                                    <div 
                                      key={`ad-${dateKey}`}
                                      className="my-4"
                                    >
                                      <a 
                                        href="https://rafganistan.is" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block w-full"
                                      >
                                        <img 
                                          src="/Rafgan_Augl.png" 
                                          alt="Rafganistan auglýsing" 
                                          className="w-full h-auto object-contain rounded-lg"
                                        />
                                      </a>
                                    </div>
                                  )
                                ].filter(Boolean);
                              });
                            })()}
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
                            {(() => {
                              // Group upcoming matches by date
                              const matchesByDate = new Map<string, Array<typeof upcomingMatches[0]>>();
                              for (const m of upcomingMatches) {
                                const dateKey = getMatchDate(m.starts_at);
                                if (!matchesByDate.has(dateKey)) {
                                  matchesByDate.set(dateKey, []);
                                }
                                matchesByDate.get(dateKey)!.push(m);
                              }
                              
                              // Sort dates (oldest first for upcoming matches)
                              const sortedDates = Array.from(matchesByDate.keys()).sort((a, b) => a.localeCompare(b));
                              
                              return sortedDates.flatMap((dateKey, dateIndex) => {
                                const matchesForDate = matchesByDate.get(dateKey)!;
                                const isLastDate = dateIndex === sortedDates.length - 1;
                                return [
                                  // Date header
                                  <div key={`date-${dateKey}`} className="mt-4 mb-2 first:mt-0">
                                    <div className="flex items-center gap-2">
                                      <div className="h-px flex-1 bg-slate-300 dark:bg-neutral-700"></div>
                                      <span className="text-sm font-semibold text-slate-600 dark:text-neutral-400 px-2">
                                        {formatDate(dateKey)}
                                      </span>
                                      <div className="h-px flex-1 bg-slate-300 dark:bg-neutral-700"></div>
                                    </div>
                                  </div>,
                                  // Matches for this date
                                  ...matchesForDate.map((m) => {
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

                                // Uppfæra allar deildir með nýrri spá
                                setData((prev) => {
                                  if (!prev) return prev;
                                  const allRooms = prev.allRooms || [prev];
                                  return {
                                    ...prev,
                                    matches: prev.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                                    allRooms: allRooms.map((room) => ({
                                      ...room,
                                      matches: room.matches.map((x) => (x.id === m.id ? { ...x, myPick: p } : x)),
                                    })),
                                  };
                                });
                              }

                              const isIceland = isIcelandPlaying(m.home_team, m.away_team);
                              
                              // Athuga hvort Ísland sé heimalið (1) eða útilið (2)
                              const icelandIsHome = m.home_team === "Ísland" || m.home_team === "Iceland";
                              const icelandIsAway = m.away_team === "Ísland" || m.away_team === "Iceland";
                              
                              // Athuga hvort notandi valdi eitthvað annað en Ísland
                              const isTraitor = isIceland && m.myPick && (
                                (icelandIsHome && m.myPick !== "1") || 
                                (icelandIsAway && m.myPick !== "2")
                              );
                              
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
                                        <button
                                          onClick={() => setSelectedTeam(m.home_team)}
                                          className="hover:underline cursor-pointer"
                                        >
                                          <span>{m.home_team}</span>{" "}
                                          {getTeamFlag(m.home_team) && <span>{getTeamFlag(m.home_team)}</span>}
                                        </button>
                                        <span className="inline-flex items-center gap-1 mx-2">
                                          vs
                                        </span>
                                        <button
                                          onClick={() => setSelectedTeam(m.away_team)}
                                          className="hover:underline cursor-pointer"
                                        >
                                          {getTeamFlag(m.away_team) && <span>{getTeamFlag(m.away_team)}</span>}{" "}
                                          <span>{m.away_team}</span>
                                        </button>
                                        {" "}
                                        {!m.allow_draw && <span className="ml-2 text-xs text-amber-200">X óvirkt</span>}
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-2">
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
                                      
                                      {isTraitor && (
                                        <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                                          Svikari!!
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {m.home_score != null && m.away_score != null && (
                                    <div className="mt-2 text-center">
                                      <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                                        Lokastaða:{" "}
                                        <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                          {m.home_team} {m.home_score} - {m.away_score} {m.away_team}
                                        </span>
                                      </span>
                                    </div>
                                  )}

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
                                      <div className="mt-3 flex items-center gap-3">
                                        <button
                                          onClick={() => toggleBonus(m.id)}
                                          className="relative rounded-lg border-2 border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 min-w-[140px]"
                                        >
                                          <span className="flex items-center justify-center gap-1.5">
                                            {(() => {
                                              const myAnswer = 
                                                m.bonus.type === "number" ? m.bonus.my_answer_number : 
                                                m.bonus.type === "choice" ? m.bonus.my_answer_choice : 
                                                m.bonus.type === "player" ? m.bonus.my_answer_player_name : null;
                                              const hasAnswer = myAnswer != null && myAnswer !== "";
                                              return (
                                                <>
                                                  {hasAnswer && <span className="text-base">✓</span>}
                                                  {showBonusForMatch.has(m.id) ? "Fela bónus" : "Bónus Spurning"}
                                                </>
                                              );
                                            })()}
                                          </span>
                                        </button>
                                        {(() => {
                                          const myAnswer = 
                                            m.bonus.type === "number" ? m.bonus.my_answer_number : 
                                            m.bonus.type === "choice" ? m.bonus.my_answer_choice : 
                                            m.bonus.type === "player" ? m.bonus.my_answer_player_name : null;
                                          
                                          if (myAnswer != null && myAnswer !== "") {
                                            return (
                                              <span className="text-sm text-slate-600 dark:text-neutral-300">
                                                Þitt svar: <span className="font-semibold text-slate-900 dark:text-neutral-100">{String(myAnswer)}</span>
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
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
                                  }),
                                  // Advertisement slot every 4th match day (indices: 0, 4, 8...)
                                  dateIndex % 4 === 0 && (
                                    <div 
                                      key={`ad-${dateKey}`}
                                      className="my-4"
                                    >
                                      <a 
                                        href="https://rafganistan.is" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block w-full"
                                      >
                                        <img 
                                          src="/Rafgan_Augl.png" 
                                          alt="Rafganistan auglýsing" 
                                          className="w-full h-auto object-contain rounded-lg"
                                        />
                                      </a>
                                    </div>
                                  )
                                ].filter(Boolean);
                              });
                            })()}
                          </div>
                        </div>
                      )}
                  </>
                );
              })()}
            </div>
          )}

          {data && tab === "owner" && (() => {
            const allRooms = data.allRooms || [data];
            const ownerRooms = allRooms.filter((r) => r.me.is_owner);
            
            if (ownerRooms.length === 0) {
              return (
                <div className="space-y-6">
                  <p className="text-slate-600 dark:text-neutral-400">Þú ert ekki stjórnandi í neinni deild.</p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Stjórnandi stjórnun</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">Stjórna deildinni með lykilorði stjórnanda.</p>
                </div>

                {/* Deild val */}
                <div className="rounded-xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/40 p-4">
                  <label className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Veldu deild</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
                    value={selectedOwnerRoomCode}
                    onChange={(e) => {
                      setSelectedOwnerRoomCode(e.target.value);
                      setMembers([]); // Hreinsa members þegar deild er skipt
                      setOwnerError(null);
                      setOwnerSuccess(null);
                    }}
                  >
                    {ownerRooms
                      .sort((a, b) => a.room.name.localeCompare(b.room.name, 'is'))
                      .map((roomData) => (
                        <option key={roomData.room.code} value={roomData.room.code}>
                          {roomData.room.name} ({roomData.room.code})
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-500">
                    Veldu deild sem þú vilt stjórna
                  </p>
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
            );
          })()}

          {data && tab === "leaderboard" && (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  Stigatöflur uppfærast sjálfkrafa á 5 sekúndum fresti.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Uppfæra
                </button>
              </div>
              {(() => {
                const allRooms = data.allRooms || [data];
                // Raða deildum eftir stafrófsröð (eftir nafni)
                const sortedRooms = [...allRooms].sort((a, b) => 
                  a.room.name.localeCompare(b.room.name, 'is')
                );
                return sortedRooms.map((roomData) => (
                  <div key={roomData.room.code} className="mb-8 space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                      {roomData.room.name} <span className="text-sm font-normal text-slate-500 dark:text-neutral-400">({roomData.room.code})</span>
                      {roomData.me.is_owner && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                          Stjórnandi
                        </span>
                      )}
                    </h2>
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
                          {roomData.leaderboard.map((p, idx) => {
                            const rank = idx + 1;
                            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                            const isMe = p.memberId === roomData.me.id;
                            return (
                              <tr 
                                key={p.memberId} 
                                className={`border-t cursor-pointer transition-colors ${
                                  isMe
                                    ? "border-l-4 border-l-blue-500 border-t-slate-200 bg-blue-50/50 hover:bg-blue-50/70 dark:border-l-blue-400 dark:border-t-neutral-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:bg-neutral-900/60"
                                }`}
                                onClick={() => setSelectedMemberId(p.memberId)}
                              >
                                <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">
                                  {medal ? <span className="mr-1">{medal}</span> : null}
                                  {rank}
                                </td>
                                <td className="px-3 py-2 text-slate-900 dark:text-neutral-100">
                                  {p.displayName}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-neutral-100">{p.points}</td>
                                <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.points1x2 || 0}</td>
                                <td className="px-3 py-2 text-right text-slate-600 dark:text-neutral-400">{p.bonusPoints || 0}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="space-y-2 md:hidden">
                      {roomData.leaderboard.map((p, idx) => {
                        const rank = idx + 1;
                        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                        const isMe = p.memberId === roomData.me.id;
                        return (
                          <div
                            key={p.memberId}
                            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                              isMe
                                ? "border-l-4 border-l-blue-500 border-r border-t border-b border-slate-200 bg-blue-50/50 hover:bg-blue-50/70 dark:border-l-blue-400 dark:border-r dark:border-t dark:border-b dark:border-neutral-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                                : "border-slate-200 bg-white hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:bg-neutral-900/60"
                            }`}
                            onClick={() => setSelectedMemberId(p.memberId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold text-slate-900 dark:text-neutral-100">
                                  {medal ? <span className="mr-1">{medal}</span> : null}
                                  {rank}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-neutral-100">
                                  {p.displayName}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-slate-900 dark:text-neutral-100">{p.points}</div>
                                <div className="text-xs text-slate-500 dark:text-neutral-400">stig</div>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xs dark:border-neutral-800">
                              <div>
                                <span className="text-slate-500 dark:text-neutral-400">1X2:</span>{" "}
                                <span className="font-medium text-slate-700 dark:text-neutral-300">{p.points1x2 || 0}</span>
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
                  </div>
                ));
              })()}
            </>
          )}

          {!data && !err && roomCode && <p className="mt-4 text-xs text-slate-500 dark:text-neutral-500">Deild param: {roomCode}</p>}
        </div>
      </div>

      {/* Popup modal fyrir spár meðlims */}
      {data && selectedMemberId && (() => {
        const allRooms = data.allRooms || [data];
        const selectedRoomData = allRooms.find((r) => 
          r.leaderboard.some((l) => l.memberId === selectedMemberId)
        );
        
        if (!selectedRoomData) return null;
        
        return (
          <MemberPicksModal 
            memberId={selectedMemberId} 
            roomData={selectedRoomData} 
            now={now}
            onClose={() => setSelectedMemberId(null)}
          />
        );
      })()}

      {/* Popup modal fyrir leiki valins liðs */}
      {data && selectedTeam && (
        <TeamMatchesModal
          teamName={selectedTeam}
          allRooms={data.allRooms || [data]}
          now={now}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </main>
  );
}

/* -----------------------------
   MEMBER PICKS MODAL COMPONENT
----------------------------- */

function MemberPicksModal({ 
  memberId, 
  roomData,
  now,
  onClose
}: { 
  memberId: string; 
  roomData: RoomData;
  now: number;
  onClose: () => void;
}) {
  // Finna síðustu 8 lokaðu leikina - aðeins leiki sem eru með result EÐA hafa byrjað
  // Tryggja að leikir sem eru í gangi séu alltaf með
  const allClosedMatches = roomData.matches.filter((match) => {
    const matchStarted = new Date(match.starts_at).getTime() <= now;
    return match.result != null || matchStarted; // Aðeins leiki sem eru með úrslit eða hafa byrjað
  });

  // Aðskilja leiki sem eru í gangi og loknir
  const inProgressMatches = allClosedMatches
    .filter((match) => {
      const matchStarted = new Date(match.starts_at).getTime() <= now;
      return matchStarted && match.result == null; // Í gangi = hefur byrjað en engin úrslit
    })
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()); // Nýjast fyrst

  const finishedMatchesWithResults = allClosedMatches
    .filter((match) => match.result != null) // Loknir leikir með úrslit
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()); // Nýjast fyrst

  // Kombina: Fyrst leikir í gangi, síðan loknir leikir - hámark 8 samtals
  const finishedMatches = [
    ...inProgressMatches,
    ...finishedMatchesWithResults
  ].slice(0, 8);

  // Finna spár valins meðlims í þessum leikjum - sýna ALLA lokaða leiki
  const matchesWithPicks = finishedMatches.map((match) => {
    const memberPicks = match.memberPicks || [];
    const memberPick = memberPicks.find((mp) => mp.memberId === memberId);
    const matchStarted = new Date(match.starts_at).getTime() <= now;
    const isFinished = match.result != null;
    const isInProgress = matchStarted && !isFinished;
    
    
    return {
      ...match,
      pick: memberPick?.pick ?? null,
      isFinished,
      isInProgress,
    };
  });

  const member = roomData.leaderboard.find(l => l.memberId === memberId);

  // Click outside to close
  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">
            Spár {member?.displayName}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Loka"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {matchesWithPicks.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-neutral-400">
              Engir lokaðir leikir fundust
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600 dark:text-neutral-400">
                Hér eru síðustu 8 leikir
              </p>
              <div className="space-y-3">
              {matchesWithPicks.map((match) => (
                <div
                  key={match.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                      {match.home_team} vs {match.away_team}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      match.isFinished 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {match.isFinished ? "Leik lokið" : "Leikur í gangi"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-neutral-400">
                    <span>
                      Úrslit: <span className="font-mono font-semibold">{match.result ?? "-"}</span>
                    </span>
                    {match.pick && (
                      <span>
                        Spá:{" "}
                        <span
                          className={[
                            "font-mono px-2 py-1 rounded font-semibold",
                            match.result != null
                              ? match.pick === match.result
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-slate-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400",
                          ].join(" ")}
                        >
                          {match.pick}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   TEAM MATCHES MODAL COMPONENT
----------------------------- */

function TeamMatchesModal({
  teamName,
  allRooms,
  now,
  onClose
}: {
  teamName: string;
  allRooms: RoomData[];
  now: number;
  onClose: () => void;
}) {
  // Sameina allar leikir úr öllum deildum (unique by match id)
  const allMatchesMap = new Map<string, typeof allRooms[0]["matches"][0]>();
  for (const roomData of allRooms) {
    for (const match of roomData.matches) {
      if (!allMatchesMap.has(match.id)) {
        allMatchesMap.set(match.id, match);
      }
    }
  }
  const allMatches = Array.from(allMatchesMap.values());

  // Finna alla leiki þar sem liðið spilar (sem heimalið eða útilið)
  const teamMatches = allMatches.filter((match) => 
    match.home_team === teamName || match.away_team === teamName
  );

  // Flokka leiki í búna og framundan
  const finishedMatches = teamMatches.filter((m) => m.result != null);
  const upcomingMatches = teamMatches.filter((m) => m.result == null);

  // Raða leikjum eftir dagsetningu
  const sortByDate = (a: typeof teamMatches[0], b: typeof teamMatches[0]) => {
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  };
  finishedMatches.sort((a, b) => sortByDate(a, b));
  upcomingMatches.sort((a, b) => sortByDate(a, b));

  // Click outside to close
  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            {getTeamFlag(teamName) && <span className="text-2xl">{getTeamFlag(teamName)}</span>}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">
              Leikir {teamName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Loka"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {teamMatches.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-neutral-400">
              Engir leikir fundust fyrir {teamName}
            </p>
          ) : (
            <div className="space-y-6">
              {upcomingMatches.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    Leikir framundan ({upcomingMatches.length})
                  </h3>
                  <div className="space-y-2">
                    {upcomingMatches.map((match) => {
                      const started = new Date(match.starts_at).getTime() <= now;
                      const isHome = match.home_team === teamName;
                      const opponent = isHome ? match.away_team : match.home_team;
                      
                      return (
                        <div
                          key={match.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                              {isHome ? (
                                <>
                                  {teamName} {getTeamFlag(teamName)} vs {getTeamFlag(opponent)} {opponent}
                                </>
                              ) : (
                                <>
                                  {opponent} {getTeamFlag(opponent)} vs {getTeamFlag(teamName)} {teamName}
                                </>
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              started
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}>
                              {started ? "Í gangi" : "Framundan"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            {match.stage ? `${match.stage} · ` : ""}
                            {new Date(match.starts_at).toLocaleString('is-IS')}
                            {match.match_no != null ? ` · #${match.match_no}` : ""}
                          </div>
                          {match.home_score != null && match.away_score != null && (
                            <div className="mt-2 text-center">
                              <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                                Lokastaða:{" "}
                                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                  {match.home_team} {match.home_score} - {match.away_score} {match.away_team}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {finishedMatches.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                    Búnir leikir ({finishedMatches.length})
                  </h3>
                  <div className="space-y-2">
                    {finishedMatches.map((match) => {
                      const isHome = match.home_team === teamName;
                      const opponent = isHome ? match.away_team : match.home_team;
                      const teamResult = isHome ? (match.result === "1" ? "S" : match.result === "2" ? "T" : "J") : (match.result === "2" ? "S" : match.result === "1" ? "T" : "J");
                      
                      return (
                        <div
                          key={match.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                              {isHome ? (
                                <>
                                  {teamName} {getTeamFlag(teamName)} vs {getTeamFlag(opponent)} {opponent}
                                </>
                              ) : (
                                <>
                                  {opponent} {getTeamFlag(opponent)} vs {getTeamFlag(teamName)} {teamName}
                                </>
                              )}
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              teamResult === "S"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : teamResult === "T"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
                            }`}>
                              {teamResult === "S" ? "Sigur" : teamResult === "T" ? "Tap" : "Jafntefli"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-neutral-400 flex-wrap">
                            <span>
                              Úrslit: <span className="font-mono font-semibold">{match.result ?? "-"}</span>
                            </span>
                            <span>·</span>
                            <span>{new Date(match.starts_at).toLocaleString('is-IS')}</span>
                            {match.match_no != null && <span>· #{match.match_no}</span>}
                          </div>
                          {match.home_score != null && match.away_score != null && (
                            <div className="mt-2 text-center">
                              <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                                Lokastaða:{" "}
                                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                  {match.home_team} {match.home_score} - {match.away_score} {match.away_team}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-neutral-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
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
            ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:border-blue-600 hover:shadow-md hover:scale-105 active:bg-blue-400 active:scale-[0.92] active:shadow-lg dark:border-blue-500 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-600 dark:hover:border-blue-600 dark:active:bg-blue-700 dark:active:scale-[0.92]"
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
