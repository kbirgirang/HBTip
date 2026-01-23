# Greining á endurtekinni virkni í admin síðu

## 1. Keppni dropdown (Tournament Select) - ENDURTEKIN 3 SÍNIR

### Staðsetningar:
1. **"Setja inn leiki" tab** (lína ~1469-1488)
2. **"Úrslit + bónus" tab** (lína ~1604-1626)  
3. **"Stillingar" tab** (lína ~2518-2534)

### Sérkenni:
- Sama JSX uppsetning með loading/empty states
- Sama className styling
- Nokkrar breytur:
  - Fyrsta og önnur nota `selectedTournamentForOperations` og sía `.filter(t => t.is_active)`
  - Þriðja notar `selectedTournamentForSettings` og sýnir ALLAR keppnir (ekki síuð)
  - Önnur hefur aðeins öðruvísi className (`mt-2` vs `mt-1`)

### Lausn:
Búa til reusable component: `<TournamentSelect value={...} onChange={...} filterActive={true/false} />`

---

## 2. Error handling mynstur - ENDURTEKIN 21 SÍNIR

### Mynstur:
```typescript
const json = await res.json().catch(() => ({}));
if (!res.ok) return setErr(json?.error || "Fallback skilaboð");
```

### Staðsetningar:
- `handleLogin` (lína 103)
- `loadStatistics` (lína 161)
- `loadTournaments` (lína 181)
- `createTournament` (lína 241)
- `toggleTournamentActive` (lína 267)
- `updateTournament` (lína 312)
- `deleteTournament` (lína 339)
- `deleteAllMatches` (lína 370)
- `saveSettings` (lína 425)
- `syncPredictions` (lína 448)
- `syncBonusAnswers` (lína 471)
- `loadPushUsers` (lína 490)
- `sendPushNotification` (lína 535)
- `createMatch` (lína 610)
- `loadMatches` (lína 752)
- `setResult` (lína 777)
- `setUnderdog` (lína 799)
- `deleteMatch` (lína 825)
- `deleteBonus` (lína 855)
- `loadBonusList` (lína 884)
- `saveBonus` (lína 1164)

### Lausn:
Búa til helper function:
```typescript
async function apiCall<T>(url: string, options: RequestInit, errorMessage: string): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json?.error || errorMessage);
      return null;
    }
    return json as T;
  } catch {
    setErr("Tenging klikkaði.");
    return null;
  }
}
```

---

## 3. Loading state checks fyrir keppnir - ENDURTEKIN 4 SÍNIR

### Mynstur:
```tsx
{loadingTournaments ? (
  <option>Sæki keppnir...</option>
) : tournaments.length === 0 ? (
  <option>Engar keppnir tiltækar</option>
) : (
  // render tournaments
)}
```

### Staðsetningar:
- Lína ~1475 (create tab)
- Lína ~1613 (results tab)
- Lína ~2417 (tournaments tab)
- Lína ~2523 (settings tab)

### Lausn:
Innifalið í TournamentSelect component hér að ofan.

---

## 4. Try-catch-finally mynstur - ENDURTEKIN 26 SÍNIR

### Mynstur:
```typescript
async function someFunction() {
  setLoading(true);
  try {
    const res = await fetch(...);
    // handle response
  } catch {
    setErr("Tenging klikkaði.");
  } finally {
    setLoading(false);
  }
}
```

### Lausn:
Nota helper function sem hér að ofan, eða custom hook:
```typescript
function useApiCall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const call = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError("Tenging klikkaði.");
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  return { call, loading, error };
}
```

---

## 5. Tournament filtering - ENDURTEKIN 2 SÍNIR

### Mynstur:
```typescript
tournaments.filter(t => t.is_active).map((t) => ...)
```

### Staðsetningar:
- Lína ~1481 (create tab)
- Lína ~1619 (results tab)

### Lausn:
Innifalið í TournamentSelect component.

---

## 6. Default tournament selection logic - ENDURTEKIN 2 SÍNIR

### Mynstur:
```typescript
if (tournaments.length > 0 && !selectedTournamentForX) {
  const activeTournament = tournaments.find(t => t.is_active);
  if (activeTournament) {
    setSelectedTournamentForX(activeTournament.slug);
  } else if (tournaments[0]) {
    setSelectedTournamentForX(tournaments[0].slug);
  }
}
```

### Staðsetningar:
- Lína ~202-209 (fyrir Operations)
- Lína ~211-218 (fyrir Settings)

### Lausn:
Búa til helper function:
```typescript
function getDefaultTournament(tournaments: Tournament[], preferActive: boolean = true): string {
  if (tournaments.length === 0) return "";
  if (preferActive) {
    const active = tournaments.find(t => t.is_active);
    if (active) return active.slug;
  }
  return tournaments[0].slug;
}
```

---

## 7. Form input styling - ENDURTEKIN MÖRG SÍNIR

### Mynstur:
```tsx
className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500"
```

### Lausn:
Búa til CSS class eða Tailwind component:
```tsx
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-500";
```

---

## Samantekt

**Helstu endurtekningar:**
1. ✅ Tournament dropdown (3x) - MEST MIKILVÆGT
2. ✅ Error handling pattern (21x) - MIKILVÆGT
3. ✅ Loading state checks (4x) - MIKILVÆGT
4. ✅ Try-catch-finally (26x) - MIKILVÆGT
5. ✅ Tournament filtering (2x) - LÆGRA
6. ✅ Default tournament logic (2x) - LÆGRA
7. ✅ Form input styling (mörg) - LÆGRA

**Áætlaður sparnaður:**
- ~200-300 lína kóða ef búið er að refactora helstu endurtekningar
- Auðveldari viðhald
- Færri villur
- Betri consistency
