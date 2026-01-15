const fs = require('fs');
const path = 'src/components/views/FeaturePreviewMultidispositivo.tsx';
const s = fs.readFileSync(path, 'utf8').split(/\n/);
const stack = [];
for (let i = 0; i < s.length; i++) {
  const line = s[i];
  const adds = (line.match(/<div\b/g) || []).length;
  for (let j = 0; j < adds; j++) stack.push({ line: i + 1, text: line.trim() });
  const subs = (line.match(/<\/div>/g) || []).length;
  for (let j = 0; j < subs; j++) {
    if (stack.length > 0) {
      const popped = stack.pop();
      console.log(`closing at ${i + 1} pairs with open at ${popped.line}`);
    } else console.log('extra close at', i + 1);
  }
}
console.log('unclosed divs:', stack.length);
console.log(stack.slice(-10));
