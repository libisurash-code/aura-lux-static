# Aura Lux — Static Site

Pure HTML, CSS, and vanilla JavaScript. No React, no build step.

## Run locally
Just open `index.html` in a browser. Or, for proper routing/relative paths:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy
Upload the entire folder contents to any static host:
- Netlify (drag & drop the folder)
- Vercel
- GitHub Pages
- Cloudflare Pages
- Any web host (FTP / shared hosting)

## Files
- `index.html` — Homepage (hero slider, categories, signature, combos, sets, about)
- `store.html` — Full perfume catalog with search & filter
- `special.html` — Hand-picked specials
- `styles.css` — All styles (light champagne luxury theme)
- `app.js` — All interactivity (slider, filters, WhatsApp buy buttons)
- `assets/` — All images

## Customization
- WhatsApp number: edit `WHATSAPP_NUMBER` in `app.js`
- Address / contact: edit footer in each `.html` file
- Products: edit arrays at the top of `app.js`
