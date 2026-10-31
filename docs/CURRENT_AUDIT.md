# Stage 1 current audit

Audit recorded before implementation edits. Workspace root: `D:\Users\SomuData\Desktop\Projects\Talk2 HackCBS`.

## Verified checkout state

- Branch: `feature/offline-mesh`.
- HEAD: `6ca408d0e7d41dd580f5fd6a42f9d885e46ae584`.
- `git status --short --branch` returned only `## feature/offline-mesh`; there were no pre-existing tracked or untracked changes to preserve.
- No `AGENTS.md` exists in this checkout.
- Root `package.json` defines `npm run check` as `npm test` followed by mobile TypeScript typecheck. Test files include JS core, PTT and server tests and Java model, secure channel and voice transfer tests.
- `mobile/App.tsx` is 1,931 lines and currently owns onboarding, all tabs, settings, messages, radar and model-download UI. It saves a single JSON settings/history object through `Native.saveState`.
- `mobile/src/native.ts` exposes the Android `Talk2Native` module and event emitter.
- `PeerRadio.java` has one active session and supports direct Bluetooth Classic RFCOMM and Wi-Fi Direct TCP. Host/join disconnects the previous session. It is not BLE or multi-hop mesh.
- `ModelStore.java` validates required files, resumes `.part` downloads over HTTP Range, checks exact sizes and SHA-256, commits `ready.json` only when complete, rechecks at startup and supports removal. Cancellation currently surfaces as a paused/resumable download.
- `SpeechEngine.java` requires a ready speech pack for transcription and TTS; microphone capture itself is local. Original voice uses the separate voice-transfer path. `TranslationEngine.java` allows general model translation only for Hindi↔Marathi and reports other pairs unavailable.
- The app's default saved speech setting is `current: "hi"`; `current` is used for recording recognition and received speech output. UI language is separate but currently falls back to English tabs while other visible UI remains predominantly English. The first-run language choice incorrectly depends on installed speech packs.
- Existing Settings lacks a role, role-verification state, distinct source/target/TTS language fields and schema version. Loading merges arbitrary parsed JSON over defaults without per-field validation/migration.
- Existing pack UI consumes Boolean readiness values and describes ready packs as “Verified”; it does not distinguish Hindi absence, pack sizes in exact bytes, downloading/partial/error states or independently selected recognition, translation target and TTS languages.
- Profile photo is selected through the native local picker; source docs state it remains app-private. Direct radio and existing message paths are to be preserved.
- The built-in manifest contains nine speech packs plus shared translation assets; Hindi speech assets are absent. `docs/MODEL_HOSTING.md` documents Hindi↔Marathi as the only validated general model translation pair.
- Documentation read before edits: `README.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/MODEL_HOSTING.md`, `docs/DEVICE_TESTS.md`, `docs/WORK_CHECKPOINT.md`, and the Stage plan `Talk2-staged-Codex-plan.md`.

## Third-party license inspection before any reuse

- BitChat Android repository `permissionlesstech/bitchat-android`: inspected its exact root `LICENSE.md` on `main`; it is GNU GPL version 3 (the complete standard GPL-3.0 text). No code will be copied in Stage 1.
- ResQMesh repository `jangkayl/ResQMesh`: inspected its current GitHub root file listing; no root `LICENSE`/`LICENSE.md` is present. No license grant is verified, so no code will be copied.
- Knit repository `getknit/knit`: inspected its exact root `COPYING` on `main`; it is GNU GPL version 3, matching its README's “GPL-3.0-or-later” statement. No code will be copied in Stage 1.

## Planned Stage 1 file edits

- `mobile/App.tsx`: safe settings migration, persistent role and honest verification display, separate language settings, onboarding that works offline without downloads, complete English/Marathi UI resource use, truthful pack state/size/progress/cancel/retry/remove controls.
- `mobile/src/i18n/`: bundled English and Marathi string resources, structured fallback and coverage diagnostics for other UI-language choices.
- `mobile/src/roleVerification.ts`: `RoleVerificationProvider` interface and local stub/mock which always returns unverified; no OTP/network identity implementation.
- `mobile/src/modelPacks.ts`: pack metadata/status derivation for availability and verified installed state.
- `tests/`: focused JS tests for Settings migration, verification display policy, localization fallback/coverage and pack status.
- `docs/THIRD_PARTY.md`: exact inspected license results and no-reuse record.
- `docs/VERIFICATION_API.md`: future Next.js API and signed offline credential contract; explicitly no service implementation in Stage 1.
- `docs/README.md` references and Stage 1 limitations as appropriate, including UI language availability, absent Hindi speech assets, Hindi↔Marathi translation boundary, offline onboarding/text/original voice, and physical test requirements.
- `docs/WORK_CHECKPOINT.md`: Stage 1 result, final commit/hash if one exists, changed files, exact commands/results, unresolved items and Stage 2 entry point.
- `docs/CURRENT_AUDIT.md`: this pre-edit baseline, amended only if implementation reveals a material discrepancy.

No code has been reused from the inspected external projects. The Stage 1 scope does not include a Next.js server or radio transport changes.

## Implementation file set

The concrete implementation uses the existing shared CommonJS test surface rather
than adding a new localization folder: shared/onboarding.cjs,
shared/model-packs.cjs, and shared/i18n.cjs. Native pack metadata and cumulative
progress require mobile/android/.../ModelStore.java and Talk2Module.java; the app
consumes them in mobile/App.tsx. The provider boundary is
mobile/src/roleVerification.ts. Focused tests are in tests/stage1.test.cjs;
documentation is in docs/THIRD_PARTY.md and docs/VERIFICATION_API.md, with
README/status/device-checkpoint updates.

## Stage 2 pre-edit supplement (2026-10-31)

- The current checked-out source state is `main` at `fa4de0eea50e2640f6339cac0ed9c8491283c538`, clean before Stage 2 edits. `docs/PROJECT_AUDIT.md` is not present; the current audit is this file and the Stage 1 checkpoint is `docs/WORK_CHECKPOINT.md`.
- `PeerRadio.java` remains a one-session direct Classic RFCOMM/Wi-Fi Direct implementation. Stage 2 work is isolated in new BLE/protocol classes plus the bridge/UI; no changes to `PeerRadio`, `SecureChannel`, `VoiceTransfer`, `SpeechEngine` or `TranslationEngine` were planned.
- Android manifest already had runtime Bluetooth scan/connect/advertise declarations; no foreground service is being added. The mesh will be opt-in and stop on app background.
- Planned Stage 2 edits: `mobile/android/app/src/main/java/com/talk2/{BleMeshTransport,MeshFragmentCodec,MeshPacket,MeshRouter}.java`, `Talk2Module.java`, `mobile/src/native.ts`, `mobile/App.tsx`, `tests/{MeshPacketTest,MeshFragmentCodecTest}.java`, `scripts/test-java.sh`, `.gitignore` for task-local cache folders, `docs/REFERENCE_IMPLEMENTATION_MAP.md`, `docs/THIRD_PARTY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`, `docs/DEVICE_TESTS.md`, `README.md`, and this checkpoint.
- External research map was written before implementation in `docs/REFERENCE_IMPLEMENTATION_MAP.md`. No source reuse. ResQMesh immutable revision could not be retrieved; this is recorded rather than guessed.
