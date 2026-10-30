if(process.argv.includes('--mcp')){
 await import('./mcp.mjs');
}else{
 const {startBoard}=await import('./server.mjs');const {PlanStore}=await import('./plans.mjs');const {requireMarkdown}=await import('./markdown-plan.mjs');
 const cwd=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||process.cwd();
 requireMarkdown(await new PlanStore(cwd).current());
 // Direct CLI launches are review-only unless the caller explicitly selects Pi.
 const usePi=process.argv.includes('--pi')&&!process.argv.includes('--offline');
 const agent=usePi?(await import('./pi-dispatcher.mjs')).createPiDispatcher({cwd}):null;
 const board=await startBoard({cwd,onFeedback:agent?.dispatch,activity:agent?.activity});
 void agent?.warm().catch(()=>{});
 console.log(JSON.stringify({url:board.url,cwd,mode:usePi?'Explicit standalone Pi reviewer':'Offline review; open through your harness for agent feedback'}));
 const current=await board.store.current();if(current)await board.deliver(current.id);
 for(const event of ['SIGINT','SIGTERM'])process.on(event,async()=>{await agent?.close();await board.close();process.exit(0);});
}
