<p align="right">
  <a href="README.zh.md">中文</a> | English
</p>

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

## Live demos

> generated with **claude-sonnet-4-6** in OpenSlides

- [Introduce OpenSlides — Solo mode](https://chloeweever.github.io/OpenSlides/example/Introduce-OpenSlides.html)
- [Introduce GitHub — Solo mode](https://chloeweever.github.io/OpenSlides/example/Introduce-Github.html)
- [History of AI — Template mode](https://chloeweever.github.io/OpenSlides/example/History-of-AI.html)

## Features

![](example/1.png)

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

## Download

Pre-built installers for Windows and macOS are available on the [Releases page](https://github.com/ChloeWeever/OpenSlides/releases).

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

## CLI

OpenSlides also ships a headless command-line version with the same generation pipeline as the desktop app. It reads an LLM provider config from `~/.openslides/config.yaml` and writes the same self-contained HTML deck that the desktop app's "Export HTML" button produces.

### Install

```bash
npm install
npm link        # exposes the `openslides` command globally
# or run without linking:
node src/cli/index.js --help
```

### Configure

Create `~/.openslides/config.yaml`:

```yaml
provider: openai          # openai | anthropic | litellm
apiKey: sk-...
baseUrl: https://api.openai.com   # optional; falls back to provider default
model: gpt-4o
# Optional brand-logo overlay (mirrors the desktop app)
logo:
  enabled: true
  path: ./logo.png        # relative to the config file, or use dataUrl directly
  position: bottom-right  # top-left | top-right | bottom-left | bottom-right
  width: 80
  opacity: 1
```

Run `openslides config` to print the resolved settings (the API key is masked).

### Build a deck

```bash
# From an inline prompt (solo mode is the default)
openslides build -m "generate an introduction ppt about OpenSlides"

# From a prompt file
openslides build -f ./prompt.md

# With a workspace folder (images + text are read and fed to the agent)
openslides build -m "summarize the readme" -w ./workspace

# Template mode + custom output path
openslides build -m "history of AI" --mode template -o ./decks/ai.html

# Skip the title-generation LLM call
openslides build -m "..." --title "My Deck"
```

Hit `Ctrl-C` at any point to abort.

### Edit a deck

`edit` re-parses a previously generated deck, asks the model to apply the edit, and rewrites the HTML in place (or to `-o`). Each slide is round-tripped through its full HTML so both solo and template decks are editable.

```bash
# Tweak in place
openslides edit ./decks/ai.html -m "add a presenter slide for Chloe at the end"

# From a file, writing to a new path
openslides edit ./decks/ai.html -f ./edit-instructions.md -o ./decks/ai.v2.html
```

### Notes / limits

- The CLI uses the same modules as the desktop app (`src/core/export-html.js`, `src/core/orchestrate.js`, `src/main/agent-client.js`, `src/main/llm-client.js`), so output is byte-identical to the desktop "Export HTML" path.
- Workspace files mirror the desktop upload: top-level images (`png/jpg/jpeg/gif/webp/svg`) and text (`txt/md/csv/json`). Images are OCR'd via Tesseract and inlined as base64 data URLs.
- `edit` treats every slide as a full HTML document for round-tripping. Template-mode decks stay valid, but new slides added via `add_slides` will be solo-style.

## License

GPL-3.0 © [Chloe Weever](https://github.com/ChloeWeever) — see [LICENSE](LICENSE) for details.
