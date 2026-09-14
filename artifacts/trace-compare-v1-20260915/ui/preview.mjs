// Optional isolated preview; never binds to the app's existing 4173 port.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const target=path.resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!target.startsWith(path.resolve(workspace)+path.sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log(`Trace compare isolated fixture: http://127.0.0.1:${server.address().port}/artifacts/trace-compare-v1-20260915/ui/fixture.html`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
