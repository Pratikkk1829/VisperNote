import { s } from '../styles/theme'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

const winControl = (action) => { if (ipcRenderer) ipcRenderer.send(`window-${action}`) }

export default function Titlebar() {
  return (
    <div style={s.titlebar}>
      <span style={s.titlebarName}>VisperNote</span>
      <div style={s.winControls}>
        <div style={{ ...s.winBtn, background: '#ffbd2e' }} onClick={() => winControl('minimize')} />
        <div style={{ ...s.winBtn, background: '#28c840' }} onClick={() => winControl('maximize')} />
        <div style={{ ...s.winBtn, background: '#ff5f57' }} onClick={() => winControl('close')} />
      </div>
    </div>
  )
}
