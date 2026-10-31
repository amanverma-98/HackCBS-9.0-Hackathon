# Talk2: source-specific three-stage implementation brief

Snapshot reviewed: `HackCBS-9.0-Hackathon-main.zip`, archive commit `eea42b60fbff4ad75190cb58395b7d9a88e77482`, 31 October 2026. This document is a handoff for the VS Code Codex coding agent. Run **one stage per agent session**. Stage 2 starts only after Stage 1 is checked in; Stage 3 starts only after Stage 2 is checked in.

## Current code: facts that control the plan

| Area | Actual implementation | Consequence |
|---|---|---|
| Radio | `mobile/android/app/src/main/java/com/talk2/PeerRadio.java`: one authenticated Bluetooth **Classic RFCOMM** socket or one Wi-Fi Direct TCP socket. `discoverBluetoothServices()` uses classic discovery/SDP. `Session session` holds one link, and `host`/`join` call `disconnect()`. | This is **not BLE** or multi-peer mesh. Preserve it as a legacy direct path while introducing a separate BLE transport. Do not assume the current radio can relay three devices. |
| Security | `SecureChannel.java`: ephemeral P-256 ECDH, six-digit pairing code, HKDF/AES-GCM; key is per direct session. | Forwarded messages need stable origin IDs, end-to-end authentication/encryption, and relay envelopes. Hop encryption alone lets the relay read content. Do not display a verified badge from an untrusted profile packet. |
| UI/state | `mobile/App.tsx` (~66 KB) owns setup, tabs, messages, settings and radar; `Talk2Module.java` is native bridge; `saveState` persists one JSON blob in SharedPreferences. | Extract focused modules as changes are made; preserve migrations for saved settings/history. A bounded relay outbox should not grow inside the 2 MB JSON blob. |
| Voice | `SpeechEngine.java` records 16 kHz PCM16; `VoiceTransfer.java` sends bounded chunks through the one direct radio. Translated mode sends recognized **text**; receiver synthesizes speech. | Reuse existing capture/playback and chunk integrity. It is not live audio-to-audio or mesh voice yet. |
| Languages | `shared/core.cjs`, `shared/alerts.json`, partial `tabNames` in `App.tsx`; most UI strings are English. `TranslationEngine.java` explicitly accepts only `hi ↔ mr`. | Localize the whole UI from static strings; a downloaded ONNX pack does not translate UI. Never claim arbitrary speech translation works. |
| Models | `ModelStore.java` and `model-host/upstream-manifest.json` pin size/SHA-256 and resume downloads. Nine speech packs plus three translation files; **Hindi speech files are absent** from release. | Keep checksum checks. Permit offline onboarding and Original voice without downloads. Show accurate pack availability and storage sizes. Hindi speech needs compatible weights or a truthful unavailable state. |
| Radar | `App.tsx` draws a single peer dot from shared GPS and heading; one discovery list. | Move to a peer collection, one shared filter for dots and list; dots anonymous, details below. Do not derive direction from BLE RSSI. |
| Backend | `server/index.mjs` is optional assistant backend, not staff identity service. | Build separate Next.js verification service later; mobile adapter only in these stages. |

Development baseline from README: Node 22+, JDK 17, Android SDK 35, Build Tools 35.0.0, NDK 26.1.10909125; `npm ci`, `npm run check`, `cd mobile/android`, `gradlew.bat :app:installDebug`. Debug package `com.talk2.dev`. Read `docs/STATUS.md`, `docs/BUILD.md`, `docs/DEVICE_TESTS.md` and `docs/WORK_CHECKPOINT.md` first. The snapshot reports automated checks and an Android build, but physical phone acceptance is pending. Do not silently promote historical build reports into fresh results.

## Reference research and reuse decision

