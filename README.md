# The Rajmahal Palace — Website README

A fictional ultra-premium Indian lake-palace hotel website built as a single-page cinematic scroll experience.

---

## How to Run

This is a self-contained static site. **No build step required.**

**Option A — Direct File Open**
Open `index.html` in Chrome or Firefox. Note: Safari may restrict local video playback without a server.

**Option B — Simple Local Server (recommended)**
```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
Install "Live Server" extension, right-click index.html → Open with Live Server
```
Then open `http://localhost:8080` in your browser.

---

## Where to Drop the 6 Videos

Place all 6 video files in `/assets/video/` with these exact names:

```
assets/
  video/
    01-hero-aerial.mp4        ← Chapter 1 hero (scroll-scrubbed)
    02-arrival-gate.mp4       ← Chapter 2 arrival (scroll-scrubbed)
    03-durbar-lobby.mp4       ← Chapter 3 durbar hall (autoplay loop)
    04-royal-suite.mp4        ← Chapter 4 suites (autoplay loop)
    05-pool-gardens.mp4       ← Chapter 5 gardens (autoplay loop)
    06-night-finale.mp4       ← Chapter 6 finale (scroll-scrubbed)
```

If a video is missing or fails to load, the site gracefully shows a gold-shimmer sapphire gradient placeholder and logs the issue to the console.

---

## FFMPEG Re-encode Command (IMPORTANT for scrub videos)

For smooth video scrubbing, the 3 scrubbed videos (01, 02, 06) must be re-encoded with **dense keyframes** so seeking is frame-accurate:

```bash
# Run for each scrub video:
ffmpeg -i 01-hero-aerial.mp4 -vf scale=1920:-2 -g 1 -crf 20 -movflags +faststart -an 01-hero-aerial-scrub.mp4
ffmpeg -i 02-arrival-gate.mp4 -vf scale=1920:-2 -g 1 -crf 20 -movflags +faststart -an 02-arrival-gate-scrub.mp4
ffmpeg -i 06-night-finale.mp4 -vf scale=1920:-2 -g 1 -crf 20 -movflags +faststart -an 06-night-finale-scrub.mp4
```

**Flag explanations:**
- `-vf scale=1920:-2` — Resize to 1920px wide, preserve aspect ratio
- `-g 1` — Every frame is a keyframe (essential for seek accuracy)
- `-crf 20` — High quality (lower = higher quality, 18–23 is good range)
- `-movflags +faststart` — Moves metadata to the start for faster web loading
- `-an` — Remove audio (videos are muted anyway, saves file size)

Then rename the output files to the standard names above.

---

## How to Tweak Scrub Distance Per Chapter

Each scroll-scrubbed chapter has a CSS height that controls how long the user scrolls while pinned:

```css
/* In styles.css — change these to adjust scroll distance */

.chapter-hero    { height: 400vh; }   /* Chapter 1 hero */
.chapter-arrival { height: 350vh; }   /* Chapter 2 arrival */
.chapter-finale  { height: 400vh; }   /* Chapter 6 finale */
.chapter-suites  { height: 450vh; }   /* Chapter 4 horizontal cards */
.chapter-gardens { height: 400vh; }   /* Chapter 5 clip-path reveal */
```

Increase the `vh` value to make a chapter's scroll zone longer (slower pace), decrease for quicker.

---

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build step
- **GSAP 3.12 + ScrollTrigger** (CDN) — all scroll animations
- **Lenis 1.0.42** (CDN) — buttery smooth scroll with inertia, wired to ScrollTrigger
- **Google Fonts** — Fraunces (display serif) + Manrope (UI sans)

---

## Test Checklist

| Browser | Known Issues | Workaround |
|---------|-------------|------------|
| Chrome Desktop | ✅ Full support | None |
| Firefox Desktop | ✅ Full support | None |
| Safari Desktop | Video autoplay may need user gesture | User interacts first |
| iOS Safari | Scrub videos replaced with Ken Burns | Automatic (≤768px breakpoint) |
| Android Chrome | ✅ Mostly fine | Scrub replaced on small screens |

**Lenis + ScrollTrigger:** Lenis is wired via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add()` per official docs. If you see jitter, check that Lenis version matches GSAP ScrollTrigger version.

**Safari pin quirks:** If pinned sections misbehave in Safari, ensure `overflow: hidden` is set on the sticky container's parent, which is handled in CSS.

---

## prefers-reduced-motion

The site fully respects `prefers-reduced-motion`. When enabled:
- Preloader is skipped
- Scroll-scrubbing pins are disabled; videos show as static posters
- All word/line reveals show immediately without animation
- Grain overlay runs statically
- Counters show final values immediately

---

## Performance Notes

- Only `01-hero-aerial.mp4` is preloaded; all others use `preload="none"` + IntersectionObserver lazy-loading
- Autoplay videos only play when ≥50% visible and pause on exit (battery/CPU savings)
- `will-change` is applied only to actively animating elements
- Grain overlay uses `mix-blend-mode: overlay` at 3.5% opacity for near-zero visual cost

---

*A fictional concept property — designed & built with Claude.*
