// Task 15: how many arcs (planned, and unique after dedupe) each library pair
// asks for, both lookahead policies, launch sites alone and with the
// Southeast box measure-*.mjs draws. No model, no browser: the planner only.
// Prints the twelve heaviest rows, then KJFK-KMIA's. This is how the heaviest
// case (scenario d) was picked. Usage:
//   node scripts/slaac/measure/arccount.mjs
import { fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("../../..", import.meta.url));
const { planArcs } = await import(`${R}/lib/slaac/arcs.ts`);
const { rerouteOpts } = await import(`${R}/lib/slaac/run.ts`);
const { loadSua } = await import(`${R}/lib/slaac/geometry.ts`);
const fs = await import("node:fs");
const routes = JSON.parse(fs.readFileSync(`${R}/public/slaac/routes.json`));
const launch = JSON.parse(fs.readFileSync(`${R}/public/slaac/launch-sua.json`));
const meta = JSON.parse(fs.readFileSync(`${R}/public/slaac/meta.json`));
const SE = [[36.5, -90], [36.5, -75.5], [30, -80.5], [30, -90]];
const L = launch.sites.flatMap(s=>s.polys.map(p=>p.ring));
const uniq = (jobs)=> new Set(jobs.map(j=>`${j.entry[1]},${j.entry[2]}>${j.rejoin[1]},${j.rejoin[2]}`)).size;
const rows=[];
for (const [i,p] of routes.pairs.entries()) for (const hug of [false,true]) for (const [nm,rings] of [["launch",L],["launch+SE",[...L,SE]]]) {
  const flights = p.routes.map((r,k)=>({id:String(k+1), nominal:r.fixes}));
  const jobs = planArcs(flights, loadSua(rings), rerouteOpts(meta,25,hug,null));
  rows.push({i, pair:`${p.origin}-${p.dest}`, hug, nm, jobs:jobs.length, uniq:uniq(jobs)});
}
rows.sort((a,b)=>b.uniq-a.uniq);
console.log(rows.slice(0,12).map(r=>JSON.stringify(r)).join("\n"));
console.log(rows.filter(r=>r.pair==="KJFK-KMIA").map(r=>JSON.stringify(r)).join("\n"));