- [BitChat Android](https://github.com/permissionlesstech/bitchat-android): BLE advertising/scanning, bounded relay TTL, fragmentation/deduplication, retry, foreground service. Its README claims public-domain licensing while GitHub repository metadata has also displayed GPL-3.0; inspect the exact checked-out `LICENSE` and file provenance before copying. Use design ideas until resolved.
- [ResQMesh](https://github.com/jangkayl/ResQMesh): GATT and optional L2CAP, three direct neighbors, independent SOS lifecycle, reporter/helper incident states, persistent custody/recipient receipts. Its README expressly reports intermittent far-end loss; use tests as a design priority. Check its license before reuse.
- [Knit](https://github.com/getknit/knit): BLE + Wi-Fi Aware transport seam, bounded flooding, store-and-forward, voice notes and optional walkie mode. GPL-3.0-or-later; review as architecture, or comply with the license if copying code.

Record project, commit, exact file, license and whether code was copied in `docs/THIRD_PARTY.md`. Do not describe someone else's implementation as Talk2's original work. The hackathon MVP should not add Nostr, Tor, LoRa, offline maps, video, or live multi-hop calls.

## Product rules shared by all stages

Citizen/volunteer enrollment works without internet. Medical/support and emergency-team roles are self-declared unless a credential verifies offline. A staff member may skip OTP, but display **Unverified emergency staff**; no official organization badge or privileged team channel follows from role selection. Email OTP alone proves control of an address, **not employment in NDRF/SDRF**. A future administrator must authorize the staff role after domain/roster/manual organization checks. The Next.js server signs a short-lived credential containing issuer, subject public-key fingerprint, approved role/organization, issued/expiry times, version and credential ID. Mobile pins issuer public keys and verifies offline; revocation is stale while disconnected, so display verification age and expiry. Private keys remain on the device/server respectively.

Users can choose UI language separately from source speech, recipient target and TTS voice. UI translations are small bundled JSON resources so offline setup stays usable; ONNX packs remain optional downloads. Receiver translates recognized text locally only for validated language pairs. Original audio remains available when packs are absent. A recipient who cannot translate sees the source text with a clear language label.

Radar shows colored dots and compass/range rings, with a short legend beneath. A shared filtered peer array controls both radar and the discovery list below. Names, roles, verification, last-seen, direct/relayed, distance and connect action belong in the list only. GPS coordinates shared with consent determine distance/bearing; BLE RSSI alone gives no angle or reliable metres. Relayed peers without fresh coordinates appear only in the list.

## Stage 1 — onboarding and multilingual foundation

**Goal:** preserve the working direct app while adding offline roles, complete UI localization, model readiness and a future verification boundary. Do not change radio transport yet.

**Likely touchpoints:** `mobile/App.tsx`, `mobile/src/native.ts`, `shared/core.cjs`, new `mobile/src/i18n/*`, `ModelStore.java`, `model-host/upstream-manifest.json`, docs. Keep existing `ProfilePhoto.java`, `VoiceTransfer.java`, and `SecureChannel.java` behavior.

**Acceptance:** profile role persists across restart; citizen proceeds offline; staff bypass is visibly unverified; no fake verified badge; Marathi selection translates all visible navigation/onboarding/settings/radar/alerts, with fallback for missing keys; pack download progresses/resumes/verifies and Original voice/text work without pack; exact `hi ↔ mr` translation boundary remains explicit; old saved JSON loads. Report exact static checks/build and two-phone results separately.


## Stage 2 — real multi-peer BLE text/SOS mesh

**Goal:** implement an independent native BLE scan/advertise/GATT transport plus a bounded neighbor manager; keep `PeerRadio` direct Classic/Wi-Fi Direct path available. Relay text and SOS across A–B–C. A single BLE connection is still one hop; multi-hop comes from B's packet router.

**Likely touchpoints:** new Java `BleMeshTransport`, `MeshRouter`, packet codec and persistent outbox/seen cache; bridge additions in `Talk2Module.java`/`mobile/src/native.ts`; App peer store/radar/alerts; manifest adds BLE/service permissions as actually needed. Design concurrent GATT central/peripheral roles and a small configurable neighbor limit based on device evidence, not a guaranteed 3–8 count. Include discovery TTL, backoff, duplicate suppression, expiry, bounded queues, per-neighbor flow control and packet authentication. Define direct ACK versus destination receipt; a relay ACK is custody, not delivery. Keep a versioned packet envelope separate from the old direct frame, with migration/capability negotiation. For broadcast SOS, define who can acknowledge and cancel; only signed origin may cancel its alert. Require an opt-in foreground service before claiming locked-screen operation.

**Acceptance:** protocol unit checks; real two-phone BLE text; three phones with A and C demonstrably out of direct range, B forwarding; dedup, TTL, restart queue, delayed receipt and connection recovery; SOS priority/cancel; radar anonymous dots, legend and shared filters. Record phone models, Android versions, radio toggles, battery mode, timestamps, logs and actual topology. If only simulation is possible, label physical mesh unverified.

### Copy into VS Code Codex: prompt 2

```text
Continue STAGE 2 ONLY from Talk2-staged-Codex-plan.md and docs/WORK_CHECKPOINT.md. Read git status, current implementation, Stage 1 audit and THIRD_PARTY first. Preserve working Classic RFCOMM/Wi-Fi Direct direct mode; the current PeerRadio.java has exactly one Session and is NOT BLE mesh.

Implement native Android Java BLE advertiser/scanner/GATT client/server, a bounded multi-neighbor manager, stable local device identity, and versioned mesh envelope. Introduce fragmentation/reassembly with limits, messageId/TTL/hop/expiry, seen cache, priority outbox, retry/backoff, direct custody ACK and end-recipient delivery ACK. Use existing security primitives where applicable, but distinguish per-link authentication from end-to-end message integrity; do not expose sensitive content to relays by accident or claim E2EE without an implemented origin-to-recipient scheme. Persist bounded pending packets independently of the 2 MB SharedPreferences state. Add optional foreground service only with user control and Android requirements.

Implement text and SOS multi-hop first; preserve direct voice/translated-text paths. Use BitChat for bounded relay/dedup concepts, ResQMesh for independent SOS and custody-vs-delivery lifecycle, Knit for transport seam/store-forward. Inspect LICENSE and file provenance before code reuse; update THIRD_PARTY. Never blindly merge Kotlin code or add a second contradictory BLE library.

Radar: use one filtered peer collection for anonymous colored dots and discovery list below. Put compact legend/filter controls beneath the radar. No labels on dots; list contains name/role/verified status/last-seen/direct-or-relayed/distance when fresh GPS available. Self-declared staff have no verified color. No GPS means no directional dot; list still shows discovery.

Check packet tests and current app checks. Provide physical device cards for 2-phone direct and 3-phone A–B–C with A/C unable to directly hear one another; never claim success based solely on emulator tests. Update docs/WORK_CHECKPOINT.md with evidence and exact Stage 3 entry point. Stop after Stage 2.
```

## Stage 3 — voice across mesh and responder credential seam

**Goal:** extend the working mesh to short voice notes and validated multilingual text-to-speech delivery. Add one optional higher-bandwidth transport only if physical BLE mesh is stable. Future Next.js credential service is a documented interface, not a hackathon prerequisite.

**Likely touchpoints:** reuse `VoiceTransfer.java`, `SpeechEngine.java`, `TranslationEngine.java`, `ModelStore.java`; add mesh voice frames/storage/custody, `Talk2Module.java`, `App.tsx`; Next.js API contract under `docs/VERIFICATION_API.md`. Do not make an unverified speech pair appear validated. Hindi model gap and large pack sizes must remain visible. Priority SOS interrupts bulk voice transfer; bounded voice storage cleans incomplete clips. Transmit transcript with source language; receiver translates only supported pair and synthesizes in its selected installed voice. Original voice fallback works without ONNX.

**Acceptance:** direct Original voice regression, two-phone BLE short note, three-phone voice-note relay if radio capacity allows, chunk integrity/retry/expiry and interruption; Hindi/Marathi supported translation exercise with real compatible models, Marathi UI coverage, missing-pack behavior, GPS/compass accuracy and opt-in location expiry; actual transport displayed. Mark unperformed physical/model tests as pending.

### Copy into VS Code Codex: prompt 3

```text
Continue STAGE 3 ONLY from Talk2-staged-Codex-plan.md and latest docs/WORK_CHECKPOINT.md. Inspect git status, Stage 2 hardware evidence, current voice/ONNX signatures and manifest. Preserve direct mode, text/SOS mesh, role labels, UI translations and pack checks.

Reuse existing 16 kHz PCM capture/VoiceTransfer integrity and existing ONNX paths. Add bounded short voice-note framing to the versioned mesh protocol with chunk order, hash, size/duration cap, retry, expiry, incomplete-clip cleanup, and priority yielding to SOS. Original voice must play without any speech pack. Translated mode sends recognized text with source language and synthesizes locally on recipient, translating only validated pairs (currently hi–mr); distinguish this from a transmitted translated waveform and from live calling. Never invent ONNX tensors or advertise unsupported pairs. If Hindi weights remain absent, label that route blocked and demonstrate available English Original voice or another valid tested route. Keep UI language independent of speech settings.

Use location consent and fresh accuracy/time from existing sensor bridge, Haversine distance and compass bearing. Anonymous radar dots, legend and shared discovery-list filtering must remain intact. If BLE voice is proven insufficient on physical phones, implement exactly ONE optional Wi-Fi Aware or Nearby high-bandwidth route behind mesh transport selection, document device support and true fallback; otherwise defer it and state why.

Write docs/VERIFICATION_API.md for a separate future Next.js service: request OTP, verify OTP, authorized staff/organization approval, sign short-lived credential bound to device key, public key rotation, offline verification and expired/revoked display state. Email OTP must never by itself grant NDRF/SDRF verification. App adapter can later call API when online; staff bypass remains unverified. Do not hardcode test issuer signing keys as production trust roots or build the server unless specifically requested.

Run relevant automated checks and record exact results; provide two-phone and three-phone test cards and model/language evidence. Update README, THIRD_PARTY and WORK_CHECKPOINT with implemented features, demo steps, limits and next actions. Stop and report, without claiming physical reliability unless tested.
```

## Handoff discipline

After each stage, record: input git commit; branch and final commit; changed files; completed and unfinished acceptance criteria; exact build/test command outputs; APK package/version/signature; actual device evidence; known errors; next three tasks. Commit checkpoints with the source. A new agent begins by reading `docs/WORK_CHECKPOINT.md` and `git status`. Avoid uploading generated APKs/models into normal git history. For a hackCBS demo, a credible three-phone text/SOS relay and a verified real Marathi language path matter more than a long list of untested transports
