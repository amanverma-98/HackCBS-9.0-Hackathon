package com.talk2;

import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import android.util.Base64;
import java.util.UUID;

/** Bounded, authenticated-by-radio PCM transfers. Only one inbound clip at a time. */
final class VoiceTransfer {
 interface Sender { void send(String json) throws Exception; }
 static final int MAX_BYTES=640000, CHUNK=12000;
 private final File root;
 private JSONObject pending;
 private ByteArrayOutputStream buffer;
 private int sequence;
 private long started;
 VoiceTransfer(File root){this.root=root;root.mkdirs();}
 private void capacity() throws IOException {
  long used=0;File[] files=root.listFiles();if(files!=null)for(File f:files)used+=f.length();
  if(used+MAX_BYTES>64L*1024*1024)throw new IOException("Voice storage is full. Clear history in Settings to free space.");
 }
 synchronized String save(byte[] pcm)throws Exception{
  if(pcm.length<6400||pcm.length>MAX_BYTES||pcm.length%2!=0)throw new IOException("Hold the microphone for at least 0.2 seconds (maximum 20 seconds)");
  capacity();File f=new File(root,UUID.randomUUID()+".pcm");try(FileOutputStream out=new FileOutputStream(f)){out.write(pcm);}return f.toURI().toString();
 }
 synchronized byte[] read(String uri)throws Exception{
  File f=new File(new java.net.URI(uri));if(!f.getCanonicalFile().getParentFile().equals(root.getCanonicalFile())||!f.getName().endsWith(".pcm"))throw new IOException("Invalid voice file");
  if(f.length()<6400||f.length()>MAX_BYTES)throw new IOException("Voice message unavailable");byte[] b=new byte[(int)f.length()];try(DataInputStream in=new DataInputStream(new FileInputStream(f))){in.readFully(b);}return b;
 }
 static String hash(byte[] b)throws Exception{StringBuilder h=new StringBuilder();for(byte v:MessageDigest.getInstance("SHA-256").digest(b))h.append(String.format("%02x",v&255));return h.toString();}
 void send(String uri,JSONObject message,Sender sender)throws Exception{
  byte[] pcm=read(uri);String id=message.getString("id");
  JSONObject meta=new JSONObject(message.toString());meta.remove("audioUri");meta.remove("direction");meta.remove("status");
  sender.send(new JSONObject().put("kind","voice-start").put("id",id).put("bytes",pcm.length).put("sha256",hash(pcm)).put("message",meta).toString());
  int n=0;for(int offset=0;offset<pcm.length;offset+=CHUNK){byte[] part=java.util.Arrays.copyOfRange(pcm,offset,Math.min(pcm.length,offset+CHUNK));sender.send(new JSONObject().put("kind","voice-chunk").put("id",id).put("seq",n++).put("data",Base64.encodeToString(part,Base64.NO_WRAP)).toString());}
  sender.send(new JSONObject().put("kind","voice-end").put("id",id).toString());
 }
 synchronized JSONObject accept(JSONObject frame)throws Exception{
  String kind=frame.optString("kind");
  if(kind.equals("voice-start")){
   reset();int size=frame.getInt("bytes");if(size<6400||size>MAX_BYTES||size%2!=0)throw new IOException("Invalid voice size");
   JSONObject m=frame.getJSONObject("message");if(!m.optString("kind").equals("voice")||!m.getString("id").equals(frame.getString("id"))||m.getString("id").length()>80)throw new IOException("Invalid voice metadata");
   capacity();pending=frame;buffer=new ByteArrayOutputStream(size);started=System.currentTimeMillis();return null;
  }
  try{
   if(pending==null||!frame.getString("id").equals(pending.getString("id"))||System.currentTimeMillis()-started>60000)throw new IOException("Voice transfer expired; ask peer to retry");
   if(kind.equals("voice-chunk")){
    if(frame.getInt("seq")!=sequence++)throw new IOException("Missing voice chunk");
    String encoded=frame.getString("data");if(encoded.length()>16000)throw new IOException("Voice chunk too large");byte[] part=Base64.decode(encoded,Base64.NO_WRAP);
    if(buffer.size()+part.length>pending.getInt("bytes"))throw new IOException("Voice exceeds declared size");buffer.write(part);return null;
   }
   if(!kind.equals("voice-end"))throw new IOException("Invalid voice operation");
   byte[] pcm=buffer.toByteArray();if(pcm.length!=pending.getInt("bytes")||!hash(pcm).equals(pending.getString("sha256")))throw new IOException("Incomplete voice message");
   JSONObject result=pending.getJSONObject("message");result.put("audioUri",save(pcm));result.put("durationMs",pcm.length/32);reset();return result;
  }catch(Exception e){reset();throw e;}
 }
 synchronized void reset(){pending=null;buffer=null;sequence=0;}
 synchronized void clear()throws IOException{reset();File[] files=root.listFiles();if(files!=null)for(File f:files)if(f.getName().endsWith(".pcm")&&!f.delete())throw new IOException("Could not remove voice file");}
}
