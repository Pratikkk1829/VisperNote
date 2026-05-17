import loaderLogo from '../assets/loader-logo.png'

export default function LoadingOverlay({ visible, message = 'Loading...', compact = false }) {
  return (
    <>
      <style>{`
        @keyframes loaderFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes loaderSpin {
          from { transform: scale(1) rotate(0deg); }
          to   { transform: scale(1) rotate(360deg); }
        }
        @keyframes loaderPopIn {
          from { opacity: 0; transform: scale(0.72) rotate(-20deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes loaderBar {
          from { transform: translateX(-95%); }
          to   { transform: translateX(260%); }
        }
        .loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(7, 6, 12, 0.58);
          backdrop-filter: blur(2px);
          animation: loaderFadeIn 0.18s ease forwards;
          pointer-events: all;
        }
        .loader-panel {
          min-width: ${compact ? '164px' : '220px'};
          padding: ${compact ? '18px 20px' : '24px 28px'};
          border: 1px solid var(--vn-border);
          border-radius: 16px;
          background: rgba(18, 18, 25, 0.62);
          box-shadow: 0 24px 80px rgba(0,0,0,0.46);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .loader-logo {
          width: ${compact ? '34px' : '44px'};
          height: ${compact ? '34px' : '44px'};
          object-fit: contain;
          animation: loaderPopIn 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards,
                     loaderSpin 1.2s linear 0.3s infinite;
          filter: drop-shadow(0 0 20px color-mix(in srgb, var(--vn-accent) 52%, transparent));
        }
        .loader-copy {
          color: var(--vn-text-mid);
          font: 600 12px var(--vn-font, 'DM Sans', 'Segoe UI', sans-serif);
          letter-spacing: 0;
        }
        .loader-track {
          width: 128px;
          height: 3px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
        }
        .loader-fill {
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, transparent, var(--vn-accent), transparent);
          animation: loaderBar 1.15s ease-in-out infinite;
        }
      `}</style>

      {visible && (
        <div className="loader-overlay">
          <div className="loader-panel" role="status" aria-live="polite">
            <img src={loaderLogo} className="loader-logo" alt="" />
            <div className="loader-copy">{message}</div>
            <div className="loader-track"><div className="loader-fill" /></div>
          </div>
        </div>
      )}
    </>
  )
}
