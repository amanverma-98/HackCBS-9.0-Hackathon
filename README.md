# HackCBS-9.0-Hackathon

This is the README for hackcbs hackathon.

# Talk2

Talk2 is an Android peer-to-peer communication app with a React Native interface,
Java device integrations, and an optional Node.js assistant backend.

## Features

- Pair two phones over Wi-Fi Direct or Bluetooth Classic, verify the matching
  pairing code, and exchange encrypted text and acknowledged messages.
- Hold to record up to 20 seconds. **Translated speech** recognizes speech
  locally, sends text, and speaks it in the receiver's selected language.
  **Original voice** sends the recording without requiring a speech pack.
- Choose send-on-release or transcript review.
- Download checksum-verified speech packs from the Talk2 model release
- Share GPS coordinates with explicit consent and display peer distance and
  compass-relative bearing. Radar does not need GPT or an internet server.
- Profile name and local photo; light/dark/system appearance; vibration,
  alert sounds, automatic playback, nearby-peer cue, history, and diagnostics.
- Offline role selection (citizen, volunteer, medical/support, emergency staff).
  Staff remain visibly unverified until a future signed credential verifier exists.
- Independent UI, source speech, translation target and TTS language settings.
  English and Marathi UI strings are bundled with the app; other offered UI
  languages show coverage and fall back to English.

First-run setup, text chat and Original voice do not require model downloads or
internet. Speech recognition and TTS require their selected local packs. The
supplied release has no Hindi speech assets; general model translation supports
Hindi ↔ Marathi only. Pack availability, exact total size, checksum-verified
installation, cumulative progress and resumable partial downloads are shown.

## Development setup

Install Node.js 22+, JDK 17 and Android Studio with Android SDK 35,
Build Tools 35.0.0 and NDK 26.1.10909125. Open the repository in VS Code.

```powershell
npm ci
npm run check
npm start
```

In another terminal:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
cd mobile\android
.\gradlew.bat :app:installDebug
```

Open **Talk2 Dev**. Its package is `com.talk2.dev`, so it can be installed beside
the standalone `com.talk2` test app without a signing conflict. Keep Metro running
for Fast Refresh. Java or Android configuration changes require reinstalling.
See [BUILD.md](docs/BUILD.md) for signing and troubleshooting.

## Two-phone test

Install the same version on both phones. Host on one and join from the other;
confirm the matching code on both. Send text first. In Settings select **Original
voice**, hold until recording appears, speak, then release. The receiver plays the
clip if automatic playback is enabled; it can always be replayed from history.

For translated speech, download and select a speech pack. It sends recognized
text automatically unless transcript review is enabled. General model translation
currently supports Hindi ↔ Marathi only. Five preset alerts include local phrases
for all listed languages. Unsupported translation pairs return a clear error.

## Models

Configured release:
https://github.com/Somu9450/Talk2/releases/tag/model-pack-v1

Leave Model manifest URL blank to use the bundled pinned manifest. The 39 required
assets match the release's filenames, byte sizes and reported SHA-256 digests.
Hindi's four required files are absent. Original voice and text work without a
Hindi speech pack.

See [MODEL_HOSTING.md](docs/MODEL_HOSTING.md) and
[RELEASE_VERIFICATION.md](docs/RELEASE_VERIFICATION.md) before changing assets.

## Project map

- `mobile/`: UI, state, Android Java engine and Gradle project
- `shared/`: protocol validation, language data and microphone lifecycle
- `server/`: optional authenticated Node.js assistant
- `model-host/`: pinned model manifest
- `scripts/`: model and release verification tools
- `tests/`: core, backend, capture, crypto and transfer tests
- `docs/`: build, architecture, device checks and validation status

No Kotlin application source is included. React Native build dependencies may use
Kotlin internally. Keep models, secrets, signing keys, dependencies, caches and
build output out of git.

Read [STATUS.md](docs/STATUS.md) and [BUILD_RESULT.md](docs/BUILD_RESULT.md) before
deployment. Physical two-phone testing is still required. Model licenses are
separate from the Talk2 source license; see NOTICE.
