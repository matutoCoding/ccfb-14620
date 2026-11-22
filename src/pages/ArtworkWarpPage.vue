<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Artwork } from '@/core/types'
import { getAll, put, remove } from '@/db/indexeddb.ts'
import { store } from '@/state/store.ts'
import { buildBottleGeometry } from '@/core/geometry'
import { runShrinkSimulation } from '@/core/simulation'
import { buildWarpField } from '@/core/warp_field'
import { renderWarpedArtwork, gradeCodeRegion } from '@/core/artwork_warp'
import { generateSampleArtwork, loadImage, makeArtworkMeta } from '@/core/artwork_factory'
import { renderUnfolded, renderOverlay } from '@/core/unfold'
import { composePlate, downloadCanvas, downloadHtmlDoc, buildProcessCardHtml } from '@/core/export'
import EmptyState from '@/components/EmptyState.vue'
import { iconWarp, iconPlus, iconDownload, iconTrash, iconUpload } from '@/components/icons.ts'

const artworks = ref<Artwork[]>([])
const selectedId = ref('')
const showGrid = ref(true)
const warpedCanvas = ref<HTMLCanvasElement | null>(null)
const unfoldedCanvas = ref<HTMLCanvasElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)
const message = ref('')

onMounted(async () => {
  artworks.value = await getAll<Artwork>('artworks')
})

const selected = computed(() => artworks.value.find((a) => a.id === selectedId.value) ?? null)
const ready = computed(() => Boolean(store.bottle && store.film && store.furnace && selected.value))

async function createSample() {
  const canvas = generateSampleArtwork()
  const art = makeArtworkMeta(canvas, `示例稿件 ${artworks.value.length + 1}`, 210, 150)
  await put('artworks', art)
  artworks.value = await getAll('artworks')
  selectedId.value = art.id
}

async function importFile(evt: Event) {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  try {
    if (file.type === 'image/svg+xml') {
      const text = await file.text()
      const blob = new Blob([text], { type: 'image/svg+xml' })
      const img = await loadImage(URL.createObjectURL(blob))
      const c = document.createElement('canvas')
      c.width = img.naturalWidth || 1200
      c.height = img.naturalHeight || 800
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
      await saveFromCanvas(c, file.name)
    } else {
      const img = await loadImage(url)
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')?.drawImage(img, 0, 0)
      await saveFromCanvas(c, file.name)
    }
  } finally {
    URL.revokeObjectURL(url)
    input.value = ''
  }
}

async function saveFromCanvas(canvas: HTMLCanvasElement, name: string) {
  const art = makeArtworkMeta(canvas, name.replace(/\.[^.]+$/, ''), 210, 150)
  art.imageDataUrl = canvas.toDataURL('image/png')
  await put('artworks', art)
  artworks.value = await getAll('artworks')
  selectedId.value = art.id
}

async function del(a: Artwork) {
  await remove('artworks', a.id)
  if (selectedId.value === a.id) selectedId.value = ''
  artworks.value = await getAll('artworks')
}

const warpProgress = ref(0)

async function runWarp() {
  if (!store.bottle || !store.film || !store.furnace || !selected.value) {
    message.value = '请先在瓶型库、膜材页选好瓶型/膜材，并在仿真页配置炉温'
    return
  }
  message.value = '求解中…'
  warpProgress.value = 0
  const geo = buildBottleGeometry(store.bottle)
  const film = store.correctedTdCurve
    ? { ...store.film, tdCurve: store.correctedTdCurve }
    : store.film
  const sim = runShrinkSimulation(geo, film, store.furnace, { nU: 128, nV: 80 })
  store.simulation = sim
  const field = buildWarpField(sim, selected.value.widthMm, selected.value.heightMm)
  const img = await loadImage(selected.value.imageDataUrl)
  message.value = '逐像素逆采样渲染中…'
  const warped = await renderWarpedArtwork(img, field, {
    rigidRegions: selected.value.rigidRegions,
    showGrid: showGrid.value,
    onProgress: (r) => {
      warpProgress.value = r
    },
  })
  warpedCanvas.value = warped
  unfoldedCanvas.value = renderUnfolded(field, img)
  overlayCanvas.value = renderOverlay(img, unfoldedCanvas.value)
  store.artwork = selected.value
  message.value = '预变形完成'
}

const codeGrades = computed(() => {
  if (!store.simulation || !selected.value) return []
  return selected.value.codeRegions.map((r) => gradeCodeRegion(store.simulation!, r))
})

function exportPlate() {
  if (!warpedCanvas.value || !selected.value) return
  const plate = composePlate(warpedCanvas.value, selected.value)
  downloadCanvas(plate, `${selected.value.name}-制版稿.png`)
}

