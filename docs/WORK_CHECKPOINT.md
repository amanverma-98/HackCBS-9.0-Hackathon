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
Stage 1 implementation commit: pending creation after final verification.

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
- Final Stage 1 commit hash is added below after commit creation.

Stage 2 entry point: reread this checkpoint and the Stage 2 section plus “Copy into
VS Code Codex: prompt 2” in Talk2-staged-Codex-plan.md. Start with bounded BLE
transport/mesh design while retaining the currently working direct RFCOMM/Wi-Fi
Direct path. Do not claim relay or hardware validation from this Stage 1 work.
