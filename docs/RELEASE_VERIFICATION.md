# Model release verification — 2026-10-30

Configured release: https://github.com/Somu9450/Talk2/releases/tag/model-pack-v1

GitHub listed 41 release assets. The 39 files consumed by Talk2—nine complete
speech packs and three shared translation files—matched the bundled manifest's
filenames, exact byte sizes and reported SHA-256 digests. The two archive assets
are not used by the app. A direct English vocabulary download followed HTTPS
redirects successfully, and the English STT model checksum and ONNX signature
were also checked.

Hindi's four required speech files are not present. Talk2 does not mark Hindi
installed or substitute another language model. Text and Original voice remain
available without those files.

Run `node scripts/verify-release.mjs` to repeat metadata checks. GitHub's API can
occasionally return a cached 404; direct public release downloads remain the
runtime source. Android verifies every downloaded file's exact length and SHA-256
before marking a pack ready.