function exportCard() {
  if (!store.simulation || !selected.value || !store.bottle || !store.film || !store.furnace) return
  const html = buildProcessCardHtml({
    bottle: store.bottle,
    film: store.film,
    furnace: store.furnace,
    sim: store.simulation,
    artwork: selected.value,
    correctionRound: store.correctionRound,
  })
  downloadHtmlDoc(html, `${selected.value.name}-工艺卡.html`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="card p-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base mb-1">平面稿件</h2>
          <div class="sub">支持 PNG / SVG 导入，或生成内置示例稿；刚性区保形、底纹自由变形</div>
        </div>
        <div class="flex gap-2">
          <button class="btn" @click="createSample"><span v-html="iconPlus(16)"></span>生成示例稿</button>
          <label class="btn cursor-pointer"><span v-html="iconUpload(16)"></span>导入 PNG/SVG
            <input type="file" accept="image/png,image/svg+xml" class="hidden" @change="importFile" />
          </label>
        </div>
      </div>
      <div v-if="artworks.length" class="grid grid-cols-3 gap-3 mt-4">
        <div v-for="a in artworks" :key="a.id" class="art-card" :class="{ active: a.id === selectedId }" @click="selectedId = a.id">
          <img :src="a.imageDataUrl" class="art-thumb" />
          <div class="art-meta">
            <div class="font-medium truncate">{{ a.name }}</div>
            <div class="sub">{{ a.widthMm }}×{{ a.heightMm }}mm · 搭接 {{ a.overlapMm }}mm</div>
          </div>
          <button class="btn btn-danger" @click.stop="del(a)"><span v-html="iconTrash(15)"></span></button>
        </div>
      </div>
      <EmptyState v-else :icon="iconWarp" title="还没有稿件" subtitle="导入客户平面稿，或先用内置示例稿跑通流程" class="mt-4" />
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base">预变形求解</h2>
          <div class="sub">
            瓶型：{{ store.bottle?.name ?? '未选择' }} ｜ 膜材：{{ store.film?.name ?? '未选择' }}
            ｜ 炉程：{{ store.furnace?.name ?? '未配置' }}
            <span v-if="store.correctionRound" class="tag ml-2">第 {{ store.correctionRound }} 轮修正曲线生效中</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="showGrid" />显示变形网格</label>
          <button class="btn btn-primary" :disabled="!ready" @click="runWarp">
            <span v-html="iconWarp(16)"></span>计算预变形
          </button>
        </div>
      </div>
      <div v-if="message" class="alert">
        {{ message }}
        <div v-if="warpProgress > 0 && warpProgress < 1" class="progress-track">
          <div class="progress-bar" :style="{ width: `${(warpProgress * 100).toFixed(0)}%` }"></div>
        </div>
      </div>

      <div v-if="warpedCanvas" class="grid gap-5" style="grid-template-columns: 1fr 1fr">
        <div>
          <h3 class="text-sm font-semibold mb-2">预变形制版稿</h3>
          <div class="canvas-box"><img :src="warpedCanvas.toDataURL()" /></div>
        </div>
        <div>
          <h3 class="text-sm font-semibold mb-2">展开对照（收缩后回平面）</h3>
          <div class="canvas-box"><img :src="unfoldedCanvas?.toDataURL()" /></div>
        </div>
        <div>
          <h3 class="text-sm font-semibold mb-2">原稿/收缩稿叠加偏差</h3>
          <div class="canvas-box"><img :src="overlayCanvas?.toDataURL()" /></div>
        </div>
        <div>
          <h3 class="text-sm font-semibold mb-2">条码 / 二维码评级</h3>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>区域</th><th>类型</th><th>宽窄比误差</th><th>最差高度</th><th>等级</th></tr></thead>
              <tbody>
                <tr v-for="g in codeGrades" :key="g.region.id">
                  <td>{{ g.region.name }}</td>
                  <td>{{ g.region.kind === 'barcode' ? '条码' : '二维码' }}</td>
                  <td :style="{ color: g.scannable ? 'var(--c-ok)' : 'var(--c-danger)' }">
                    {{ (g.widthError * 100).toFixed(2) }}%
                  </td>
                  <td>z={{ g.worstZ.toFixed(1) }}mm ({{ (g.worstError * 100).toFixed(2) }}%)</td>
                  <td>
                    <span class="tag" :class="g.scannable ? (g.grade === 'A' ? 'tag-ok' : 'tag-warn') : 'tag-danger'">
                      {{ g.grade }}{{ g.scannable ? ' 可扫' : ' 扫不了' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="codeGrades.some((g) => !g.scannable)" class="alert-danger mt-3">
            存在扫不了的码：优先检查最差高度带的局部收缩率，降低该区间炉温或增大预补偿
          </div>
        </div>
      </div>

      <div v-if="warpedCanvas" class="flex gap-3 mt-5">
        <button class="btn btn-primary" @click="exportPlate"><span v-html="iconDownload(16)"></span>导出制版稿（含搭接区/胶水线）</button>
        <button class="btn" @click="exportCard"><span v-html="iconDownload(16)"></span>导出工艺卡</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sub { font-size: var(--fs-xs); color: var(--c-400); margin-top: 2px; }
.hidden { display: none; }
.art-card {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3); border: 1px solid var(--c-100); border-radius: var(--radius); cursor: pointer;
}
.art-card.active { border-color: var(--c-primary); background: var(--c-primary-soft); }
.art-thumb { width: 72px; height: 52px; object-fit: cover; border: 1px solid var(--c-100); border-radius: var(--radius-sm); }
.art-meta { flex: 1; min-width: 0; }
.canvas-box {
  border: 1px solid var(--c-100); border-radius: var(--radius); background: var(--c-25);
  padding: var(--sp-3); display: flex; justify-content: center;
}
.canvas-box img { max-width: 100%; max-height: 320px; }
.alert { padding: var(--sp-3) var(--sp-4); background: var(--c-primary-soft); border-radius: var(--radius); color: var(--c-primary-strong); margin-bottom: var(--sp-4); }
.progress-track { height: 6px; background: var(--c-100); border-radius: 3px; margin-top: var(--sp-2); overflow: hidden; }
.progress-bar { height: 100%; background: var(--c-primary); transition: width var(--t-fast); }
.alert-danger { padding: var(--sp-3) var(--sp-4); background: var(--c-danger-soft); border-radius: var(--radius); color: var(--c-danger); font-size: var(--fs-xs); }
.ml-2 { margin-left: var(--sp-2); }
.mt-3 { margin-top: var(--sp-3); }
.mt-4 { margin-top: var(--sp-4); }
.mt-5 { margin-top: var(--sp-5); }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
