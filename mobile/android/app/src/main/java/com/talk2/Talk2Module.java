package com.talk2;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.content.*;
import android.hardware.*;
import android.location.*;
import android.os.*;
import android.bluetooth.BluetoothAdapter;
import android.media.*;
import org.json.*;
import java.util.concurrent.*;
public final class Talk2Module extends ReactContextBaseJavaModule implements SensorEventListener,LocationListener,LifecycleEventListener{
 private final ReactApplicationContext ctx;private final ModelStore models;private final SpeechEngine speech;private final TranslationEngine translator;private PeerRadio radio;
 private final ExecutorService jobs=Executors.newSingleThreadExecutor(),downloads=Executors.newSingleThreadExecutor(),network=Executors.newSingleThreadExecutor();
 private final VoiceTransfer voice;private final ProfilePhoto photo;
 private final SensorManager sensors;private final LocationManager locations;private Location lastLocation;private long lastHeading;private boolean observing;
 public Talk2Module(ReactApplicationContext c){super(c);ctx=c;models=new ModelStore(c);speech=new SpeechEngine(models);translator=new TranslationEngine(models);voice=new VoiceTransfer(new java.io.File(c.getFilesDir(),"voice"));photo=new ProfilePhoto(c,jobs);sensors=(SensorManager)c.getSystemService(Context.SENSOR_SERVICE);locations=(LocationManager)c.getSystemService(Context.LOCATION_SERVICE);c.addLifecycleEventListener(this);}
 @Override public String getName(){return "Talk2Native";}
 private interface Work{Object run()throws Exception;}
 private void task(ExecutorService e,Promise p,Work w){e.execute(()->{try{p.resolve(w.run());}catch(OutOfMemoryError ex){p.reject("MEMORY","Not enough memory for this model. Close other apps or use Original voice.");}catch(Exception ex){android.util.Log.w("Talk2Native","Device operation failed",ex);p.reject("TALK2",ex.getMessage(),ex);}});}
 private void emit(String type,JSONObject data){try{data.put("type",type);ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("Talk2Event",data.toString());}catch(Exception ignored){}}
 private JSONObject downloadProgress(String manifest,String pack,String file,long done,long fileTotal){long offset=0,total=0;try{JSONArray files=new JSONObject(manifest).getJSONObject("packs").getJSONObject(pack).getJSONArray("files");for(int i=0;i<files.length();i++){JSONObject f=files.getJSONObject(i);long bytes=f.getLong("bytes");total+=bytes;if(f.getString("name").equals(file))offset=total-bytes;}}catch(Exception ignored){total=fileTotal;}try{return new JSONObject().put("pack",pack).put("file",file).put("done",offset+done).put("total",total);}catch(Exception ignored){return new JSONObject();}}
 private PeerRadio radio(){if(radio==null)radio=new PeerRadio(ctx,(type,data)->{
  if(type.equals("disconnected"))voice.reset();
  if(type.equals("message")&&data.optString("kind").startsWith("voice-")){try{JSONObject complete=voice.accept(data);if(complete!=null)emit("message",complete);}catch(Exception e){try{emit("voiceError",new JSONObject().put("message",e.getMessage()));}catch(Exception ignored){}}}
  else emit(type,data);
 });return radio;}
 @ReactMethod public void addListener(String name){}
 @ReactMethod public void removeListeners(double count){}
 @ReactMethod public void loadState(Promise p){p.resolve(ctx.getSharedPreferences("talk2",0).getString("state","{}"));}
 @ReactMethod public void saveState(String state,Promise p){task(jobs,p,()->{new JSONObject(state);if(state.length()>2000000)throw new Exception("History capacity reached");if(!ctx.getSharedPreferences("talk2",0).edit().putString("state",state).commit())throw new Exception("Storage write failed");return true;});}
 @ReactMethod public void packStatus(String manifest,Promise p){task(downloads,p,()->{JSONObject packs=new JSONObject(new JSONObject(manifest).optString("packs","{}")),result=new JSONObject();for(String code:new String[]{"hi","ta","bn","gu","mr","kn","ml","te","or","en","translation"}){JSONObject spec=packs.optJSONObject(code);boolean installed=false;long partial=0,total=0;try{installed=models.ready(code);if(spec!=null){partial=models.partialBytes(code,spec);JSONArray files=spec.optJSONArray("files");if(files!=null)for(int i=0;i<files.length();i++)total+=files.getJSONObject(i).optLong("bytes");}}catch(Exception ignored){}result.put(code,new JSONObject().put("available",spec!=null).put("installed",installed).put("partialBytes",partial).put("expectedBytes",total));}return result.toString();});}
 @ReactMethod public void installPack(String code,String manifest,Promise p){task(downloads,p,()->{models.install(code,new JSONObject(manifest),(pack,file,done,total)->emit("download",downloadProgress(manifest,pack,file,done,total)));return true;});}
 @ReactMethod public void cancelDownload(){models.cancel();}
 @ReactMethod public void removePack(String code,Promise p){task(downloads,p,()->{models.remove(code);return true;});}
 @ReactMethod public void startRecording(Promise p){task(jobs,p,()->{speech.start();return true;});}
 @ReactMethod public void cancelRecording(Promise p){task(jobs,p,()->{speech.close();return true;});}
 @ReactMethod public void finishVoice(Promise p){task(jobs,p,()->voice.save(speech.stop()));}
 @ReactMethod public void sendVoice(String uri,String metadata,Promise p){task(network,p,()->{voice.send(uri,new JSONObject(metadata),text->radio().send(text));return true;});}
 @ReactMethod public void playVoice(String uri,Promise p){task(jobs,p,()->{byte[] pcm=voice.read(uri);int min=AudioTrack.getMinBufferSize(16000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);AudioTrack player=new AudioTrack(AudioManager.STREAM_MUSIC,16000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(min,8192),AudioTrack.MODE_STREAM);try{player.play();int offset=0;while(offset<pcm.length){int n=player.write(pcm,offset,Math.min(8192,pcm.length-offset));if(n<=0)throw new Exception("Voice playback failed");offset+=n;}long until=System.currentTimeMillis()+pcm.length/32+2000;while(player.getPlaybackHeadPosition()<pcm.length/2&&System.currentTimeMillis()<until)Thread.sleep(20);}finally{player.stop();player.release();}return true;});}
 @ReactMethod public void clearVoiceHistory(Promise p){task(jobs,p,()->{voice.clear();return true;});}
 @ReactMethod public void chooseProfilePhoto(Promise p){new Handler(Looper.getMainLooper()).post(()->photo.choose(getCurrentActivity(),p));}
 @ReactMethod public void stopRecording(String language,Promise p){task(jobs,p,()->{long start=System.nanoTime();byte[] pcm=speech.stop();String text=speech.transcribe(pcm,language);emit("metric",new JSONObject().put("sttMs",(System.nanoTime()-start)/1000000).put("audioMs",pcm.length/32));return text;});}
 @ReactMethod public void speak(String text,String language,Promise p){task(jobs,p,()->{long start=System.nanoTime();speech.speak(text,language);emit("metric",new JSONObject().put("ttsMs",(System.nanoTime()-start)/1000000));return true;});}
 @ReactMethod public void translate(String text,String source,String target,Promise p){task(jobs,p,()->translator.translate(text,source,target));}
 @ReactMethod public void discover(String transport,Promise p){task(network,p,()->{radio().discover(transport);return true;});}
 @ReactMethod public void host(String transport,Promise p){task(network,p,()->{radio().host(transport);return true;});}
 @ReactMethod public void join(String transport,String address,Promise p){task(network,p,()->{radio().join(transport,address);return true;});}
 @ReactMethod public void confirmPairing(Promise p){task(network,p,()->{radio().confirm();return true;});}
 @ReactMethod public void send(String text,Promise p){task(network,p,()->{radio().send(text);return true;});}
 @ReactMethod public void disconnect(Promise p){task(network,p,()->{if(radio!=null){radio.close();radio=null;}return true;});}
 @ReactMethod public void bluetoothDiscoverable(Promise p){try{Intent i=new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);i.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION,120);if(getCurrentActivity()==null)throw new Exception("Open the app first");getCurrentActivity().startActivity(i);p.resolve(true);}catch(Exception e){p.reject("BLUETOOTH",e);}}
 @ReactMethod public void startSensors(Promise p){new Handler(Looper.getMainLooper()).post(()->{try{if(!observing){Sensor s=sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);if(s!=null)sensors.registerListener(this,s,SensorManager.SENSOR_DELAY_UI);else emit("sensorStatus",new JSONObject().put("message","No compass sensor; north-up radar"));boolean provider=false;for(String name:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER})if(locations.isProviderEnabled(name)){locations.requestLocationUpdates(name,2000,0,this);provider=true;}observing=true;if(!provider)emit("sensorStatus",new JSONObject().put("message","Enable Location in Android Settings"));}p.resolve(true);}catch(Exception e){sensors.unregisterListener(this);locations.removeUpdates(this);observing=false;p.reject("SENSORS",e);}});}
 @ReactMethod public void stopSensors(){sensors.unregisterListener(this);locations.removeUpdates(this);observing=false;}
 @ReactMethod public void vibrateForMessage(Promise p){try{Vibrator vibrator=(Vibrator)ctx.getSystemService(Context.VIBRATOR_SERVICE);if(vibrator==null||!vibrator.hasVibrator()){p.resolve(false);return;}if(Build.VERSION.SDK_INT>=26)vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,120,70,120},-1));else vibrator.vibrate(new long[]{0,120,70,120},-1);p.resolve(true);}catch(SecurityException e){p.resolve(false);}catch(Exception e){p.resolve(false);}}
 @ReactMethod public void feedback(String kind,Promise p){try{Vibrator v=Build.VERSION.SDK_INT>=31?((VibratorManager)ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator():(Vibrator)ctx.getSystemService(Context.VIBRATOR_SERVICE);if(v==null||!v.hasVibrator()){p.resolve(false);return;}long[] pattern=kind.equals("message")?new long[]{0,70,70,70}:kind.equals("error")?new long[]{0,100,60,100}:new long[]{0,35};if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createWaveform(pattern,-1),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).build());else v.vibrate(pattern,-1);p.resolve(true);}catch(Exception e){p.reject("FEEDBACK",e);}}
 @ReactMethod public void alertTone(){ToneGenerator t=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,70);t.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,1200);new Handler(Looper.getMainLooper()).postDelayed(t::release,1400);}
 @ReactMethod public void sirenTone(){ToneGenerator t=new ToneGenerator(AudioManager.STREAM_ALARM,100);t.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,1200);new Handler(Looper.getMainLooper()).postDelayed(t::release,1400);}
 @ReactMethod public void diagnostics(Promise p){try{android.app.ActivityManager am=(android.app.ActivityManager)ctx.getSystemService(Context.ACTIVITY_SERVICE);android.app.ActivityManager.MemoryInfo m=new android.app.ActivityManager.MemoryInfo();am.getMemoryInfo(m);p.resolve(new JSONObject().put("javaHeapBytes",Runtime.getRuntime().totalMemory()-Runtime.getRuntime().freeMemory()).put("availableSystemBytes",m.availMem).put("freeStorageBytes",ctx.getFilesDir().getUsableSpace()).toString());}catch(Exception e){p.reject("DIAGNOSTICS",e);}}
 @Override public void onSensorChanged(SensorEvent e){if(System.currentTimeMillis()-lastHeading<150)return;lastHeading=System.currentTimeMillis();float[] matrix=new float[9],orientation=new float[3];SensorManager.getRotationMatrixFromVector(matrix,e.values);SensorManager.getOrientation(matrix,orientation);double heading=(Math.toDegrees(orientation[0])+360)%360;if(lastLocation!=null){GeomagneticField f=new GeomagneticField((float)lastLocation.getLatitude(),(float)lastLocation.getLongitude(),(float)lastLocation.getAltitude(),System.currentTimeMillis());heading=(heading+f.getDeclination()+360)%360;}try{emit("heading",new JSONObject().put("degrees",heading).put("trueNorth",lastLocation!=null).put("accuracy",e.accuracy));}catch(Exception ignored){}}
 @Override public void onLocationChanged(Location l){if(lastLocation!=null&&l.getElapsedRealtimeNanos()<lastLocation.getElapsedRealtimeNanos())return;lastLocation=l;long age=Math.max(0,(SystemClock.elapsedRealtimeNanos()-l.getElapsedRealtimeNanos())/1000000);try{emit("location",new JSONObject().put("latitude",l.getLatitude()).put("longitude",l.getLongitude()).put("accuracy",l.getAccuracy()).put("provider",l.getProvider()).put("time",System.currentTimeMillis()-age));}catch(Exception ignored){}}
 @Override public void onAccuracyChanged(Sensor s,int accuracy){}
 @Override public void onProviderEnabled(String provider){try{emit("sensorStatus",new JSONObject().put("message","Location enabled; refresh radar to acquire a fix"));}catch(Exception ignored){}}
 @Override public void onProviderDisabled(String provider){try{emit("sensorStatus",new JSONObject().put("message","Enable GPS for peer bearings"));}catch(Exception ignored){}}
 @Override public void onStatusChanged(String provider,int status,Bundle extras){}
 @Override public void onHostResume(){}
 @Override public void onHostPause(){stopSensors();jobs.execute(speech::close);}
 @Override public void onHostDestroy(){stopSensors();speech.close();if(radio!=null)radio.close();}
 @Override public void invalidate(){onHostDestroy();photo.close();ctx.removeLifecycleEventListener(this);jobs.shutdownNow();downloads.shutdownNow();network.shutdownNow();super.invalidate();}
}
