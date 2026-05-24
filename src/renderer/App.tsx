import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Grid2X2, List, RefreshCw, Search, Sun, X } from 'lucide-react'
import { ConnectionGuide } from './components/ConnectionGuide'
import { SplitScreen } from './components/SplitScreen'
import { ContextMenu } from './components/ContextMenu'
import { TransferModal, TransferState } from './components/TransferModal'
import { LocalFile, MtpFile } from './preload'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface ToastItem {
  id: string
  message: string
  type: 'ok' | 'err' | 'info'
}

// ── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  // Theme
  const [isDark, setIsDark] = useState(true)

  // Connection
  const [connected, setConnected] = useState(false)
  const [deviceName, setDeviceName] = useState('Android Device')
  const [storageInfo, setStorageInfo] = useState('')
  const [storagePercentage, setStoragePercentage] = useState(0)

  // Mac files
  const [macFiles, setMacFiles] = useState<LocalFile[]>([])
  const [macPath, setMacPath] = useState<string[]>(['Home', 'Downloads'])
  const [macFullPath, setMacFullPath] = useState('~/Downloads')

  // Android files
  const [androidFolders, setAndroidFolders] = useState<MtpFile[]>([])
  const [androidAllFiles, setAndroidAllFiles] = useState<MtpFile[]>([])
  const [storageRootId, setStorageRootId] = useState<string>('')
  const [androidLoading, setAndroidLoading] = useState(false)
  const [androidFilesScanned, setAndroidFilesScanned] = useState(false)

  // Android navigation
  const [androidFolderIdStack, setAndroidFolderIdStack] = useState<string[]>([])
  const [androidFolderNameStack, setAndroidFolderNameStack] = useState<string[]>([
    'Internal Storage',
  ])

  // Loading & Errors
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [globalErrorBanner, setGlobalErrorBanner] = useState<string | null>(null)
  const [androidAccessError, setAndroidAccessError] = useState<string | null>(null)

  // Transfers
  const [transferState, setTransferState] = useState<TransferState>({
    isActive: false,
    totalFiles: 0,
    currentFileIndex: 0,
    currentFileName: '',
    currentFileSize: 0,
    currentFileProgress: 0,
    speed: '0 MB/s',
    direction: 'download',
  })

  const [isTransferring, setIsTransferring] = useState(false)

  // Selection
  const [selectedFiles, setSelectedFiles] = useState<{
    mac: Set<number>
    android: Set<number>
  }>({
    mac: new Set(),
    android: new Set(),
  })

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    visible: boolean
    side: 'mac' | 'android'
    index: number
  }>({
    x: 0,
    y: 0,
    visible: false,
    side: 'mac',
    index: -1,
  })

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'icons'>('icons')

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Guards / refs
  const initRef = useRef(false)
  const macFilesRef = useRef<LocalFile[]>([])
  const displayedAndroidFilesRef = useRef<MtpFile[]>([])
  const detectInFlightRef = useRef(false)
  const androidFolderFilesLoadingRef = useRef(false)
  const connectedRef = useRef(false)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    const id = Math.random().toString(36).slice(2)

    setToasts((p) => [...p, { id, message: msg, type }])

    setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id))
    }, 3200)
  }

  const handleClearSelection = () => {
    setSelectedFiles({
      mac: new Set(),
      android: new Set(),
    })
  }

  const formatStorageBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return ''

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024))
    )

    return `${(bytes / Math.pow(1024, index)).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`
  }

  const joinLocalPath = (basePath: string, name: string) => {
    if (basePath === '/') return `/${name}`
    return `${basePath.replace(/\/+$/, '')}/${name}`
  }

  const getLocalItemPath = (item: LocalFile) =>
    item.path || joinLocalPath(macFullPath, item.name)

  const getTransferSize = (item: LocalFile | MtpFile) => {
    if ('sizeBytes' in item && typeof item.sizeBytes === 'number') {
      return item.sizeBytes
    }

    return typeof item.size === 'number' ? item.size : 0
  }

  const makeMacBreadcrumb = (fullPath: string) => {
    if (fullPath === '/') return ['Macintosh HD']

    const parts = fullPath.split('/').filter(Boolean)

    if (parts[0] === 'Users' && parts.length >= 3) {
      return ['Home', ...parts.slice(2)]
    }

    return ['Macintosh HD', ...parts]
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const handleToggleTheme = () => {
    const next = !isDark

    setIsDark(next)

    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')

    showToast(`Switched to ${next ? 'Dark' : 'Light'} Mode`, 'info')
  }

  // ── Global Error Handler for Disconnect ───────────────────────────────────
  const handleMtpError = (errorMsg: string) => {
    if (/no raw devices|no mtp device|not found|disconnected/i.test(errorMsg)) {
      setConnected((prev) => {
        if (prev) {
          showToast('Device Unplugged', 'err')
        }

        return false
      })

      setAndroidFolders([])
      setAndroidAllFiles([])
      setAndroidFilesScanned(false)
      setAndroidAccessError(null)
      setGlobalErrorBanner(null)
      setError('Device disconnected.')
    }
  }

  // ── Window Controls ───────────────────────────────────────────────────────
  const handleClose = () => window.electronAPI?.closeWindow?.()
  const handleMinimize = () => window.electronAPI?.minimizeWindow?.()
  const handleMaximize = () => window.electronAPI?.maximizeWindow?.()

  // ── Android File Display ──────────────────────────────────────────────────
  const displayedAndroidFiles = React.useMemo(() => {
    const currentFolderId = androidFolderIdStack[androidFolderIdStack.length - 1]

    if (!currentFolderId) {
      if (androidFolders.length > 0) {
        const allFolderIds = new Set(androidFolders.map((f) => f.id))

        const rootFolders = androidFolders.filter((f) => {
          const pid = f.parentId ?? ''
          return !allFolderIds.has(pid)
        })

        if (rootFolders.length > 0) {
          return rootFolders
        }
      }

      if (androidAllFiles.length > 0) {
        const allIds = new Set(androidAllFiles.map((f) => f.id))

        const rootItems = androidAllFiles.filter((f) => {
          const pid = f.parentId ?? ''
          return !allIds.has(pid)
        })

        return rootItems
      }

      return []
    }

    const subFolders =
      androidFolders.length > 0
        ? androidFolders.filter((f) => f.parentId === currentFolderId)
        : androidAllFiles.filter(
            (f) => f.parentId === currentFolderId && f.isFolder
          )

    const subFiles = androidAllFiles.filter(
      (f) => f.parentId === currentFolderId && !f.isFolder
    )

    return [...subFolders, ...subFiles]
  }, [androidFolderIdStack, androidAllFiles, androidFolders])

  // Keep refs updated for keyboard shortcuts
  useEffect(() => {
    macFilesRef.current = macFiles
  }, [macFiles])

  useEffect(() => {
    displayedAndroidFilesRef.current = displayedAndroidFiles
  }, [displayedAndroidFiles])

  useEffect(() => {
    connectedRef.current = connected
  }, [connected])

  // ── Init — runs once only ─────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return

    initRef.current = true

    document.documentElement.setAttribute('data-theme', 'dark')

    handleLoadMacFiles('~/Downloads')
    handleDetectDevice()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClearSelection()
        setGlobalErrorBanner(null)
        setContextMenu((p) => ({ ...p, visible: false }))
      }

      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()

        const hoveredPanel = document.querySelector('.panel:hover')
        const side = hoveredPanel?.id === 'androidPanel' ? 'android' : 'mac'

        setSelectedFiles(() => {
          const len =
            side === 'mac'
              ? macFilesRef.current.length
              : displayedAndroidFilesRef.current.length

          const next = {
            mac: new Set<number>(),
            android: new Set<number>(),
          }

          for (let i = 0; i < len; i++) {
            next[side].add(i)
          }

          return next
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (connected) return

    const timer = setInterval(async () => {
      if (connectedRef.current || detectInFlightRef.current) return

      try {
        const res = await window.electronAPI?.detectDevice?.()

        if (res?.success && !connectedRef.current && !detectInFlightRef.current) {
          await handleDetectDevice()
        }
      } catch {
        // silent polling
      }
    }, 8000)

    return () => clearInterval(timer)
  }, [connected])

  // ── Device Detection — fast load only ─────────────────────────────────────
  const loadAndroidFolderFiles = async (parentId?: string) => {
    if (androidFolderFilesLoadingRef.current) return

    androidFolderFilesLoadingRef.current = true

    try {
      const res = await window.electronAPI?.listFolderFiles?.(parentId)

      if (res?.success) {
        const files = res.files || []

        setAndroidAllFiles((prev) => [
          ...prev.filter((file) => file.parentId !== parentId),
          ...files,
        ])

        setAndroidAccessError(null)
      } else if (res?.error) {
        handleMtpError(res.error)
        setAndroidAccessError(res.error)
      }
    } catch (err: any) {
      handleMtpError(err.message)
      setAndroidAccessError(err.message || 'Failed to read Android folder files')
    } finally {
      androidFolderFilesLoadingRef.current = false
    }
  }

  const handleDetectDevice = async () => {
      if (detectInFlightRef.current) return

      detectInFlightRef.current = true
      setLoading(true)
      setAndroidLoading(true)
      setError(null)
      setGlobalErrorBanner(null)
      setAndroidAccessError(null)

      try {
        const res = await window.electronAPI?.detectDevice?.()

        if (!res?.success) {
          connectedRef.current = false
          setConnected(false)
          setError(
            res?.error ||
              'No Android device found. Plug in your phone and select "File Transfer" mode.'
          )
          return
        }

        connectedRef.current = true
        setConnected(true)
        setDeviceName(res.deviceName || 'Android Device')
        setStoragePercentage(res.storageUsedPercentage || 0)

        const capacity = res.storageCapacity || 0
        const free = res.storageFree || 0
        const used = capacity > free ? capacity - free : 0
        const storageParts = [
          res.storageDescription,
          capacity > 0
            ? `${formatStorageBytes(used)} used of ${formatStorageBytes(capacity)}`
            : '',
          'USB MTP',
        ].filter(Boolean)

        setStorageInfo(storageParts.join(' • '))
        showToast('Device Plugged In', 'ok')

        const folderRes = await window.electronAPI?.listFolders?.()

        if (folderRes?.success && folderRes.folders) {
          const rootId = folderRes.storageRootId || ''

          setStorageRootId(rootId)
          setAndroidFolders(folderRes.folders)
          setAndroidAllFiles([])
          setAndroidFilesScanned(false)
          setAndroidAccessError(null)

          if (storageParts.length <= 1) {
            setStorageInfo(
              `${folderRes.storageName || 'Internal storage'} • ${
                folderRes.folders.length
              } folders • USB MTP`
            )
          }

          const rootIdHasChildren = Boolean(
            rootId && folderRes.folders.some((f: MtpFile) => f.parentId === rootId)
          )

          if (rootIdHasChildren) {
            setAndroidFolderIdStack([rootId])
            setAndroidFolderNameStack(['Internal Storage'])
          } else {
            setAndroidFolderIdStack([])
            setAndroidFolderNameStack([folderRes.storageName || 'Internal Storage'])
          }

          const initialFolderId = rootIdHasChildren ? rootId : undefined
          void loadAndroidFolderFiles(initialFolderId)
        } else if (folderRes?.error) {
          setError(folderRes.error)
          setAndroidAccessError(folderRes.error)
          setGlobalErrorBanner(folderRes.error)
        }

        setAndroidLoading(false)
      } catch (err: any) {
        setConnected(false)
        setError(err.message || 'MTP communication failed.')
      } finally {
        detectInFlightRef.current = false
        setLoading(false)
      }
    }

  // ── Refresh Android Folders Only ──────────────────────────────────────────
  const handleAndroidRefresh = async () => {
    setAndroidLoading(true)
    setAndroidAccessError(null)

    try {
      const folderRes = await window.electronAPI?.listFolders?.()

      if (folderRes?.success && folderRes.folders) {
        setAndroidFolders(folderRes.folders)
        setAndroidAccessError(null)
        showToast('Android folders refreshed', 'ok')

        const currentAndroidFolderId =
          androidFolderIdStack[androidFolderIdStack.length - 1]

        await loadAndroidFolderFiles(currentAndroidFolderId)
      } else if (folderRes?.error) {
        handleMtpError(folderRes.error)
        setAndroidAccessError(folderRes.error)
        setGlobalErrorBanner(folderRes.error)
        showToast(folderRes.error, 'err')
      }
    } catch (e: any) {
      handleMtpError(e.message)
      showToast(e.message || 'Android refresh failed', 'err')
    } finally {
      setAndroidLoading(false)
    }
  }

  // ── Manual Full File Scan ─────────────────────────────────────────────────
  const handleAndroidFullScan = async (silent = false) => {
    if (androidLoading) return

    setAndroidLoading(true)
    setGlobalErrorBanner(null)
    setAndroidAccessError(null)

    if (!silent) {
      showToast('Scanning Android files...', 'info')
    }

    try {
      const fileRes = await window.electronAPI?.listFiles?.()

      if (fileRes?.success && fileRes.files) {
        setAndroidAllFiles(fileRes.files)
        setAndroidFilesScanned(true)
        setAndroidAccessError(null)

        if (!silent) {
          showToast('Android file list loaded', 'ok')
        }
      } else if (fileRes?.error) {
        handleMtpError(fileRes.error)
        setAndroidAccessError(fileRes.error)
        if (!silent) {
          showToast(fileRes.error, 'err')
        }
        setGlobalErrorBanner(fileRes.error)
      }
    } catch (e: any) {
      handleMtpError(e.message)
      setAndroidAccessError(e.message || 'Failed to scan Android files')
      if (!silent) {
        showToast(e.message || 'Failed to scan Android files', 'err')
      }
      setGlobalErrorBanner(e.message || 'Failed to scan Android files')
    } finally {
      setAndroidLoading(false)
    }
  }

  // ── Mac Files ─────────────────────────────────────────────────────────────
  const handleLoadMacFiles = async (targetPath: string) => {
    try {
      const res = await window.electronAPI?.listLocalFiles?.(targetPath)

      if (res?.success && res.files && res.path) {
        const sorted = [...res.files].sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1
          if (!a.isFolder && b.isFolder) return 1
          return a.name.localeCompare(b.name)
        })

        setMacFiles(sorted)
        setMacFullPath(res.path)
        setMacPath(makeMacBreadcrumb(res.path))
      } else if (res?.error) {
        showToast(res.error, 'err')
      }
    } catch (err: any) {
      showToast(`Could not read Mac folder: ${err.message}`, 'err')
    }
  }

  // ── Mac Navigation ────────────────────────────────────────────────────────
  const handleMacNavigate = (folder: string) => {
    handleLoadMacFiles(joinLocalPath(macFullPath, folder))
    handleClearSelection()
  }

  const handleMacNavigateUp = () => {
    const parts = macFullPath.split('/')

    if (parts.length <= 2) return

    parts.pop()

    handleLoadMacFiles(parts.join('/') || '/')
    handleClearSelection()
  }

  const handleMacNewFolder = async () => {
    const name = prompt('New folder name:', 'New Folder')

    if (!name) return

    const res = await window.electronAPI?.createLocalFolder?.(macFullPath, name)

    if (res?.success) {
      showToast(`"${name}" created`, 'ok')
      handleLoadMacFiles(macFullPath)
    } else {
      showToast(res?.error || 'Failed to create folder', 'err')
    }
  }

  const handleMacDelete = async (fileName: string) => {
    if (!confirm(`Delete "${fileName}" from Mac?`)) return

    const res = await window.electronAPI?.deleteLocalFile?.(
      joinLocalPath(macFullPath, fileName)
    )

    if (res?.success) {
      showToast(`"${fileName}" deleted`, 'ok')
      handleLoadMacFiles(macFullPath)
    } else {
      showToast(res?.error || 'Failed to delete', 'err')
    }
  }

  const handleChooseMacFolder = async () => {
    const res = await window.electronAPI?.selectLocalFolder?.(macFullPath)

    if (res?.success && res.path) {
      await handleLoadMacFiles(res.path)
      handleClearSelection()
      return
    }

    if (res?.error && !/cancelled/i.test(res.error)) {
      showToast(res.error, 'err')
    }
  }

  const handleUploadFromAnywhere = async () => {
    if (!connected) {
      showToast('Connect an Android device before uploading.', 'err')
      return
    }

    const res = await window.electronAPI?.selectLocalFiles?.()

    if (res?.success && res.files?.length) {
      await handleCopyFiles('mac', res.files)
      return
    }

    if (res?.error && !/cancelled/i.test(res.error)) {
      showToast(res.error, 'err')
    }
  }

  // ── Android Navigation ────────────────────────────────────────────────────
  const handleAndroidNavigate = (folderId: string, folderName: string) => {
    setAndroidFolderIdStack((p) => [...p, folderId])
    setAndroidFolderNameStack((p) => [...p, folderName])
    void loadAndroidFolderFiles(folderId)
    handleClearSelection()
  }

  const handleAndroidNavigateUp = () => {
    if (androidFolderIdStack.length === 0) return

    const nextStack = androidFolderIdStack.slice(0, -1)

    setAndroidFolderIdStack(nextStack)
    setAndroidFolderNameStack((p) => p.slice(0, -1))
    void loadAndroidFolderFiles(nextStack[nextStack.length - 1])
    handleClearSelection()
  }

  const handleAndroidNewFolder = async () => {
    const name = prompt('New folder name:', 'New Folder')

    if (!name) return

    const currentAndroidFolderId =
      androidFolderIdStack[androidFolderIdStack.length - 1]

    const createFolder = window.electronAPI?.mtpCreateFolder as any

    const res = await createFolder?.(name, currentAndroidFolderId)

    if (res?.success) {
      showToast(`"${name}" created on Android`, 'ok')
      handleAndroidRefresh()
    } else {
      showToast(res?.error || 'Failed to create folder', 'err')
    }
  }

  const handleAndroidDelete = async (fileId: string) => {
    const file = displayedAndroidFiles.find((f) => f.id === fileId)

    if (!file || !confirm(`Delete "${file.name}" from Android?`)) return

    const res = await window.electronAPI?.mtpDelete?.(fileId)

    if (res?.success) {
      showToast(`"${file.name}" deleted`, 'ok')
      handleAndroidRefresh()
    } else {
      showToast(res?.error || 'Failed to delete', 'err')
    }
  }

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredMacFiles = searchQuery
    ? macFiles.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : macFiles

  const filteredAndroidFiles = searchQuery
    ? displayedAndroidFiles.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayedAndroidFiles

  const sortedAndroid = [...filteredAndroidFiles].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return a.name.localeCompare(b.name)
  })

  // ── Transfer Engine ───────────────────────────────────────────────────────
  async function handleCopyFiles(sourceSide: 'mac' | 'android', items: any[]) {
    if (items.length === 0) return

    setIsTransferring(true)

    setTransferState({
      isActive: true,
      totalFiles: items.length,
      currentFileIndex: 0,
      currentFileName: items[0].name,
      currentFileSize: getTransferSize(items[0]),
      currentFileProgress: 0,
      speed: 'Calculating...',
      direction: sourceSide === 'mac' ? 'upload' : 'download',
    })

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      setTransferState((p) => ({
        ...p,
        currentFileIndex: i,
        currentFileName: item.name,
        currentFileSize: getTransferSize(item),
        currentFileProgress: 0,
        speed: 'Starting...',
      }))

      let res: { success: boolean; error?: string } | undefined

      const targetLocalPath =
        sourceSide === 'mac'
          ? getLocalItemPath(item)
          : joinLocalPath(macFullPath, item.name)

      let lastBytes = 0
      let lastTime = Date.now()

      const pollTimer = setInterval(async () => {
        try {
          if (sourceSide === 'android') {
            const statRes = await window.electronAPI?.getLocalFileSize?.(
              targetLocalPath
            )

            if (statRes?.success) {
              const currentBytes = statRes.sizeBytes || 0
              const now = Date.now()
              const deltaBytes = currentBytes - lastBytes
              const deltaMs = now - lastTime

              let speedStr = 'Calculating...'

              if (deltaMs > 0 && deltaBytes >= 0) {
                const bytesPerSec = (deltaBytes / deltaMs) * 1000
                speedStr = (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s'
              }

              const total = item.size || 1

              let prog = Math.min((currentBytes / total) * 100, 99)

              if (total === 0 || total === 1) {
                prog = 50
              }

              setTransferState((p) => ({
                ...p,
                currentFileProgress: prog,
                speed: speedStr,
              }))

              lastBytes = currentBytes
              lastTime = now
            }
          } else {
            setTransferState((p) => {
              const currentProg = p.currentFileProgress
              const nextProg = Math.min(currentProg + Math.random() * 5 + 2, 95)

              return {
                ...p,
                currentFileProgress: nextProg,
                speed: '~25.0 MB/s',
              }
            })
          }
        } catch {
          // Ignore polling errors
        }
      }, 500)

      try {
        if (sourceSide === 'mac') {
          const currentAndroidFolderId =
            androidFolderIdStack[androidFolderIdStack.length - 1]

          const uploadFile = window.electronAPI?.uploadFile as any

          res = await uploadFile?.(
            getLocalItemPath(item),
            currentAndroidFolderId
          )
        } else {
          res = await window.electronAPI?.downloadFile?.(
            item.id,
            item.name,
            macFullPath
          )
        }

        clearInterval(pollTimer)

        if (res?.success) {
          setTransferState((p) => ({
            ...p,
            currentFileProgress: 100,
          }))

          setTimeout(() => {
            showToast(
              `"${item.name}" → ${
                sourceSide === 'mac' ? 'Android' : macPath[macPath.length - 1]
              }`,
              'ok'
            )
          }, 150)
        } else {
          const msg = res?.error || 'Transfer failed'

          handleMtpError(msg)
          showToast(`Failed: "${item.name}" — ${msg}`, 'err')
          setGlobalErrorBanner(`Transfer error: ${msg}`)
        }
      } catch (err: any) {
        clearInterval(pollTimer)
        handleMtpError(err.message)
        showToast(`Error: "${item.name}" — ${err.message}`, 'err')
      }
    }

    if (sourceSide === 'android') {
      handleLoadMacFiles(macFullPath)
    } else {
      await handleAndroidRefresh()
    }

    setTransferState((p) => ({
      ...p,
      isActive: false,
    }))

    setIsTransferring(false)
  }

  // ── Context Menu ──────────────────────────────────────────────────────────
  const handleRightClick = (
    e: React.MouseEvent,
    side: 'mac' | 'android',
    index: number
  ) => {
    e.preventDefault()

    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      visible: true,
      side,
      index,
    })
  }

  const handleContextAction = (action: string) => {
    setContextMenu((p) => ({ ...p, visible: false }))

    const { side, index } = contextMenu

    if (index === -1) return

    const file = side === 'mac' ? filteredMacFiles[index] : sortedAndroid[index]

    if (!file) return

    switch (action) {
      case 'open':
        if (side === 'mac') {
          if (file.isFolder) {
            handleMacNavigate(file.name)
          }
        } else {
          if (file.isFolder) {
            handleAndroidNavigate((file as MtpFile).id, file.name)
          } else {
            handleCopyFiles('android', [file])
          }
        }
        break

      case 'copy':
        handleCopyFiles(side, [file])
        break

      case 'delete':
        if (side === 'mac') {
          handleMacDelete(file.name)
        } else {
          handleAndroidDelete((file as MtpFile).id)
        }
        break

      default:
        showToast(`"${action}" coming in a future update`, 'info')
    }
  }

  const totalSelected = selectedFiles.mac.size + selectedFiles.android.size

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="app-window"
      id="appWindow"
      onClick={() => setContextMenu((p) => ({ ...p, visible: false }))}
    >
      {/* TITLEBAR */}
      <div className="titlebar" onDoubleClick={handleMaximize}>
        <div className="traffic-lights">
          <button className="tl tl-close" onClick={handleClose} title="Close" />
          <button className="tl tl-min" onClick={handleMinimize} title="Minimize" />
          <button className="tl tl-max" onClick={handleMaximize} title="Maximize" />
        </div>

        <div className="app-brand">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#ag)" />
            <path
              d="M9 22L13 12H15L11 22H9Z"
              fill="white"
              opacity="0.95"
            />
            <path
              d="M15 22Q21 22 23 17Q21 13 17 13"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.95"
            />
            <circle cx="20" cy="11" r="2" fill="white" opacity="0.7" />
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#007AFF" />
                <stop offset="1" stopColor="#5AC8FA" />
              </linearGradient>
            </defs>
          </svg>

          <span className="app-name">WiredTransfer</span>
        </div>

        <div className="toolbar-center">
          <div className="seg-control" id="viewToggle">
            <button
              className={`seg-btn${viewMode === 'list' ? ' active' : ''}`}
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <List size={13} strokeWidth={1.8} />
              List
            </button>

            <button
              className={`seg-btn${viewMode === 'icons' ? ' active' : ''}`}
              aria-label="Icon view"
              onClick={() => setViewMode('icons')}
            >
              <Grid2X2 size={13} strokeWidth={1.8} />
              Icons
            </button>
          </div>
        </div>

        <div className="toolbar-actions">
          <div className="search-field">
            <input
              type="text"
              className="search-input"
              placeholder="Search"
              id="searchInput"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <Search
              className="search-icon"
              aria-hidden="true"
              size={13}
              strokeWidth={1.7}
            />

            {searchQuery && (
              <button
                className="search-clear visible"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
              >
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>

          <button
            className="tool-btn"
            title="Scan Android Files"
            aria-label="Scan Android files"
            onClick={() => handleAndroidFullScan(false)}
            disabled={!connected || androidLoading}
          >
            <RefreshCw size={14} strokeWidth={1.7} />
          </button>
          <button
            className="tool-btn"
            title="Toggle Theme"
            aria-label="Toggle theme"
            onClick={handleToggleTheme}
            id="btnTheme"
          >
            <Sun size={14} strokeWidth={1.7} />
          </button>

        </div>
      </div>

      {/* CONTENT */}
      <div className="content">
        <div className={`error-banner${globalErrorBanner ? ' visible' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--red)">
            <circle cx="8" cy="8" r="7" />
            <path
              d="M8 4v5M8 11v1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <span>{globalErrorBanner}</span>

          <div className="banner-actions">
            <button
              className="banner-btn"
              onClick={() => {
                setGlobalErrorBanner(null)
                handleDetectDevice()
              }}
            >
              Retry
            </button>

            <button
              className="banner-btn sec"
              onClick={() => setGlobalErrorBanner(null)}
            >
              Dismiss
            </button>
          </div>
        </div>

        {connected ? (
          <SplitScreen
            macFiles={filteredMacFiles}
            macPath={macPath}
            onMacNavigate={handleMacNavigate}
            onMacNavigateUp={handleMacNavigateUp}
            onMacChooseFolder={handleChooseMacFolder}
            onMacUploadFiles={handleUploadFromAnywhere}
            onMacNewFolder={handleMacNewFolder}
            onMacDelete={handleMacDelete}
            canMacNavigateUp={macFullPath !== '/'}
            androidFiles={sortedAndroid}
            androidPath={androidFolderNameStack}
            onAndroidNavigate={handleAndroidNavigate}
            onAndroidNavigateUp={handleAndroidNavigateUp}
            onAndroidNewFolder={handleAndroidNewFolder}
            onAndroidRefresh={handleAndroidRefresh}
            onAndroidDelete={handleAndroidDelete}
            deviceName={deviceName}
            storageInfo={
                androidLoading
                ? androidFilesScanned
                  ? 'Refreshing Android file index…'
                  : 'Reading Android storage…'
                : androidFilesScanned
                ? `${storageInfo || 'USB MTP'} • File index ready`
                : storageInfo || 'Folders loaded. Click scan button to load files.'
              }
            storagePercentage={storagePercentage}
            onCopyFiles={handleCopyFiles}
            isTransferring={isTransferring}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            onRightClick={handleRightClick}
            androidAccessError={androidAccessError}
            viewMode={viewMode}
          />
        ) : (
          <ConnectionGuide
            loading={loading}
            onDetect={handleDetectDevice}
            error={error}
          />
        )}

        <TransferModal
          transferState={transferState}
          onCancelAll={() => {
            setTransferState((p) => ({
              ...p,
              isActive: false,
            }))

            setIsTransferring(false)
          }}
        />

        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          visible={contextMenu.visible}
          onAction={handleContextAction}
          isFolder={
            contextMenu.index !== -1 &&
            (contextMenu.side === 'mac'
              ? filteredMacFiles[contextMenu.index]?.isFolder
              : sortedAndroid[contextMenu.index]?.isFolder) === true
          }
        />

        <div className={`sel-info${totalSelected > 0 ? ' visible' : ''}`}>
          <span>{totalSelected}</span> selected

          <button
            onClick={handleClearSelection}
            className="sel-clear"
          >
            Clear
          </button>
        </div>

        <div className="toast-box" id="toastContainer">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              <div className="toast-ico">
                {t.type === 'ok' && (
                  <CheckCircle2 size={12} strokeWidth={1.8} />
                )}

                {t.type === 'err' && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                )}

                {t.type === 'info' && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <circle cx="6" cy="6" r="4" />
                    <path d="M6 5v3.5" />
                  </svg>
                )}
              </div>

              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
