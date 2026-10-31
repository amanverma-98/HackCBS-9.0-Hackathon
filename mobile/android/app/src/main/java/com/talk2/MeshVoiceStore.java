package com.talk2;

import android.util.Base64;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.util.*;

/** Public broadcast PCM notes within MeshPacket v1. No private/E2EE audio claim. */
final class MeshVoiceStore {
 static final int CHUNK=512, MAX_BYTES=96000, MAX_CHUNKS=188, MAX_ACTIVE=6, MAX_OUT=2, MAX_RECORDS=32;
 static final long TTL=30*60*1000L, MAX_DISK=4*1024*1024L;
 interface Transport { boolean queue(String destination,String body,int priority)throws Exception; default boolean relay(String wire,String ingress)throws Exception{return false;} }
 interface Sink { String save(byte[] pcm)throws Exception; void event(String type,JSONObject data); }
 private final File root; private final String node; private final Transport transport; private final Sink sink;
 private final LinkedHashMap<String,JSONObject> records=new LinkedHashMap<>();
 MeshVoiceStore(File root,String node,Transport transport,Sink sink)throws Exception {
  this.root=root;this.node=node;this.transport=transport;this.sink=sink;
  if(!root.exists()&&!root.mkdirs())throw new IOException("Mesh voice storage unavailable");
  File[] files=root.listFiles();if(files!=null)for(File f:files)if(f.getName().endsWith(".json.bak")){File base=new File(f.getPath().substring(0,f.getPath().length()-4));try(InputStream ignored=new AtomicFile(base).openRead()){} }
  files=root.listFiles();if(files!=null)for(File f:files)if(f.getName().endsWith(".json"))try {
   if(f.length()>8192||records.size()>=MAX_RECORDS)throw new IOException("Invalid voice record");
   JSONObject m=new JSONObject(ModelStore.read(f));validate(m, m.getString("source"),System.currentTimeMillis(),false);
   if(!f.getName().equals(m.getString("transfer")+".json"))throw new IOException("Invalid record path");
   records.put(m.getString("transfer"),m);
  }catch(Exception invalid){f.delete();}
  // Orphan/temp pieces cannot become a transfer after restart.
  if(files!=null)for(File f:files)if(!f.getName().endsWith(".json")){
   String id=f.getName().split("\\.")[0];if(!records.containsKey(id)||f.getName().endsWith(".tmp"))f.delete();
  }
  cleanup(System.currentTimeMillis());
 }
 static void validate(JSONObject m,String sender,long now,boolean fresh)throws Exception {
  String id=m.getString("transfer");UUID.fromString(id);UUID.fromString(m.getString("source"));
  int bytes=m.getInt("bytes"),count=m.getInt("count");long created=m.getLong("created"),expires=m.getLong("expires");
  if(m.getInt("v")!=1||!m.getString("source").equals(sender)||!m.getString("destination").equals("*")||
     !m.getString("message").equals(id)||!m.getString("format").equals("pcm-s16le-16000-mono")||
     bytes<6400||bytes>MAX_BYTES||bytes%2!=0||count!=(bytes+CHUNK-1)/CHUNK||count>MAX_CHUNKS||
     !m.getString("sha256").matches("[a-f0-9]{64}")||created>now+300000||expires<=created||expires-created>TTL||
     (fresh&&expires<=now)||!m.getString("language").matches("hi|mr|en|ta|bn|gu|kn|ml|te|or")||
     m.optString("transcript").length()>256)throw new IOException("Invalid public voice metadata");
 }
 private File file(String id,String suffix){return new File(root,id+suffix);}
 private void write(File target,byte[] bytes)throws Exception{
  if(used()+bytes.length>MAX_DISK)throw new IOException("Mesh voice storage full");
  AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;
  try{out=atomic.startWrite();out.write(bytes);atomic.finishWrite(out);}catch(Exception e){if(out!=null)atomic.failWrite(out);throw e;}
 }
 private void persist(JSONObject m)throws Exception{write(file(m.getString("transfer"),".json"),m.toString().getBytes("UTF-8"));}
 private long used(){long n=0;File[] fs=root.listFiles();if(fs!=null)for(File f:fs)n+=f.length();return n;}
 private long active(){return records.values().stream().filter(m->m.optString("state").equals("receiving")||m.optString("state").equals("queued")||m.optString("state").equals("transferring")||m.optString("state").equals("custody")).count();}
 synchronized String enqueue(byte[] pcm,String language,String transcript,long now)throws Exception{return enqueue(pcm,language,transcript,now,"");}
 synchronized String enqueue(byte[] pcm,String language,String transcript,long now,String localUri)throws Exception{
  cleanup(now);if(active()>=MAX_ACTIVE||records.size()>=MAX_RECORDS||records.values().stream().filter(m->m.optBoolean("out")&&!terminal(m)).count()>=MAX_OUT)throw new IOException("Mesh voice queue full");
  String id=UUID.randomUUID().toString();JSONObject m=new JSONObject().put("v",1).put("op","meta").put("transfer",id).put("message",id).put("source",node).put("destination","*").put("format","pcm-s16le-16000-mono").put("bytes",pcm.length).put("count",(pcm.length+CHUNK-1)/CHUNK).put("sha256",VoiceTransfer.hash(pcm)).put("created",now).put("expires",now+TTL).put("language",language).put("transcript",transcript);
  validate(m,node,now,true);write(file(id,".pcm"),pcm);m.put("audioUri",localUri).put("out",true).put("state","queued").put("cursor",-1).put("round",0);persist(m);records.put(id,m);status(m,"queued");return id;
 }
 private boolean terminal(JSONObject m){return Arrays.asList("delivered","expired","failed","cancelled","received").contains(m.optString("state"));}
 private JSONObject metadata(JSONObject m)throws Exception{JSONObject clean=new JSONObject();for(String key:new String[]{"v","op","transfer","message","source","destination","format","bytes","count","sha256","created","expires","language","transcript"})clean.put(key,m.get(key));return clean;}
 synchronized void pump(long now)throws Exception {
  cleanup(now);
  for(JSONObject m:new ArrayList<>(records.values())){
   if(m.optBoolean("cancelPending")){if(transport.queue("*",new JSONObject().put("op","cancel").put("transfer",m.getString("transfer")).toString(),3)){m.put("cancelPending",false);persist(m);}return;}
   if(!m.optBoolean("out")){if(relayStep(m,now))return;continue;}if(terminal(m))continue;
   int cursor=m.optInt("cursor",-1),round=m.optInt("round");if(now<m.optLong("next"))continue;
   if(round>=3){status(m,"failed");persist(m);removePieces(m);continue;}
   JSONObject body;
   if(cursor<0)body=metadata(m);
   else {File pcm=file(m.getString("transfer"),".pcm");if(pcm.length()!=m.getInt("bytes")){status(m,"failed");persist(m);continue;}
    byte[] part=new byte[Math.min(CHUNK,m.getInt("bytes")-cursor*CHUNK)];try(RandomAccessFile in=new RandomAccessFile(pcm,"r")){in.seek((long)cursor*CHUNK);in.readFully(part);}
    body=new JSONObject().put("op","chunk").put("transfer",m.getString("transfer")).put("seq",cursor).put("data",Base64.encodeToString(part,Base64.NO_WRAP));
   }
   if(!transport.queue("*",body.toString(),0))return;
   cursor++;if(cursor>=m.getInt("count")){cursor=-1;m.put("round",round+1).put("next",now+30000);}
   m.put("cursor",cursor);status(m,m.getString("state"));persist(m);return; // one packet per tick, text/SOS get the remaining capacity
  }
 }
 synchronized boolean acceptEnvelope(MeshPacket p,String ingress,long now)throws Exception {
  JSONObject body=new JSONObject(p.body());boolean accepted=accept(p.sender(),body,now);if(!accepted)return false;
  JSONObject m=records.get(body.optString("transfer"));String op=body.optString("op");
  if(m!=null&&!m.optBoolean("out")&&(m.optString("state").equals("receiving")||m.optString("state").equals("received"))&&(op.equals("meta")||op.equals("chunk"))){
   String suffix=op.equals("meta")?".meta.wire":"."+body.getInt("seq")+".wire";File dest=file(m.getString("transfer"),suffix);
   if(!dest.exists())write(dest,p.wire().getBytes("UTF-8"));m.put("ingress",ingress);persist(m);
  }return true;
 }
 private boolean relayStep(JSONObject m,long now)throws Exception{
  if(!m.optString("state").equals("receiving")&&!m.optString("state").equals("received"))return false;
  int cursor=m.optInt("relayCursor",-1),round=m.optInt("relayRound");if(round>=3||now<m.optLong("relayNext"))return false;
  File wire=file(m.getString("transfer"),cursor<0?".meta.wire":"."+cursor+".wire");if(!wire.exists())return false;
  MeshPacket packet=MeshPacket.parse(ModelStore.read(wire));if(packet.json.getInt("hops")>=packet.json.getInt("ttl"))return false;
  if(!transport.relay(packet.forwarded(node).wire(),m.optString("ingress")))return false;
  cursor++;if(cursor>=m.getInt("count")){cursor=-1;m.put("relayRound",round+1).put("relayNext",now+30000);}m.put("relayCursor",cursor);persist(m);return true;
 }
 synchronized boolean accept(String sender,JSONObject body,long now)throws Exception{
  cleanup(now);String id=body.getString("transfer");UUID.fromString(id);String op=body.getString("op");JSONObject m=records.get(id);
  if(op.equals("receipt")){
   if(m!=null&&m.optBoolean("out")&&body.optString("sha256").equals(m.getString("sha256"))&&!sender.equals(node)&&!m.optString("state").equals("cancelled")&&!m.optString("state").equals("expired")){
    m.put("recipient",sender);status(m,"delivered");persist(m);removePieces(m);
   }return true;
  }
  if(sender.equals(node))return true;
  if(m!=null&&!m.getString("source").equals(sender))throw new SecurityException("Voice origin mismatch");
  if(op.equals("meta")){
   validate(body,sender,now,true);if(sender.equals(node))return true;
   if(m==null){if(active()>=MAX_ACTIVE||records.size()>=MAX_RECORDS)return false;m=metadata(body);m.put("state","receiving");persist(m);records.put(id,m);}
   else if(!metadata(m).toString().equals(metadata(body).toString()))throw new IOException("Conflicting voice metadata");
   if(m.optString("state").equals("received"))receipt(m);return true;
  }
  if(m==null)return false; // no allocation for chunks/cancellation without a validated manifest
  if(op.equals("cancel")){status(m,"cancelled");persist(m);removePieces(m);return true;}
  if(!op.equals("chunk"))throw new IOException("Invalid voice operation");
  if(terminal(m)){if(m.optString("state").equals("received"))receipt(m);return true;}
  int seq=body.getInt("seq");String encoded=body.getString("data");
  if(seq<0||seq>=m.getInt("count")||encoded.length()>684)throw new IOException("Voice chunk bounds");
  byte[] part=Base64.decode(encoded,Base64.NO_WRAP);int expected=Math.min(CHUNK,m.getInt("bytes")-seq*CHUNK);
  if(part.length!=expected)throw new IOException("Voice chunk length");
  File piece=file(id,"."+seq+".part");if(piece.exists()){if(!Arrays.equals(read(piece,expected),part))throw new IOException("Conflicting duplicate chunk");}else write(piece,part);
  for(int i=0;i<m.getInt("count");i++)if(!file(id,"."+i+".part").exists())return true;
  ByteArrayOutputStream all=new ByteArrayOutputStream(m.getInt("bytes"));for(int i=0;i<m.getInt("count");i++)all.write(read(file(id,"."+i+".part"),Math.min(CHUNK,m.getInt("bytes")-i*CHUNK)));
  byte[] pcm=all.toByteArray();if(!VoiceTransfer.hash(pcm).equals(m.getString("sha256"))){status(m,"failed");persist(m);removePieces(m);throw new IOException("Voice integrity mismatch");}
  m.put("audioUri",sink.save(pcm)).put("state","received");persist(m);removePieces(m);completed(m);receipt(m);return true;
 }
 private byte[] read(File f,int length)throws Exception{if(f.length()!=length)throw new IOException("Incomplete voice piece");byte[] b=new byte[length];try(DataInputStream in=new DataInputStream(new FileInputStream(f))){in.readFully(b);}return b;}
 private void receipt(JSONObject m)throws Exception{long now=System.currentTimeMillis();if(now-m.optLong("receiptAt")<10000)return;if(transport.queue(m.getString("source"),new JSONObject().put("op","receipt").put("transfer",m.getString("transfer")).put("sha256",m.getString("sha256")).toString(),3)){m.put("receiptAt",now);persist(m);}}
 synchronized void started(String body)throws Exception{JSONObject b=new JSONObject(body),m=records.get(b.optString("transfer"));if(m!=null&&m.optBoolean("out")&&m.optString("state").equals("queued")){status(m,"transferring");persist(m);}}
 synchronized void custody(String body)throws Exception{JSONObject b=new JSONObject(body),m=records.get(b.optString("transfer"));if(m!=null&&m.optBoolean("out")&&!terminal(m)&&!m.optString("state").equals("custody")){status(m,"custody");persist(m);}}
 synchronized void cancel(String id)throws Exception{JSONObject m=records.get(id);if(m==null||!m.optBoolean("out"))throw new IOException("Unknown outgoing note");status(m,"cancelled");m.put("cancelPending",true);persist(m);removePieces(m);}
 private void status(JSONObject m,String state)throws Exception{m.put("state",state);sink.event("meshVoiceStatus",new JSONObject().put("id",m.getString("transfer")).put("status",state).put("recipient",m.optString("recipient")).put("queuedPieces",Math.max(0,m.optInt("cursor"))).put("total",m.getInt("count")).put("bytes",m.getInt("bytes")));}
 private void completed(JSONObject m)throws Exception{sink.event("meshVoice",new JSONObject().put("id",m.getString("message")).put("audioUri",m.getString("audioUri")).put("language",m.getString("language")).put("transcript",m.optString("transcript")).put("created",m.getLong("created")).put("durationMs",m.getInt("bytes")/32).put("sender",m.getString("source")));}
 static void clearDirectory(File root)throws IOException{File[] files=root.listFiles();if(files!=null)for(File file:files)if(!file.delete())throw new IOException("Voice cleanup failed");}
 synchronized void replay()throws Exception{for(JSONObject m:records.values())if(m.optString("state").equals("received"))completed(m);else if(m.optBoolean("out")){sink.event("meshVoiceOutgoing",new JSONObject().put("id",m.getString("transfer")).put("audioUri",m.optString("audioUri")).put("language",m.getString("language")).put("transcript",m.optString("transcript")).put("created",m.getLong("created")).put("status",m.getString("state")).put("recipient",m.optString("recipient")));status(m,m.getString("state"));}}
 synchronized void cleanup(long now)throws Exception{for(JSONObject m:new ArrayList<>(records.values()))if(m.getLong("expires")<=now){if(!terminal(m))status(m,"expired");m.put("state","expired");removePieces(m);file(m.getString("transfer"),".json").delete();records.remove(m.getString("transfer"));}}
 private void removePieces(JSONObject m)throws Exception{String id=m.getString("transfer");File[] fs=root.listFiles();if(fs!=null)for(File f:fs)if(f.getName().startsWith(id+".")&&!f.getName().endsWith(".json")&&!(m.optString("state").equals("received")&&f.getName().endsWith(".wire")))if(!f.delete())throw new IOException("Voice cleanup failed");}
}
