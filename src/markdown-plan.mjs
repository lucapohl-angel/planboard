import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {markdownHeadings} from '../web/source-links.js';
import {requireWalkthroughs} from './diagrams.mjs';

export async function readMarkdownPlan(cwd,filename){
 if(typeof filename!=='string'||!filename.trim()||! /\.(md|markdown)$/i.test(filename))throw new Error('Write the plan to a .md file first, then supply markdownPath.');
 const file=await realpath(path.resolve(cwd,filename));if(file===path.resolve(cwd,'.pi/plans/plan.md'))throw new Error('Choose an authored Markdown plan, not the viewer-generated .pi/plans/plan.md export.');const info=await stat(file);
 if(!info.isFile()||info.size>800000)throw new Error('The Markdown plan must be a file no larger than 800 KB.');
 const content=await readFile(file,'utf8');if(!content.trim()||content.length>200000)throw new Error('The Markdown plan must contain text, at most 200000 characters.');
 const headings=markdownHeadings(content),breaks=[0,...headings.map(h=>h.start).filter(n=>n>0),content.length];
 const sections=[];let start=0;
 // Preserve every character. Split large sections to match the existing archival limits.
 while(start<content.length){let end=breaks.findLast(n=>n>start&&n<=start+40000)||Math.min(start+40000,content.length);const heading=headings.find(h=>h.start===start);sections.push({id:'source-'+sections.length,title:heading?.title.slice(0,300)||'Original plan'+(sections.length?' (continued)':''),content:content.slice(start,end)});start=end;}
 return {name:path.basename(file),path:file,sha256:createHash('sha256').update(content).digest('hex'),sections};
}
export function requireMarkdown(record){
 if(!record?.plan?.sourceDocument?.sections?.some(s=>s.content.trim()))throw new Error('This viewer needs a plan Markdown file first. Write or select one, then save with markdownPath.');
 return record;
}
export async function saveMarkdownPlan(store,args){
 requireWalkthroughs(args.plan);
 const previous=args.id?await store.read(args.id):null;
 const source=previous?.plan.sourceDocument||await readMarkdownPlan(store.cwd,args.markdownPath);
 requireMarkdown({plan:{sourceDocument:source}});
 const result=await store.save({...args.plan,sourceDocument:source},{...(args.id?{id:args.id}:{}),expectedRevision:args.expectedRevision,reviewedMarkdown:args.reviewedMarkdown,sourceEdits:args.sourceEdits,questionId:args.questionId,answer:args.answer});
 return requireMarkdown(result);
}
