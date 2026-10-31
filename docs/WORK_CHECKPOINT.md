# Talk2 1.1 work checkpoint

Input snapshot: commit b9d8507365aabb85a049303a376d66d4bba13032.

Completed:
- Model URLs pinned to Somu9450/Talk2 model-pack-v1 and verified by size/digest.
- Reliable microphone press lifecycle and automatic translated-message send.
- Optional transcript review and original encrypted voice-message transfer.
- Voice playback/history/retry, haptics, sounds, auto-play and nearby cue settings.
- Stationary GPS refresh, explicit location revocation and improved radar status.
- Local profile photo during onboarding and Settings.
- Green/orange settings redesign, privacy controls and diagnostics navigation.
- Separate com.talk2.dev debug package for Metro development.
- Source, README and docs updated as an independent Talk2 project.
- Node, TypeScript and Java tests passed.
- Clean Android ARM64 standalone APK and unsigned AAB built successfully.

Final outputs and hashes are recorded in BUILD_RESULT.md and dist/SHA256SUMS.txt.
Physical two-phone acceptance remains in DEVICE_TESTS.md. If work resumes, start with
the user's device logs and exact failed acceptance-test step rather than rebuilding
the completed implementation.

## Stage 1 checkpoint

Input commit: 6ca408d0e7d41dd580f5fd6a42f9d885e46ae584 on feature/offline-mesh.
Stage 1 implementation commit: 882f24c44c49a8a698bffac3f4dae530fddd2e15
on feature/offline-mesh.

Implemented:

- Persisted citizen, volunteer, medical/support and emergency staff role selection.
  Staff remain unverified; email control, self-selection and profile packets do not
  grant verification. The local RoleVerificationProvider stub always returns false.
- Documented the future separate Next.js OTP/admin-review API and signed,
  device-key-bound offline credential contract. No service was built.
- Migrated old Settings JSON to version 2 and save the migrated shape; separate
  UI language, source speech, translation target and TTS voice settings persist.
- Bundled English/Marathi UI strings. Other offered UI languages have structured
  English fallback and report missing-key coverage. Current catalog coverage is
  100% for Marathi and 0% for the other offered script languages.
- Kept profile photos local and did not change PeerRadio or direct RFCOMM/Wi-Fi
  Direct transport behavior.
- Kept ModelStore checksum validation, HTTP Range resume and atomic ready marker.
  Pack status now reports manifest availability, verified installed state,
  cumulative expected/downloaded bytes, pause/resume, retry and removal states.
- Hindi speech remains unavailable in the supplied manifest. General ONNX
  translation remains Hindi↔Marathi only. Onboarding, text and Original voice do
  not require a model download or internet connection.
- Inspected BitChat Android LICENSE.md (GPL-3.0), Knit COPYING (GPL-3.0), and the
  ResQMesh root listing (no license file found). No external code was reused.

Changed files:

- README.md
- docs/ARCHITECTURE.md
- docs/CURRENT_AUDIT.md
- docs/DEVICE_TESTS.md
- docs/STATUS.md
- docs/THIRD_PARTY.md
- docs/VERIFICATION_API.md
- docs/WORK_CHECKPOINT.md
- mobile/App.tsx
- mobile/android/app/src/main/java/com/talk2/ModelStore.java
- mobile/android/app/src/main/java/com/talk2/Talk2Module.java
- mobile/src/roleVerification.ts
- shared/i18n.cjs
- shared/model-packs.cjs
- shared/onboarding.cjs
- tests/stage1.test.cjs

Checks and results:

- npm run check — PASS; 17 Node tests and mobile TypeScript typecheck.
- git diff --check — PASS; no whitespace errors.
- .\gradlew.bat :app:testDebugUnitTest :app:assembleDebug --console=plain
  with workspace-local GRADLE_USER_HOME — BUILD SUCCESSFUL. Gradle reported
  :app:testDebugUnitTest NO-SOURCE; the standalone Java harness is separate.
- .\gradlew.bat :app:assembleDebug --console=plain with workspace-local
  GRADLE_USER_HOME and ANDROID_USER_HOME — BUILD SUCCESSFUL, incremental final
  source build. Gradle reports existing Gradle 9 deprecation warnings.
- PowerShell equivalent of scripts/test-java.sh, using Maven org.json 20240303
  and javac -encoding UTF-8 — PASS: SecureChannel tests (matching SAS,
  bidirectional encryption, replay/reflection/tamper/wrong-session rejection),
  ModelStore tests (uninstalled/verified/tampered/removed, duplicate manifest and
  traversal rejection), and VoiceTransfer tests (clip limit, ordering, integrity,
  path bounds).
