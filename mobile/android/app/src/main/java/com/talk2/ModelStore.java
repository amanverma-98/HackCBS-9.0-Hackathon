package com.talk2;
import android.content.Context;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.*;
import java.util.*;
public final class ModelStore {
 interface Progress{void update(String pack,String file,long done,long total);}
 final File root;private volatile boolean cancelled;
 /** Pack name -> file fingerprint that last passed full verification (see readyCached). */
 private final Map<String,String> verified=new java.util.concurrent.ConcurrentHashMap<>();
 ModelStore(Context c){root=new File(c.getFilesDir(),"packs");root.mkdirs();}
 static String safe(String s){if(!s.matches("[a-zA-Z0-9_.-]+")||s.contains(".."))throw new IllegalArgumentException("Unsafe filename");return s;}
 File file(String pack,String name){return new File(new File(root,safe(pack)),safe(name));}
 void cancel(){cancelled=true;}
 static String hash(File f)throws Exception{MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)md.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte b:md.digest())s.append(String.format("%02x",b&255));return s.toString();}
 private JSONArray validateSpec(String pack,JSONObject spec)throws Exception{
  JSONArray files=spec.getJSONArray("files");Set<String> required=new HashSet<>();
  if(pack.equals("translation")){required.add("indictrans2-encoder-int8.onnx");required.add("indictrans2-decoder-int8.onnx");required.add("indictrans2-vocab.json");}
  else if(pack.equals("translation-en")){for(String d:new String[]{"en-indic","indic-en"}){required.add("indictrans2-"+d+"-encoder-int8.onnx");required.add("indictrans2-"+d+"-decoder-int8.onnx");required.add("indictrans2-"+d+"-vocab.json");}}
  else {if(!Arrays.asList("hi","ta","bn","gu","mr","kn","ml","te","or","en").contains(pack))throw new IOException("Unknown language pack");required.add("indicwav2vec-"+pack+"-int8.onnx");required.add("indicwav2vec-"+pack+"-vocab.json");required.add("vits-"+pack+"-int8.onnx");required.add("vits-"+pack+"-vocab.json");}
  if(files.length()!=required.size())throw new IOException("Incomplete pack manifest");
  for(int i=0;i<files.length();i++)if(!required.remove(files.getJSONObject(i).getString("name")))throw new IOException("Unexpected or duplicate pack file");
  if(!required.isEmpty())throw new IOException("Missing pack files");return files;
 }
 synchronized void install(String pack,JSONObject manifest,Progress progress)throws Exception{
  cancelled=false;verified.remove(pack);JSONObject spec=manifest.getJSONObject("packs").getJSONObject(pack);JSONArray files=validateSpec(pack,spec);
  File dir=new File(root,safe(pack));dir.mkdirs();new File(dir,"ready.json").delete();
  for(int i=0;i<files.length();i++){
   JSONObject f=files.getJSONObject(i);String name=safe(f.getString("name")),sha=f.getString("sha256");long expected=f.getLong("bytes");if(!sha.matches("[a-f0-9]{64}")||expected<=0)throw new IOException("Missing checksum or exact file size");
   File dest=file(pack,name),tmp=file(pack,name+".part");if(dest.exists()&&dest.length()==expected&&hash(dest).equals(sha))continue;
   long start=tmp.length();if(start>expected){tmp.delete();start=0;}if(dir.getUsableSpace()<Math.max(0,expected-start)+33554432)throw new IOException("Not enough free storage");
   URL url=new URL(f.getString("url"));HttpURLConnection connection=null;
   try{
    for(int redirect=0;redirect<8;redirect++){
     if(!url.getProtocol().equals("https"))throw new IOException("Models require HTTPS");connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(20000);connection.setReadTimeout(30000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Accept-Encoding","identity");if(start>0)connection.setRequestProperty("Range","bytes="+start+"-");int response=connection.getResponseCode();
     if(response>=300&&response<400){String target=connection.getHeaderField("Location");connection.disconnect();url=new URL(url,target);}else break;
    }
    int response=connection.getResponseCode();if(response==416){tmp.delete();throw new IOException("Partial download expired. Retry.");}if(response!=200&&response!=206)throw new IOException("Download HTTP "+response+": "+name);
    if(response==206){String range=connection.getHeaderField("Content-Range");if(range==null||!range.startsWith("bytes "+start+"-"))throw new IOException("Invalid resume response");}else start=0;
    long done=start,last=0;try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(tmp,start>0)){
     byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){if(cancelled)throw new IOException("Download paused. Tap Download to resume.");out.write(b,0,n);done+=n;if(done>expected)throw new IOException("File exceeds manifest size");if(System.currentTimeMillis()-last>200){progress.update(pack,name,done,expected);last=System.currentTimeMillis();}}out.getFD().sync();
    }
    if(tmp.length()!=expected)throw new IOException("Incomplete model download");if(!hash(tmp).equals(sha)){tmp.delete();throw new IOException("Checksum mismatch: "+name);}if(dest.exists()&&!dest.delete())throw new IOException("Cannot replace model");if(!tmp.renameTo(dest))throw new IOException("Cannot commit model");
   }finally{if(connection!=null)connection.disconnect();}
  }
  File temp=new File(dir,"ready.json.tmp");try(FileOutputStream out=new FileOutputStream(temp)){out.write(spec.toString().getBytes("UTF-8"));out.getFD().sync();}if(!temp.renameTo(new File(dir,"ready.json")))throw new IOException("Cannot commit pack");
 }
 boolean ready(String pack)throws Exception{File m=file(pack,"ready.json");if(!m.exists())return false;JSONArray fs=validateSpec(pack,new JSONObject(read(m)));for(int i=0;i<fs.length();i++){JSONObject f=fs.getJSONObject(i);File v=file(pack,f.getString("name"));if(!v.exists()||v.length()!=f.getLong("bytes")||!hash(v).equals(f.getString("sha256")))return false;}return true;}
 /**
  * ready() re-hashes every file (hundreds of MB). Inference calls use this instead: a full
  * verification is reused until any file's name, size or timestamp changes.
  */
 boolean readyCached(String pack)throws Exception{
  if(!file(pack,"ready.json").exists()){verified.remove(pack);return false;}
  StringBuilder print=new StringBuilder();File[] files=new File(root,safe(pack)).listFiles();if(files!=null){Arrays.sort(files);for(File f:files)print.append(f.getName()).append(':').append(f.length()).append(':').append(f.lastModified()).append(';');}
  String key=print.toString();if(key.equals(verified.get(pack)))return true;boolean ok=ready(pack);if(ok)verified.put(pack,key);else verified.remove(pack);return ok;
 }
 /** Bytes to download when the release changed files of an installed pack (0 = up to date). install() fetches only those. */
 long updateBytes(String pack,JSONObject spec)throws Exception{
  File m=file(pack,"ready.json");if(spec==null||!m.exists())return 0;JSONArray have=new JSONObject(read(m)).getJSONArray("files"),want=validateSpec(pack,spec);
  Map<String,String> installed=new HashMap<>();for(int i=0;i<have.length();i++)installed.put(have.getJSONObject(i).getString("name"),have.getJSONObject(i).getString("sha256"));
  long total=0;for(int i=0;i<want.length();i++){JSONObject f=want.getJSONObject(i);if(!f.getString("sha256").equals(installed.get(f.getString("name"))))total+=f.getLong("bytes");}return total;
 }
 long partialBytes(String pack,JSONObject spec)throws Exception{if(spec==null)return 0;JSONArray fs=validateSpec(pack,spec);long total=0;for(int i=0;i<fs.length();i++){JSONObject entry=fs.getJSONObject(i);String name=safe(entry.getString("name"));long expected=entry.getLong("bytes");File complete=file(pack,name),part=file(pack,name+".part");if(complete.exists()&&complete.length()==expected)total+=expected;else if(part.exists())total+=Math.min(part.length(),expected);}return total;}
 void remove(String pack)throws Exception{verified.remove(pack);File d=new File(root,safe(pack));File[] files=d.listFiles();if(files!=null)for(File f:files)if(!f.delete())throw new IOException("Cannot remove "+f.getName());d.delete();}
 static String read(File f)throws Exception{try(InputStream i=new FileInputStream(f);ByteArrayOutputStream o=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=i.read(b))!=-1)o.write(b,0,n);return o.toString("UTF-8");}}
}
