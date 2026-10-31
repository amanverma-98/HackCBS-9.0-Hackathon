# Build and validation result — Talk2 1.1.0

## Automated checks

- 13 Node tests passed: languages/protocol validation, GPS distance and bearing,
  retention, translation routing, script detection, microphone press/release races,
  backend authentication and request validation.
- TypeScript strict checking passed.
- Java tests passed for pairing/SAS, directional encryption, replay/reflection,
  tamper and wrong-session rejection.
- Java model-store tests passed for verified/tampered/removed states, duplicate and
  incomplete manifests and path traversal.
- VoiceTransfer passed maximum-size round trip, ordered chunks, missing/truncated
  rejection, SHA-256 integrity and private-path checks.
- The clean Android build compiled Java, generated Hermes bundles, processed resources,
  ran lint-vital, dexed and packaged both ARM64 outputs.
- APK verification passed with Android Signature Scheme v2 and one Android test signer.
- APK contains the Hermes bundle, ARM64 Hermes runtime and ARM64 ONNX Runtime.
- Source scan found no .kt/.kts files and none of the prohibited legacy-project terms.

## Outputs

- dist/Talk2-1.1.0-arm64-test.apk
  - package: com.talk2
  - versionCode: 2
  - versionName: 1.1.0
  - size: 33,721,876 bytes
  - SHA-256: 9fe4ab2dec22a936d77e2c5076d4420da8aceff27a66765aa6c0054b28d19284
  - standalone Hermes bundle, Android test/debug signing identity
- dist/Talk2-1.1.0-arm64-unsigned.aab
  - size: 20,696,255 bytes
  - SHA-256: 176227e4e926c882a4c6b317b097ba8f252d190167abc1f5f8f37dc19de61004
  - requires the owner's Play upload key before publication

The final clean build completed successfully in 50 seconds after the toolchain cache
was prepared. Gradle reported deprecated build features that will need attention
before Gradle 9; they do not fail this Gradle 8.13 build.

## Model release evidence

All 39 files referenced by the bundled manifest use the public Somu9450/Talk2
model-pack-v1 direct asset path and match the release metadata captured during this
work. A real English STT ONNX file matched SHA-256
9d64361bf2407fb7278cf546439786704ae05b92e5762022418f35968bfa3f65,
loaded with input [batch, sequence_length] float32, returned shape [1,49,32]
for a one-second zero test input, and produced finite output.

## Required device validation

No build environment can prove microphone routing, radio discovery, OEM permissions,
speaker volume, haptic hardware, GPS/compass accuracy or language quality on the
user's phones. Run DEVICE_TESTS.md on two physical phones. The included APK is a
test artifact, not a Play production-signed release.
