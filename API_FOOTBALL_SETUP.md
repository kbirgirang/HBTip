# API-Football Integration Setup

## Overview
API-Football integration gerir þér kleift að sækja leiki og úrslit sjálfkrafa úr API-Football fyrir keppnir.

## Setup Steps

### 1. Keyra Migration
Keyrðu SQL migration skrána til að bæta við nauðsynlegum reitum:
```sql
-- Keyrðu MIGRATION_add_api_football.sql í Supabase SQL editor
```

### 2. Sækja API Key
1. Skráðu þig á [API-Football](https://www.api-football.com/)
2. Sæktu API key (RapidAPI key)
3. Bættu við í `.env.local`:
```env
API_FOOTBALL_KEY=your_api_key_here
```

### 3. Finna League ID og Season
1. Opnaðu [API-Football documentation](https://www.api-football.com/documentation-v3#tag/Leagues)
2. Finndu league ID fyrir keppnina (t.d. 39 fyrir Premier League)
3. Season er árið (t.d. 2024)

### Algeng League IDs
- Premier League: 39
- La Liga: 140
- Serie A: 135
- Bundesliga: 78
- Ligue 1: 61
- Champions League: 2
- Europa League: 3

### 4. Virkja fyrir Tournament
1. Farðu í Admin → Keppnir
2. Smelltu á "⚽ API-Football" á keppninni
3. Virkjaðu API-Football
4. Settu inn League ID og Season
5. Vista

### 5. Sækja Leiki
1. Smelltu á "Sækja leiki" á keppninni
2. Kerfið sækir allar leiki úr API-Football og býr þær til í kerfinu

### 6. Uppfæra Úrslit
1. Smelltu á "Uppfæra úrslit" á keppninni
2. Kerfið uppfærir úrslit fyrir allar leiki sem eru búnar

## Notkun
- **Sækja leiki**: Sækir allar leiki úr API-Football og býr þær til/uppfærir þær í kerfinu
- **Uppfæra úrslit**: Uppfærir aðeins úrslit fyrir leiki sem eru þegar í kerfinu

## Athugasemdir
- API-Football hefur rate limits - ekki keyra of oft
- Leikir verða búnir til með `allow_draw: true`
- Úrslit verða sjálfkrafa sett þegar leikir eru búnir (status = "FT")
- Ef leikur er ekki búinn, verður `result` sett sem `null`

