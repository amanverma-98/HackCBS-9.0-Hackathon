# Implementation and validation status

## Implemented in this update

- Model downloads point to Somu9450/Talk2 model-pack-v1 with exact sizes and SHA-256.
- Translated speech sends on release; transcript review is optional.
- The microphone controller handles permission/grant cancellation, duplicate release,
  a 20-second cap, background cancellation and recovery after capture errors.
- AudioRecord stop handling and waveform normalization were corrected.
- Original voice messages use 16 kHz mono PCM16, bounded encrypted chunks, SHA-256
  assembly verification, history playback, receiver ACK and explicit retry.
- Location fixes refresh while stationary; sensor status is independent of radio
  status; turning sharing off clears the peer marker.
- Vibration, alert sound, automatic playback, nearby-peer cue and privacy controls.
- Local profile-photo picker, green/orange settings UI and separate debug package.
- Persisted citizen, volunteer, medical/support and emergency staff role selection.
- Staff roles remain unverified; the local role-verification provider stub never
  grants verification. The future signed credential boundary is documented.
- Settings JSON migration; source speech, translation target, TTS voice and UI
  language are separate persisted choices.
- Bundled English/Marathi UI resources with English fallback and coverage
  diagnostics for other offered UI languages.
- Pack status reports manifest availability, checksum-verified installation,
  complete pack size, received bytes and resumable partial state.

## Verified here

Node tests and TypeScript checks pass. Java tests pass for encrypted sessions, model
integrity and bounded voice transfer, including missing chunks, tamper detection and
path boundaries. All 39 model files used by the app matched the public release's
metadata. A real English STT model matched its SHA-256, loaded on desktop ONNX
Runtime and returned finite output with the expected signature.

The Android build status and hashes are recorded in BUILD_RESULT.md. Physical
two-phone operation cannot be verified in this environment; complete DEVICE_TESTS.md
on the actual target phones.

## Current boundaries

- General free-text model translation supports Hindi ↔ Marathi. Other pairs report
  that translation is unavailable and preserve the source text.
- Hindi's four speech files are not in the configured release. Text and Original
  voice still work without them.
- Original voice sends the speaker's recording; it is not translated. Translated
  speech sends recognized text and synthesizes it on the receiver. Neither is a
  continuous call.
- One peer and one transport are active at a time. Bluetooth is Classic RFCOMM.
  There is no BLE mesh, automatic multipath or background foreground service.
- Keep Talk2 open. Profile photos remain local. Marathi UI coverage reports
  untranslated keys with English fallback; other offered UI languages currently
  fall back to English.
- GPS and compass results are approximate and can be unavailable indoors. The
  optional 20 m cue is not an emergency proximity detector.
- Speech quality, memory, latency and battery require language-by-language testing
  on target phones. Large ONNX models may exceed lower-memory devices.
- History, voice files and the photo live in app-private storage with Android backup
  disabled, without an extra database encryption layer. Voice storage is limited.
- Delivered means persisted by the peer, not read or heard.
- SOS messages only reach the paired phone and do not contact emergency services.
- Android is implemented; no iOS radio/sensor target is included.

Model and source licenses remain separate. NOTICE identifies the included runtime
and model families whose own terms must be reviewed before distribution.
