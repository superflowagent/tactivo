const fs = require('fs');
const path = require('path');

function walk(dir, files = []) {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const p = path.join(dir, file);
        const stat = fs.statSync(p);
        if (stat && stat.isDirectory()) walk(p, files);
        else if (file.endsWith('.tsx') || file.endsWith('.jsx')) files.push(p);
    });
    return files;
}

const root = path.resolve(__dirname, '..', 'src');
const files = walk(root);

const INPUT_RE = /<Input\b([\s\S]*?)(?:\/?>)/g;
const TEXTAREA_RE = /<Textarea\b([\s\S]*?)(?:\/?>)/g;
const PLAIN_INPUT_RE = /<(input)\b([\s\S]*?)(?:\/?>)/g;

let total = 0;
const results = [];

files.forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = INPUT_RE.exec(src))) {
        const attrs = m[1];
        if (!/\bid=|\bname=/.test(attrs)) {
            const before = src.slice(Math.max(0, m.index - 80), m.index + 120).split('\n').slice(0, 8).join('\n');
            results.push({ file, snippet: before });
            total++;
        }
    }
    while ((m = TEXTAREA_RE.exec(src))) {
        const attrs = m[1];
        if (!/\bid=|\bname=/.test(attrs)) {
            const before = src.slice(Math.max(0, m.index - 80), m.index + 120).split('\n').slice(0, 8).join('\n');
            results.push({ file, snippet: before });
            total++;
        }
    }
    while ((m = PLAIN_INPUT_RE.exec(src))) {
        const tag = m[1];
        if (tag !== 'input') continue;
        const attrs = m[2];
        if (!/\bid=|\bname=/.test(attrs)) {
            const before = src.slice(Math.max(0, m.index - 80), m.index + 120).split('\n').slice(0, 8).join('\n');
            results.push({ file, snippet: before });
            total++;
        }
    }
});

if (total === 0) {
    console.log('No unidentified form fields found. ✅');
    process.exit(0);
}

console.log(`Found ${total} form fields without id/name:`);
results.forEach((r, i) => {
    console.log('\n---');
    console.log(`${i + 1}. ${r.file}`);
    console.log(r.snippet);
});
process.exit(0);
