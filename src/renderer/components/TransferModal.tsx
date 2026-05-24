import React from 'react'

export interface TransferState {
  isActive: boolean;
  totalFiles: number;
  currentFileIndex: number;
  currentFileName: string;
  currentFileSize: number;
  currentFileProgress: number;
  speed: string; // e.g. "25 MB/s"
  direction: 'upload' | 'download';
}

interface TransferModalProps {
  transferState: TransferState;
  onCancelAll: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ transferState, onCancelAll }) => {
  if (!transferState.isActive) return null

  const overallProgress = (transferState.currentFileIndex / transferState.totalFiles) * 100

  return (
    <div className="transfer-modal-overlay">
      <div className="transfer-modal">
        <div className="transfer-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {transferState.direction === 'download' ? (
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            ) : (
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            )}
          </svg>
          <h3>Transferring Files</h3>
        </div>

        <div className="transfer-modal-body">
          <div className="transfer-overall">
            <div className="transfer-row">
              <span className="transfer-label">Overall Progress</span>
              <span className="transfer-value">
                File {Math.min(transferState.currentFileIndex + 1, transferState.totalFiles)} of {transferState.totalFiles}
              </span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }}></div>
            </div>
          </div>

          <div className="transfer-current">
            <div className="transfer-row">
              <span className="transfer-label file-name" title={transferState.currentFileName}>
                {transferState.currentFileName}
              </span>
              <span className="transfer-value speed">{transferState.speed}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill active-glow" style={{ width: `${Math.max(2, transferState.currentFileProgress)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="transfer-modal-footer">
          <button className="cancel-btn" onClick={onCancelAll}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
