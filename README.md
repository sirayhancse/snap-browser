# snap-browser

A Claude Code skill that captures focused screenshots of specific UI components from a running browser — with a red rectangle marking the exact element — and uses them for visual analysis and debugging.

```
/snap-browser the submit button is in the wrong place
/snap-browser the certificate card under education looks broken
/snap-browser show me the skills section
```

---

## How it works

1. You describe a UI element in plain English
2. Claude finds your running dev server (or reads the URL from your open browser)
3. A headless browser navigates to the page invisibly
4. The element is located using ARIA roles, labels, and text — then **smart container expansion** walks up the DOM to find the full component (not just a text label inside it)
5. Two screenshots are produced:
   - **Tight crop** — just the component, for close-up analysis
   - **Context shot** — the full viewport with a red rectangle showing where it sits
6. Claude analyzes what it sees and fixes the issue

---

## Requirements

- **Node.js 18+** — check with `node --version`
- **Chrome, Chromium, Brave, or Edge** installed on your machine (used for headless rendering — no download required)
- **Claude Code CLI** — [install guide](https://docs.anthropic.com/en/docs/claude-code)

---

## Installation

There are two ways to install: **global** (available in every project) or **per-project**.

### Option A — Global install (recommended)

This puts the skill in your Claude config folder so it's available everywhere.

**Step 1: Clone the repo**

```bash
git clone https://github.com/your-username/snap-browser.git ~/.claude/plugins/snap-browser
```

> Or anywhere you prefer — the path you use here is what you'll register below.

**Step 2: Install dependencies**

```bash
cd ~/.claude/plugins/snap-browser/skills/snap-browser
npm install
```

**Step 3: Register the plugin**

Open `~/.claude/plugins/installed_plugins.json` in any editor and add the entry below inside the `"plugins"` object:

```json
"snap-browser@local": [
  {
    "scope": "user",
    "installPath": "/Users/YOUR_USERNAME/.claude/plugins/snap-browser",
    "version": "1.0.0",
    "installedAt": "2026-01-01T00:00:00.000Z",
    "lastUpdated": "2026-01-01T00:00:00.000Z"
  }
]
```

Replace `/Users/YOUR_USERNAME/.claude/plugins/snap-browser` with the **absolute path** where you cloned the repo.

**Step 4: Restart Claude Code**

Close and reopen Claude Code (or the IDE extension). The `/snap-browser` command is now available in every project.

---

### Option B — Per-project install

This puts the skill inside one project's `.claude` folder — useful if you want to version-control it with the project.

**Step 1: Clone into your project**

```bash
cd /path/to/your-project
git clone https://github.com/your-username/snap-browser.git .claude/snap-browser
```

**Step 2: Install dependencies**

```bash
cd .claude/snap-browser/skills/snap-browser && npm install
```

**Step 3: Register the plugin**

Add to `~/.claude/plugins/installed_plugins.json`:

```json
"snap-browser@local": [
  {
    "scope": "user",
    "installPath": "/path/to/your-project/.claude/snap-browser",
    "version": "1.0.0",
    "installedAt": "2026-01-01T00:00:00.000Z",
    "lastUpdated": "2026-01-01T00:00:00.000Z"
  }
]
```

**Step 4: Restart Claude Code**

---

### What `installed_plugins.json` looks like after adding snap-browser

```json
{
  "version": 2,
  "plugins": {
    "some-other-plugin@claude-plugins-official": [ { ... } ],
    "snap-browser@local": [
      {
        "scope": "user",
        "installPath": "/Users/yourname/.claude/plugins/snap-browser",
        "version": "1.0.0",
        "installedAt": "2026-01-01T00:00:00.000Z",
        "lastUpdated": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## Usage

### Slash command (inside Claude Code)

```
/snap-browser <describe the element and/or the issue>
```

Examples:

```
/snap-browser the submit button is in the wrong place
/snap-browser the certificate card under education looks broken
/snap-browser show me the skills section
/snap-browser the name input field has bad styling
/snap-browser take a full screenshot of the dashboard
/snap-browser the navigation bar is overlapping the content
```

Claude will:
- Find your running dev server or read the open browser URL automatically
- Infer the page path from context (by checking your router config)
- Capture the component with smart container expansion
- Show you both the tight crop and the red-rectangle context shot
- Diagnose the visual issue and suggest or apply a fix

### Direct script usage

You can also call the script directly from any terminal:

```bash
# Auto-detect URL from open browser or running dev server
node /path/to/snap-browser/skills/snap-browser/scripts/snap.js "submit button"

# Specific element on a specific page
node /path/to/snap-browser/skills/snap-browser/scripts/snap.js "submit button" "http://localhost:3000/checkout"

# Full page (use for "show me the whole page" or when element is below the fold)
node /path/to/snap-browser/skills/snap-browser/scripts/snap.js --full-page "http://localhost:3000/dashboard"
```

**Output JSON:**

```jsonc
// Element found — two images produced
{
  "success": true,
  "path": "/tmp/snap-crop-123.png",         // tight component crop
  "contextPath": "/tmp/snap-context-123.png", // viewport + red rectangle
  "mode": "element",
  "expanded": true,    // true = walked up from text node to parent component
  "strategy": "role(button)+name(\"submit\")",
  "pageUrl": "http://localhost:3000/checkout",
  "urlSource": "Google Chrome",
  "boundingBox": { "x": 120, "y": 340, "width": 200, "height": 44 }
}

// Element not found — viewport captured instead
{
  "success": true,
  "path": "/tmp/snap-viewport-123.png",
  "mode": "viewport",
  "message": "\"submit button\" not found via locators. ..."
}
```

---

## Platform support

| Feature | macOS | Linux | Windows |
|---------|:-----:|:-----:|:-------:|
| Headless capture | ✅ | ✅ | ✅ |
| Auto-detect browser URL | ✅ Chrome, Brave, Edge, Arc, Safari | ❌ | ✅ Chrome, Edge, Firefox |
| Auto-detect dev server | ✅ | ✅ | ✅ |
| Smart container expansion | ✅ | ✅ | ✅ |
| Red rectangle overlay | ✅ | ✅ | ✅ |

**Linux note:** Browser URL auto-detection is unavailable. Always pass the URL explicitly, or rely on dev server detection.

### Supported browsers for headless rendering

The script uses your system-installed Chrome/Chromium — no separate download. Supports: Google Chrome, Chromium, Brave, Microsoft Edge.

If none are installed, run:
```bash
cd /path/to/snap-browser/skills/snap-browser && npx playwright install chromium
```

---

## Project structure

```
snap-browser/
├── .claude-plugin/
│   └── plugin.json          ← Claude Code plugin metadata
├── skills/
│   └── snap-browser/
│       ├── SKILL.md          ← Skill definition & Claude workflow instructions
│       ├── package.json      ← Dependencies (playwright-core only)
│       └── scripts/
│           └── snap.js       ← Headless screenshot script (Node.js)
├── .gitignore
├── LICENSE
└── README.md
```

---

## Troubleshooting

**"No page URL found"**
Open your app in Chrome/Brave/Edge/Arc/Safari, or start your dev server, or pass the URL directly: `node /path/to/snap-browser/skills/snap-browser/scripts/snap.js "element" "http://localhost:3000/page"`

**"Could not launch headless browser"**
Install Google Chrome or Chromium, or run `npx playwright install chromium` inside the repo.

**Element not found (mode: viewport)**
The element may be hidden, inside an accordion/tab, or below the fold. Re-run with `--full-page`, or make the description match the visible label text more exactly.

**Wrong element captured**
Add more context: `"submit button in the checkout form"` instead of `"submit button"`.

**Auth-gated pages**
The headless browser has no cookies. Pass the login page URL, or test on a page that doesn't need auth.

**Linux: `env: 'which': No such file or directory`**
```bash
sudo apt install debianutils   # Debian/Ubuntu
sudo dnf install which          # Fedora/RHEL
```

---

## License

MIT — see [LICENSE](LICENSE).
