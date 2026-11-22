// WebGL2 着色器源码

// 瓶体：哑光塑料/玻璃，受方向光 + 菲涅耳边缘
export const bottleVert = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`

export const bottleFrag = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uColor;
uniform float uGlass;
uniform vec3 uLiquidColor;
uniform float uLiquidLevel;
uniform vec3 uEye;
out vec4 frag;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.5, 0.9, 0.7));
  float diff = max(dot(N, L), 0.0);
  vec3 V = normalize(uEye - vWorld);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  // 液面以下透出液体颜色
  float belowLiquid = step(vWorld.y, uLiquidLevel);
  vec3 base = mix(uColor, uLiquidColor, belowLiquid * 0.75);
  vec3 col = base * (0.35 + 0.6 * diff) + fresnel * vec3(0.9);
  float alpha = mix(1.0, 0.32, uGlass);
  frag = vec4(col, alpha);
}`

// 套标膜面：基础色贴图 + 白墨打底 + 透明窗 + 光泽高光 + 缺陷标红
export const sleeveVert = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aFlag;
uniform mat4 uMVP;
out vec2 vUv;
out float vFlag;
out vec3 vNormal;
void main() {
  vUv = aUv;
  vFlag = aFlag;
  // 圆柱近似法线：由位置在 xz 平面的径向方向给出
  vNormal = normalize(vec3(aPos.x, 0.0, aPos.z));
  gl_Position = uMVP * vec4(aPos, 1.0);
}`

export const sleeveFrag = `#version 300 es
precision highp float;
in vec2 vUv;
in float vFlag;
in vec3 vNormal;
uniform sampler2D uArtwork;
uniform float uWhiteUnder;
uniform float uGloss;
uniform vec3 uEye;
out vec4 frag;
void main() {
  vec4 ink = texture(uArtwork, vUv);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye);
  float spec = pow(max(dot(N, V), 0.0), 28.0) * uGloss;
  // 透明窗：无墨区域透出瓶体，白墨打底区域保持高不透明
  float clearWindow = 1.0 - smoothstep(0.02, 0.12, ink.a);
  float alpha = mix(max(ink.a, uWhiteUnder * 0.92), 0.18, clearWindow);
  vec3 col = ink.rgb + spec * vec3(1.0);
  // 缺陷标记：1=空鼓 橙红，2=起皱 暗红
  if (vFlag > 0.5) {
    vec3 defect = vFlag > 1.5 ? vec3(0.65, 0.08, 0.08) : vec3(0.9, 0.4, 0.08);
    col = mix(col, defect, 0.55);
  }
  frag = vec4(col, alpha);
}`

// 纯色线框（网格/母线）
export const lineVert = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uMVP;
void main() { gl_Position = uMVP * vec4(aPos, 1.0); }`

export const lineFrag = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 frag;
void main() { frag = vec4(uColor, 1.0); }`
