const test = require("node:test"), assert = require("node:assert/strict");
const { languageState, recognitionReason } = require("../shared/language-state.cjs");
const manifest = require("../model-host/upstream-manifest.json");
const i18n = require("../shared/i18n.cjs");
test("voice language policy keeps original usable through missing and incompatible models", () => {
  assert.equal(recognitionReason("hi", {}, manifest.packs), "Hindi speech files are absent from this release");
  assert.equal(recognitionReason("mr", {}, manifest.packs), "Source speech pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "hi", {}).translationReason, "Translation pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "hi", {translation:true}).speechReason, "Target speech pack missing");
  assert.equal(languageState("मदत", "mr", "hi", "mr", {translation:true,mr:true}).speechReason, "TTS voice must match translation target");
  const identity=languageState("मदत", "mr", "mr", "mr", {mr:true});assert.equal(identity.route,"identity");assert.equal(identity.speechReason,"");
  assert.equal(languageState("help", "en", "mr", "mr", {mr:true,translation:true}).translationReason,"Translation pair unavailable");
  assert.equal(languageState("", "mr", "mr", "mr", {mr:true}).originalPlayable,true);
});
test("Stage 3 UI strings have Marathi coverage and structured fallback", () => {
  assert.equal(i18n.translate("Install mr speech pack first", "mr"), "mr स्पीच पॅक प्रथम स्थापित करा");
  for (const key of Object.keys(require("../shared/stage3-ui.cjs"))) {
    assert.ok(i18n.resources.mr[key]); assert.equal(i18n.translate(key,"ta"), i18n.resources.en[key]);
  }
});
const { usableLocation, mergeLocationPeer, peerView } = require("../shared/location.cjs");
test("radar rejects stale, future, inaccurate and invalid coordinates", () => {
  const now=100000, fix={latitude:19,longitude:73,accuracy:5,time:now,expires:now+30000};
  assert.equal(usableLocation(fix,now),true);
  for (const bad of [{time:now-30000},{time:now+5001},{accuracy:101},{accuracy:-1},{latitude:91},{longitude:NaN},{expires:now},{expires:now+30001}]) assert.equal(usableLocation({...fix,...bad},now),false);
  const peers=[{id:"a",route:"direct",coords:{...fix,longitude:73.001},verified:true},{id:"b",route:"relayed",coords:null}];
  const view=peerView(peers,"all",fix,90,now);assert.equal(view.length,2);assert.ok(view[0].polar.distance>100);assert.equal(view[0].verified,false);assert.equal(view[1].polar,null);
  const filtered=peerView(peers,"relayed",fix,0,now);assert.deepEqual(filtered.map(p=>p.id),["b"]);assert.equal(filtered.filter(p=>p.polar).length,0);
});
test("public location revocation prevents older fixes returning; staff remains unverified", () => {
  const now=100000, event={sender:"node",name:"Test",role:"emergency_staff",verified:true,hops:1,time:now,expires:now+30000,coords:{latitude:0,longitude:0,accuracy:3,time:now}};
  let store=mergeLocationPeer({},event,now);assert.equal(store.node.verified,false);assert.equal(store.node.route,"relayed");
  store=mergeLocationPeer(store,{...event,off:true,time:now+10,expires:now+30010},now+10);assert.equal(store.node.coords,null);
  assert.equal(mergeLocationPeer(store,event,now+20),store);
  assert.equal(mergeLocationPeer({},event,now+30001).node,undefined);
});
