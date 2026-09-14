import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const checks=[];
const check=(name,pass,details)=>{checks.push({name,pass,details});if(!pass)process.exitCode=1;};
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const doc=JSON.parse(read('transitions.json'));
const required=['id','intent','trigger','source','target','firstScreen','mutation','notMutation','return','cancelFailureEmpty','copy'];
check('22 unique transition IDs',doc.transitions.length===22&&new Set(doc.transitions.map(x=>x.id)).size===22);
for(const t of doc.transitions){
  check(`${t.id} contract fields`,required.every(k=>t[k]!==undefined)&&!!t.source.object&&!!t.source.selection&&['cancel','failure','empty'].every(k=>!!t.cancelFailureEmpty[k]));
}
const links=[];
for(const name of ['CONTINUITY.md','acceptance.md']){
  const value=read(name);
  check(`${name} UTF-8 replacement characters absent`,!value.includes('\uFFFD'));
  check(`${name} identity echoes`,value.includes(doc.task)&&value.includes(doc.head)&&value.includes(doc.contextPackageSha256));
  for(const match of value.matchAll(/\]\((D:\/[^)]+)\)/g)){
    const file=decodeURIComponent(match[1]).split('#')[0];
    links.push(file);check(`${name} local link`,fs.existsSync(file),file);
  }
}
const observed=JSON.parse(read('baseline-observations.json'));
check('baseline observations completed',observed.completed===true&&observed.observations.length===5);
check('baseline identity matches',observed.head===doc.head&&observed.contextPackageSha256===doc.contextPackageSha256);
check('baseline browser errors empty',!observed.pageErrors.length&&!observed.consoleErrors.length);
const hashes=Object.fromEntries(fs.readdirSync(dir).filter(n=>n!=='validation.json').map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex').toUpperCase()]));
const report={task:doc.task,head:doc.head,contextPackageSha256:doc.contextPackageSha256,checkedAt:new Date().toISOString(),checks,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,hashes,note:'Artifact/schema/link validation only; the integration acceptance scenarios have not been run.'};
fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,files:Object.keys(hashes)},null,2));
