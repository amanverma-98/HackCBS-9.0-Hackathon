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

15. BLE two-phone mesh: on both phones grant Bluetooth permissions, open Radar and
    start BLE mesh. Send a short public text and a generic SOS. Record packet ID,
    device/API, arrival time, displayed state and logs. Verify the UI warns that
    relay phones can read the body. Background either app: mesh should stop and
    the screen should reflect it. Confirm the paired RFCOMM/Wi-Fi Direct path still
    works independently before and after mesh use.
16. BLE three-phone relay: place A and C outside mutual BLE range, B between them;
    confirm A and C cannot discover/connect directly, then send text and SOS A→B→C.
    Verify C received once despite retransmission, inspect custody vs destination
    receipt timing, kill/restart A and B with queued traffic, recover a disconnected
    neighbor, test queue limits, and test TTL/expiry. Record exact topology, phones,
    Android versions, timestamps, radio/power state and logcat. No emulator result
    substitutes for this card.

Capture logs with:

```powershell
adb logcat -s Talk2Native ReactNativeJS AndroidRuntime
```

Attach the reproduction and relevant error. Do not include tokens or private messages.

## Stage 3 physical voice/location cards (all NOT TESTED)

Initial `adb devices -l` was empty; one A142 running Android 17 appeared during
final validation. Multi-phone radio, playback and location cards remain NOT TESTED.
There are no emulator results. JVM signed A-B-C simulation is protocol evidence only. Fill every
field below from actual devices; do not replace blanks with estimated results.
Use the standalone APK (bundled UI, no Metro); record its SHA-256 from the final
WORK_CHECKPOINT.md plus installed package version/build commit. Preserve existing
phone data if an APK signature mismatch prevents installation.

| Evidence field | Phone A | Phone B | Phone C (relay test) |
| --- | --- | --- | --- |
| Model / serial / Android version / security patch | NOT TESTED | NOT TESTED | NOT TESTED |
| APK path / SHA-256 / commit / package / version | NOT TESTED | NOT TESTED | NOT TESTED |
| Bluetooth scan/connect/advertise, microphone, location permission grants | NOT TESTED | NOT TESTED | NOT TESTED |
| Bluetooth / Wi-Fi / airplane mode / mobile data / internet state | NOT TESTED | NOT TESTED | NOT TESTED |
| Foreground, battery optimization, distance/barriers, GPS accuracy | NOT TESTED | NOT TESTED | NOT TESTED |
| UTC start/end, transfer ID, PCM bytes, note duration, receipt sender | NOT TESTED | NOT TESTED | NOT TESTED |
| Queued / first transmit / custody / recipient receipt timestamps | NOT TESTED | NOT TESTED | NOT TESTED |
| Original playback, transcript, translation/TTS results and latency | NOT TESTED | NOT TESTED | NOT TESTED |
| Logs, screenshots and topology evidence paths | NOT TESTED | NOT TESTED | NOT TESTED |

Capture before each card (replace SERIAL; run commands separately per phone):

```powershell
adb -s SERIAL shell getprop ro.product.model
adb -s SERIAL shell getprop ro.build.version.release
adb -s SERIAL shell getprop ro.build.version.security_patch
adb -s SERIAL shell dumpsys package com.talk2
adb -s SERIAL logcat -v threadtime Talk2Mesh:I Talk2Native:W '*:S' > phone-A-stage3.log
```

Talk2Mesh logs contain IDs/state/bytes/ingress/hop hints, not audio, transcript or
GPS payload. Keep logs with the exact test timestamps. Use the UI history to verify
original playback. A log of queue admission or custody is not recipient delivery.

### Card 17: two-phone Original voice without models/internet

1. Record model-pack status showing no installed packs. Disable cellular data and
   internet Wi-Fi access; leave Bluetooth and required location services enabled.
   Keep both standalone apps foreground. Start BLE mesh in Radar on A and B.
2. Record direct BLE link identities and absence of paired direct mode. On A tap
   Record public note, speak a harmless one-second phrase, and Finish. Play the
   draft, then confirm Broadcast public voice. Repeat B to A. Try the 3-second cap.
3. Capture transfer ID, exact logged PCM byte count (at most 96,000), sender queued/
   transferring/custody and recipient delivered states, and B's completed-note
   event. Play Original on B with no model download. Recipient delivered must
   identify a recipient and must not mean every receiver/read/heard.
