import type { ShrinkRenderer } from './renderer.ts'

// 鼠标/触控轨道控制：左键拖动旋转，滚轮缩放
export function attachOrbitControls(canvas: HTMLCanvasElement, renderer: ShrinkRenderer) {
  let dragging = false
  let lastX = 0
  let lastY = 0

  const down = (x: number, y: number) => {
    dragging = true
    lastX = x
    lastY = y
    canvas.style.cursor = 'grabbing'
  }
  const move = (x: number, y: number) => {
    if (!dragging) return
    const dx = x - lastX
    const dy = y - lastY
    lastX = x
    lastY = y
    renderer.rotate(dx * 0.01, dy * 0.01)
  }
  const up = () => {
    dragging = false
    canvas.style.cursor = 'grab'
  }

  canvas.style.cursor = 'grab'
  canvas.addEventListener('mousedown', (e) => down(e.clientX, e.clientY))
  window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY))
  window.addEventListener('mouseup', up)
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      renderer.zoom(e.deltaY * 0.5)
    },
    { passive: false },
  )
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    down(t.clientX, t.clientY)
  })
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0]
    move(t.clientX, t.clientY)
  })
  canvas.addEventListener('touchend', up)
}
