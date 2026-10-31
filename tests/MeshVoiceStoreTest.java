package com.talk2;
import org.json.JSONObject;
import java.nio.file.Files;
import java.io.File;
import java.util.*;

public final class MeshVoiceStoreTest {
 static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
 interface Work {void run()throws Exception;}
 static void rejects(Work w)throws Exception{try{w.run();throw new AssertionError("Expected rejection");}catch(java.io.IOException|SecurityException|IllegalArgumentException expected){}}
 static final class Target implements MeshVoiceStore.Sink {
  byte[] audio;int completed;String state="";JSONObject restored;
  public String save(byte[] pcm){audio=pcm;return "file:///test.pcm";}
  public void event(String type,JSONObject data){if(type.equals("meshVoice"))completed++;else if(type.equals("meshVoiceOutgoing"))restored=data;else state=data.optString("status");}
 }
 public static void main(String[] args)throws Exception{
  long now=System.currentTimeMillis();String a=UUID.randomUUID().toString(),b=UUID.randomUUID().toString();
  List<JSONObject> packets=new ArrayList<>(),receipts=new ArrayList<>();Target out=new Target(),in=new Target();
  MeshVoiceStore source=new MeshVoiceStore(Files.createTempDirectory("mesh-voice-a").toFile(),a,(d,body,p)->{packets.add(new JSONObject(body));return true;},out);
  File root=Files.createTempDirectory("mesh-voice-b").toFile();MeshVoiceStore receiver=new MeshVoiceStore(root,b,(d,body,p)->{receipts.add(new JSONObject(body));return true;},in);
  byte[] pcm=new byte[6400];new Random(3).nextBytes(pcm);String id=source.enqueue(pcm,"mr","source transcript",now);
  for(int i=0;i<14;i++)source.pump(now+i*1000);
  check(packets.size()==14,"manifest and thirteen chunks");JSONObject meta=packets.get(0);MeshVoiceStore.validate(meta,a,now,true);
  check(!receiver.accept(a,packets.get(1),now),"chunk before metadata does not allocate");
  receiver.accept(a,meta,now);receiver.accept(a,packets.get(2),now);receiver.accept(a,packets.get(2),now);
  check(in.completed==0,"missing pieces never deliver");
  receiver=new MeshVoiceStore(root,b,(d,body,p)->{receipts.add(new JSONObject(body));return true;},in);
  for(int i=13;i>=1;i--)receiver.accept(a,packets.get(i),now);
  check(in.completed==1&&Arrays.equals(pcm,in.audio),"restart/out of order/hash verified playback bytes");
  source.accept(b,receipts.get(0),now);check(out.state.equals("delivered"),"recipient receipt after durable completion");
  receiver.accept(a,packets.get(3),now);check(in.completed==1,"duplicate completion suppressed");
  MeshVoiceStore finalReceiver=receiver;
  rejects(()->MeshVoiceStore.validate(new JSONObject(meta.toString()).put("bytes",Integer.MAX_VALUE),a,now,true));
  rejects(()->MeshVoiceStore.validate(new JSONObject(meta.toString()).put("count",9999),a,now,true));
  rejects(()->MeshVoiceStore.validate(new JSONObject(meta.toString()).put("transfer","../escape"),a,now,true));
  rejects(()->MeshVoiceStore.validate(meta,a,now+MeshVoiceStore.TTL+1,true));
  rejects(()->finalReceiver.accept(UUID.randomUUID().toString(),new JSONObject().put("transfer",id).put("op","cancel"),now));
  Target badSink=new Target();MeshVoiceStore bad=new MeshVoiceStore(Files.createTempDirectory("mesh-voice-bad").toFile(),b,(d,body,p)->true,badSink);
  bad.accept(a,meta,now);JSONObject invalid=new JSONObject(packets.get(1).toString()).put("seq",188);rejects(()->bad.accept(a,invalid,now));
  for(int i=1;i<13;i++)bad.accept(a,packets.get(i),now);
  JSONObject corrupt=new JSONObject(packets.get(13).toString());byte[] data=android.util.Base64.decode(corrupt.getString("data"),2);data[0]^=1;corrupt.put("data",android.util.Base64.encodeToString(data,2));rejects(()->bad.accept(a,corrupt,now));check(badSink.audio==null,"hash mismatch never saves");
  File expRoot=Files.createTempDirectory("mesh-voice-expiry").toFile();MeshVoiceStore exp=new MeshVoiceStore(expRoot,b,(d,body,p)->true,new Target());exp.accept(a,meta,now);exp.accept(a,packets.get(1),now);exp.cleanup(now+MeshVoiceStore.TTL+1);check(expRoot.listFiles().length==0,"expiry removes incomplete data");
  List<JSONObject> cancelled=new ArrayList<>();MeshVoiceStore c=new MeshVoiceStore(Files.createTempDirectory("mesh-voice-cancel").toFile(),a,(d,body,p)->{cancelled.add(new JSONObject(body));return true;},new Target());String cid=c.enqueue(pcm,"en","",now);c.cancel(cid);c.pump(now);check(cancelled.size()==1&&cancelled.get(0).getString("op").equals("cancel"),"cancel stops bulk and emits origin cancellation");
  MeshSendQueue q=new MeshSendQueue();q.offer("voice",0,Arrays.asList(new byte[]{1},new byte[]{2}));check(q.peek()[0]==1,"voice begins");q.offer("voice2",0,Arrays.asList(new byte[]{3}));q.offer("sos",3,Arrays.asList(new byte[]{9}));q.sent();check(q.peek()[0]==2,"finish active packet without fragment corruption");q.sent();check(q.peek()[0]==9,"SOS before next bulk packet");
  for(int i=0;i<4;i++)q.offer("bulk"+i,0,Arrays.asList(new byte[]{0}));check(q.offer("urgent",3,Arrays.asList(new byte[]{8})),"urgent admitted under bulk pressure");
  java.security.KeyPairGenerator gen=java.security.KeyPairGenerator.getInstance("EC");gen.initialize(256);java.security.KeyPair key=gen.generateKeyPair();String origin=UUID.nameUUIDFromBytes(key.getPublic().getEncoded()).toString();
  List<String> originWire=new ArrayList<>(),relayWire=new ArrayList<>();
  MeshVoiceStore originStore=new MeshVoiceStore(Files.createTempDirectory("mesh-origin").toFile(),origin,(d,body,p)->{originWire.add(MeshPacket.create("voice",origin,d,body,p,key).wire());return true;},new Target());
  Target relaySink=new Target(),farSink=new Target();
  MeshVoiceStore relay=new MeshVoiceStore(Files.createTempDirectory("mesh-relay").toFile(),b,new MeshVoiceStore.Transport(){public boolean queue(String d,String body,int p){return true;}public boolean relay(String wire,String ingress){check(ingress.equals("A-link"),"exclude ingress");relayWire.add(wire);return true;}},relaySink);
  MeshVoiceStore far=new MeshVoiceStore(Files.createTempDirectory("mesh-far").toFile(),UUID.randomUUID().toString(),(d,body,p)->true,farSink);
  originStore.enqueue(pcm,"mr","hello",now);for(int i=0;i<14;i++)originStore.pump(now+i*1000);
  for(String wire:originWire)relay.acceptEnvelope(MeshPacket.parse(wire),"A-link",now);
  check(relaySink.completed==1,"relay is also public recipient");
  for(int i=0;i<14;i++)relay.pump(now+i*1000);
  check(relayWire.size()==14,"durable relay spool survives receipt at intermediate node");
  for(String wire:relayWire){MeshPacket p=MeshPacket.parse(wire);check(p.sender().equals(origin)&&p.json.getInt("hops")==1,"origin signature preserved through relay");far.acceptEnvelope(p,"B-link",now);}
  check(farSink.completed==1&&Arrays.equals(pcm,farSink.audio),"simulated A-B-C reassembles exactly, no A-C delivery");
  Target retrySink=new Target();List<String> attempts=new ArrayList<>();
  MeshVoiceStore retryStore=new MeshVoiceStore(Files.createTempDirectory("mesh-retries").toFile(),a,(d,body,p)->{attempts.add(body);return true;},retrySink);
  retryStore.enqueue(pcm,"en","",now);for(int i=0;i<45;i++)retryStore.pump(now+i*31000L);
  check(attempts.size()==42&&retrySink.state.equals("failed"),"three bounded rounds then failed without receipt");
  File capacityRoot=Files.createTempDirectory("mesh-capacity").toFile();Target capacitySink=new Target();
  MeshVoiceStore limited=new MeshVoiceStore(capacityRoot,a,(d,body,p)->false,capacitySink);
  String limitId=limited.enqueue(new byte[MeshVoiceStore.MAX_BYTES],"en","",now);limited.pump(now);check(capacitySink.state.equals("queued"),"backpressure stays queued, not transferring");
  limited.enqueue(pcm,"en","",now);rejects(()->limited.enqueue(pcm,"en","",now));
  rejects(()->MeshVoiceStore.validate(new JSONObject(meta.toString()).put("bytes",96002),a,now,true));
  try(java.io.RandomAccessFile fill=new java.io.RandomAccessFile(new File(capacityRoot,"filler"),"rw")){fill.setLength(MeshVoiceStore.MAX_DISK);}
  rejects(()->limited.cancel(limitId)); // bounded disk writes fail before increasing usage
  rejects(()->limited.cancel("not-an-id")); // unknown transfer does not touch paths
  MeshVoiceStore.clearDirectory(capacityRoot);check(capacityRoot.listFiles().length==0,"explicit history cleanup removes spool");
  File restoreRoot=Files.createTempDirectory("mesh-outgoing-restart").toFile();Target restoreSink=new Target();List<String> publicBodies=new ArrayList<>();
  MeshVoiceStore restartSource=new MeshVoiceStore(restoreRoot,a,(d,body,p)->{publicBodies.add(body);return true;},restoreSink);
  restartSource.enqueue(pcm,"en","source",now,"file:///private-original.pcm");restartSource.pump(now);
  check(!publicBodies.get(0).contains("private-original"),"local file URI never travels in metadata");
  restartSource=new MeshVoiceStore(restoreRoot,a,(d,body,p)->true,restoreSink);restartSource.replay();
  check(restoreSink.restored!=null&&restoreSink.restored.getString("audioUri").equals("file:///private-original.pcm"),"restart restores outgoing history from durable metadata");
  System.out.println("MeshVoiceStoreTest PASS: bounds, reassembly, restart, duplicate, missing, hash, expiry, cancellation, receipts, SOS priority, signed A-B-C protocol simulation");
 }
}
