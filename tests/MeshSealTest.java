package com.talk2;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import org.json.JSONObject;

public final class MeshSealTest {
 static KeyPair key()throws Exception{KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));return g.generateKeyPair();}
 static void check(boolean v,String m){if(!v)throw new AssertionError(m);}
 static boolean rejects(MeshSeal who,String sealed,String from,String to){try{who.open(sealed,from,to);return false;}catch(Exception expected){return true;}}
 public static void main(String[] args)throws Exception{
  MeshSeal c=new MeshSeal(key()),relay=new MeshSeal(key());
  String text="नमस्ते C, मदद चाहिए",sealed=MeshSeal.seal(text,c.publicKey(),"node-A","node-C");
  check(MeshSeal.sealed(sealed)&&!sealed.contains("नमस्ते")&&!sealed.contains("मदद"),"plaintext never appears on the wire");
  check(c.open(sealed,"node-A","node-C").equals(text),"recipient opens the message");
  check(rejects(relay,sealed,"node-A","node-C"),"relay with another key cannot open");
  check(rejects(c,sealed,"node-B","node-C"),"sender identity is bound");
  check(rejects(c,sealed,"node-A","node-B"),"recipient identity is bound");
  JSONObject o=new JSONObject(sealed.substring(MeshSeal.PREFIX.length()));byte[] ct=android.util.Base64.decode(o.getString("c"),android.util.Base64.NO_WRAP);ct[0]^=1;
  check(rejects(c,MeshSeal.PREFIX+o.put("c",android.util.Base64.encodeToString(ct,android.util.Base64.NO_WRAP)),"node-A","node-C"),"tampering detected");
  check(!MeshSeal.seal(text,c.publicKey(),"node-A","node-C").equals(sealed),"each seal uses a fresh ephemeral key and nonce");
  check(sealed.length()<MeshPacket.MAX_TEXT,"sealed chat fits a mesh packet");
  System.out.println("MeshSealTest PASS: recipient-only decryption, relay rejection, sender/recipient binding, tamper detection, fresh ephemeral keys");
 }
}
