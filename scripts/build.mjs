import { cp, mkdir, rm, readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const destination = join(project,'dist');
let siteUrl;
if (process.env.SITE_URL) {
  siteUrl = new URL(process.env.SITE_URL);
  if (!['https:','http:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) throw new Error('SITE_URL must be a public HTTP(S) URL without credentials.');
  siteUrl.search = ''; siteUrl.hash = '';
  if (!siteUrl.pathname.endsWith('/')) siteUrl.pathname += '/';
}
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await cp(join(project,'web'),destination,{recursive:true});
if (siteUrl) {
  const escape = value => value.replace(/[&"<>]/g, c => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
  const file = join(destination,'index.html');
  const html = (await readFile(file,'utf8')).replaceAll('content="./assets/og-image.png"', `content="${escape(new URL('assets/og-image.png',siteUrl).href)}"`).replace('</head>', `  <meta property="og:url" content="${escape(siteUrl.href)}">\n  <link rel="canonical" href="${escape(siteUrl.href)}">\n</head>`);
  await writeFile(file,html);
}
async function measure(dir){let bytes=0,files=0;for(const name of await readdir(dir)){const p=join(dir,name),s=await stat(p);if(s.isDirectory()){const child=await measure(p);bytes+=child.bytes;files+=child.files;}else{bytes+=s.size;files++;}}return {bytes,files};}
const {bytes,files}=await measure(destination);
console.log(`Built ${files} static files (${(bytes/1024).toFixed(1)} KB) in dist/.\nDeploy the contents of dist/ to any static web server. No backend is required.`);
