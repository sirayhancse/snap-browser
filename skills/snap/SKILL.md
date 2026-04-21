---
name: snap
description: Captures a focused screenshot of a specific UI component from a running browser and uses it for visual analysis and debugging. Works with Chrome, Firefox, Safari, Arc, Brave — no browser setup needed. Use this skill IMMEDIATELY whenever the user mentions a UI element that looks broken, misaligned, or needs visual inspection — even if they don't explicitly say "screenshot". Trigger on: "/snap-browser:snap", "the submit button is wrong", "fix the UI of [element]", "take a screenshot of [element]", "show me the [component]", "the [element] is broken/misplaced", "take screenshot if needed", or any request combining a UI element with a visual problem.
argument-hint: <describe the UI element and/or issue>
---

## Overview

This skill captures focused screenshots of specific browser UI components for visual analysis. It uses a **headless browser only** — it never captures the desktop screen. Two images are always produced when an element is found:

- **Crop** (`path`) — tight clip of the component, possibly expanded to its parent container
- **Context** (`contextPath`) — viewport screenshot with a red rectangle marking the element

## Setup (one-time, per machine)

The plugin ships with a Node.js capture script. Dependencies must be installed once:

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/snap" && npm install
```

`${CLAUDE_PLUGIN_ROOT}` is an environment variable injected by Claude Code that resolves to this plugin's install directory — you never need to hard-code a path.

## Workflow

### Step 1 — Parse the request

From `$ARGUMENTS` extract:
- **Component**: the UI element (e.g., "certificate card", "submit button", "skills section")
- **Page context**: where it lives (e.g., "under education", "on settings page", "in dashboard")
- **Issue**: what's wrong (e.g., "wrong position", "broken", "cut off")

### Step 2 — Infer the page URL

Look at the codebase router files to find the exact route:
- `src/App.tsx`, `src/router.ts`, `src/routes/` — React Router / TanStack Router
- `app/**/page.tsx` — Next.js App Router
- `pages/**/*.tsx` — Next.js Pages Router
- `src/routes/**` — SvelteKit / Remix

Build the full URL: `http://localhost:<port><path>`

Check which port is running:

```bash
curl -s http://localhost:3000/ > /dev/null && echo "3000" || curl -s http://localhost:5173/ > /dev/null && echo "5173"
```

If the URL can't be inferred, omit it — the script auto-detects from the open browser or dev server.

### Step 3 — Run the capture script

Always invoke the script via `${CLAUDE_PLUGIN_ROOT}`:

```bash
# Specific element on a specific page (preferred):
node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" "<element description>" "<page url>"

# Auto-detect URL from open browser or running dev server:
node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" "<element description>"

# Full page with the element highlighted (use when the element may be below the fold):
node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" --full-page "<element description>" "<page url>"

# Full page, no specific element (use when the user says "show me the whole page"):
node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" --full-page "<page url>"
```

Parse the JSON output for `path` and `contextPath`.

**Result modes:**

| mode | meaning |
|------|---------|
| `element` | Found. `path` = tight crop, `contextPath` = viewport with red rectangle. `expanded: true` means the crop was widened to the parent container. Read **both** images. |
| `viewport` | Not found by locator. `path` = visible viewport. Identify visually, or re-run with `--full-page`. |
| `fullpage` | `--full-page` was passed. `path` = full scrollable page. If a description was also passed and the element was located, the full page includes a red rectangle around it (`boundingBox`, `expanded`, `strategy` are returned). |

### Step 4 — Read and analyze

Read **both** `path` and `contextPath` (when `mode: "element"`). Analyze:
- Close-up: what does the component look like? What's wrong visually?
- Context: where does it sit on the page? What surrounds it?
- What CSS / layout property is the root cause?

### Step 5 — Fix

Find the component file in the codebase and apply the fix. Optionally re-run the script to confirm the fix looks correct.

## How smart container expansion works

When the locator matches a small or inline node (e.g., an `<h3>Skills</h3>` heading), the script walks up the DOM to find the real component boundary:

- Stops at semantic HTML: `<section>`, `<article>`, `<aside>`, `<form>`, `<dialog>`
- Stops at ARIA container roles: `region`, `group`, `tabpanel`, `article`
- Stops at elements with class/ID matching component keywords: `card`, `panel`, `skill`, `certificate`, `timeline`, `experience`, `portfolio`…
- Stops when an ancestor grows > 3× taller (jumped past the component)
- Atomic elements (`button`, `input`, `img`, `a`) are never expanded

## Example invocations

**`/snap-browser:snap the submit button is in the wrong place`**
→ element: "submit button" → find route → `node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" "submit button" "http://localhost:3000/checkout"`
→ tight button crop + red rectangle context → identify CSS issue → fix

**`/snap-browser:snap the certificate card under education looks broken`**
→ element: "certificate card", page: education route
→ check router → `node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" "certificate card" "http://localhost:3000/education/certificates"`
→ crop expands from card title to full card → find broken style → fix

**`/snap-browser:snap show me the login form`**
→ `node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" "login form" "http://localhost:3000/login"` → full form captured

**`/snap-browser:snap take a full screenshot of the dashboard`**
→ `node "${CLAUDE_PLUGIN_ROOT}/skills/snap/scripts/snap.js" --full-page "http://localhost:3000/dashboard"` → full scrollable page

## Tips

- **Auth-gated pages**: headless browser has no session — the page may redirect to login. Use the public URL or note the limitation.
- **Dynamic content** (accordions, tabs): if the element is hidden by JS, the locator won't find it — the viewport fallback will capture what's visible.
- **Wrong element**: add more specificity, e.g. `"submit button in checkout form"` instead of `"submit button"`.
- **Linux**: no browser URL auto-detection — always pass the URL explicitly.
