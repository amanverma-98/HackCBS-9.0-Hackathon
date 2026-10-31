package com.talk2;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import java.io.*;
/**
 * Speech models shipped inside the APK (assets/voices): TTS voices (vits-*) and speech
 * recognition (indicwav2vec-*). They work without any download. ONNX Runtime needs a file
 * path, so each model is copied out once and reused while its size still matches the
 * packaged asset; assets are stored uncompressed (see build.gradle).
 */
public final class BundledVoices {
 private final AssetManager assets;private final File dir;
 BundledVoices(Context c){assets=c.getAssets();dir=new File(c.getFilesDir(),"bundled-voices");}
 static String voice(String lang){return "vits-"+ModelStore.safe(lang)+"-int8.onnx";}
 static String recognizer(String lang){return "indicwav2vec-"+ModelStore.safe(lang)+"-int8.onnx";}
 static String vocabFor(String model){return model.replace("-int8.onnx","-vocab.json");}
 boolean has(String lang){return exists(voice(lang));}
 boolean hasRecognizer(String lang){return exists(recognizer(lang));}
 private boolean exists(String name){try(AssetFileDescriptor fd=assets.openFd("voices/"+name)){return fd.getLength()>0;}catch(Exception e){return false;}}
 File modelFile(String lang)throws Exception{return extract(voice(lang));}
 synchronized File extract(String name)throws Exception{
  long size;try(AssetFileDescriptor fd=assets.openFd("voices/"+name)){size=fd.getLength();}
  File out=new File(dir,name);if(out.length()==size)return out;dir.mkdirs();File tmp=new File(dir,name+".tmp");
  try(InputStream in=assets.open("voices/"+name);FileOutputStream o=new FileOutputStream(tmp)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)o.write(b,0,n);o.getFD().sync();}
  if(tmp.length()!=size||(out.exists()&&!out.delete())||!tmp.renameTo(out)){tmp.delete();throw new IOException("Could not prepare the built-in model "+name);}
  return out;
 }
 String vocab(String lang)throws Exception{return text(vocabFor(voice(lang)));}
 String text(String name)throws Exception{try(InputStream in=assets.open("voices/"+name);ByteArrayOutputStream o=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)o.write(b,0,n);return o.toString("UTF-8");}}
}
