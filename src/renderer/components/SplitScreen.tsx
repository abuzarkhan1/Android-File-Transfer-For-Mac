import React, { useRef, useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react'
import { LocalFile, MtpFile } from '../preload'
import { ICONS, getFileIcon } from './FileIcon'

// ── SVG Panel Icons ─────────────────────────────────────────────────────────

const MacPanelIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
    <rect x="1" y="1" width="16" height="11" rx="2" fill="#8E8E93" fillOpacity="0.15" stroke="#8E8E93" strokeWidth="0.8" strokeOpacity="0.3"/>
    <rect x="3" y="3" width="12" height="7" rx="0.5" fill="#007AFF" fillOpacity="0.2"/>
    <rect x="6" y="12" width="6" height="2" rx="0.5" fill="#8E8E93" fillOpacity="0.15"/>
    <rect x="4" y="14" width="10" height="1.5" rx="0.75" fill="#8E8E93" fillOpacity="0.15"/>
  </svg>
)

const AndroidPanelIcon = () => <Smartphone size={18} strokeWidth={1.7} />

const PremiumMobileIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" width="32" height="32">
    <rect x="9" y="3" width="14" height="26" rx="4.2" fill="url(#phoneShell)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7"/>
    <rect x="10.8" y="6.2" width="10.4" height="19.8" rx="2.2" fill="url(#phoneScreen)"/>
    <rect x="13.8" y="4.9" width="4.4" height="0.9" rx="0.45" fill="rgba(255,255,255,0.65)"/>
    <circle cx="16" cy="27.2" r="0.8" fill="rgba(255,255,255,0.75)"/>
    <path d="M12 12.5h8M12 16h6M12 19.5h7" stroke="white" strokeOpacity="0.55" strokeWidth="1.1" strokeLinecap="round"/>
    <defs>
      <linearGradient id="phoneShell" x1="9" y1="3" x2="24" y2="29">
        <stop stopColor="#EEF4FF"/>
        <stop offset="0.48" stopColor="#93A4BD"/>
        <stop offset="1" stopColor="#2F3D52"/>
      </linearGradient>
      <linearGradient id="phoneScreen" x1="10.8" y1="6.2" x2="22" y2="26">
        <stop stopColor="#0A84FF"/>
        <stop offset="0.55" stopColor="#5AC8FA"/>
        <stop offset="1" stopColor="#1D1D1F"/>
      </linearGradient>
    </defs>
  </svg>
)

const ArrowDownDrop = () => (
  <ArrowDownToLine size={36} strokeWidth={1.5} />
)

