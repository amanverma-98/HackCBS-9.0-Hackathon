# Engineering review

This snapshot was reviewed for microphone state, local speech inference, radio
framing, download integrity, location consent, haptics and settings.

The microphone release path previously populated the composer without sending.
Translated speech now sends on release, with an explicit transcript-review option.
The lifecycle controller handles permission prompts, early release, duplicate
release, background cancellation, a 20-second limit and recovery after errors.

Audio capture distinguishes intentional stop from a read failure and releases its
resources. Original voice messages use bounded ordered chunks, transfer timeout,
SHA-256 assembly verification and the existing encrypted radio channel. Local file
paths never go over the radio. Capability exchange protects compatibility.

Stationary location updates are requested, peer freshness uses receipt time, and
sensor status no longer marks a working radio link failed. Turning sharing off
clears the peer marker. Vibration, sound and automatic-playback controls are explicit.

Debug builds use a separate package ID to avoid signature conflicts with standalone
test builds. Regression tests cover calculations, validation, microphone races,
encrypted frames, model integrity and bounded voice transfers. See BUILD_RESULT.md
for executed checks and STATUS.md for remaining device-level limitations.
