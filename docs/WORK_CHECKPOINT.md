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

## Milestone 3B checkpoint

3A source/checkpoint commit: 6d8c835. Added optional source transcription of the
saved original clip, source-language metadata, receiver text translation and
separate TTS actions. All four language settings stay independent. Original
playback survives missing packs, incompatible vocab/model, unsupported pair and
TTS/target mismatch. Failed transcription does not erase the recorded draft.

Files: mobile/src/TranslatedVoice.tsx, mobile/src/MeshVoicePanel.tsx, mobile/App.tsx,
shared/language-state.cjs, tests/stage3.test.cjs, SpeechEngine.java,
TranslationEngine.java, docs/MODEL_HOSTING.md, this checkpoint. Stage 3 strings
are bundled in shared/stage3-ui.cjs with English fallback and Marathi coverage.

npm run check: PASS, 19 Node tests plus TypeScript. Runtime model guards validate
actual session metadata; no tensor names or language assets invented. No local
ONNX files exist, and adb device list is empty: real inference and physical
voice-to-voice acceptance remain NOT TESTED. Hindi STT/TTS missing from manifest;
only hi<->mr general translation is enabled. Full evidence matrix and reproducible
Marathi identity/hi-text-to-mr demo paths are in docs/MODEL_HOSTING.md.

Next: location consent/expiry/accuracy, common radar/list filtering, reference
source/verification contract documentation, and final Android validation.
`Gradle 8.13 -p mobile/android :app:compileDebugJavaWithJavac --console=plain`: BUILD SUCCESSFUL in 3s (30 tasks, 4 executed) for 3B.

## Milestone 3C checkpoint

3B source/checkpoint commit: b13145e. Public mesh location consent is per-session,
independent of paired-only sharing; stop packets and 30-second expiry prevent
stale fixes. Range/accuracy/future timestamps are checked. peerView supplies both
anonymous radar dots and the discovery list with one filter; names, roles,
Unverified, distance/uncertainty, last-seen and connection details stay in rows.
Compass quality/freshness gates relative bearing; otherwise the radar is north-up.
No RSSI-derived coordinates and no self-declared verified staff colors were added.

Further bounded voice hardening during final acceptance: outward signed cancel
propagation, outgoing-history recovery after restart, no URI in public metadata,
monotonic partial-custody state, no per-piece Settings rewrites, clear-history
spool/router cleanup, exclusion of ingress for relay queues, and GATT write
watchdog/fragment-start recovery. The JVM router tests inject keys and a file
store, never pretend to test Android Keystore or actual BLE.

Optional transport: DEFERRED. adb returned no devices, so there is no measured BLE
capacity evidence to justify either Wi-Fi Aware or Nearby. No optional transport,
Play Services dependency, fallback claim, dashboard, live call, Meshtastic or
Next.js service was added. VERIFICATION_API.md identifies the actual unconnected
provider stub, current fail-closed display selectors and future integration points.

Pinned actual source/test study and license provenance for BitChat, ResQMesh and
Knit are in REFERENCE_IMPLEMENTATION_MAP.md and THIRD_PARTY.md. No code copied.
DEVICE_TESTS.md cards 17-20 provide device/build/permission/topology/timestamp/
size/ACK/log fields and exact two-phone, three-phone, model and location steps.
All physical and emulator results remain NOT TESTED. Full model matrix and actual
available automated demo path remain in MODEL_HOSTING.md.

Final validation/artifact results and final source commit follow below.

### Exact Stage 3 changed files (relative to input f95a655)
- `docs/ARCHITECTURE.md`
- `docs/DEVICE_TESTS.md`
- `docs/MODEL_HOSTING.md`
- `docs/REFERENCE_IMPLEMENTATION_MAP.md`
- `docs/STATUS.md`
- `docs/THIRD_PARTY.md`
- `docs/VERIFICATION_API.md`
- `docs/WORK_CHECKPOINT.md`
- `mobile/android/app/src/main/java/com/talk2/BleMeshTransport.java`
- `mobile/android/app/src/main/java/com/talk2/MeshPacket.java`
- `mobile/android/app/src/main/java/com/talk2/MeshRouter.java`
- `mobile/android/app/src/main/java/com/talk2/MeshSendQueue.java`
- `mobile/android/app/src/main/java/com/talk2/MeshVoiceStore.java`
- `mobile/android/app/src/main/java/com/talk2/SpeechEngine.java`
- `mobile/android/app/src/main/java/com/talk2/Talk2Module.java`
- `mobile/android/app/src/main/java/com/talk2/TranslationEngine.java`
- `mobile/App.tsx`
- `mobile/src/MeshVoicePanel.tsx`
- `mobile/src/RadarPeers.tsx`
- `mobile/src/TranslatedVoice.tsx`
- `README.md`
- `scripts/test-java.ps1`
- `scripts/test-java.sh`
- `shared/i18n.cjs`
- `shared/language-state.cjs`
- `shared/location.cjs`
- `shared/stage3-ui.cjs`
- `tests/MeshRouterTest.java`
- `tests/MeshVoiceStoreTest.java`
- `tests/stage3.test.cjs`
- `tests/stubs/android/security/keystore/KeyGenParameterSpec.java`
- `tests/stubs/android/security/keystore/KeyProperties.java`
- `tests/stubs/android/util/AtomicFile.java`

## Stage 3 final validation and handoff (2026-10-31)

