# Implementation Plan: Chat.SO Installable PWA Communication Platform

Chat.SO is a production-ready, installable Progressive Web App (PWA) featuring 1-on-1 text messaging, WebRTC peer-to-peer audio/video calling, direct-to-cloud file sharing (50MB maximum), and minimal user profiles with live presence—running natively on Node.js without requiring Docker.

---

## 1. Zero-Docker Native & PWA Architecture

- **PWA (Progressive Web App)**: Web App Manifest (`manifest.webmanifest`), service worker for offline shell caching, native app icons, and an interactive "Install App" button. Users on Google Chrome, Microsoft Edge, Safari, Android, and iOS can install it directly as an independent window with its own icon in their taskbar or dock.
- **Zero-Docker Database**: Powered by Prisma ORM with SQLite out of the box (`file:./dev.db`). Runs directly on your Windows PC with zero external installations or services required.
- **WebRTC NAT Traversal**: Uses high-availability Google STUN servers (`stun:stun.l.google.com:19302`) for direct peer-to-peer media streaming without requiring a Coturn container.
- **Unified Single-Command Dev**: Starting the entire system is as simple as running `npm run dev` in the root directory.

---

## 2. Monorepo Structure

```
Chat.SO/
├── apps/
│   ├── server/                     # Backend API & Socket.IO Signaling Gateway
│   │   ├── src/
│   │   │   ├── config/             # Environment & credentials config
│   │   │   ├── controllers/        # Auth, File, WebRTC, Profile, Chat controllers
│   │   │   ├── middleware/         # JWT auth middleware, Zod validation
│   │   │   ├── routes/             # REST endpoints
│   │   │   ├── services/           # GCS V4 signer, DB queries
│   │   │   ├── sockets/            # Chat & WebRTC signaling handlers
│   │   │   └── server.ts           # Express + HTTP + Socket.IO entrypoint
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Database schema (SQLite for zero-docker local dev)
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/                        # React 19 Vite Client (PWA)
│       ├── public/
│       │   ├── manifest.webmanifest # PWA Web App Manifest
│       │   ├── sw.js               # Service Worker
│       │   └── icons/              # App icons
│       ├── src/
│       │   ├── components/         # Chat, VideoCall, ProfileModal, Sidebar, InstallPrompt
│       │   ├── hooks/              # useWebRTC, useSocket, useChat, useAuth, usePWAInstall
│       │   ├── services/           # API client, direct GCS uploader
│       │   ├── types/              # Client state types
│       │   ├── App.tsx             # Root layout & route container
│       │   └── main.tsx
│       ├── index.html
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                     # Shared TypeScript contracts
│       ├── src/
│       │   ├── schemas/            # Zod schemas (Auth, Chat, File, Call)
│       │   ├── types/              # Inferred TypeScript interfaces
│       │   ├── events/             # Socket.IO event name constants
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── .agents/
│   ├── rules/
│   │   └── coding-standards.md     # Strict TS, Zod validation, zero binary proxying
│   ├── skills/
│   │   └── gcs-cors-setup/
│   │       ├── SKILL.md            # GCS CORS setup guide
│   │       ├── cors.json           # GCS CORS policy file
│   │       └── set-cors.sh         # CORS automation script
│   └── mcp_config.json             # MCP server definitions
├── implementation_plan.md          # Workspace implementation design
├── package.json                    # Monorepo npm workspaces config
└── README.md
```

---

## 3. Database Schema (Prisma ORM)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String      @id @default(uuid())
  email        String      @unique
  username     String      @unique
  displayName  String
  passwordHash String
  avatarUrl    String?
  status       String      @default("OFFLINE") // ONLINE, BUSY, OFFLINE
  lastSeenAt   DateTime    @default(now())
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  conversations ConversationParticipant[]
  sentMessages  Message[]
}

model Conversation {
  id           String      @id @default(uuid())
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  participants ConversationParticipant[]
  messages     Message[]
}

model ConversationParticipant {
  id             String       @id @default(uuid())
  conversationId String
  userId         String
  joinedAt       DateTime     @default(now())
  lastReadAt     DateTime     @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
}

model Message {
  id              String        @id @default(uuid())
  conversationId  String
  senderId        String
  clientMessageId String        @unique
  content         String
  attachmentUrl   String?
  attachmentName  String?
  attachmentSize  Int?
  attachmentMime  String?
  status          String        @default("SENT") // SENT, DELIVERED, READ
  createdAt       DateTime      @default(now())

  conversation    Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender          User          @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
}
```

---

## 4. REST API Endpoints

- `POST /api/auth/register`: Register user with bcrypt hashing and return JWT.
- `POST /api/auth/login`: Validate credentials and return JWT.
- `GET /api/auth/me`: Fetch authenticated user profile.
- `PATCH /api/users/profile`: Update display name, avatar URL, or manual status.
- `GET /api/users`: Fetch list of registered users with presence status.
- `GET /api/conversations/:peerId/messages`: Cursor-based message history between current user and peer.
- `POST /api/files/sign`: Validate file size $\le 50\text{MB}$ (52,428,800 bytes), MIME type, and generate GCS V4 Signed PUT URL (15-min expiration) with local dev fallback.
- `GET /api/webrtc/ice-servers`: Dynamic STUN & ICE servers configuration.

---

## 5. Socket.IO Events & Signaling Gateway

- `user:presence_changed`: Broadcasts user status changes (`ONLINE`, `BUSY`, `OFFLINE`).
- `chat:send`: Client sends message with optimistic `clientMessageId`. Persisted to DB and forwarded to recipient.
- `chat:receive`: Dispatched to recipient socket when a new message arrives.
- `chat:delivered`: Emitted when message reaches recipient client.
- `chat:read`: Emitted when recipient views messages; updates DB read state.
- `chat:typing`: Live typing status indicator broadcast.
- `call:initiate`, `call:incoming`, `call:accept`, `call:reject`, `call:end`, `call:offer`, `call:answer`, `call:ice_candidate`: WebRTC 1-on-1 calling state machine.

---

## 6. PWA & UI Layout

- Modern, sleek dashboard UI with dark glassmorphic styling, responsive layout, and accessible controls.
- "Install App" banner in the header to trigger browser installation.
- In-call overlay with PiP local video view and full remote stream.
- Upload progress bar for direct GCS file uploads.
