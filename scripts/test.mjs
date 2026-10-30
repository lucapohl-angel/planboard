import {readdir,mkdir,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const mode=process.argv[2]??'all';
if(!['all','unit','browser'].includes(mode))throw new Error('Choose all, unit, or browser.');
await mkdir('artifacts',{recursive:true});
const files=[];
for(const name of (await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).sort()){
 const browser=(await readFile(`tests/${name}`,'utf8')).includes("from 'playwright'");
 if(mode==='all'||(mode==='browser')===browser)files.push(`tests/${name}`);
}
const child=spawn(process.execPath,['--test','--test-concurrency=2',...files],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
