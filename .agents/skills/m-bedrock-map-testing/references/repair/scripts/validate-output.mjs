import { readFileSync } from "node:fs";
const path=process.argv[2];
if(!path) throw new Error("Usage: node validate-output.mjs <repair.json>");
const d=JSON.parse(readFileSync(path,"utf8"));
const errors=[];
if(d.schemaVersion!==1) errors.push("schemaVersion must be 1");
if(typeof d.targetOwner!=="string"||!d.targetOwner.trim()) errors.push("targetOwner required");
if(!Array.isArray(d.changedSemanticSurface)) errors.push("changedSemanticSurface must be array");
if(!d.verification||typeof d.verification!=="object"||Array.isArray(d.verification)) errors.push("verification object required");
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log("Target repair output contract passed.");
