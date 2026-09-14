// Read-only asset verification. No mkdir/write/save/download/process/browser APIs.
// Run from any cwd: node /absolute/path/to/verify-assets.mjs
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const digest=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
export function safeRelative(p){
  if(typeof p!=='string'||!p||p.includes('\\')||p.includes(':')||p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error(`Unsafe relative path: ${p}`);
  return p;
}
export function getPointer(obj,pointer){
  if(pointer==='')return obj;
  if(typeof pointer!=='string'||!pointer.startsWith('/'))throw Error('Invalid JSON pointer');
  return pointer.slice(1).split('/').reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],obj);
}
export function compareBytes(record,bytes){
  if(bytes.length!==record.bytes)throw Error(`Byte length mismatch: ${record.path||record.sourcePath}`);
  if(digest(bytes)!==record.sha256)throw Error(`SHA256 mismatch: ${record.path||record.sourcePath}`);
}
function assert(ok,message){if(!ok)throw Error(message);}
export function validateSchema(m){
  assert(m.schemaVersion===1,'Unsupported schema');
  assert(m.status==='candidate-not-published','Candidate must not claim publication');
  assert(Array.isArray(m.assets)&&m.assets.length>0,'No assets');
  assert(Array.isArray(m.files)&&m.files.length>0,'No file guards');
  const keys=new Set(),paths=new Set();
  for(const f of m.files){safeRelative(f.path);assert(!paths.has(f.path),`Duplicate file guard: ${f.path}`);paths.add(f.path);assert(/^[A-F0-9]{64}$/.test(f.sha256),`Invalid hash: ${f.path}`);assert(Number.isInteger(f.bytes)&&f.bytes>0,`Invalid bytes: ${f.path}`);}
  for(const a of m.assets){
    assert(typeof a.key==='string'&&!keys.has(a.key),`Duplicate/invalid semantic key: ${a.key}`);keys.add(a.key);
    safeRelative(a.sourcePath);assert(paths.has(a.sourcePath),`Asset not guarded: ${a.key}`);
    assert(a.status==='freeze-candidate-not-published',`Asset promoted without review: ${a.key}`);
    assert(a.license?.entries?.length>0,`Missing license/provenance: ${a.key}`);
    assert(a.authority?.manifest&&a.authority?.jsonPointer,`Missing authority: ${a.key}`);
    for(const p of [a.authority.manifest,...a.license.entries,...(a.originalPaths||[]),...(a.visualReferencePaths||[]),...(a.byteIdenticalPaths||[]),...(a.currentAppUsage?.paths||[])]){safeRelative(p);assert(paths.has(p),`Unguarded relation: ${a.key} -> ${p}`);}
  }
  return true;
}
export async function verifyManifest(m,{read,describePath=p=>p}={}){
  const report={schemaVersion:1,task:m.task,status:'failed',checkedAt:new Date().toISOString(),baseline:m.baseline,readOnly:true,counts:{assets:m.assets?.length||0,files:m.files?.length||0,filesPassed:0,assetsPassed:0,byteGroupsPassed:0,originalsAndReferencesPassed:0,implementationSnapshots:0},failures:[],warnings:[],limits:m.validationLimits||[]};
  try{validateSchema(m);}catch(e){report.failures.push({stage:'schema',message:e.message});return report;}
  const cache=new Map();
  async function bytes(p){safeRelative(p);if(!cache.has(p))cache.set(p,await read(p));return cache.get(p);}
  async function check(stage,key,fn){try{await fn();return true;}catch(e){report.failures.push({stage,key,message:e.message});return false;}}
  const guard=new Map(m.files.map(f=>[f.path,f]));
  for(const f of m.files){if(await check('file',f.path,async()=>compareBytes(f,await bytes(f.path)))){report.counts.filesPassed++;if(/original|reference/.test(f.category))report.counts.originalsAndReferencesPassed++;}}
  for(const a of m.assets){
    if(await check('asset',a.key,async()=>{
      const b=await bytes(a.sourcePath);compareBytes(a,b);
      const upstream=JSON.parse((await bytes(a.authority.manifest)).toString('utf8').replace(/^\uFEFF/,''));
      const record=getPointer(upstream,a.authority.jsonPointer);
      assert(record?.sha256?.toUpperCase()===a.sha256,`Authority SHA mismatch: ${a.key}`);
      assert(a.authority.declaredSha256===a.sha256,`Declared authority hash mismatch: ${a.key}`);
      const rp=String(record?.path||'').replaceAll('\\','/');
      assert(rp===a.sourcePath||a.sourcePath.endsWith('/'+rp)||rp.endsWith('/'+a.sourcePath),`Authority points at another resource: ${a.key}`);
      for(const p of a.license.entries){assert((await bytes(p)).length>0,`Missing license/provenance: ${p}`);}
      if(a.license.type==='OFL-1.1')assert((await bytes(a.license.entries[0])).toString('utf8').includes('SIL OPEN FONT LICENSE'),'OFL entry is not an OFL text');
      if(a.license.type==='MIT')assert((await bytes(a.license.entries[0])).toString('utf8').includes('Permission is hereby granted'),'MIT entry is not a permission text');
      for(const p of [...(a.byteIdenticalPaths||[]),...(a.currentAppUsage?.paths||[])])assert(digest(await bytes(p))===a.sha256,`Same-byte alias differs: ${p}`);
      if(a.format){assert(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a','PNG signature mismatch');assert(b.readUInt32BE(16)===a.format.width&&b.readUInt32BE(20)===a.format.height,'PNG dimensions mismatch');assert(b[24]===a.format.bitDepth&&b[25]===a.format.colorType,'PNG type mismatch');}
    }))report.counts.assetsPassed++;
  }
  for(const group of m.sameByteGroups||[])if(await check('byte-group',group.key,async()=>{for(const p of group.paths)assert(digest(await bytes(p))===group.sha256,`Alias drift: ${p}`);}))report.counts.byteGroupsPassed++;
  for(const s of m.implementationSnapshots||[]){
    try{compareBytes(s,await bytes(s.path));report.counts.implementationSnapshots++;}
    catch(e){if(s.policy==='observe-only-root-may-integrate')report.warnings.push({stage:'root-owned-implementation-drift',path:s.path,message:'Root-owned source changed after the snapshot. Asset bytes remain independently guarded; re-audit source usage when integrating.'});else report.failures.push({stage:'immutable-module',path:s.path,message:e.message});}
  }
  const packageGuard=guard.get(m.baseline.contextPackage.path);
  if(packageGuard?.sha256!==m.baseline.contextPackage.sha256)report.failures.push({stage:'identity',message:'Context package guard mismatch'});
  report.status=report.failures.length?'failed':'passed-resource-evidence-only';
  report.sourceRoot=describePath('');
  return report;
}
async function main(){
  const dir=path.dirname(fileURLToPath(import.meta.url)),root=await realpath(path.resolve(dir,'../../..'));
  const manifestFile=path.join(dir,'approved-assets.candidate.json');
  const manifestBytes=await readFile(manifestFile),m=JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/,''));
  const reader=async p=>{safeRelative(p);const absolute=await realpath(path.resolve(root,p)),relative=path.relative(root,absolute);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error(`Resolved path escapes workspace: ${p}`);if(!(await stat(absolute)).isFile())throw Error(`Not a file: ${p}`);return readFile(absolute);};
  const report=await verifyManifest(m,{read:reader,describePath:()=>root});
  report.manifestSha256=digest(manifestBytes);
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.failures.length?1:0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(JSON.stringify({status:'failed',readOnly:true,error:e.message}));process.exitCode=1;});
