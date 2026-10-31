package com.talk2;

import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.*;
import android.util.Base64;
import java.util.UUID;

/** Independently versioned, signed mesh envelope. Payloads are public to relays. */
final class MeshPacket {
 static final int VERSION=1, MAX_BYTES=8192, MAX_TEXT=1200, MAX_HOPS=4;
 static final long MAX_AGE_MS=24L*60*60*1000;
 final JSONObject json;
 private MeshPacket(JSONObject value){json=value;}
 static MeshPacket create(String type,String sender,String destination,String body,int priority,KeyPair key)throws Exception{
  if(!type.equals("text")&&!type.equals("sos")&&!type.equals("ack")&&!type.equals("custody")&&!type.equals("voice")&&!type.equals("position"))throw new IllegalArgumentException("Unsupported mesh packet type");
  if(sender==null||sender.length()>80||destination==null||destination.length()>80||body==null||body.length()>MAX_TEXT)throw new IllegalArgumentException("Mesh packet exceeds bounds");
  if(priority<0||priority>3)throw new IllegalArgumentException("Invalid priority");
  JSONObject p=new JSONObject().put("v",VERSION).put("id",UUID.randomUUID().toString()).put("type",type).put("sender",sender).put("destination",destination).put("lastHop",sender).put("created",System.currentTimeMillis()).put("expires",System.currentTimeMillis()+(type.equals("voice")?30*60*1000L:type.equals("position")?30000:MAX_AGE_MS)).put("ttl",MAX_HOPS).put("hops",0).put("priority",priority).put("body",body).put("publicKey",android.util.Base64.encodeToString(key.getPublic().getEncoded(),android.util.Base64.NO_WRAP));
  Signature sign=Signature.getInstance("SHA256withECDSA");sign.initSign(key.getPrivate());sign.update(canonical(p));p.put("signature",android.util.Base64.encodeToString(sign.sign(),android.util.Base64.NO_WRAP));
  MeshPacket packet=new MeshPacket(p);packet.validate();return packet;
 }
 static MeshPacket parse(String wire)throws Exception{if(wire==null||wire.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw new IllegalArgumentException("Mesh packet too large");MeshPacket p=new MeshPacket(new JSONObject(wire));p.validate();return p;}
 private void validate()throws Exception{
  if(json.getInt("v")!=VERSION)throw new IllegalArgumentException("Unsupported mesh version");
  String type=json.getString("type"),body=json.getString("body");if(!type.equals("text")&&!type.equals("sos")&&!type.equals("ack")&&!type.equals("custody")&&!type.equals("voice")&&!type.equals("position"))throw new IllegalArgumentException("Invalid packet type");
  if(body.length()>MAX_TEXT||json.getString("id").length()>80||json.getString("sender").length()>80||json.getString("destination").length()>80)throw new IllegalArgumentException("Mesh field exceeds bounds");
  long now=System.currentTimeMillis();if(json.getLong("created")>now+300000||json.getLong("expires")<now||json.getLong("expires")-json.getLong("created")>MAX_AGE_MS)throw new IllegalArgumentException("Mesh packet expired or invalid");
  if(json.getInt("ttl")<0||json.getInt("ttl")>MAX_HOPS||json.getInt("hops")<0||json.getInt("hops")>MAX_HOPS||json.getInt("hops")>json.getInt("ttl")||json.getInt("priority")<0||json.getInt("priority")>3)throw new IllegalArgumentException("Invalid mesh route bounds");
  byte[] pub=android.util.Base64.decode(json.getString("publicKey"),android.util.Base64.NO_WRAP),sig=android.util.Base64.decode(json.getString("signature"),android.util.Base64.NO_WRAP);PublicKey key=KeyFactory.getInstance("EC").generatePublic(new java.security.spec.X509EncodedKeySpec(pub));Signature verify=Signature.getInstance("SHA256withECDSA");verify.initVerify(key);JSONObject unsigned=new JSONObject(json.toString());unsigned.remove("signature");verify.update(canonical(unsigned));if(!verify.verify(sig))throw new SecurityException("Mesh packet signature invalid");if(!UUID.nameUUIDFromBytes(pub).toString().equals(json.getString("sender")))throw new SecurityException("Mesh sender identity mismatch");
 }
 MeshPacket forwarded(String currentNode)throws Exception{validate();int hops=json.getInt("hops"),ttl=json.getInt("ttl");if(hops>=ttl)throw new IllegalStateException("Mesh hop limit reached");JSONObject next=new JSONObject(json.toString()).put("hops",hops+1).put("lastHop",currentNode);byte[] bytes=next.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_BYTES)throw new IllegalArgumentException("Mesh packet too large");return new MeshPacket(next);}
 String id(){return json.optString("id");}String sender(){return json.optString("sender");}String type(){return json.optString("type");}String body(){return json.optString("body");}String destination(){return json.optString("destination");}String lastHop(){return json.optString("lastHop");}int priority(){return json.optInt("priority");}
 String wire(){return json.toString();}
 private static byte[] canonical(JSONObject p)throws Exception{JSONObject stable=new JSONObject(p.toString());stable.remove("signature");stable.remove("hops");stable.remove("lastHop");return stable.toString().getBytes(StandardCharsets.UTF_8);}
}
