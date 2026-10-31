# Future responder role verification contract

This is a Stage 2/3 integration boundary only. Stage 1 ships no verification server, OTP flow, credentials, trust roots or privileged channels. The mobile RoleVerificationProvider interface is backed by a stub that always returns unverified.

## Trust rules

- Citizen, volunteer and medical/support roles are self-selected labels.
- Selecting emergency staff only displays **Unverified emergency staff**.
- Email OTP proves control of an address, not employment or authorization. It must never grant a responder badge or access by itself. Staff may bypass any future OTP step and continue offline; they remain unverified.
- An unsigned profile packet is untrusted display data and cannot set verification state.
- A later verifier must confirm an approved organization/roster or complete documented manual review before issuing a credential.

## Proposed Next.js API

The future service may expose authenticated, rate-limited routes:

1. POST /api/verification/otp/request accepts an address and purpose, returns a generic request result and short-lived challenge ID.
2. POST /api/verification/otp/verify accepts challenge ID and code and returns only address-control status.
3. POST /api/verification/roles/request accepts the selected role, organization and device public-key fingerprint; this creates a pending staff review.
4. POST /api/verification/roles/approve is an administrator-only action requiring organization/roster/manual evidence. It issues a credential only after authorization.
5. GET /.well-known/talk2-verification-keys.json publishes versioned issuer public keys and key validity intervals.

The service is separate from the optional assistant Node backend. It is not implemented in this stage.

## Signed credential

The service signs a canonical, versioned payload using an issuer private key held only by the service:

~~~json
{
  "version": 1,
  "credentialId": "opaque-random-id",
  "issuer": "https://verify.example.org",
  "subjectKeyFingerprint": "sha256:...",
  "role": "emergency_staff",
  "organization": "approved organization identifier",
  "issuedAt": 0,
  "notBefore": 0,
  "expiresAt": 0,
  "keyId": "issuer-key-2026-01",
  "signature": "base64url-signature"
}
~~~

Use an explicitly versioned canonical encoding and an asymmetric signature scheme such as Ed25519. The app pins trusted issuer public keys, verifies signature, issuer, role, subject-key binding, validity interval and schema offline. It rejects unknown key IDs and malformed/expired credentials. A signed credential must not be editable profile JSON.

The app displays issuer, organization, credential expiry and last revocation-list refresh. While disconnected, revocation information can be stale; the UI must show that age and must not claim live revocation status. Key rotation publishes overlapping key validity and requires a deliberate app trust-store update. Private signing keys never ship in the APK.

## Stage 3: exact mobile seam and future call sites

The preceding credential display describes the future verifier, not a shipped
screen. Today `mobile/src/roleVerification.ts` defines
`RoleVerificationProvider.verifyRole({role, subjectKeyFingerprint, credential})`.
`StubRoleVerificationProvider` always returns `{verified:false, reason:"not_configured"}`.
It has no active network call site. `App.tsx` obtains labels from
`shared/onboarding.cjs:verificationDisplay(data.role)`; `RadarPeers.tsx` always
displays Unverified. `shared/location.cjs` discards incoming verification claims.
Stage 3 has no OTP client, service, credentials or issuer trust roots.

Future adapter integration:

1. Settings/onboarding optional verification action calls later provider online
   methods for OTP request/verify. Skipping stays available and unverified. OTP
   success creates address-control status only, never a staff credential.
2. Add a native device-proof bridge exposing SHA-256 of SPKI and signing a server
   nonce with Android Keystore alias `talk2.mesh.identity.v1`, currently loaded in
   `MeshRouter.loadIdentity`. The server verifies possession. Do not bind a
   credential to Settings.deviceId, a MAC, a profile claim, or the direct session's
   ephemeral key. The legacy mesh UUID is key-derived; the credential subject
   must be the full SHA-256 fingerprint, not that UUID.
3. Organization/roster or authorized administrator approval establishes staff
   membership separately, including NDRF/SDRF. Issue a short-lived credential
   (proposed maximum 24 hours) scoped to organization, role and demonstrated key.
   The issuer's signing secret stays on the server.
4. Credential install and Settings reload call verifyRole with the current native
   fingerprint. Keep a dedicated validated-result state; retain today's fail-closed
   selector until a real verifier is implemented/tested. Never broaden the stub's
   literal verified:false result to make demo credentials appear valid.
5. The direct `App.tsx:receive` profile branch and future signed mesh profile handler
   call the verifier against the authenticated peer key. A signed mesh origin proves
   key possession, not a role. Mismatched, unknown, expired or unsigned claims stay
   unverified. Direct session identity binding needs an explicit key proof too.

Offline validation must check canonical encoding, pinned issuer key ID, signature,
subject binding, organization/role scope and issued/not-before/expiry times. Clock
rollback must not extend validity. Use an authenticated signed rotation manifest
rooted in pinned trust, overlap old/new validity windows, and reject unknown keys
offline. Never trust issuer keys carried in an untrusted peer packet. Cached
revocations need a last-refresh timestamp; offline phones cannot know new
revocations. Show this age/limitation and expire credentials normally. Compromise
recovery needs a signed trust update or app update, not an unsigned key list.

No Next.js backend, administrator dashboard, server signing secret, mock verified
badge or deployment was built in Stage 3.
