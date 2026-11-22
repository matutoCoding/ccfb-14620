// 线性图标集：统一 1.6 描边、圆角端点，默认继承 currentColor
const wrap = (paths: string) => (size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const iconBottle = wrap('<path d="M9 2h6M10 2v4.5L7.2 11a7 7 0 0 0-1.2 3.9V20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.1a7 7 0 0 0-1.2-3.9L14 6.5V2"/>')
export const iconFilm = wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>')
export const iconWarp = wrap('<path d="M4 20c4-1 5-5 8-8s5-4 8-5M4 20l4-1M4 20l1-4"/><rect x="3" y="3" width="18" height="18" rx="2" opacity="0.35"/>')
export const iconSim = wrap('<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v2.5l2 1.5"/>')
export const iconCheck = wrap('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')
export const iconSettings = wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
export const iconPlus = wrap('<path d="M12 5v14M5 12h14"/>')
export const iconTrash = wrap('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>')
export const iconDownload = wrap('<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>')
export const iconUpload = wrap('<path d="M12 15V3m0 0L8 7m4-4l4 4M4 21h16"/>')
export const iconWarning = wrap('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>')
export const iconGrid = wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>')
export const iconRotate = wrap('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>')
export const iconLayers = wrap('<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>')
export const iconFlask = wrap('<path d="M9 3h6M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.5 15h9"/>')
export const iconChart = wrap('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>')
