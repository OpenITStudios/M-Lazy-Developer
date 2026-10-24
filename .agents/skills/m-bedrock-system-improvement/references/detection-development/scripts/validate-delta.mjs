import { readFileSync } from "node:fs";
const path=process.argv[2];
if(!path) throw new Error("Usage: node validate-delta.mjs <delta.json>");
const d=JSON.parse(readFileSync(path,"utf8"));
const errors=[];
for(const key of ["schemaVersion","gapClass","canonicalOwner","acceptance","before","expectedAfter"]){
 if(d[key]===undefined||d[key]==="") errors.push("missing "+key);
}
if(d.schemaVersion!==1) errors.push("schemaVersion must be 1");
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log("Detection delta contract passed.");
