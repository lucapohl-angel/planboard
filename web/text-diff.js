// Bounded, deterministic diff shared by the viewer and Markdown undo.
export function textDiff(before = '', after = '', {lines = false} = {}) {
  if (before === after) return before ? [{kind:'same',text:before}] : [];
  const tokenize = s => lines ? s.match(/[^\n]*\n|[^\n]+$/g) || [] : s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  const a=tokenize(before),b=tokenize(after);let start=0,end=0;
  while(start<a.length&&start<b.length&&a[start]===b[start])start++;
  while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
  const x=a.slice(start,a.length-end),y=b.slice(start,b.length-end),out=[];
  const push=(kind,text)=>{if(!text)return;if(out.at(-1)?.kind===kind)out.at(-1).text+=text;else out.push({kind,text});};
  push('same',a.slice(0,start).join(''));
  if((x.length+1)*(y.length+1)>500000){
    // Large rewrites get a conservative contiguous diff, never unbounded work.
    push('removed',x.join(''));push('added',y.join(''));
  }else{
    const width=y.length+1,dp=new Uint32Array((x.length+1)*width);
    for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)dp[i*width+j]=x[i]===y[j]?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
    let i=0,j=0;
    while(i<x.length||j<y.length){
      if(i<x.length&&j<y.length&&x[i]===y[j]){push('same',x[i++]);j++;}
      else if(i<x.length&&(j===y.length||dp[(i+1)*width+j]>=dp[i*width+j+1]))push('removed',x[i++]);
      else push('added',y[j++]);
    }
  }
  push('same',end?a.slice(a.length-end).join(''):'');return out;
}

export function addedRanges(before,after){
  let offset=0;const ranges=[];
  for(const part of textDiff(before,after)){if(part.kind==='removed')continue;if(part.kind==='added')ranges.push({start:offset,end:offset+part.text.length});offset+=part.text.length;}
  return ranges;
}
