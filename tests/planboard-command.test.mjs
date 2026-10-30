import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {piRuntime} from './pi-runtime.mjs';
const runtime=await piRuntime(),skip=!runtime?'Install Pi or set PLANBOARD_PI_CORE to run native integration checks':false;
const {loadExtensions}=runtime?await import(runtime+'/extensions/loader.js'):{};
const {loadSkills,formatSkillsForPrompt}=runtime?await import(runtime+'/skills.js'):{};
test('planboard is discoverable explicitly but excluded from the Pi automatic skill prompt',{skip},()=>{
 const result=loadSkills({cwd:process.cwd(),includeDefaults:false,skillPaths:[new URL('../skills/planboard',import.meta.url).pathname]});
 assert.equal(result.skills.length,1);assert.equal(result.skills[0].name,'planboard');assert.equal(result.skills[0].disableModelInvocation,true);assert.equal(formatSkillsForPrompt(result.skills),'');assert.equal(result.diagnostics.length,0);
});
test('/planboard forwards the current draft or exact file selection to the owning agent, never on session start',{skip},async t=>{
 const cwd=await mkdtemp(path.join(os.tmpdir(),'planboard-command-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const loaded=await loadExtensions([new URL('../src/extension.ts',import.meta.url).pathname],cwd);assert.deepEqual(loaded.errors,[]);const extension=loaded.extensions[0],messages=[];loaded.runtime.sendUserMessage=async(...args)=>messages.push(args);
 const ctx={cwd,isProjectTrusted:()=>true,sessionManager:{getSessionId:()=> 'command-test'},ui:{notify(){}}};
 for(const fn of extension.handlers.get('session_start')||[])await fn({},ctx);assert.equal(messages.length,0);assert.equal(extension.handlers.has('before_agent_start'),false);
 const command=extension.commands.get('planboard');assert.ok(command);
 await command.handler('',ctx);assert.equal(messages.length,1);assert.match(messages[0][0],/without a filename/);assert.match(messages[0][0],/faithfully save that public draft as Markdown/);assert.match(messages[0][0],/If no clear plan is available/);assert.equal(messages[0][1].expandPromptTemplates,false);
 const file='plans/Release plan $(literal).md';await command.handler(file,ctx);assert.equal(messages.length,2);assert.ok(messages[1][0].includes(JSON.stringify(file)));assert.match(messages[1][0],/plan-mode restrictions/);
 assert.deepEqual(await (await import('node:fs/promises')).readdir(cwd),[]);
 ctx.isProjectTrusted=()=>false;await assert.rejects(command.handler('',ctx),/trusted/);assert.equal(messages.length,2);
});
