# Ainola HSL – static site

A static port of the Flask app in the repository root. It fetches HSL
departure times directly from the Digitransit GraphQL API from the browser,
so no backend is needed.

## Files

- `index.html` – page structure
- `style.css` – styling (ported from the inline styles of the old template)
- `script.js` – all logic: GraphQL queries, sorting, clock and countdowns

## Run locally

Any static file server works, e.g.:

```sh
python3 -m http.server 8000 --directory .
```

Then open http://localhost:8000

## Deploy to GitHub Pages

1. Push this folder's contents to a branch/repo (e.g. root of `main`, or the
   `/docs` folder, or a `gh-pages` branch).
2. In GitHub: Settings → Pages → select the branch and folder → Save.

No build step is required.
