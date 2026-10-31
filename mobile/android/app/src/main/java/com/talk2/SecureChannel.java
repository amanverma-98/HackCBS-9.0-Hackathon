package com.talk2;
import java.security.*;
import java.security.spec.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** P-256 ECDH, HKDF-SHA256, directional AES-256-GCM, operator-confirmed SAS. */
public final class SecureChannel {
 private final KeyPair pair;
 private byte[] sendKey,receiveKey,transcript;
 private final byte[] prefix=new byte[4];
 private byte[] remotePrefix;
 private long sent=0,received=-1;
 public SecureChannel()throws Exception{
  KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));pair=g.generateKeyPair();new SecureRandom().nextBytes(prefix);
 }
 public byte[] publicKey(){return pair.getPublic().getEncoded();}
 private static int compare(byte[] a,byte[] b){for(int i=0;i<Math.min(a.length,b.length);i++){int c=Integer.compare(a[i]&255,b[i]&255);if(c!=0)return c;}return a.length-b.length;}
 private static byte[] expand(byte[] prk,String info)throws Exception{Mac m=Mac.getInstance("HmacSHA256");m.init(new SecretKeySpec(prk,"HmacSHA256"));return m.doFinal((info+"\u0001").getBytes(StandardCharsets.UTF_8));}
 public String accept(byte[] peer)throws Exception{
  if(peer.length>256||Arrays.equals(peer,publicKey()))throw new GeneralSecurityException("Invalid peer key");
  KeyAgreement agreement=KeyAgreement.getInstance("ECDH");agreement.init(pair.getPrivate());agreement.doPhase(KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(peer)),true);
  boolean low=compare(publicKey(),peer)<0;MessageDigest md=MessageDigest.getInstance("SHA-256");md.update(low?publicKey():peer);transcript=md.digest(low?peer:publicKey());
  Mac m=Mac.getInstance("HmacSHA256");m.init(new SecretKeySpec(transcript,"HmacSHA256"));byte[] prk=m.doFinal(agreement.generateSecret());
  byte[] a=expand(prk,"Talk2-v1-low-to-high"),b=expand(prk,"Talk2-v1-high-to-low");sendKey=low?a:b;receiveKey=low?b:a;
  md.update(expand(prk,"Talk2-v1-sas"));byte[] sas=md.digest(transcript);
  return String.format(Locale.ROOT,"%06d",(ByteBuffer.wrap(sas).getInt()&0x7fffffff)%1000000);
 }
 public synchronized byte[] encrypt(byte[] plain)throws Exception{
  if(sendKey==null||plain.length>32768||sent==Long.MAX_VALUE)throw new GeneralSecurityException("Invalid frame");
  byte[] nonce=ByteBuffer.allocate(12).put(prefix).putLong(sent++).array();Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(sendKey,"AES"),new GCMParameterSpec(128,nonce));c.updateAAD(transcript);
  byte[] encrypted=c.doFinal(plain);return ByteBuffer.allocate(12+encrypted.length).put(nonce).put(encrypted).array();
 }
 public synchronized byte[] decrypt(byte[] frame)throws Exception{
  if(receiveKey==null||frame.length<28||frame.length>32800)throw new GeneralSecurityException("Invalid frame");
  byte[] p=Arrays.copyOf(frame,4);long seq=ByteBuffer.wrap(frame,4,8).getLong();if(seq<0||seq<=received||(remotePrefix!=null&&!Arrays.equals(remotePrefix,p)))throw new GeneralSecurityException("Replay or invalid sequence");
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(receiveKey,"AES"),new GCMParameterSpec(128,Arrays.copyOf(frame,12)));c.updateAAD(transcript);byte[] result=c.doFinal(frame,12,frame.length-12);received=seq;remotePrefix=p;return result;
 }
}
