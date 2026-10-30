import {walkthroughCatalog} from './diagram-walkthroughs.js';
// One catalogue for the agent schema, validation, legend and rendered nodes.
export const nodeTypes = {
  page: { label: 'Page / interface', color: 'blue', icon: 'M3 5h18v14H3z M3 9h18 M6 7h.1 M9 7h.1', description: 'A screen, storefront or other interface someone uses.' },
  person: { label: 'Person', color: 'orange', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3', description: 'A customer, staff member or other human actor.' },
  service: { label: 'Service / API', color: 'green', icon: 'M3 3h18v7H3z M3 14h18v7H3z M6 6.5h.1 M6 17.5h.1 M11 6.5h7 M11 17.5h7', description: 'Backend logic, an API or a hosted commerce service.' },
  database: { label: 'Database', color: 'purple', icon: 'M3 6c0-5 18-5 18 0s-18 5-18 0v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0', description: 'Structured records: products, inventory, accounts or orders. Do not use for a page merely showing those records.' },
  auth: { label: 'Authentication', color: 'pink', icon: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z M9 12l2 2 4-5', description: 'Identity verification, sign-in or access-control responsibility.' },
  payment: { label: 'Payment', color: 'pink', icon: 'M3 5h18v14H3z M3 9h18 M6 15h4', description: 'Payment processing or a checkout payment integration.' },
  storage: { label: 'File storage', color: 'yellow', icon: 'M4 8h7l2-3h7v15H4z M4 8V4h6l3 4', description: 'Images, documents, object storage or other files; distinct from structured database records.' },
  message: { label: 'Notification', color: 'blue', icon: 'M3 5h18v14H3z M3 5l9 8 9-8', description: 'Email, SMS or another customer/staff notification.' },
  decision: { label: 'Decision / condition', color: 'yellow', icon: 'M12 2 22 12 12 22 2 12z M12 6v7 M12 17h.1', description: 'A branch or condition. Label its outgoing connections with the alternatives.' },
  task: { label: 'Task / process', color: 'neutral', icon: 'M5 3h14v18H5z M8 8l2 2 5-5 M8 15h8 M8 18h6', description: 'An operational action or delivery task, such as packing an order.' },
  external: { label: 'External integration', color: 'orange', icon: 'M8 8h8v8H8z M10 2v6 M14 2v6 M10 16v6 M14 16v6 M2 10h6 M2 14h6 M16 10h6 M16 14h6', description: 'A connected outside system such as a till, carrier or third-party integration.' }
};
export const diagramColors = {
  blue: '#57d3e5', green: '#61d7b0', purple: '#bda4ef', pink: '#ef91b2', yellow: '#e9cf67', orange: '#e8ad70', red: '#ee9999', neutral: '#b8c1d5'
};

export const nodeCategories = {
  general: 'Goals, people and planning', web: 'Websites and content', software: 'Apps, APIs and architecture',
  data: 'Data and storage', security: 'Identity and security', operations: 'Delivery and operations',
  business: 'Commerce and product operations'
};
const icons = {
 target:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 10v4 M10 12h4',
 flag:'M5 22V3 M5 3h13l-3 4 3 4H5',
 question:'M8 8a4 4 0 1 1 5 4c-1 0-1 2-1 3 M12 19h.1',
 warning:'M12 3 2 21h20z M12 9v5 M12 17h.1',
 layout:'M3 3h18v18H3z M3 8h18 M9 8v13',
 pointer:'M5 3v16l5-5 4 7 3-2-4-6h7z',
 text:'M3 5h18 M12 5v16 M8 21h8 M3 5v4 M21 5v4',
 search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
 code:'M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18',
 queue:'M3 5h14v4H3z M3 15h14v4H3z M20 7v10 M18 15l2 2 2-2',
 link:'M10 6l2-2a5 5 0 0 1 7 7l-3 3 M14 18l-2 2a5 5 0 0 1-7-7l3-3 M8 16l8-8',
 clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v7l4 2',
 chart:'M3 3v18h19 M7 17V9 M12 17V5 M17 17v-5',
 cloud:'M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12z',
 box:'M3 7l9-5 9 5v11l-9 5-9-5z M3 7l9 5 9-5 M12 12v11',
 people:'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M2 21v-4a5 5 0 0 1 10 0v4 M20 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M14 21v-4a4 4 0 0 1 8 0v4',
};
const existingCategories={page:'web',person:'general',service:'software',database:'data',auth:'security',payment:'business',storage:'data',message:'software',decision:'general',task:'general',external:'software'};
for(const [type,category] of Object.entries(existingCategories))nodeTypes[type].category=category;
const add=(type,label,category,color,icon,description)=>{nodeTypes[type]={label,category,color,icon:icons[icon]||nodeTypes[icon].icon,description};};
add("goal","Goal / outcome","general","green","target","The change the plan should achieve; distinguish it from an activity.");
add("milestone","Milestone","general","yellow","flag","A checkpoint with a clear completion condition, not a fabricated date.");
add("requirement","Requirement","general","neutral","task","An observable need or acceptance condition.");
add("question","Open question","general","yellow","question","An unresolved decision requiring an answer or evidence.");
add("constraint","Constraint","general","orange","auth","A real limit on budget, time, scope or compatibility; state its source.");
add("risk","Risk","general","red","warning","An uncertain event with impact, mitigation and a way to detect it.");
add("deliverable","Deliverable","general","green","box","A concrete artifact or result to review.");
add("note","Note / explanation","general","neutral","text","Context that clarifies the plan without implying an action.");
add("section","Page section","web","blue","layout","A section with a visitor question, content purpose and next action.");
add("navigation","Navigation","web","blue","link","Links or navigation hierarchy; distinguish from a sequence of tasks.");
add("cta","Call to action","web","green","pointer","A user action with a clear outcome.");
add("form","Form","web","blue","task","Input collection, validation, submission and recovery.");
add("content","Content item","web","blue","text","Copy, an article, a product description or other editorial content.");
add("proof","Proof / testimonial","web","green","auth","Verifiable evidence for a claim; never invent endorsements or results.");
add("pricing","Pricing / offer","web","yellow","payment","An offer and its disclosed terms; numbers need evidence.");
add("faq","FAQ / support content","web","blue","question","Answers to real objections or recurring questions.");
add("search","Search interface","web","blue","search","Search input, filters, results and empty states.");
add("component","UI component","web","blue","layout","A reusable interface unit with behavior and states.");
add("client","Client application","software","blue","page","A browser, mobile or desktop application consuming services.");
add("api","API / interface contract","software","green","code","A published interface and its consumers; specify protocol in the explanation.");
add("endpoint","API operation","software","green","link","A particular operation with inputs, outputs and failure responses.");
add("module","Module / package","software","green","box","A cohesive code responsibility or library boundary.");
add("function","Function / command","software","green","code","A focused operation with defined inputs and outputs.");
add("worker","Background worker","software","green","service","Work outside the interactive request; explain retries and ownership.");
add("queue","Queue / topic","software","yellow","queue","Buffered messages or published events; distinguish delivery semantics.");
add("event","Event","software","yellow","flag","Something that happened; name it in past tense when useful.");
add("webhook","Webhook","software","orange","link","An external event callback with verification and replay behavior.");
add("state","State","software","neutral","decision","A condition in a lifecycle; label transitions with their triggers.");
add("scheduler","Scheduler","software","yellow","clock","Time-based work with timezone and duplicate-run considerations.");
add("ai_model","AI model / inference","software","purple","service","A model responsibility with inputs, limitations and evaluation; not assumed autonomous.");
add("entity","Data entity","data","purple","database","A domain record type and its relationships.");
add("schema","Schema / data contract","data","purple","code","The structure and constraints of exchanged or stored data.");
add("cache","Cache","data","yellow","database","Derived fast-access data with expiry and invalidation behavior.");
add("search_index","Search index","data","purple","search","Searchable derived data; name its source and refresh behavior.");
add("dataset","Dataset","data","purple","chart","A collection of observations with provenance and intended use.");
add("backup","Backup / archive","data","purple","storage","A recoverable copy; recovery expectations need a restore check.");
add("permission","Permission / role","security","pink","auth","Who can do what; separate authorization from sign-in.");
add("secret","Secret / credential","security","pink","auth","Credential ownership or storage responsibility; never put actual secrets in plans.");
add("policy","Policy / rule","security","pink","task","An explicit business or security rule and how it is applied.");
add("boundary","Trust boundary","security","pink","layout","A boundary across which trust changes; a colored box is not a security guarantee.");
add("deployment","Deployment","operations","orange","cloud","How a version reaches an environment and how it is reverted.");
add("server","Compute / host","operations","green","service","A runtime host or compute responsibility; do not assume a vendor.");
add("network","Network / gateway","operations","orange","link","Connectivity, routing or ingress between systems.");
add("monitor","Monitoring / alert","operations","yellow","chart","A signal, threshold, owner and response.");
add("log","Log / trace","operations","neutral","text","Operational evidence for diagnosis; note sensitive fields and retention.");
add("test","Test / validation","operations","green","task","A check of observable behavior with expected results.");
add("rollback","Rollback / recovery","operations","orange","clock","A route back to a working state and a trigger to use it.");
add("product","Product / offering","business","orange","box","A product or service offered to a defined audience.");
add("order","Order / commitment","business","purple","task","A purchase or service commitment and its lifecycle.");
add("inventory","Inventory / capacity","business","purple","box","Available stock or capacity, its owner and update rules.");
add("customer","Customer / audience","business","orange","person","A customer segment or participant; distinguish evidence from a hypothetical persona.");
add("team","Team / owner","business","orange","people","People responsible for decisions and handoffs.");
add("supplier","Supplier / partner","business","orange","external","An outside party and its obligations or dependencies.");
add("channel","Channel","business","blue","link","How people discover, buy, receive or get support for an offering.");
add("metric","Metric / measure","business","yellow","chart","An outcome measure with a definition; no fabricated targets or data.");
add("budget","Budget / cost","business","yellow","payment","An estimate or limit with assumptions, currency and source.");
add("custom","Custom domain concept","general","neutral","task","Use customType with a label, description and built-in baseType for an otherwise unsupported domain concept.");

export function resolveNodeType(node) {
  const type=nodeTypes[node.type || 'service'];
  if(node.type!=='custom')return type;
  const custom=node.customType;
  return {...nodeTypes[custom.baseType],label:custom.label,description:custom.description};
}
export function diagramCatalog({category,query}={}) {
  if(category!==undefined&&!Object.hasOwn(nodeCategories,category))throw new Error('Unknown node category. Use catalog without filters to discover categories.');
  if(query!==undefined&&(typeof query!=='string'||query.length>160))throw new Error('Catalog query must be text up to 160 characters.');
  const terms=(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches=Object.entries(nodeTypes).filter(([type,n])=>(!category||n.category===category)&&terms.every(term=>[type,n.label,n.description,n.category].join(' ').toLowerCase().includes(term)));
  const detailed=Boolean(category||terms.length);
  return {
    categories:Object.entries(nodeCategories).map(([id,label])=>({id,label,count:Object.values(nodeTypes).filter(n=>n.category===id).length})),
    totalTypes:Object.keys(nodeTypes).length,matchedTypes:matches.length,
    nodeTypes:matches.map(([type,{icon,description,...info}])=>({type,...info,...(detailed?{description}:{})})),
    discovery:'Use category and/or query for detailed matching entries. These filters affect discovery only, not saved plan capabilities. Choose a small relevant vocabulary per map.',
    colors:diagramColors,walkthroughs:walkthroughCatalog(),
    custom:'For an unsupported concept, use type:"custom", customType:{label,description,baseType}. baseType is an existing non-custom type whose visual semantics fit. This reuses its icon and palette; no raw SVG, CSS or scripts.',
    groups:'Optional labeled regions {id,title,nodeIds,color}. Each node belongs to at most one region. Keep unrelated nodes outside the region.',
    edges:'Connections {from,to,label,detail,style?}. Solid: main path; dashed: alternate/conditional path. Arrow color follows source type. Label the actual relationship.',
    layout:'Column and row indices already include gutters (320 by 178 units). Use consecutive indices by default; empty columns make fit views tiny. Keep compact diagrams and split large topics.',
    focus:'Layers dim unrelated parts without changing positions or type colors. Authored walkthroughs select the initial journey; the full map remains available as a secondary view.',
    limits:'Use maps to explain website structure, software behavior and delivery dependencies. The planner does not generate design assets.'
  };
}
