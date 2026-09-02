# HexMate

Offline-first board generator and physical tabletop game companion. Original procedural visuals; no official artwork is included.

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm test
npm run build
```

## GitHub Pages

Create a GitHub repository, push this project to the `main` branch, then choose **Settings → Pages → Source: GitHub Actions**. The included workflow tests, builds and publishes automatically. Vite uses relative production asset paths and the app uses internal state navigation, so repository subpaths work correctly.

## Offline installation

After the first successful production load, the service worker caches the app shell and bundled assets. On iPhone, open in Safari, tap **Share → Add to Home Screen**. On Android, use the browser's **Install app** command.

## Data

Settings, active games, saved boards and summaries use versioned local storage. Nothing is sent to a server.

HexMate is an unofficial tabletop companion and is not affiliated with or endorsed by CATAN GmbH or its publishers.
