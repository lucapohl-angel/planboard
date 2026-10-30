import {walkthroughCatalog} from '../web/diagram-walkthroughs.js';
import {planFields} from '../web/plan-content.js';
export const blockTypes=['text','list','table','sequence','code','field','diagrams','tasks','technologies','decisions'];
const refs={diagrams:'diagrams',tasks:'steps',technologies:'technologies',decisions:'questions'};
const fail=message=>{throw new Error(message);};
const text=(v,name,max=12000)=>typeof v==='string'&&v.length<=max?v.trim():fail(name+' must be text up to '+max+' characters.');
const array=(v,name,max=60)=>Array.isArray(v)&&v.length<=max?v:fail(name+' must be an array up to '+max+' items.');
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(v)?v:fail('Document IDs must be short lowercase IDs.');
function unique(items,name){if(new Set(items.map(x=>x.id)).size!==items.length)fail(name+' IDs must be unique.');return items;}
export function documentSections(input,plan){
 const used=new Set(),fields=planFields(plan);let count=0;
 const sections=unique(array(input,'Sections',30).map(s=>({id:id(s.id),title:text(s.title,'Section title',160),summary:text(s.summary??'','Section summary',1000),collapsed:s.collapsed===true,
  blocks:unique(array(s.blocks,'Blocks',30).map(b=>{
   if(++count>120)fail('A document can contain at most 120 blocks.');
   if(!blockTypes.includes(b.type))fail('Unknown document block type: '+b.type);
   const out={id:id(b.id),type:b.type,title:text(b.title??'','Block title',160),collapsed:b.collapsed===true};
   if(out.collapsed&&!out.title)fail('A collapsed block needs a visible title.');
   if(['text','code'].includes(b.type)){out.text=text(b.text,'Block text',40000);if(b.type==='code')out.text=b.text;}
   if(['list','sequence'].includes(b.type)){out.items=unique(array(b.items,'Items').map(i=>({id:id(i.id),label:text(i.label,'Item label',1000),detail:text(i.detail??'','Item detail')})),'Item');if(!out.items.length||out.items.some(i=>!i.label))fail('List and sequence items need labels.');}
   if(b.type==='table'){
    out.columns=array(b.columns,'Columns',8).map(c=>text(c,'Column heading',160));
    out.rows=unique(array(b.rows,'Rows',40).map(r=>({id:id(r.id),cells:array(r.cells,'Cells',8).map(c=>text(c,'Cell',4000))})),'Row');
    if(!out.columns.length||out.rows.some(r=>r.cells.length!==out.columns.length))fail('Table rows must match the column count.');
   }
   if(b.type==='field'){
    out.path=text(b.path,'Field path',1000);
    if(!fields.has(out.path)&&!['success','scope/now','scope/later','scope/out'].includes(out.path))fail('Document field must reference existing plan text or a supported list.');
    if(out.path.startsWith('sourceDocument/')||out.path.startsWith('sections/'))fail('Source documents and document sections cannot be field references.');
   }
   if(refs[b.type]){
    out.ids=array(b.ids,'Reference IDs',40).map(id);if(!out.ids.length)fail('Reference blocks need at least one item.');
    for(const ref of out.ids){const key=refs[b.type]+':'+ref;if(!plan[refs[b.type]].some(x=>x.id===ref))fail('Unknown document reference: '+key);if(used.has(key))fail('Repeated document reference: '+key);used.add(key);}
   }
   return out;
  }),'Block')
 })),'Section');
 if(!sections.length||sections.some(s=>!s.title||!s.blocks.length))fail('Document sections need a title and content.');
 for(const collection of Object.values(refs))for(const item of plan[collection])if(!used.has(collection+':'+item.id))fail('Place '+collection+'/'+item.id+' in a document block so it can be reviewed.');
 return sections;
}
export function workflow(value){
 if(value===undefined)return undefined;
 const name=text(value.name,'Workflow name',160);if(!name)fail('Workflow name cannot be empty.');
 return {name,source:text(value.source??'','Workflow source',2000),constraints:array(value.constraints??[],'Workflow constraints',30).map(x=>text(x,'Workflow constraint',2000))};
}
export function documentMarkdown(p,{technologyMarkdown,diagramMarkdown}){
 const fields=planFields(p),out=[];
 if(p.workflow){out.push(`Workflow: ${p.workflow.name}`);if(p.workflow.source)out.push('Workflow source: '+p.workflow.source);if(p.workflow.constraints.length)out.push('Workflow constraints:\n'+p.workflow.constraints.map(s=>'- '+s).join('\n'));}
 const escape=s=>s.replaceAll('|','\\|').replaceAll('\n','<br>');
 for(const s of p.sections){out.push('## '+s.title);if(s.summary)out.push(s.summary);
  for(const b of s.blocks){if(b.title)out.push('### '+b.title);
   if(b.type==='text')out.push(b.text);
   if(b.type==='code'){const fence='`'.repeat(Math.max(3,...[...b.text.matchAll(/`+/g)].map(m=>m[0].length+1)));out.push(fence+'\n'+b.text+'\n'+fence);}
   if(b.type==='field'){const v=fields.get(b.path);out.push(v??(b.path.split('/').reduce((v,k)=>v[k],p).map(v=>'- '+v).join('\n')));}
   if(['list','sequence'].includes(b.type))out.push(b.items.map((i,n)=>(b.type==='sequence'?(n+1)+'. ':'- ')+i.label+(i.detail?' — '+i.detail:'')).join('\n'));
   if(b.type==='table')out.push('| '+b.columns.map(escape).join(' | ')+' |\n| '+b.columns.map(()=>'---').join(' | ')+' |\n'+b.rows.map(r=>'| '+r.cells.map(escape).join(' | ')+' |').join('\n'));
   if(b.type==='technologies')out.push(technologyMarkdown(b.ids.map(id=>p.technologies.find(t=>t.id===id)),p.technologies).replace(/^## Tools & technology\n\n/,''));
   if(b.type==='diagrams')out.push(diagramMarkdown(b.ids.map(id=>p.diagrams.find(d=>d.id===id))).replace(/^## How it works\n\n/,''));
   if(b.type==='tasks')for(const id of b.ids){const t=p.steps.find(t=>t.id===id);out.push('### '+t.title+'\n\n'+['Status: '+t.status.replaceAll('_',' '),t.summary,t.why,t.deliverable,t.dependsOn.length?'Depends on: '+t.dependsOn.join(', '):'',...t.acceptance.map(c=>'- [ ] '+c)].filter(Boolean).join('\n\n'));}
   if(b.type==='decisions')for(const id of b.ids){const q=p.questions.find(q=>q.id===id);out.push('### '+q.question+'\n\n'+[q.why,...q.options.map(o=>'- '+o.label+': '+o.benefit+' Tradeoff: '+o.tradeoff),q.recommendation?'Recommendation: '+q.recommendation:''].filter(Boolean).join('\n\n'));}
  }
 }
 return out.join('\n\n');
}
export function documentCatalog(){return {
 schemaVersion:2,
 walkthroughs:walkthroughCatalog(),
 purpose:'The workflow authors section titles, order, content and constraints. The viewer only presents and annotates it.',
 section:{id:'stable-id',title:'Authored heading',summary:'Optional short introduction',collapsed:false,blocks:[]},
 blocks:[
  {type:'text',fields:['text'],use:'Readable prose; plain text, never executable HTML.'},
  {type:'list',fields:['items:[{id,label,detail?}]'],use:'Outcomes, constraints, scenarios or planned checks.'},
  {type:'sequence',fields:['items:[{id,label,detail?}]'],use:'A user journey, BDD scenario, TDD cycle or any ordered process. Labels come from the author.'},
  {type:'table',fields:['columns:string[]','rows:[{id,cells:string[]}]'],use:'Compare alternatives using shared criteria.'},
  {type:'code',fields:['text'],use:'Commands or code examples displayed without execution.'},
  {type:'field',fields:['path'],use:'Display existing plan text, success or scope lists without copying it.'},
  ...Object.entries(refs).map(([type,collection])=>({type,fields:['ids:string[]'],use:'Place selected '+collection+' at this point in the document.'}))
 ],
 commonBlockFields:['id','type','title?','collapsed? (requires title)'],
 workflow:{name:'Any selected method, not an enum',source:'Optional skill or source document reference',constraints:['Relevant workflow requirements supplied by the author']},
 rules:['Use stable IDs. No required five-section template.','Reference every defined technology, task, decision and diagram exactly once.','No inferred test passes or automatic execution.','Write or select a plan Markdown file first. New saves require markdownPath; the tool reads and archives its exact text. Keep the human review view concise. Phase codes and unique heading names link back to the original source.']
};}
