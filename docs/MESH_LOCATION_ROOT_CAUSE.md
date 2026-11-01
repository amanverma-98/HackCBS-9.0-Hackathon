# Mesh location sharing: A shares, B shows nothing — root cause

Traced on commit f4835c9 along the path GPS fix → A publishes → mesh router → B validates →
peer state → radar/list. The receive path (`MeshRouter.receive` → `Talk2Module` position
extension → `meshPosition` event → `shared/location.cjs mergeLocationPeer`) keys coordinates
by the signed mesh node id and was not the primary fault. The failures are on A's sending
side, in router retention, and in B's rendering.

## 1. A never turns mesh sharing on (primary)

`mobile/App.tsx` kept two flags: `data.shareLocation` (paired phone) and `meshSharingRef` /
`meshSharing` (mesh). `toggleSharing` showed the mesh consent dialog only if the mesh was
already running at that instant, and `askPublicLocation`'s callback first awaited
`permissions("location")`, then returned early unless `meshEnabledRef.current` was true.

Any system dialog pauses the activity. `Talk2Module.onHostPause` calls `stopMeshInternal`,
which emits `meshStopped`, and the `meshStopped` handler in `App.tsx` set
`meshEnabledRef = false` and `meshSharingRef = false`. So the consent callback returned before
enabling mesh sharing. Separately, every later pause (permission prompt, Bluetooth
discoverable dialog, app switch) silently cleared mesh sharing again, and the always-on mesh
restart never restored it.

The Radar switch rendered `data.shareLocation || meshSharing`, so A saw "Share my location"
ON while `sendPosition` skipped every mesh send.

## 2. Late joiners and relays never received a still-valid position

`sendPosition` only ran on a new GPS fix with a 10 s throttle; nothing resent on a new
neighbour, mesh restart or refresh. In `MeshRouter.receive` a custody receipt from the
**first** neighbour removed a broadcast packet from the queue. A phone that connected later
(B joining after A started sharing) therefore never got the packet, even while it was valid.
The same applied to relayed positions, presence and SOS.

## 3. B hid valid coordinates when its own GPS was not ready

`shared/location.cjs peerView` produced a position only when B's own fix was fresh, and
`RadarPeers` then showed "No location". That made "A is sharing but your GPS is acquiring"
look identical to "A is not sharing".

## Contributing defects found on the way

- `Talk2Module.stopMeshInternal` emitted `meshStopped` even when no mesh was running, so the
  app reset its mesh state on every pause.
- `MeshRouter.receive` re-emitted message events and re-ran extensions for every duplicate
  copy, which inflated event traffic.

See `docs/WORK_CHECKPOINT.md` ("Mesh location and reliability") for the fixes and tests.
