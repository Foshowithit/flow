# Flow — AI-Powered PWA Frontend

A minimal, mobile-friendly ChatGPT-style PWA built with Next.js 15 + App Router.

## Local Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Setup

```bash
cd apps/web
npm install
```

### Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Edit `.env.local` as needed. The defaults work for local development with the
Flow bridge running on `localhost:3092`.

### MOCK_CHAT Mode

For frontend development **without** a running backend or API keys, set:

```
MOCK_CHAT=true
```

This makes the `/api/chat` endpoint return a deterministic mock assistant
response, bypassing the real bridge entirely.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## PWA / Add to Home Screen

The app includes a `manifest.json` and app icons (SVG placeholders).
**No service worker** is registered in this MVP — the app is installable
(add-to-home-screen) but requires network connectivity to function.
A service worker can be added later for offline support and faster loads.

## Architecture

┌─────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  Browser     │────▶│  Next.js API Route   │────▶│  Flow Bridge         │
│  (React SPA) │     │  /api/chat           │     │  localhost:3092      │
└─────────────┘     └──────────────────────┘     └──────────────────────┘
       │                         │
       │                    (MOCK_CHAT=true
       │                     returns mock data)
       │
  PWA manifest
  + icons
```

The API route is the only server-side code. It proxies chat requests to the
bridge, keeping the bridge API key server-side. In MOCK_CHAT mode it returns
a canned response without calling the bridge.
