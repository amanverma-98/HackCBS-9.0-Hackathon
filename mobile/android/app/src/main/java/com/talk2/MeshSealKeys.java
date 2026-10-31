package com.talk2;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;

/**
 * Persistent mesh encryption key pair. The private key is stored wrapped by an AES key that
 * never leaves AndroidKeyStore (ECDH keys in the keystore need API 31; the app supports 24).
 */
final class MeshSealKeys {
 private static final String WRAP="talk2.mesh.seal.wrap.v1";
 private MeshSealKeys(){}
 static synchronized MeshSeal load(Context c)throws Exception{
  File file=new File(c.getFilesDir(),"mesh-seal.json");
  if(file.exists())try{
   JSONObject o=new JSONObject(ModelStore.read(file));
   Cipher unwrap=Cipher.getInstance("AES/GCM/NoPadding");unwrap.init(Cipher.DECRYPT_MODE,wrapKey(),new GCMParameterSpec(128,Base64.decode(o.getString("iv"),Base64.NO_WRAP)));
   KeyFactory f=KeyFactory.getInstance("EC");
   PrivateKey priv=f.generatePrivate(new PKCS8EncodedKeySpec(unwrap.doFinal(Base64.decode(o.getString("wrapped"),Base64.NO_WRAP))));
   PublicKey pub=f.generatePublic(new X509EncodedKeySpec(Base64.decode(o.getString("pub"),Base64.NO_WRAP)));
   return new MeshSeal(new KeyPair(pub,priv));
  }catch(Exception unreadable){/* Keystore reset or corrupt file: issue a new key; peers learn it from presence. */}
  KeyPairGenerator g=KeyPairGenerator.getInstance("EC");g.initialize(new ECGenParameterSpec("secp256r1"));KeyPair pair=g.generateKeyPair();
  Cipher wrap=Cipher.getInstance("AES/GCM/NoPadding");wrap.init(Cipher.ENCRYPT_MODE,wrapKey());
  JSONObject o=new JSONObject().put("pub",Base64.encodeToString(pair.getPublic().getEncoded(),Base64.NO_WRAP))
   .put("wrapped",Base64.encodeToString(wrap.doFinal(pair.getPrivate().getEncoded()),Base64.NO_WRAP))
   .put("iv",Base64.encodeToString(wrap.getIV(),Base64.NO_WRAP));
  File tmp=new File(file.getPath()+".tmp");
  try(FileOutputStream out=new FileOutputStream(tmp)){out.write(o.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
  if(!tmp.renameTo(file))throw new IOException("Could not store mesh encryption key");
  return new MeshSeal(pair);
 }
 private static SecretKey wrapKey()throws Exception{
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias(WRAP)){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   g.init(new KeyGenParameterSpec.Builder(WRAP,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());g.generateKey();}
  return (SecretKey)ks.getKey(WRAP,null);
 }
}
