import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const allowed=['artifacts/trace-result-return-v1-20260915/','artifacts/trace-one-thing-v1-20260915/images/ready/','artifacts/trace-one-thing-v1-20260915/fonts/derived/','artifacts/trace-home-v1-20260914/images/repaired/'];
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
export async function startServer(port=0) {
  const server=createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const rel=(pathname==='/'?'artifacts/trace-result-return-v1-20260915/ui/demo.html':pathname.replace(/^\//,''));
      const abs=path.resolve(workspace,rel);
      if(req.method!=='GET'||!allowed.some(prefix=>rel.replaceAll('\\','/').startsWith(prefix))||!abs.startsWith(workspace)||rel.split(/[\\/]/).includes('..')){res.writeHead(403);res.end();return;}
      const body=await readFile(abs);res.writeHead(200,{'Content-Type':mime[path.extname(abs)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}/artifacts/trace-result-return-v1-20260915/ui/demo.html`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const {url}=await startServer(Number(process.env.RESULT_DEMO_PORT)||0);process.stdout.write(`${url}\n`);}
