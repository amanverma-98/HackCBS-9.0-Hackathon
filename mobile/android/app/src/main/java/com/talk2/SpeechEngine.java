package com.talk2;
import ai.onnxruntime.*;
import android.media.*;
import org.json.*;
import java.nio.*;
import java.util.*;
import java.io.*;
/** Serialized CPU inference; only the current operation's sessions remain resident. */
public final class SpeechEngine {
 private final ModelStore store;
 private volatile boolean recording;private AudioRecord mic;private Thread capture;private ByteArrayOutputStream pcm;private volatile String captureError;
 SpeechEngine(ModelStore s){store=s;}
 synchronized void start()throws Exception{
  if(mic!=null)throw new IOException("Already recording");int min=AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
  if(min<=0)throw new IOException("16 kHz microphone capture unavailable");
  mic=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(min,6400));
  if(mic.getState()!=AudioRecord.STATE_INITIALIZED){mic.release();mic=null;throw new IOException("Microphone unavailable");}
  pcm=new ByteArrayOutputStream();captureError=null;
  try{mic.startRecording();if(mic.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new IOException("Microphone did not start");}
  catch(Exception e){mic.release();mic=null;throw e;}
  recording=true;final AudioRecord source=mic;final ByteArrayOutputStream buffer=pcm;
  capture=new Thread(()->{try{byte[] b=new byte[3200];while(recording&&buffer.size()<640000){int n=source.read(b,0,Math.min(b.length,640000-buffer.size()));if(n>0)buffer.write(b,0,n);else if(n<0){if(recording)captureError="AudioRecord error "+n;break;}}}catch(Exception e){if(recording)captureError=e.getMessage();}finally{recording=false;}},"Talk2-mic");capture.start();
 }
 synchronized byte[] stop()throws Exception{
  if(mic==null)throw new IOException("No recording");recording=false;
  try{mic.stop();capture.join(2000);if(capture.isAlive())throw new IOException("Microphone did not stop");if(captureError!=null)throw new IOException(captureError);return pcm.toByteArray();}
  finally{mic.release();mic=null;}
 }
 private OrtSession session(String pack,String name)throws Exception{try(OrtSession.SessionOptions options=new OrtSession.SessionOptions()){options.setIntraOpNumThreads(2);options.setInterOpNumThreads(1);return OrtEnvironment.getEnvironment().createSession(store.file(pack,name).getAbsolutePath(),options);}}
 synchronized String transcribe(byte[] bytes,String lang)throws Exception{
  if(!store.file(lang,"ready.json").exists())throw new IOException("Install "+lang+" speech pack first");int n=bytes.length/2;if(n<1600)throw new IOException("Hold to talk for at least 0.1 seconds");
  ShortBuffer shorts=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();double mean=0;for(int i=0;i<n;i++)mean+=shorts.get(i)/32768.0;mean/=n;double variance=0;for(int i=0;i<n;i++)variance+=Math.pow(shorts.get(i)/32768.0-mean,2);if(variance/n<1e-9)throw new IOException("Recording is silent. Check microphone permission and speak closer.");double sd=Math.sqrt(variance/n+1e-7);FloatBuffer values=FloatBuffer.allocate(n);for(int i=0;i<n;i++)values.put((float)((shorts.get(i)/32768.0-mean)/sd));values.flip();
  JSONObject vocab=new JSONObject(ModelStore.read(store.file(lang,"indicwav2vec-"+lang+"-vocab.json")));Map<Integer,String> inverse=new HashMap<>();Iterator<String> keys=vocab.keys();while(keys.hasNext()){String k=keys.next();inverse.put(vocab.getInt(k),k);}int size=Collections.max(inverse.keySet())+1,blank=vocab.optInt("<pad>",vocab.optInt("[PAD]",0));
  try(OrtSession s=session(lang,"indicwav2vec-"+lang+"-int8.onnx");OnnxTensor input=OnnxTensor.createTensor(OrtEnvironment.getEnvironment(),values,new long[]{1,n});OrtSession.Result result=s.run(Collections.singletonMap(s.getInputNames().iterator().next(),input))){
   float[][] frames=((float[][][])result.get(0).getValue())[0];StringBuilder out=new StringBuilder();int previous=-1;
   for(float[] frame:frames){if(frame.length!=size)throw new IOException("STT model and vocabulary dimensions differ");int best=0;for(int j=1;j<frame.length;j++)if(frame[j]>frame[best])best=j;String token=inverse.getOrDefault(best,"");if(best!=blank&&best!=previous&&!token.startsWith("<")&&!token.startsWith("["))out.append(token.equals("|")?" ":token);previous=best;}
   return out.toString().trim().replaceAll("\\s+"," ");
  }
 }
 synchronized void speak(String text,String lang)throws Exception{
  if(!store.file(lang,"ready.json").exists())throw new IOException("Install "+lang+" speech pack first");
  JSONObject v=new JSONObject(ModelStore.read(store.file(lang,"vits-"+lang+"-vocab.json")));boolean inter=v.optBoolean("interleave_pad",true);long pad=v.optLong("pad_id",0);List<Long> ids=new ArrayList<>();if(inter)ids.add(pad);int unknown=0,mapped=0;
  for(int cp:text.toLowerCase(Locale.ROOT).replaceAll("\\s+"," ").codePoints().toArray()){
   String ch=new String(Character.toChars(cp));if(!v.has(ch)){if(Character.isLetterOrDigit(cp)||Character.getType(cp)==Character.NON_SPACING_MARK||Character.getType(cp)==Character.COMBINING_SPACING_MARK)unknown++;continue;}ids.add(v.getLong(ch));mapped++;if(inter)ids.add(pad);
  }
  if(mapped==0||unknown>0)throw new IOException("Text does not match the target voice vocabulary");
  long[] tokens=new long[ids.size()];for(int i=0;i<tokens.length;i++)tokens[i]=ids.get(i);
  try(OrtSession s=session(lang,"vits-"+lang+"-int8.onnx");OnnxTensor input=OnnxTensor.createTensor(OrtEnvironment.getEnvironment(),LongBuffer.wrap(tokens),new long[]{1,tokens.length})){
   if(s.getInputNames().size()!=1)throw new IOException("Expected MMS-VITS single-input export");
   try(OrtSession.Result result=s.run(Collections.singletonMap(s.getInputNames().iterator().next(),input))){
    FloatBuffer data=((OnnxTensor)result.get(0)).getFloatBuffer();short[] audio=new short[data.remaining()];for(int i=0;i<audio.length;i++)audio[i]=(short)Math.max(-32767,Math.min(32767,data.get()*32767));
    int min=AudioTrack.getMinBufferSize(16000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);AudioTrack track=new AudioTrack(AudioManager.STREAM_MUSIC,16000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(min,8192),AudioTrack.MODE_STREAM);
    try{track.play();int p=0;while(p<audio.length){int k=track.write(audio,p,Math.min(4096,audio.length-p));if(k<=0)throw new IOException("Speaker failure "+k);p+=k;}long deadline=System.currentTimeMillis()+audio.length/16+2000;while(track.getPlaybackHeadPosition()<audio.length&&System.currentTimeMillis()<deadline)Thread.sleep(20);}finally{track.stop();track.release();}
   }
  }
 }
 void close(){if(mic!=null)try{stop();}catch(Exception ignored){}}
}
