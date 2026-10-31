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
