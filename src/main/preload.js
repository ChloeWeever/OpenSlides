const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openslides', {
  sendChat: (messages, settings, genMode) => ipcRenderer.invoke('llm:chat', messages, settings, genMode),
  abortLLM: () => ipcRenderer.invoke('llm:abort'),
  genOutline: (userRequest, settings) => ipcRenderer.invoke('llm:outline', userRequest, settings),
  genSlide: (params, settings) => ipcRenderer.invoke('llm:gen-slide', params, settings),
  genSoloOutline: (text, settings) => ipcRenderer.invoke('llm:solo-outline', { text, settings }),
  genSoloSlide: (params, settings) => ipcRenderer.invoke('llm:solo-slide', { ...params, settings }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  savePresentation: (data) => ipcRenderer.invoke('presentation:save', data),
  loadPresentation: () => ipcRenderer.invoke('presentation:load'),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  saveSession: (session) => ipcRenderer.invoke('sessions:save', session),
  deleteSession: (id) => ipcRenderer.invoke('sessions:delete', id),
  exportHtml: (data) => ipcRenderer.invoke('export:html', data),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  getLogo: () => ipcRenderer.invoke('logo:get'),
  saveLogo: (logo) => ipcRenderer.invoke('logo:save', logo),
});
