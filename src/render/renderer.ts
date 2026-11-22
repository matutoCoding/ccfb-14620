import type { BottleGeometry } from '@/core/types'
import type { ShrinkSimulation, SimNode } from '@/core/simulation'
import { mat4Identity, mat4LookAt, mat4Multiply, mat4Perspective } from './mat4.ts'
import { bottleFrag, bottleVert, lineFrag, lineVert, sleeveFrag, sleeveVert } from './shaders.ts'

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('着色器分配失败')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? '着色器编译失败')
  }
  return sh
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()
  if (!p) throw new Error('程序分配失败')
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? '程序链接失败')
  }
  return p
}

function vbo(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const b = gl.createBuffer()
  if (!b) throw new Error('缓冲分配失败')
  gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
  return b
}

export interface RenderOptions {
  liquidColor: [number, number, number]
  liquidLevel: number
  glass: number
  gloss: number
  whiteUnder: number
  showDefects: boolean
  showWire: boolean
}

export class ShrinkRenderer {
  private gl: WebGL2RenderingContext
  private bottleProg: WebGLProgram
  private sleeveProg: WebGLProgram
  private lineProg: WebGLProgram
  private bottleVbo: WebGLBuffer
  private sleeveVbo: WebGLBuffer
  private sleeveIndexBuffer: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null
  private indexCount = 0
  private bottleIndexCount = 0
  private camera = { yaw: 0.6, pitch: 0.25, dist: 0 }
  private frame = 0
  private sim: ShrinkSimulation | null = null
  private geo: BottleGeometry | null = null

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!gl) throw new Error('当前浏览器不支持 WebGL2')
    this.gl = gl
    this.bottleProg = program(gl, bottleVert, bottleFrag)
    this.sleeveProg = program(gl, sleeveVert, sleeveFrag)
    this.lineProg = program(gl, lineVert, lineFrag)
    this.bottleVbo = vbo(gl, new Float32Array(0))
    this.sleeveVbo = vbo(gl, new Float32Array(0))
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0.965, 0.97, 0.98, 1)
  }

  setBottle(geo: BottleGeometry) {
    this.geo = geo
    const { positions, indices } = buildBottleMesh(geo)
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bottleVbo)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    this.bottleIndexCount = indices.length
    this.uploadIndices(indices)
    this.camera.dist = geo.profile.height * 1.9
  }

  private indexBuffer: WebGLBuffer | null = null
  private uploadIndices(indices: Uint32Array) {
    const gl = this.gl
    if (!this.indexBuffer) {
      this.indexBuffer = gl.createBuffer()
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
  }

  setSimulation(sim: ShrinkSimulation) {
    this.sim = sim
    this.frame = sim.frames.length - 1
    this.uploadSleeveFrame(this.frame)
  }

  setFrame(frame: number, showDefects = true) {
    if (!this.sim) return
    this.frame = Math.max(0, Math.min(frame, this.sim.frames.length - 1))
    this.uploadSleeveFrame(this.frame, showDefects)
  }

  private uploadSleeveFrame(frame: number, showDefects = true) {
    if (!this.sim) return
    const gl = this.gl
    const f = this.sim.frames[frame]
    const { nU, nV } = this.sim
    const data = new Float32Array((nV + 1) * nU * 6)
    let o = 0
    for (let j = 0; j <= nV; j++) {
      for (let i = 0; i < nU; i++) {
        const p = j * nU * 3 + i * 3
        // 烘焙 z-up -> y-up：(x, y, z) -> (x, z, -y)
        data[o++] = f.positions[p]
        data[o++] = f.positions[p + 2]
        data[o++] = -f.positions[p + 1]
        data[o++] = i / nU
        data[o++] = j / nV
        const rawFlag = f.flags[j * nU + i]
        const flag = optsShowDefects ? (rawFlag === 'void' ? 1 : rawFlag === 'wrinkle' ? 2 : 0) : 0
        data[o++] = flag
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sleeveVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    // 套筒四边形网格索引
    const indices = new Uint32Array(nV * nU * 6)
    let io = 0
    for (let j = 0; j < nV; j++) {
      for (let i = 0; i < nU; i++) {
        const a = j * nU + i
        const b = j * nU + ((i + 1) % nU)
        const c = (j + 1) * nU + i
        const d = (j + 1) * nU + ((i + 1) % nU)
        indices[io++] = a; indices[io++] = c; indices[io++] = b
        indices[io++] = b; indices[io++] = c; indices[io++] = d
      }
    }
    if (!this.sleeveIndexBuffer) this.sleeveIndexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sleeveIndexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW)
    this.indexCount = indices.length
  }

  setArtwork(image: HTMLImageElement | HTMLCanvasElement) {
    const gl = this.gl
    if (!this.texture) this.texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  rotate(dyaw: number, dpitch: number) {
    this.camera.yaw += dyaw
    this.camera.pitch = Math.max(-1.1, Math.min(1.1, this.camera.pitch + dpitch))
  }

  zoom(delta: number) {
    if (!this.geo) return
    this.camera.dist = Math.max(
      this.geo.profile.height * 0.9,
      Math.min(this.geo.profile.height * 4, this.camera.dist + delta),
    )
  }

  get frameCount() {
    return this.sim?.frames.length ?? 0
  }
  get currentFrame() {
    return this.frame
  }

  render(opts: RenderOptions) {
    const gl = this.gl
    const geo = this.geo
    if (!geo) return
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const aspect = this.canvas.width / this.canvas.height
    const proj = mat4Perspective(Math.PI / 5, aspect, 1, 5000)
    const h = geo.profile.height
    const eye = [
      Math.sin(this.camera.yaw) * Math.cos(this.camera.pitch) * this.camera.dist,
      h / 2 + Math.sin(this.camera.pitch) * this.camera.dist,
      Math.cos(this.camera.yaw) * Math.cos(this.camera.pitch) * this.camera.dist,
    ]
    const view = mat4LookAt(eye, [0, h / 2, 0], [0, 1, 0])
    // 顶点已在网格构建时烘焙 z-up -> y-up，模型矩阵保持单位阵
    const model = mat4Identity()
    const mvp = mat4Multiply(proj, mat4Multiply(view, model))

    this.drawBottle(mvp, view, opts)
    if (this.sim) {
      if (this.frame !== this.uploadedFrame || this.uploadedDefects !== opts.showDefects) {
        this.uploadSleeveFrame(this.frame, opts.showDefects)
        this.uploadedFrame = this.frame
        this.uploadedDefects = opts.showDefects
      }
      this.drawSleeve(mvp, view, eye, opts)
    }
  }
  private uploadedFrame = -1
  private uploadedDefects = true

  private drawBottle(mvp: Float32Array, view: Float32Array, opts: RenderOptions) {
    const gl = this.gl
    gl.useProgram(this.bottleProg)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bottleVbo)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.bottleProg, 'uMVP'), false, mvp)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.bottleProg, 'uModel'), false, mat4Identity())
    gl.uniform3fv(gl.getUniformLocation(this.bottleProg, 'uColor'), new Float32Array([0.86, 0.9, 0.94]))
    gl.uniform1f(gl.getUniformLocation(this.bottleProg, 'uGlass'), opts.glass)
    gl.uniform3fv(gl.getUniformLocation(this.bottleProg, 'uLiquidColor'), new Float32Array(opts.liquidColor))
    gl.uniform1f(gl.getUniformLocation(this.bottleProg, 'uLiquidLevel'), opts.liquidLevel)
    gl.uniform3fv(gl.getUniformLocation(this.bottleProg, 'uEye'), new Float32Array(eye))
    gl.drawElements(gl.TRIANGLES, this.bottleIndexCount, gl.UNSIGNED_INT, 0)
  }

  private drawSleeve(mvp: Float32Array, view: Float32Array, eye: number[], opts: RenderOptions) {
    const gl = this.gl
    const sim = this.sim
    if (!sim) return
    gl.useProgram(this.sleeveProg)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sleeveVbo)
    const stride = 24
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.sleeveProg, 'uMVP'), false, mvp)
    gl.uniform1i(gl.getUniformLocation(this.sleeveProg, 'uArtwork'), 0)
    gl.uniform1f(gl.getUniformLocation(this.sleeveProg, 'uWhiteUnder'), opts.whiteUnder)
    gl.uniform1f(gl.getUniformLocation(this.sleeveProg, 'uGloss'), opts.gloss)
    gl.uniform3fv(gl.getUniformLocation(this.sleeveProg, 'uEye'), new Float32Array(eye))
    if (this.texture) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sleeveIndexBuffer)
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0)
  }

  dispose() {
    const gl = this.gl
    gl.deleteProgram(this.bottleProg)
    gl.deleteProgram(this.sleeveProg)
    gl.deleteProgram(this.lineProg)
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}

