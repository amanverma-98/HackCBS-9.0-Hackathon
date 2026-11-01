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

Final implementation commit: 9a965d7e6234698551c21e9ae66bc22df27692cd on main.
This following documentation-only checkpoint commit records that immutable source
hash; APKs above were built from that source before commit creation. No GitHub
push was performed for Stage 3. Final status preserves the pre-existing modified
mobile/android/gradle/wrapper/gradle-wrapper.properties. An untracked .vscode/
directory appeared during closeout and was also left untouched/uncommitted.

## Post-Stage-3 work recorded in commits 486eeee and f4835c9 (summary)

Not previously checkpointed. Direct link: insecure RFCOMM with app-level SAS, discovery
listener on scanning phones, auto-reconnect with a resume proof
(`SecureChannel.resumeProof`), and a BYE message on a deliberate disconnect. Mesh:
always-on, signed `presence` packets for multi-hop discovery, and end-to-end sealed private
mesh chat (`MeshSeal`, `MeshSealKeys`). UI: Hindi and Gujarati UI strings, a built-in Hindi
STT model and Hindi and Gujarati TTS voices in APK assets, translation on receipt and cached
ONNX sessions. Also added: a compact Settings screen, an onboarding permissions step, and
the `backend/` Express accounts API.

## Mesh location and reliability (2026-11-01)

Input commit: f4835c9 on `main`; the working tree was clean at the start. The work below is
**uncommitted**. Root cause: `docs/MESH_LOCATION_ROOT_CAUSE.md`.

### Location fix
- `shared/mesh-location.cjs` (new). `LocationPublisher` publishes on start, new neighbour,
  refresh, a heartbeat every 15 s, or movement of 15 m or more, with a 3 s minimum interval.
  `positionUpdate` and `positionOff` build the bodies.
- `mobile/App.tsx`:
  - One consented `shareLocation` switch (paired phone and mesh) that starts off each session.
  - The separate `meshSharing` flag is gone, and a mesh pause no longer clears sharing.
  - `publishLocation` runs on GPS fix, mesh start, `meshNeighbor` connect, direct
    `connected`, a 5 s heartbeat timer and refresh.
