#!/usr/bin/env node
import {mkdir,realpath,lstat,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{agent:{type:'string'},home:{type:'string'},help:{type:'boolean'}}});
const name="planboard";
if(values.help){console.log(`node scripts/install-skill.mjs --agent codex|claude [--home DIR]`);process.exit(0);}
if(!['codex','claude'].includes(values.agent)){console.error('Choose --agent codex or --agent claude. For Pi, use pi install with this repository path.');process.exit(1);}
const root=fileURLToPath(new URL('../',import.meta.url));
const source=await realpath(path.join(root,'skills',name));
const directory=path.join(values.home??os.homedir(),values.agent==='codex'?'.agents':'.claude','skills');
const target=path.join(directory,name);
await mkdir(directory,{recursive:true});
try{
 await lstat(target);
 if(await realpath(target)===source){console.log(`Already installed: ${target}`);process.exit(0);}
 throw new Error(`A different skill exists at ${target}. Preserve or move it before installing; nothing was overwritten.`);
}catch(error){if(error.code!=='ENOENT')throw error;}
await symlink(source,target,process.platform==='win32'?'junction':'dir');
console.log(`Installed ${name}: ${target} -> ${source}. Keep this checkout in place; restart your agent to discover the skill.`);
