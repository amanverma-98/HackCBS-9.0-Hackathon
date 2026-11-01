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
 static Set<String> ids(List<String> wires){Set<String> r=new HashSet<>();if(wires!=null)for(String w:wires)try{r.add(MeshPacket.parse(w).id());}catch(Exception ignored){}return r;}
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
  // Location broadcast: B takes custody first; C connects later and still gets A's valid position.
  File retainDir=Files.createTempDirectory("mesh-retain").toFile();Map<String,List<String>> out=new HashMap<>();
  MeshRouter ra2=new MeshRouter(new File(retainDir,"a.json"),a,(t,d)->{},(n,w)->out.computeIfAbsent(n,k->new ArrayList<>()).add(w),false);
  try{ra2.neighbor("B-link",true);check(ra2.sendExtension("position","*","{\"time\":1}",1),"position admitted");
   String position=out.get("B-link").get(0);String positionId=MeshPacket.parse(position).id();
   ra2.receive("B-link",MeshPacket.create("custody",id(b),id(a),positionId,3,b).wire());
   ra2.neighbor("C-link",true);check(ids(out.get("C-link")).contains(positionId),"late neighbour receives the retained position");
   check(ra2.sendExtension("position","*","{\"time\":2}",1),"newer position admitted");String newer=out.get("B-link").get(out.get("B-link").size()-1);
   ra2.neighbor("D-link",true);check(!ids(out.get("D-link")).contains(positionId)&&ids(out.get("D-link")).contains(MeshPacket.parse(newer).id()),"newer own position supersedes the queued older one");
   positionId=MeshPacket.parse(newer).id();ra2.receive("B-link",MeshPacket.create("custody",id(b),id(a),positionId,3,b).wire());
   int toB=out.get("B-link").size();ra2.neighbor("B-link",false);ra2.neighbor("B-link",true);check(out.get("B-link").size()==toB,"neighbour holding custody is not resent the broadcast");
   // Reconnect inside the resend window still flushes an update the neighbour never acknowledged.
   int toC=out.get("C-link").size();ra2.neighbor("C-link",false);ra2.neighbor("C-link",true);check(out.get("C-link").size()>toC&&ids(out.get("C-link").subList(toC,out.get("C-link").size())).contains(positionId),"reconnected neighbour gets queued update immediately");
  }finally{ra2.close();}
  // Relay A -> B -> C: C sees A's identity once with hops=1, duplicates do not re-fire events.
  File relayDir=Files.createTempDirectory("mesh-relay-position").toFile();List<String> bOut=new ArrayList<>(),cEvents=new ArrayList<>();
  MeshRouter rb2=new MeshRouter(new File(relayDir,"b.json"),b,(t,d)->{},(n,w)->{if(n.equals("C-link"))bOut.add(w);},false),rc2=new MeshRouter(new File(relayDir,"c.json"),c,(t,d)->{},(n,w)->{},false);
  rb2.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){return true;}public void tick(){}public void custody(String body){}};
  rc2.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){if(p.type().equals("position"))cEvents.add(p.sender()+"@"+p.json.optInt("hops"));return true;}public void tick(){}public void custody(String body){}};
  try{String positionFromA=MeshPacket.create("position",id(a),"*","{\"time\":1}",1,a).wire();rb2.neighbor("A-link",true);rb2.receive("A-link",positionFromA);rb2.neighbor("C-link",true);
   for(String w:new ArrayList<>(bOut))if(MeshPacket.parse(w).type().equals("position")){rc2.receive("B-link",w);rc2.receive("B-link",w);}
   check(cEvents.equals(List.of(id(a)+"@1")),"relayed position keeps A's identity and fires once: "+cEvents);
  }finally{rb2.close();rc2.close();}
  // Echo: a relay bouncing A's own position back must not reach A's app or be flooded again.
  File echoDir=Files.createTempDirectory("mesh-echo").toFile();List<String> echoOut=new ArrayList<>(),echoEvents=new ArrayList<>();
  MeshRouter ra3=new MeshRouter(new File(echoDir,"a.json"),a,(t,d)->{},(n,w)->echoOut.add(w),false);
  ra3.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){echoEvents.add(p.type());return true;}public void tick(){}public void custody(String body){}};
  try{ra3.neighbor("B-link",true);ra3.sendExtension("position","*","{\"time\":1}",1);MeshPacket own=MeshPacket.parse(echoOut.get(0));int sends=echoOut.size();
   ra3.receive("B-link",own.forwarded(id(b)).wire());
   check(echoEvents.isEmpty(),"own echoed position is not delivered to the app");
   check(echoOut.stream().skip(sends).noneMatch(w->{try{MeshPacket x=MeshPacket.parse(w);return x.id().equals(own.id())&&x.json.optInt("hops")>0;}catch(Exception e){return false;}}),"own echoed position is not re-flooded");
  }finally{ra3.close();}
  // Full outbox: background traffic gives way to messages and SOS; a clear error only when it is all unsent own messages.
  File fullDir=Files.createTempDirectory("mesh-full").toFile();MeshRouter rf=new MeshRouter(new File(fullDir,"a.json"),a,(t,d)->{},(n,w)->{},false);
  rf.extension=new MeshRouter.Extension(){public boolean accept(MeshPacket p,String in){return true;}public void tick(){}public void custody(String body){}};
  try{for(int i=0;i<10;i++)rf.receive("B-link",MeshPacket.create("position",id(b),"*","{\"time\":"+i+"}",1,b).wire());
   check(new JSONObject(ModelStore.read(new File(fullDir,"a.json"))).getJSONArray("queue").length()==1,"relayed positions from one phone supersede each other");
   for(int i=0;i<MeshRouter.MAX_QUEUE;i++){KeyPair k=key();rf.receive("B-link",MeshPacket.create("presence",id(k),"*","{}",1,k).wire());}
   check(new JSONObject(ModelStore.read(new File(fullDir,"a.json"))).getJSONArray("queue").length()==MeshRouter.MAX_QUEUE,"outbox full of relayed presence");
   rf.send("text","*","still goes out");rf.send("sos","*","help");
   int accepted=0;boolean refused=false;try{for(int i=0;i<MeshRouter.MAX_QUEUE+5;i++){rf.send("text",UUID.randomUUID().toString(),"waiting "+i);accepted++;}}catch(IOException e){refused=e.getMessage().startsWith("Too many messages");}
   check(refused&&accepted==MeshRouter.MAX_QUEUE-2,"own unsent messages fill the outbox: clear error after "+accepted);
   rf.send("sos","*","second SOS still accepted");
  }finally{rf.close();}
  System.out.println("MeshRouterTest PASS: full outbox prioritises messages and SOS, custody destination, recipient ACK identity, final hop, duplicate ACK recovery, control capacity, SOS priority, voice cleanup, multi-hop presence, retained broadcast for late neighbours, reconnect flush, relayed position identity, duplicate suppression, own-echo suppression");
 }
}
