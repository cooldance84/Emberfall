/* ---------- WebGL CRT / bloom presentation ---------- */
let gl = null, glProg, glTex, uCrt, uTime;
function initGL() {
  gl = screen.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return false;
  const vs = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float crt;uniform float time;
  const vec2 R=vec2(${W}.,${H}.);
  vec3 S(vec2 u){return texture2D(t,vec2(u.x,1.-u.y)).rgb;}
  void main(){
    vec2 c=uv*2.-1.; vec2 q=uv;
    if(crt>.5){ c*=1.+dot(c,c)*vec2(.035,.05); q=c*.5+.5; }
    if(q.x<0.||q.x>1.||q.y<0.||q.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
    vec3 col=S(q);
    if(crt>.5){
      vec2 px=1./R; vec3 b=vec3(0.);
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=S(q+vec2(float(i),float(j))*px*2.);b+=max(s-.55,0.);}
      col+=b/25.*1.6;
      float ca=.0008; col.r=mix(col.r,S(q+vec2(ca,0.)).r,.6); col.b=mix(col.b,S(q-vec2(ca,0.)).b,.6);
      float sl=.82+.18*sin(q.y*R.y*6.2831); col*=sl;
      float m=.9+.1*sin(q.x*R.x*6.2831); col*=m;
      float v=smoothstep(1.25,.35,length(c)); col*=mix(.55,1.,v);
      col*=1.08+.015*sin(time*60.);
    }
    gl_FragColor=vec4(pow(col,vec3(.95)),1.);
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
  uCrt = gl.getUniformLocation(glProg, 'crt'); uTime = gl.getUniformLocation(glProg, 'time');
  return true;
}
function present() {
  if (gl) {
    gl.viewport(0, 0, screen.width, screen.height);
    gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.uniform1f(uCrt, crtOn ? 1 : 0); gl.uniform1f(uTime, performance.now() / 1000 % 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else { const c = screen.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(off, 0, 0, screen.width, screen.height); }
}
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H), dpr = Math.min(2, devicePixelRatio || 1);
  screen.style.width = Math.floor(W * s) + 'px'; screen.style.height = Math.floor(H * s) + 'px';
  screen.width = Math.floor(W * s * dpr); screen.height = Math.floor(H * s * dpr);
}
addEventListener('resize', resize);


