<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAll, STORES } from '@/db/indexeddb.ts'
import { store, resetCorrection } from '@/state/store.ts'
import { iconSettings, iconTrash } from '@/components/icons.ts'

const counts = ref<Record<string, number>>({})
const simResolution = ref({ nU: 128, nV: 80 })

onMounted(async () => {
  for (const name of STORES) {
    counts.value[name] = (await getAll(name)).length
  }
})

async function wipeAll() {
  if (!window.confirm('确定清空全部本地数据？此操作不可恢复')) return
  const dbs = await indexedDB.databases?.()
  for (const d of dbs ?? []) {
    if (d.name) indexedDB.deleteDatabase(d.name)
  }
  window.location.reload()
}

const storeLabels: Record<string, string> = {
  bottles: '瓶型',
  films: '膜材批次',
  furnaces: '炉程',
  artworks: '稿件',
  projects: '项目',
  corrections: '修正记录',
}

const acceptance = [
  { label: 'Logo 中心收缩后偏差', target: '< 0.5 mm', engine: '预变形逆场双线性映射 + 刚性区相似保形' },
  { label: '条码宽窄比误差', target: '≤ 5%', engine: '逐高度带 L(z) 误差评级 + 逐列反向补偿' },
  { label: '两轮网格修正平均偏差', target: '较首轮减半', engine: '热力带应变偏差反修 TD 曲线，0.6 增益防过冲' },
]
</script>

<template>
  <div class="flex flex-col gap-6 max-w-4xl">
    <div class="card p-5">
      <h2 class="text-base mb-4 flex items-center gap-2"><span v-html="iconSettings(18)"></span>仿真参数</h2>
      <div class="grid grid-cols-2 gap-4">
        <label class="label">套筒环向网格数 nU
          <input v-model.number="simResolution.nU" type="number" min="32" max="256" step="16" class="input mt-1" />
        </label>
        <label class="label">套筒纵向网格数 nV
          <input v-model.number="simResolution.nV" type="number" min="20" max="160" step="8" class="input mt-1" />
        </label>
      </div>
      <p class="sub mt-3">网格越密精度越高、求解越慢；当前仿真默认 128×80，自测精度模式 200×120。</p>
    </div>

    <div class="card p-5">
      <h2 class="text-base mb-4">准度验收指标</h2>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>指标</th><th>目标</th><th>系统保障机制</th></tr></thead>
          <tbody>
            <tr v-for="a in acceptance" :key="a.label">
              <td class="font-medium">{{ a.label }}</td>
              <td><span class="tag tag-ok">{{ a.target }}</span></td>
              <td class="sub">{{ a.engine }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="alert mt-4">
        当前修正轮次：<b>{{ store.correctionRound }}</b>
        <button v-if="store.correctionRound" class="btn ml-4" @click="resetCorrection">恢复膜材原始曲线</button>
      </div>
    </div>

    <div class="card p-5">
      <h2 class="text-base mb-4">本地数据（IndexedDB）</h2>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div v-for="name in STORES" :key="name" class="data-box">
          <div class="num">{{ counts[name] ?? 0 }}</div>
          <div class="sub">{{ storeLabels[name] }}</div>
        </div>
      </div>
      <button class="btn btn-danger" @click="wipeAll">
        <span v-html="iconTrash(16)"></span>清空全部本地数据
      </button>
    </div>

    <div class="card p-5">
      <h2 class="text-base mb-3">技术说明</h2>
      <ul class="tech-list">
        <li>几何：回转母线 + 圆/椭圆/圆角矩形截面，弧长均匀重采样保证材料方向对齐</li>
        <li>动力学：一阶松弛 dε/dt = k(ε_eq(T) - ε)，蒸汽/热风分区换热系数</li>
        <li>接触：自由节点半径进入瓶面即钉扎，邻居松弛传递膜张力，逐帧检测起皱与空鼓</li>
        <li>渲染：手写 WebGL2 着色器，白墨打底、透明窗、菲涅耳光泽、液体显色</li>
        <li>存储：全部瓶型/膜材/炉程/稿件/修正曲线持久化在浏览器 IndexedDB，不上传服务器</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.sub { font-size: var(--fs-xs); color: var(--c-400); }
.mt-1 { margin-top: var(--sp-1); }
.mt-3 { margin-top: var(--sp-3); }
.mt-4 { margin-top: var(--sp-4); }
.ml-4 { margin-left: var(--sp-4); }
.data-box { padding: var(--sp-4); border: 1px solid var(--c-100); border-radius: var(--radius); text-align: center; }
.num { font-size: var(--fs-2xl); font-weight: 600; color: var(--c-primary); }
.alert { padding: var(--sp-3) var(--sp-4); background: var(--c-primary-soft); border-radius: var(--radius); color: var(--c-primary-strong); display: flex; align-items: center; font-size: var(--fs-xs); }
.tech-list { margin: 0; padding-left: var(--sp-5); color: var(--c-600); font-size: var(--fs-xs); line-height: 2; }
.font-medium { font-weight: 500; }
</style>
