# Talk2 architecture

React Native owns onboarding, profile, tabs, settings, message status and consent.
Java owns Android hardware, ONNX inference, private model/voice storage and peer
transport. The Node service is optional and receives only explicit assistant prompts.

Role selection is local Settings data. Citizen, volunteer, medical/support and
emergency staff are self-declared labels. The profile packet sends name and device
capabilities only; it does not carry a verified flag. A mobile
RoleVerificationProvider boundary currently uses a stub that always returns
unverified. See VERIFICATION_API.md for the future signed credential design.

Settings keep UI language, source speech, translation target and TTS voice as
separate values. Small English/Marathi UI resources ship in the application bundle;
missing keys use structured English fallback and are counted in the UI coverage
diagnostic. Speech/translation ONNX assets remain optional, checksum-verified
downloads. Model status distinguishes release availability, installed verification
and partial transfer bytes.

## Speech and voice

Each press owns one capture lifecycle. Permission and floor acquisition may complete
asynchronously; an early release cancels safely. Backgrounding discards the clip.
Capture is 16 kHz mono PCM16 and limited to 20 seconds.

Translated mode follows PCM → normalized waveform → CTC recognition → encrypted
text message → supported translation → receiver voice synthesis. The selected source
language is fixed when recording starts. Transcript review is optional.

Original mode follows PCM → private clip → voice-start/chunks/end → validated private
clip → AudioTrack. The radio channel encrypts every chunk. Transfer code bounds size,
sequence, timeout and storage, rejects incomplete or hash-mismatched clips, and never
sends local file paths. Peers advertise capability before this mode can send.

## Radio and security

Wi-Fi Direct carries TCP on port 47773. Bluetooth Classic uses Talk2's RFCOMM UUID.
One authenticated session is active. Pairing uses ephemeral P-256 ECDH, HKDF-SHA256,
directional AES-256-GCM keys and a six-digit code confirmed on both phones. Nonce
counters reject replay and reflection. Frames are bounded and heartbeats detect loss.

Incoming text or complete voice is persisted before ACK. IDs suppress duplicates
within retained history. An ACK means persisted, not read or played.

## Radar

The rotation-vector sensor supplies heading; a location fix allows geomagnetic
correction to true north. GPS and network providers request updates even while
stationary. Coordinates, age and accuracy go only to the paired peer after explicit
consent. Disabling sharing sends a revocation message. Stale fixes are hidden.

Haversine distance and geodesic bearing are calculated locally and rotated by the
phone heading. Signal strength is not used to invent direction. GPT is unrelated to
radar.

## Models and privacy

The bundled manifest pins HTTPS URLs, sizes and SHA-256 for 39 Talk2 release assets.
Downloads resume through Range when supported. A pack becomes ready only after every
file passes verification; startup rechecks installed files.

Photo selection uses Android's system document picker and stores a resized local JPEG.
No broad gallery permission is requested. Voice clips are app-private and cleared with
history. API keys stay on the Node server. Backgrounding stops microphone and sensors.

## Stage 2 BLE mesh prototype

BLE mesh is a separate, user-started native advertiser/scanner/GATT path. It
stops when the app is backgrounded; no foreground service or locked-screen mesh
claim is made. It is bounded to three GATT neighbors, uses a versioned packet
envelope with a four-hop/24-hour bound, 8 KiB packet cap, 1,200-character body
cap, duplicate cache and a small `AtomicFile` queue separate from saved UI state.
The origin signs packet content with a persistent P-256 Android Keystore key;
mutable hop and previous-hop fields are excluded from that signature.

The UI warns that BLE mesh body text is public to every relay. Origin signatures
provide authenticity and integrity, not confidentiality or verified real-world
identity. Do not send private or sensitive details through mesh text. Directed
text can return a destination receipt; broadcast SOS has no complete/cancelled
incident lifecycle yet. A GATT write is not proof of remote custody; the
application custody event is emitted only after a peer accepts and stores the
packet. Retry, reassembly, Android OEM behavior and A-B-C relay delivery require
physical device checks. The direct session still uses its existing independent
RFCOMM/Wi-Fi Direct `SecureChannel`.
