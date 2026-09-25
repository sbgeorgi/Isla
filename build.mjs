import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import CleanCSS from 'clean-css';
import { minify } from 'html-minifier-terser';
import JavaScriptObfuscator from 'javascript-obfuscator';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const ASSETS = path.join(OUT, 'assets');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);

await rm(OUT, { recursive: true, force: true });
await mkdir(ASSETS, { recursive: true });

let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');

const styleMatch = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('Expected one inline <style> block in index.html');

const cssResult = new CleanCSS({ level: 2 }).minify(styleMatch[1]);
if (cssResult.errors.length) throw new Error(`CSS minification failed: ${cssResult.errors.join('; ')}`);
const cssName = `site.${hash(cssResult.styles)}.css`;
await writeFile(path.join(ASSETS, cssName), cssResult.styles);
html = html.replace(styleMatch[0], `<link rel="stylesheet" href="/assets/${cssName}">`);

const scriptMatch = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i);
if (!scriptMatch) throw new Error('Expected one inline JavaScript block in index.html');

const js = JavaScriptObfuscator.obfuscate(scriptMatch[1], {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  simplify: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  selfDefending: false,
  disableConsoleOutput: false,
  sourceMap: false,
  unicodeEscapeSequence: false
}).getObfuscatedCode();

const jsName = `app.${hash(js)}.js`;
await writeFile(path.join(ASSETS, jsName), js);
html = html.replace(scriptMatch[0], `<script src="/assets/${jsName}"></script>`);

if (!/rel=["']canonical["']/i.test(html)) {
  html = html.replace('</head>', '  <link rel="canonical" href="https://roatan.design/">\n</head>');
}
if (!/property=["']og:url["']/i.test(html)) {
  html = html.replace('</head>', '  <meta property="og:url" content="https://roatan.design/">\n</head>');
}

html = await minify(html, {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  sortAttributes: false,
  sortClassName: false,
  minifyCSS: false,
  minifyJS: false
});

await writeFile(path.join(OUT, 'index.html'), html);
await writeFile(
  path.join(OUT, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: https://roatan.design/sitemap.xml\n'
);
await writeFile(
  path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>https://roatan.design/</loc></url>\n' +
    '</urlset>\n'
);

console.log(`Built dist/: index.html + assets/${cssName} + assets/${jsName}`);