- `shared/location.cjs peerView` returns `located` (the peer's fix is valid) separately
  from `polar` (which also needs this phone's own fresh fix).

### Mesh reliability (Java)
- `MeshRouter`:
  - Non-voice broadcasts stay queued after custody: SOS and text for 120 s, position and
    presence for 30 s or until expiry. A per-neighbour `delivered` set prevents resends.
  - Delivered broadcasts are evicted first when the queue is full.
  - A reconnecting neighbour's resend timers are cleared, so the queue flushes immediately.
  - Duplicate copies do not re-fire app events.
  - Own packets are marked seen at creation, so echoes are not re-flooded.
  - A newer own position supersedes queued older ones.
  - `neighbors()` added for snapshots.
- `Talk2Module`:
  - `meshStopped` is emitted only when a mesh was running.
  - New `meshSnapshot` (running flag, node id, neighbours, bounded rescan).
  - The `meshPosition` event carries `packet` (the packet id) for evidence.
- `BleMeshTransport.rescan()`: restarts the scan, at most once per 10 s.

### UI
- `mobile/src/RadarPeers.tsx`:
  - Anonymous dots on range rings with compass letters; a legend and All, Direct and
    Relayed filters below; the list below that. One filtered array feeds both.
  - Each list row shows name, role with "Self-declared · unverified" or "Unverified
    emergency staff", direct, relayed or paired route with hop count, last seen, and a
    fresh distance with a cardinal bearing and an arrow relative to the compass.
  - When a peer has no position, the row says honestly why: waiting for this phone's GPS,
    location expired, or not shared.
- Radar status banner, one at a time: refresh error with an action, location permission
  denied, Bluetooth off, mesh error, scanning or no peers, GPS acquiring, or no phones.
- Pull to refresh on the Radar screen (`shared/refresh.cjs`, one at a time, 8 s timeout).
  It re-reads permissions and radios, reconciles the neighbour snapshot, restarts the mesh
  if it stopped, re-announces presence and resends the shared location.
- Icons: `react-native-vector-icons@10.3.0`, with only `MaterialCommunityIcons.ttf`
  bundled (1.1 MB; see the `build.gradle` vectoricons block) and wrapped in
  `mobile/src/Icon.tsx`.
  - All emoji and symbol glyphs used as navigation, buttons, status or section labels were
    replaced. User chat text is untouched.
  - Icon-only controls have accessibility labels, and critical states pair the icon with
    text.
  - Emoji-prefixed i18n keys were renamed. New strings were added in mr, hi and gu;
    coverage is 100% in all three.
  - The package is deprecated upstream in favour of per-family packages; 10.3.0 works with
    the pinned React Native 0.76.

### Checks (2026-11-01)
- `npm run check`: 32/32 JS tests pass (new `tests/mesh-location.test.cjs`, 8 tests);
  `tsc --noEmit` is clean.
- `scripts/test-java.ps1`: all 7 suites PASS. New `MeshRouterTest` cases:
  - retained broadcast for a late neighbour
  - no resend to a neighbour that holds custody
  - reconnect flush
  - newer own position supersedes the older one
  - relayed position keeps A's identity at hops 1 and fires once
  - own-echo suppression
- `backend`: `npm test` 3/3.
- `:app:assembleStandalone` succeeded with the workspace Gradle 8.13 binary (see the
  Stage 2 notes).
  - Final APK `mobile/android/app/build/outputs/apk/standalone/app-standalone.apk`,
    `com.talk2` 1.1.0 (versionCode 2), debug-signed, 286,319,625 bytes, SHA-256
    873603E643CD687BDAF67DE53ADCCB3CA63E25D6D48AE1AF5050D91201851FD4.

### Physical evidence (2026-11-01, two phones, no internet)
- **Phones:**
  - A: Samsung SM-G991B (Android 15), profile "Adeed", UI language Marathi.
  - B: vivo I2302 (Android 16).
- **Build tested:** SHA-256 71ABB62A…CA89. The final build above only adds the
  position-supersede change, which was not re-tested on the phones.
- **Permissions on both:** fine location, Bluetooth scan, connect and advertise granted.
- **Radios:** Wi-Fi and mobile data off, Bluetooth on. A ping showed both offline.
- **Real GPS, not test points:**
  - `cmd location` test providers needed `appops set android MOCK_LOCATION allow`.
  - Even then, the vendor network and fused fixes took precedence, so the fixes were real
    network/fused fixes of about ±20–100 m.
  - All settings were restored afterwards.
- **Before sharing:** B listed "Adeed · Citizen · Self-declared · unverified · Location not
  shared · Direct mesh link", and the radar showed 0 fresh locations.
- **A shares while B is connected:**
  - B logged `meshPosition` packets a6da1188-40a2-4036-aaae-fd33c8d80629 (05:56:34 IST)
    and 2b6a0790-3782-47ac-90b7-b133a099b90f (05:56:50), both hops=0.
  - B showed "Location shared · waiting for your GPS" while its own fix was unusable.
  - Once B's own fix was usable it showed "Radar: 1 people with a fresh location" and
    Adeed at 7 m, then 2 m later. The phones were side by side.
  - Same-build log: A received its own a6da1188 echoed at hops=1. That led to the
    own-echo fix in the final build.
- **B connects after A started sharing:**
  - B was backgrounded so its mesh stopped, A enabled sharing (06:10:33 IST), and B
    returned at 06:11:06.
  - B's mesh links came up at 06:11:09–10.
  - A's position 856ea4a5-4d0a-4fd8-b575-a6a6f7f235bf arrived at 06:11:15 (hops=0)
    without A moving, followed by aa820d0b and 5e9bb415 within 2 s. That led to the
    supersede fix.
- **A stops sharing:** B showed "Location not shared" (explicit revocation, not expiry)
  and 0 fresh locations within 22 s; each UI read takes about 5 s.
- **A's screen slept** (secure lock): the mesh stopped and B's copy expired, as designed
  for foreground-only use.

### Not verified physically, next steps
1. **A → relay → B with no direct A–B link.** Separate A and B beyond BLE range, or
   shield them, with B between as the relay. Record the hop count shown on B (it should
   be 1) and the packet ids.
2. **A walking 50–200 m** and B's distance or bearing updating. The test-location
   approach did not override vendor network fixes on these phones.
3. **Visual checks on the phones:**
   - Pull to refresh: spinner stops, plus the error and timeout banners.
   - The permission-denied and Bluetooth-off banners.
   - Icon appearance in light and dark themes.
   - The compass arrow and bearing outdoors with a calibrated compass.
4. **The Nothing A142** was not connected for this run.

## Playback, chat composer, translation coverage, People sheet (2026-11-01, uncommitted)

### Translation error root cause
The red "General offline translation for this pair is not validated" error came from
English messages: the sender's speaking language was en. The installed pack is IndicTrans2
**indic-indic** (`scripts/export_translation_models.py`), which has no English, and
`TranslationEngine` only allowed hi<->mr. It was not related to the Hindi STT model.

### Translation coverage
- Added `IndicScript` (Brahmic block offsets to and from Devanagari, with Tamil nearest
  letters and Malayalam chillu) and wired it into `TranslationEngine.translateRaw`, which
  has a per-language tag map.
- `scripts/validate-translation.ps1` plus `tests/TranslationCheck.java` run the real engine
  on the JVM against the checksum-verified release pack.
- Results:
  - bn, gu, ta, te, kn and ml passed to and from hi/mr.
  - Odia mistranslated ("hospital" became "post office") and stays disabled.
  - mr->hi failed on the hospital sentence, a pre-existing quality limit; hi<->mr stays
    enabled because it was already shipped.
- The enabled set lives in `TranslationEngine.ENABLED` and `shared/translation-pairs.cjs`;
  a test keeps them equal.
- Unsupported pairs, including all English, show a muted "translation isn't available
  offline · showing original" note and play the original voice.

### Playback
- `SpeechEngine.play(audio,start,stop)` serves both voice clips and TTS, with stoppable
  write loops and a cached last synthesis.
- `Talk2Module.playVoice(uri,start)` and `speak(text,lang,start)` return
  `{position,done}`; `pausePlayback()` runs on the bridge thread.
- UI: Play / Pause / Resume per clip, an animated `PlayingBars`, and starting another clip
  pauses the current one.

### Talk screen
- A chat bar with a People button.
- Bubbles in chat order, auto-scrolled. They have a definite width (row minus 12%) because
  shrink-to-fit containers clipped Devanagari lines on Android.
- A composer pinned above the nav bar: a growing `TextInput` and one round button (mic when
  empty, send when there is text) with green/blue/red states. History keeps newest-first.

### Mesh
- `BleMeshTransport.burst()`: LOW_LATENCY scanning for 20 s at start, on refresh and when a
  neighbour is lost, then BALANCED or LOW_POWER. Restarts are capped at one per 10 s.
- Presence is announced immediately on a new link (at most once per 3 s).
- The People sheet lists mesh people first with Chat and a "through N phones" route.
  Bluetooth/Wi-Fi Direct pairing is a collapsed "Pair directly (optional)" section; its scan
  runs only when that section is open, and the button is labelled Pair.
- An incoming private mesh message selects its sender as the chat partner, and cards have a
  Reply button.
- Delivered mesh messages show "through N phones" or "direct" from the receipt hop count.

### Checks
- `npm run check`: 36/36 tests pass, including `tests/translation-pairs.test.cjs`;
  `tsc --noEmit` is clean.
- `scripts/test-java.ps1`: all suites pass, including the new `IndicScriptTest`.
- `:app:assembleStandalone` succeeded: 286,340,773 bytes, SHA-256
  F8AF683068365EE833889AA5338F2D9531B2EBAA59AE39E0E0D0ECEE1D166546.

### On the phones
Nothing A142 (Hindi UI):
- the Talk screen with the pinned composer
- English messages showing the muted note with Original voice only
- Pause turning into Resume ("फिर शुरू करें")
- note and message text no longer clipped

### Not verified
- Mesh burst timing, auto-reply and route labels between two or three phones.
- Translated playback of a Gujarati or Tamil message.
- The vivo and Samsung were disconnected for this round and still run the previous build.

## Two-colour theme, new icon, message cue, SOS with siren and location (2026-11-01, uncommitted)

### Theme
- `mobile/src/theme.ts`: green #636b2f and cream #f8e6ca, plus tints mixed from the two.
  Red is used only for SOS and errors.
- Every hard-coded colour in `App.tsx` and `RadarPeers.tsx` now maps to `P.*`.
- Dark mode, the theme pickers in onboarding and Settings, `useColorScheme`, and the
  DayNight native theme are removed. `styles.xml` is Light, with cream window, status and
  navigation bars, and `forceDarkAllowed=false`.

### Icon
- Generated from `mobile/Talk2Logo.png`:
  - `mipmap-*` square and round PNGs at all five densities
  - an adaptive icon in `mipmap-anydpi-v26`, with background #1e2952 sampled from the logo
    and the foreground scaled to the safe zone
- The manifest uses `@mipmap/ic_launcher`; the old vector `drawable/talk2_icon.xml` was
  removed.

### Receive cue
- `Sounds.messageCue`: a soft A5–E6 chime on the notification stream plus a 35 ms
  vibration at amplitude 70.
- It plays for every non-SOS incoming message and respects the Sounds and Vibration
  settings.

### SOS
- **Sending** (`App.tsx confirmSOS` / `sendSOS`):
  - Every SOS (quick options, typed text, hold-to-record voice on the SOS tab, and the Radar
    public box) asks "Send with my location" or "Send without location". It waits up to
    8 s for a fix.
  - It builds `shared/sos.cjs buildSOS` (name, role, text, location with accuracy, battery
    via `Native.batteryLevel`, a voice flag).
  - It sends to the paired phone (voice clip if any) **and** broadcasts `Mesh.sendSOS`
    with the JSON payload.
- **Receiving:**
  - `parseSOS` validates the payload, and the shared SOS id de-duplicates the direct and
    mesh copies.
  - `Sounds.sosSiren` plays a 6 s 650–1200 Hz wail on the alarm stream with a strong
    vibration, regardless of the sound setting.
  - The detail sheet opens automatically.
- **Cards:** SOS cards are red and are the only openable cards. The sheet shows sender, role
  marked unverified, time, message, coordinates with accuracy, distance and direction from
  this phone, battery, route, Play voice and Share location (`geo:` URI).

### Radar
- Every peer is drawn: a filled dot at the real position when a fresh shared location
  exists, otherwise a hollow dot on the outer ring with the legend "No location (outer
  ring)".

### Checks
- `npm run check`: 40/40, including `tests/sos.test.cjs`; `tsc` is clean.
- Java suites all pass.
- APK SHA-256 5D05C14C9BC76F35B27C6B609C5A840B35E6B16FAC252C5199BDFF356BE449A1.

### On the phones
- Installed on the Nothing A142. The theme renders on Talk and the SOS tab.

### Not verified
- The siren and chime sound.
- An SOS between phones, including the location sheet.
- The launcher icon appearance.
- The vivo and Samsung (not connected).

## English translation pack and darker green — 2026-11-01

- Theme green darkened to `#4a5223` (`mobile/src/theme.ts`, `res/values/colors.xml`).
- New optional pack `translation-en`: IndicTrans2 `en-indic-dist-200M` + `indic-en-dist-200M`, int8 ONNX,
  six files in the gitignored `model-release/` (with `SHA256SUMS`), listed in
  `model-host/upstream-manifest.json` under the `model-pack-v1` release URLs. Upload those six files to
  that release; the in-app Download then works (the release build is not debuggable, so no sideload).
- Tokenizer root cause: the app rebuilt BPE merges from piece ids, which mis-segments English
  ("▁n eed", "▁h os p ital"), so "nearest" came out as "lowest" or transliterated. New vocab files carry
  `src.spm_scores`; `TranslationEngine.Tokenizer` merges by highest SentencePiece score, matching
  `src_spm.encode` exactly on all samples. Input punctuation is split Moses-style ("hospital ?") and
  rejoined on output.
- `scripts/validate-translation.ps1 -English`: all 18 en<->{hi,mr,bn,gu,or,ta,te,kn,ml} pairs pass.
  English uses its own list (`ENGLISH` / `ENGLISH_TRANSLATION`, includes Odia); indic-indic is unchanged
  (Odia off, mr->hi question sentence still fails).
- Follow-up: the released indic-indic `indictrans2-vocab.json` has no `spm_scores`. Re-exporting it with
  scores would likely fix mr->hi and Odia, but changes a released file's checksum.

## Mesh outbox fix, exact tokenizer for both packs, keyboard, account backend — 2026-11-01

- **"Mesh queue full; send later"** (blocked text and SOS): `MeshRouter` held 16 packets and refused every
  send when full. Presence (every 20 s) and relayed location from every phone (30 s each) filled it, and a
  full relay stopped taking custody, so the jam spread. Now: 48 slots; newest presence/location per phone
  supersedes older copies; when full, the least valuable packet makes way (bulk voice < relayed
  presence/location < own presence/location < broadcasts a neighbour already holds < relayed text < own
  text < relayed SOS < own SOS). Receipt tracking and inbox drop their oldest entry instead of failing; a
  full relay still shows a broadcast SOS locally. Only an outbox full of this phone's own unsent messages
  gives a clear error. `sendSOS` no longer fails an SOS the paired phone already received. Test: full
  outbox in `MeshRouterTest`.
- **Translation**: the released Indian `indictrans2-vocab.json` (unchanged on the release) has no
  SentencePiece scores. Its tokenizer is identical to indic-en's source side (same merges and src
  dictionary), so the scores ship in the APK (`assets/translation/indic-spm-scores.tsv`, 2.9 MB) and
  `TranslationEngine` uses them for the "translation" pack. Validated with the vocab downloaded from the
  release: all 23 Indian pairs (Odia and mr->hi now pass) and 18 English pairs pass; Odia enabled.
  Sentence-by-sentence translation, 30-word pieces for run-on speech (halved if unfinished), decode length
  scaled to input, 64-entry cache. `ModelStore.updateBytes` + Settings "Improved version available" handle
  future release file changes (only changed files download).
