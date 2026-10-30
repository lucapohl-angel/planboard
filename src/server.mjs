import {isManualEditField} from '../web/plan-content.js';
import {createActivityHub} from './activity.mjs';
import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PlanStore, markdown } from './plans.mjs';
import {localAction,executeLocal} from './local-review.mjs';

export async function startBoard({ cwd, onFeedback, port = 0, capability, deliveryOwner, activity=createActivityHub() } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid local port.');
  if (capability !== undefined && !/^[a-f0-9]{48}$/.test(capability)) throw new Error('Invalid local board capability.');
  const store = new PlanStore(cwd);
  await store.init();
  const token = capability ?? randomBytes(24).toString('hex'), prefix = '/' + token + '/';
  let origin;const streams=new Set();
  const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
  async function body(req) {
    let result = '';
    for await (const chunk of req) { result += chunk; if (Buffer.byteLength(result) > 256000) throw Object.assign(new Error('Request is too large.'), { status: 413 }); }
    return JSON.parse(result || '{}');
  }
  async function dispatch(id, entry) {
    if (!onFeedback) return false;
    try { await onFeedback(id, entry); return true; } catch(error) {const message=String(error.message||'Agent delivery failed. Your request is saved; retry.').slice(0,500);await store.deliveryFailed(id,entry.id,message);activity.update(id,entry.id,{status:'error',phase:message});return false; }
  }
  // Persist first. A disconnected viewer can hand its queued reviews to Pi later.
  const deliveries = new Map();
  async function deliver(id) {
    if (deliveries.has(id)) return deliveries.get(id);
    const task = (async () => {
      const attempted = new Set(); let successful = true;
      // Drain new requests arriving while a native Pi callback is busy. A failed
      // entry is tried once per delivery pass and stays queued for explicit retry.
      while (true) {
        const record = await store.read(id);
        const pending = [...(record.submissions || []), ...(record.discussions || [])]
          .filter(entry => entry.status === 'queued' && !attempted.has(entry.id));
        if (!pending.length) break;
        for (const entry of pending) {
          attempted.add(entry.id);
          const submission = (record.submissions || []).some(s => s.id === entry.id);
          const payload = submission
            ? {...entry, feedback: record.feedback.filter(f => entry.feedbackIds.includes(f.id))}
            : {...entry, action: 'ask'};
          const local=localAction(record,payload);
          if(!local&&!onFeedback){successful=false;continue;}
          const claimed=submission?await store.delivered(id,entry.id,deliveryOwner):await store.questionDelivered(id,entry.id,deliveryOwner);
          if(!claimed)continue;
          if(local){
            activity.start(id,entry);activity.update(id,entry.id,{status:'running',local:true,phase:'Applying '+(local.via||local.kind)+' locally'});
            try{const result=await executeLocal(store,id,payload,local);activity.update(id,entry.id,{status:'complete',phase:'Finished without a model',savedRevision:result.revision});}
            catch(error){await store.deliveryFailed(id,entry.id,error.message);activity.update(id,entry.id,{status:'error',phase:error.message});successful=false;}
            continue;
          }
          if (!await dispatch(id, payload)) {
            successful = false;
          }
        }
      }
      return successful;
    })();
    deliveries.set(id, task);
    try { return await task; } finally { deliveries.delete(id); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (req.headers.host !== new URL(origin).host) return json(res, 403, { error: 'Unexpected host.' });
      const url = new URL(req.url, origin);
      if (!url.pathname.startsWith(prefix)) return json(res, 404, { error: 'Not found.' });
      if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Unsupported method.' });
      if (req.method === 'POST' && req.headers.origin !== origin) return json(res, 403, { error: 'Use the local planning board to submit changes.' });
      const route = url.pathname.slice(prefix.length);
      if (req.method === 'GET' && ['', 'app.js', 'style.css', 'plan-content.js', 'diagrams.js', 'annotations.js', 'diagram-spec.js', 'diagram-routing.js', 'canvas-view.js', 'review-layout.js', 'anchored-bubble.js', 'canvas-inspector.js', 'change-playback.js', 'view-state.js', 'document-view.js', 'diagram-walkthroughs.js', 'source-links.js', 'area-selection.js', 'text-diff.js', 'change-history.js'].includes(route)) {
        const file = route || 'index.html';
        res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
        return res.end(await readFile(new URL('../web/' + file, import.meta.url)));
      }
      if (route === 'api/plans' && req.method === 'GET') return json(res, 200, { plans: await store.list(), connected: !!onFeedback,reviewProtocol:2 });
      if (route === 'api/current' && req.method === 'GET') return json(res, 200, { record: await store.current(), connected: !!onFeedback,reviewProtocol:2 });
      if (req.method === 'POST' && ['api/start','api/import'].includes(route)) return json(res,400,{error:'Write a plan Markdown file first, then use plan_board save with markdownPath in your agent session.'});
      const match = route.match(/^api\/plans\/([a-z0-9_-]+)(?:\/(feedback|export|submit|approve|ask|activity|edit|history|undo|highlight-baseline))?$/);
      if (match) {
        const [, id, action] = match;
        if (req.method === 'GET') {
          if(!action){
            const file=await stat(store.file(id)),etag='"'+file.ino+'-'+file.mtimeMs+'-'+file.size+'"';
            res.setHeader('ETag',etag);res.setHeader('Cache-Control','private, no-cache');
            if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
          }
          const record = await store.read(id);
          if(action==='history')return json(res,200,await store.history(id));
          if(action==='activity'){
            res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
            streams.add(res);const unsubscribe=activity.subscribe(id,tasks=>res.write('data: '+JSON.stringify(tasks)+'\n\n'));
            const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
            res.on('close',()=>{clearInterval(heartbeat);unsubscribe();streams.delete(res);});return;
          }
          if (action === 'export') {
            const md = url.searchParams.get('format') === 'md';
            res.setHeader('Content-Disposition', `attachment; filename="${md ? 'plan.md' : 'plan-' + id + '.json'}"`);
            res.setHeader('Content-Type', md ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8');
            const document=url.searchParams.get('document');
            if(md&&document==='reviewed')return res.end(record.document?.content||'Detailed Markdown has not yet been reconciled.');
            if(md&&document==='approved'){if(!record.approval)return json(res,404,{error:'This revision has not been approved.'});return res.end(await store.approvedMarkdown(record));}
            return res.end(md ? markdown(record) : JSON.stringify(record, null, 2));
          }
          if (!action) return json(res, 200, record);
        }
        if(req.method==='POST'&&action==='edit'){
          const input=await body(req);
          if(!isManualEditField(input.path))return json(res,400,{error:'Manual editing is limited to body content. Titles and control labels are read-only.'});
          const record=await store.patch(id,input.revision,[{path:input.path,value:input.value}],{origin:'manual'});
          return json(res,200,{record});
        }
        if(req.method==='POST'&&action==='undo'){
          const input=await body(req),record=await store.undo(id,input.revision,input.undoRevision);
          return json(res,200,{record});
        }
        if(req.method==='POST'&&action==='highlight-baseline'){
          const input=await body(req);await store.setHighlightBaseline(id,input.revision,input.baseline);
          return json(res,200,await store.history(id));
        }
        if (req.method === 'POST' && action === 'feedback') {
          const entry = await store.feedback(id, await body(req));
          return json(res, 201, { entry, delivered: false });
        }
        if (req.method === 'POST' && action === 'ask') {
          const input=await body(req);
          const question=input.questionId?(await store.read(id)).discussions?.find(q=>q.id===input.questionId):await store.ask(id,input);
          if(!question)return json(res,404,{error:'Question not found.'});
          const record=await store.read(id);
          setImmediate(()=>{void deliver(id).catch(()=>{});});
          return json(res,201,{question:record.discussions.find(q=>q.id===question.id),discussions:record.discussions});
        }
        if (req.method === 'POST' && ['submit','approve'].includes(action)) {
          const input = await body(req);
          await store.submit(id, { revision: input.revision, approve: action === 'approve' });
          const record = await store.read(id);
          setImmediate(()=>{void deliver(id).catch(()=>{});});
          return json(res, 200, { record, delivered: !(record.submissions || []).some(s => s.status === 'queued') });
        }
      }
      return json(res, 404, { error: 'Not found.' });
    } catch (error) { json(res, error.status || (error.code === 'ENOENT' ? 404 : 400), { error: error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { url: origin + prefix, store, deliver, activity, close: () => new Promise(resolve => { for(const stream of streams)stream.end();server.closeAllConnections(); server.close(resolve); }) };
}
