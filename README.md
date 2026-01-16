# Nihontowatch

The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide.

## Overview

Nihontowatch aggregates listings from 50+ dealers into a single searchable interface, helping collectors find their next acquisition.

**Live:** https://nihontowatch.com

## Features

- **Browse** - Grid/list view of all available listings
- **Search** - Full-text search with faceted filtering
- **Dealers** - Directory of all monitored dealers
- **Price History** - Track price changes over time
- **Alerts** - Get notified when matching items appear (coming soon)

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only
```

## Project Structure

```
nihontowatch/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # React components
│   ├── lib/           # Utilities and helpers
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript definitions
├── docs/              # Documentation
├── public/            # Static assets
└── CLAUDE.md          # AI context
```

## Related Projects

| Project | Purpose |
|---------|---------|
| [Oshi-scrapper](../Oshi-scrapper) | Python scraping backend |
| [oshi-v2](../oshi-v2) | Reference implementation |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview and AI context
- [docs/INDEX.md](./docs/INDEX.md) - Documentation navigation
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [docs/CROSS_REPO_REFERENCE.md](./docs/CROSS_REPO_REFERENCE.md) - Cross-repo reference

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Deployment

Push to `main` to trigger automatic deployment via Vercel.

```bash
git push origin main
```

## License

Private - All rights reserved.
