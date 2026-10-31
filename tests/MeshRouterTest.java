package com.talk2;
import java.io.*;
import java.nio.file.Files;
import java.security.*;
import java.util.*;
import org.json.*;

public final class MeshRouterTest {
 static KeyPair key()throws Exception{KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(256);return g.generateKeyPair();}
 static String id(KeyPair k){return UUID.nameUUIDFromBytes(k.getPublic().getEncoded()).toString();}
 static void check(boolean v,String m){if(!v)throw new AssertionError(m);}
 public static void main(String[] args)throws Exception{
  KeyPair a=key(),b=key(),c=key();List<String> sent=new ArrayList<>(),events=new ArrayList<>();File file=Files.createTempDirectory("mesh-router").resolve("outbox.json").toFile();
  MeshRouter router=new MeshRouter(file,a,(type,data)->events.add(type),(n,w)->sent.add(w),false);
  try{
   router.neighbor("B-link",true);router.send("text",id(b),"hello");MeshPacket message=MeshPacket.parse(sent.get(0));
   router.receive("B-link",MeshPacket.create("custody",id(b),id(c),message.id(),3,b).wire());
   check(new JSONObject(ModelStore.read(file)).getJSONArray("queue").length()==1,"misaddressed custody cannot remove queue");
   router.receive("B-link",MeshPacket.create("ack",id(c),id(a),message.id(),3,c).wire());check(!events.contains("meshReceipt"),"other identity cannot acknowledge recipient delivery");
   router.receive("B-link",MeshPacket.create("ack",id(b),id(a),message.id(),3,b).wire());check(events.contains("meshReceipt"),"recipient identity acknowledgement accepted");
   MeshPacket last=MeshPacket.create("text",id(b),"*","final hop",1,b);for(int i=0;i<4;i++)last=last.forwarded(id(b));
   sent.clear();router.receive("B-link",last.wire());check(events.contains("meshMessage"),"TTL final hop still locally receives");
   check(sent.stream().anyMatch(w->{try{return MeshPacket.parse(w).type().equals("custody");}catch(Exception e){return false;}}),"custody returned to ingress");
   router.acknowledgeInbox(last.id());router.receive("B-link",last.wire());check(new JSONObject(ModelStore.read(file)).getJSONArray("inbox").length()==1,"duplicate can reconstruct inbox ACK after prior UI receipt");
   router.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String ingress){return true;}public void tick(){}public void custody(String body){}};
   router.neighbor("C-link",true);sent.clear();MeshPacket cancel=MeshPacket.create("voice",id(b),"*",new JSONObject().put("op","cancel").put("transfer",UUID.randomUUID().toString()).toString(),3,b);
   router.receive("B-link",cancel.wire());check(sent.stream().anyMatch(w->{try{MeshPacket p=MeshPacket.parse(w);return p.id().equals(cancel.id())&&p.json.getInt("hops")==1;}catch(Exception e){return false;}}),"signed cancellation relays onward rather than stopping in local spool");
  }finally{router.close();}
  File bulkFile=Files.createTempDirectory("mesh-priority").resolve("outbox.json").toFile();List<String> order=new ArrayList<>();MeshRouter priority=new MeshRouter(bulkFile,a,(t,d)->{},(n,w)->order.add(MeshPacket.parse(w).type()),false);
  try{for(int i=0;i<4;i++)check(priority.sendExtension("voice","*","bulk "+i,0),"bulk admission");check(!priority.sendExtension("voice","*","extra",0),"bulk limited before control capacity");for(int i=0;i<12;i++)priority.send("text","*","text "+i);priority.send("sos","*","urgent");priority.neighbor("B-link",true);check(order.get(0).equals("sos"),"SOS evicts queued bulk and drains first");}finally{priority.close();}
  MeshRouter.eraseVoice(bulkFile);JSONArray left=new JSONObject(ModelStore.read(bulkFile)).getJSONArray("queue");for(int i=0;i<left.length();i++)check(!MeshPacket.parse(left.getString(i)).type().equals("voice"),"history cleanup removes persisted voice only");
  // Presence: A announces; B relays it; C (out of A's range) learns about A one hop away.
  File dir=Files.createTempDirectory("mesh-presence").toFile();List<String> fromA=new ArrayList<>(),fromB=new ArrayList<>(),seenAtC=new ArrayList<>();
  MeshRouter ra=new MeshRouter(new File(dir,"a.json"),a,(t,d)->{},(n,w)->fromA.add(w),false),rb=new MeshRouter(new File(dir,"b.json"),b,(t,d)->{},(n,w)->{if(n.equals("C-link"))fromB.add(w);},false),rc=new MeshRouter(new File(dir,"c.json"),c,(t,d)->{},(n,w)->{},false);
  MeshRouter.Extension presence=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){return p.type().equals("presence");}public void tick(){}public void custody(String body){}};
  rb.extension=presence;rc.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){if(p.type().equals("presence"))seenAtC.add(p.sender()+"@"+p.json.optInt("hops"));return true;}public void tick(){}public void custody(String body){}};
  try{ra.neighbor("B-link",true);check(ra.sendExtension("presence","*","{\"name\":\"A\"}",1),"presence admitted");String announce=fromA.stream().filter(w->{try{return MeshPacket.parse(w).type().equals("presence");}catch(Exception e){return false;}}).findFirst().orElseThrow();
   rb.neighbor("A-link",true);rb.receive("A-link",announce);rb.neighbor("C-link",true);for(String w:fromB)if(MeshPacket.parse(w).type().equals("presence"))rc.receive("B-link",w);
   check(seenAtC.equals(List.of(id(a)+"@1")),"C learns A's presence through B: "+seenAtC);
  }finally{ra.close();rb.close();rc.close();}
  System.out.println("MeshRouterTest PASS: custody destination, recipient ACK identity, final hop, duplicate ACK recovery, control capacity, SOS priority, voice cleanup, multi-hop presence");
 }
}
