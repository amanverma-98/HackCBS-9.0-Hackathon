package com.talk2;
import android.bluetooth.*;
import android.content.*;
import android.net.wifi.p2p.*;
import android.net.wifi.p2p.nsd.*;
import android.os.*;
import android.util.Log;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
/** Discovery covers both radios. A session uses one authenticated point-to-point link. */
public final class PeerRadio {
 interface Events{void event(String type,JSONObject data);}
 private final Context context;private final Events events;private final ExecutorService io=Executors.newCachedThreadPool();private final ScheduledExecutorService timer=Executors.newSingleThreadScheduledExecutor();
 private final WifiP2pManager wifi;private final WifiP2pManager.Channel channel;private final BluetoothAdapter bluetooth;
 private ServerSocket tcpServer;private BluetoothServerSocket btServer;private Socket pendingTcp;private BluetoothSocket pendingBt;private volatile Session session;private volatile boolean connecting;private volatile long generation;
 private WifiP2pDnsSdServiceRequest wifiServiceRequest;private BluetoothServerSocket discoveryBtServer;
 private final Set<String> discovered=Collections.synchronizedSet(new HashSet<>());
 /** Phones seen during the current Bluetooth scan; SDP runs after inquiry ends because it is unreliable while scanning. */
 private final Map<String,BluetoothDevice> btFound=new ConcurrentHashMap<>();private final Set<String> btVerified=Collections.synchronizedSet(new HashSet<>());
 private static final UUID SERVICE=UUID.fromString("3218ca90-2a22-4c40-bb66-9b15c5558210");
 /** Some Bluetooth stacks report SDP UUIDs with their bytes reversed. */
 private static final UUID SERVICE_REVERSED=reversed(SERVICE);
 private static UUID reversed(UUID u){java.nio.ByteBuffer in=java.nio.ByteBuffer.allocate(16).putLong(u.getMostSignificantBits()).putLong(u.getLeastSignificantBits());byte[] b=in.array(),r=new byte[16];for(int i=0;i<16;i++)r[i]=b[15-i];java.nio.ByteBuffer out=java.nio.ByteBuffer.wrap(r);return new UUID(out.getLong(),out.getLong());}
 private static boolean isTalk2(Parcelable value){String v=value.toString();return SERVICE.toString().equalsIgnoreCase(v)||SERVICE_REVERSED.toString().equalsIgnoreCase(v);}
 /**
  * Auto-reconnect state. {role, transport, address} of the link being formed and of the last
  * operator-confirmed link. A dropped confirmed link is retried; the new session re-confirms
  * itself by proving the earlier session's resume secret, so no code has to be compared again.
  */
 private volatile String[] attempt=new String[3],link;private volatile byte[] trusted;
 private volatile boolean reconnecting;private volatile int attempts;private volatile long epoch;
 private static final int MAX_ATTEMPTS=12;
 static final class Session implements Closeable{
  final DataInputStream in;final DataOutputStream out;final SecureChannel crypto;volatile boolean local,remote;volatile long lastRead=System.currentTimeMillis();
  Session(InputStream i,OutputStream o)throws Exception{in=new DataInputStream(i);out=new DataOutputStream(o);crypto=new SecureChannel();}
  synchronized void write(String text)throws Exception{byte[] b=crypto.encrypt(text.getBytes("UTF-8"));out.writeInt(b.length);out.write(b);out.flush();}
  public void close(){try{in.close();}catch(Exception ignored){}try{out.close();}catch(Exception ignored){}}
 }
 PeerRadio(Context c,Events e){context=c;events=e;wifi=(WifiP2pManager)c.getSystemService(Context.WIFI_P2P_SERVICE);channel=wifi==null?null:wifi.initialize(c,Looper.getMainLooper(),null);BluetoothManager bm=(BluetoothManager)c.getSystemService(Context.BLUETOOTH_SERVICE);bluetooth=bm==null?null:bm.getAdapter();
  IntentFilter f=new IntentFilter();f.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);f.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);f.addAction(BluetoothDevice.ACTION_FOUND);f.addAction(BluetoothDevice.ACTION_UUID);f.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
  if(Build.VERSION.SDK_INT>=33)c.registerReceiver(receiver,f,Context.RECEIVER_EXPORTED);else c.registerReceiver(receiver,f);
  // Heartbeat writes go through io: a stalled socket must never block the timer that drives reconnects.
  timer.scheduleAtFixedRate(()->{Session s=session;long g=generation;if(s!=null&&s.local&&s.remote){if(System.currentTimeMillis()-s.lastRead>30000){lost(g,new IOException("Peer stopped responding"));return;}io.execute(()->{try{s.write("HEARTBEAT");}catch(Exception ex){lost(g,ex);}});}},8,8,TimeUnit.SECONDS);
 }
 private void emit(String type,JSONObject data){if(!type.equals("peer")&&!type.equals("message"))Log.i("Talk2Radio",type+" "+(type.equals("pairing")?"":data.toString()));try{events.event(type,data);}catch(Exception ignored){}}
 private void emit(String type,String key,String value){try{emit(type,new JSONObject().put(key,value));}catch(Exception ignored){}}
 private static String reason(Exception ex){return ex==null?null:ex.getMessage()==null?ex.toString():ex.getMessage();}
 private void lost(long g,Exception ex){
  if(g!=generation)return;Session s=session;boolean live=s!=null&&s.local&&s.remote;disconnect();
  if(link!=null&&trusted!=null){if(live)try{emit("disconnected",new JSONObject().put("state","Reconnecting").put("reconnecting",true).put("reason",reason(ex)));}catch(Exception ignored){}scheduleReconnect();return;}
  emit("disconnected","state","Offline");if(ex!=null)emit("error","message",reason(ex));
 }
 private void scheduleReconnect(){
  if(link==null)return;reconnecting=true;if(++attempts>MAX_ATTEMPTS){giveUp();return;}
  long my=++epoch;String[] l=link;long delay=Math.min(8000,1000L*attempts);
  try{emit("reconnecting",new JSONObject().put("attempt",attempts).put("max",MAX_ATTEMPTS).put("transport",l[1]));}catch(Exception ignored){}
  timer.schedule(()->{if(my!=epoch||!reconnecting)return;
   try{if(l[0].equals("host"))hostLink(l[1]);else joinLink(l[1],l[2]);}catch(Exception e){Log.w("Talk2Radio","reconnect attempt failed",e);}
   // A host just listens, so a silent attempt also needs a deadline.
   timer.schedule(()->{if(my==epoch&&reconnecting&&session==null){disconnect();scheduleReconnect();}},15,TimeUnit.SECONDS);
  },delay,TimeUnit.MILLISECONDS);
 }
 private void giveUp(){reconnecting=false;attempts=0;link=null;epoch++;disconnect();emit("disconnected","state","Offline");emit("error","message","Lost the connection. Open Connect to join again.");}
 private void cancelReconnect(){reconnecting=false;attempts=0;epoch++;}
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent intent){try{
  if(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(intent.getAction()))wifi.requestPeers(channel,list->{});
  else if(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(intent.getAction()))wifi.requestConnectionInfo(channel,info->{if(info.groupFormed&&!connecting&&session==null){connecting=true;if(info.isGroupOwner){attempt=new String[]{"host","wifi",null};hostTcp();}else{if(!"join".equals(attempt[0])||!"wifi".equals(attempt[1]))attempt=new String[]{"join","wifi",null};joinTcp(info.groupOwnerAddress.getHostAddress());}}});
  else if(BluetoothDevice.ACTION_FOUND.equals(intent.getAction())){BluetoothDevice d=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);BluetoothClass type=intent.getParcelableExtra(BluetoothDevice.EXTRA_CLASS);
   if(d!=null&&(type==null||type.getMajorDeviceClass()==BluetoothClass.Device.Major.PHONE)){btFound.put(d.getAddress(),d);if(d.getName()!=null)peer("bluetooth",d.getAddress(),d.getName(),false);}}
  else if(BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(intent.getAction())){for(BluetoothDevice d:btFound.values())if(!btVerified.contains(d.getAddress()))d.fetchUuidsWithSdp();emit("scanFinished","transport","bluetooth");}
  else if(BluetoothDevice.ACTION_UUID.equals(intent.getAction())){BluetoothDevice d=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);Parcelable[] uuids=intent.getParcelableArrayExtra(BluetoothDevice.EXTRA_UUID);if(d!=null&&uuids!=null)for(Parcelable value:uuids)if(isTalk2(value)){btVerified.add(d.getAddress());peer("bluetooth",d.getAddress(),d.getName(),true);break;}}
 }catch(Exception ex){emit("error","message",ex.toString());}}};
 private void peer(String transport,String id,String name,boolean verified){try{if(discovered.add(transport+id+verified))emit("peer",new JSONObject().put("transport",transport).put("id",id).put("name",name==null?id:name).put("verified",verified));}catch(Exception ignored){}}
 private WifiP2pManager.ActionListener action(){return new WifiP2pManager.ActionListener(){public void onSuccess(){emit("status","state",reconnecting?"Reconnecting…":"Waiting for peer");}public void onFailure(int reason){if(reconnecting)return;emit("error","message","Wi-Fi Direct failed ("+reason+"). Check Wi-Fi, Location and Nearby devices permissions.");}};}
 private void advertiseWifiService()throws Exception{if(wifi==null)throw new IOException("Wi-Fi Direct unavailable");Map<String,String> record=new HashMap<>();record.put("talk2","1");wifi.addLocalService(channel,WifiP2pDnsSdServiceInfo.newInstance("Talk2","_talk2._tcp",record),null);}
 private void discoverWifiServices()throws Exception{advertiseWifiService();wifi.setDnsSdResponseListeners(channel,(instance,registrationType,device)->peer("wifi",device.deviceAddress,device.deviceName==null||device.deviceName.isEmpty()?instance:device.deviceName,true),(fullDomain,txtRecord,device)->{});wifi.clearServiceRequests(channel,null);wifiServiceRequest=WifiP2pDnsSdServiceRequest.newInstance("_talk2._tcp");wifi.addServiceRequest(channel,wifiServiceRequest,new WifiP2pManager.ActionListener(){public void onSuccess(){wifi.discoverServices(channel,null);}public void onFailure(int reason){emit("error","message","Talk2 Wi-Fi discovery failed ("+reason+").");}});}
 /**
  * Insecure RFCOMM avoids Android's system bonding dialog. Confidentiality and peer
  * verification come from SecureChannel's key agreement plus the on-screen pairing code.
  */
 private BluetoothServerSocket listenBluetooth()throws Exception{if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Turn on Bluetooth first");return bluetooth.listenUsingInsecureRfcommWithServiceRecord("Talk2",SERVICE);}
 /** Accepts the first incoming phone; a scanning phone listens too, so either side can tap the other. */
 private void acceptBluetooth(BluetoothServerSocket listener,long g){io.execute(()->{try{BluetoothSocket socket=listener.accept();if(g!=generation||session!=null){socket.close();return;}pendingBt=socket;bluetooth.cancelDiscovery();attempt=new String[]{"host","bluetooth",socket.getRemoteDevice().getAddress()};emit("status","state","Phone connecting…");open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});}
 private boolean live(){Session s=session;return s!=null&&s.local&&s.remote;}
 private void discoverBluetoothServices()throws Exception{if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Turn on Bluetooth first");if(discoveryBtServer==null&&btServer==null){discoveryBtServer=listenBluetooth();acceptBluetooth(discoveryBtServer,generation);}
  btFound.clear();btVerified.clear();for(BluetoothDevice d:bluetooth.getBondedDevices())d.fetchUuidsWithSdp();if(bluetooth.isDiscovering())bluetooth.cancelDiscovery();if(!bluetooth.startDiscovery())throw new IOException("Bluetooth scan could not start. Turn Location on and allow Nearby devices.");}
 /** Scanning interrupts an active Bluetooth link, so it is refused while connected. */
 void discover(String transport)throws Exception{if(live())throw new IOException("Already connected. Disconnect first to find other phones.");cancelReconnect();link=null;discovered.clear();if(!transport.equals("bluetooth")){discoverWifiServices();wifi.discoverPeers(channel,action());}if(!transport.equals("wifi"))discoverBluetoothServices();}
 /** Starting a new link replaces any session; tell the UI so it never shows a stale connection. */
 private void replaceLink(){boolean had=session!=null;disconnect();if(had&&!reconnecting)emit("disconnected","state","Offline");}
 void host(String transport)throws Exception{cancelReconnect();link=null;hostLink(transport);}
 private void hostLink(String transport)throws Exception{replaceLink();attempt=new String[]{"host",transport,null};if(transport.equals("wifi")){advertiseWifiService();wifi.requestConnectionInfo(channel,info->{if(info.groupFormed&&info.isGroupOwner){connecting=true;hostTcp();}else wifi.createGroup(channel,action());});}else{
  btServer=listenBluetooth();acceptBluetooth(btServer,generation);emit("status","state",reconnecting?"Reconnecting…":"Waiting for peer");
 }}
 void join(String transport,String address)throws Exception{String[] a=attempt;if(live()&&transport.equals(a[1])&&address.equalsIgnoreCase(String.valueOf(a[2])))return;cancelReconnect();link=null;joinLink(transport,address);}
 private void joinLink(String transport,String address)throws Exception{replaceLink();long g=generation;attempt=new String[]{"join",transport,address};if(transport.equals("wifi")){if(wifi==null)throw new IOException("Wi-Fi Direct unavailable");WifiP2pConfig config=new WifiP2pConfig();config.deviceAddress=address;wifi.connect(channel,config,action());}else{
  if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Turn on Bluetooth first");bluetooth.cancelDiscovery();BluetoothSocket socket=bluetooth.getRemoteDevice(address).createInsecureRfcommSocketToServiceRecord(SERVICE);pendingBt=socket;
  io.execute(()->{try{socket.connect();open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,new IOException("Could not reach that phone. Keep Talk2's Connect screen open on it (tap Find or Host there), then try again."));}});
 }}
 private void hostTcp(){long g=generation;io.execute(()->{try{tcpServer=new ServerSocket(47773);tcpServer.setReuseAddress(true);Socket socket=tcpServer.accept();if(g!=generation){socket.close();return;}pendingTcp=socket;open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});}
 private void joinTcp(String address){long g=generation;io.execute(()->{try{Socket socket=new Socket();pendingTcp=socket;socket.connect(new InetSocketAddress(address,47773),15000);if(g!=generation){socket.close();return;}open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});}
 private void open(InputStream input,OutputStream output,long g)throws Exception{
  if(g!=generation)return;Session s=new Session(input,output);session=s;
  timer.schedule(()->{if(g==generation&&(!s.local||!s.remote))lost(g,new IOException("Pairing timed out. Both phones must tap Codes match."));},60,TimeUnit.SECONDS);
  try{
   s.out.writeInt(0x54325031);byte[] key=s.crypto.publicKey();s.out.writeInt(key.length);s.out.write(key);s.out.flush();
   if(s.in.readInt()!=0x54325031)throw new IOException("Not a Talk2 peer");int size=s.in.readInt();if(size<32||size>256)throw new IOException("Invalid handshake");byte[] peer=new byte[size];s.in.readFully(peer);String sas=s.crypto.accept(peer);
   byte[] trust=trusted;emit("pairing",new JSONObject().put("code",sas).put("resuming",trust!=null));
   if(trust!=null)s.write("RESUME:"+s.crypto.resumeProof(trust,true));
   while(g==generation){int length=s.in.readInt();if(length<28||length>32800)throw new IOException("Invalid frame size");byte[] frame=new byte[length];s.in.readFully(frame);String text=new String(s.crypto.decrypt(frame),"UTF-8");s.lastRead=System.currentTimeMillis();if(text.equals("HEARTBEAT"))continue;
    if(text.equals("PAIR_CONFIRMED")){s.remote=true;if(s.local)confirmed(s);}
    else if(text.startsWith("RESUME:")){if(trust!=null&&!s.local&&s.crypto.checkResume(trust,text.substring(7))){s.write("PAIR_CONFIRMED");s.local=true;if(s.remote)confirmed(s);}}
    else if(text.equals("BYE")){trusted=null;link=null;cancelReconnect();throw new IOException("The other phone disconnected");}
    else if(s.local&&s.remote)events.event("message",new JSONObject(text));
   }
  }finally{s.close();if(g==generation)lost(g,null);}
 }
 /** Both operators confirmed (directly or via resume proof): remember the link so a drop can be repaired. */
 private void confirmed(Session s){trusted=s.crypto.resumeSecret();link=attempt.clone();boolean resumed=reconnecting;cancelReconnect();try{emit("connected",new JSONObject().put("state","Paired").put("resumed",resumed).put("transport",link[1]));}catch(Exception ignored){}}
 void confirm()throws Exception{Session s=session;if(s==null)throw new IOException("No pending pairing");s.write("PAIR_CONFIRMED");s.local=true;if(s.remote)confirmed(s);}
 void send(String text)throws Exception{Session s=session;if(s==null||!s.local||!s.remote)throw new IOException(reconnecting?"Reconnecting to your peer. The message is saved; retry in a moment.":"Both phones must confirm the same pairing code");s.write(text);}
 /** Tells the peer this is a deliberate disconnect so it does not try to reconnect. */
 void goodbye(){Session s=session;if(s!=null&&s.local&&s.remote)try{s.write("BYE");}catch(Exception ignored){}}
 void disconnect(){generation++;connecting=false;Session s=session;session=null;for(Closeable c:new Closeable[]{s,pendingTcp,tcpServer,pendingBt,btServer,discoveryBtServer})if(c!=null)try{c.close();}catch(Exception ignored){}pendingTcp=null;tcpServer=null;pendingBt=null;btServer=null;discoveryBtServer=null;}
 void close(){cancelReconnect();link=null;trusted=null;disconnect();try{context.unregisterReceiver(receiver);}catch(Exception ignored){}try{if(wifi!=null){wifi.stopPeerDiscovery(channel,null);wifi.removeGroup(channel,null);}if(bluetooth!=null)bluetooth.cancelDiscovery();}catch(Exception ignored){}io.shutdownNow();timer.shutdownNow();}
}
