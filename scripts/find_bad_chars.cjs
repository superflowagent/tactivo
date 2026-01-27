const fs = require('fs');
const path = 'd:/Desktop/tactivo/supabase/functions/send-reset-password/index.ts';
const s = fs.readFileSync(path, 'utf8');
for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0) {
        console.log('NUL at', i);
        break;
    }
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
        console.log('Control char at', i, 'code', c, JSON.stringify(s[i]));
        break;
    }
    if (c > 126 && c < 160) {
        console.log('High control at', i, 'code', c, JSON.stringify(s[i]));
        break;
    }
}
console.log('done');