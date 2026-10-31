# Stage 2 reference implementation map

Reviewed before Stage 2 implementation edits, 2026-10-31. Checkout: `main`,
`fa4de0eea50e2640f6339cac0ed9c8491283c538`, clean. This is a design study;
Talk2 does not copy source from these projects.

## BitChat Android

- Repository: https://github.com/permissionlesstech/bitchat-android
- Revision studied: `010789adde3d7d93b6f08f9b72e6d9a00e8fbe9d` (main, packet
  deduplication change). Main project architecture and README were also read.
- License: exact repository `LICENSE.md` previously inspected in Stage 1 is GPL-3.0.
  README's public-domain statement is not sufficient to override the repository
  license. No source reuse.
- Studied: README transport/test notes; `AppConstants.kt` mesh UUID boundary;
  `BluetoothMeshService.kt` path surfaced by the radar PR; `MessageRouter` and
  packet deduplication described by repository architecture and commit title.
- Useful behavior: bounded TTL, duplicate suppression, fragmentation/reassembly,
  retry/outbox separation, and radio behavior requiring physical devices.
- Talk2 mapping: versioned bounded packets, bounded seen cache, bounded retry
  queue and explicit device test cards. Re-authored in Java; no code copied.

## ResQMesh

- Repository: https://github.com/jangkayl/ResQMesh
- Revision studied: repository `main` snapshot served 2026-10-31. GitHub's commit
  history endpoint did not return an immutable hash in this research session;
  this limitation is retained explicitly instead of inventing a pin.
- License: root listing contains no `LICENSE`, `LICENSE.md` or `COPYING`; no
  permission to copy code is established. No source reuse.
- Studied: README sections “Communication and emergency workflows”, “Direct and
  relayed communication”, “How the system works”, “Testing and diagnostics”, and
  reported open far-end delivery issue. The README names `NativeBleManager`,
  `PayloadDispatcher`, SOS and incident lifecycles and Room-backed custody.
- Useful behavior: independent SOS lifecycle; local acceptance, relay custody,
  and destination delivery are separate states; relay acceptance must not be
  presented as end delivery.
- Talk2 mapping: standalone SOS IDs and explicit queued/custody/delivered events.
  Re-authored in Java; no code copied.

## Knit

- Repository: https://github.com/getknit/knit
- Revision studied: `e2c89579eb131de046fb2bc07fb7718d5cc9d598` (main, architecture
  documentation gate change); current architecture and transport descriptions
  reviewed on 2026-10-31.
- License: exact `COPYING` reviewed; GNU GPL version 3. No source reuse.
- Studied: `docs/ARCHITECTURE.md` and README. `BluetoothMeshTransport`,
  `CompositeMeshTransport`, `MeshRouter`, `FakeLoopTransport`, and relay/outbox
  behaviors are described there.
- Useful behavior: a transport seam keeps routing independent of the radio;
  deduplication, hop bounds, expiry and store-and-forward are protocol concerns.
- Talk2 mapping: separate BLE transport and `MeshRouter`, leaving `PeerRadio`
  unchanged. Re-authored in Java; no code copied.

## Reuse decision

No third-party application source was copied, translated, or mechanically
adapted. Android Bluetooth platform APIs and Talk2's existing security code are
used directly. All mesh packet and routing implementation is authored for Talk2.
The ResQMesh revision pin remains an unresolved research limitation and should be
verified before future comparative research.
