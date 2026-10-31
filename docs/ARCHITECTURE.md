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

## Stage 3 public voice, language flow and location

The existing MeshPacket v1 envelope now accepts `voice` and `position` types.
Voice body schema v1 has meta/chunk/receipt/cancel operations. Metadata binds
transfer ID = originating message ID, source key-derived ID, public destination
`*`, PCM format `pcm-s16le-16000-mono`, bytes/count, SHA-256, creation/expiry,
source language and optional 256-character transcript. Each chunk carries transfer
ID, sequence and base64 bytes; source/destination/version are also in the signed
outer packet. Receiver validates the manifest before allocating files or buffers.

MeshVoiceStore uses AtomicFile metadata and separate piece files, never the saved
Settings JSON. Limits: 3 seconds/96,000 bytes; 512 raw bytes per piece, at most 188;
2 outgoing and 6 active transfers; 32 retained records; 4 MiB spool; 30-minute
expiry; 3 automatic rounds separated by 30 seconds. One bulk packet enters the
router per second, with at most 4 queued bulk packets and reserved control slots.
Original direct VoiceTransfer retains its independent 20-second limit.

Received signed wire envelopes remain in a bounded relay spool after local audio
completion. The relay pumps these through the same MeshRouter and BLE framing,
increments the existing hop field, preserves the origin signature and excludes
the ingress link. This avoids requiring a 188-piece note to fit a 16-packet router
queue. Restart resumes durable pieces/cursors; a later whole-note round recovers
missing pieces. Unknown-manifest chunks allocate nothing. Duplicates compare
bytes; a full hash mismatch never reaches playback. Origin-signed cancellation
cleans incomplete transfer files, but cannot recall already received public copies.
Expiry/clear-history remove the spool; clear-history also removes voice packets
from the router journal and stops mesh before deleting saved clips.

MeshSendQueue selects priority at packet boundaries, keeping fragments contiguous.
SOS and receipts precede pending bulk; an already active packet finishes first.
Transport queues are bounded; queue pressure rejects/retries instead of erasing
all queued frames. GATT operations negotiate service discovery after MTU handling;
write timeouts retry and eventually disconnect. A fresh first fragment replaces
an incomplete prior packet, permitting recovery after a failed write. These paths
need physical BLE validation. They do not establish an emergency latency bound.

States: queued (durable, possibly no link), transferring (admitted to a neighbor
transport), custody (a neighbor reports retention of at least one piece, not the whole note), delivered (at least one signed
public recipient reports durable completed audio), failed (three rounds exhausted),
expired and cancelled. Broadcast delivery does not mean all recipients received
or anyone listened. Frame/packet receipt is not full-note delivery. Native
Talk2Mesh logs record IDs, status, byte counts, ingress and hop hints, never raw
PCM, transcript or coordinates.

Mesh voice is explicitly PUBLIC BROADCAST, as confirmed in the UI. Relays can
read audio/transcripts. There is no private mesh voice or E2EE claim. Signatures
protect origin content and bind a device key, not a person's identity or staff
role; mutable hop fields remain unauthenticated routing hints. Direct paired
voice retains its existing authenticated encryption. Profile photos remain local.

SpeechEngine recording and VoiceTransfer local files/playback are reused.
Optional STT reads the saved clip, so a missing/incompatible pack cannot erase
Original audio. The receiver can independently translate a source transcript and
synthesize in its selected voice, only when the target and voice match and packs
are installed. ModelStore checksum/resume behavior is retained. The exact tested
versus unavailable model matrix is in MODEL_HOSTING.md.

Public mesh coordinates require separate per-session consent. Updates are at
most once per 10 seconds, expire after 30 seconds, and have an explicit stop
packet. Stale/future/out-of-range coordinates and accuracy worse than 100 m are
excluded from the radar. Stop packets prevent older fixes from reappearing.
Location sharing stops on background; expiry handles lost stop packets. A bounded
128-peer location map expires discovery entries after five minutes. peerView
produces the SAME filtered collection for dots and rows. Dots are anonymous,
colored by route hint only; rows hold names, self-declared roles, Unverified,
GPS distance/uncertainty, last seen and transport. RSSI never produces a position.
Haversine and compass-relative bearing are used; stale/unreliable compass data
falls back to north-up. Distances outside the drawn radius are visually clamped;
rows show the measured distance and uncertainty.

Optional Wi-Fi Aware/Nearby is DEFERRED: no phones were connected, so there are no
BLE throughput/range measurements to justify either integration. No new transport
or fallback is claimed. No dashboard, live call, Meshtastic or Next.js service was
implemented.
