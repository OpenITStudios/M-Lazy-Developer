import { readFileSync } from "node:fs";
const paths=process.argv.slice(2);
if(paths.length<2) throw new Error("Usage: node aggregate-runs.mjs <run1.json> <run2.json> [...]");
const runs=paths.map((p)=>JSON.parse(readFileSync(p,"utf8")));

function stats(values){
 const xs=values.filter((v)=>typeof v==="number"&&Number.isFinite(v));
 if(!xs.length) return null;
 const mean=xs.reduce((a,b)=>a+b,0)/xs.length;
 const variance=xs.reduce((s,v)=>s+(v-mean)**2,0)/xs.length;
 return {n:xs.length,mean,stddev:Math.sqrt(variance),min:Math.min(...xs),max:Math.max(...xs)};
}

const fields=["precision","recall","proofCoverage","tokenCost","runtimeMs"];
const result={runs:runs.length,metrics:{}};
for(const field of fields){
 result.metrics[field]=stats(runs.map((r)=>r.metrics?.[field]));
}
for(const field of ["tp","fp","fn","unknown"]){
 result.metrics[field]=stats(runs.map((r)=>r.metrics?.[field]));
}
process.stdout.write(JSON.stringify(result,null,2)+"\n");
