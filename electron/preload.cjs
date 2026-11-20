const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  parseFile: (filePath) => ipcRenderer.invoke('parse-file', filePath),
  parseUrl: (url) => ipcRenderer.invoke('parse-url', url),
  parseTencentUrl: (url) => ipcRenderer.invoke('parse-tencent-url', url),
  getTencentAuthStatus: () => ipcRenderer.invoke('tencent-auth-status'),
  startTencentOAuth: (config) => ipcRenderer.invoke('tencent-oauth-start', config),
  logoutTencent: () => ipcRenderer.invoke('tencent-logout'),
  onTencentAuthResult: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('tencent-auth-result', handler)
    return () => ipcRenderer.removeListener('tencent-auth-result', handler)
  },
  minimize: () => ipcRenderer.send('window-minimize'),
  hide: () => ipcRenderer.send('window-hide'),
  show: () => ipcRenderer.send('window-show'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
