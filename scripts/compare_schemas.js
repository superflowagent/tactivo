const fs=require('fs');
const r=fs.readFileSync('supabase/remote_public_schema.sql','utf8');
const l=fs.readFileSync('supabase/local_public_schema.sql','utf8');
function getTables(sql){
  const rex=/CREATE TABLE IF NOT EXISTS "public"\."([^\"]+)"/g;
  const res={};
  for(const m of sql.matchAll(rex)){
    const name=m[1];
    // find opening paren after match
    const idx = m.index + m[0].length;
    let i=idx; let depth=0; let start=-1; let end=-1;
    while(i<sql.length){
      const ch=sql[i];
      if(ch==='('){ if(start===-1){ start=i+1; } depth++; }
      else if(ch===')'){ depth--; if(depth===0){ end=i; break; } }
      i++;
    }
    if(start===-1||end===-1) continue;
    const block=sql.slice(start,end);
    // split by commas that are at line ends
    const cols=block.split(/,\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/\s+/g,' '));
    res[name]=cols;
  }
  return res;
}
function getPolicies(sql){
  const rex=/CREATE POLICY "([^"]+)" ON "public"\."([^"]+)"([\s\S]*?);/g;
  const res={};
  for(const m of sql.matchAll(rex)){
    const name=m[1], table=m[2], body=m[3].trim();
    res[table]=res[table]||[];
    res[table].push(name+' | '+body.replace(/\s+/g,' '));
  }
  return res;
}
console.log('Parsing remote and local schemas...');
const rt=getTables(r);
const lt=getTables(l);
console.log('remote tables',Object.keys(rt).length,'local tables',Object.keys(lt).length);
const rp=getPolicies(r);
const lp=getPolicies(l);
const allTables=new Set([...Object.keys(rt),...Object.keys(lt)]);
const diffs=[];
for(const t of [...allTables].sort()){
  const rcols=rt[t]||[];
  const lcols=lt[t]||[];
  const rnames=rcols.map(c=>c.split(' ')[0].replace(/"/g,''));
  const lnames=lcols.map(c=>c.split(' ')[0].replace(/"/g,''));
  const missingInLocal=rnames.filter(x=>!lnames.includes(x));
  const extraInLocal=lnames.filter(x=>!rnames.includes(x));
  if(missingInLocal.length||extraInLocal.length){
    diffs.push({table:t,missingInLocal,extraInLocal,remoteCols:rnames,localCols:lnames});
  }
  // policies
  const rpol=(rp[t]||[]).map(s=>s.replace(/\s+/g,' '));
  const lpol=(lp[t]||[]).map(s=>s.replace(/\s+/g,' '));
  const polMissing=rpol.filter(x=>!lpol.includes(x));
  const polExtra=lpol.filter(x=>!rpol.includes(x));
  if(polMissing.length||polExtra.length){
    diffs.push({table:t,policyMissing:polMissing,policyExtra:polExtra});
  }
}
if(diffs.length===0){
  console.log('No differences found');
} else {
  for(const d of diffs){
    console.log('---');
    console.log('Table:',d.table);
    if(d.missingInLocal) console.log(' Missing columns in local:',d.missingInLocal.join(', '));
    if(d.extraInLocal) console.log(' Extra columns in local:',d.extraInLocal.join(', '));
    if(d.policyMissing) console.log(' Missing policies in local:',d.policyMissing.join(' || '));
    if(d.policyExtra) console.log(' Extra policies in local:',d.policyExtra.join(' || '));
  }
}
