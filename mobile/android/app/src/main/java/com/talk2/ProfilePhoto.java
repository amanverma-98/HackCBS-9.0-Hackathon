package com.talk2;

import android.app.Activity;
import android.content.Intent;
import android.graphics.*;
import android.net.Uri;
import android.os.Build;
import com.facebook.react.bridge.*;
import java.io.*;
import java.util.concurrent.ExecutorService;

/** System picker, no broad storage permission. Only a resized local copy is kept. */
final class ProfilePhoto extends BaseActivityEventListener {
 private static final int REQUEST=7202;
 private final ReactApplicationContext context;private final ExecutorService executor;
 private Promise pending;
 ProfilePhoto(ReactApplicationContext c,ExecutorService e){context=c;executor=e;c.addActivityEventListener(this);}
 void choose(Activity activity,Promise p){
  if(pending!=null){p.reject("PHOTO","Photo picker already open");return;}
  if(activity==null){p.reject("PHOTO","Open Talk2 first");return;}
  pending=p;
  try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);activity.startActivityForResult(i,REQUEST);}
  catch(Exception e){pending=null;p.reject("PHOTO",e);}
 }
 @Override public void onActivityResult(Activity activity,int request,int result,Intent data){
  if(request!=REQUEST||pending==null)return;Promise p=pending;pending=null;
  if(result!=Activity.RESULT_OK||data==null||data.getData()==null){p.resolve(null);return;}
  Uri uri=data.getData();executor.execute(()->{Bitmap source=null,scaled=null;try{
   if(Build.VERSION.SDK_INT>=28){source=ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.getContentResolver(),uri),(decoder,info,s)->{decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);int w=info.getSize().getWidth(),h=info.getSize().getHeight();float ratio=Math.min(1f,512f/Math.max(w,h));decoder.setTargetSize(Math.max(1,(int)(w*ratio)),Math.max(1,(int)(h*ratio)));});}
   else{BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;try(InputStream in=context.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,o);}o.inSampleSize=Math.max(1,Math.max(o.outWidth,o.outHeight)/512);o.inJustDecodeBounds=false;try(InputStream in=context.getContentResolver().openInputStream(uri)){source=BitmapFactory.decodeStream(in,null,o);}}
   if(source==null)throw new IOException("Unsupported image");float ratio=Math.min(1f,256f/Math.max(source.getWidth(),source.getHeight()));scaled=Bitmap.createScaledBitmap(source,Math.max(1,(int)(source.getWidth()*ratio)),Math.max(1,(int)(source.getHeight()*ratio)),true);
   File f=new File(context.getFilesDir(),"profile.jpg");try(FileOutputStream out=new FileOutputStream(f)){if(!scaled.compress(Bitmap.CompressFormat.JPEG,85,out))throw new IOException("Cannot save photo");}
   p.resolve(Uri.fromFile(f).toString()+"?v="+System.currentTimeMillis());
  }catch(Exception e){p.reject("PHOTO",e);}finally{if(scaled!=null&&scaled!=source)scaled.recycle();if(source!=null)source.recycle();}});
 }
 void close(){context.removeActivityEventListener(this);if(pending!=null){pending.reject("PHOTO","Photo picker closed");pending=null;}}
}
