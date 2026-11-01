const {test} = require('node:test');
const assert = require('node:assert/strict');
const {PushToTalk} = require('../shared/ptt.cjs');
function fixture(prepare = async()=>{}) {
  const calls=[];
  const io={prepare, state:s=>calls.push(s), error:e=>calls.push(e.message)};
  for(const k of ['acquire','start','cancel','finish','release']) io[k]=async()=>{calls.push(k);};
  return {p:new PushToTalk(io),calls,io};
}
test('normal hold/release sends exactly once and releases channel',async()=>{
 const {p,calls}=fixture(); await p.press(); await Promise.all([p.release(),p.release()]);
 assert.equal(calls.filter(x=>x==='finish').length,1); assert.equal(calls.at(-1),'idle');
});

test('release during permission prompt never starts capture',async()=>{
 let resolve; const {p,calls}=fixture(()=>new Promise(r=>resolve=r));
 const press=p.press(); const release=p.release(); resolve(); await Promise.all([press,release]);
 assert.ok(!calls.includes('start')); assert.ok(!calls.includes('finish')); assert.equal(p.active,null);
});

test('background cancellation discards capture and frees channel',async()=>{
 const {p,calls}=fixture(); await p.press(); await p.cancel();
 assert.ok(calls.includes('cancel')); assert.ok(!calls.includes('finish')); assert.ok(calls.includes('release'));
});

test('capture failure permits a subsequent press',async()=>{
 const {p,calls,io}=fixture(); io.start=async()=>{throw Error('mic busy');}; await p.press();
 assert.equal(p.active,null); io.start=async()=>calls.push('start'); await p.press(); await p.release();
 assert.ok(calls.includes('finish'));
});
