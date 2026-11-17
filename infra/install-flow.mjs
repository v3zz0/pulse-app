import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import{createRequire}from'node:module';import{execFileSync}from'node:child_process';
const require=createRequire(import.meta.url),{sanitize}=require('../backend/src/pulse/flow/svg');
const lock=JSON.parse(await fs.readFile(new URL('../backend/flow.lock.json',import.meta.url)));
const value=flag=>process.argv[process.argv.indexOf(flag)+1];
if(!process.argv.includes('--source'))throw new Error('Uso: node infra/install-flow.mjs --source repository-flow [--target storage/flow]');
const source=path.resolve(value('--source')),target=path.resolve(process.argv.includes('--target')?value('--target'):'storage/flow'),dest=path.join(target,lock.revision);
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==lock.revision)throw new Error('Commit Flow diverso dal lock');
if(execFileSync('git',['-C',source,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw new Error('Sorgente Flow modificata');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const[f,expected]of Object.entries(lock.files))if(sha(await fs.readFile(path.join(source,f)))!==expected)throw new Error('Hash metadati/licenze non valido: '+f);
const exercises=JSON.parse(await fs.readFile(path.join(source,'data/exercises.json'))),sums=JSON.parse(await fs.readFile(path.join(source,'data/checksums.json')));
if(exercises.length!==lock.counts.exercises)throw new Error('Conteggio catalogo errato');
await fs.mkdir(target,{recursive:true});const stage=await fs.mkdtemp(path.join(target,'.flow-install-'));const assets={};let count=0;
try{
 for(const e of exercises){
  if(!/^\d{4}$/.test(e.id))throw new Error('ID Flow non valido');
  if(!e.animation)continue;
  const provenance=JSON.parse(await fs.readFile(path.join(source,e.animation.provenance)));
  await fs.mkdir(path.join(stage,'assets',e.id),{recursive:true});
  for(const [i,file]of e.animation.frames.entries()){
   if(file!==`assets/${e.id}/frame-0${i}.svg`)throw new Error('Percorso non ammesso');
   const raw=await fs.readFile(path.join(source,file));if(sha(raw)!==sums[file]||sha(raw)!==provenance.frames[i].sha256)throw new Error('SHA-256 non valido: '+file);
   const safe=Buffer.from(sanitize(raw.toString('utf8')));await fs.writeFile(path.join(stage,file),safe);
   assets[file]={sha256:sha(safe),originalSha256:sha(raw),bytes:safe.length};count++;
  }
  e.provenance=provenance;
 }
 if(count!==lock.counts.frames)throw new Error('Conteggio SVG errato');
 const catalog={revision:lock.revision,repository:lock.repository,counts:lock.counts,installedAt:new Date().toISOString(),assets,exercises};
 await fs.writeFile(path.join(stage,'catalog.json'),JSON.stringify(catalog));
 for(const f of ['LICENSE','ARTWORK-LICENSE','NOTICE.md'])await fs.copyFile(path.join(source,f),path.join(stage,f));
 // Installation is immutable. A repeat validates every file instead of overwriting a live release.
 if(await fs.stat(dest).catch(()=>null)){
  const old=JSON.parse(await fs.readFile(path.join(dest,'catalog.json')));
  if(old.revision!==lock.revision)throw new Error('Installazione esistente incoerente');
  for(const[file,meta]of Object.entries(assets))if(sha(await fs.readFile(path.join(dest,file)))!==meta.sha256)throw new Error('Storage esistente corrotto: '+file);
  await fs.rm(stage,{recursive:true});console.log('PASS: Flow già installato, integrità dei 3771 SVG riconfermata.');
 }else{await fs.rename(stage,dest);console.log(`PASS: installati ${exercises.length} esercizi e ${count} SVG verificati in storage persistente, senza asset Docker.`);}
}catch(e){await fs.rm(stage,{recursive:true,force:true});throw e;}
