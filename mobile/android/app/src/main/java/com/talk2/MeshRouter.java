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
 interface Extension { boolean accept(MeshPacket p,String ingress)throws Exception; void tick()throws Exception; void custody(String body)throws Exception; default void started(String body)throws Exception{} }
 Extension extension;
 private final Map<String,String> ingress=new HashMap<>();
 interface Sender { void send(String neighbor,String packet)throws Exception; }
 static final int MAX_NEIGHBORS=3,MAX_QUEUE=16,MAX_SEEN=256;
 private final Events events;private final Sender sender;private final LinkedHashMap<String,Long> seen=new LinkedHashMap<>();private final LinkedHashMap<String,String> queue=new LinkedHashMap<>(),awaitingReceipt=new LinkedHashMap<>(),inbox=new LinkedHashMap<>();private final LinkedHashMap<String,Long> sentAt=new LinkedHashMap<>();private final LinkedHashSet<String> neighbors=new LinkedHashSet<>();private final KeyPair identity;private final String nodeId;private final AtomicFile store;private final ScheduledExecutorService retry=Executors.newSingleThreadScheduledExecutor();
 MeshRouter(Context c,Events e,Sender s)throws Exception{this(new File(c.getFilesDir(),"mesh-outbox.json"),loadIdentity(),e,s,true);}
 MeshRouter(File file,KeyPair key,Events e,Sender s,boolean schedule)throws Exception{events=e;sender=s;store=new AtomicFile(file);identity=key;nodeId=UUID.nameUUIDFromBytes(identity.getPublic().getEncoded()).toString();load();if(schedule)retry.scheduleAtFixedRate(this::retryPending,1,1,TimeUnit.SECONDS);}
 synchronized String nodeId(){return nodeId;}
 private static KeyPair loadIdentity()throws Exception{String alias="talk2.mesh.identity.v1";KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias(alias)){KeyPairGenerator g=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore");g.initialize(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_SIGN|KeyProperties.PURPOSE_VERIFY).setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build());g.generateKeyPair();}return new KeyPair(ks.getCertificate(alias).getPublicKey(),(PrivateKey)ks.getKey(alias,null));}
 synchronized void neighbor(String id,boolean connected){if(connected){if(neighbors.contains(id)||neighbors.size()<MAX_NEIGHBORS){neighbors.add(id);drain(id);}}else neighbors.remove(id);events.event("meshNeighbor",obj("id",id,"connected",connected));}
 synchronized void send(String type,String destination,String body)throws Exception{expire();if(awaitingReceipt.size()>=MAX_QUEUE&&!destination.equals("*"))throw new IOException("Pending receipt queue full");MeshPacket p=MeshPacket.create(type,nodeId,destination,body,type.equals("sos")?3:1,identity);if(type.equals("sos")&&queue.size()>=MAX_QUEUE)evictVoice();if(queue.size()>=MAX_QUEUE)throw new IOException("Mesh queue full; send later");queue.put(p.id(),p.wire());if(type.equals("text")&&!destination.equals("*"))awaitingReceipt.put(p.id(),p.wire());persist();events.event("meshStatus",obj("id",p.id(),"status","queued"));for(String n:neighbors)drain(n);}
 synchronized boolean sendExtension(String type,String destination,String body,int priority)throws Exception {
  long bulk=0;for(String wire:queue.values())try{MeshPacket p=MeshPacket.parse(wire);if(p.type().equals("voice")&&p.priority()==0)bulk++;}catch(Exception ignored){}
  if(priority==0&&(queue.size()>=MAX_QUEUE-4||bulk>=4))return false;
  if(priority>=3&&queue.size()>=MAX_QUEUE)evictVoice();if(queue.size()>=MAX_QUEUE)return false;
  MeshPacket p=MeshPacket.create(type,nodeId,destination,body,priority,identity);queue.put(p.id(),p.wire());persist();for(String n:neighbors)drain(n);return true;
 }
 synchronized boolean relayVoice(String wire,String from)throws Exception {
  MeshPacket p=MeshPacket.parse(wire);if(queue.containsKey(p.id()))return true;if(queue.size()>=MAX_QUEUE-4)return false;
  long bulk=0;for(String w:queue.values())try{if(MeshPacket.parse(w).type().equals("voice"))bulk++;}catch(Exception ignored){}if(bulk>=4)return false;
  queue.put(p.id(),wire);ingress.put(p.id(),from);persist();for(String n:neighbors)drain(n);return true;
 }
 private void evictVoice(){for(Map.Entry<String,String> x:new ArrayList<>(queue.entrySet()))try{MeshPacket p=MeshPacket.parse(x.getValue());if(p.type().equals("voice")&&p.priority()==0){queue.remove(x.getKey());forget(x.getKey());return;}}catch(Exception ignored){}}
 synchronized void receive(String neighbor,String wire)throws Exception {
  MeshPacket p=MeshPacket.parse(wire);boolean addressed=p.destination().equals(nodeId)||p.destination().equals("*");
  if(p.type().equals("custody")){
   String held=p.body();if(!p.destination().equals(nodeId)||!sentAt.containsKey(held+"@"+neighbor))return;
   String removed=queue.remove(held);forget(held);persist();if(removed!=null&&extension!=null){MeshPacket original=MeshPacket.parse(removed);if(original.type().equals("voice"))extension.custody(original.body());}
   events.event("meshStatus",obj("id",held,"status","custody","neighbor",neighbor));return;
  }
  if(p.type().equals("ack")){
   if(p.destination().equals(nodeId)){String original=awaitingReceipt.get(p.body());if(original==null||!MeshPacket.parse(original).destination().equals(p.sender()))return;awaitingReceipt.remove(p.body());queue.remove(p.body());forget(p.body());persist();events.event("meshReceipt",new JSONObject(p.json.toString()).put("status","destination receipt"));}
   else if(!seen.containsKey(p.id())){remember(p.id());forward(p,neighbor);}return;
  }
  boolean extended=p.type().equals("voice")||p.type().equals("position");
  boolean spooledVoice=addressed&&p.type().equals("voice")&&Arrays.asList("meta","chunk").contains(new JSONObject(p.body()).optString("op"));
  boolean duplicate=seen.containsKey(p.id());boolean mustForward=!spooledVoice&&(!addressed||p.destination().equals("*"))&&p.json.getInt("hops")<p.json.getInt("ttl");
  if(!duplicate&&mustForward&&queue.size()>=MAX_QUEUE){if(p.type().equals("sos"))evictVoice();if(queue.size()>=MAX_QUEUE)return;}
  if(addressed&&extended&&(extension==null||!extension.accept(p,neighbor)))return;
  if(!duplicate){if(addressed&&!extended&&inbox.size()>=MAX_QUEUE)return;
   if(addressed&&!extended)inbox.put(p.id(),p.wire());if(mustForward){MeshPacket f=p.forwarded(nodeId);queue.put(f.id(),f.wire());ingress.put(f.id(),neighbor);}remember(p.id());persist();}
  if(duplicate&&addressed&&!extended&&!inbox.containsKey(p.id())){if(inbox.size()>=MAX_QUEUE)return;inbox.put(p.id(),p.wire());persist();}
  MeshPacket custody=MeshPacket.create("custody",nodeId,p.lastHop(),p.id(),3,identity);
  try{sender.send(neighbor,custody.wire());}catch(Exception unavailable){/* sender retries until custody/expiry */}
  if(addressed&&!extended)events.event(p.type().equals("sos")?"meshSOS":"meshMessage",new JSONObject(p.json.toString()).put("status","received at destination"));
  for(String n:neighbors)if(!n.equals(neighbor))drain(n);
 }
 private void remember(String id){if(seen.size()>=MAX_SEEN)seen.remove(seen.keySet().iterator().next());seen.put(id,System.currentTimeMillis());}
 private void forward(MeshPacket p,String neighbor)throws Exception{if(p.json.optInt("hops")>=p.json.optInt("ttl"))return;MeshPacket f=p.forwarded(nodeId);if(queue.size()<MAX_QUEUE){queue.put(f.id(),f.wire());ingress.put(f.id(),neighbor);}persist();for(String n:neighbors)if(!n.equals(neighbor))drain(n);}
 synchronized void acknowledgeInbox(String id)throws Exception{String wire=inbox.remove(id);if(wire==null)return;MeshPacket p=MeshPacket.parse(wire);persist();if(p.type().equals("text")&&!p.destination().equals("*")){MeshPacket ack=MeshPacket.create("ack",nodeId,p.sender(),p.id(),3,identity);if(queue.size()<MAX_QUEUE){queue.put(ack.id(),ack.wire());persist();for(String n:neighbors)drain(n);}}}
 synchronized void replayInbox(){for(String wire:new ArrayList<>(inbox.values()))try{MeshPacket p=MeshPacket.parse(wire);events.event(p.type().equals("sos")?"meshSOS":"meshMessage",new JSONObject(p.json.toString()).put("status","received at destination"));}catch(Exception ignored){}}
 private void forget(String id){ingress.remove(id);sentAt.keySet().removeIf(key->key.startsWith(id+"@")||key.startsWith("origin:"+id+"@"));}
 private synchronized void retryPending(){try{expire();for(String n:new ArrayList<>(neighbors))drain(n);if(extension!=null)extension.tick();}catch(Exception e){events.event("meshError",obj("message",e.getMessage(),"operation","retry"));}}
 private void expire()throws Exception{boolean changed=false;for(Map<String,String> map:Arrays.asList(queue,awaitingReceipt,inbox))for(Map.Entry<String,String> x:new ArrayList<>(map.entrySet()))try{MeshPacket.parse(x.getValue());}catch(Exception expired){map.remove(x.getKey());forget(x.getKey());changed=true;events.event("meshStatus",obj("id",x.getKey(),"status","expired"));}if(changed)persist();}
 synchronized void cancelVoice(String id){for(Map.Entry<String,String> x:new ArrayList<>(queue.entrySet()))try{MeshPacket p=MeshPacket.parse(x.getValue());if(p.type().equals("voice")&&p.sender().equals(nodeId)&&new JSONObject(p.body()).optString("transfer").equals(id)){queue.remove(x.getKey());forget(x.getKey());}}catch(Exception ignored){}try{persist();}catch(Exception ignored){}}
 private void drain(String neighbor){long now=System.currentTimeMillis();boolean changed=false;List<Map.Entry<String,String>> pending=new ArrayList<>(queue.entrySet());pending.sort((a,b)->Integer.compare(priority(b.getValue()),priority(a.getValue())));for(Map.Entry<String,String> x:pending){if(neighbor.equals(ingress.get(x.getKey())))continue;String key=x.getKey()+"@"+neighbor;if(now-sentAt.getOrDefault(key,0L)<15000)continue;try{sender.send(neighbor,x.getValue());sentAt.put(key,now);MeshPacket p=MeshPacket.parse(x.getValue());if(extension!=null&&p.type().equals("voice"))extension.started(p.body());if(p.type().equals("ack")||p.type().equals("custody")){queue.remove(x.getKey());forget(x.getKey());changed=true;}events.event("meshStatus",obj("id",x.getKey(),"status","sent-to-neighbor","neighbor",neighbor));}catch(Exception ignored){}}for(Map.Entry<String,String> x:awaitingReceipt.entrySet()){if(queue.containsKey(x.getKey()))continue;String key="origin:"+x.getKey()+"@"+neighbor;if(now-sentAt.getOrDefault(key,0L)<30000)continue;try{sender.send(neighbor,x.getValue());sentAt.put(key,now);}catch(Exception ignored){}}if(changed)try{persist();}catch(Exception ignored){}}
 private int priority(String wire){try{return MeshPacket.parse(wire).priority();}catch(Exception e){return 0;}}
 synchronized void close(){retry.shutdownNow();neighbors.clear();}
 static void eraseVoice(File file)throws Exception{
  if(!file.exists()&&!new File(file.getPath()+".bak").exists())return;AtomicFile atomic=new AtomicFile(file);JSONObject root;
  try(InputStream in=atomic.openRead();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0){if(out.size()+n>512*1024)throw new IOException("Mesh store exceeds bound");out.write(b,0,n);}root=new JSONObject(out.toString("UTF-8"));}
  for(String key:new String[]{"queue","awaiting","inbox"}){JSONArray old=root.optJSONArray(key),keep=new JSONArray();if(old!=null)for(int i=0;i<old.length();i++)try{MeshPacket packet=MeshPacket.parse(old.getString(i));if(!packet.type().equals("voice"))keep.put(old.getString(i));}catch(Exception invalid){}root.put(key,keep);}
  JSONObject oldLinks=root.optJSONObject("ingress"),keptLinks=new JSONObject();JSONArray pending=root.getJSONArray("queue");if(oldLinks!=null)for(int i=0;i<pending.length();i++){String id=MeshPacket.parse(pending.getString(i)).id();if(oldLinks.has(id))keptLinks.put(id,oldLinks.get(id));}root.put("ingress",keptLinks);FileOutputStream out=null;try{out=atomic.startWrite();out.write(root.toString().getBytes("UTF-8"));atomic.finishWrite(out);}catch(Exception e){if(out!=null)atomic.failWrite(out);throw e;}
 }
 private void load()throws Exception{if(!store.getBaseFile().exists())return;try(FileInputStream in=store.openRead();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n,total=0;while((n=in.read(b))>0){total+=n;if(total>512*1024)throw new IOException("Mesh store exceeds bound");bytes.write(b,0,n);}JSONObject o=new JSONObject(new String(bytes.toByteArray(),"UTF-8"));loadArray(o.optJSONArray("queue"),queue);loadArray(o.optJSONArray("awaiting"),awaitingReceipt);loadArray(o.optJSONArray("inbox"),inbox);JSONObject links=o.optJSONObject("ingress");if(links!=null)for(String id:queue.keySet())if(links.has(id))ingress.put(id,links.getString(id));JSONArray ids=o.optJSONArray("seen");if(ids!=null)for(int i=Math.max(0,ids.length()-MAX_SEEN);i<ids.length();i++)seen.put(ids.getString(i),System.currentTimeMillis());}}
 private void loadArray(JSONArray a,LinkedHashMap<String,String> into)throws Exception{if(a==null)return;for(int i=0;i<a.length()&&into.size()<MAX_QUEUE;i++){String wire=a.getString(i);try{MeshPacket p=MeshPacket.parse(wire);into.put(p.id(),wire);}catch(Exception expiredOrInvalid){/* stale/corrupt bounded queue entries are discarded */}}}
 private synchronized void persist()throws IOException{FileOutputStream out=null;try{out=store.startWrite();JSONArray q=new JSONArray(),a=new JSONArray(),i=new JSONArray(),s=new JSONArray();for(String v:queue.values())q.put(v);for(String v:awaitingReceipt.values())a.put(v);for(String v:inbox.values())i.put(v);for(String id:seen.keySet())s.put(id);byte[] b=new JSONObject().put("queue",q).put("awaiting",a).put("inbox",i).put("seen",s).put("ingress",new JSONObject(ingress)).toString().getBytes("UTF-8");if(b.length>512*1024)throw new IOException("Mesh store bound exceeded");out.write(b);store.finishWrite(out);}catch(Exception e){if(out!=null)store.failWrite(out);if(e instanceof IOException)throw(IOException)e;throw new IOException(e);}}
 private static JSONObject obj(String k,Object v,String k2,Object v2){try{return new JSONObject().put(k,v).put(k2,v2);}catch(Exception e){return new JSONObject();}}
 private static JSONObject obj(String k,Object v,String k2,Object v2,String k3,Object v3){try{return new JSONObject().put(k,v).put(k2,v2).put(k3,v3);}catch(Exception e){return new JSONObject();}}
}
