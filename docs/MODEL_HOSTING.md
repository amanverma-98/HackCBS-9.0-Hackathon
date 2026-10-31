# Model hosting and downloads

## Built-in release

`model-host/upstream-manifest.json` contains the verified asset names, exact byte sizes, SHA-256 digests and direct URLs for `Somu9450/Talk2` release `model-pack-v1`. Leave the app's manifest URL blank to use it. The app consumes **39 assets: nine complete speech packs and three shared translation files**. It has no Hindi ONNX weights; a separate Hindi release is required. Do not publish a pack until its model-card and redistribution terms have been checked.

The screenshot's 78–82 MB labels do not match these assets. Use manifest byte sizes. A language needs both its speech recognition model/vocab and its voice model/vocab. Language packs alone do not perform text translation.

## Publish your own GitHub Release

1. Create your `Talk2` GitHub repository and commit this source package, including `package-lock.json`. Keep weights and generated binaries outside ordinary git history.
2. Download the Talk2 release files into a local `model-assets` directory. Preserve names. For each language XX, all four are required:

   - `indicwav2vec-XX-int8.onnx`
   - `indicwav2vec-XX-vocab.json`
   - `vits-XX-int8.onnx`
   - `vits-XX-vocab.json`

   Codes are `hi`, `ta`, `bn`, `gu`, `mr`, `kn`, `ml`, `te`, `or`, `en`.
3. Obtain/export the **Hindi model pair and voice pair separately**. Do not rename a different language model to Hindi. The supplied upstream STT exporter no longer records the Hindi checkpoint ID; you must supply a compatible Wav2Vec2 CTC checkpoint and regenerate its matching vocab. `scripts/export_models.py` retains this missing-ID condition explicitly. `scripts/export_tts_models.py hi` exports the upstream MMS Hindi voice if you have access and compatible export dependencies.
4. Include the three shared translation files if needed:

   - `indictrans2-encoder-int8.onnx`
   - `indictrans2-decoder-int8.onnx`
   - `indictrans2-vocab.json`

5. Inspect inputs and STT vocab dimensions:

```sh
python -m pip install onnxruntime numpy
python scripts/inspect-models.py model-assets
```

6. Generate your manifest from the actual local bytes:

```sh
node scripts/make-manifest.mjs model-assets https://github.com/YOUR_USERNAME/Talk2/releases/download/model-pack-v1 model-host/manifest.json
```

7. Authenticate and upload using GitHub CLI. These commands publish the chosen release assets; run them only for your intended repository visibility:

```sh
gh auth login
gh release create model-pack-v1 --repo YOUR_USERNAME/Talk2 --title "Talk2 model pack v1" --notes "Offline speech and translation assets; see model licenses."
gh release upload model-pack-v1 model-assets/*.onnx model-assets/*.json model-host/manifest.json --repo YOUR_USERNAME/Talk2
```

On Windows PowerShell, explicit paths work everywhere. If shell wildcard expansion fails, upload each asset with `Get-ChildItem model-assets -File | ForEach-Object { gh release upload model-pack-v1 $_.FullName --repo YOUR_USERNAME/Talk2 }` and upload `model-host/manifest.json` separately.

8. Paste this in Talk2 Settings → Model manifest URL:

```text
https://github.com/YOUR_USERNAME/Talk2/releases/download/model-pack-v1/manifest.json
```

To set it for every new install, update `DEFAULT_MANIFEST_URL` in `mobile/src/config.ts` before building.

9. Download selected packs on each phone, activate a language, then test with internet off while leaving the local radio enabled.

## Storage and updates

Models belong in GitHub **Release assets**, an object store or CDN, rather than ordinary Git commits. Only source, small metadata and manifests need to be in git. Git LFS is optional and introduces its own quotas. No personal GitHub token should be embedded in an APK. Private assets need a server-issued authenticated download or short-lived signed URL.

Each manifest file record has `name`, `bytes`, `sha256`, and `url`. URLs must be HTTPS. File names are validated against path traversal. Downloads use `.part` files, resume with HTTP Range, and restart if a host ignores Range. The exact size and checksum are checked before committing the file. The ready marker is written only after every required file passes. Startup verifies installed files against their saved manifest. Pausing keeps partial bytes. Remove deletes the selected pack.

Use a new immutable release tag for a new model export and regenerate the manifest. Never disable checksum validation to accept a mismatched model. If a model uses external ONNX tensor data (`.onnx.data`), re-export as a self-contained graph for this manifest format, or extend the pack/loader deliberately; this implementation expects the listed self-contained graphs.

## Google Drive

Drive is suitable for backups. Ordinary `drive.google.com/file/d/.../view` URLs return a web viewer, and large downloads can have confirmation or quota pages. Talk2 rejects a web page through its size/checksum checks. Those URLs are not reliable production model endpoints.

Use GitHub Releases or HTTPS object storage/CDN for direct mobile downloads. If Drive must be the backing store, provide a server that accesses Drive with server-side credentials and serves stable binary HTTPS responses with Range support. Put those URLs into the manifest. This project does not include a Drive proxy.

## Offline language behavior

STT and TTS use one active language per phone. Only installed languages are eligible for script-based refinement; this is a heuristic after transcription, not acoustic neural language identification. Hindi and Marathi share a script and retain the chosen active language.

General IndicTrans2 inference is enabled only for Hindi ↔ Marathi in this build. Other pairs fail explicitly and preserve the original text. The latest supplied branch experiments with Unicode-offset transliteration, but that is not equivalent to validated IndicTrans preprocessing or quality evaluation. English↔Indic requires separate appropriate model families. Five predefined alert messages use local phrase tables for all ten languages; target speech playback still requires its speech pack.

The TTS exporter uses Meta MMS checkpoint voices. Check each model card's license before redistribution or commercial use. Model licensing is separate from this app's source-code license.

## Export a replacement Hindi acoustic model

A published compatible-family starting point is `ai4bharat/indicwav2vec-hindi` on Hugging Face. It is a replacement checkpoint, not a recovery of the missing original APK weights. Review its model card, ensure access, export both weight and vocabulary, inspect the ONNX signature, and validate Hindi recordings before publishing:

```sh
python -m pip install torch transformers huggingface_hub onnx onnxruntime sentencepiece protobuf
TALK2_STT_HI_REPO=ai4bharat/indicwav2vec-hindi python scripts/export_models.py hi
python scripts/export_tts_models.py hi
python scripts/inspect-models.py model-assets
```

PowerShell: set `$env:TALK2_STT_HI_REPO="ai4bharat/indicwav2vec-hindi"` before invoking the exporter. The scripts write into `model-assets` by default; `TALK2_MODEL_OUTPUT` overrides it. Export compatibility varies across PyTorch/Transformers versions, and this replacement export has not been run as part of this package's validation. After obtaining the four Hindi files, regenerate and publish your release manifest normally.

Checkpoint reference: https://huggingface.co/ai4bharat/indicwav2vec-hindi
