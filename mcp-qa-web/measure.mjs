import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
for(const mode of ['full','compact']) {
 const client=new Client({name:'measure',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(dir,'server.mjs')],env:{...process.env,QA_MCP_MODE:mode},stderr:'pipe'}));
 try{const tools=await client.listTools();const guide=await client.callTool({name:'qa_web_guide',arguments:{topic:mode==='full'?'all':'overview'}});console.log(JSON.stringify({mode,tools:tools.tools.length,schemaBytes:Buffer.byteLength(JSON.stringify(tools.tools)),guideBytes:Buffer.byteLength(guide.content[0].text)}));}finally{await client.close();}
}
