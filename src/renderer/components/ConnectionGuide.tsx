import React from 'react'
import { CheckCircle2 } from 'lucide-react'

interface ConnectionGuideProps {
  loading: boolean
  onDetect: () => void
  error: string | null
}

export const ConnectionGuide: React.FC<ConnectionGuideProps> = ({ loading, onDetect, error }) => {
  const handleDetect = async () => {
    onDetect()
  }

  return (
    <div className="connection-stage" id="connectionStage">
      {/* Hero Illustration */}
      <div className="hero-vis">
        {/* Phone */}
        <div className="hero-phone-icon">
          <svg width="40" height="72" viewBox="0 0 40 72">
            <rect x="2" y="2" width="36" height="68" rx="8" fill="#1D1D1F" stroke="#333" strokeWidth="1"/>
            <rect x="6" y="10" width="28" height="48" rx="2" fill="url(#phScr)"/>
            <circle cx="20" cy="64" r="3" fill="#333"/>
            <rect x="14" y="5" width="12" height="2" rx="1" fill="#333"/>
            <defs>
              <linearGradient id="phScr" x1="6" y1="10" x2="34" y2="58">
                <stop stopColor="#007AFF"/>
                <stop offset="1" stopColor="#5AC8FA"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {/* Mac */}
        <div className="hero-mac-icon">
          <svg width="80" height="58" viewBox="0 0 80 58">
            <rect x="2" y="2" width="76" height="48" rx="4" fill="#E8E8ED" stroke="#D1D1D6" strokeWidth="0.5"/>
            <rect x="5" y="5" width="70" height="42" rx="1" fill="url(#mcScr)"/>
            <rect x="28" y="50" width="24" height="4" rx="1" fill="#C0C0C5"/>
            <rect x="20" y="54" width="40" height="3" rx="1.5" fill="#B0B0B5"/>
            <defs>
              <linearGradient id="mcScr" x1="5" y1="5" x2="75" y2="47">
                <stop stopColor="#1D1D1F"/>
                <stop offset="1" stopColor="#2C2C2E"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {/* Bridge Line */}
        <div className="hero-bridge-line">
          <svg width="100" height="30" viewBox="0 0 100 30">
            <path d="M5 25 Q50 0 95 12"/>
          </svg>
        </div>
      </div>

      <div className="conn-title">Connect Your Android</div>
      <div className="conn-sub">
        Transfer files directly via USB. No cloud, no internet, no subscriptions — just a cable.
      </div>

      {/* Steps */}
      <div className="steps">
        <div className="step">
          <div className="step-num">1</div>
          <div className="step-text">Plug in your Android with a <strong>USB cable</strong></div>
        </div>
        <div className="step">
          <div className="step-num">2</div>
          <div className="step-text"><strong>Unlock</strong> your phone and keep it awake</div>
        </div>
        <div className="step">
          <div className="step-num">3</div>
          <div className="step-text">Select <strong>"File Transfer"</strong> on the USB prompt</div>
        </div>
      </div>

      {error && (
        <div className="connection-error">
          {error}
        </div>
      )}

      <button
        className="action-btn"
        id="detectBtn"
        onClick={handleDetect}
        disabled={loading}
        aria-label="Detect connected Android device"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Scanning...
          </>
        ) : (
          <>
            <CheckCircle2 size={14} strokeWidth={1.7} />
            Detect Device
          </>
        )}
      </button>
    </div>
  )
}
