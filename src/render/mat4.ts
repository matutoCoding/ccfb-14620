// 列主序 4x4 矩阵工具
export type Mat4 = Float32Array

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}

export function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[11] = -1
  m[14] = (2 * far * near) / (near - far)
  return m
}

export function mat4LookAt(eye: number[], center: number[], up: number[]): Mat4 {
  const z = normalize3([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]])
  const x = normalize3(cross3(up, z))
  const y = cross3(z, x)
  const m = mat4Identity()
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]
  m[12] = -dot3(x, eye)
  m[13] = -dot3(y, eye)
  m[14] = -dot3(z, eye)
  return m
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3]
    }
  }
  return out
}

function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}
function dot3(a: number[], b: number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function normalize3(a: number[]): number[] {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function mat4Model(opts: { rotateY?: number; translateZ?: number; scale?: number } = {}): Mat4 {
  const m = mat4Identity()
  const ry = opts.rotateY ?? 0
  const tz = opts.translateZ ?? 0
  const s = opts.scale ?? 1
  const c = Math.cos(ry)
  const sn = Math.sin(ry)
  m[0] = c * s
  m[2] = -sn * s
  m[8] = sn * s
  m[10] = c * s
  m[14] = tz
  return m
}
