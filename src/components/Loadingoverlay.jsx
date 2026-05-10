import loaderLogo from '../assets/loader-logo.png'

export default function LoadingOverlay({ visible }) {
  return (
    <>
      <style>{`
        @keyframes loaderFadeIn {
          from { opacity: 0; }
          to   { opacity: 0.8; }
        }
        @keyframes loaderFadeOut {
          from { opacity: 0.8; }
          to   { opacity: 0; }
        }
        @keyframes loaderSpin {
          from { transform: scale(1) rotate(0deg); }
          to   { transform: scale(1) rotate(360deg); }
        }
        @keyframes loaderPopIn {
          from { opacity: 0; transform: scale(0.7) rotate(-30deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(7, 6, 12, 0.65);
          backdrop-filter: blur(2px);
          animation: loaderFadeIn 0.2s ease forwards;
          pointer-events: all;
        }
        .loader-overlay.hiding {
          animation: loaderFadeOut 0.25s ease forwards;
        }
        .loader-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          animation: loaderPopIn 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards,
                     loaderSpin 1.2s linear 0.3s infinite;
          filter: drop-shadow(0 0 18px rgba(255,255,255,0.18));
        }
      `}</style>

      {visible && (
        <div className="loader-overlay">
          <img src={loaderLogo} className="loader-logo" alt="Loading..." />
        </div>
      )}
    </>
  )
}