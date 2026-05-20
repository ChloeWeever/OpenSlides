<p align="center">
  <img src="src/assets/icon.png" width="96" alt="OpenSlides logo"/>
</p>

<h1 align="center">OpenSlides</h1>

<p align="center">
  An AI-powered presentation editor built with Electron.<br/>
  Describe what you want and the AI generates beautiful slides — or edit them manually with the built-in slide editor.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="GPL-3.0 License"/></a>
  <img src="https://img.shields.io/badge/electron-29-47848F?logo=electron" alt="Electron 29"/>
  <img src="https://img.shields.io/badge/react-18-61DAFB?logo=react" alt="React 18"/>
</p>

## Features

![](example/1.png)

**Live demos** (generated with **claude-sonnet-4-6**):
- [Introduce OpenSlides — Solo mode · SAP design style](https://chloeweever.github.io/OpenSlides/example/Introduce-OpenSlides.html)
- [History of AI — Template mode](https://chloeweever.github.io/OpenSlides/example/History-of-AI.html)

- **AI generation** — describe your presentation in natural language; the AI generates a full deck slide by slide
- **Two generation modes**
  - **Template mode** — AI fills structured layouts (title, content, two-column, quote, etc.) with elements like headings, bullets, stats, cards, and diagrams
  - **Solo mode** — AI designs each slide as free-form HTML/CSS for maximum visual creativity
- **Live preview** — slides render in real time inside an iframe sandbox
- **Slide editor** — manually edit layout, background, and individual elements
- **Color themes** — switch between built-in color palettes per slide
- **Transitions** — slide, fade, zoom, or none per slide
- **Brand logo** — overlay a logo on every template slide with configurable position, size, and opacity
- **Image insertion** — pick local images and insert them into any slide
- **Session management** — multiple presentations saved locally, auto-restored on relaunch
- **HTML export** — self-contained single-file export that runs in any browser
- **Dark / light mode** and **EN / ZH** language toggle

## Supported LLM Providers

- OpenAI (GPT-4o, GPT-4 Turbo, etc.)
- Anthropic (Claude 3.5 Sonnet, etc.)
- Any OpenAI-compatible endpoint (Azure, Groq, local Ollama, etc.)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)

### Install & Run

```bash
git clone https://github.com/ChloeWeever/OpenSlides.git
cd OpenSlides
npm install
npm start
```

### Configure AI

1. Click **⚙ Settings** in the top bar
2. Choose your provider (OpenAI / Anthropic / Custom)
3. Enter your API key and model name
4. Click **Save Settings**

## Project Structure

```
src/
├── main/
│   ├── main.js              # Electron main process entry
│   ├── ipc-handlers.js      # IPC handlers (LLM calls, export, sessions)
│   ├── preload.js            # Context bridge (renderer ↔ main)
│   ├── llm-client.js         # LLM API client
│   ├── agent-client.js       # LangGraph-style slide generation agent
│   └── store.js              # electron-store wrapper
└── renderer/
    ├── index.html            # App shell
    ├── css/app.css           # Theme variables and utility classes
    ├── js/
    │   ├── i18n.js           # EN/ZH translations
    │   ├── app.js            # Root React component
    │   ├── slide-manager.js  # Slide state (undo/redo, reorder, actions)
    │   ├── chat-panel.js     # AI chat + generation flow
    │   ├── preview-panel.js  # Slide preview toolbar
    │   ├── session-sidebar.js
    │   ├── settings-modal.js
    │   ├── export-modal.js
    │   ├── brand-logo-modal.js
    │   └── slide-editor.js   # Manual element editor
    └── slide-frame/
        └── slide-frame.js    # Sandboxed slide renderer (runs inside iframe)
```

## Building

```bash
# Windows (NSIS installer + portable exe)
npm run make:win

# macOS (dmg + zip, x64 & arm64)
npm run make:mac

# Current platform
npm run make
```

Packaged output appears in `dist/`.

## License

GPL-3.0 © [Chloe Weever](https://github.com/ChloeWeever) — see [LICENSE](LICENSE) for details.
