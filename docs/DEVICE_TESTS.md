# Two-phone acceptance tests

Use the same Talk2 version on two phones. Record Android versions, phone models,
transport and the exact on-screen error for any failure.

1. Connect with Wi-Fi Direct, confirm matching codes, send text both ways and verify
   one history entry plus delivered status. Repeat with Bluetooth Classic.
2. Select Original voice. Hold until Recording appears, speak 2–5 seconds and release.
   Verify auto-play, manual history playback and queued retry after reconnecting.
3. Try a quick tap, release during the permission prompt, deny microphone access and
   press while the peer has the floor. No case should leave a stuck recording.
4. Background during capture: the clip must be discarded. Hold for 20 seconds:
   processing starts exactly once. Disconnect mid-transfer: incomplete audio must not
   play or receive an ACK; retry after reconnecting.
5. Download English on both phones. Select Translated speech and speak a short phrase.
   Check recognized text and receiver speech. With Review enabled, release must fill
   the composer without sending. Repeat for every intended language.
6. General Hindi ↔ Marathi translation requires both speech packs and translation
   pack. Unsupported pairs must show an error rather than claim translation.
7. Enable location sharing outdoors on both phones. Check coordinates, accuracy,
   distance and heading. Stay stationary for one minute. Rotate the phone flat. Turn
   sharing off and verify the peer marker clears. Disable GPS and confirm text remains.
8. Test vibration, sounds and auto-play settings. The nearby cue should play once on
   entering 20 m rather than loop. Device silent/DND policies may suppress feedback.
9. Choose, cancel, replace and remove a profile photo. Restart to verify persistence
   and confirm it is never shown as the peer's transferred profile data.
10. Interrupt/resume a model download. Corrupt or truncate a file and confirm it never
    becomes ready. Remove a pack and confirm Original voice still works.
11. Clear history only after playback/capture stops; confirm private voice clips are
    removed. Install Debug beside standalone and confirm their data remains separate.

12. Complete onboarding with airplane mode enabled, choose each role, and restart.
    Confirm role persistence; emergency staff remain labeled unverified and can
    proceed without an email step. Confirm the profile photo remains local.
13. Change UI language independently from source speech, translation target and TTS
    voice, restart, and confirm each value persists. Choose a fallback UI language
    and inspect its coverage diagnostic and English fallback.
14. Inspect each speech pack's release availability and exact total size. Interrupt
    a download, resume it, confirm installed status follows checksum completion,
    remove it and retry. Hindi speech must show unavailable in this release.

Capture logs with:

```powershell
adb logcat -s Talk2Native ReactNativeJS AndroidRuntime
```

Attach the reproduction and relevant error. Do not include tokens or private messages.
