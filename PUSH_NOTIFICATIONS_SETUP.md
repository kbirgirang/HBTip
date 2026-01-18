# Push Notifications Setup

## 1. Keyra SQL Migration

Í Supabase SQL Editor, keyrðu:

```sql
-- Opnaðu MIGRATION_push_subscriptions.sql eða keyrðu:
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES room_members(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member ON push_subscriptions(member_id);
```

## 2. Setja upp VAPID Keys

Í terminal, keyrðu:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Þetta mun gefa þér:
- Public Key (sem þú setur í `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- Private Key (sem þú setur í `VAPID_PRIVATE_KEY`)

## 3. Bæta við Environment Variables

Bættu við í `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxxxx (public key frá web-push)
VAPID_PRIVATE_KEY=xxxxx (private key frá web-push)
VAPID_SUBJECT=mailto:your-email@example.com
```

**Ath:** `VAPID_SUBJECT` getur verið email eða URL. Notaðu t.d. `mailto:admin@example.com`

## 4. Endurræsa Development Server

Eftir að þú bætir við environment variables:

```bash
npm run dev
```

## 5. Prófa

### A) Notandi skráir sig fyrir push

1. Opnaðu síðuna `/r/[roomCode]`
2. Vafrinn mun biðja um leyfi fyrir notifications
3. Ef þú samþykkir, er subscription vistað í gagnagrunninum

### B) Admin sendir push notification

1. Farðu í `/admin` → Settings tab
2. Skoðaðu "Push Notifications" card
3. Þú sérð lista af notendum með push subscriptions
4. Veldu "Send til allra" eða "Send til einstaklings"
5. Fylltu út:
   - Titill: "Prufa"
   - Skilaboð: "Halló, þetta er prufa!"
6. Smelltu "Senda push notification"
7. Notandi ætti að fá tilkynningu strax!

## Viðvörun

- Push notifications virka aðeins í HTTPS (eða localhost í development)
- Notendur verða að samþykkja notifications í vafranum
- Ef subscription verður ógild (t.d. ef notandi eyðir vafra), eyðist hún sjálfkrafa úr gagnagrunninum
