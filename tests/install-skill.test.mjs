import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const name=Object.keys(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).bin)[0];
test('skill installer links both hosts, is idempotent, and preserves existing skills',async t=>{
 const home=await mkdtemp(path.join(os.tmpdir(),'skill-install-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const run=agent=>spawnSync(process.execPath,[path.join(root,'bin',name+'.mjs'),'install-skill','--agent',agent,'--home',home],{encoding:'utf8'});
 for(const [agent,dir] of [['codex','.agents'],['claude','.claude']]){
  const target=path.join(home,dir,'skills',name);assert.equal(run(agent).status,0);assert.equal(await realpath(target),await realpath(path.join(root,'skills',name)));assert.equal(run(agent).status,0);
  await rm(target);await mkdir(target);await writeFile(path.join(target,'keep.txt'),'keep');const result=run(agent);assert.notEqual(result.status,0);assert.match(result.stderr,/nothing was overwritten/);assert.equal(await readFile(path.join(target,'keep.txt'),'utf8'),'keep');
 }
});
