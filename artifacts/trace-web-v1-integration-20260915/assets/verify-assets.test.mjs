import test from 'node:test';
import assert from 'node:assert/strict';
import {safeRelative,getPointer,compareBytes,digest,validateSchema,verifyManifest} from './verify-assets.mjs';
const b=Buffer.from('asset');
test('relative paths support UTF-8 and bracket font names',()=>assert.equal(safeRelative('fonts/原字体/NotoSansSC[wght].ttf'),'fonts/原字体/NotoSansSC[wght].ttf'));
test('absolute, traversal, backslash and drive paths fail closed',()=>{for(const p of ['../x','a/../b','C:/x','/x','a\\b','a//b','./x',''])assert.throws(()=>safeRelative(p));});
test('exact bytes pass; tampered content and size fail',()=>{const f={path:'x',bytes:b.length,sha256:digest(b)};compareBytes(f,b);assert.throws(()=>compareBytes(f,Buffer.from('other')));assert.throws(()=>compareBytes(f,Buffer.from('asset!')));});
test('JSON pointers select and unescape records without evaluation',()=>{assert.equal(getPointer({a:[{'b/c':7}]},'/a/0/b~1c'),7);assert.throws(()=>getPointer({},'x'));});
function fixture(){
 const raw={path:'asset.bin',sha256:digest(b)},authority=Buffer.from(JSON.stringify({assets:[raw]})),lic=Buffer.from('Project generated provenance.');
 const data=new Map([['asset.bin',b],['alias.bin',b],['manifest.json',authority],['rights.txt',lic],['package.json',Buffer.from('{}')]]);
 const files=[...data].map(([path,bytes])=>({path,sha256:digest(bytes),bytes:bytes.length,category:'original'}));
 const m={schemaVersion:1,task:'test',status:'candidate-not-published',baseline:{contextPackage:{path:'package.json',sha256:digest(data.get('package.json'))}},files,assets:[{key:'bird.test',sourcePath:'asset.bin',bytes:b.length,sha256:digest(b),status:'freeze-candidate-not-published',authority:{manifest:'manifest.json',jsonPointer:'/assets/0',declaredSha256:digest(b)},license:{type:'project-generated',entries:['rights.txt']},byteIdenticalPaths:['alias.bin']}],sameByteGroups:[{key:'bird.test',sha256:digest(b),paths:['asset.bin','alias.bin']}]};
 return {m,data,read:async p=>{if(!data.has(p))throw Error('ENOENT '+p);return data.get(p);}};
}
test('complete in-memory candidate verifies with no writes',async()=>{const f=fixture(),r=await verifyManifest(f.m,{read:f.read});assert.equal(r.status,'passed-resource-evidence-only');assert.equal(r.counts.filesPassed,5);assert.equal(r.counts.assetsPassed,1);});
test('candidate cannot silently claim published status',()=>{const f=fixture();f.m.status='approved';assert.throws(()=>validateSchema(f.m));});
test('duplicate semantic keys and absent permission records reject',()=>{const f=fixture();f.m.assets.push({...f.m.assets[0]});assert.throws(()=>validateSchema(f.m));const g=fixture();g.m.assets[0].license.entries=[];assert.throws(()=>validateSchema(g.m));});
test('missing original/provenance is reported as failure',async()=>{const f=fixture();f.data.delete('rights.txt');const r=await verifyManifest(f.m,{read:f.read});assert.equal(r.status,'failed');assert.ok(r.failures.some(x=>x.key==='rights.txt'));});
test('one-byte alias tampering cannot pass same-byte groups',async()=>{const f=fixture();f.data.set('alias.bin',Buffer.from('Asset'));const r=await verifyManifest(f.m,{read:f.read});assert.equal(r.status,'failed');assert.equal(r.counts.byteGroupsPassed,0);});
test('valid-looking hash with wrong upstream path fails authority check',async()=>{const f=fixture();const authority=Buffer.from(JSON.stringify({assets:[{path:'different.bin',sha256:digest(b)}]}));f.data.set('manifest.json',authority);Object.assign(f.m.files.find(x=>x.path==='manifest.json'),{bytes:authority.length,sha256:digest(authority)});const r=await verifyManifest(f.m,{read:f.read});assert.equal(r.status,'failed');assert.match(r.failures.find(x=>x.stage==='asset').message,/another resource/);});
