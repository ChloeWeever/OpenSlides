const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openslides', {
  sendChat: (messages, settings) => ipcRenderer.invoke('llm:chat', messages, settings),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  savePresentation: (data) => ipcRenderer.invoke('presentation:save', data),
  loadPresentation: () => ipcRenderer.invoke('presentation:load'),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  saveSession: (session) => ipcRenderer.invoke('sessions:save', session),
  deleteSession: (id) => ipcRenderer.invoke('sessions:delete', id),
  exportHtml: (data) => ipcRenderer.invoke('export:html', data),
  exportPdf: (data) => ipcRenderer.invoke('export:pdf', data),
  pickImage: () => ipcRenderer.invoke('image:pick'),
});
