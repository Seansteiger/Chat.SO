# Antigravity Coding Standards: Chat.SO

These rules must be strictly adhered to across all packages and subagents within the repository.

## 1. Strict TypeScript Compilation
- All TypeScript configuration files (`tsconfig.json`) across root, `apps/*`, and `packages/*` must enable:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```
- No usage of `any` type without explicit architecture justification and review. Always use typed interfaces or `unknown` with runtime type narrowing.

## 2. Mandatory Zod Schema Validation
- All incoming payloads—including REST API request bodies/query params and Socket.IO incoming message payloads—**must** be validated with Zod schemas defined in `packages/shared`.
- Any malformed payload must be rejected before triggering business logic or database queries.
- Controllers and socket handlers should receive inferred types (`z.infer<typeof Schema>`).

## 3. Strict Direct-to-Cloud Storage (Zero Binary Proxying)
- **Zero server-proxying**: Binary payloads (files, images, audio, video) must **never** be streamed, buffered, or multipart-uploaded through the Node.js / Express backend server.
- The Node.js server is exclusively responsible for authentication, validation, and generating Google Cloud Storage (GCS) V4 Signed PUT URLs with a 15-minute expiration window.
- The client browser must upload directly to GCS via HTTP PUT using XMLHttpRequest or Fetch stream with progress tracking.
- Hard file limit ceiling: **50MB (52,428,800 bytes)** enforced both client-side before upload and server-side in the signing endpoint.

## 4. WebRTC Signaling & State Machine Safety
- WebRTC calling logic must follow a deterministic state machine: `IDLE`, `CALLING`, `RINGING`, `NEGOTIATING`, `CONNECTED`, `TERMINATED`.
- Glare prevention: If both users initiate calls concurrently, the peer with the lexicographically higher UUID takes caller precedence, while the other transitions to receiver.
- Ephemeral TURN credentials must use dynamic HMAC-SHA1 tokens with an expiration timestamp. Never hardcode credentials into client bundles.
