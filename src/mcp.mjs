import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {toolSchema} from './tool-schema.mjs';
import {createHarnessSession} from './harness-session.mjs';
const session=createHarnessSession();
const schema=structuredClone(toolSchema);
schema.properties.action={type:'string',enum:['catalog','save','read','list','open','inbox','answer','patch','wait','progress','complete','undo','reconcile']};
schema.properties.cwd={type:'string',description:'Absolute project directory. Required except for catalog. Never infer from the MCP server installation directory.'};
schema.properties.requestId={type:'string'};
schema.properties.timeoutSeconds={type:'number',minimum:0,maximum:50};
schema.properties.message={type:'string',description:'Short user-facing progress or completion; never private reasoning, secrets or raw tool output.'};
schema.properties.toolName={type:'string',description:'Optional public tool name for progress. Never include arguments, commands or output.'};
schema.properties.toolCallId={type:'string',description:'Stable tool activity ID to pair start/end progress events.'};
schema.properties.toolStatus={type:'string',enum:['running','complete','error']};
const instructions='Use only after the user explicitly invokes /planboard (or the host explicit skill equivalent), or within an already requested review. Never activate because plan mode started or a plan was drafted. Markdown-first planning review. Write or select an existing .md plan, then save with markdownPath and an authored readable presentation. The source is archived exactly. Use the current host model for architecture; quick tasks use the explicit fast-model adapter or host routing contract. After open, call plan_board wait while the user reviews. Process requests using supplied context, patch/save, answer for discussions and complete for batches, then wait again until approval or a stop request. MCP cannot universally wake an idle host. Keep the review loop active. Approval returns an immutable Markdown path; show it and ask the user whether to implement, without starting automatically.';
const server=new Server({name:'planboard',version:'0.7.1'},{capabilities:{tools:{}},instructions});
server.oninitialized=()=>session.setHost(server.getClientVersion()?.name||'unknown');
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'plan_board',description:instructions+' catalog discovers node types or document composition. Supply absolute cwd on project actions.',inputSchema:schema}]}));
server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
 try{if(request.params.name!=='plan_board')throw new Error('Unknown tool.');const result=await session.call(request.params.arguments||{},{signal:extra.signal});return {content:[{type:'text',text:JSON.stringify(result)}]};}
 catch(error){return {isError:true,content:[{type:'text',text:error.message}]};}
});
let closing;
function close(){return closing ||= session.close().then(()=>server.close());}
server.onclose=()=>{void close();};
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{void close().finally(()=>process.exit(0));});
process.stdin.on('end',()=>{void close();});
await server.connect(new StdioServerTransport());
