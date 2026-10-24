import { readFileSync } from "node:fs";

const [leftPath,rightPath]=process.argv.slice(2);
if(!leftPath||!rightPath) throw new Error("Usage: node blind-compare.mjs <a.json> <b.json>");

const left=JSON.parse(readFileSync(leftPath,"utf8"));
const right=JSON.parse(readFileSync(rightPath,"utf8"));

function summarize(x){
  const m=x.metrics??{};
  return {
    resultClass:x.resultClass,
    tp:m.tp??0, fp:m.fp??0, fn:m.fn??0, unknown:m.unknown??0,
    precision:m.precision??null, recall:m.recall??null,
    proofCoverage:m.proofCoverage??null,
    evidenceTier:m.evidenceTier??null,
    tokenCost:m.tokenCost??null,
    runtimeMs:m.runtimeMs??null
  };
}

const a=summarize(left), b=summarize(right);
process.stdout.write(JSON.stringify({
  labels:["A","B"],
  A:a,
  B:b,
  instruction:"Judge A vs B from correctness, false-positive safety, proof strength, and cost without using file identity or implementation-newness."
},null,2)+"\n");
