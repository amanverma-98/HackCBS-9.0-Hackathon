package com.talk2;
import java.nio.file.Files;
import java.util.*;
import org.json.JSONObject;
public final class VoiceTransferTest {
 public static void main(String[] args)throws Exception{
  VoiceTransfer a=new VoiceTransfer(Files.createTempDirectory("talk2-voice-a").toFile());
  VoiceTransfer b=new VoiceTransfer(Files.createTempDirectory("talk2-voice-b").toFile());
  byte[] pcm=new byte[640000];new Random(7).nextBytes(pcm);String uri=a.save(pcm);
  JSONObject meta=new JSONObject().put("id","test").put("kind","voice").put("text","Voice message").put("language","en").put("time",System.currentTimeMillis()).put("audioUri",uri);
  List<String> frames=new ArrayList<>();a.send(uri,meta,frames::add);
  JSONObject received=null;for(String frame:frames){if(frame.getBytes("UTF-8").length>32768)throw new AssertionError("Frame oversized");JSONObject m=b.accept(new JSONObject(frame));if(m!=null)received=m;}
  if(received==null||!Arrays.equals(pcm,b.read(received.getString("audioUri"))))throw new AssertionError("Voice mismatch");
  if(frames.get(0).contains("audioUri"))throw new AssertionError("Private path transmitted");
  b.accept(new JSONObject(frames.get(0)));try{b.accept(new JSONObject(frames.get(2)));throw new AssertionError("Missing chunk accepted");}catch(java.io.IOException expected){}
  b.accept(new JSONObject(frames.get(0)));try{b.accept(new JSONObject(frames.get(frames.size()-1)));throw new AssertionError("Truncated clip accepted");}catch(java.io.IOException expected){}
  try{a.read("file:///etc/passwd");throw new AssertionError("Path escape");}catch(java.io.IOException expected){}
  a.clear();b.clear();System.out.println("VoiceTransfer: maximum clip, ordered chunks, integrity, path bounds passed");
 }
}
