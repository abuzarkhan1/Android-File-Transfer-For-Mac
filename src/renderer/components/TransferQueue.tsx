import React from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, AlertCircle, Clock, Loader2, X } from 'lucide-react'

export interface TransferItem {
  id: string
  fileName: string
  direction: 'download' | 'upload'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  size?: string
  timestamp: string
  error?: string
}

interface TransferQueueProps {
  items: TransferItem[]
  onClear: () => void
}

export const TransferQueue: React.FC<TransferQueueProps> = ({ items, onClear }) => {
  const getStatusIcon = (status: TransferItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
      case 'failed':
        return <AlertCircle size={16} style={{ color: 'var(--error)' }} />
      case 'processing':
        return <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      default:
        return <Clock size={16} style={{ color: 'var(--text-muted)' }} />
    }
  }

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '320px',
        borderLeft: '1px solid var(--panel-border)',
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: 'none',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '70px',
          flexShrink: 0
        }}
      >
        <div>
          <h3 className="text-display" style={{ fontSize: '0.95rem' }}>Transfer Center</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MTP Transaction Logs</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Clear Log
          </button>
        )}
      </div>

      {/* List */}
      <div
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '8px',
              textAlign: 'center',
              padding: '20px'
            }}
          >
            <Clock size={24} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>No Active Transactions</span>
            <p style={{ fontSize: '0.65rem', maxWidth: '160px', opacity: 0.7 }}>
              Upload or download files to see real-time transfer tracking.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: item.direction === 'download' ? 'rgba(0, 242, 254, 0.04)' : 'rgba(155, 81, 224, 0.04)',
                  border: `1px solid ${item.direction === 'download' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(155, 81, 224, 0.1)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.direction === 'download' ? '#00f2fe' : '#9b51e0',
                  marginTop: '2px',
                  flexShrink: 0
                }}
              >
                {item.direction === 'download' ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
              </div>

              <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <h4
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#fff',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      marginRight: '12px'
                    }}
                  >
                    {item.fileName}
                  </h4>
                  <div style={{ flexShrink: 0 }}>{getStatusIcon(item.status)}</div>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {item.direction === 'download' ? 'Android → Mac' : 'Mac → Android'}
                </p>
                {item.error && (
                  <p
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--error)',
                      marginTop: '6px',
                      background: 'rgba(239, 68, 68, 0.04)',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(239, 68, 68, 0.08)'
                    }}
                  >
                    {item.error}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