const ArrowUpDrop = () => (
  <ArrowUpToLine size={36} strokeWidth={1.5} />
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

function calcTotalSize(files: LocalFile[]): string {
  const bytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0)
  if (bytes === 0) return '0 KB'
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

// ── Interface ────────────────────────────────────────────────────────────────

interface SplitScreenProps {
  // Mac Local Files
  macFiles: LocalFile[]
  macPath: string[]
  onMacNavigate: (folder: string) => void
  onMacNavigateUp: () => void
  onMacChooseFolder: () => void
  onMacUploadFiles: () => void
  onMacNewFolder: () => void
  onMacDelete: (fileName: string) => void
  canMacNavigateUp: boolean

  // Android MTP Files
  androidFiles: MtpFile[]
  androidPath: string[]
  onAndroidNavigate: (folderId: string, folderName: string) => void
  onAndroidNavigateUp: () => void
  onAndroidNewFolder: () => void
  onAndroidRefresh: () => void
  onAndroidDelete: (fileId: string) => void

  // Device Card
  deviceName: string
  storageInfo: string
  storagePercentage: number

  // Transfers
  onCopyFiles: (sourceSide: 'mac' | 'android', files: any[]) => void
  isTransferring: boolean

  // Selection
  selectedFiles: { mac: Set<number>; android: Set<number> }
  setSelectedFiles: React.Dispatch<React.SetStateAction<{ mac: Set<number>; android: Set<number> }>>

  // Context Menu
  onRightClick: (e: React.MouseEvent, side: 'mac' | 'android', index: number) => void
  androidAccessError?: string | null
  viewMode: 'list' | 'icons'
}

// ── Component ────────────────────────────────────────────────────────────────

export const SplitScreen: React.FC<SplitScreenProps> = ({
  macFiles,
  macPath,
  onMacNavigate,
  onMacNavigateUp,
  onMacChooseFolder,
  onMacUploadFiles,
  onMacNewFolder,
  onMacDelete,
  canMacNavigateUp,
  androidFiles,
  androidPath,
  onAndroidNavigate,
  onAndroidNavigateUp,
  onAndroidNewFolder,
  onAndroidRefresh,
  onAndroidDelete,
  deviceName,
  storageInfo,
  storagePercentage,
  onCopyFiles,
  isTransferring,
  selectedFiles,
  setSelectedFiles,
  onRightClick,
  androidAccessError,
  viewMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dividerPercent, setDividerPercent] = useState(50)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOverlay, setDragOverlay] = useState<{ mac: boolean; android: boolean }>({ mac: false, android: false })
  const [dragSource, setDragSource] = useState<'mac' | 'android' | null>(null)

  // ── Pane Resize ────────────────────────────────────────────────────────────
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = (x / rect.width) * 100
      if (pct > 25 && pct < 75) setDividerPercent(pct)
    }
    const handleMouseUp = () => setIsResizing(false)

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // ── Selection ──────────────────────────────────────────────────────────────
  const handleItemClick = (side: 'mac' | 'android', index: number, e: React.MouseEvent) => {
    setSelectedFiles((prev) => {
      const next = { mac: new Set<number>(), android: new Set<number>() }

      if (e.shiftKey && prev[side].size > 0) {
        const last = Array.from(prev[side]).pop()!
        const start = Math.min(last, index)
        const end = Math.max(last, index)
        for (let i = start; i <= end; i++) next[side].add(i)
      } else if (e.metaKey || e.ctrlKey) {
        next[side] = new Set(prev[side])
        if (next[side].has(index)) next[side].delete(index)
        else next[side].add(index)
      } else {
        next[side].add(index)
      }

      return next
    })
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDragStart = (side: 'mac' | 'android', index: number, e: React.DragEvent) => {
    setDragSource(side)
    let indices = Array.from(selectedFiles[side])
    if (!indices.includes(index)) {
      indices = [index]
      setSelectedFiles((prev) => {
        const reset = { mac: new Set<number>(), android: new Set<number>() }
        reset[side].add(index)
        return reset
      })
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ side, indices }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (side: 'mac' | 'android', e: React.DragEvent) => {
    e.preventDefault()

    const hasExternalFiles = Array.from(e.dataTransfer.types).includes('Files')

    if (side === 'android' && hasExternalFiles) {
      setDragOverlay((prev) => ({ ...prev, android: true }))
      return
    }

    if (dragSource && dragSource !== side) {
      setDragOverlay((prev) => ({ ...prev, [side]: true }))
    }
  }

  const handleDragLeave = (side: 'mac' | 'android', e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement
    if (!target.contains(e.relatedTarget as Node)) {
      setDragOverlay((prev) => ({ ...prev, [side]: false }))
    }
  }

  const handleDrop = (side: 'mac' | 'android', e: React.DragEvent) => {
    e.preventDefault()
    setDragOverlay({ mac: false, android: false })

    if (side === 'android' && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
        .map((file) => ({
          name: file.name,
          size: file.size ? formatFileSize(file.size) : '0 B',
          sizeBytes: file.size || 0,
          type: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
          icon: '📄',
          isFolder: false,
          date: '',
          path: (file as any).path,
        }))
        .filter((file) => Boolean(file.path))

      if (files.length > 0) {
        onCopyFiles('mac', files)
      }

      setDragSource(null)
      return
    }

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const data = JSON.parse(raw) as { side: 'mac' | 'android'; indices: number[] }
      if (data.side && data.side !== side) {
        const srcList = data.side === 'mac' ? macFiles : androidFiles
        const items = data.indices.map((i) => srcList[i]).filter(Boolean)
        if (items.length > 0) onCopyFiles(data.side, items)
      }
    } catch {}
    setDragSource(null)
  }

  const handleDragEnd = () => {
    setDragSource(null)
    setDragOverlay({ mac: false, android: false })
  }

  // ── File Row Renderer ──────────────────────────────────────────────────────
  const renderMacFile = (file: LocalFile, index: number) => {
    const selected = selectedFiles.mac.has(index)
    const icon = getFileIcon(file.isFolder ? 'Folder' : file.type, file.name)

    return (
      <div
        key={`mac-${index}-${file.name}`}
        className={`file-item${selected ? ' selected' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart('mac', index, e)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleItemClick('mac', index, e)}
        onContextMenu={(e) => onRightClick(e, 'mac', index)}
        onDoubleClick={() => {
          if (file.isFolder) onMacNavigate(file.name)
        }}
      >
        <div className="fi-icon">{icon}</div>
        <div className="fi-details">
          <div className="fi-name">{file.name}</div>
          <div className="fi-meta">
            {file.date || ''}
            {(file as any).tag && <span className="fi-tag">{(file as any).tag}</span>}
          </div>
        </div>
        <div className="fi-ext">{file.isFolder ? '' : file.type}</div>
        <div className="fi-size">{file.isFolder ? '--' : (file.size || formatFileSize(file.sizeBytes || 0))}</div>
      </div>
    )
  }

  const renderAndroidFile = (file: MtpFile, index: number) => {
    const selected = selectedFiles.android.has(index)
    const icon = getFileIcon(file.isFolder ? 'Folder' : file.type, file.name)

    return (
      <div
        key={`android-${index}-${file.id}`}
        className={`file-item${selected ? ' selected' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart('android', index, e)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleItemClick('android', index, e)}
        onContextMenu={(e) => onRightClick(e, 'android', index)}
        onDoubleClick={() => {
          if (file.isFolder) onAndroidNavigate(file.id, file.name)
        }}
      >
        <div className="fi-icon">{icon}</div>
        <div className="fi-details">
          <div className="fi-name">{file.name}</div>
          <div className="fi-meta">
            {file.date || 'Today'}
            {(file as any).tag && <span className="fi-tag">{(file as any).tag}</span>}
          </div>
        </div>
        <div className="fi-ext">{file.isFolder ? '' : file.type}</div>
        <div className="fi-size">{file.isFolder ? '--' : formatFileSize(file.size)}</div>
      </div>
    )
  }

  // ── Footer helpers ─────────────────────────────────────────────────────────
  const macFooterText = macFiles.length === 0 ? '0 items' : `${macFiles.length} items · ${calcTotalSize(macFiles)} total`
  const androidFooterText = androidFiles.length === 0 ? '0 items' : `${androidFiles.length} items`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="split-screen active" ref={containerRef}>

      {/* ── LEFT PANEL: Mac ─────────────────────────────────────────────────── */}
      <div className="panel" id="macPanel" style={{ flex: `0 0 ${dividerPercent}%` }}>

        {/* Panel Header */}
        <div className="panel-header">
          <div className="panel-title-group">
            <div className="panel-icon" id="macPanelIcon"><MacPanelIcon /></div>
            <div className="panel-title">This Mac</div>
            <div className="panel-count">{macFiles.length}</div>
          </div>
          <div className="panel-actions">
            <button className="p-btn" title="Choose Mac Folder" aria-label="Choose Mac folder" onClick={onMacChooseFolder}><FolderOpen size={14} strokeWidth={1.7} /></button>
            <button className="p-btn" title="New Folder" aria-label="New Mac folder" onClick={onMacNewFolder}><Plus size={14} strokeWidth={1.7} /></button>
            <button className="p-btn" title="Go Up" aria-label="Go up on Mac" onClick={onMacNavigateUp} disabled={!canMacNavigateUp}><ArrowUp size={14} strokeWidth={1.7} /></button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="breadcrumb" id="macBreadcrumb">
          {macPath.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="bc-sep">›</span>}
              <span className={`bc-item${i === macPath.length - 1 ? ' current' : ''}`}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* File List */}
        <div
          className={`file-list view-${viewMode}`}
          id="macFileList"
          onDragOver={(e) => handleDragOver('mac', e)}
          onDragLeave={(e) => handleDragLeave('mac', e)}
          onDrop={(e) => handleDrop('mac', e)}
        >
          {macFiles.length === 0 ? (
            <div className="empty-state">
              {ICONS.emptyFolder}
              <div className="empty-title">This folder is empty</div>
              <div className="empty-desc">Drag files here from Android to copy them to this Mac</div>
            </div>
          ) : (
            macFiles.map((file, index) => renderMacFile(file, index))
          )}
        </div>

        {/* Footer */}
        <div className="panel-footer" id="macFooter">{macFooterText}</div>

        {/* Drag Overlay */}
        <div className={`drag-overlay${dragOverlay.mac ? ' visible' : ''}`} id="macDragOverlay">
          <div className="do-icon"><ArrowDownDrop /></div>
          <div className="do-text">Drop to copy to Mac</div>
        </div>
      </div>

      {/* ── DIVIDER ─────────────────────────────────────────────────────────── */}
      <div
        className={`divider${isResizing ? ' dragging' : ''}`}
        id="divider"
        onMouseDown={handleDividerMouseDown}
      />

      {/* ── RIGHT PANEL: Android ────────────────────────────────────────────── */}
      <div className="panel" id="androidPanel" style={{ flex: `0 0 ${100 - dividerPercent}%` }}>

        {/* Inline Error */}
        <div className={`inline-error${androidAccessError ? ' visible' : ''}`} id="androidError">
          <div className="ie-icon">⚠</div>
          <span>Phone storage is connected, but file access needs attention.</span>
          <div className="banner-actions">
            <button className="banner-btn" onClick={onAndroidRefresh}>Retry</button>
          </div>
        </div>

        {/* Device Card */}
        <div className="device-card" id="deviceCard">
          <div className="dc-header">
            <div className="dc-avatar" id="dcAvatar">
              <PremiumMobileIcon />
            </div>
            <div className="dc-info">
            <div className="dc-name">
                {deviceName}
                <span className="status-dot" id="statusDot" />
              </div>
              <div className="dc-meta">{storageInfo}</div>
            </div>
          </div>
          <div className="storage-row">
            {storagePercentage > 0 ? (
              <>
                <div className="storage-track">
                  <div className="storage-fill" style={{ width: `${storagePercentage}%` }} />
                </div>
                <span className="storage-label">{storagePercentage}% used</span>
              </>
            ) : (
              <div className="device-ready-pill">USB MTP ready</div>
            )}
            </div>
        </div>

        {/* Android Sub-header */}
        <div className="panel-header android-subheader">
          <div className="panel-title-group">
            <div className="panel-icon" id="androidPanelIcon"><AndroidPanelIcon /></div>
            <div className="panel-title">Internal Storage</div>
            <div className="panel-count">{androidFiles.length}</div>
          </div>
          <div className="panel-actions">
            <button className="p-btn" title="Upload Files from Mac" aria-label="Upload files from Mac" onClick={onMacUploadFiles}><Upload size={14} strokeWidth={1.7} /></button>
            <button className="p-btn" title="Refresh" aria-label="Refresh Android storage" onClick={onAndroidRefresh} id="androidRefreshBtn"><RefreshCw size={14} strokeWidth={1.7} /></button>
            <button className="p-btn" title="New Folder" aria-label="New Android folder" onClick={onAndroidNewFolder} id="androidNewFolderBtn"><Plus size={14} strokeWidth={1.7} /></button>
            <button className="p-btn" title="Go Up" aria-label="Go up on Android" onClick={onAndroidNavigateUp} disabled={androidPath.length <= 1}><ArrowUp size={14} strokeWidth={1.7} /></button>
          </div>
        </div>

        {/* Android Breadcrumbs */}
        <div className="breadcrumb" id="androidBreadcrumb">
          {androidPath.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="bc-sep">›</span>}
              <span className={`bc-item${i === androidPath.length - 1 ? ' current' : ''}`}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Android File List */}
        <div
          className={`file-list view-${viewMode}`}
          id="androidFileList"
          onDragOver={(e) => handleDragOver('android', e)}
          onDragLeave={(e) => handleDragLeave('android', e)}
          onDrop={(e) => handleDrop('android', e)}
        >
          {androidAccessError ? (
            <div className="access-state">
              <div className="access-icon"><ShieldCheck size={24} strokeWidth={1.8} /></div>
              <div className="access-title">Phone storage needs authorization</div>
              <div className="access-desc">
                Xiaomi MTP connected, but it did not provide file handles. Enable USB debugging, reconnect, tap Allow, then refresh.
              </div>
              <div className="access-detail">{androidAccessError}</div>
              <button className="access-btn" onClick={onAndroidRefresh}>Retry</button>
            </div>
          ) : androidFiles.length === 0 ? (
            <div className="empty-state">
              {ICONS.emptyFolder}
              <div className="empty-title">This folder is empty</div>
              <div className="empty-desc">Choose files from anywhere on your Mac or drag them here</div>
            </div>
          ) : (
            androidFiles.map((file, index) => renderAndroidFile(file, index))
          )}
        </div>

        {/* Android Footer */}
        <div className="panel-footer" id="androidFooter">{androidFooterText}</div>

        {/* Drop Overlay */}
        <div className={`drag-overlay${dragOverlay.android ? ' visible' : ''}`} id="androidDragOverlay">
          <div className="do-icon"><ArrowUpDrop /></div>
          <div className="do-text">Drop to copy to Android</div>
        </div>
      </div>
    </div>
  )
}