4. During a note send a text and public SOS. Show SOS is admitted ahead of pending
   bulk after the active packet; measure actual time. Do not infer latency from a
   JVM priority test. Inspect Marathi labels for recording, consent, states and SOS.
5. Pause/disconnect midway. Restart mesh and recover pieces or complete a later
   automatic round; no incomplete audio must become playable. Cancel another note;
   check incomplete pieces stop forwarding. Leave an incomplete note for its
   30-minute expiry. Clear local history and confirm local spool cleanup.
6. Separately pair Classic Bluetooth and Wi-Fi Direct, confirm matching pairing
   codes, select Original, exchange/play a note up to 20 seconds offline. This is
   the direct-mode regression, not evidence of BLE mesh.

### Card 18: three-phone A-B-C voice relay

1. Physically arrange/attenuate radios so A-B and B-C work but A-C cannot link.
   Record barriers/distances and neighbor logs. With B off, prove A and C cannot
   discover/exchange over the entire observation period; maintain that isolation
   during the relay test. Do not merely turn off an A-C UI connection.
2. Start B, record its two links, and send one-second then three-second public
   notes from A. Keep B as a relay/public receiver. Verify C's own completed-note
   event and Original playback. A's receipt from B alone does NOT pass this card.
3. Correlate the same originating transfer ID/signature, ingress logs and increased
   hop hint at C. Hops are mutable routing hints; the physical no-A-C setup and
   logs are required topology evidence. Record total bytes, elapsed times and any
   drops/whole-note retries. Do not claim range/throughput from estimates.
4. Restart B midway, reconnect, and test cancellation, expiry and SOS preemption
   again. Disconnect C, retain B's durable spool, reconnect C within expiry, and
   test onward forwarding after B already saved the complete public note.
5. Record failed steps as failures. If BLE capacity is inadequate, retain these
   measurements for a later optional-transport decision; Stage 3 adds neither
   Nearby nor Wi-Fi Aware and claims no tested high-bandwidth fallback.

### Card 19: supported models and Marathi UI

1. Install checksum-verified Marathi pack on A/B using the manifest. Record its
   exact asset digests and runtime input/output signatures with inspect-models.py
   when files are available. Turn internet off after installation.
2. Keep UI language independently mr/en. Record Marathi, attach source transcript,
   public-send, preserve source transcript and original audio on B. Set translation
   target mr and TTS voice mr. Play Original, then source transcript via TTS.
3. Remove B's speech pack: Original and transcript must remain usable; TTS must
   report missing target pack. Select a different TTS language: report mismatch,
   never synthesize the translation with the wrong voice. Test unsupported en->mr.
4. Separately install shared translation plus mr voice and exercise hi TEXT -> mr
   translation/TTS. This does not test Hindi STT. Hindi speech remains BLOCKED by
   absent release files; no Hindi voice-to-voice acceptance claim is permitted.
5. Check Marathi consent, voice states, radar/list/filter, discovery, SOS feedback
   and settings. Other offered UI languages should fall back to English and expose
   coverage diagnostics. Record any missing strings rather than claiming visual QA.

### Card 20: location consent, expiry and shared filters

1. Verify public mesh sharing starts off each session. Grant explicit consent on A;
   B sees approximate distance/uncertainty from fresh coordinates. Inspect both
   phones outdoors; record fix age, accuracy and compass accuracy.
2. Stop sharing; B removes the dot but retains the discoverable row. Drop the stop
   packet by disabling a link and verify coordinates expire within 30 seconds.
   Replayed older positions must not resurrect a dot after a newer stop.
3. Select All/Direct/Relayed and verify the same collection feeds radar and list.
   No coordinate means list only. No RSSI-only direction/distance is allowed.
   Staff self-selection, unsigned profile and fake verified flags remain Unverified.
4. Test compass absent/unreliable/stale, poor GPS (>100 m accuracy), indoor fixes,
   antimeridian math (automated), and background/restart. North-up fallback must be
   labelled; role colors must not imply responder verification.

Final single-phone attempt: A142 / Android 17 appeared at closeout. Updating the
standalone APK failed with INSTALL_FAILED_UPDATE_INCOMPATIBLE because the installed
com.talk2 has a different signer. Existing installation/data were preserved; the
new build was not launched. This is not a passed physical acceptance card. Use a
matching signing key or a separate test device; full command/hash is in WORK_CHECKPOINT.md.
