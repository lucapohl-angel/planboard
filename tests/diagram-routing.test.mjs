import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeEdge} from '../web/diagram-routing.js';
import {diagrams} from '../src/diagrams.mjs';
import {diagramCatalog} from '../web/diagram-spec.js';
const example=JSON.parse(await readFile(new URL('../examples/login-flow.json',import.meta.url)));
const box=(x,y)=>({x,y,width:208,height:88});
const crosses=(a,b,r)=>a.x===b.x?a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height:a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width;
test('orthogonal routes avoid node interiors for all directions, obstacles and loops',()=>{
 const boxes=Array.from({length:9},(_,i)=>box(56+i%3*320,62+Math.floor(i/3)*178));
 for(const from of boxes)for(const to of boxes){const route=routeEdge(from,to,boxes);assert.ok(route.length>=2);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];assert.ok(a.x===b.x||a.y===b.y);for(const obstacle of boxes)assert.equal(crosses(a,b,obstacle),false,JSON.stringify({from,to,a,b,obstacle}));}}
});
test('catalog types, regions and connection styles survive validation; invalid values fail',()=>{
 const d=diagrams(example.diagrams)[0];assert.equal(d.nodes.find(n=>n.id==='accounts').type,'database');assert.ok(d.groups.length);assert.ok(d.layers.some(l=>l.edges.some(e=>e.style==='dashed')));
 assert.ok(diagramCatalog().nodeTypes.some(n=>n.type==='endpoint'));assert.ok(!diagramCatalog().nodeTypes.some(n=>n.type==='sketch'));
 for(const edit of [d=>d.nodes[0].type='invented',d=>d.groups[0].nodeIds.push('missing'),d=>d.groups[1].nodeIds.push(d.groups[0].nodeIds[0]),d=>d.layers[0].edges[0].style='invented']) {const bad=structuredClone(example.diagrams);edit(bad[0]);assert.throws(()=>diagrams(bad));}
 const legacy=structuredClone(example.diagrams);for(const n of legacy[0].nodes)delete n.type;delete legacy[0].groups;assert.equal(diagrams(legacy)[0].nodes[0].type,'service');
});
test('catalog discovery narrows by responsibility and rejects invalid category filters',()=>{
 const overview=diagramCatalog();assert.equal(overview.categories.reduce((n,c)=>n+c.count,0),overview.totalTypes);assert.ok(!('description' in overview.nodeTypes[0]));
 const match=diagramCatalog({category:'software',query:'QUEUE'});assert.ok(match.nodeTypes.some(n=>n.type==='queue'));assert.ok(match.nodeTypes.every(n=>n.category==='software'&&n.description));
 assert.equal(diagramCatalog({category:'web',query:'database'}).matchedTypes,0);
 assert.throws(()=>diagramCatalog({category:'missing'}),/category/);assert.throws(()=>diagramCatalog({query:'x'.repeat(161)}),/160/);
});
test('custom domain nodes preserve their definition and reject missing, recursive or inconsistent visual bases',()=>{
 const input=structuredClone(example.diagrams),n=input[0].nodes[0];n.type='custom';n.customType={label:'Build artifact',description:'A signed release package.',baseType:'storage'};
 assert.deepEqual(diagrams(input)[0].nodes[0].customType,n.customType);
 for(const change of [n=>delete n.customType,n=>n.customType.baseType='custom',n=>n.customType.baseType='constructor',n=>n.customType.label='',n=>n.type='task']){const bad=structuredClone(input);change(bad[0].nodes[0]);assert.throws(()=>diagrams(bad));}
 const bad=structuredClone(input);bad[0].nodes[1].type='custom';bad[0].nodes[1].customType={...n.customType,baseType:'database'};assert.throws(()=>diagrams(bad),/consistent meaning/);
});
