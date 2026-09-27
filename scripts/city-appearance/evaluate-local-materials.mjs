/** Read-only agreement audit of local material receipts against model-reviewed references. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { MATERIAL_FAMILIES, COLOUR_FAMILIES, VISIBILITY, validateLabel } from './benchmark-local-materials.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const flag = (args,name) => args.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const sha = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const modelDigest = value => typeof value==='string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(value);
const percentile = (values,p) => values.length?values[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
const summarize = values => { const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  return {count:sorted.length,median:percentile(sorted,.5),p90:percentile(sorted,.9),min:sorted[0]??null,max:sorted.at(-1)??null}; };
const keyOf = source => `${source.buildingId}\u0000${source.elevationId}\u0000${source.imageKind}\u0000${source.sha256??source.sourceSha256}`;
const add = (matrix,row,col) => { matrix[row]??={};matrix[row][col]=(matrix[row][col]??0)+1; };
const known = value => value && value!=='unknown';

export function evaluateLocalMaterials(reference, receipts, experiment) {
  if(reference?.status==='withdrawn')throw Error('Withdrawn visual reference set cannot be evaluated');
  if(reference?.version!==1||!Array.isArray(reference.entries)||reference.sourceIdentityUnverified!==true)
    throw Error('Expected versioned, identity-unverified visual reference set');
  if(!sha(experiment?.experimentHash)||!modelDigest(experiment?.experiment?.modelDigest))throw Error('Benchmark report lacks frozen model digest and experiment hash');
  const byKey=new Map(),duplicates=[];
  for(const receipt of receipts){
    const binding=receipt.binding,key=keyOf(binding??{});
    if(!binding||!sha(binding.sourceSha256)||!binding.buildingId||!binding.elevationId||!binding.imageKind||
       receipt.experimentHash!==experiment.experimentHash||receipt.modelDigest!==experiment.experiment.modelDigest||
       !sha(receipt.key)||receipt.filename && receipt.filename!==`${receipt.key}.json`)
      throw Error(`Unbound or wrong-model benchmark receipt: ${receipt.filename??key}`);
    if(byKey.has(key))duplicates.push(key);else byKey.set(key,receipt);
  }
  if(duplicates.length)throw Error(`Ambiguous duplicate receipts for ${duplicates.length} source identities`);
  const referenceKeys=new Set(),rows=[],materialConfusion={},colourConfusion={};
  let referenceKnown=0,modelAccepted=0,acceptedOnReferenceKnown=0,falseAcceptReferenceUnknown=0,jointCorrect=0;
  let materialPredictionsOnKnown=0,materialExact=0,colourPredictionsOnKnown=0,colourExact=0;
  const counts={missing:0,error:0,invalid:0,modelAbstain:0,accepted:0};
  const speedReceipts=[];
  for(const entry of reference.entries){
    const source=entry.source,label=entry.label,key=keyOf(source??{});
    if(!source||!source.buildingId||!source.elevationId||!sha(source.sha256)||!['full','ground'].includes(source.imageKind)||
       !label||!MATERIAL_FAMILIES.includes(label.materialFamily)||!COLOUR_FAMILIES.includes(label.colourFamily)||
       !VISIBILITY.includes(label.visibility)||referenceKeys.has(key))throw Error(`Invalid or duplicate visual reference: ${key}`);
    referenceKeys.add(key);
    const refKnown=known(label.materialFamily)&&known(label.colourFamily)&&label.visibility!=='occluded';
    if(refKnown)referenceKnown++;
    const receipt=byKey.get(key);let state,prediction=null;
    if(!receipt){state='missing';counts.missing++;}
    else if(receipt.status==='error'){state='error';counts.error++;}
    else {
      const parsed=validateLabel(receipt.label);
      if(receipt.status!=='ok'||!receipt.schema?.valid||!parsed.valid||
         (receipt.label.abstain===false&&(!known(receipt.label.materialFamily)||!known(receipt.label.colourFamily)))){
        state='invalid';counts.invalid++;
      } else {
        prediction=receipt.label;speedReceipts.push(receipt);
        if(prediction.abstain){state='abstain';counts.modelAbstain++;}
        else {state='accepted';counts.accepted++;modelAccepted++;
          if(refKnown){acceptedOnReferenceKnown++;if(prediction.materialFamily===label.materialFamily&&prediction.colourFamily===label.colourFamily)jointCorrect++;}
          else falseAcceptReferenceUnknown++;
        }
      }
    }
    const materialColumn=prediction?.abstain?'abstain':prediction?.materialFamily??state;
    const colourColumn=prediction?.abstain?'abstain':prediction?.colourFamily??state;
    add(materialConfusion,label.materialFamily,materialColumn);add(colourConfusion,label.colourFamily,colourColumn);
    if(prediction&&!prediction.abstain){
      if(known(label.materialFamily)){materialPredictionsOnKnown++;if(prediction.materialFamily===label.materialFamily)materialExact++;}
      if(known(label.colourFamily)){colourPredictionsOnKnown++;if(prediction.colourFamily===label.colourFamily)colourExact++;}
    }
    rows.push({buildingId:source.buildingId,elevationId:source.elevationId,imageKind:source.imageKind,
      sourceSha256:source.sha256,reference:label,prediction,status:state,
      receiptKey:receipt?.key??null,clientLatencyMs:receipt?.clientLatencyMs??null,
      error:receipt?.error??null,schemaReason:receipt?.schema?.reason??null,
      jointCorrect:state==='accepted'&&refKnown?prediction.materialFamily===label.materialFamily&&prediction.colourFamily===label.colourFamily:null});
  }
  const allMatched=counts.missing+counts.error+counts.invalid===0,
    jointPrecision=acceptedOnReferenceKnown?jointCorrect/acceptedOnReferenceKnown:null;
  const client=summarize(speedReceipts.map(r=>r.clientLatencyMs)),load=summarize(speedReceipts.map(r=>r.server?.loadDurationMs)),
    excludingLoad=summarize(speedReceipts.map(r=>Number.isFinite(r.clientLatencyMs)&&Number.isFinite(r.server?.loadDurationMs)?Math.max(0,r.clientLatencyMs-r.server.loadDurationMs):NaN)),
    cold=summarize(speedReceipts.map(r=>r.server?.loadDurationMs).filter(value=>Number.isFinite(value)&&value>=1000));
  return {version:1,reference:{entries:reference.entries.length,known:referenceKnown,unknown:reference.entries.length-referenceKnown,
      reviewer:reference.reviewer??null,sourceIdentityUnverified:true},
    benchmark:{model:experiment.experiment.model,modelDigest:experiment.experiment.modelDigest,experimentHash:experiment.experimentHash,
      imageSize:experiment.experiment.imageSize},counts,
    agreement:{material:{correct:materialExact,predictionsOnKnownReference:materialPredictionsOnKnown,
        exactRate:materialPredictionsOnKnown?materialExact/materialPredictionsOnKnown:null},
      colour:{correct:colourExact,predictionsOnKnownReference:colourPredictionsOnKnown,
        exactRate:colourPredictionsOnKnown?colourExact/colourPredictionsOnKnown:null},
      jointAmongAcceptedOnKnown:{correct:jointCorrect,acceptedOnKnownReference:acceptedOnReferenceKnown,precision:jointPrecision},
      modelAcceptance:{all:modelAccepted,allRate:modelAccepted/reference.entries.length,
        knownReference:acceptedOnReferenceKnown,knownReferenceRate:referenceKnown?acceptedOnReferenceKnown/referenceKnown:null},
      falseAcceptReferenceUnknown},
    confusion:{material:materialConfusion,colour:colourConfusion},
    speed:{basis:'valid schema receipts only; failed and invalid samples excluded',clientLatencyMs:client,
      clientExcludingServerLoadMs:excludingLoad,serverLoadDurationMs:load,coldLoadAtLeast1000Ms:cold},
    gate:{targetJointPrecision:.95,targetFalseAcceptReferenceUnknown:0,
      status:!allMatched||!acceptedOnReferenceKnown?'incomplete':jointPrecision>=.95&&falseAcceptReferenceUnknown===0?'pass':'fail',
      scope:'model-review agreement on broad visible-wall labels only; no source identity, texture or game-render acceptance'},rows};
}

export async function runEvaluation(args=process.argv.slice(2)) {
  const referenceFile=path.resolve(flag(args,'reference')??'review-data/district-rectification/local-material-reference.json');
  const benchmarkDir=flag(args,'benchmark');if(!benchmarkDir)throw Error('--benchmark=<output-directory> is required');
  const benchmark=path.resolve(benchmarkDir),referenceBytes=await fs.readFile(referenceFile),reference=JSON.parse(referenceBytes);
  if(reference?.status==='withdrawn')throw Error('Withdrawn visual reference set cannot be evaluated');
  for(const entry of reference.entries??[]){
    const source=entry.source;if(!source?.path||!sha(source.sha256))throw Error('Unbound reference source');
    const actual=hash(await fs.readFile(path.resolve(source.path)));
    if(actual!==source.sha256)throw Error(`Reference image changed: ${source.path}`);
  }
  const experiment=JSON.parse(await fs.readFile(path.join(benchmark,'report.json'),'utf8'));
  const receiptDir=path.join(benchmark,'receipts'),receipts=[];
  for(const file of (await fs.readdir(receiptDir)).filter(file=>/^[a-f0-9]{64}\.json$/.test(file)).sort()){
    const receipt=JSON.parse(await fs.readFile(path.join(receiptDir,file),'utf8'));receipts.push({...receipt,filename:file});
  }
  const report={...evaluateLocalMaterials(reference,receipts,experiment),referenceSha256:hash(referenceBytes),
    benchmarkDirectory:benchmark,generatedAt:new Date().toISOString(),
    limitation:'Reference labels are model visual reviews of source crops. This evaluation neither verifies building identity nor accepts a game texture or render.'};
  const output=path.resolve(flag(args,'out')??path.join(benchmark,`evaluation-${report.referenceSha256}.json`));
  const temporary=`${output}.${process.pid}.${crypto.randomUUID()}.tmp`;await fs.mkdir(path.dirname(output),{recursive:true});
  try{await fs.writeFile(temporary,JSON.stringify(report,null,2));await fs.rename(temporary,output);}finally{await fs.rm(temporary,{force:true});}
  return {output,...report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  runEvaluation().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{process.stderr.write(`${error.stack??error.message}\n`);process.exitCode=1;});
