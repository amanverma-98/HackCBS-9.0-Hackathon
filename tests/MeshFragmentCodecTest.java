package com.talk2;

import java.util.*;

public final class MeshFragmentCodecTest {
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 private static void roundTrip(int mtu)throws Exception{
  byte[] source=new byte[7000];new Random(23).nextBytes(source);
  List<byte[]> frames=MeshFragmentCodec.fragment(source,mtu);
  for(byte[] bytes:frames)check(bytes.length<=mtu-3,"fragment fits ATT MTU");
  MeshFragmentCodec.Assembly a=null;
  for(int i=frames.size()-1;i>=0;i--){MeshFragmentCodec.Frame frame=MeshFragmentCodec.parse(frames.get(i));if(a==null)a=new MeshFragmentCodec.Assembly(frame);check(a.add(frame),"fragment accepted");}
  check(a.complete(),"all fragments received");check(Arrays.equals(source,a.finish()),"reassembled payload matches");
 }
 public static void main(String[] args)throws Exception{
  roundTrip(23);roundTrip(185);
  byte[] shortFrame=MeshFragmentCodec.fragment(new byte[]{1,2,3},23).get(0);
  MeshFragmentCodec.Frame f=MeshFragmentCodec.parse(shortFrame);MeshFragmentCodec.Assembly a=new MeshFragmentCodec.Assembly(f);
  check(a.add(f),"first fragment accepted");check(a.add(f),"identical duplicate ignored");
  byte[] altered=shortFrame.clone();altered[altered.length-1]^=1;
  check(!a.add(MeshFragmentCodec.parse(altered)),"conflicting duplicate rejected");
  boolean rejected=false;try{MeshFragmentCodec.parse(new byte[8]);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"invalid header rejected");
  System.out.println("MeshFragmentCodecTest PASS");
 }
}
