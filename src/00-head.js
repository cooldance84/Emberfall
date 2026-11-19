'use strict';
(function () { // everything lives in this closure, so none of it can be reached or changed from the browser console
/* EMBERFALL — an original side-scrolling brawler.
   Everything (characters, stages, effects) is procedural and original.
   Pipeline: 480x270 pixel scene -> dynamic lighting -> WebGL CRT/bloom shader. */

const VERSION = '1.46.0';
/* a failure must never be a silent black screen: any error is also written on the page, so it can be read and reported */
function crash(msg) {
  try {
    let el = document.getElementById('emberfall-err');
    if (!el) { el = document.createElement('pre'); el.id = 'emberfall-err'; el.style.cssText = 'position:fixed;left:0;right:0;top:0;margin:0;padding:8px;background:#400;color:#fff;font:12px monospace;white-space:pre-wrap;z-index:9;max-height:60%;overflow:auto'; document.body.appendChild(el); }
    if (el.textContent.length < 2500 && el.textContent.indexOf(msg) < 0) el.textContent += 'v' + VERSION + ' ' + msg + '\n';
  } catch (e) { }
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('error', e => crash((e.message || 'error') + ' (' + (e.lineno || '?') + ':' + (e.colno || '?') + ')'));
const W = 480, H = 270, GROUND_TOP = 140, Y_MIN = 160, Y_MAX = 252;
const screen = document.getElementById('screen');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const g = off.getContext('2d');
const lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H;
const lg = lightCv.getContext('2d');

