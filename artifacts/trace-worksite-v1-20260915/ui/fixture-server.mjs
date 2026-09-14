import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.woff2':'font/woff2','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(!(await stat(file)).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
server.listen(Number(process.env.PORT||0),'127.0.0.1',()=>{const port=server.address().port;console.log(JSON.stringify({url:`http://127.0.0.1:${port}/artifacts/trace-worksite-v1-20260915/ui/fixture.html`,port,pid:process.pid}));});
