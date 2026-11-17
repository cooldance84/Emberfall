#!/usr/bin/env node
'use strict';
/* Builds game.js from the pieces in src/ (plain concatenation, in file-name order).
   game.js stays a single committed file, so GitHub Pages, double-clicking index.html and the tests keep working unchanged.
     node build.js          write game.js
     node build.js --check  exit 1 if game.js is not what src/ builds (use before committing) */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src'), out = path.join(__dirname, 'game.js');
const files = fs.readdirSync(dir).filter(f => /\.js$/.test(f)).sort();
if (!files.length) { console.error('build: no files in src/'); process.exit(2); }
const built = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== built) { console.error('game.js is out of date: run "node build.js" (edit the files in src/, not game.js).'); process.exit(1); }
  console.log('game.js is up to date (' + files.length + ' files in src/).');
} else {
  fs.writeFileSync(out, built);
  console.log('game.js built from ' + files.length + ' files in src/ (' + built.split('\n').length + ' lines).');
}
