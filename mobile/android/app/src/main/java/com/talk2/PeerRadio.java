package com.talk2;
import android.bluetooth.*;
import android.content.*;
import android.net.wifi.p2p.*;
import android.net.wifi.p2p.nsd.*;
import android.os.*;
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
 private static final UUID SERVICE=UUID.fromString("3218ca90-2a22-4c40-bb66-9b15c5558210");
 static final class Session implements Closeable{
  final DataInputStream in;final DataOutputStream out;final SecureChannel crypto;volatile boolean local,remote;volatile long lastRead=System.currentTimeMillis();
  Session(InputStream i,OutputStream o)throws Exception{in=new DataInputStream(i);out=new DataOutputStream(o);crypto=new SecureChannel();}
  synchronized void write(String text)throws Exception{byte[] b=crypto.encrypt(text.getBytes("UTF-8"));out.writeInt(b.length);out.write(b);out.flush();}
  public void close(){try{in.close();}catch(Exception ignored){}try{out.close();}catch(Exception ignored){}}
 }
 PeerRadio(Context c,Events e){context=c;events=e;wifi=(WifiP2pManager)c.getSystemService(Context.WIFI_P2P_SERVICE);channel=wifi==null?null:wifi.initialize(c,Looper.getMainLooper(),null);BluetoothManager bm=(BluetoothManager)c.getSystemService(Context.BLUETOOTH_SERVICE);bluetooth=bm==null?null:bm.getAdapter();
  IntentFilter f=new IntentFilter();f.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);f.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);f.addAction(BluetoothDevice.ACTION_FOUND);f.addAction(BluetoothDevice.ACTION_UUID);
  if(Build.VERSION.SDK_INT>=33)c.registerReceiver(receiver,f,Context.RECEIVER_EXPORTED);else c.registerReceiver(receiver,f);
  timer.scheduleAtFixedRate(()->{Session s=session;if(s!=null&&s.local&&s.remote){try{if(System.currentTimeMillis()-s.lastRead>45000)throw new IOException("Peer timed out");s.write("HEARTBEAT");}catch(Exception ex){lost(generation,ex);}}},10,10,TimeUnit.SECONDS);
 }
 private void emit(String type,String key,String value){try{events.event(type,new JSONObject().put(key,value));}catch(Exception ignored){}}
 private void lost(long g,Exception ex){if(g!=generation)return;disconnect();emit("disconnected","state","Offline");if(ex!=null)emit("error","message",ex.getMessage()==null?ex.toString():ex.getMessage());}
 private final BroadcastReceiver receiver=new BroadcastReceiver(){public void onReceive(Context c,Intent intent){try{
  if(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(intent.getAction()))wifi.requestPeers(channel,list->{});
  else if(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(intent.getAction()))wifi.requestConnectionInfo(channel,info->{if(info.groupFormed&&!connecting&&session==null){connecting=true;if(info.isGroupOwner)hostTcp();else joinTcp(info.groupOwnerAddress.getHostAddress());}});
  else if(BluetoothDevice.ACTION_FOUND.equals(intent.getAction())){BluetoothDevice d=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);if(d!=null)d.fetchUuidsWithSdp();}
  else if(BluetoothDevice.ACTION_UUID.equals(intent.getAction())){BluetoothDevice d=intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);Parcelable[] uuids=intent.getParcelableArrayExtra(BluetoothDevice.EXTRA_UUID);if(d!=null&&uuids!=null)for(Parcelable value:uuids)if(SERVICE.toString().equalsIgnoreCase(value.toString())){peer("bluetooth",d.getAddress(),d.getName());break;}}
 }catch(Exception ex){emit("error","message",ex.toString());}}};
 private void peer(String transport,String id,String name){try{if(discovered.add(transport+id))events.event("peer",new JSONObject().put("transport",transport).put("id",id).put("name",name==null?id:name));}catch(Exception ignored){}}
 private WifiP2pManager.ActionListener action(){return new WifiP2pManager.ActionListener(){public void onSuccess(){emit("status","state","Waiting for peer");}public void onFailure(int reason){emit("error","message","Wi-Fi Direct failed ("+reason+"). Check Wi-Fi, Location and Nearby devices permissions.");}};}
 private void advertiseWifiService()throws Exception{if(wifi==null)throw new IOException("Wi-Fi Direct unavailable");Map<String,String> record=new HashMap<>();record.put("talk2","1");wifi.addLocalService(channel,WifiP2pDnsSdServiceInfo.newInstance("Talk2","_talk2._tcp",record),null);}
 private void discoverWifiServices()throws Exception{advertiseWifiService();wifi.setDnsSdResponseListeners(channel,(instance,registrationType,device)->peer("wifi",device.deviceAddress,instance),(fullDomain,txtRecord,device)->{});wifi.clearServiceRequests(channel,null);wifiServiceRequest=WifiP2pDnsSdServiceRequest.newInstance("_talk2._tcp");wifi.addServiceRequest(channel,wifiServiceRequest,new WifiP2pManager.ActionListener(){public void onSuccess(){wifi.discoverServices(channel,null);}public void onFailure(int reason){emit("error","message","Talk2 Wi-Fi discovery failed ("+reason+").");}});}
 private void discoverBluetoothServices()throws Exception{if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Enable Bluetooth first");if(discoveryBtServer==null)discoveryBtServer=bluetooth.listenUsingRfcommWithServiceRecord("Talk2",SERVICE);for(BluetoothDevice d:bluetooth.getBondedDevices())d.fetchUuidsWithSdp();bluetooth.startDiscovery();}
 void discover(String transport)throws Exception{discovered.clear();if(!transport.equals("bluetooth")){discoverWifiServices();wifi.discoverPeers(channel,action());}if(!transport.equals("wifi"))discoverBluetoothServices();}
 void host(String transport)throws Exception{disconnect();if(transport.equals("wifi")){advertiseWifiService();wifi.createGroup(channel,action());}else{
 if(discoveryBtServer!=null){try{discoveryBtServer.close();}catch(Exception ignored){}discoveryBtServer=null;}
  if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Enable Bluetooth first");btServer=bluetooth.listenUsingRfcommWithServiceRecord("Talk2",SERVICE);BluetoothServerSocket listener=btServer;long g=generation;
  io.execute(()->{try{BluetoothSocket socket=listener.accept();if(g!=generation){socket.close();return;}pendingBt=socket;open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});
 }}
 void join(String transport,String address)throws Exception{disconnect();long g=generation;if(transport.equals("wifi")){if(wifi==null)throw new IOException("Wi-Fi Direct unavailable");WifiP2pConfig config=new WifiP2pConfig();config.deviceAddress=address;wifi.connect(channel,config,action());}else{
  if(bluetooth==null||!bluetooth.isEnabled())throw new IOException("Enable Bluetooth first");bluetooth.cancelDiscovery();BluetoothSocket socket=bluetooth.getRemoteDevice(address).createRfcommSocketToServiceRecord(SERVICE);pendingBt=socket;
  io.execute(()->{try{socket.connect();open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});
 }}
 private void hostTcp(){long g=generation;io.execute(()->{try{tcpServer=new ServerSocket(47773);Socket socket=tcpServer.accept();if(g!=generation){socket.close();return;}pendingTcp=socket;open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});}
 private void joinTcp(String address){long g=generation;io.execute(()->{try{Socket socket=new Socket();pendingTcp=socket;socket.connect(new InetSocketAddress(address,47773),15000);if(g!=generation){socket.close();return;}open(socket.getInputStream(),socket.getOutputStream(),g);}catch(Exception e){lost(g,e);}});}
 private void open(InputStream input,OutputStream output,long g)throws Exception{
  if(g!=generation)return;Session s=new Session(input,output);session=s;
  timer.schedule(()->{if(g==generation&&(!s.local||!s.remote))lost(g,new IOException("Pairing timed out"));},60,TimeUnit.SECONDS);
  try{
   s.out.writeInt(0x54325031);byte[] key=s.crypto.publicKey();s.out.writeInt(key.length);s.out.write(key);s.out.flush();
   if(s.in.readInt()!=0x54325031)throw new IOException("Not a Talk2 peer");int size=s.in.readInt();if(size<32||size>256)throw new IOException("Invalid handshake");byte[] peer=new byte[size];s.in.readFully(peer);String sas=s.crypto.accept(peer);emit("pairing","code",sas);
   while(g==generation){int length=s.in.readInt();if(length<28||length>32800)throw new IOException("Invalid frame size");byte[] frame=new byte[length];s.in.readFully(frame);String text=new String(s.crypto.decrypt(frame),"UTF-8");s.lastRead=System.currentTimeMillis();if(text.equals("HEARTBEAT"))continue;
    if(text.equals("PAIR_CONFIRMED")){s.remote=true;if(s.local)emit("connected","state","Paired");}
    else if(s.local&&s.remote)events.event("message",new JSONObject(text));
   }
  }finally{s.close();if(g==generation)lost(g,null);}
 }
 void confirm()throws Exception{Session s=session;if(s==null)throw new IOException("No pending pairing");s.write("PAIR_CONFIRMED");s.local=true;if(s.remote)emit("connected","state","Paired");}
 void send(String text)throws Exception{Session s=session;if(s==null||!s.local||!s.remote)throw new IOException("Both phones must confirm the same pairing code");s.write(text);}
 void disconnect(){generation++;connecting=false;Session s=session;session=null;for(Closeable c:new Closeable[]{s,pendingTcp,tcpServer,pendingBt,btServer,discoveryBtServer})if(c!=null)try{c.close();}catch(Exception ignored){}pendingTcp=null;tcpServer=null;pendingBt=null;btServer=null;discoveryBtServer=null;}
 void close(){disconnect();try{context.unregisterReceiver(receiver);}catch(Exception ignored){}try{if(wifi!=null){wifi.stopPeerDiscovery(channel,null);wifi.removeGroup(channel,null);}if(bluetooth!=null)bluetooth.cancelDiscovery();}catch(Exception ignored){}io.shutdownNow();timer.shutdownNow();}
}
