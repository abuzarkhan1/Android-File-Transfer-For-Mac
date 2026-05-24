import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { basename, join } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { MtpService } from './mtpService'

let mainWindow: BrowserWindow | null = null

// Reduce background network noise; the app itself is local/offline-first.
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-features', 'CertificateTransparencyComponentUpdater')
app.commandLine.appendSwitch('log-level', '3')

process.env.PAGER = 'cat'
process.env.NO_COLOR = '1'

const getAppIconPath = () => {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath || '', 'icon.png'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function createWindow() {
  const iconPath = getAppIconPath()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: iconPath,
    backgroundColor: '#1C1C1E',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const resolveHomePath = (inputPath: string): string => {
  if (inputPath === '~') {
    return os.homedir()
  }

  if (inputPath.startsWith('~/')) {
    return join(os.homedir(), inputPath.slice(2))
  }

  return inputPath
}

// Helper to format file sizes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const buildLocalFile = (fullPath: string) => {
  const stat = fs.statSync(fullPath)
  const isFolder = stat.isDirectory()
  const name = basename(fullPath)
  const ext = name.split('.').pop()?.toLowerCase() || ''

  let icon = isFolder ? '📁' : '📄'

  if (!isFolder) {
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
      icon = '🖼️'
    } else if (['mp4', 'mkv', 'avi', 'mov', '3gp'].includes(ext)) {
      icon = '🎬'
    } else if (['mp3', 'wav', 'm4a', 'flac'].includes(ext)) {
      icon = '🎵'
    } else if (['pdf', 'docx', 'xlsx', 'pptx', 'txt'].includes(ext)) {
      icon = '📝'
    } else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
      icon = '🗜️'
    } else if (['apk'].includes(ext)) {
      icon = '📦'
    }
  }

  return {
    name,
    size: isFolder ? '--' : formatBytes(stat.size),
    sizeBytes: stat.size,
    type: isFolder ? 'Folder' : ext.toUpperCase() || 'Unknown',
    icon,
    isFolder,
    date: stat.mtime.toLocaleDateString(),
    path: fullPath,
  }
}

