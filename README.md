# snap-browser

A [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin that captures focused screenshots of specific UI components from a running browser — with a red rectangle marking the exact element — and uses them for visual analysis and debugging.

```
/snap-browser:snap the submit button is in the wrong place
/snap-browser:snap the certificate card under education looks broken
/snap-browser:snap show me the skills section
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
- **Claude Code CLI** — [install guide](https://docs.claude.com/en/docs/claude-code)

---

## Installation

This plugin is distributed as a [Claude Code marketplace](https://docs.claude.com/en/docs/claude-code/plugins). You install it using the official `/plugin` command — never by editing config files by hand.

Claude Code supports three install scopes:

| Scope | Where it writes | When to use |
|---|---|---|
| **user** *(default)* | `~/.claude/settings.json` | You, on your machine, across every project |
| **project** | `<project>/.claude/settings.json` | Shared with your team via git commit |
| **local** | `<project>/.claude/settings.local.json` | Just for you in one project, gitignored |

### Step 1 — Add the GitHub repo as a marketplace (one-time, per machine)

Claude Code can treat any public GitHub repo that contains a `.claude-plugin/marketplace.json` as a plugin marketplace. This repo does — so you can point Claude Code straight at GitHub, no cloning required.

Inside Claude Code, use **any** of these three forms:

```
# A. GitHub owner/repo shorthand (recommended)
/plugin marketplace add sirayhancse/snap-browser

# B. Full HTTPS URL to the repo
/plugin marketplace add https://github.com/sirayhancse/snap-browser

# C. Full git URL (works for private repos you have SSH access to)
/plugin marketplace add git@github.com:sirayhancse/snap-browser.git
```

CLI equivalent (any of the above also works as a flag to `claude plugin marketplace add`):

```bash
claude plugin marketplace add sirayhancse/snap-browser
# or
claude plugin marketplace add https://github.com/sirayhancse/snap-browser
```

Claude Code fetches and caches the repo locally, reads `.claude-plugin/marketplace.json`, and registers `snap-browser` as an available marketplace. It does **not** enable the plugin yet — that happens in Step 2.

> **Pinning a version.** To lock to a specific release or commit, append `@<ref>`:
> `/plugin marketplace add sirayhancse/snap-browser@v1.0.0`
> (works with tags, branches, or full commit SHAs)

> **Updating later.** Run `/plugin marketplace update snap-browser` to pull the latest version.

### Step 2 — Install the plugin

#### Option A: User-level (recommended) — available in every project

```
/plugin install snap-browser@snap-browser
```

Or CLI:

```bash
claude plugin install snap-browser@snap-browser
```

#### Option B: Project-level — shared with your team

From inside the project root:

```
/plugin install snap-browser@snap-browser --scope project
```

Or CLI:

```bash
claude plugin install snap-browser@snap-browser --scope project
```

This writes to `.claude/settings.json` in your repo. Commit that file so teammates get the plugin when they pull.

#### Option C: Local-only — just you, one project

```
/plugin install snap-browser@snap-browser --scope local
```

Writes to `.claude/settings.local.json` (already gitignored by Claude Code).

> **Syntax note:** `snap-browser@snap-browser` is `<plugin-name>@<marketplace-name>`. Both happen to be `snap-browser` because this repo hosts a single-plugin marketplace of the same name.

### Step 3 — Install the script's dependencies

The plugin ships a small Node.js capture script. Run this once after install:

```bash
# Claude Code will tell you the exact plugin path when you run /plugin list,
# or you can ask Claude to run this for you:
cd "$(claude plugin path snap-browser)/skills/snap" && npm install
```

Or simply invoke the skill once — Claude will prompt you to run `npm install` when the script first fails.

### Step 4 — Verify

In Claude Code:

```
/plugin list
```

You should see `snap-browser` listed as enabled. Try it:

```
/snap-browser:snap show me the header
```

### Browsing / interactive install

You can also run `/plugin` (no arguments) to open the interactive plugin browser. Press **Tab** to cycle between the **Discover**, **Installed**, **Marketplaces**, and **Errors** tabs.

---

## Manual install from GitHub (offline / hack-on-it)

Prefer this if you want to clone the repo yourself — to read the source, modify it, or use it without Claude Code fetching from GitHub on its own.

### Step 1 — Clone the repo

Pick any location on disk. A few common choices:

```bash
# Option A: user-level location (available across every project)
git clone https://github.com/sirayhancse/snap-browser.git ~/.claude/plugins/snap-browser

# Option B: inside a specific project (so the plugin travels with the repo)
cd /path/to/your-project
git clone https://github.com/sirayhancse/snap-browser.git .claude/plugins/snap-browser
```

The path doesn't matter — Claude Code only needs an absolute path in the next step.

### Step 2 — Install the script's dependencies

```bash
cd <clone-path>/skills/snap && npm install
```

### Step 3 — Register the clone as a local marketplace

`/plugin marketplace add` accepts a **local directory** (not just a GitHub URL) as long as the directory contains `.claude-plugin/marketplace.json` — which this repo does.

Inside Claude Code:

```
/plugin marketplace add <absolute-path-to-clone>
```

Example:

```
/plugin marketplace add /Users/you/.claude/plugins/snap-browser
```

Or CLI:

```bash
claude plugin marketplace add ~/.claude/plugins/snap-browser
```

### Step 4 — Install the plugin

Same as the marketplace flow — pick a scope:

```
/plugin install snap-browser@snap-browser                  # user (default)
/plugin install snap-browser@snap-browser --scope project  # shared with team
/plugin install snap-browser@snap-browser --scope local    # just you, one project
```

### Step 5 — Verify

```
/plugin list
```

You should see `snap-browser` listed. Try it:

```
/snap-browser:snap show me the header
```

### Updating a manually-cloned install

```bash
cd <clone-path>
git pull
cd skills/snap && npm install   # only if dependencies changed
```

Then `/plugin reload` inside Claude Code. No need to re-register the marketplace.

---

## Usage

### Slash command (inside Claude Code)

```
/snap-browser:snap <describe the element and/or the issue>
```

The format is `/<plugin-name>:<skill-name>` — every plugin-provided skill is namespaced.

Examples:

```
/snap-browser:snap the submit button is in the wrong place
/snap-browser:snap the certificate card under education looks broken
/snap-browser:snap show me the skills section
/snap-browser:snap the name input field has bad styling
/snap-browser:snap take a full screenshot of the dashboard
/snap-browser:snap the navigation bar is overlapping the content
```

Claude will:
- Find your running dev server or read the open browser URL automatically
- Infer the page path from context (by checking your router config)
- Capture the component with smart container expansion
- Show you both the tight crop and the red-rectangle context shot
- Diagnose the visual issue and suggest or apply a fix

> **Tip:** Because the skill's `description` is rich, Claude will often auto-invoke it when you describe a UI problem in plain English — you don't always need to type the slash prefix.

### Direct script usage (outside Claude Code)

You can also call the script directly from any terminal:

```bash
# Auto-detect URL from open browser or running dev server
node /path/to/snap-browser/skills/snap/scripts/snap.js "submit button"

# Specific element on a specific page
node /path/to/snap-browser/skills/snap/scripts/snap.js "submit button" "http://localhost:3000/checkout"

# Full page with the element highlighted (element may be below the fold)
node /path/to/snap-browser/skills/snap/scripts/snap.js --full-page "submit button" "http://localhost:3000/checkout"

# Full page, no specific element
node /path/to/snap-browser/skills/snap/scripts/snap.js --full-page "http://localhost:3000/dashboard"
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
cd "$(claude plugin path snap-browser)/skills/snap" && npx playwright install chromium
```

---

## Project structure

```
snap-browser/
├── .claude-plugin/
│   ├── plugin.json          ← Plugin manifest
│   └── marketplace.json     ← Marketplace manifest (lets this repo be added via /plugin marketplace add)
├── skills/
│   └── snap/
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

**`/snap-browser:snap` is not recognized**
Run `/plugin list` to confirm the plugin is installed and enabled. If not, re-run Step 2 of the installation. If it is listed but not firing, run `/plugin reload` (or restart Claude Code).

**"No page URL found"**
Open your app in Chrome/Brave/Edge/Arc/Safari, or start your dev server, or pass the URL directly.

**"Could not launch headless browser"**
Install Google Chrome or Chromium, or run `npx playwright install chromium` inside `skills/snap/`.

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

## License

MIT — see [LICENSE](LICENSE).
