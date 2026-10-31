"""pip install onnxruntime numpy; python scripts/inspect-models.py model-assets"""
import sys,json,pathlib,onnxruntime as ort,numpy as np
root=pathlib.Path(sys.argv[1])
for file in root.glob('*.onnx'):
 session=ort.InferenceSession(str(file),providers=['CPUExecutionProvider'])
 print(file.name,[(x.name,x.shape,x.type) for x in session.get_inputs()],[(x.name,x.shape) for x in session.get_outputs()])
 if file.name.startswith('indicwav2vec-'):
  vocab=json.loads(file.with_name(file.name.replace('-int8.onnx','-vocab.json')).read_text())
  logits=session.run(None,{session.get_inputs()[0].name:np.zeros((1,16000),dtype=np.float32)})[0]
  assert logits.shape[-1]==max(vocab.values())+1,'CTC model/vocab mismatch'
 del session
