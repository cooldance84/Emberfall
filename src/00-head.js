'use strict';
(function () { // everything lives in this closure, so none of it can be reached or changed from the browser console
/* EMBERFALL — an original side-scrolling brawler.
   Everything (characters, stages, effects) is procedural and original.
   Pipeline: 480x270 pixel scene -> dynamic lighting -> WebGL CRT/bloom shader. */

const VERSION = '1.44.1';
const W = 480, H = 270, GROUND_TOP = 140, Y_MIN = 160, Y_MAX = 252;
const screen = document.getElementById('screen');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const g = off.getContext('2d');
const lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H;
const lg = lightCv.getContext('2d');

