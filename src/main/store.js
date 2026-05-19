let store;
let memStore = {};

try {
  const Store = require('electron-store');
  store = new Store({
    defaults: {
      apiProvider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      modelName: 'gpt-4o',
      presentation: null,
    },
  });
} catch {
  store = {
    get: (key) => memStore[key],
    set: (key, value) => { memStore[key] = value; },
  };
}

module.exports = store;