- The repository Bash script itself could not launch because this Windows session's
  bash.exe was inaccessible; the same three Java test groups were run directly.
- No physical phone validation was performed. Complete DEVICE_TESTS.md on actual
  devices; direct two-phone chat and all hardware behavior remain unverified here.

Unresolved:

- No signed issuer keys, credential verification, OTP, administrator review or
  server endpoint exists yet. Every role stays unverified.
- Hindi speech assets are absent. Translation model inference is limited to
  Hindi↔Marathi. Other UI languages use English fallback and are not localized.
- Device persistence/restart, radio continuity, microphone/voice, model downloads
  and actual on-screen Marathi rendering still need physical-device acceptance.
Stage 2 entry point: reread this checkpoint and the Stage 2 section plus “Copy into
VS Code Codex: prompt 2” in Talk2-staged-Codex-plan.md. Start with bounded BLE
transport/mesh design while retaining the currently working direct RFCOMM/Wi-Fi
Direct path. Do not claim relay or hardware validation from this Stage 1 work.

## Stage 2 checkpoint

Input checkout: `fa4de0eea50e2640f6339cac0ed9c8491283c538` on `main`, clean before
Stage 2. `docs/PROJECT_AUDIT.md` is absent; `docs/CURRENT_AUDIT.md` was used and
updated with the Stage 2 pre-edit state and planned file set. `origin/main` advanced
to `b42599c020cdc61e7341ec6e975daedd22c79603` during the task; it was merged and
the Stage 2 changes were retained in merge commit `13857f64bca8574357010b9be99ad5f7922475d5`.

Implemented for Stage 2:

- Added separate native BLE advertiser/scanner/GATT client/server transport and
  bounded three-neighbor management. `PeerRadio.java`, `SecureChannel.java`,
  direct RFCOMM/Wi-Fi Direct, speech and voice transport were not edited.
- Added a versioned signed packet envelope (P-256 Android Keystore origin key),
  text/SOS/custody/receipt types, 8 KiB packet and 1,200-character body bounds,
  24-hour expiry, four-hop cap, ATT-MTU-aware chunking up to 160 payload bytes,
  bounded reassembly, duplicate
  suppression, 16-item AtomicFile queue and bounded seen cache. GATT writes are
  serialized per link, with write retry/backoff; routed packets retry while
  pending. Queue is separate from the saved Settings/history JSON.
- Added Radar opt-in controls for BLE public text and SOS. UI warns that relays can
  read message bodies. Mesh stops on app pause; no foreground service or
  locked-screen claim was added.
- Added `docs/REFERENCE_IMPLEMENTATION_MAP.md` before implementation and updated
  third-party license notes, architecture, status, README and device test cards.
- Added focused Java `MeshPacketTest` and `MeshFragmentCodecTest` coverage for
  signatures, tampering, TTL and size bounds, default/negotiated MTUs, out-of-order
  assembly, duplicates and malformed frames; wired them into `scripts/test-java.sh`.

Known limits and unresolved acceptance:

- Mesh is an experimental prototype; only physical two-phone and three-phone
  tests can establish BLE operation and A–B–C relay. No phones were available,
  so no hardware validation is claimed.
- Packet bodies are not end-to-end encrypted. Signatures authenticate a
  key-derived device ID and protect integrity, but do not verify a person's role
  or organization. Never send private details through BLE mesh text.
- SOS broadcast lacks signed origin-only cancellation and a full incident state
  machine. Broadcast SOS has no destination receipt. Peer radar currently has no
  location sharing over mesh; BLE RSSI is not used for position.
- ResQMesh's exact immutable source revision could not be verified in this
  research session. No external code was copied. See REFERENCE_IMPLEMENTATION_MAP.
- No connected phones were available. Physical device cards 15–16 in
  DEVICE_TESTS.md remain pending; BLE range, A–B–C relay, reboot custody, retry
  timing, delivery receipts and OEM/battery behavior are not verified.

Changed files in the Stage 2 implementation commit:

