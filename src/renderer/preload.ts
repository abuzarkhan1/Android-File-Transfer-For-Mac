// Re-export types from the main preload so the renderer can import them
// without crossing the process boundary. The actual API is exposed via
// contextBridge as window.electronAPI.
export type { LocalFile, MtpFile, ElectronAPI } from '../main/preload'
