import AtlasMaterialFoundation from '../materials/foundation.js';
import { AtlasMaterialFoundationTests } from '../../tests/material-tests.js';

(function(){
 const gate=document.querySelector('#gate article');
 if(!gate)return;
 const section=document.createElement('div');section.className='box';section.style.marginTop='16px';
 const title=document.createElement('h2');title.textContent='MATERIAL / PHYSICS — CONTRACT FOUNDATION';
 const text=document.createElement('p');text.textContent='Shared contracts and isolated save foundation installed. Use the Phase 2 robot-world section for surface play. Editor and fabrication remain unimplemented.';
 const button=document.createElement('button');button.textContent='Inspect foundation / run contract checks';
 section.append(title,text,button);gate.append(section);
 const overlay=document.createElement('div');overlay.id='atlasMaterialContractsOverlay';
 overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:#020713ed;display:none;place-items:center';
 const article=document.createElement('article');const heading=document.createElement('h1');heading.textContent='MATERIAL WORLD CONTRACTS v1';
 const close=document.createElement('button');close.textContent='Close / return to original menu';
 const pre=document.createElement('pre');article.append(heading,close,pre);overlay.append(article);document.body.append(overlay);
 close.onclick=()=>overlay.style.display='none';
 button.onclick=()=>{
  const A=AtlasMaterialFoundation,r=AtlasMaterialFoundationTests();
  pre.textContent='IMPLEMENTED: shared records, SI units, explicit composition basis, CSG definitions and occupancy, nonrotating frame transforms, microkilogram material ledger, operation replay protection, reservations, versioned snapshot validation, isolated IndexedDB save/load API.\n\nFOUNDATION-ONLY CHECKS: these do not certify the Phase 2 integration. Excavation, editor UI, fabrication and manufactured-body physics remain unimplemented.\n\nDATABASE: '+A.databaseName+'\nNo legacy save keys are written by this inspector. Running checks creates only disposable in-memory fixtures.\n\nCHECKS: '+r.passed+'/'+r.total+'\n'+r.results.map(x=>(x.pass?'PASS ':'FAIL ')+x.name+(x.error?' — '+x.error:'')).join('\n')+'\n\nStorage transaction code still requires browser-based interruption and multi-tab testing. Existing gravity and legacy startup checks remain separate; these checks do not certify them.\n\nPhase 2 uses provisional home-system and terrain settings. Permanent tools and fabrication remain open. The silica fixture is development data, not final geology.';
  overlay.style.display='grid';
 };
})();
