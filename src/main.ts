import { createApp } from 'vue'
import { router } from './router.ts'
import App from './App.vue'
import { seedIfEmpty } from './db/repos.ts'
import './styles.css'

seedIfEmpty()
  .catch((e) => console.error('种子数据初始化失败', e))
  .finally(() => {
    createApp(App).use(router).mount('#app')
  })
