import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const [name,extra]of [['core',{}],['worker',{}],['migration',{}],['migration',{INVALID_SAVE:'1'}]]){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./'+name+'.test.mjs',import.meta.url))],{stdio:'inherit',env:{...process.env,...extra}});if(r.status!==0)process.exit(r.status||1);}