app.whenReady().then(() => {
  const iconPath = getAppIconPath()

  if (process.platform === 'darwin' && iconPath) {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath))
  }

  // ── MTP: Detect Device ───────────────────────────────────────────────────
  ipcMain.handle('mtp:detect', async () => {
    try {
      return await MtpService.detectDevice()
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'MTP Device Detection Error',
      }
    }
  })

  // ── MTP: List All Files — manual/slow scan ───────────────────────────────
  ipcMain.handle('mtp:list-files', async () => {
    try {
      return await MtpService.listFiles()
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'MTP Listing Error',
      }
    }
  })

  ipcMain.handle('mtp:list-folder-files', async (_event, parentId?: string) => {
    try {
      return await MtpService.listFolderFiles(parentId)
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'MTP Folder File Listing Error',
      }
    }
  })

  // ── MTP: List Folders — fast startup ─────────────────────────────────────
  ipcMain.handle('mtp:list-folders', async () => {
    try {
      return await MtpService.listFolders()
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'MTP Folder Listing Error',
      }
    }
  })

  // ── MTP: Download Android file to Mac Downloads ──────────────────────────
  ipcMain.handle(
    'mtp:download-file',
    async (
      _event,
      fileId: string,
      fileName: string,
      providedDestinationDir?: string
    ) => {
      if (!mainWindow) {
        return {
          success: false,
          error: 'Window context missing.',
        }
      }

      try {
        const destinationDir = resolveHomePath(
          providedDestinationDir || join(os.homedir(), 'Downloads')
        )

        if (!fs.existsSync(destinationDir)) {
          fs.mkdirSync(destinationDir, { recursive: true })
        }

        if (!fs.statSync(destinationDir).isDirectory()) {
          return {
            success: false,
            error: `Download destination is not a folder: ${destinationDir}`,
          }
        }

        return await MtpService.downloadFile(fileId, fileName, destinationDir)
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'MTP Download Error',
        }
      }
    }
  )

  // ── MTP: Upload Mac file to Android current folder ───────────────────────
  ipcMain.handle(
    'mtp:upload-file',
    async (_event, providedPath?: string, parentId?: string) => {
      if (!mainWindow) {
        return {
          success: false,
          error: 'Window context missing.',
        }
      }

      try {
        let localFilePath = providedPath

        if (!localFilePath) {
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select File to Upload to Android',
            buttonLabel: 'Upload File',
            properties: ['openFile'],
          })

          if (canceled || filePaths.length === 0) {
            return {
              success: false,
              error: 'Upload cancelled by user.',
            }
          }

          localFilePath = filePaths[0]
        }

        localFilePath = resolveHomePath(localFilePath)

        if (!fs.existsSync(localFilePath)) {
          return {
            success: false,
            error: `File not found: ${localFilePath}`,
          }
        }

        const stat = fs.statSync(localFilePath)

        if (stat.isDirectory()) {
          return {
            success: false,
            error: 'Folder upload is not supported yet. Select a file.',
          }
        }

        return await MtpService.uploadFile(localFilePath, parentId)
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'MTP Upload Error',
        }
      }
    }
  )

  // ── MTP: Delete File ─────────────────────────────────────────────────────
  ipcMain.handle('mtp:delete', async (_event, fileId: string) => {
    try {
      return await MtpService.deleteFile(fileId)
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to delete remote file',
      }
    }
  })

  // ── MTP: Create Folder in Current Android Folder ─────────────────────────
  ipcMain.handle(
    'mtp:create-folder',
    async (_event, name: string, parentId?: string) => {
      try {
        return await MtpService.createFolder(name, parentId)
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to create remote folder',
        }
      }
    }
  )

  // ── Local: List Mac Files ────────────────────────────────────────────────
  ipcMain.handle('local:list-files', async (_event, localPath: string) => {
    try {
      const targetPath = resolveHomePath(localPath)

      if (!fs.existsSync(targetPath)) {
        return {
          success: false,
          error: `Folder not found: ${targetPath}`,
        }
      }

      if (!fs.statSync(targetPath).isDirectory()) {
        return {
          success: false,
          error: `Not a folder: ${targetPath}`,
        }
      }

      const items = fs.readdirSync(targetPath)
      const fileList = []

      for (const item of items) {
        if (item.startsWith('.')) continue

        try {
          const fullPath = join(targetPath, item)
          fileList.push(buildLocalFile(fullPath))
        } catch {
          // Ignore files that cannot be read.
        }
      }

      return {
        success: true,
        files: fileList,
        path: targetPath,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to list local files',
      }
    }
  })

  ipcMain.handle('local:select-folder', async (_event, currentPath?: string) => {
    if (!mainWindow) {
      return {
        success: false,
        error: 'Window context missing.',
      }
    }

    try {
      const defaultPath = currentPath ? resolveHomePath(currentPath) : os.homedir()
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose Mac Folder',
        buttonLabel: 'Open Folder',
        defaultPath: fs.existsSync(defaultPath) ? defaultPath : os.homedir(),
        properties: ['openDirectory', 'createDirectory'],
      })

      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          error: 'Folder selection cancelled.',
        }
      }

      return {
        success: true,
        path: filePaths[0],
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to choose folder',
      }
    }
  })

  ipcMain.handle('local:select-files', async () => {
    if (!mainWindow) {
      return {
        success: false,
        error: 'Window context missing.',
      }
    }

    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Files to Upload to Android',
        buttonLabel: 'Upload',
        defaultPath: os.homedir(),
        properties: ['openFile', 'multiSelections'],
      })

      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          error: 'Upload cancelled by user.',
        }
      }

      return {
        success: true,
        files: filePaths
          .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
          .map((filePath) => buildLocalFile(filePath)),
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to choose files',
      }
    }
  })

  // ── Local: Create Folder ─────────────────────────────────────────────────
  ipcMain.handle(
    'local:create-folder',
    async (_event, localPath: string, name: string) => {
      try {
        const targetPath = resolveHomePath(localPath)
        const folderPath = join(targetPath, name)

        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath)
        }

        return {
          success: true,
        }
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to create folder',
        }
      }
    }
  )

  // ── Local: Delete File or Folder ─────────────────────────────────────────
  ipcMain.handle('local:delete-file', async (_event, localFilePath: string) => {
    try {
      const targetPath = resolveHomePath(localFilePath)

      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath)

        if (stat.isDirectory()) {
          fs.rmSync(targetPath, {
            recursive: true,
            force: true,
          })
        } else {
          fs.unlinkSync(targetPath)
        }
      }

      return {
        success: true,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to delete file',
      }
    }
  })

  // ── Local: Get File Size for Transfer Progress ───────────────────────────
  ipcMain.handle('local:get-file-size', async (_event, localFilePath: string) => {
    try {
      const targetPath = resolveHomePath(localFilePath)

      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath)

        return {
          success: true,
          sizeBytes: stat.size,
        }
      }

      return {
        success: true,
        sizeBytes: 0,
      }
    } catch (err: any) {
      return {
        success: false,
        sizeBytes: 0,
        error: err.message,
      }
    }
  })

  // ── Window Controls ──────────────────────────────────────────────────────
  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close()
  })

  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
