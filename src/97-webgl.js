/* ---------- WebGL CRT / bloom presentation ---------- */
let gl = null, glProg, glTex, uCrt, uTime, uHd, uFx, uRayAmt, uRayX, uSpAmt, uSpRise, uSpSway, uAsp, uRayCol, uSpCol, uSc;
let hdAuto = true, hdSlow = 0, hdLast = 0; // HD effects: sharp pixels, light shafts, floating sparks and bloom at screen resolution; they switch themselves off on a slow device
function initGL() {
  gl = screen.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 uv;uniform sampler2D t;uniform float crt,time,hd,fx,rayAmt,rayX,spAmt,spRise,spSway,aspect;uniform vec3 rayCol,spCol;uniform vec2 sc;
  const vec2 R=vec2(${W}.,${H}.);
  vec3 S(vec2 u){return texture2D(t,vec2(u.x,1.-u.y)).rgb;}
  vec2 SH(vec2 u){vec2 tc=u*R;vec2 f=fract(tc);return (floor(tc)+.5+clamp((f-.5)*sc,-.5,.5))/R;}
  float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec3 pts(vec2 q,float cells,float spd,float rad,float dens,float seed){
    vec2 p=vec2(q.x*aspect,q.y)*cells; p.y-=time*spRise*spd; p.x+=time*spSway*spd*.3;
    vec2 id=floor(p),f=fract(p)-.5; float r1=h1(id+seed),r2=h1(id*1.7+seed+3.1),r3=h1(id+seed+7.7);
    vec2 o=(vec2(r1,r2)-.5)*.6; o.x+=sin(time*1.3+r3*6.28)*.12; float d=length(f-o);
    float tw=.6+.4*sin(time*4.+r3*20.), on=step(1.-dens,r3);
    return spCol*((1.-smoothstep(0.,rad,d))+(1.-smoothstep(0.,rad*3.,d))*.22)*on*tw;
  }
  void main(){
    vec2 c=uv*2.-1.; vec2 q=uv;
    if(crt>.5){ c*=1.+dot(c,c)*vec2(.035,.05); q=c*.5+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    vec3 col=S(hd>.5?SH(q):q);
    vec2 px=1./R;
    if(crt>.5&&hd<.5){
      vec3 b=vec3(0.);
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=S(q+vec2(float(i),float(j))*px*2.);b+=max(s-.55,0.);}
      col+=b/25.*1.6;
    }
    if(hd>.5&&fx>.5){
      vec3 b=vec3(0.);
      for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 o=vec2(cos(a),sin(a));b+=max(S(q+o*px*2.5)-.58,0.)+max(S(q+o*px*6.5)-.58,0.)*.8;}
      col+=b/8.*1.15;
      vec2 d=vec2((q.x-rayX)*aspect,q.y-1.2); float ang=atan(d.x,-d.y);
      float s1=max(.5+.5*sin(ang*17.+time*.12),0.),s2=max(.5+.5*sin(ang*41.-time*.07+1.3),0.); float bm=s1*s1*s1*s1*.7+s2*s2*s2*s2*s2*s2*.5;
      float fall=(1.-smoothstep(0.,1.6,length(d)))*smoothstep(.05,.7,q.y)*(1.-smoothstep(.78,1.,q.y));
      col+=rayCol*bm*fall*rayAmt*(.85+.15*sin(time*.5));
      vec3 sp=pts(q,17.,1.,.085,.15,0.)+pts(q,29.,1.5,.07,.12,11.)*.8+pts(q,47.,2.2,.06,.1,23.)*.6;
      vec3 bk=pts(q,3.2,.35,.22,.35,41.)*.16*(1.-smoothstep(.1,.6,q.y));
      col+=(sp+bk)*spAmt*smoothstep(.0,.24,1.-q.y);
    }
    if(crt>.5){
      float ca=.0008; col.r=mix(col.r,S(q+vec2(ca,0.)).r,.6); col.b=mix(col.b,S(q-vec2(ca,0.)).b,.6);
      float sl=.82+.18*sin(q.y*R.y*6.2831); col*=sl;
      float m=.9+.1*sin(q.x*R.x*6.2831); col*=m;
      float v=smoothstep(1.25,.35,length(c)); col*=mix(.55,1.,v);
      col*=1.08+.015*sin(time*60.);
    } else if(hd>.5){ float v=1.-smoothstep(.45,1.45,length(c)); col*=mix(.78,1.,v); col=clamp(col,0.,1.); col=mix(col,col*col*(3.-2.*col),.2); }
    gl_FragColor=vec4(pow(clamp(col,0.,1.),vec3(.95)),1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return false;
  glProg = gl.createProgram(); gl.attachShader(glProg, v); gl.attachShader(glProg, f); gl.linkProgram(glProg); gl.useProgram(glProg);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(glProg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const U = n => gl.getUniformLocation(glProg, n); uCrt = U('crt'); uTime = U('time'); uHd = U('hd'); uFx = U('fx'); uRayAmt = U('rayAmt'); uRayX = U('rayX'); uSpAmt = U('spAmt'); uSpRise = U('spRise'); uSpSway = U('spSway'); uAsp = U('aspect'); uRayCol = U('rayCol'); uSpCol = U('spCol'); uSc = U('sc');
  return true;
}
const rgbF = (str, d) => { const a = String(str || '').split(',').map(Number); return a.length === 3 && a.every(v => v >= 0) ? a.map(v => v / 255) : d; };
const HD_WEATHER = { sparks: [1, 0.55, 0.4], ash: [0.75, -0.22, 0.5], snow: [0.85, -0.3, 0.35], blizzard: [0.3, -0.6, 1.4], rain: [0.4, 0.14, 0.3], storm: [0.3, 0.1, 0.5], motes: [0.95, 0.12, 0.3] }; // [amount, rise (negative falls), sway]
function hdParams() { // light colour, shaft strength and the floating specks follow the stage's theme and weather
  const T = TH || THEMES[0], w = HD_WEATHER[weather] || [0.3, 0.1, 0.3], glow = rgbF(T.glow, [1, 0.6, 0.3]), torch = rgbF(T.torch, glow);
  const sp = weather === 'snow' || weather === 'blizzard' ? [0.85, 0.92, 1] : weather === 'ash' ? [1, 0.72, 0.45] : weather === 'sparks' ? torch : glow;
  return { ray: glow, rayX: T.moon && isFinite(T.moon.x) ? Math.max(0.1, Math.min(0.9, T.moon.x / W)) : 0.3, rayAmt: 0.11, sp, spAmt: w[0], rise: w[1], sway: w[2] };
}
function hdWatch(now) { // 40 frames a second or less for four seconds: the effects go off for this session
  if (!(gl && hdOn && hdAuto)) { hdLast = now; return; }
  const dt = now - hdLast; hdLast = now; if (dt <= 0 || dt > 100) return;
  hdSlow = Math.max(0, hdSlow + (dt > 26 ? 1 : -2)); if (hdSlow > 240) { hdAuto = false; hdSlow = 0; if (mode === 'play') { msg = 'HD EFFECTS OFF - SLOW DEVICE'; msgT = 150; } }
}
function present() {
  if (gl) {
    const hdNow = hdOn && hdAuto, fxNow = hdNow && (mode === 'play' || mode === 'title');
    gl.viewport(0, 0, screen.width, screen.height);
    gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.uniform1f(uCrt, crtOn ? 1 : 0); gl.uniform1f(uTime, performance.now() / 1000 % 100);
    gl.uniform1f(uHd, hdNow ? 1 : 0); gl.uniform1f(uFx, fxNow ? 1 : 0); gl.uniform2f(uSc, screen.width / W, screen.height / H); gl.uniform1f(uAsp, W / H);
    if (fxNow) { const P = hdParams(); gl.uniform3fv(uRayCol, P.ray); gl.uniform1f(uRayX, P.rayX); gl.uniform1f(uRayAmt, P.rayAmt); gl.uniform3fv(uSpCol, P.sp); gl.uniform1f(uSpAmt, P.spAmt); gl.uniform1f(uSpRise, P.rise); gl.uniform1f(uSpSway, P.sway); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else { const c = screen.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(off, 0, 0, screen.width, screen.height); }
}
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), dpr = Math.min(2, devicePixelRatio || 1);
  screen.style.width = Math.floor(W * s) + 'px'; screen.style.height = Math.floor(H * s) + 'px';
  screen.width = Math.floor(W * s * dpr); screen.height = Math.floor(H * s * dpr);
}
addEventListener('resize', resize);


