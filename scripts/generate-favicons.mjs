import fs from 'fs/promises';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function main(){
  const srcPath = 'public/favicon.png'; // contains the original SVG markup
  const svg = await fs.readFile(srcPath);

  const outputs = [];
  // sizes to generate
  const sizes = [48, 96, 192];
  for(const s of sizes){
    const out = `public/favicon-${s}.png`;
    await sharp(svg).resize(s, s, {fit: 'contain'}).png({quality: 90}).toFile(out);
    outputs.push(out);
  }

  // apple touch
  await sharp(svg).resize(180, 180, {fit: 'contain'}).png({quality:90}).toFile('public/apple-touch-icon.png');
  outputs.push('public/apple-touch-icon.png');

  // overwrite public/favicon.png with a 192x192 raster for broad compatibility
  await sharp(svg).resize(192, 192, {fit: 'contain'}).png({quality:90}).toFile('public/favicon.png');
  outputs.push('public/favicon.png');

  // create .ico from several sizes (16,32,48)
  const icoSourceSizes = [16, 32, 48];
  const pngBuffers = await Promise.all(icoSourceSizes.map(s => sharp(svg).resize(s, s, {fit: 'contain'}).png().toBuffer()));
  const icoBuf = await pngToIco(pngBuffers);
  await fs.writeFile('public/favicon.ico', icoBuf);
  outputs.push('public/favicon.ico');

  // copy all generated files to dist/
  await Promise.all(outputs.map(f => fs.copyFile(f, `dist/${f.replace('public/', '')}`)));

  console.log('Generated files:', outputs.join(', '));
}

main().catch(err=>{console.error(err); process.exit(1)});
