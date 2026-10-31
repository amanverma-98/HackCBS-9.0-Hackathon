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
  // Reconnect: a new session re-confirms by proving the earlier confirmed session's resume secret.
  if(!Arrays.equals(a.resumeSecret(),b.resumeSecret()))throw new AssertionError("Resume secret mismatch");
  byte[] trust=a.resumeSecret();SecureChannel e=new SecureChannel(),f=new SecureChannel();e.accept(f.publicKey());f.accept(e.publicKey());
  if(!f.checkResume(trust,e.resumeProof(trust,true))||!e.checkResume(trust,f.resumeProof(trust,true)))throw new AssertionError("Valid resume proof rejected");
  if(e.checkResume(trust,e.resumeProof(trust,true)))throw new AssertionError("Echoed resume proof accepted");
  if(f.checkResume(c.resumeSecret(),e.resumeProof(trust,true)))throw new AssertionError("Wrong resume secret accepted");
  System.out.println("PASS: matching SAS, bidirectional encryption, replay, reflection, tamper, wrong-session and resume-proof checks");
 }
}