- **Model downloads**: `scripts/check-release.mjs` compares the manifest with the live release (size,
  SHA-256 digest, HTTPS redirect, Range resume). 2026-11-01: all 45 files in 11 packs OK.
  `tests/model-manifest.test.cjs` checks file names against `ModelStore.validateSpec`/`safe()` offline.
- **Keyboard**: targetSdk 35 on Android 15+ forces edge-to-edge, which disables `adjustResize`.
  `values-v35/styles.xml` opts out (valid while targetSdk is 35; moving to 36 needs inset handling).
  The tab bar hides while the keyboard is open; the chat stays scrolled to the newest message.
- **Theme**: green `#343a16`, greenDark `#22270e`; secondary shades re-mixed.
- **Backend**: universal CORS, `trust proxy`, `GET /`, `render.yaml` blueprint (MONGODB_URI from Atlas,
  JWT_SECRET generated). App server `https://hackcbs-9-0-hackathon-3.onrender.com` (`mobile/src/config.ts`; not
  editable in the app, no address shown). Verified live: health 200, login probe 401, CORS `*`. Settings -> Account (online) replaces the unimplemented
  "Ask GPT" screen: log in / sign up with the onboarding role, volunteer details, volunteer search for
  emergency staff, logout. Requests wait 70 s for a sleeping free Render service.
