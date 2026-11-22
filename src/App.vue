<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  iconBottle,
  iconFilm,
  iconWarp,
  iconSim,
  iconCheck,
  iconSettings,
} from '@/components/icons.ts'

const route = useRoute()
const nav = [
  { path: '/bottles', label: '瓶型库', icon: iconBottle },
  { path: '/films', label: '膜材参数', icon: iconFilm },
  { path: '/artwork', label: '稿件预变形', icon: iconWarp },
  { path: '/simulation', label: '收缩仿真', icon: iconSim },
  { path: '/verification', label: '上机核对', icon: iconCheck },
  { path: '/settings', label: '设置', icon: iconSettings },
]
const title = computed(() => (route.meta.title as string) ?? '')
</script>

<template>
  <div class="flex h-full">
    <aside class="w-56 shrink-0 border-r flex flex-col" style="background: var(--c-800); border-color: rgba(255,255,255,0.08)">
      <div class="px-5 py-6">
        <div style="color: var(--c-0)" class="text-base font-semibold">热收缩套标工作台</div>
        <div class="mt-1" style="color: var(--c-400); font-size: var(--fs-xs)">Sleeve Shrink Workbench</div>
      </div>
      <nav class="flex-1 px-3 flex flex-col gap-1">
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.path) }"
          v-html="`${item.icon(18)}<span>${item.label}</span>`"
        />
      </nav>
      <div class="px-5 py-4" style="color: var(--c-500); font-size: var(--fs-xs)">
        WebGL2 · IndexedDB
      </div>
    </aside>
    <main class="flex-1 flex flex-col min-w-0">
      <header class="h-14 shrink-0 flex items-center px-6 border-b bg-white" style="border-color: var(--c-100)">
        <h1 class="text-lg">{{ title }}</h1>
      </header>
      <section class="flex-1 min-h-0 overflow-auto p-6">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius);
  color: var(--c-300);
  text-decoration: none;
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
  transition: background var(--t-fast), color var(--t-fast);
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--c-0);
}
.nav-item.active {
  background: var(--c-primary);
  color: var(--c-0);
}
</style>