export function flagOf(node: SimNode): number {
  return node.flag === 'void' ? 1 : node.flag === 'wrinkle' ? 2 : 0
}

function buildBottleMesh(geo: BottleGeometry) {
  const rings = geo.sections.length
  const n = geo.sections[0].length
  const positions: number[] = []
  const indices: number[] = []
  for (let j = 0; j < rings; j++) {
    const z = geo.zs[j]
    // 母线斜率 dr/dz，用于法线纵向分量
    const zUp = geo.zs[Math.min(j + 1, rings - 1)]
    const zDn = geo.zs[Math.max(j - 1, 0)]
    const rUp = geo.perimeters[Math.min(j + 1, rings - 1)] / (2 * Math.PI)
    const rDn = geo.perimeters[Math.max(j - 1, 0)] / (2 * Math.PI)
    const drdz = (rUp - rDn) / Math.max(zUp - zDn, 1e-6)
    for (let k = 0; k < n; k++) {
      const p = geo.sections[j][k]
      const nl = Math.hypot(p.x, p.y) || 1
      // 回转面法线：径向 (p/nl) 与纵向 -drdz 合成
      let nx = p.x / nl
      let ny = p.y / nl
      let nz = -drdz
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len; ny /= len; nz /= len
      // 烘焙 z-up -> y-up：位置 (x, z, -y)，法线同步旋转
      positions.push(p.x, z, -p.y, nx, nz, -ny)
    }
  }
  for (let j = 0; j < rings - 1; j++) {
    for (let k = 0; k < n; k++) {
      const a = j * n + k
      const b = j * n + ((k + 1) % n)
      const c = (j + 1) * n + k
      const d = (j + 1) * n + ((k + 1) % n)
      indices.push(a, c, b, b, c, d)
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}
