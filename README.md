This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Tengja við GoDaddy lén

### Skref 1: Deploya á Vercel

1. Farðu á [vercel.com](https://vercel.com) og skráðu þig inn (eða búðu til aðgang)
2. Smelltu á "Add New Project"
3. Tengdu GitHub/GitLab/Bitbucket repository-ið þitt
4. Vercel sér Next.js sjálfkrafa og stillir upp
5. Setja þarf environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_SESSION_SECRET`
   - `ADMIN_PASSWORD`
6. Smelltu á "Deploy"

Eftir deploy færðu URL eins og `ehf-pool.vercel.app`

### Skref 2: Bæta léninu við Vercel

1. Farðu í Vercel dashboard → Project → Settings → Domains
2. Smelltu á "Add Domain"
3. Sláðu inn GoDaddy lénið (t.d. `example.is`)
4. Vercel gefur þér DNS stillingar sem þú þarft að setja upp

### Skref 3: Stilla DNS í GoDaddy

1. Farðu á [GoDaddy DNS Management](https://dcc.godaddy.com/manage)
2. Veldu léninu þínu
3. Finndu "DNS Records" eða "DNS Management"
4. Bættu við eftirfarandi DNS færslum:

**Fyrir root domain (example.is):**
- **Type:** A
- **Name:** @
- **Value:** 76.76.21.21 (Vercel IP - athugaðu í Vercel dashboard)
- **TTL:** 600

**Eða nota CNAME (mælt með):**
- **Type:** CNAME
- **Name:** @
- **Value:** cname.vercel-dns.com
- **TTL:** 600

**Fyrir www subdomain:**
- **Type:** CNAME
- **Name:** www
- **Value:** cname.vercel-dns.com
- **TTL:** 600

### Skref 4: Bíða eftir DNS propagation

- DNS breytingar geta tekið 24-48 klukkustundir
- Notaðu [whatsmydns.net](https://www.whatsmydns.net) til að athuga hvenær breytingarnar eru komin út

### Skref 5: SSL vottun

- Vercel setur sjálfkrafa upp SSL vottun (HTTPS) fyrir lénið
- Þetta getur tekið nokkrar mínútur eftir að DNS er komið út

### Vandamálaleit

- **Lénið virkar ekki:** Athugaðu DNS færslurnar í GoDaddy
- **SSL vottun virkar ekki:** Bíddu eftir DNS propagation (getur tekið 24-48 klst)
- **403 Forbidden:** Athugaðu að lénið sé rétt stillt í Vercel

### Aðrar hosting lausnir

Ef þú vilt ekki nota Vercel, geturðu notað:
- **Netlify:** Svipað ferli, bættu við léninu í Netlify dashboard
- **Railway/Render:** Setja þarf upp reverse proxy eða nota þeirra domain stillingar
- **Eigin server:** Setja þarf upp Nginx/Caddy reverse proxy
