# Casabanka

A personal home inventory app. Log where you store things across multiple homes using AI-assisted item logging and video-based room setup.

---

## Running locally (Mac)

**Start the server:**
```bash
cd ~/casabanka && python3 -m http.server 8080
```

**Open in browser:**
```
http://localhost:8080
```

**Stop the server:** `Ctrl + C`

**If port 8080 is already in use:**
```bash
lsof -ti :8080 | xargs kill -9
```

---

## Mobile testing with ngrok (no Netlify deploy needed)

ngrok gives your local server a public HTTPS URL that works on any device, including your phone. Google OAuth requires HTTPS, so this is necessary for testing Drive sync on mobile.

### One-time setup

**1. Install ngrok:**
```bash
brew install ngrok
```

If you don't have Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**2. Sign up for a free ngrok account** at ngrok.com and get your authtoken.

**3. Connect your authtoken (once only):**
```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Every time you test on mobile

**Step 1 — Start the local server** (in one Terminal window):
```bash
cd ~/casabanka && python3 -m http.server 8080
```

**Step 2 — Start ngrok** (in a second Terminal window):
```bash
ngrok http 8080
```

ngrok prints a URL like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8080
```

**Step 3 — Add the ngrok URL to Google Cloud Console:**

1. Go to console.cloud.google.com → APIs & Services → Credentials
2. Click your Casabanka OAuth client
3. Under Authorised JavaScript origins, add the ngrok URL e.g.:
   ```
   https://abc123.ngrok-free.app
   ```
4. Save and wait ~1 minute

**Step 4 — Open on your phone:**
```
https://abc123.ngrok-free.app
```

### Important notes

- The free ngrok URL **changes every time** you restart ngrok. You must update Google Cloud Console each time.
- To avoid this, upgrade to a paid ngrok plan (~$8/month) for a fixed subdomain, or just deploy to Netlify when you want stable mobile access.
- Both Terminal windows (server + ngrok) must stay open while testing.
- ngrok also gives you a local inspector at `http://localhost:4040` to see all requests.

---

## Deploying to Netlify

**First deploy:**
1. Go to app.netlify.com → drag the `casabanka` folder onto the drop zone
2. Set site name to `casabanka` → URL becomes `https://casabanka.netlify.app`
3. Add `https://casabanka.netlify.app` to Google Cloud Console → Authorised JavaScript origins

**Updating:**
1. Go to app.netlify.com → your Casabanka site → Deploys tab
2. Drag the `casabanka` folder onto the deploy drop zone

---

## Project structure

```
casabanka/
├── index.html          # App shell, loads all scripts
├── styles.css          # Mobile-first UI styles
├── js/
│   ├── app.js          # All screens, navigation, business logic
│   ├── db.js           # IndexedDB storage (homes, layouts, items)
│   ├── ai.js           # Claude API calls (layout analysis, item parsing, search)
│   ├── video.js        # Video frame extraction (ffmpeg.wasm + canvas fallback)
│   └── gdrive.js       # Google Drive sync
├── start.sh            # Shortcut to start local server
└── README.md           # This file
```

## Updating the version string

Every deploy should have a bumped version so you can confirm the latest code is live. Edit the first line of `js/app.js`:

```javascript
const VERSION = 'v1.2 · 2026-05-12 14:45';
```

The version is displayed at the bottom of the home selector screen.

---

## Data storage

All data is stored in **IndexedDB** in your browser under the database name `CasabankaDB`. It persists across server restarts but is tied to the browser and origin (`http://localhost:8080` or `https://casabanka.netlify.app`).

Google Drive sync saves everything to a hidden file called `casabanka-data.json` in your Google Drive app data folder.
