import React from 'react'

interface ContextMenuProps {
  x: number
  y: number
  visible: boolean
  onAction: (action: string) => void
  isFolder: boolean
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  visible,
  onAction,
  isFolder
}) => {
  if (!visible) return null

  return (
    <div
      className="ctx-menu visible"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        position: 'absolute'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ctx-item" onClick={() => onAction('open')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="12" height="12" rx="2"/>
          <path d="M6 5l4 3-4 3"/>
        </svg>
        <span>Open</span>
        <span className="ctx-shortcut">&#9166;</span>
      </div>
      <div className="ctx-item" onClick={() => onAction('quicklook')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M2 8s3-5 6-5 6 5 6 5-3 5-6 5-6-5-6-5z"/>
          <circle cx="8" cy="8" r="2"/>
        </svg>
        <span>Quick Look</span>
        <span className="ctx-shortcut">Space</span>
      </div>
      <div className="ctx-sep"></div>
      <div className="ctx-item" onClick={() => onAction('copy')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="5" y="5" width="8" height="8" rx="1.5"/>
          <path d="M3 11V4.5A1.5 1.5 0 014.5 3H11"/>
        </svg>
        <span>Copy to...</span>
        <span className="ctx-shortcut">&#8984;C</span>
      </div>
      <div className="ctx-item" onClick={() => onAction('duplicate')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="6" y="6" width="7" height="7" rx="1"/>
        </svg>
        <span>Duplicate</span>
        <span className="ctx-shortcut">&#8984;D</span>
      </div>
      <div className="ctx-item" onClick={() => onAction('rename')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M12 2l2 2-10 10H2v-2L12 2z"/>
        </svg>
        <span>Rename</span>
        <span className="ctx-shortcut">&#8997;R</span>
      </div>
      <div className="ctx-sep"></div>
      <div className="ctx-item" onClick={() => onAction('tags')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M2 9V2h7l5 5-7 7-5-5z"/>
          <circle cx="5" cy="5" r="1"/>
        </svg>
        <span>Tags...</span>
      </div>
      <div className="ctx-item" onClick={() => onAction('info')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <circle cx="8" cy="8" r="7"/>
          <path d="M8 5v0M8 7v4"/>
        </svg>
        <span>Get Info</span>
        <span className="ctx-shortcut">&#8984;I</span>
      </div>
      <div className="ctx-sep"></div>
      <div className="ctx-item danger" onClick={() => onAction('delete')}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M2 4h12M4 4v10a1 1 0 001 1h6a1 1 0 001-1V4M6 4V2a1 1 0 011-1h2a1 1 0 011 1v2"/>
        </svg>
        <span>Move to Trash</span>
        <span className="ctx-shortcut">&#8984;&#9003;</span>
      </div>
    </div>
  )
}
