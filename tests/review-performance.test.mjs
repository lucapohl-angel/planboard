import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {reviewRead} from '../src/review-read.mjs';
import {startBoard} from '../src/server.mjs';

test('focused reads preserve revision and stable paths without leaking unrelated source/history',()=>{
 const r={id:'p',revision:7,plan:{title:'Plan',technologies:[{id:'auth',name:'Auth',checks:['Verify sessions']}],sourceDocument:{name:'source.md',sections:[{id:'s',content:'Original'}]}},discussions:[{answer:'History'}]};
 assert.equal(reviewRead(r),r);
 const part=reviewRead(r,['technologies/auth']);assert.equal(part.revision,7);assert.equal(part.parts['technologies/auth'].name,'Auth');assert.ok(!JSON.stringify(part).includes('History'));assert.ok(!JSON.stringify(part).includes('Original'));
 assert.deepEqual(reviewRead(r,['technologies/auth/checks/0']).parts,{'technologies/auth/checks/0':'Verify sessions'});
 assert.equal(reviewRead(r,['plan']).parts.plan.sourceDocument,undefined);assert.equal(r.plan.sourceDocument.sections[0].content,'Original');
 for(const paths of [[],['__proto__'],['technologies/nope'],['constructor'],['sourceDocument/sections/missing']])assert.throws(()=>reviewRead(r,paths));
});

test('unchanged recovery polls return no payload; a saved revision invalidates the ETag',async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'review-etag-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const board=await startBoard({cwd});t.after(()=>board.close());
 const r=await board.store.save({title:'Plan',kind:'software',brief:'Keep review responsive.',objective:'Review safely.'}),url=board.url+'api/plans/'+r.id;
 const first=await fetch(url),etag=first.headers.get('etag');assert.ok(etag);assert.equal((await first.json()).revision,1);
 const same=await fetch(url,{headers:{'If-None-Match':etag}});assert.equal(same.status,304);assert.equal(await same.text(),'');
 await board.store.patch(r.id,1,[{path:'objective',value:'Review changes quickly.'}]);
 const changed=await fetch(url,{headers:{'If-None-Match':etag}});assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),etag);assert.equal((await changed.json()).revision,2);
});
