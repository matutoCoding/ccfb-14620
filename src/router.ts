import { createRouter, createWebHashHistory } from 'vue-router'
import BottleLibrary from '@/pages/BottleLibrary.vue'
import FilmLibrary from '@/pages/FilmLibrary.vue'
import ArtworkWarpPage from '@/pages/ArtworkWarpPage.vue'
import SimulationPage from '@/pages/SimulationPage.vue'
import VerificationPage from '@/pages/VerificationPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/bottles' },
    { path: '/bottles', component: BottleLibrary, meta: { title: '瓶型库' } },
    { path: '/films', component: FilmLibrary, meta: { title: '膜材参数' } },
    { path: '/artwork', component: ArtworkWarpPage, meta: { title: '稿件预变形' } },
    { path: '/simulation', component: SimulationPage, meta: { title: '收缩仿真' } },
    { path: '/verification', component: VerificationPage, meta: { title: '上机核对' } },
    { path: '/settings', component: SettingsPage, meta: { title: '设置' } },
  ],
})
