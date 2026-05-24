import React, { useState } from 'react'
import {
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  File,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Grid,
  List,
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import { MtpFile } from '../preload'

interface FileExplorerProps {
  files: MtpFile[]
  loading: boolean
  onDownload: (fileId: string, fileName: string) => void
  onUpload: () => void
  isTransferring: boolean
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  loading,
  onDownload,
  onUpload,
  isTransferring
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [filterType, setFilterType] = useState<string>('all')

  // Helper to format file sizes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // Get matching icon for file types
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const size = 20

    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) {
      return <ImageIcon size={size} style={{ color: '#00f2fe' }} />
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'webm', '3gp'].includes(ext)) {
      return <VideoIcon size={size} style={{ color: '#c084fc' }} />
    }
    if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext)) {
      return <MusicIcon size={size} style={{ color: '#4ade80' }} />
    }
    if (['pdf', 'docx', 'doc', 'txt', 'xlsx', 'pptx', 'epub'].includes(ext)) {
      return <FileText size={size} style={{ color: '#60a5fa' }} />
    }
    return <File size={size} style={{ color: '#94a3b8' }} />
  }

  // Filters and searches the file list
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (filterType === 'all') return true
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (filterType === 'images') return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)
    if (filterType === 'videos') return ['mp4', 'mkv', 'avi', 'mov', 'webm', '3gp'].includes(ext)
    if (filterType === 'audio') return ['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext)
    if (filterType === 'docs') return ['pdf', 'docx', 'doc', 'txt', 'xlsx', 'pptx', 'epub'].includes(ext)
    return true
  })

  return (
    <div className="file-row-layout">
      {/* Search & Actions Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexGrow: 1, maxWidth: '400px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }}
          />
          <input
            type="text"
            placeholder="Search phone storage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--panel-border)',
              borderRadius: '10px',
              padding: '10px 16px 10px 36px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'var(--transition-fast)'
            }}
          />
        </div>

        {/* Categories Bar */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'images', 'videos', 'audio', 'docs'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                background: filterType === type ? 'rgba(0, 242, 254, 0.08)' : 'transparent',
                border: '1px solid',
                borderColor: filterType === type ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                borderRadius: '8px',
                padding: '6px 12px',
                color: filterType === type ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'capitalize'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Grid/List View Toggles */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--panel-border)',
              borderRadius: '10px',
              padding: '2px'
            }}
          >
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: 'none',
                padding: '6px',
                borderRadius: '8px',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--text-muted)',
                display: 'flex'
              }}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: 'none',
                padding: '6px',
                borderRadius: '8px',
                color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--text-muted)',
                display: 'flex'
              }}
            >
              <Grid size={16} />
            </button>
          </div>

          {/* Upload Trigger */}
          <button className="btn-primary" onClick={onUpload} disabled={loading || isTransferring} style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.85rem' }}>
            <ArrowUpFromLine size={16} />
            Upload File
          </button>
        </div>
      </div>

      {/* Loading Skeletal state */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px' }}>
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="pulse-skeleton"
              style={{
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            />
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            color: 'var(--text-secondary)',
            gap: '12px',
            padding: '40px'
          }}
        >
          <AlertCircle size={40} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-display" style={{ fontSize: '1rem', color: '#fff' }}>No Files Found</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {searchQuery ? 'Try adjusting your search keywords or active filters.' : 'Connected storage is currently empty.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="file-grid">
          {filteredFiles.map((file) => (
            <div key={file.id} className="file-item-card">
              <div className="file-item-icon">{getFileIcon(file.name)}</div>
              <div style={{ width: '100%' }}>
                <h4 className="file-item-name">{file.name}</h4>
                <p className="file-item-meta">
                  {formatBytes(file.size)} | {file.type}
                </p>
              </div>

              <button
                className="btn-secondary"
                disabled={isTransferring}
                onClick={() => onDownload(file.id, file.name)}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '6px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  gap: '4px'
                }}
              >
                <ArrowDownToLine size={13} />
                Download
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="file-list">
          {filteredFiles.map((file) => (
            <div key={file.id} className="file-item-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  {getFileIcon(file.name)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4
                    className="file-item-name"
                    style={{ fontSize: '0.85rem', marginBottom: '2px', textOverflow: 'ellipsis' }}
                  >
                    {file.name}
                  </h4>
                  <p className="file-item-meta" style={{ fontSize: '0.7rem' }}>
                    {formatBytes(file.size)} &bull; {file.type} &bull; File ID: {file.id}
                  </p>
                </div>
              </div>

              <button
                className="btn-secondary"
                disabled={isTransferring}
                onClick={() => onDownload(file.id, file.name)}
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', gap: '4px' }}
              >
                <ArrowDownToLine size={13} />
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
