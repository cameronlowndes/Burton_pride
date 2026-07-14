FULL CLEAN TAILWIND FIX

1. Replace your existing globals.css with the included globals.css.
2. Replace your existing postcss.config.mjs with the included file.
3. Make sure app/layout.tsx imports the stylesheet correctly.

If globals.css is in the project root:
  import "../globals.css";

If globals.css is inside app/:
  import "./globals.css";

4. Install the required Tailwind v4 packages:
  npm install tailwindcss @tailwindcss/postcss postcss

5. Stop the development server.

6. Clear the Next.js cache.

Linux/macOS:
  rm -rf .next node_modules/.cache

Windows PowerShell:
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue

7. Restart:
  npm run dev

Important:
- Keep only ONE @import "tailwindcss"; line.
- Do not use source(none).
- Do not add @source rules.
