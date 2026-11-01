package com.talk2;

import android.content.Context;
import android.media.*;
import android.os.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Synthesised alert sounds: a soft chime for new messages and a siren for SOS. */
final class Sounds {
 private Sounds(){}
 private static final int RATE=22050;
 private static final AtomicBoolean SIREN=new AtomicBoolean();

 /** Two gentle notes (A5 then E6) with a short weak vibration, for an ordinary incoming message. */
 static void messageCue(Context c,boolean sound,boolean vibrate){
  if(vibrate)vibrate(c,new long[]{0,35},new int[]{0,70});
  if(sound)new Thread(()->{short[] a=notes(new double[]{880,1318.5},0.11,0.18);play(a,AudioAttributes.USAGE_NOTIFICATION_EVENT);},"Talk2-chime").start();
 }

 /** Rising and falling siren on the alarm stream (plays even when media is muted) with a strong vibration. */
 static void sosSiren(Context c){
  vibrate(c,new long[]{0,600,200,600,200,600},new int[]{0,255,0,255,0,255});
  if(!SIREN.compareAndSet(false,true))return;
  new Thread(()->{try{play(siren(6.0),AudioAttributes.USAGE_ALARM);}finally{SIREN.set(false);}},"Talk2-siren").start();
 }

 private static short[] notes(double[] freqs,double seconds,double volume){
  int n=(int)(RATE*seconds);short[] out=new short[n*freqs.length];
  for(int k=0;k<freqs.length;k++)for(int i=0;i<n;i++){
   double t=(double)i/RATE,env=Math.min(1,i/(RATE*0.01))*Math.exp(-4.0*i/n); // soft attack, smooth decay
   out[k*n+i]=(short)(Math.sin(2*Math.PI*freqs[k]*t)*env*volume*32767);
  }
  return out;
 }
 private static short[] siren(double seconds){
  int n=(int)(RATE*seconds);short[] out=new short[n];double phase=0;
  for(int i=0;i<n;i++){
   double t=(double)i/RATE,f=650+550*(0.5-0.5*Math.cos(2*Math.PI*t/1.8)); // 650 -> 1200 Hz wail every 1.8 s
   phase+=2*Math.PI*f/RATE;double edge=Math.min(1,Math.min(i,n-i)/(RATE*0.05));
   out[i]=(short)(Math.sin(phase)*0.85*edge*32767);
  }
  return out;
 }
 private static void play(short[] pcm,int usage){
  AudioTrack t=null;
  try{
   AudioAttributes attrs=new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
   AudioFormat fmt=new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
   t=new AudioTrack(attrs,fmt,pcm.length*2,AudioTrack.MODE_STATIC,AudioManager.AUDIO_SESSION_ID_GENERATE);
   t.write(pcm,0,pcm.length);t.play();Thread.sleep(pcm.length*1000L/RATE+80);
  }catch(Exception ignored){}finally{if(t!=null)try{t.stop();t.release();}catch(Exception ignored){}}
 }
 private static void vibrate(Context c,long[] timings,int[] amplitudes){
  try{
   Vibrator v=Build.VERSION.SDK_INT>=31?((VibratorManager)c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator():(Vibrator)c.getSystemService(Context.VIBRATOR_SERVICE);
   if(v==null||!v.hasVibrator())return;
   if(Build.VERSION.SDK_INT>=26)v.vibrate(v.hasAmplitudeControl()?VibrationEffect.createWaveform(timings,amplitudes,-1):VibrationEffect.createWaveform(timings,-1));else v.vibrate(timings,-1);
  }catch(Exception ignored){}
 }
}
