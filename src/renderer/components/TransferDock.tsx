import React, { useState } from 'react'

export interface DockTransferItem {
  id: string
  fileName: string
  direction: 'download' | 'upload'
  progress: number
  status: 'active' | 'complete' | 'error'
  size?: string
  error?: string
}

interface TransferDockProps {
  items: DockTransferItem[]
  onCancelAll: () => void
  onDismiss: () => void
}

const ArrowDownIcon = () => (
  <svg viewBox="0 0 22 22" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" width="22" height="22">
    <path d="M11 4v12M6 12l5 5 5-5"/>
  </svg>
)

const ArrowUpIcon = () => (
  <svg viewBox="0 0 22 22" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" width="22" height="22">
    <path d="M11 18V6M6 10l5-5 5 5"/>
  </svg>
)

const ChevronDownIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="12" height="12">
    <path d="M2 4l4 4 4-4"/>
  </svg>
)

export const TransferDock: React.FC<TransferDockProps> = ({ items, onCancelAll, onDismiss }) => {
  const [expanded, setExpanded] = useState(false)

  const activeItems = items.filter((item) => item.status === 'active')
  const hasItems = items.length > 0

  if (!hasItems) return null

  const totalRemaining = items.reduce((acc, t) => {
    if (t.status !== 'active' || !t.size) return acc
    const n = parseFloat(t.size)
    if (t.size.includes('MB')) return acc + n * (100 - t.progress) / 100
    return acc
  }, 0)

  return (
    <div className="transfer-dock visible" id="transferDock">
      {/* Header */}
      <div className="dock-header" onClick={() => setExpanded(!expanded)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M8 2v12M2 8l6 6 6-6"/>
        </svg>
        <span className="dock-title">Transfers</span>
        <span className="dock-count" id="dockCount">{activeItems.length}</span>
        <span className={`dock-chevron${expanded ? ' expanded' : ''}`} id="dockChevron">
          <ChevronDownIcon />
        </span>
      </div>

      {/* Body */}
      <div className={`dock-body${expanded ? ' expanded' : ''}`} id="dockBody">
        <div className="xfer-items-container" id="transferList">
          {items.map((item) => (
            <div key={item.id} className="xfer-item">
              <div className="xfer-icon">
                {item.direction === 'download' ? <ArrowDownIcon /> : <ArrowUpIcon />}
              </div>
              <div className="xfer-info">
                <div className="xfer-name">{item.fileName}</div>
                <div className="xfer-track">
                  <div
                    className={`xfer-bar${item.status === 'complete' ? ' done' : ''}${item.status === 'error' ? ' err' : ''}`}
                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                  />
                </div>
              </div>
              <div className="xfer-status">
                {item.status === 'complete'
                  ? '✓ Done'
                  : item.status === 'error'
                  ? '✕ Failed'
                  : `${Math.round(item.progress)}%`}
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="dock-actions">
          <button className="dock-btn" onClick={onCancelAll}>Cancel All</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }} id="dockRemaining">
            {totalRemaining > 0 ? `${totalRemaining.toFixed(1)} MB remaining` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
