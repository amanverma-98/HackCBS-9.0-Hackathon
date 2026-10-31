package com.talk2;

import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.UUID;

public final class MeshPacketTest {
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 private static KeyPair keys()throws Exception{KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));return g.generateKeyPair();}
 public static void main(String[] args)throws Exception{
  KeyPair origin=keys();String id=UUID.nameUUIDFromBytes(origin.getPublic().getEncoded()).toString();
  MeshPacket p=MeshPacket.create("text",id,"*","public message",1,origin);
  check(MeshPacket.parse(p.wire()).body().equals("public message"),"signed packet parses");
  boolean rejected=false;MeshPacket relay=p.forwarded(id);check(relay.json.getInt("hops")==1,"hop increments");
  check(MeshPacket.parse(relay.wire()).body().equals("public message"),"origin signature survives hop update");
  for(int i=1;i<MeshPacket.MAX_HOPS;i++)relay=relay.forwarded(id);
  rejected=false;try{relay.forwarded(id);}catch(IllegalStateException expected){rejected=true;}check(rejected,"hop limit enforced");
  rejected=false;try{org.json.JSONObject altered=new org.json.JSONObject(p.wire()).put("body","tampered");MeshPacket.parse(altered.toString());}catch(Exception expected){rejected=true;}check(rejected,"tampered body rejected");
  rejected=false;try{MeshPacket.create("text",id,"*",new String(new char[MeshPacket.MAX_TEXT+1]).replace('\0','x'),1,origin);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"text bound enforced");
  rejected=false;try{MeshPacket.parse(new String(new char[MeshPacket.MAX_BYTES+1]));}catch(Exception expected){rejected=true;}check(rejected,"wire size bound enforced");
  System.out.println("MeshPacketTest PASS");
 }
}
