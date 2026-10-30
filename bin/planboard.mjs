#!/usr/bin/env node
const command=process.argv[2];
if(command==='install-skill'){
 process.argv.splice(2,1);
 await import('../scripts/install-skill.mjs');
}else if(command==='mcp'){
 await import('../src/mcp.mjs');
}else if(command==='help'||command==='--help'){
 console.log('Planboard: planboard <project-directory> [--offline|--pi]\nMCP server: planboard mcp\nInstall the skill: planboard install-skill --agent codex|claude\nPi: install this package with pi install.');
}else{
 await import('../src/cli.mjs');
}
