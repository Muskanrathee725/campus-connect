# Campus Connect — Dev Log

## Session 1 — 2026-06-14

---

### SECURITY FIX — Onboarding Mass Assignment
**File:** `campus-connect/app/api/user/onboarding/route.ts`
**Problem:** The API was doing `{ ...body, onboardingComplete: true }` which spread the ENTIRE
request body into the MongoDB update. Any attacker could POST `{ "isVerified": true }` and
bypass OTP verification for free.
**Fix:** Explicitly destructure and whitelist only the 11 safe onboarding fields (name, role,
year, branch, specialization, techStack, interests, linkedin, github, twitter, company, image).

---

### FEATURE — Connection Model
**File:** `campus-connect/models/Connection.ts`
**Logic:**
- Schema: `{ requester: ObjectId, recipient: ObjectId, status: "pending"|"accepted"|"rejected" }`
- Compound unique index on `(requester, recipient)` prevents duplicate requests
- Timestamps auto-managed by Mongoose

---

### FEATURE — Users API (replaces dummy data)
**File:** `campus-connect/app/api/users/route.ts`
**Logic:**
- GET endpoint fetches all users from MongoDB except the logged-in user
- Only returns public-safe fields (no OTP, no email, etc.)
- Fetches all Connection documents involving the caller
- Builds a map of `otherUserId → { status, iSentIt }` in memory
- Annotates every user with `connectionStatus` ("none"|"pending"|"accepted"|"rejected")
  and `iSentRequest` (boolean) so the frontend knows which button state to show

---

### FEATURE — Send Connection Request
**File:** `campus-connect/app/api/connections/send/route.ts`
**Logic:**
- POST `{ recipientId }`
- Blocks: self-requests, duplicate requests (checks both directions)
- Creates Connection document with status = "pending"

---

