import { contextBridge, ipcRenderer } from 'electron'

export interface LocalFile {
  name: string
  size: string
  sizeBytes: number
  type: string
  icon: string
  isFolder: boolean
  date: string
  path?: string
}

export interface MtpFile {
  id: string
  name: string
  size: number
  type: string
  parentId?: string
  isFolder?: boolean
  date?: string
}

export interface ElectronAPI {
  // MTP operations
  detectDevice: () => Promise<{
    success: boolean
    deviceName?: string
    storageDescription?: string
    storageCapacity?: number
    storageFree?: number
    storageUsedPercentage?: number
    error?: string
  }>

  listFiles: () => Promise<{
    success: boolean
    files?: MtpFile[]
    error?: string
  }>

  listFolderFiles: (
    parentId?: string
  ) => Promise<{
    success: boolean
    files?: MtpFile[]
    error?: string
  }>

  listFolders: () => Promise<{
    success: boolean
    folders?: MtpFile[]
    storageRootId?: string
    storageName?: string
    error?: string
  }>

  downloadFile: (
    fileId: string,
    fileName: string,
    destinationDir?: string
  ) => Promise<{
    success: boolean
    path?: string
    error?: string
  }>

  uploadFile: (
    localPath?: string,
    parentId?: string
  ) => Promise<{
    success: boolean
    fileName?: string
    error?: string
  }>

  selectLocalFolder: (
    currentPath?: string
  ) => Promise<{
    success: boolean
    path?: string
    error?: string
  }>

  selectLocalFiles: () => Promise<{
    success: boolean
    files?: LocalFile[]
    error?: string
  }>

  mtpDelete: (
    fileId: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  mtpCreateFolder: (
    name: string,
    parentId?: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Local file operations
  listLocalFiles: (
    localPath: string
  ) => Promise<{
    success: boolean
    files?: LocalFile[]
    path?: string
    error?: string
  }>

  createLocalFolder: (
    localPath: string,
    name: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  deleteLocalFile: (
    localPath: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  getLocalFileSize: (
    localPath: string
  ) => Promise<{
    success: boolean
    sizeBytes: number
    error?: string
  }>

  // Window control
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeWindow: () => void
}

const api: ElectronAPI = {
  detectDevice: () => ipcRenderer.invoke('mtp:detect'),

  listFiles: () => ipcRenderer.invoke('mtp:list-files'),

  listFolderFiles: (parentId) =>
    ipcRenderer.invoke('mtp:list-folder-files', parentId),

  listFolders: () => ipcRenderer.invoke('mtp:list-folders'),

  downloadFile: (fileId, fileName, destinationDir) =>
    ipcRenderer.invoke('mtp:download-file', fileId, fileName, destinationDir),

  uploadFile: (localPath, parentId) =>
    ipcRenderer.invoke('mtp:upload-file', localPath, parentId),

  selectLocalFolder: (currentPath) =>
    ipcRenderer.invoke('local:select-folder', currentPath),

  selectLocalFiles: () =>
    ipcRenderer.invoke('local:select-files'),

  mtpDelete: (fileId) =>
    ipcRenderer.invoke('mtp:delete', fileId),

  mtpCreateFolder: (name, parentId) =>
    ipcRenderer.invoke('mtp:create-folder', name, parentId),

  listLocalFiles: (localPath) =>
    ipcRenderer.invoke('local:list-files', localPath),

  createLocalFolder: (localPath, name) =>
    ipcRenderer.invoke('local:create-folder', localPath, name),

  deleteLocalFile: (localPath) =>
    ipcRenderer.invoke('local:delete-file', localPath),

  getLocalFileSize: (localPath) =>
    ipcRenderer.invoke('local:get-file-size', localPath),

  closeWindow: () => ipcRenderer.send('window:close'),

  minimizeWindow: () => ipcRenderer.send('window:minimize'),

  maximizeWindow: () => ipcRenderer.send('window:maximize'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
