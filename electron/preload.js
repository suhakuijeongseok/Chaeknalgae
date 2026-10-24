const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chaeknalgae', {
  platform: process.platform,
  saveWallpaper: (dataUrl) => ipcRenderer.invoke('wallpaper:save', dataUrl),
  applyWallpaper: (dataUrl) => ipcRenderer.invoke('wallpaper:apply', dataUrl),
  searchBooks: (query, provider) => ipcRenderer.invoke('books:search', { query, provider }),
  recommendBooks: (isbns, type) => ipcRenderer.invoke('books:recommend', { isbns, type })
});
