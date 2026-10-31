package com.talk2;

import java.nio.ByteBuffer;
import java.util.*;

/** MTU-aware bounded framing that works with the default 23-byte BLE ATT MTU. */
final class MeshFragmentCodec {
 static final int HEADER=7,MAX_CHUNK=160,MAX_FRAME=MeshPacket.MAX_BYTES+128,MAX_PARTS=(MAX_FRAME+13-1)/13;
 static final class Frame {final int total,index,count,unit;final byte[] payload;Frame(int t,int i,int c,int u,byte[] p){total=t;index=i;count=c;unit=u;payload=p;}}
 static final class Assembly {
  private final int total,unit;private final byte[][] parts;private int received;
  Assembly(Frame first){total=first.total;unit=first.unit;parts=new byte[first.count][];}
  boolean add(Frame f){if(f.total!=total||f.unit!=unit||f.count!=parts.length)return false;byte[] old=parts[f.index];if(old!=null)return Arrays.equals(old,f.payload);parts[f.index]=f.payload;received++;return true;}
  boolean complete(){return received==parts.length;}
  byte[] finish(){if(!complete())throw new IllegalStateException("Mesh fragments incomplete");ByteBuffer out=ByteBuffer.allocate(total);for(byte[] p:parts)out.put(p);return out.array();}
 }
 private MeshFragmentCodec(){}
 static List<byte[]> fragment(byte[] bytes,int mtu){if(bytes==null||bytes.length<1||bytes.length>MAX_FRAME)throw new IllegalArgumentException("Mesh frame size invalid");int unit=Math.max(1,Math.min(MAX_CHUNK,mtu-3-HEADER)),count=(bytes.length+unit-1)/unit;if(count>MAX_PARTS)throw new IllegalArgumentException("Too many mesh fragments");List<byte[]> out=new ArrayList<>(count);for(int i=0;i<count;i++){byte[] payload=Arrays.copyOfRange(bytes,i*unit,Math.min(bytes.length,(i+1)*unit));out.add(ByteBuffer.allocate(HEADER+payload.length).putShort((short)bytes.length).putShort((short)i).putShort((short)count).put((byte)unit).put(payload).array());}return out;}
 static Frame parse(byte[] bytes){if(bytes==null||bytes.length<=HEADER||bytes.length>MAX_CHUNK+HEADER)throw new IllegalArgumentException("Mesh fragment size invalid");ByteBuffer b=ByteBuffer.wrap(bytes);int total=b.getShort()&65535,index=b.getShort()&65535,count=b.getShort()&65535,unit=b.get()&255;int payloadSize=b.remaining();if(total<1||total>MAX_FRAME||unit<1||unit>MAX_CHUNK||count<1||count>MAX_PARTS||index>=count||count!=(total+unit-1)/unit||payloadSize!=(index==count-1?total-unit*(count-1):unit))throw new IllegalArgumentException("Mesh fragment header invalid");byte[] payload=new byte[payloadSize];b.get(payload);return new Frame(total,index,count,unit,payload);}
}
