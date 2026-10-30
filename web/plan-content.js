// Shared by the browser and storage validation. Stable IDs anchor notes across array reordering.
export function planFields(plan) {
  const fields = new Map();
  function walk(value, path) {
    if (typeof value === 'string') fields.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, path + '/' + (item?.id ?? item?.nodeId ?? index)));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) walk(item, path ? path + '/' + key : key);
  }
  walk(plan, ''); return fields;
}
export function planTargets(plan) {
  return new Map([
    ...(plan.sections||[]).flatMap(s=>[['section:'+s.id,s.title],...s.blocks.map(b=>['block:'+s.id+':'+b.id,b.title||s.title])]),
    ['overview', 'Plan overview'], ['technology','Tools and technology'], ['system', 'How it works'], ['delivery', 'Order of work'], ['decisions', 'Decisions'], ['quality', 'Plan checks'], ['context', 'Facts and assumptions'], ['feedback:overall', 'Overall feedback'],
    ...Object.entries(plan.scope).map(([key, values]) => ['scope:' + key, values.join('\n') || key]),
    ...(plan.technologies || []).map(t=>['technology:'+t.id,t.name+' — '+t.role]),
    ...plan.steps.flatMap(s => [['step:' + s.id, s.title], ['feedback:step:' + s.id, 'Feedback on ' + s.title]]),
    ...plan.questions.map(q => ['question:' + q.id, q.question]),
    ...(plan.diagrams || []).flatMap(d => [['diagram:' + d.id, d.title], ...(d.groups || []).map(g => ['group:' + d.id + ':' + g.id, g.title])])
  ]);
}

export function mermaidSource(diagram, layer) {
  // Export source only. Never execute supplied Mermaid directives, HTML or click handlers.
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', ' ');
  const ids = new Map(diagram.nodes.map((n, i) => [n.id, 'n' + i]));
  const nodeLine = n => `  ${ids.get(n.id)}${n.type === 'database' ? '[("' : '["'}${escape(n.label)}${n.type === 'database' ? '")]' : '"]'}`;
  const grouped = new Set((diagram.groups || []).flatMap(g => g.nodeIds));
  return 'flowchart LR\n' + (diagram.groups || []).map((g,i) => `  subgraph g${i}["${escape(g.title)}"]\n${diagram.nodes.filter(n=>g.nodeIds.includes(n.id)).map(nodeLine).join('\n')}\n  end`).join('\n') + '\n' + diagram.nodes.filter(n=>!grouped.has(n.id)).map(nodeLine).join('\n') + '\n' + layer.edges.map(e => `  ${ids.get(e.from)} ${e.style === 'dashed' ? '-.->' : '-->'}|"${escape(e.label)}"| ${ids.get(e.to)}`).join('\n');
}

// Manual editing changes prose and values, not the labels that organize or operate
// the viewer. Agent-requested structural changes still use the regular patch tool.
export function isManualEditField(path) {
  if(typeof path!=='string')return false;
  return /^(brief|objective|success\/\d+|scope\/[^/]+\/\d+|context\/[^/]+\/(detail|source))$/.test(path)
    || /^technologies\/[^/]+\/(role|rationale|tradeoffs|fitDetail|versionPlan|source|(checks|alternatives|impacts)\/\d+)$/.test(path)
    || /^steps\/[^/]+\/(summary|why|deliverable|acceptance\/\d+)$/.test(path)
    || /^questions\/[^/]+\/(why|recommendation|options\/[^/]+\/(benefit|tradeoff))$/.test(path)
    || /^diagrams\/[^/]+\/(description|layers\/[^/]+\/(description|nodes\/[^/]+\/(summary|detail)|edges\/[^/]+\/detail)|walkthroughs\/[^/]+\/(intro|result|steps\/[^/]+\/explanation))$/.test(path)
    || /^sections\/[^/]+\/(summary|blocks\/[^/]+\/(text|items\/[^/]+\/(label|detail)|rows\/[^/]+\/cells\/\d+))$/.test(path);
}
