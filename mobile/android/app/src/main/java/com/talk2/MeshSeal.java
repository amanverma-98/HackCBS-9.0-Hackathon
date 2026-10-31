package com.talk2;

import android.util.Base64;
import org.json.JSONObject;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;

/**
 * End-to-end sealing for addressed mesh messages, so relay phones carry only ciphertext.
 * ECIES: ephemeral P-256 ECDH with the recipient's mesh encryption key, HKDF-SHA256, then
 * AES-256-GCM. The sender and recipient node ids are authenticated data, so a sealed body
 * cannot be replayed under another sender or to another recipient. The recipient's key comes
 * from its signed presence announcement, which binds the key to its mesh identity.
 */
final class MeshSeal {
 static final String PREFIX="seal1:";
 private final KeyPair keys;
 MeshSeal(KeyPair keys){this.keys=keys;}
 String publicKey(){return b64(keys.getPublic().getEncoded());}
 static boolean sealed(String body){return body!=null&&body.startsWith(PREFIX);}

 static String seal(String plain,String recipientKey,String from,String to)throws Exception{
  byte[] recipient=Base64.decode(recipientKey,Base64.NO_WRAP);
  PublicKey peer=KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(recipient));
  KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));KeyPair eph=g.generateKeyPair();
  byte[] ephPub=eph.getPublic().getEncoded(),nonce=new byte[12];new SecureRandom().nextBytes(nonce);
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
  c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(derive(eph.getPrivate(),peer,ephPub,recipient),"AES"),new GCMParameterSpec(128,nonce));
  c.updateAAD(aad(from,to));
  byte[] cipher=c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
  return PREFIX+new JSONObject().put("e",b64(ephPub)).put("n",b64(nonce)).put("c",b64(cipher)).toString();
 }

 String open(String sealed,String from,String to)throws Exception{
  if(!sealed(sealed))throw new GeneralSecurityException("Not a sealed mesh message");
  JSONObject o=new JSONObject(sealed.substring(PREFIX.length()));
  byte[] ephPub=Base64.decode(o.getString("e"),Base64.NO_WRAP),nonce=Base64.decode(o.getString("n"),Base64.NO_WRAP);
  if(nonce.length!=12)throw new GeneralSecurityException("Invalid sealed nonce");
  PublicKey eph=KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(ephPub));
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
  c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(derive(keys.getPrivate(),eph,ephPub,keys.getPublic().getEncoded()),"AES"),new GCMParameterSpec(128,nonce));
  c.updateAAD(aad(from,to));
  return new String(c.doFinal(Base64.decode(o.getString("c"),Base64.NO_WRAP)),StandardCharsets.UTF_8);
 }

 private static byte[] derive(PrivateKey mine,PublicKey other,byte[] ephPub,byte[] recipientPub)throws Exception{
  KeyAgreement a=KeyAgreement.getInstance("ECDH");a.init(mine);a.doPhase(other,true);
  Mac m=Mac.getInstance("HmacSHA256");byte[] salt=new byte[ephPub.length+recipientPub.length];
  System.arraycopy(ephPub,0,salt,0,ephPub.length);System.arraycopy(recipientPub,0,salt,ephPub.length,recipientPub.length);
  m.init(new SecretKeySpec(salt,"HmacSHA256"));byte[] prk=m.doFinal(a.generateSecret());
  m.init(new SecretKeySpec(prk,"HmacSHA256"));return m.doFinal("Talk2-mesh-seal-v1\u0001".getBytes(StandardCharsets.UTF_8));
 }
 private static byte[] aad(String from,String to){return ("Talk2-mesh-seal-v1|"+from+"|"+to).getBytes(StandardCharsets.UTF_8);}
 private static String b64(byte[] b){return Base64.encodeToString(b,Base64.NO_WRAP);}
}
