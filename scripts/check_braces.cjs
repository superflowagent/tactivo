const fs = require('fs');
const s = fs.readFileSync('src/components/views/FeaturePreviewMultidispositivo.tsx', 'utf8').split(/\n/);
let curly = 0, paren = 0, angle = 0;
for (let i = 0; i < s.length; i++) {
  const line = s[i];
  for (const ch of line) {
    if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
  }
  if (curly < 0) console.log('curly negative at', i + 1);
  if (paren < 0) console.log('paren negative at', i + 1);
  if (i > 120 && i < 140) console.log(i + 1, line.trim(), 'curly:', curly, 'paren:', paren);
}
console.log('final curly', curly, 'final paren', paren);