Branch: main. Initial commit: f95a6557f584c7cc9de00203cf89a5cb9c0ea9e1.
Milestone commits: 6d8c835 (3A), b13145e (3B); final implementation hash is
recorded in the following handoff entry. The exact changed-file list above also
includes mobile/android/app/build.gradle: shared modules outside the mobile root
are now declared bundle inputs, preventing stale standalone localization/policy.
The existing gradle-wrapper.properties change remains uncommitted and untouched.

Final commands and outcomes (PowerShell, repository root):

- `npm run check`: PASS, all 21 Node tests and `tsc --noEmit`. Includes the
  corrected dynamic Marathi missing-pack message. Catalog diagnostics:
  `node -e "console.log(require('./shared/i18n.cjs').diagnostics('mr'))"`:
  270/270, no missing keys. This is dictionary coverage, not screen/device QA.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-java.ps1`:
  PASS, SecureChannelTest, ModelStoreTest, VoiceTransferTest, MeshPacketTest,
  MeshFragmentCodecTest, MeshVoiceStoreTest, MeshRouterTest. JVM stubs do not
  validate Android Keystore, AtomicFile crash semantics or Bluetooth hardware.
- Set `GRADLE_USER_HOME` to `mobile/.gradle-stage2-final`, `ANDROID_USER_HOME`
  to `mobile/.android-stage2`, then ran:
  `& './mobile/.gradle-stage2/wrapper/dists/gradle-8.13-bin/5xuhj0ry160q40clulazy9h7d/gradle-8.13/bin/gradle.bat' -p mobile/android :app:testDebugUnitTest :app:assembleDebug :app:assembleStandalone --console=plain`.
  Final build PASS in 49s, 101 tasks (11 executed, 90 up-to-date).
  Android unit task is NO-SOURCE; the seven JVM harness groups above are the
  actual Java test evidence. Gradle deprecation and Metro/Hermes warnings remain.
- `git diff --check`: PASS (line-ending conversion warnings only).
- `Get-FileHash mobile/android/app/build/outputs/apk/debug/app-debug.apk,mobile/android/app/build/outputs/apk/standalone/app-standalone.apk -Algorithm SHA256`:
  debug SHA256 17002CF848650B31BEE8AC4F522087D26E25CE048A3F7ACE6773A3E724521DE3,
  130131598 bytes; standalone SHA256 AC71AA6780FF9ED21187411EE8A1B0F151A4A1E8F0CE41138D78DF85CF1091AE,
  86547735 bytes.
- SDK build-tools/34.0.0 `aapt.exe dump badging` on each APK: debug com.talk2.dev,
  version 1.1.0-dev; standalone com.talk2, version 1.1.0; both versionCode 2.
  `apksigner.bat verify --print-certs` on final standalone: PASS, Android Debug
  certificate SHA256 ec9d5ea792facc56dca652bf611dc80a99f18207ea013a6441af5e62cc8d925e.
  This is a development-signed artifact, not a production release signature.
- SDK platform-tools/adb.exe `devices -l`: initially empty; at closeout ONE phone
  appeared, serial 00045349O000672, model A142/product PacmanIND. `shell getprop
  ro.build.version.release`: 17. No second/third phone or emulator.
- With ANDROID_USER_HOME and ANDROID_SDK_HOME set to mobile/.android-stage2:
  `adb -s 00045349O000672 install -r mobile/android/app/build/outputs/apk/standalone/app-standalone.apk`:
  FAILED: INSTALL_FAILED_UPDATE_INCOMPATIBLE, installed com.talk2 signature differs.
  No uninstall, data clear, permission grant or launch of an old build was done.
  Physical startup, microphone/playback, BLE, sensors and model inference remain
  NOT TESTED. Earlier no-device statements describe earlier milestone snapshots.

Acceptance: 3A bounded public Original transfer and failure cases are implemented
and JVM protocol-tested, including signed A-B-C simulation without A-C delivery.
Direct transport code is preserved, but physical direct regression is NOT TESTED.
3B optional original/transcript/translation/TTS guards are implemented and
policy-tested; compatible installed neural models were unavailable, so no real
speech-to-speech success is claimed. See MODEL_HOSTING.md for the full matrix:
Hindi speech absent, general translation hi<->mr only; Marathi identity speech
and hi-text-to-mr are reproducible candidate paths once compatible packs exist.
3C consent/expiry/filter/accuracy rules are implemented and unit-tested; sensor
accuracy and radio capacity remain unmeasured. Optional Wi-Fi Aware/Nearby is
DEFERRED for lack of measured justification.

Security: mesh voice/location are explicitly PUBLIC, signed and bounded, not
private or E2EE. Custody covers a piece; receipt means at least one public receiver
assembled the note, not read/playback/all recipients. Direct secure transport
remains separate. Self-declared roles/OTP/mock/unsigned profiles never confer
verification. Future signed credential/backend work is documentation only.

Remaining limitations and exact next action: obtain an APK signed with the
phone's existing key, or use a separate test device with no conflicting Talk2
installation; do not remove user data. Run DEVICE_TESTS.md cards 17-20 with two
phones then isolated A-B-C, recording the actual build hash, permissions, topology,
bytes/timestamps/receipts and logs. Install checksum-valid compatible model packs
and execute the MODEL_HOSTING.md matrix. Validate Marathi screens, foreground BLE
throughput, disconnect/restart recovery and location/compass behavior on hardware.
Mesh remains foreground-only; the 3-second public note limit is conservative and
not a measured delivery guarantee. The user's Gradle wrapper edit is preserved;
use the explicit 8.13 binary above until its version/checksum mismatch is resolved.
Stage 3 stops here; no dashboard, live call, Meshtastic or Next.js backend begun.
