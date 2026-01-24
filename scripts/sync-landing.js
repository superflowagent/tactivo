import fs from 'fs/promises';
import path from 'path';

const SRC = path.resolve(process.cwd(), 'dist', 'landing');
const DEST = path.resolve(process.cwd(), 'public', 'landing');

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const ent of entries) {
        const s = path.join(src, ent.name);
        const d = path.join(dest, ent.name);
        if (ent.isDirectory()) {
            await copyDir(s, d);
        } else {
            await fs.copyFile(s, d);
        }
    }
}

(async () => {
    try {
        if (!(await exists(SRC))) {
            console.error(`Source not found: ${SRC}`);
            process.exit(2);
        }
        await copyDir(SRC, DEST);
        console.log(`Copied landing assets from ${SRC} -> ${DEST}`);
    } catch (err) {
        console.error('Error copying landing assets:', err);
        process.exit(1);
    }
})();
