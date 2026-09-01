// Expo's web SPA export ("single" output) ignores app/+html.tsx, so there is
// no supported way to add `viewport-fit=cover` to the generated index.html
// through Expo itself. Without it, `env(safe-area-inset-*)` never reports a
// non-zero value in some browsers. Run this after `expo export --platform
// web` and before copying dist/ into the Next.js site's public/app/.
//
// Note: an earlier version of this script also forced `html, body, #root`
// to a JS-computed pixel height (visualViewport-based), trying to make the
// page fit exactly within the visible area on mobile browsers whose chrome
// (address bar / toolbar) shrinks the viewport. That approach was backwards
// — confirmed on-device (Chrome iOS) that the bottom toolbar overlays the
// last ~40-50px of viewport content regardless of how precisely the page
// height is computed, so forcing an exact fit just meant that overlay ate
// into real content (the tab bar's label text) instead of empty padding.
// The actual fix is on the tab bar itself (app/(tabs)/_layout.tsx): leave
// enough sacrificial bottom padding below the labels that the overlay has
// blank space to cover instead.
import fs from 'node:fs'

const indexPath = 'app-mobile/dist/index.html'
const html = fs.readFileSync(indexPath, 'utf8')

const oldTag = '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />'
const newTag = '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />'

if (html.includes(oldTag)) {
  fs.writeFileSync(indexPath, html.replace(oldTag, newTag))
  console.log('Added viewport-fit=cover to app-mobile/dist/index.html')
} else if (html.includes('viewport-fit=cover')) {
  console.log('viewport-fit=cover already present, skipping.')
} else {
  console.error("Expected viewport meta tag not found — Expo's default template may have changed.")
  process.exit(1)
}
