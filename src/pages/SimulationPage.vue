<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FurnaceProfile } from '@/core/types'
import { furnaceRepo } from '@/db/repos.ts'
import { remove, uid } from '@/db/indexeddb.ts'
import { store } from '@/state/store.ts'
import { buildBottleGeometry } from '@/core/geometry'
import { runShrinkSimulation } from '@/core/simulation'
import { ShrinkRenderer } from '@/render/renderer'
import { attachOrbitControls } from '@/render/orbit'
import { loadImage } from '@/core/artwork_factory'
import EmptyState from '@/components/EmptyState.vue'
import { iconSim, iconPlus, iconTrash, iconWarning, iconFlask } from '@/components/icons.ts'

const furnaces = ref<FurnaceProfile[]>([])
const furnaceId = ref('')
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: ShrinkRenderer | null = null
let raf = 0
let resizeObserver: ResizeObserver | null = null
const frameIndex = ref(0)
const playing = ref(false)
const status = ref('')

onMounted(async () => {
  furnaces.value = await furnaceRepo.list()
  furnaceId.value = store.furnace?.id ?? furnaces.value[0]?.id ?? ''
  if (furnaceId.value) store.furnace = furnaces.value.find((f) => f.id === furnaceId.value) ?? null
})

watch(furnaceId, async (id) => {
  store.furnace = furnaces.value.find((f) => f.id === id) ?? null
})

const furnace = computed(() => furnaces.value.find((f) => f.id === furnaceId.value) ?? null)

function addFurnace() {
  const f: FurnaceProfile = {
    id: uid('furnace'),
    name: '新炉程',
    updatedAt: Date.now(),
    zones: [
      { id: uid('z'), name: '预热段', kind: 'steam', temp: 75, dwell: 3 },
      { id: uid('z'), name: '主收缩段', kind: 'steam', temp: 90, dwell: 4 },
    ],
  }
  furnaces.value.push(f)
  furnaceId.value = f.id
  furnaceRepo.save(f)
}
function addZone() {
  furnace.value?.zones.push({ id: uid('z'), name: '新风区', kind: 'hot-air', temp: 85, dwell: 2 })
}
async function saveFurnace() {
  if (!furnace.value) return
  await furnaceRepo.save(furnace.value)
  status.value = '炉程已保存'
}
async function deleteZone(i: number) {
  furnace.value?.zones.splice(i, 1)
}
async function deleteFurnace() {
  if (!furnace.value) return
  await remove('furnaces', furnace.value.id)
  furnaces.value = furnaces.value.filter((f) => f.id !== furnace.value?.id)
  furnaceId.value = furnaces.value[0]?.id ?? ''
}

async function runSim() {
  if (!store.bottle || !store.film || !furnace.value) {
    status.value = '请先选择瓶型与膜材'
    return
  }
  status.value = '仿真求解中…'
  const geo = buildBottleGeometry(store.bottle)
  const film = store.correctedTdCurve ? { ...store.film, tdCurve: store.correctedTdCurve } : store.film
  const sim = runShrinkSimulation(geo, film, furnace.value, { nU: 128, nV: 80 })
  store.simulation = sim
  ensureRenderer(geo)
  renderer?.setSimulation(sim)
  if (store.artwork) {
    const img = await loadImage(store.artwork.imageDataUrl)
    renderer?.setArtwork(img)
  }
  frameIndex.value = sim.frames.length - 1
  renderer?.setFrame(frameIndex.value)
  status.value = `完成：钉扎率 ${(sim.finalPinnedRatio * 100).toFixed(1)}%，缺陷 ${sim.defects.length} 处`
  loop()
}

function ensureRenderer(geo: ReturnType<typeof buildBottleGeometry>) {
  if (renderer || !canvasRef.value) return
  renderer = new ShrinkRenderer(canvasRef.value)
  renderer.setBottle(geo)
  attachOrbitControls(canvasRef.value, renderer)
  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(canvasRef.value)
  resize()
}

function resize() {
  if (!canvasRef.value || !renderer) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio, 2)
  canvasRef.value.width = rect.width * dpr
  canvasRef.value.height = rect.height * dpr
  renderer.render(store.renderOptions)
}

