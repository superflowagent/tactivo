const fs = require('fs');
const path = 'src/components/views/FeaturePreviewMultidispositivo.tsx';
const s = fs.readFileSync(path, 'utf8').split(/\n/);
let open = 0;
for (let i = 0; i < s.length; i++) {
  const line = s[i];
  const adds = (line.match(/<div\b/g) || []).length;
  const subs = (line.match(/<\/div>/g) || []).length;
  open += adds - subs;
  if (adds || subs) console.log(`${i + 1}: adds=${adds} subs=${subs} open=${open}`);
}
console.log('final open count', open);