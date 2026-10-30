import {readFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function piRuntime(){
 if(process.env.PLANBOARD_PI_CORE)return process.env.PLANBOARD_PI_CORE;
 try{const core=path.join(path.dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))),'core');await access(path.join(core,'extensions/loader.js'));return core;}catch{}
 try{const version=(await readFile(path.join(os.homedir(),'.pi/agent/install/current-version'),'utf8')).trim();return path.join(os.homedir(),`.pi/agent/install/releases/${version}/node_modules/@earendil-works/pi-coding-agent/dist/core`);}catch{return null;}
}
