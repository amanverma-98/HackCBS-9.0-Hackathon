package com.talk2;

import android.content.Context;
import android.util.AtomicFile;
import android.security.keystore.*;
import org.json.*;
import java.io.*;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;
import java.util.concurrent.*;

/** Bounded, isolated store-and-forward router. It does not use Talk2's large UI state JSON. */
final class MeshRouter {
 interface Events { void event(String type,JSONObject data); }
 interface Sender { void send(String neighbor,String packet)throws Exception; }
 static final int MAX_NEIGHBORS=3,MAX_QUEUE=16,MAX_SEEN=256;
 private final Events events;private final Sender sender;private final LinkedHashMap<String,Long> seen=new LinkedHashMap<>();private final LinkedHashMap<String,String> queue=new LinkedHashMap<>(),awaitingReceipt=new LinkedHashMap<>(),inbox=new LinkedHashMap<>();private final LinkedHashMap<String,Long> sentAt=new LinkedHashMap<>();private final LinkedHashSet<String> neighbors=new LinkedHashSet<>();private final KeyPair identity;private final String nodeId;private final AtomicFile store;private final ScheduledExecutorService retry=Executors.newSingleThreadScheduledExecutor();
 MeshRouter(Context c,Events e,Sender s)throws Exception{events=e;sender=s;store=new AtomicFile(new File(c.getFilesDir(),"mesh-outbox.json"));identity=loadIdentity();nodeId=UUID.nameUUIDFromBytes(identity.getPublic().getEncoded()).toString();load();retry.scheduleAtFixedRate(this::retryPending,5,5,TimeUnit.SECONDS);}
 synchronized String nodeId(){return nodeId;}
 private static KeyPair loadIdentity()throws Exception{String alias="talk2.mesh.identity.v1";KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias(alias)){KeyPairGenerator g=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");g.initialize(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());g.generateKeyPair();}return new KeyPair(ks.getCertificate(alias).getPublicKey(),(PrivateKey)ks.getKey(alias,null));}
 synchronized void neighbor(String id,boolean connected){if(connected){if(neighbors.contains(id)||neighbors.size()<MAX_NEIGHBORS){neighbors.add(id);drain(id);}}else neighbors.remove(id);events.event("meshNeighbor",obj("id",id,"connected",connected));}
 synchronized void send(String type,String destination,String body)throws Exception{MeshPacket p=MeshPacket.create(type,nodeId,destination,body,type.equals("sos")?3:1,identity);if(queue.size()>=MAX_QUEUE)throw new IOException("Mesh queue full; send later");queue.put(p.id(),p.wire());if(type.equals("text")&&!destination.equals("*"))awaitingReceipt.put(p.id(),p.wire());persist();events.event("meshStatus",obj("id",p.id(),"status","queued"));for(String n:neighbors)drain(n);}
 synchronized void receive(String neighbor,String wire)throws Exception{
  MeshPacket p=MeshPacket.parse(wire);boolean addressed=p.destination().equals(nodeId)||p.destination().equals("*");
  if(p.type().equals("custody")){String held=p.body();queue.remove(held);forget(held);persist();events.event("meshStatus",obj("id",held,"status","custody","neighbor",neighbor));if(!addressed)forward(p);return;}
  if(p.type().equals("ack")){if(addressed){awaitingReceipt.remove(p.body());forget("origin:"+p.body());persist();events.event("meshReceipt",new JSONObject(p.json.toString()).put("status","destination receipt"));}else forward(p);return;}
  boolean duplicate=seen.containsKey(p.id());if(!duplicate){boolean mustForward=!addressed||p.destination().equals("*");if((addressed&&inbox.size()>=MAX_QUEUE)||(mustForward&&queue.size()>=MAX_QUEUE))return;if(seen.size()>=MAX_SEEN)seen.remove(seen.keySet().iterator().next());seen.put(p.id(),System.currentTimeMillis());if(addressed)inbox.put(p.id(),p.wire());if(mustForward){MeshPacket f=p.forwarded(nodeId);queue.put(f.id(),f.wire());}persist();}
  // Receipt means this phone has durably accepted the packet for local handling/relay.
  MeshPacket custody=MeshPacket.create("custody",nodeId,p.lastHop(),p.id(),3,identity);if(queue.size()<MAX_QUEUE)queue.put(custody.id(),custody.wire());persist();
  if(addressed){events.event(p.type().equals("sos")?"meshSOS":"meshMessage",new JSONObject(p.json.toString()).put("status","received at destination"));}
  if(duplicate)events.event("meshStatus",obj("id",p.id(),"status","duplicate-suppressed"));
  for(String n:neighbors)if(!n.equals(neighbor))drain(n);
 }
 private void forward(MeshPacket p)throws Exception{if(p.json.optInt("hops")>=p.json.optInt("ttl"))return;MeshPacket f=p.forwarded(nodeId);if(queue.size()<MAX_QUEUE)queue.put(f.id(),f.wire());persist();for(String n:neighbors)drain(n);}
 synchronized void acknowledgeInbox(String id)throws Exception{String wire=inbox.remove(id);if(wire==null)return;MeshPacket p=MeshPacket.parse(wire);persist();if(p.type().equals("text")&&!p.destination().equals("*")){MeshPacket ack=MeshPacket.create("ack",nodeId,p.sender(),p.id(),3,identity);if(queue.size()<MAX_QUEUE){queue.put(ack.id(),ack.wire());persist();for(String n:neighbors)drain(n);}}}
 synchronized void replayInbox(){for(String wire:new ArrayList<>(inbox.values()))try{MeshPacket p=MeshPacket.parse(wire);events.event(p.type().equals("sos")?"meshSOS":"meshMessage",new JSONObject(p.json.toString()).put("status","received at destination"));}catch(Exception ignored){}}
 private void forget(String id){sentAt.keySet().removeIf(key->key.startsWith(id+"@")||key.startsWith("origin:"+id+"@"));}
 private synchronized void retryPending(){try{for(String n:new ArrayList<>(neighbors))drain(n);}catch(Exception ignored){}}
 private void drain(String neighbor){long now=System.currentTimeMillis();boolean changed=false;List<Map.Entry<String,String>> pending=new ArrayList<>(queue.entrySet());pending.sort((a,b)->Integer.compare(priority(b.getValue()),priority(a.getValue())));for(Map.Entry<String,String> x:pending){String key=x.getKey()+"@"+neighbor;if(now-sentAt.getOrDefault(key,0L)<15000)continue;try{sender.send(neighbor,x.getValue());sentAt.put(key,now);MeshPacket p=MeshPacket.parse(x.getValue());if(p.type().equals("ack")||p.type().equals("custody")){queue.remove(x.getKey());forget(x.getKey());changed=true;}events.event("meshStatus",obj("id",x.getKey(),"status","sent-to-neighbor","neighbor",neighbor));}catch(Exception ignored){}}for(Map.Entry<String,String> x:awaitingReceipt.entrySet()){if(queue.containsKey(x.getKey()))continue;String key="origin:"+x.getKey()+"@"+neighbor;if(now-sentAt.getOrDefault(key,0L)<30000)continue;try{sender.send(neighbor,x.getValue());sentAt.put(key,now);}catch(Exception ignored){}}if(changed)try{persist();}catch(Exception ignored){}}
 private int priority(String wire){try{return MeshPacket.parse(wire).priority();}catch(Exception e){return 0;}}
 synchronized void close(){retry.shutdownNow();neighbors.clear();}
 private void load()throws Exception{if(!store.getBaseFile().exists())return;try(FileInputStream in=store.openRead();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n,total=0;while((n=in.read(b))>0){total+=n;if(total>512*1024)throw new IOException("Mesh store exceeds bound");bytes.write(b,0,n);}JSONObject o=new JSONObject(new String(bytes.toByteArray(),"UTF-8"));loadArray(o.optJSONArray("queue"),queue);loadArray(o.optJSONArray("awaiting"),awaitingReceipt);loadArray(o.optJSONArray("inbox"),inbox);JSONArray ids=o.optJSONArray("seen");if(ids!=null)for(int i=Math.max(0,ids.length()-MAX_SEEN);i<ids.length();i++)seen.put(ids.getString(i),System.currentTimeMillis());}}
 private void loadArray(JSONArray a,LinkedHashMap<String,String> into)throws Exception{if(a==null)return;for(int i=0;i<a.length()&&into.size()<MAX_QUEUE;i++){String wire=a.getString(i);try{MeshPacket p=MeshPacket.parse(wire);into.put(p.id(),wire);}catch(Exception expiredOrInvalid){/* stale/corrupt bounded queue entries are discarded */}}}
 private synchronized void persist()throws IOException{FileOutputStream out=null;try{out=store.startWrite();JSONArray q=new JSONArray(),a=new JSONArray(),i=new JSONArray(),s=new JSONArray();for(String v:queue.values())q.put(v);for(String v:awaitingReceipt.values())a.put(v);for(String v:inbox.values())i.put(v);for(String id:seen.keySet())s.put(id);byte[] b=new JSONObject().put("queue",q).put("awaiting",a).put("inbox",i).put("seen",s).toString().getBytes("UTF-8");if(b.length>512*1024)throw new IOException("Mesh store bound exceeded");out.write(b);store.finishWrite(out);}catch(Exception e){if(out!=null)store.failWrite(out);if(e instanceof IOException)throw(IOException)e;throw new IOException(e);}}
 private static JSONObject obj(String k,Object v,String k2,Object v2){try{return new JSONObject().put(k,v).put(k2,v2);}catch(Exception e){return new JSONObject();}}
 private static JSONObject obj(String k,Object v,String k2,Object v2,String k3,Object v3){try{return new JSONObject().put(k,v).put(k2,v2).put(k3,v3);}catch(Exception e){return new JSONObject();}}
}
