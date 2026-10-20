# DevLaunch — Staging Readiness Hardening Report

**Project Location:** `/Users/asimmaji/Desktop/devLaunch/devlaunch`  
**Date:** October 20, 2026  
**Auditor:** DevLaunch Engineering Team (Automated Agentic Audit)  
**Readiness Decision:** **READY WITH LIMITATIONS**

---

## 1. Executive Summary

A comprehensive staging-readiness audit was performed across the DevLaunch repository, encompassing the VS Code extension root, the Express 5 TypeScript backend template (`templates/backend/`), and the React 18 Vite frontend template (`templates/frontend/`).

- **Total Backend Tests:** 153 passing across 46 suites (0 failures, 0 skips).
- **Extension Tests:** 3 passing (0 failures).
- **Frontend Production Build:** Successful (`tsc && vite build` completed cleanly in 856ms).
- **Backend Production Build & Typecheck:** Successful (`tsc --noEmit` and `rimraf dist && tsc` completed cleanly).
- **End-to-End Browser Journey:** Validated on both mobile (375x667) and desktop (1280x800) viewports via automated browser subagent. Session persistence, route guarding, registration, login, logout, and password-reset state transitions verified without layout clipping, horizontal overflow, or uncaught console errors.

---

## 2. Node.js Runtime Verification

### Current Host Environment
- **Active Node.js:** `v22.14.0` (path: `/usr/local/bin/node`)
- **Active npm:** `10.9.2`
- **Host OS:** macOS Darwin (arm64)

### Verification Commands & Results
```bash
$ node -v
v22.14.0

$ npm -v
10.9.2

$ which nvm || which fnm || brew list --versions node
No alternate version managers or Node 24 binaries installed on host system
```

### Blocker Analysis & Engine Requirement
- **Requirement:** `templates/backend/package.json` specifies `"engines": { "node": ">=24.0.0" }`.
- **Finding:** Node.js 24 is not installed on this local development machine. Only Node.js `v22.14.0` is available.
- **Action Taken:** Per the audit specification, the engine requirement `"node": ">=24.0.0"` was **not** modified or lowered. All 153 backend tests, TypeScript compilations, and production builds succeed under Node.js `v22.14.0` without deprecated API usage.
- **Staging Blocker:** Runtime parity on native Node.js 24 must be verified in the staging CI/CD pipeline running on an official Node.js 24 runner (e.g. `node:24-alpine` container).

---

## 3. Authentication Flow Verification Status

### A. Completed & Verified Flows (High Confidence)
1. **Local User Registration:**
   - Valid payload creates user in MongoDB, returns HTTP 201 with sanitized user DTO.
   - Enforces name length (2-50 chars), email formatting, and password minimum length (8 chars).
   - Issues HTTP-only session cookie (`devlaunch_token`) with `SameSite=Lax`, `Path=/`, and `HttpOnly`.
   - Rejects duplicate email registrations with HTTP 409 Conflict.
   - Strictly ignores client-supplied privileged attributes (`role`, `providers`, `tokenVersion`, `googleId`).
2. **Local User Login & Anti-Enumeration:**
   - Verifies credentials using constant-time bcrypt comparison (`comparePassword`).
   - Returns identical generic HTTP 401 (`"Invalid email or password."`) for incorrect passwords, non-existent emails, and accounts registered exclusively via Google OAuth.
3. **Session Restoration & Route Guarding:**
   - `GET /api/auth/me` with session cookie restores session and hydrates user context.
   - Protected routes (`ProtectedRoute`) render loading state during hydration and redirect unauthenticated users to `/login?from=...`.
   - Browser page reloads preserve the authenticated session seamlessly via HTTP-only cookie.
4. **Session Invalidation & Revocation:**
   - `POST /api/auth/logout` clears `devlaunch_token` via matching Set-Cookie header.
   - Password reset atomically increments `user.tokenVersion`, immediately invalidating all active sessions issued prior to the reset across all devices.
   - Subsequent requests to `/api/auth/me` with previous tokens return HTTP 401 (`"Session has expired or been revoked."`).
5. **Password Reset Security Lifecycle:**
   - Enforces 60-second resend cooldown; duplicate requests within the window do not send emails or reset OTP expiry.
   - Enforces 10-minute OTP expiration timestamp.
   - Generates zero-padded 6-digit OTPs (supports leading zeros such as `000001` without bias).
   - Timing-safe SHA-256 verification prevents side-channel attacks.
   - Atomic attempt tracking with `$inc`: exceeding 5 failed attempts invalidates the reset code and locks the flow.
   - Atomically consumes OTP upon verification and yields single-use `resetToken`.
   - Consumes `resetToken` atomically during reset; replay attacks are rejected with HTTP 400.
