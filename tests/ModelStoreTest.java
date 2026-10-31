package com.talk2;
import android.content.Context;
import org.json.*;
import java.nio.file.*;
import java.io.*;
public final class ModelStoreTest {
 private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  Path temp=Files.createTempDirectory("talk2-model-store");ModelStore store=new ModelStore(new Context(temp.toFile()));
  check(!store.ready("en"),"Uninstalled pack reported ready");
  String[] names={"indicwav2vec-en-int8.onnx","indicwav2vec-en-vocab.json","vits-en-int8.onnx","vits-en-vocab.json"};
  JSONArray files=new JSONArray();
  for(String name:names){File f=store.file("en",name);f.getParentFile().mkdirs();Files.write(f.toPath(),"verified-model-test".getBytes("UTF-8"));files.put(new JSONObject().put("name",name).put("bytes",f.length()).put("sha256",ModelStore.hash(f)).put("url","https://example.invalid/"+name));}
  JSONObject spec=new JSONObject().put("files",files);Files.write(store.file("en","ready.json").toPath(),spec.toString().getBytes("UTF-8"));
  check(store.ready("en"),"Complete verified pack rejected");
  Files.write(store.file("en",names[0]).toPath(),"tampered-model-test".getBytes("UTF-8"));check(!store.ready("en"),"Tampered model accepted");
  try{store.file("../escape","x");throw new AssertionError("Path traversal accepted");}catch(IllegalArgumentException expected){}
  JSONArray duplicate=new JSONArray().put(files.getJSONObject(0)).put(files.getJSONObject(0)).put(files.getJSONObject(2)).put(files.getJSONObject(3));
  JSONObject manifest=new JSONObject().put("packs",new JSONObject().put("en",new JSONObject().put("files",duplicate)));
  try{store.install("en",manifest,(a,b,c,d)->{});throw new AssertionError("Duplicate/incomplete manifest accepted");}catch(IOException expected){}
  store.remove("en");check(!store.ready("en"),"Removed pack reported ready");
  Files.walk(temp).sorted(java.util.Comparator.reverseOrder()).forEach(p->{try{Files.delete(p);}catch(IOException e){throw new RuntimeException(e);}});
  System.out.println("PASS: uninstalled/verified/tampered/removed pack states, duplicate manifest and path traversal rejection");
 }
}
