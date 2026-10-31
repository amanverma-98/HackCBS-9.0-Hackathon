import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync(new URL('../model-host/upstream-manifest.json',import.meta.url)));
const url='https://api.github.com/repos/Somu9450/Talk2/releases/tags/model-pack-v1?verify='+Date.now();
const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`Release HTTP ${response.status}. Check repository visibility and the published model-pack-v1 tag.`);
const release=await response.json();let failed=false;
for(const pack of Object.values(manifest.packs))for(const f of pack.files){
 const asset=release.assets.find(a=>a.name===f.name);
 const ok=asset&&asset.size===f.bytes&&(!asset.digest||asset.digest===`sha256:${f.sha256}`);
 console.log(`${ok?'OK':'MISMATCH/MISSING'} ${f.name}`);if(!ok)failed=true;
}
if(failed)process.exitCode=1;
