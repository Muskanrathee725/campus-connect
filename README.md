
https://github.com/user-attachments/assets/6395dad0-1dac-40b5-b762-c9e1b5331b24



# Campus Connect

A real-time networking platform for Chandigarh University students, alumni, and faculty — search the student directory, send and accept connection requests, chat 1:1 in real time, and share a lightweight posts feed with image/document attachments.

**Live app:** https://campus-connect-nu-lovat.vercel.app

> Full features (search, connect, chat, post) require signing in with Google and then verifying a CU UID via a one-time email code — this gate exists because the app is scoped to a specific university's community. Signed-in visitors without a verified CU UID still see a live, read-only preview of the posts feed.

## Features

- **Auth** — Google OAuth (NextAuth.js), no passwords stored anywhere. A second verification step (CU UID + emailed OTP) gates full access separately from login, so anyone can sign in but only verified CU members get the full network.
- **Student directory** — search and filter by name, branch, year, role, and tech interests.
- **Connections** — send/accept/reject requests, live-updating notification badge for incoming requests.
- **Real-time chat** — 1:1 messaging over WebSockets (Socket.io) between accepted connections, with delivered/read receipts (✓ / ✓✓ / ✓✓ blue).
- **Posts feed** — read-only for everyone signed in; verified members can post with image or document (PDF/DOC/PPT) attachments and an emoji picker, all validated server-side regardless of what the client sends.
- **Admin dashboard** — a single email-gated `/admin` route listing every enrolled user and their verification status.

## Architecture

This isn't a single deployable unit — it's two independently deployed services sharing one database, because of a constraint that's easy to miss until you hit it:

```
┌─────────────────────┐         ┌──────────────────────────┐
│   Next.js app        │  HTTP   │                            │
│   (Vercel)            │◄───────┤   Browser                  │
│   - App Router pages  │         │                            │
│   - REST API routes   │         └──────────────┬─────────────┘
│   - NextAuth           │                        │ WebSocket
└──────────┬─────────────┘                        ▼
           │                          ┌─────────────────────────┐
           │ Mongoose                  │  Socket.io server         │
           │                            │  (Render, Node/Express)   │
           │                            │  - online-user registry    │
           │                            │  - message persistence     │
           │                            └──────────────┬──────────────┘
           │                                             │ Mongoose
           ▼                                             ▼
                    ┌───────────────────────────┐
                    │   MongoDB Atlas              │
                    └───────────────────────────┘
```

Vercel's serverless functions can't hold a persistent connection open, and Socket.io needs exactly that — so real-time chat is handled by a small standalone Express + Socket.io service (`socket-server/`) deployed separately on Render, sharing the same MongoDB cluster as the main app.

**Stack:** Next.js 16 (App Router) · TypeScript · MongoDB Atlas + Mongoose · NextAuth.js · Tailwind CSS · Socket.io · deployed on Vercel (web) + Render (real-time server)

## Notable engineering problems solved

A few real production issues worth mentioning, not just features:

- **Chat silently never worked in production.** The Socket.io server existed in code but had never actually been deployed anywhere — it only ran on `localhost` during development. Every message sent from the live site was going nowhere. Diagnosed from the project's own dev log, then deployed via a Render Blueprint and wired up the missing environment variables.
- **A split-brain database bug.** After deploying the chat server, messages still didn't appear in conversation history — sent messages showed instantly (live socket push) but vanished on reload. Root cause: the chat server and the main app were pointed at two different databases inside the same MongoDB Atlas cluster (`test` vs. `campus-connect`), so writes and reads never intersected. Found by directly querying both databases to compare user IDs and message counts, rather than guessing from the UI.
- **A Next.js client-router-cache bug.** Chat history stopped reloading when reopening a conversation because the fetch lived in a mount-only `useEffect` — Next.js was reusing an already-rendered page instance on back-navigation, so the effect never re-ran. Fixed by also refetching on tab focus/visibility, not just on mount.
- **A mass-assignment vulnerability**, caught early: the onboarding API originally spread the entire request body into a MongoDB update, so a crafted request could set `isVerified: true` directly. Fixed by explicitly whitelisting the 11 safe onboarding fields.

## Running locally

```bash
cd campus-connect
npm install
npm run dev
```

Requires a `.env.local` with `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `NODEMAILER_EMAIL`/`NODEMAILER_PASS` (for OTP emails), and `NEXT_PUBLIC_SOCKET_URL` (pointing at a running `socket-server` instance — see `socket-server/README` equivalent in `socket-server/.env.example`).

To run the chat server locally too:

```bash
cd socket-server
npm install
npm run dev
```