function loop() {
  cancelAnimationFrame(raf)
  const tick = () => {
    if (renderer && store.simulation) {
      if (playing.value) {
        frameIndex.value = (frameIndex.value + 1) % store.simulation.frames.length
        renderer.setFrame(frameIndex.value)
      }
      renderer.render(store.renderOptions)
    }
    raf = requestAnimationFrame(tick)
  }
  tick()
}

function seek(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  frameIndex.value = v
  renderer?.setFrame(v)
}
function togglePlay() {
  playing.value = !playing.value
}

const currentFrameData = ref<{ time: number; temp: number; td: number; md: number; pinned: number } | null>(null)
watch(frameIndex, () => {
  const f = store.simulation?.frames[frameIndex.value]
  if (f) currentFrameData.value = { time: f.time, temp: f.temp, td: f.tdStrain, md: f.mdStrain, pinned: f.pinnedRatio }
})

const defectsByKind = (kind: 'wrinkle' | 'void') => store.simulation?.defects.filter((d) => d.kind === kind) ?? []

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}
function rgbToHex(rgb: [number, number, number]): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`
}
const liquidHex = computed({
  get: () => rgbToHex(store.renderOptions.liquidColor),
  set: (hex: string) => {
    store.renderOptions.liquidColor = hexToRgb(hex)
  },
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  renderer?.dispose()
})
</script>

<template>
  <div class="grid gap-6" style="grid-template-columns: 360px 1fr">
    <div class="flex flex-col gap-6">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base">收缩炉温区</h2>
          <button class="btn" @click="addFurnace"><span v-html="iconPlus(15)"></span>新炉程</button>
        </div>
        <select v-model="furnaceId" class="select mb-4">
          <option v-for="f in furnaces" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
        <div v-if="furnace" class="flex flex-col gap-3">
          <div v-for="(z, i) in furnace.zones" :key="z.id" class="zone-row">
            <div class="flex items-center justify-between mb-2">
              <input v-model="z.name" class="input" style="font-weight: 500" />
              <button class="btn btn-danger" @click="deleteZone(i)"><span v-html="iconTrash(14)"></span></button>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <select v-model="z.kind" class="select">
                <option value="steam">蒸汽</option>
                <option value="hot-air">热风</option>
              </select>
              <label class="num-field">温度℃<input v-model.number="z.temp" type="number" class="input" /></label>
              <label class="num-field">时间s<input v-model.number="z.dwell" type="number" step="0.5" class="input" /></label>
            </div>
          </div>
          <button class="btn" @click="addZone">添加温区</button>
          <div class="flex gap-2">
            <button class="btn btn-primary flex-1" @click="saveFurnace">保存炉程</button>
            <button class="btn btn-danger" @click="deleteFurnace">删除</button>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h2 class="text-base mb-3">渲染设置</h2>
        <label class="setting-row">膜面光泽
          <input type="range" min="0" max="1" step="0.05" v-model.number="store.renderOptions.gloss" />
        </label>
        <label class="setting-row">白墨打底不透明度
          <input type="range" min="0" max="1" step="0.05" v-model.number="store.renderOptions.whiteUnder" />
        </label>
        <label class="setting-row">瓶体玻璃感
          <input type="range" min="0" max="1" step="0.05" v-model.number="store.renderOptions.glass" />
        </label>
        <label class="setting-row">液面高度 mm
          <input type="range" min="0" :max="store.bottle?.height ?? 200" v-model.number="store.renderOptions.liquidLevel" />
        </label>
        <div class="flex items-center gap-3 mt-3">
          <label class="label mb-0">液体颜色</label>
          <input type="color" v-model="liquidHex" />
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="store.renderOptions.showDefects" />显示缺陷</label>
        </div>
      </div>
    </div>

    <div class="card p-5 flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base">瓶身套标收缩渲染</h2>
          <div class="sub">鼠标拖动旋转 · 滚轮缩放 · 先接触瓶面的区域即时钉扎</div>
        </div>
        <button class="btn btn-primary" :disabled="!store.bottle || !store.film" @click="runSim">
          <span v-html="iconFlask(16)"></span>运行收缩仿真
        </button>
      </div>

      <div v-if="!store.bottle" class="flex-1">
        <EmptyState :icon="iconSim" title="尚未选择瓶型" subtitle="先到瓶型库选择一个瓶型并指定膜材批次" />
      </div>
      <div v-else class="gl-wrap">
        <canvas ref="canvasRef" class="gl-canvas"></canvas>
        <div v-if="currentFrameData" class="hud">
          <div><span>受热</span><b>{{ currentFrameData.time.toFixed(1) }}s</b></div>
          <div><span>膜温</span><b>{{ currentFrameData.temp.toFixed(1) }}℃</b></div>
          <div><span>TD 应变</span><b>{{ (currentFrameData.td * 100).toFixed(1) }}%</b></div>
          <div><span>MD 应变</span><b>{{ (currentFrameData.md * 100).toFixed(1) }}%</b></div>
          <div><span>钉扎率</span><b>{{ (currentFrameData.pinned * 100).toFixed(0) }}%</b></div>
        </div>
      </div>

      <div v-if="store.simulation" class="timeline">
        <button class="btn" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
        <input type="range" min="0" :max="store.simulation.frames.length - 1" :value="frameIndex" @input="seek" class="flex-1" />
        <span class="text-sm" style="color: var(--c-500)">{{ frameIndex }} / {{ store.simulation.frames.length - 1 }}</span>
      </div>

      <div v-if="store.simulation" class="grid grid-cols-2 gap-4 mt-4">
        <div class="defect-box">
          <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
            <span v-html="iconWarning(16)"></span>空鼓（桥接未贴面）{{ defectsByKind('void').length }} 处
          </h3>
          <div class="defect-list">
            <span v-for="(d, i) in defectsByKind('void')" :key="i" class="tag tag-warn">
              z={{ d.z.toFixed(1) }}mm 间隙 {{ d.magnitude.toFixed(2) }}mm
            </span>
          </div>
        </div>
        <div class="defect-box">
          <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
            <span v-html="iconWarning(16)"></span>起皱（材料盈余）{{ defectsByKind('wrinkle').length }} 处
          </h3>
          <div class="defect-list">
            <span v-for="(d, i) in defectsByKind('wrinkle')" :key="i" class="tag tag-danger">
              z={{ d.z.toFixed(1) }}mm 盈余 {{ (d.magnitude * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
      <div v-if="status" class="status-line">{{ status }}</div>
    </div>
  </div>
</template>

<style scoped>
.sub { font-size: var(--fs-xs); color: var(--c-400); margin-top: 2px; }
.zone-row { padding: var(--sp-3); border: 1px solid var(--c-100); border-radius: var(--radius); }
.num-field { font-size: 12px; color: var(--c-500); display: flex; flex-direction: column; gap: 2px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-xs); color: var(--c-600); padding: var(--sp-2) 0; }
.setting-row input[type='range'] { width: 160px; }
.gl-wrap { position: relative; flex: 1; min-height: 460px; }
.gl-canvas { width: 100%; height: 100%; border-radius: var(--radius); border: 1px solid var(--c-100); display: block; }
.hud {
  position: absolute; top: var(--sp-3); left: var(--sp-3);
  background: rgba(255,255,255,0.92); border: 1px solid var(--c-100);
  border-radius: var(--radius); padding: var(--sp-3) var(--sp-4);
  display: flex; gap: var(--sp-4); box-shadow: var(--shadow);
}
.hud div { display: flex; flex-direction: column; font-size: 12px; color: var(--c-400); }
.hud b { font-size: var(--fs-sm); color: var(--c-800); }
.timeline { display: flex; align-items: center; gap: var(--sp-3); margin-top: var(--sp-4); }
.defect-box { padding: var(--sp-4); border: 1px solid var(--c-100); border-radius: var(--radius); }
.defect-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); max-height: 96px; overflow: auto; }
.status-line { margin-top: var(--sp-3); font-size: var(--fs-xs); color: var(--c-primary-strong); }
.flex-1 { flex: 1; }
.mt-3 { margin-top: var(--sp-3); }
.mt-4 { margin-top: var(--sp-4); }
</style>
