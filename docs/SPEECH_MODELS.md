# Speech model references

Talk2 keeps speech recognition and speech synthesis models as separately
downloaded, checksum-verified assets. Model files are not bundled in the
application source.

## Runtime and model options

- [Vosk](https://github.com/alphacep/vosk-api) provides offline streaming
  speech recognition, small deployable models, vocabulary reconfiguration and
  bindings for Android and other platforms.
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) provides ONNX Runtime
  pipelines for speech recognition, speech synthesis and related audio tasks.
  It is a candidate runtime/reference for future Talk2 model packs.
- [AI Kosh model catalogue](https://aikosh.indiaai.gov.in/home/models/) is the
  Government of India's catalogue for discovering model cards and
  redistribution terms.
- [AI4Bharat IndicConformer](https://ai4bharat.iitm.ac.in/areas/model/ASR/IndicConformer/)
  is the reference page for Indic ASR model information.

## Packaging requirements

Each Talk2 pack must provide the model files, vocabulary/configuration files,
byte sizes, SHA-256 digests, download URLs and a license/model-card review.
Do not mix checkpoints from different releases without validating tokenizer
compatibility, sample rate, language coverage and output format. A model
catalogue entry is a discovery reference, not permission to redistribute
weights.
