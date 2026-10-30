import { nodeTypes } from '../web/diagram-spec.js';
const fail = message => { throw new Error(message); };
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value) ? value : fail('Diagram IDs must be short lowercase identifiers.');
const text = (value, max = 6000) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail('Diagram labels and explanations must be nonempty text.');
const list = (value, max) => Array.isArray(value) && value.length <= max ? value : fail('Diagram list is missing or too large.');
const unique = values => { if (new Set(values).size !== values.length) fail('Diagram IDs and positions must be unique.'); };
export function diagrams(input = []) {
  const result = list(input, 8).map(d => {
    const nodes = list(d.nodes, 24).map(n => {
      const type = n.type ?? 'service';
      if (!Object.hasOwn(nodeTypes, type)) fail('Unknown diagram node type. Use plan_board catalog.');
      const result = { id:id(n.id), label:text(n.label,160), type, column:position(n.column), row:position(n.row) };
      if (type === 'custom') {
        const c = n.customType;
        if (!c || !Object.hasOwn(nodeTypes,c.baseType) || c.baseType === 'custom') fail('Custom nodes need a built-in non-custom baseType.');
        result.customType = {label:text(c.label,80),description:text(c.description,600),baseType:c.baseType};
      } else if (n.customType !== undefined) fail('customType is only valid for custom nodes.');
      return result;
    });
    const customLabels = new Map();
    for (const n of nodes.filter(n=>n.type==='custom')) {
      const key=n.customType.label.toLowerCase(),signature=JSON.stringify(n.customType);
      if(customLabels.has(key)&&customLabels.get(key)!==signature)fail('A custom type label must have a consistent meaning and appearance within a diagram.');
      customLabels.set(key,signature);
    }
    if (!nodes.length) fail('A diagram needs nodes.');
    unique(nodes.map(n => n.id)); unique(nodes.map(n => `${n.column}:${n.row}`));
    const known = new Set(nodes.map(n => n.id));
    const layers = list(d.layers, 7).map((l, index) => {
      const details = list(l.nodes, 24).map(n => ({ nodeId: id(n.nodeId), summary: text(n.summary, 240), detail: text(n.detail) }));
      unique(details.map(n => n.nodeId));
      if (!details.length || details.some(n => !known.has(n.nodeId))) fail('Layers must explain their participating nodes using stable IDs.');
      const edges = list(l.edges, 80).map(e => ({ from: id(e.from), to: id(e.to), label: text(e.label, 160), detail: text(e.detail), style: ['solid','dashed'].includes(e.style ?? 'solid') ? e.style ?? 'solid' : fail('Connection style must be solid or dashed.') }));
      if (edges.some(e => !known.has(e.from) || !known.has(e.to))) fail('Diagram connections must reference known nodes.');
      const members = new Set(details.map(n => n.nodeId));
      if (edges.some(e => !members.has(e.from) || !members.has(e.to))) fail('Each connection endpoint needs an explanation in its layer.');
      const colors = ['green', 'yellow', 'orange', 'red', 'pink', 'purple', 'blue'];
      const color = l.color ?? colors[index]; if (!colors.includes(color)) fail('Choose a supported diagram layer color.');
      return { id: id(l.id), title: text(l.title, 160), description: text(l.description), color, nodes: details, edges };
    });
    unique(layers.map(l => l.id)); if (!layers.length) fail('A diagram needs at least one layer.');
    const groups = list(d.groups ?? [], 12).map(g => ({ id: id(g.id), title: text(g.title, 160), color: ['blue','green','purple','pink','yellow','orange','red','neutral'].includes(g.color ?? 'neutral') ? g.color ?? 'neutral' : fail('Unknown region color.'), nodeIds: list(g.nodeIds,24).map(id) }));
    unique(groups.map(g => g.id)); unique(groups.flatMap(g => g.nodeIds));
    if (groups.some(g => !g.nodeIds.length || g.nodeIds.some(id => !known.has(id)))) fail('Regions must contain known nodes.');
    const walkthroughs=list(d.walkthroughs??[],8).map(w=>{
      const steps=list(w.steps,24).map(s=>{const nodeIds=list(s.nodeIds,24).map(id);unique(nodeIds);if(!nodeIds.length||nodeIds.some(n=>!known.has(n)))fail('Walkthrough steps must reference existing nodes.');
        const edges=list(s.edges??[],40).map(e=>({layerId:id(e.layerId),from:id(e.from),to:id(e.to)}));unique(edges.map(e=>e.layerId+':'+e.from+':'+e.to));
        for(const e of edges)if(!layers.find(l=>l.id===e.layerId)?.edges.some(x=>x.from===e.from&&x.to===e.to)||!nodeIds.includes(e.from)||!nodeIds.includes(e.to))fail('Walkthrough edges must match an existing directed connection and its step nodes.');
        return {id:id(s.id),title:text(s.title,160),explanation:text(s.explanation,1600),nodeIds,edges};});
      unique(steps.map(s=>s.id));if(!steps.length)fail('Walkthroughs need steps.');if(!['journey','reading-guide'].includes(w.kind))fail('Walkthrough kind must be journey or reading-guide.');
      return {id:id(w.id),title:text(w.title,160),kind:w.kind,intro:text(w.intro,1200),result:text(w.result,1200),steps};});unique(walkthroughs.map(w=>w.id));
    return { id: id(d.id), title: text(d.title, 160), description: text(d.description), nodes, layers, groups, ...(walkthroughs.length?{walkthroughs}:{}) };
  });
  unique(result.map(d => d.id)); return result;
}
function position(n) { return Number.isInteger(n) && n >= 0 && n <= 11 ? n : fail('Diagram rows and columns must be integers from 0 to 11.'); }

export function requireWalkthroughs(plan){const missing=(plan?.diagrams||[]).filter(d=>!d.walkthroughs?.length);if(missing.length)throw Error('Add plain-language walkthroughs before saving these diagrams: '+missing.map(d=>d.id).join(', ')+'. Use catalogKind=document for the walkthrough contract. Existing records remain readable; patch can make focused text corrections.');}
