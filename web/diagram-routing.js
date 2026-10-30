// Orthogonal routes around node interiors. Shared by rendering and geometry tests.
export function routeEdge(from, to, boxes) {
  const cx=r=>r.x+r.width/2,cy=r=>r.y+r.height/2;
  let a,b,sa,sb;
  if(from===to){a={x:from.x+from.width,y:cy(from)-12};b={x:a.x,y:a.y+24};return [a,{x:a.x+32,y:a.y},{x:a.x+32,y:b.y},b];}
  if(Math.abs(cx(from)-cx(to))>=Math.abs(cy(from)-cy(to))){const dir=cx(to)>cx(from)?1:-1;a={x:dir>0?from.x+from.width:from.x,y:cy(from)};b={x:dir>0?to.x:to.x+to.width,y:cy(to)};sa={x:a.x+dir*18,y:a.y};sb={x:b.x-dir*18,y:b.y};}
  else {const dir=cy(to)>cy(from)?1:-1;a={x:cx(from),y:dir>0?from.y+from.height:from.y};b={x:cx(to),y:dir>0?to.y:to.y+to.height};sa={x:a.x,y:a.y+dir*18};sb={x:b.x,y:b.y-dir*18};}
  const obstacles=boxes.map(r=>({x:r.x-8,y:r.y-8,width:r.width+16,height:r.height+16}));
  const xs=[...new Set([sa.x,sb.x,...boxes.flatMap(r=>[r.x-24,r.x+r.width+24])])].sort((a,b)=>a-b);
  const ys=[...new Set([sa.y,sb.y,...boxes.flatMap(r=>[r.y-24,r.y+r.height+24])])].sort((a,b)=>a-b);
  const point=(i,j)=>({x:xs[i],y:ys[j]}), inside=p=>obstacles.some(r=>p.x>r.x&&p.x<r.x+r.width&&p.y>r.y&&p.y<r.y+r.height);
  const clear=(p,q)=>!obstacles.some(r=>p.x===q.x?p.x>r.x&&p.x<r.x+r.width&&Math.max(p.y,q.y)>r.y&&Math.min(p.y,q.y)<r.y+r.height:p.y>r.y&&p.y<r.y+r.height&&Math.max(p.x,q.x)>r.x&&Math.min(p.x,q.x)<r.x+r.width);
  const start={i:xs.indexOf(sa.x),j:ys.indexOf(sa.y),cost:0,dir:'',parent:null};let open=[start],seen=new Map(),found;
  while(open.length){open.sort((p,q)=>(p.cost+Math.abs(xs[p.i]-sb.x)+Math.abs(ys[p.j]-sb.y))-(q.cost+Math.abs(xs[q.i]-sb.x)+Math.abs(ys[q.j]-sb.y)));const cur=open.shift();const p=point(cur.i,cur.j);if(p.x===sb.x&&p.y===sb.y){found=cur;break;}for(const [di,dj,dir] of [[1,0,'h'],[-1,0,'h'],[0,1,'v'],[0,-1,'v']]){const i=cur.i+di,j=cur.j+dj;if(i<0||j<0||i>=xs.length||j>=ys.length)continue;const q=point(i,j);if(inside(q)||!clear(p,q))continue;const cost=cur.cost+Math.abs(q.x-p.x)+Math.abs(q.y-p.y)+(cur.dir&&cur.dir!==dir?24:0),key=i+':'+j+':'+dir;if(seen.has(key)&&seen.get(key)<=cost)continue;seen.set(key,cost);open.push({i,j,cost,dir,parent:cur});}}
  if(!found) return [a,sa,{x:sa.x,y:sb.y},sb,b];
  const points=[];for(let cur=found;cur;cur=cur.parent)points.unshift(point(cur.i,cur.j));
  const all=[a,...points,b];return all.filter((p,i)=>i===0||i===all.length-1||!((all[i-1].x===p.x&&p.x===all[i+1].x)||(all[i-1].y===p.y&&p.y===all[i+1].y)));
}
export function routePath(points){return points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');}
export function routeLabel(points){let best={length:0};for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);if(length>best.length)best={length,x:(a.x+b.x)/2,y:(a.y+b.y)/2,horizontal:a.y===b.y};}return best;}
