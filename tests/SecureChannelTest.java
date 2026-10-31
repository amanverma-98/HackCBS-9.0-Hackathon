import com.talk2.SecureChannel;import java.util.Arrays;
public class SecureChannelTest{
 public static void main(String[] args)throws Exception{
  SecureChannel a=new SecureChannel(),b=new SecureChannel();if(!a.accept(b.publicKey()).equals(b.accept(a.publicKey())))throw new AssertionError("SAS mismatch");
  byte[] payload="नमस्ते Talk2".getBytes("UTF-8"),encrypted=a.encrypt(payload);if(!Arrays.equals(b.decrypt(encrypted),payload))throw new AssertionError("Roundtrip failed");
  try{b.decrypt(encrypted);throw new AssertionError("Replay accepted");}catch(java.security.GeneralSecurityException expected){}
  try{a.decrypt(a.encrypt(payload));throw new AssertionError("Reflection accepted");}catch(java.security.GeneralSecurityException expected){}
  byte[] tampered=a.encrypt(payload);tampered[tampered.length-1]^=1;try{b.decrypt(tampered);throw new AssertionError("Tamper accepted");}catch(java.security.GeneralSecurityException expected){}
  if(!Arrays.equals(a.decrypt(b.encrypt(payload)),payload))throw new AssertionError("Reverse direction failed");
  SecureChannel c=new SecureChannel(),d=new SecureChannel();c.accept(d.publicKey());d.accept(c.publicKey());try{d.decrypt(a.encrypt(payload));throw new AssertionError("Wrong key accepted");}catch(java.security.GeneralSecurityException expected){}
  System.out.println("PASS: matching SAS, bidirectional encryption, replay, reflection, tamper and wrong-session rejection");
 }
}
