import {execFileSync} from 'node:child_process';
import {readFile,lstat,access} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const errors=[];
const forbidden=/(^|\/)(node_modules|artifacts|coverage|test-results|playwright-report|\.formative|\.pi|\.impeccable|\.local)(\/|$)|(^|\/)\.env(?:\.|$)|\.tgz$|^examples\/(syntact|real-world)\//;
for(const file of files){
 if(forbidden.test(file)&&!file.endsWith('.env.example'))errors.push(`Private/generated path: ${file}`);
 const full=path.join(root,file),stat=await lstat(full);
 if(stat.isSymbolicLink()){errors.push(`Review symlink before publication: ${file}`);continue;}
 if(!/\.(md|mjs|js|ts|tsx|json|yaml|yml|html|css|py)$/.test(file))continue;
 const source=await readFile(full,'utf8');
 if(file!=='scripts/check-release.mjs'&&/\/(?:home|Users)\/[A-Za-z0-9._-]+\/|(?:\.\.\/){2}[^\s\x27\x22]+\/node_modules\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}/.test(source))errors.push(`Local path or credential marker: ${file}`);
 if(file.endsWith('.md'))for(const match of source.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
  const target=match[1].split('#')[0];
  if(!target||/^(?:[a-z]+:|\/)/i.test(target)||/[<>${}]/.test(target))continue;
  try{await access(path.resolve(path.dirname(full),decodeURIComponent(target)));}catch{errors.push(`Broken document link in ${file}: ${target}`);}
 }
}
for(const file of ['README.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md','docs/installation.md','docs/usage.md','docs/architecture.md'])if(!files.includes(file))errors.push(`Missing release document: ${file}`);
const pkg=JSON.parse(await readFile('package.json','utf8'));
if(pkg.private!==true&&(pkg.publishConfig?.access!=='public'||pkg.publishConfig?.registry!=='https://registry.npmjs.org/'))errors.push('Registry releases must explicitly select public access and the npm registry.');
if(!pkg.repository?.url||!pkg.engines?.node||!pkg.license)errors.push('Package metadata is incomplete.');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Release checks passed for ${files.length} public files. This focused scan does not replace review of the staged diff.`);
