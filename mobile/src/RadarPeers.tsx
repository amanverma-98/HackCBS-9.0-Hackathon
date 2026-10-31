import React from "react";
import { Button, Text, View } from "react-native";
const i18n = require("../../shared/i18n.cjs");
export function RadarPeers({ color, peers, filter, onFilter, heading, compass, ui, onJoin }: {
  color: string; peers: any[]; filter: string; onFilter:(s:any)=>void; heading:number; compass:boolean; ui:string; onJoin:(p:any)=>void;
}) {
  const t=(s:string)=>i18n.translate(s,ui);
  const roles:Record<string,string>={citizen:"Citizen",volunteer:"Volunteer",medical_support:"Medical / support",emergency_staff:"Emergency staff"};
  return <View style={{gap:10}}>
    <View style={{height:280,width:280,alignSelf:"center",borderRadius:140,borderWidth:1,borderColor:"#777",alignItems:"center",justifyContent:"center"}}>
      {[80,160,240].map(size=><View key={size} style={{position:"absolute",height:size,width:size,borderRadius:size/2,borderWidth:1,borderColor:"#999"}}/>)}
      <Text style={{color}}>↑</Text>
      {["N","E","S","W"].map((name,i)=>{const angle=(i*90-heading)*Math.PI/180;return <Text key={name} style={{color,position:"absolute",left:134+Math.sin(angle)*124,top:130-Math.cos(angle)*124}}>{name}</Text>;})}
      {peers.filter(p=>p.polar).map(p=>{const angle=p.polar.relative*Math.PI/180,r=Math.min(110,p.polar.distance/2);return <View key={p.transport+p.id} accessibilityLabel={t(p.route==="relayed"?"Relayed peer":"Direct peer")} style={{position:"absolute",left:134+Math.sin(angle)*r,top:134-Math.cos(angle)*r,width:12,height:12,borderRadius:6,backgroundColor:p.route==="relayed"?"#D47743":"#347453"}}/>;})}
    </View>
    {!compass&&<Text style={{color}}>{t("North-up (compass unavailable or unreliable)")}</Text>}
    <View style={{flexDirection:"row",gap:10}}><Text style={{color:"#347453"}}>? {t("Direct")}</Text><Text style={{color:"#D47743"}}>? {t("Relayed")}</Text></View>
    <Text style={{color}}>{t("Dots: direct / relayed. Roles are self-declared and unverified.")}</Text>
    <Text style={{color}}>{t("Coordinates expire after 30 seconds. Radio strength is not a position.")}</Text>
    <View style={{flexDirection:"row",gap:8}}>{["all","direct","relayed"].map(mode=><Button key={mode} title={t(mode==="all"?"All":mode==="direct"?"Direct":"Relayed")} disabled={filter===mode} onPress={()=>onFilter(mode)}/>)}</View>
    {!peers.length&&<Text style={{color}}>{t("No peers match this filter")}</Text>}
    {peers.map(p=><View key={p.transport+p.id} style={{padding:8,borderBottomWidth:1,borderColor:"#999",gap:4}}>
      <Text style={{color}}>{p.name} · {t(roles[p.role]||"Unknown role")} · {t("Unverified")}</Text>
      <Text style={{color}}>{p.transport} · {t(p.route==="relayed"?"Relayed":"Direct")}</Text>
      <Text style={{color}}>{t(p.connected ? "Connected" : "Discovery only")}</Text>
      <Text style={{color}}>{p.polar?`${Math.round(p.polar.distance)} m · ±${Math.round(p.uncertainty)} m`:t("Location unavailable or stale")}</Text>
      <Text style={{color}}>{t("Last seen")}: {Number.isFinite(p.lastSeen)?Math.max(0,Math.round((Date.now()-p.lastSeen)/1000)):"?"} {t("seconds ago")}</Text>
      {p.transport!=="BLE mesh"&&!p.connected&&<Button title={t("Join")} onPress={()=>onJoin(p)}/>}
    </View>)}
  </View>;
}