6. **CSRF & Origin Protection:**
   - State-changing mutations (`POST`, `PUT`, `PATCH`, `DELETE`) with unauthorized `Origin` headers are blocked with HTTP 403 Forbidden.
   - Authorized origins (`http://localhost:3000`) and non-browser CLI requests proceed normally.
7. **Rate Limiting:**
   - `loginLimiter`: 20 requests / 15 minutes per IP.
   - `registerLimiter`: 10 accounts / 1 hour per IP.
   - `forgotPasswordLimiter`: 10 requests / 15 minutes per IP.
   - `verifyOtpLimiter`: 15 requests / 15 minutes per IP.

### B. Unverified Flows (Pending External Staging Services)
1. **Live SMTP External Email Delivery:**
   - **Status:** Unverified with external mail servers.
   - **Reason:** No real SMTP credentials (e.g. Amazon SES, SendGrid, Mailgun) are configured in the repository. Local testing relied on the console logger and in-memory test log (`sentEmailsLog`).
   - **Requirement for Staging:** Configure valid `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and verify physical receipt in a staging mailbox.
2. **Live Google OAuth Cloud Sign-In:**
   - **Status:** Unverified with live Google servers.
   - **Reason:** No registered Google Cloud Console OAuth Client ID or Client Secret exists in local `.env`. All OAuth token exchanges, ID token cryptographic validations, and callback flows were verified via mocked service seams.
   - **Requirement for Staging:** Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in the staging environment.

---

## 4. Mobile & Responsive Layout Audit

### Methodology
Automated browser testing was conducted at:
1. **Mobile Viewport:** `375px` width × `667px` height (iPhone SE / narrow mobile standard).
2. **Desktop Viewport:** `1280px` width × `800px` height.

### Verification Results
| Page / Flow | Viewport | Visual & Responsive Behavior | Console Errors | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Landing Page (`/`)** | 375x667 | Clean header wrap, responsive hero text, no horizontal overflow (`scrollWidth === clientWidth`). | 0 errors | **PASS** |
| **Login Page (`/login`)** | 375x667 | Centered card, input fields, Google sign-in button, and action links cleanly fit narrow width. | 0 errors | **PASS** |
| **Signup Page (`/signup`)** | 375x667 | Form inputs, label associations, validation hints, and submit button scale correctly. | 0 errors | **PASS** |
| **Dashboard (`/dashboard`)** | 375x667 | Mobile navigation drawer collapses; project stats stack vertically without clipping; action buttons accessible. | 0 errors | **PASS** |
| **Profile (`/profile`)** | 375x667 | User avatar badge, details list, and sign-out controls fit screen; readable text sizes. | 0 errors | **PASS** |
| **Forgot Password (`/forgot-password`)** | 375x667 | Stage 1 and Stage 2 forms fit narrow width; 60s cooldown timer clearly visible. | 0 errors | **PASS** |
| **Desktop Layouts** | 1280x800 | Full sidebar navigation, horizontal stats grid, centered forms, sticky navbar. | 0 errors | **PASS** |

### Evidence Artifacts
- **Recording Video:** [`auth_e2e_verification_1792484704542.webp`](file:///Users/asimmaji/.gemini/antigravity-ide/brain/c243a532-9bfe-4605-be33-082395117294/auth_e2e_verification_1792484704542.webp)
- **Responsive Audit Video:** [`mobile_desktop_readiness_1792485486734.webp`](file:///Users/asimmaji/.gemini/antigravity-ide/brain/c243a532-9bfe-4605-be33-082395117294/mobile_desktop_readiness_1792485486734.webp)
- **Mobile Limitation:** Physical touch interactions and platform-specific software keyboards (e.g. iOS Safari virtual keyboard viewport resizing) remain pending verification on actual physical devices.

---

## 5. Security & Deployment Audit Findings

### Findings Classification

#### ⚠️ WARNINGS (Requires Staging Deployment Configuration)
1. **Reverse Proxy TLS Termination (`trust proxy`):**
   - **Finding:** In `src/app.ts`, Express default `trust proxy` is disabled (`false`). When deployed in staging behind a reverse proxy or load balancer (e.g. AWS ALB, Cloudflare, NGINX), `req.secure` will evaluate to `false` and `req.ip` will reflect the proxy's IP address rather than the client's.
   - **Impact:** Cookies with `secure: true` in production will not be sent unless Express trusts the proxy. In addition, IP-based rate limiting would throttle the proxy rather than individual clients.
   - **Recommendation:** In the staging entrypoint/config, set `app.set('trust proxy', 1)` (or appropriate hop count).

2. **In-Memory Rate Limiting vs. Clustered Instances:**
   - **Finding:** `templates/backend/src/middleware/rateLimiter.ts` uses an in-memory sliding-window map.
   - **Impact:** Acceptable for a single staging instance. In a multi-instance staging cluster, counters are not synchronized across instances.
   - **Recommendation:** Single-instance staging is supported. Multi-instance staging should back rate limiters with Redis (`rate-limit-redis`).

3. **MongoDB Production Index Pre-Creation:**
   - **Finding:** Schema indexes (`email` unique, `googleId` unique sparse, `passwordResetTokenHash` index) rely on Mongoose `autoIndex: true` in development.
   - **Impact:** `autoIndex` can degrade staging/production startup performance and should be disabled in high-scale environments.
   - **Recommendation:** Ensure deployment scripts or MongoDB migrations execute `db.users.createIndex({ email: 1 }, { unique: true })` prior to traffic cutover.

#### ℹ️ INFORMATIONAL (Verified Working Controls)
1. **Fail-Fast Environment Validation:** `env.ts` guarantees startup failure with sanitized messages if `MONGODB_URI` or `JWT_SECRET` (< 32 chars) are missing.
2. **Safe DTO Exposure:** Public APIs never return `password`, `googleId`, `tokenVersion`, or password reset hashes.
3. **No Frontend Token Storage:** Neither access tokens nor passwords nor reset credentials are stored in `localStorage` or `sessionStorage`.
4. **CSRF Defense-in-Depth:** Origin validation rejects unauthorized cross-origin POST/PUT/DELETE requests with HTTP 403.

---

## 6. Frontend Testing Architecture Gap

- **Current State:** `templates/frontend/package.json` contains scripts for `dev`, `build`, and `preview`. There is no unit test runner (Vitest/Jest) or component test library (`@testing-library/react`) installed.
- **Audit Decision:** Per guidelines to avoid broad dependency migrations during hardening, heavy test dependencies were not unilaterally installed in this step.
- **Verification Performed:** Type safety was verified through `tsc --noEmit` and Vite production bundle compilation (`vite build`), while user journeys were validated through end-to-end browser subagent automation.
- **Recommendation:** Introduce Vitest + `@testing-library/react` during the designated frontend testing chunk.

---

## 7. Files Created or Modified

| File Path | Status | Rationale |
| :--- | :--- | :--- |
| [`templates/frontend/vite.config.ts`](file:///Users/asimmaji/Desktop/devLaunch/devlaunch/templates/frontend/vite.config.ts) | Modified | Added `process.env.VITE_BACKEND_TARGET \|\| 'http://localhost:5000'` to proxy target so local developers on macOS can point Vite to alternate ports when port 5000 is occupied by ControlCenter. |
| [`templates/frontend/.env.example`](file:///Users/asimmaji/Desktop/devLaunch/devlaunch/templates/frontend/.env.example) | Modified | Documented `VITE_BACKEND_TARGET` configuration option. |
| [`templates/backend/test/e2e.audit.test.ts`](file:///Users/asimmaji/Desktop/devLaunch/devlaunch/templates/backend/test/e2e.audit.test.ts) | Created | Added 24-assertion comprehensive automated end-to-end integration test suite exercising the entire registration, login, logout, password reset, session revocation, and origin validation lifecycle. |
| [`reports/staging-readiness.md`](file:///Users/asimmaji/Desktop/devLaunch/devlaunch/reports/staging-readiness.md) | Created | Generated this official staging readiness audit report. |

---

## 8. Final Decision & Next Required Action

### Decision
### **READY WITH LIMITATIONS**

### Prerequisites for Staging Deployment
1. **Staging Environment Variables:** Populate `SMTP_*` variables with a staging mailer service and `GOOGLE_*` variables with a registered Google OAuth staging client.
2. **Node.js 24 CI Pipeline:** Execute the backend test suite inside a Node.js 24 container in CI to verify runtime engine compatibility.
3. **Reverse Proxy Configuration:** Ensure `trust proxy` is set to `1` when deploying behind a TLS-terminating load balancer.
4. **Physical Device Testing:** Perform quick manual smoke tests on physical iOS and Android mobile browsers once deployed to staging.