- `.gitignore`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_AUDIT.md`,
  `docs/DEVICE_TESTS.md`, `docs/REFERENCE_IMPLEMENTATION_MAP.md`,
  `docs/STATUS.md`, `docs/THIRD_PARTY.md`, `docs/WORK_CHECKPOINT.md`
- `mobile/App.tsx`, `mobile/src/native.ts`,
  `mobile/android/app/src/main/java/com/talk2/BleMeshTransport.java`,
  `MeshFragmentCodec.java`, `MeshPacket.java`, `MeshRouter.java`,
  `Talk2Module.java`, `scripts/test-java.sh`, `shared/i18n.cjs`,
  `tests/MeshFragmentCodecTest.java`, `tests/MeshPacketTest.java`

Checks and exact results:

- `npm run check` — PASS: 17 Node tests and `tsc --noEmit` mobile typecheck.
- `git diff --check` — PASS.
- Standalone Java harnesses (PowerShell equivalent of `scripts/test-java.sh`,
  `javac -encoding UTF-8`, org.json 20240303): PASS for SecureChannel matching
  SAS/encryption/replay/reflection/tamper checks; ModelStore installed/tamper/
  manifest/path checks; VoiceTransfer size/order/hash/path checks; MeshPacket
  signature/tamper/hop/body/wire bounds; MeshFragmentCodec MTU-23/MTU-185 framing,
  out-of-order assembly, duplicate and malformed-frame checks. Output lines:
  `PASS: matching SAS...`, `PASS: uninstalled/verified/tampered/removed...`,
  `VoiceTransfer: maximum clip...`, `MeshPacketTest PASS`,
  `MeshFragmentCodecTest PASS`.
- Android command used the workspace-local Gradle 8.13 distribution directly:
  `$env:GRADLE_USER_HOME = Join-Path (Get-Location) 'mobile\.gradle-stage2-final';
  $env:ANDROID_USER_HOME = Join-Path (Get-Location) 'mobile\.android-stage2';
  & '.\mobile\.gradle-stage2\wrapper\dists\gradle-8.13-bin\5xuhj0ry160q40clulazy9h7d\gradle-8.13\bin\gradle.bat'
  -p mobile\android :app:testDebugUnitTest :app:assembleDebug --console=plain`
  — BUILD SUCCESSFUL in 3s on the merged main tree (52 actionable tasks, 3 executed,
  49 up-to-date). Java compilation and APK assembly were up-to-date and passed.
  Gradle reports `:app:testDebugUnitTest NO-SOURCE`; standalone Java harnesses provide
  protocol coverage.
- Debug APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, package
  `com.talk2.dev`, version `1.1.0-dev`, debug-signed, 130,117,060 bytes; SHA-256
  `447CCA11118D7333C413F6A46E6B78FBEABDCEC9058235EB8447439FE057FD94`.
- No APK was installed on a physical phone. No hardware validation is claimed.

Preserved concurrent workspace change: `mobile/android/gradle/wrapper/
gradle-wrapper.properties` changed during this session to Gradle 9.7.1 while
retaining the previous distribution checksum. It is excluded from the Stage 2
commit and remains unstaged; the wrapper rejected that download due to the
checksum mismatch. The Stage 2 build used the already downloaded Gradle 8.13
binary directly. Task-local Gradle caches are ignored by `.gitignore`; active
VS Code Gradle processes held cache locks, so their contents were left in the
workspace and are not part of the commit.

Stage 2 implementation commit: `03f3efd2f88eeb2977ce893af15a4542b5de06b0`.
Upstream integration merge: `13857f64bca8574357010b9be99ad5f7922475d5`.
The checkpoint update is committed separately after these implementation commits.

Stage 3 entry point: read this Stage 2 checkpoint and the Stage 3 section plus
“Copy into VS Code Codex: prompt 3” in Talk2-staged-Codex-plan.md. Extend short
voice-note transfer over a physically proven mesh, preserve the direct voice path,
and retain the signed-role verification boundary. Do not start Stage 3 before
Stage 2 commit and physical mesh evidence or an explicit decision to proceed with
those tests still pending.

## Stage 3 entry assessment (before source edits)

- Baseline: main at f95a6557f584c7cc9de00203cf89a5cb9c0ea9e1. The sole existing
  edit is mobile/android/gradle/wrapper/gradle-wrapper.properties (9.7.1 URL with
  8.13 checksum); preserve and exclude it. No AGENTS.md found in the checkout.
- Stage 2 implements signed v1 text, sos, custody and ack packets, four-hop TTL,
  24-hour expiry validation, three BLE neighbors, 16-entry AtomicFile queues,
  fragmentation and origin signatures. Tests cover envelope integrity/bounds and
  fragmentation. No two/three-phone physical result exists. adb enumeration initially
  failed on the environment's unwritable .android directory; device presence is not established.
- Mesh bodies are public, not E2EE. Signatures bind device keys, not people or roles.
  Mutable hop fields are not signed. Custody is not destination delivery. ACK
  targeting, queue expiry and bulk scheduling need narrow repairs for voice.
- Direct PeerRadio still uses authenticated SecureChannel over Classic RFCOMM or
  Wi-Fi Direct TCP. VoiceTransfer handles 16 kHz mono PCM, up to 20 seconds, local
  files and sequential direct frames. SpeechEngine.start/stop, VoiceTransfer.save/read,
  native playVoice, SpeechEngine.transcribe/speak and TranslationEngine.translate
  are reusable. Direct mode will remain separate from public mesh broadcast.
- Manifest: nine speech packs (ta,bn,gu,mr,kn,ml,te,or,en), no Hindi pack; shared
  translation accepts only hi <-> mr. No local ONNX weights found in the checkout;
  installed device packs and actual inference cannot yet be claimed. STT normalizes
  16 kHz PCM into a single-input CTC graph; TTS requires single-input MMS-VITS;
  translation feeds input_ids/attention_mask and decoder_input_ids/
  encoder_hidden_states/encoder_attention_mask. Actual weights require inspection.
- Radar currently uses one paired-peer location separately from its filtered list;
  no mesh location store exists. Freshness checks lack full accuracy/range checks.
- Planned edits: mesh voice protocol/storage/scheduling/tests; minimal packet/router/
  BLE priority fixes; bridge and UI for explicit public notes, transcript and states;
  shared language/location policy and tests; Marathi catalog; reference/license,
  model, architecture, verification and physical-test documentation. Original voice
  must remain independent of models/internet. No optional transport without measurements.

## Milestone 3A checkpoint

Implemented public broadcast Original voice in MeshPacket v1 (new voice body
schema v1), existing BLE transport/router, recording and playback. Explicit
confirmation states audio/transcripts are readable by relays. No private mesh
or E2EE claim. Direct PeerRadio/VoiceTransfer remain unchanged.

Limits: 3 seconds / 96,000 bytes 16 kHz mono PCM; 512-byte pieces, maximum 188;
2 outgoing / 6 active total / 32 retained records; 4 MiB spool; 30-minute expiry;
3 automatic whole-note rounds with 30-second gaps and one packet per second.
Metadata precedes allocation. Piece files and AtomicFile records support restart,
missing/out-of-order/duplicate pieces, integrity validation, signed-origin cancel,
cleanup, and separate custody/recipient receipts. Relay spool retains original
signed envelopes; relay receipt does not erase onward delivery data. Recipient
receipt means at least one public receiver durably saved the note, not all phones.

Narrow Stage 2 repairs: custody replies go to ingress (previously skipped it),
addressed custody checks, directed text ACK source matching, expired queue cleanup,
last-hop handling, reserved bulk capacity, and priority BLE packet queues. SOS
preempts queued bulk after the active packet completes; fragments are not interleaved.

Files: MeshVoiceStore.java, MeshSendQueue.java, MeshPacket.java, MeshRouter.java,
BleMeshTransport.java, Talk2Module.java, SpeechEngine.java; mobile/App.tsx,
mobile/src/MeshVoicePanel.tsx; shared/i18n.cjs, shared/stage3-ui.cjs;
tests/MeshVoiceStoreTest.java, tests/stubs/android/util/AtomicFile.java;
scripts/test-java.ps1 and scripts/test-java.sh; this checkpoint.

Checks:
- powershell -ExecutionPolicy Bypass -File scripts/test-java.ps1: PASS all six
  harnesses, including direct maximum clip/order/hash/path regression and mesh
  validation/restart/duplicates/missing/hash/expiry/cancel/receipt/SOS priority.
  Signed A-B-C protocol simulation passes without an A-C delivery path; no radios
  or Android playback involved in this JVM simulation.
- npm run check: PASS, 17 Node tests and TypeScript.
- Gradle 8.13 binary and workspace cache command recorded in Stage 2 above, with
  -p mobile/android :app:assembleDebug --console=plain: BUILD SUCCESSFUL in 13s,
  49 tasks (7 executed). Existing wrapper edit preserved. SDK access required
  an elevated tool call in this environment.
- adb devices -l (ANDROID_USER_HOME and ANDROID_SDK_HOME set to
  mobile/.android-stage2): empty device list. Physical direct voice, two-phone
  BLE voice, three-phone relay, playback and OEM behavior: NOT TESTED.

Next milestone: add receiver transcript translation/TTS with explicit pack and
language checks, preserving the original audio on every failure.