### FEATURE — Accept / Reject Connection Request
**File:** `campus-connect/app/api/connections/respond/route.ts`
**Logic:**
- POST `{ connectionId, action: "accept"|"reject" }`
- Only the recipient of the request can call this (enforced in query)
- Only works on pending requests (won't re-process already handled ones)
- Updates status to "accepted" or "rejected"

---

### FEATURE — List Connections / Pending Requests
**File:** `campus-connect/app/api/connections/list/route.ts`
**Logic:**
- GET `?type=pending` → requests sent TO me that are still pending (for the notification bell)
- GET `?type=accepted` → all accepted connections (both directions)
- Populates requester/recipient with name, image, branch, year, role

---

### FEATURE — Dashboard Rewrite (real data + connection UI)
**File:** `campus-connect/app/dashboard/page.tsx`
**What changed:**
- Removed all hardcoded dummy users
- Fetches real users from `/api/users` on mount
- Fetches pending requests from `/api/connections/list?type=pending` on mount
- Smart connect button with 4 states:
  - `none` → blue "+ Connect" button
  - `pending` + iSentRequest → grey "Pending..." (disabled)
  - `pending` + !iSentRequest → "Accept" + "Ignore" buttons (they sent to me)
  - `accepted` → green "✓ Connected" + blue "💬 Message" link
- Optimistic UI on connect (button changes before server confirms)
- Notification bell in navbar with incoming request count
- Requests dropdown panel shows sender info + accept/ignore buttons
- Working search (name, branch, tech stack, interests)
- Working filter buttons (All, CSE, ECE, ME, Student, Alumni, AI/ML, Web Dev)
- Skeleton loaders while data is fetching

---

### FEATURE — Socket.io Server (real-time chat backend)
**File:** `socket-server/index.js`
**Deployment:** Railway (separate Node.js service)
**Logic:**
- Express + Socket.io server
- Maintains `onlineUsers` Map: `userId → socketId`
- Events handled:
  - `register` → user identifies themselves after connecting, stored in onlineUsers map
  - `send_message` → persists message to MongoDB, emits `receive_message` to sender
    AND recipient (if online)
  - `mark_read` → marks all unread messages from senderId as read, notifies sender
    via `messages_read` event
  - `disconnect` → removes user from onlineUsers map
- MongoDB connection uses same Atlas cluster as Next.js

---

### FEATURE — Message Model
**File:** `campus-connect/models/Message.ts`
**Schema:** `{ sender: ObjectId, recipient: ObjectId, content: String, read: Boolean, timestamps }`
**Indexes:** compound on (sender, recipient) for fast conversation queries; createdAt for sort

---

### FEATURE — Message History API
**File:** `campus-connect/app/api/messages/[userId]/route.ts`
**Logic:**
- GET endpoint to load conversation history between caller and [userId]
- Guards: only accepted connections can fetch (403 if not connected)
- Returns last 100 messages sorted oldest-first
- Also returns the other user's profile (name, image, branch, year) for the chat header

---

### FEATURE — Socket Client Singleton
**File:** `campus-connect/lib/socket.ts`
**Logic:**
- Single socket instance reused across page navigations (prevents duplicate connections)
- `autoConnect: false` — we connect manually after session loads and userId is known
- URL comes from `NEXT_PUBLIC_SOCKET_URL` env variable

---

### FEATURE — Chat Page UI
**File:** `campus-connect/app/messages/[userId]/page.tsx`
**Logic:**
- Loads chat history via GET `/api/messages/[userId]` on mount
- Connects to Socket.io server and registers with userId from NextAuth session
- Listens for `receive_message` events — deduplicates by `_id` before adding to state
- Sends messages via `send_message` socket event (socket server handles persistence)
- Auto-scrolls to bottom on new messages
- Enter key sends message (Shift+Enter for new line)
- Shows live/connecting indicator based on socket connection state
- Error state if users are not connections (shows message + back button)
- Skeleton loaders while history loads
- Marks messages as read via `mark_read` event on open + on receive

---

### ENV VARS ADDED
**File:** `campus-connect/.env.local`
- `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000` (dev) → set to Railway URL in production

**File:** `socket-server/.env.example`
- `MONGODB_URI` — same Atlas connection string
- `CLIENT_URL` — Vercel URL for CORS (set in Railway env vars)
- `PORT` — Railway sets this automatically

---

### PACKAGES INSTALLED
- `campus-connect`: `socket.io-client`
- `socket-server`: `express`, `socket.io`, `mongoose`, `cors`, `dotenv`, `nodemon` (dev)

---

---

### FIX — Domain Check on Login (only @cuchd.in allowed)
**File:** `campus-connect/app/api/auth/[...nextauth]/route.ts`
**Problem:** The signIn callback had zero domain validation — any Google account could sign up.
**Fix:** Added check `user.email?.endsWith("@cuchd.in")` at the top of signIn callback.
Non-CU emails are redirected with `?error=OnlyCUCHDEmailsAllowed` before any DB write.
**Also updated:** `app/page.tsx` footer text changed from `@cuhd.in` → `@cuchd.in` (correct domain).

---

### FIX — UID Format Validation on Verification
**Files:** `campus-connect/app/api/verify/send-otp/route.ts`, `campus-connect/app/verify/page.tsx`
**Problem:** The UID input accepted any random string — no format check. Would try to send OTP
to garbage addresses like `asdfasdf@cuchd.in`.
**Fix:**
- Server (`send-otp/route.ts`): Added regex `/^\d{2}[A-Z]{1,6}\d{4,7}$/` validation.
  Rejects input that doesn't match CU UID pattern before attempting to send email.
- Client (`verify/page.tsx`): Same regex runs on the frontend for instant feedback
  without a server round-trip. Error message shown: "Invalid UID. Format: 23BAI70172 or 21BCE2367"
- Added format hint below the UID input field: shows example UIDs so users know what to type.

---

### FIX — Connection Request Feedback (sender has no idea if request sent)
**File:** `campus-connect/app/dashboard/page.tsx`
**Problem:** Clicking Connect had optimistic UI but zero error feedback. If MongoDB was down
or API failed, the button silently reverted with no message to the user.
**Fix:**
- Added `toast` state with auto-dismiss after 3 seconds
- `handleConnect` now shows green toast "Connection request sent!" on success
- On failure: shows red toast with exact error from API, reverts the optimistic button state
- Toast renders as fixed-position overlay (top-right corner)

---

### FIX — Recipient Never Sees Incoming Requests Without Refresh
**File:** `campus-connect/app/dashboard/page.tsx`
**Problem:** `fetchPendingRequests()` only ran once on mount. Recipient had to manually
refresh the page to see a new connection request.
**Fix:**
- Added `setInterval(fetchPendingRequests, 15000)` — polls every 15 seconds automatically
- Interval is cleaned up on component unmount (no memory leaks)
- Added manual **↻ Refresh** button (top-right of dashboard) that calls both
  `fetchUsers()` and `fetchPendingRequests()` immediately on click

---

---

### BUG FIX — Accept/Reject Sending Wrong ID to API
**Files:** `app/api/connections/respond/route.ts`, `app/dashboard/page.tsx`
**Root cause:** The dashboard was passing `user._id` (sender's User document ID) to
`handleRespond()`, but the respond API was doing `Connection.findOne({ _id: connectionId })`
— searching for a Connection document whose `_id` matched a User `_id`. These are completely
different ObjectIds. Result: always 404 → "something went wrong" on recipient side.
**Fix:**
- Changed respond API to accept `requesterId` (the sender's user `_id`) instead of
  `connectionId`, and finds the connection via `{ requester: requesterId, recipient: me._id }`
- Updated `handleRespond()` calls in dashboard:
  - User cards: already passing `user._id` ✓ (now correctly interpreted as requesterId)
  - Dropdown panel: was passing `req._id` (Connection doc ID) → fixed to `req.requester._id`

---

---

### TEMP — Disabled All Verification Gates for Testing
**Decision:** Verification system will be added back in full at the end, fully decoupled.
For now all gates are commented out so any Google account can test the platform freely.
**Changes (all commented out with TODO markers):**
- `app/api/auth/[...nextauth]/route.ts` — `@cuchd.in` domain check commented out
- `app/api/verify/send-otp/route.ts` — UID format regex check commented out
- `app/verify/page.tsx` — client-side UID format check commented out
**To re-enable later:** search codebase for `// TODO: re-enable` — three places to uncomment.

---

---

### BUG FIX — connections/send 500: Stale MongoDB Index
**Root cause:** The `connections` collection in Atlas had an old index `sender_1_receiver_1`
from a previous schema version that used `sender`/`receiver` field names. Our new schema uses
`requester`/`recipient`. When inserting a new Connection document, both `sender` and `receiver`
were `null`, hitting the unique constraint → E11000 duplicate key error → 500.
**Fix:**
- User dropped the old `connections` collection from Atlas manually (clean slate)
- Updated `MONGODB_URI` in `.env.local` and `socket-server/.env` to specify database name
  `campus-connect` instead of defaulting to `test`
  (from `...mongodb.net/?appName=...` → `...mongodb.net/campus-connect?appName=...`)
- All data now lives in `campus-connect` database, not the default `test` database

---

### BUG FIX — Dashboard Hydration Mismatch Warning
**Root cause:** Next.js had a stale SSR cache of the old dashboard HTML. The server rendered
the old layout (`className="mb-6"` + `<h2>` directly) while client rendered the new layout
(`className="mb-6 flex items-start justify-between"` + `<div>` wrapper for Refresh button).
**Fix:** Hard refresh (`Ctrl + Shift + R`) clears the stale cache. Not a real code bug.

---

---

### BUG FIX — Messages API params not awaited (Next.js 16 breaking change)
**File:** `app/api/messages/[userId]/route.ts`
**Root cause:** Next.js 16 changed route `params` to be a Promise. The API was reading
`params.userId` synchronously → undefined → all chat requests were broken.
**Fix:** Changed signature to `{ params }: { params: Promise<{ userId: string }> }`
and added `const { userId: otherUserId } = await params;` at the top.

---

### BUG FIX — Dashboard stuck on "Pending" after connection accepted
**File:** `app/dashboard/page.tsx`
**Root cause:** `fetchUsers()` only ran once on mount. The 15s polling interval only called
`fetchPendingRequests()`. When Account B accepted Account A's request, the connection status
changed in DB to "accepted" — but Account A's dashboard never re-fetched users, so the button
stayed stuck on "Pending..." indefinitely.
**Fix:** Changed polling interval from 15s (pending only) to 10s (both `fetchUsers()` +
`fetchPendingRequests()`). Now both sides auto-update within 10 seconds of any status change.

---

---

### FEATURE — Unread Message Count Badge on Dashboard
**Files:** `app/api/messages/unread/route.ts` (new), `app/dashboard/page.tsx`
**Logic:**
- New GET `/api/messages/unread` — aggregates all unread messages sent TO me,
  groups by sender, returns `{ counts: { senderId: count } }` map
- Dashboard fetches unread counts on mount + every 10s in the same polling interval
- ConnectButton (accepted state) shows a red badge on the 💬 Message button
  with the count (capped at "9+" for large numbers)
- Badge disappears once the user opens that chat (mark_read clears it in DB)

---

### BUG FIX — Socket register never emitted if socket already connected
**File:** `app/messages/[userId]/page.tsx`
**Root cause:** `getSocket()` returns a singleton. If the user navigated away and came back,
the socket was already connected. `socket.connect()` is a no-op on an already-connected socket,
and the `connect` event never fires again — so `register` was never emitted to the server.
Result: server's `onlineUsers` map didn't have this user → messages sent to them were dropped.
**Fix:** After attaching the `connect` listener, check `socket.connected` immediately.
If already connected, emit `register` + `mark_read` right away without waiting for the event.
Also moved listeners to named functions so cleanup removes the exact listener, not all listeners.

---

### PENDING / TODO
- [ ] Deploy socket-server to Railway
- [ ] Set `NEXT_PUBLIC_SOCKET_URL` in Vercel env vars to Railway URL
- [ ] Set `CLIENT_URL` in Railway env vars to Vercel URL
- [ ] Test full flow: connect two accounts → chat in real-time
- [ ] Add typing indicator (socket event: `typing` / `stop_typing`)
- [ ] Add unread message count badges on dashboard
- [ ] Feed / Posts system
- [ ] Notifications system
- [ ] Profile pages (`/profile/[userId]`)
