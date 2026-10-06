
/**
 * THE RAJMAHAL PALACE — main.js
 * Scroll-driven cinematic experience
 *
 * Architecture:
 * 1. Lenis smooth scroll → GSAP ScrollTrigger
 * 2. Preloader
 * 3. Custom cursor
 * 4. Video scrub: 01, 02, 06
 * 5. Video autoplay: 03, 04, 05
 * 6. Chapter choreography
 * 7. Navigation
 * 8. Stats / reveal lines / parallax
 * 9. Magnetic CTA
 * 10. Mobile fallbacks
 */

'use strict';

/* ============================================================
   GLOBALS / UTILS
   ============================================================ */

const isMobile = () => window.innerWidth <= 768;

const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ============================================================
   WORD SPLITTER
   ============================================================ */

function splitWords(el) {
  if (!el) return [];

  const text = el.innerText.trim();
  el.innerHTML = '';

  return text.split(/\s+/).map((word) => {
    const wrap = document.createElement('span');
    wrap.className = 'word-wrap';

    const inner = document.createElement('span');
    inner.className = 'word';
    inner.textContent = word;

    wrap.appendChild(inner);
    el.appendChild(wrap);
    el.appendChild(document.createTextNode(' '));

    return inner;
  });
}

/* ============================================================
   REVEAL LINE WRAPPERS
   ============================================================ */

function initRevealLineWrappers() {
  document.querySelectorAll('.reveal-line').forEach((line) => {
    if (line.querySelector('.line-reveal-wrap')) return;

    const text = line.innerHTML;

    const wrap = document.createElement('span');
    wrap.className = 'line-reveal-wrap';

    const inner = document.createElement('span');
    inner.className = 'line-reveal-inner';
    inner.innerHTML = text;

    wrap.appendChild(inner);

    line.innerHTML = '';
    line.appendChild(wrap);
  });
}

/* ============================================================
   VIDEO HELPERS
   ============================================================ */

function getFallback(video) {
  if (!video) return null;

  const fallbackId = video.id.replace('Video', 'Fallback');

  return document.getElementById(fallbackId);
}

function showVideoFallback(video) {
  const fallback = getFallback(video);

  if (fallback) {
    fallback.classList.add('show');
  }

  if (video) {
    video.classList.add('video-error');
  }
}

function hideVideoFallback(video) {
  const fallback = getFallback(video);

  if (fallback) {
    fallback.classList.remove('show');
  }

  if (video) {
    video.classList.remove('video-error');
  }
}

/**
 * Prepare a video safely.
 */
function prepareVideo(video) {
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  video.addEventListener('loadedmetadata', () => {
    console.log(
      `[Rajmahal] ${video.id} metadata loaded:`,
      video.duration,
      'seconds'
    );

    hideVideoFallback(video);
  });

  video.addEventListener('canplay', () => {
    hideVideoFallback(video);
  });

  video.addEventListener('error', () => {
    console.error(
      `[Rajmahal] Video error: ${video.id}`,
      video.error
    );

    const source = video.querySelector('source');

    console.error(
      `[Rajmahal] Video source:`,
      source ? source.src : 'NO SOURCE'
    );

    showVideoFallback(video);
  });

  /*
   * Important:
   * If preload="none" is used, explicitly loading the video is
   * necessary for scrubbed videos.
   */
  video.load();
}

/* ============================================================
   SCRUBBED VIDEO CONTROLLER
   ============================================================ */

class ScrubVideo {
  constructor(videoEl) {
    this.video = videoEl;

    this.ready = false;
    this.duration = 0;

    this.targetTime = 0;
    this.currentTime = 0;

    this.raf = null;

    if (!this.video) return;

    this.video.muted = true;
    this.video.playsInline = true;

    /*
     * Listen BEFORE calling load().
     */
    this.video.addEventListener(
      'loadedmetadata',
      () => {
        this.markReady();
      },
      { once: false }
    );

    this.video.addEventListener(
      'durationchange',
      () => {
        if (
          Number.isFinite(this.video.duration) &&
          this.video.duration > 0
        ) {
          this.markReady();
        }
      },
      { once: false }
    );

    this.video.addEventListener(
      'loadeddata',
      () => {
        if (
          Number.isFinite(this.video.duration) &&
          this.video.duration > 0
        ) {
          this.markReady();
        }
      },
      { once: false }
    );

    /*
     * CRITICAL FIX:
     * Metadata may already be loaded before this class was created.
     */
    if (
      this.video.readyState >= 1 &&
      Number.isFinite(this.video.duration) &&
      this.video.duration > 0
    ) {
      this.markReady();
    } else {
      this.video.load();
    }
  }

  markReady() {
    if (!this.video) return;

    if (
      !Number.isFinite(this.video.duration) ||
      this.video.duration <= 0
    ) {
      return;
    }

    this.duration = this.video.duration;
    this.ready = true;

    this.currentTime = clamp(
      this.video.currentTime || 0,
      0,
      this.duration
    );

    console.log(
      `[Rajmahal] Scrub ready: ${this.video.id} (${this.duration}s)`
    );

    hideVideoFallback(this.video);
  }

  setProgress(progress) {
    if (!this.video) return;

    progress = clamp(progress, 0, 1);

    if (!this.ready) {
      /*
       * Try to recover if metadata wasn't available initially.
       */
      if (
        this.video.readyState >= 1 &&
        Number.isFinite(this.video.duration) &&
        this.video.duration > 0
      ) {
        this.markReady();
      }

      if (!this.ready) return;
    }

    this.targetTime = progress * this.duration;

    if (!this.raf) {
      this.tick();
    }
  }

  tick() {
    this.raf = requestAnimationFrame(() => {
      if (!this.video || !this.ready) {
        this.raf = null;
        return;
      }

      const diff =
        this.targetTime - this.currentTime;

      if (Math.abs(diff) < 0.01) {
        this.currentTime = this.targetTime;
        this.seek(this.currentTime);
        this.raf = null;
        return;
      }

      this.currentTime = lerp(
        this.currentTime,
        this.targetTime,
        0.14
      );

      this.seek(this.currentTime);

      this.tick();
    });
  }

  seek(time) {
    if (!this.video) return;

    if (
      this.video.readyState < 2 ||
      !Number.isFinite(time)
    ) {
      return;
    }

    try {
      const safeTime = clamp(
        time,
        0,
        Math.max(0, this.duration - 0.001)
      );

      /*
       * Avoid unnecessary seeks.
       */
      if (
        Math.abs(this.video.currentTime - safeTime) >
        0.008
      ) {
        this.video.currentTime = safeTime;
      }
    } catch (error) {
      console.warn(
        `[Rajmahal] Could not seek ${this.video.id}`,
        error
      );
    }
  }
}

/* ============================================================
   AUTOPLAY VIDEO
   ============================================================ */

function setupAutoplay(video) {
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.15
        ) {
          video
            .play()
            .then(() => {
              hideVideoFallback(video);
            })
            .catch((error) => {
              console.warn(
                `[Rajmahal] Autoplay blocked for ${video.id}:`,
                error
              );
            });
        } else {
          video.pause();
        }
      });
    },
    {
      threshold: [0, 0.15, 0.5]
    }
  );

  observer.observe(video);
}

/* ============================================================
   MOBILE VIDEO FALLBACK
   ============================================================ */

function setupMobileVideo(video) {
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  /*
   * On mobile the scrubbed videos become normal autoplay videos.
   * Otherwise the CSS Ken Burns animation would animate a paused
   * video frame.
   */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    {
      threshold: 0.1
    }
  );

  observer.observe(video);
}

/* ============================================================
   VIDEO INITIALIZATION
   ============================================================ */

function initVideos() {
  const allVideos =
    document.querySelectorAll('video');

  allVideos.forEach(prepareVideo);

  /*
   * Desktop scrub videos
   */
  if (!isMobile()) {
    setupScrubVideo('heroVideo', 'chapter-hero');
    setupScrubVideo(
      'arrivalVideo',
      'chapter-arrival'
    );
    setupScrubVideo(
      'finaleVideo',
      'chapter-finale'
    );
  } else {
    /*
     * Mobile: play scrubbed videos normally.
     * CSS provides the Ken Burns motion.
     */
    setupMobileVideo(
      document.getElementById('heroVideo')
    );

    setupMobileVideo(
      document.getElementById('arrivalVideo')
    );

    setupMobileVideo(
      document.getElementById('finaleVideo')
    );
  }

  /*
   * Autoplay videos
   */
  setupAutoplay(
    document.getElementById('durbarVideo')
  );

  setupAutoplay(
    document.getElementById('suitesVideo')
  );

  setupAutoplay(
    document.getElementById('gardensVideo')
  );
}

/* ============================================================
   SCRUB VIDEO SETUP
   ============================================================ */

function setupScrubVideo(videoId, sectionId) {
  const video =
    document.getElementById(videoId);

  const section =
    document.getElementById(sectionId);

  if (!video || !section) {
    console.warn(
      `[Rajmahal] Missing scrub video/section:`,
      videoId,
      sectionId
    );
    return;
  }

  const scrub = new ScrubVideo(video);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',

    onUpdate: (self) => {
      scrub.setProgress(self.progress);
    }
  });
}

/* ============================================================
   CUSTOM CURSOR
   ============================================================ */

function initCursor() {
  if (
    isMobile() ||
    prefersReducedMotion
  ) {
    return;
  }

  const cursor =
    document.getElementById('cursor');

  if (!cursor) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  let curX = mouseX;
  let curY = mouseY;

  document.addEventListener(
    'mousemove',
    (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }
  );

  function animateCursor() {
    curX = lerp(curX, mouseX, 0.15);
    curY = lerp(curY, mouseY, 0.15);

    cursor.style.transform =
      `translate(${curX}px, ${curY}px) translate(-50%, -50%)`;

    requestAnimationFrame(
      animateCursor
    );
  }

  animateCursor();

  const interactables =
    document.querySelectorAll(
      'a, button, .suite-card, video, [data-cursor]'
    );

  interactables.forEach((el) => {
    el.addEventListener(
      'mouseenter',
      () => {
        document.body.classList.add(
          'cursor-expanded'
        );

        const label =
          cursor.querySelector(
            '.cursor-label'
          );

        if (label) {
          label.textContent =
            el.dataset.cursor || 'VIEW';
        }
      }
    );

    el.addEventListener(
      'mouseleave',
      () => {
        document.body.classList.remove(
          'cursor-expanded'
        );
      }
    );
  });
}

/* ============================================================
   PRELOADER
   ============================================================ */

function runPreloader(onComplete) {
  const preloader =
    document.getElementById('preloader');

  const letters =
    document.querySelectorAll(
      '#preloaderLetters span'
    );

  const rule =
    document.querySelector(
      '.preloader-rule'
    );

  const counter =
    document.getElementById(
      'preloaderCounter'
    );

  const curtain =
    document.getElementById(
      'preloaderCurtain'
    );

  if (!preloader) {
    onComplete();
    return;
  }

  if (
    prefersReducedMotion ||
    typeof gsap === 'undefined'
  ) {
    preloader.style.display = 'none';
    onComplete();
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.to(curtain, {
        y: '-100%',
        duration: 1.1,
        ease: 'expo.inOut',

        onComplete: () => {
          preloader.style.display = 'none';

          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      });
    }
  });

  tl.to(letters, {
    y: 0,
    opacity: 1,
    duration: 0.6,
    stagger: 0.06,
    ease: 'expo.out'
  });

  tl.to(
    rule,
    {
      width: '100%',
      duration: 0.9,
      ease: 'expo.inOut'
    },
    '-=0.2'
  );

  tl.to(
    counter,
    {
      opacity: 1,
      duration: 0.3
    },
    '-=0.5'
  );

  const count = { val: 0 };

  tl.to(
    count,
    {
      val: 100,
      duration: 1.8,
      ease: 'power2.inOut',

      onUpdate: () => {
        if (counter) {
          counter.textContent =
            Math.round(count.val);
        }
      }
    },
    '-=0.8'
  );

  tl.to({}, {
    duration: 0.3
  });
}

/* ============================================================
   LENIS + SCROLLTRIGGER
   ============================================================ */

let lenis = null;

function initLenis() {
  if (
    prefersReducedMotion ||
    isMobile() ||
    typeof Lenis === 'undefined'
  ) {
    return;
  }

  lenis = new Lenis({
    duration: 1.4,
    easing: (t) =>
      Math.min(
        1,
        1.001 - Math.pow(2, -10 * t)
      ),
    smoothWheel: true,
    smoothTouch: false
  });

  /*
   * One animation loop only.
   *
   * The old code used BOTH requestAnimationFrame()
   * and gsap.ticker, which caused Lenis to be advanced
   * twice every frame.
   */
  lenis.on('scroll', () => {
    ScrollTrigger.update();
  });

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function initNav() {
  const nav =
    document.getElementById('nav');

  if (!nav) return;

  let lastScroll = 0;

  ScrollTrigger.create({
    start: 'top -80',

    onUpdate: (self) => {
      const current = self.scroll();
      const direction =
        current - lastScroll;

      if (current > 100) {
        nav.classList.add(
          'visible',
          'scrolled'
        );
      } else {
        nav.classList.remove(
          'visible',
          'scrolled'
        );
      }

      if (
        direction > 0 &&
        current > 200
      ) {
        nav.classList.add('hidden');
      } else if (direction < 0) {
        nav.classList.remove('hidden');
      }

      lastScroll = current;
    }
  });
}

/* ============================================================
   CHAPTER INDICATOR
   ============================================================ */

function initChapterIndicator() {
  const indicator =
    document.getElementById(
      'chapterIndicator'
    );

  const numEl =
    document.getElementById(
      'chapterNum'
    );

  const rail =
    document.getElementById(
      'scrollProgressRail'
    );

  const fill =
    document.getElementById(
      'scrollProgressFill'
    );

  const chapters =
    document.querySelectorAll(
      '.chapter[data-chapter]'
    );

  chapters.forEach((chapter) => {
    ScrollTrigger.create({
      trigger: chapter,
      start: 'top center',
      end: 'bottom center',

      onEnter: () => {
        const num =
          chapter.dataset.chapter;

        if (numEl) {
          if (
            typeof gsap !== 'undefined'
          ) {
            gsap.to(numEl, {
              opacity: 0,
              y: -10,
              duration: 0.2,

              onComplete: () => {
                numEl.textContent = num;

                gsap.to(numEl, {
                  opacity: 1,
                  y: 0,
                  duration: 0.3
                });
              }
            });
          } else {
            numEl.textContent = num;
          }
        }

        if (indicator) {
          indicator.classList.add(
            'visible'
          );
        }

        if (rail) {
          rail.classList.add(
            'visible'
          );
        }
      },

      onEnterBack: () => {
        const num =
          chapter.dataset.chapter;

        if (numEl) {
          numEl.textContent = num;
        }

        if (indicator) {
          indicator.classList.add(
            'visible'
          );
        }

        if (rail) {
          rail.classList.add(
            'visible'
          );
        }
      },

      onLeaveBack: () => {
        if (
          chapter === chapters[0]
        ) {
          indicator?.classList.remove(
            'visible'
          );

          rail?.classList.remove(
            'visible'
          );
        }
      }
    });
  });

  ScrollTrigger.create({
    start: 'top top',
    end: 'bottom bottom',

    onUpdate: (self) => {
      if (fill) {
        fill.style.height =
          `${self.progress * 100}%`;
      }
    }
  });
}

/* ============================================================
   HERO
   ============================================================ */

function initHero() {
  const video =
    document.getElementById(
      'heroVideo'
    );

  const line1Words =
    document.querySelectorAll(
      '[data-line="1"] .word'
    );

  const secondLine =
    document.getElementById(
      'heroSecondLine'
    );

  const line2Words =
    document.querySelectorAll(
      '#heroSecondLine .word'
    );

  const eyebrowRule =
    document.querySelector(
      '.eyebrow-rule'
    );

  const scrollCue =
    document.getElementById(
      'scrollCue'
    );

  if (prefersReducedMotion) {
    line1Words.forEach((word) => {
      word.style.transform = 'none';
      word.style.opacity = '1';
    });

    if (secondLine) {
      secondLine.style.opacity = '1';
    }

    line2Words.forEach((word) => {
      word.style.transform = 'none';
      word.style.opacity = '1';
    });

    return;
  }

  const entranceTl =
    gsap.timeline({
      paused: true
    });

  if (eyebrowRule) {
    entranceTl.to(
      eyebrowRule,
      {
        width: '80px',
        duration: 0.9,
        ease: 'expo.out'
      }
    );
  }

  entranceTl.to(
    line1Words,
    {
      y: 0,
      duration: 1.1,
      stagger: 0.09,
      ease: 'expo.out'
    },
    '-=0.4'
  );

  entranceTl.to(
    scrollCue,
    {
      opacity: 1,
      duration: 0.6
    },
    '+=0.3'
  );

  window._heroEntrance =
    entranceTl;

  /*
   * Mobile doesn't use ScrollTrigger scrubbing.
   */
  if (isMobile()) return;

  const scrub =
    new ScrubVideo(video);

  ScrollTrigger.create({
    trigger: '#chapter-hero',
    start: 'top top',
    end: 'bottom bottom',

    onUpdate: (self) => {
      scrub.setProgress(
        self.progress
      );

      const p = self.progress;

      if (p > 0.25) {
        const fade = clamp(
          (p - 0.25) / 0.2,
          0,
          1
        );

        gsap.set(line1Words, {
          opacity: 1 - fade,
          y: -40 * fade
        });
      } else {
        gsap.set(line1Words, {
          opacity: 1,
          y: 0
        });
      }

      if (p > 0.5) {
        const appear = clamp(
          (p - 0.5) / 0.25,
          0,
          1
        );

        gsap.set(secondLine, {
          opacity: appear
        });

        gsap.set(line2Words, {
          y: (1 - appear) * 30
        });
      } else {
        gsap.set(secondLine, {
          opacity: 0
        });
      }

      if (p > 0.05) {
        gsap.set(scrollCue, {
          opacity: clamp(
            1 -
              (p - 0.05) /
                0.1,
            0,
            1
          )
        });
      }
    }
  });
}

/* ============================================================
   ARRIVAL
   ============================================================ */

function initArrival() {
  const video =
    document.getElementById(
      'arrivalVideo'
    );

  const eyebrow =
    document.querySelector(
      '.arrival-eyebrow'
    );

  const words =
    document.querySelectorAll(
      '.arrival-word'
    );

  const jali =
    document.getElementById(
      'jaliOverlay'
    );

  if (prefersReducedMotion) {
    eyebrow?.style.setProperty(
      'opacity',
      '1'
    );

    eyebrow?.style.setProperty(
      'transform',
      'none'
    );

    words.forEach((word) => {
      word.style.opacity = '1';
      word.style.transform = 'none';
    });

    return;
  }

  if (isMobile()) {
    ScrollTrigger.create({
      trigger: '#chapter-arrival',
      start: 'top 80%',
      once: true,

      onEnter: () => {
        gsap.to(eyebrow, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'expo.out'
        });

        gsap.to(words, {
          opacity: 1,
          x: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: 'expo.out'
        });
      }
    });

    return;
  }

  const scrub =
    new ScrubVideo(video);

  ScrollTrigger.create({
    trigger: '#chapter-arrival',
    start: 'top top',
    end: 'bottom bottom',

    onUpdate: (self) => {
      scrub.setProgress(
        self.progress
      );

      const p = self.progress;

      if (p > 0.05) {
        const a = clamp(
          (p - 0.05) / 0.1,
          0,
          1
        );

        gsap.set(eyebrow, {
          opacity: a,
          y: (1 - a) * 20
        });
      }

      words.forEach((word, i) => {
        const startAt =
          0.1 + i * 0.08;

        const endAt =
          startAt + 0.12;

        const t = clamp(
          (p - startAt) /
            (endAt - startAt),
          0,
          1
        );

        const dir =
          word.dataset.dir === 'right'
            ? 1
            : -1;

        gsap.set(word, {
          opacity: t,
          x:
            dir *
            (1 - t) *
            80
        });
      });

      if (jali) {
        if (p > 0.85) {
          const a = clamp(
            (p - 0.85) / 0.1,
            0,
            1
          );

          const fadeOut =
            p > 0.95
              ? clamp(
                  (p - 0.95) /
                    0.05,
                  0,
                  1
                )
              : 0;

          gsap.set(jali, {
            opacity:
              a *
              (1 - fadeOut)
          });
        } else {
          gsap.set(jali, {
            opacity: 0
          });
        }
      }
    }
  });
}

/* ============================================================
   DURBAR HALL
   ============================================================ */

function initDurbar() {
  const video =
    document.getElementById(
      'durbarVideo'
    );

  setupAutoplay(video);

  const videoWrap =
    document.querySelector(
      '.durbar-video-wrap'
    );

  const textCol =
    document.querySelector(
      '.durbar-text-col'
    );

  const panel =
    document.querySelector(
      '.durbar-text-panel'
    );

  const statNums =
    document.querySelectorAll(
      '.stat-num'
    );

  ScrollTrigger.create({
    trigger: '#chapter-durbar',
    start: 'top 70%',
    once: true,

    onEnter: () => {
      videoWrap?.classList.add(
        'in-view'
      );

      textCol?.classList.add(
        'in-view'
      );

      if (!prefersReducedMotion) {
        const inners =
          panel?.querySelectorAll(
            '.line-reveal-inner'
          ) || [];

        gsap.to(inners, {
          y: 0,
          duration: 0.9,
          stagger: 0.06,
          ease: 'expo.out',
          delay: 0.3
        });

        statNums.forEach((el) => {
          const target =
            parseInt(
              el.dataset.target,
              10
            ) || 0;

          const counter = {
            val: 0
          };

          gsap.to(counter, {
            val: target,
            duration: 2,
            delay: 0.6,
            ease: 'power2.out',

            onUpdate: () => {
              el.textContent =
                Math.round(
                  counter.val
                ).toLocaleString(
                  'en-IN'
                );
            }
          });
        });
      } else {
        statNums.forEach((el) => {
          el.textContent =
            (
              parseInt(
                el.dataset.target,
                10
              ) || 0
            ).toLocaleString(
              'en-IN'
            );
        });
      }
    }
  });
}

/* ============================================================
   SUITES
   ============================================================ */

function initSuites() {
  const video =
    document.getElementById(
      'suitesVideo'
    );

  setupAutoplay(video);

  const track =
    document.getElementById(
      'suitesTrack'
    );

  const header =
    document.querySelector(
      '.suites-header'
    );

  /*
   * Reveal lines are already wrapped by
   * initRevealLineWrappers().
   */

  if (
    isMobile() ||
    prefersReducedMotion
  ) {
    if (track) {
      track.style.flexDirection =
        'column';

      track.style.width =
        '100%';

      track.style.transform =
        'none';
    }

    ScrollTrigger.create({
      trigger: '#chapter-suites',
      start: 'top 70%',
      once: true,

      onEnter: () => {
        if (!prefersReducedMotion) {
          const inners =
            header?.querySelectorAll(
              '.line-reveal-inner'
            ) || [];

          gsap.to(inners, {
            y: 0,
            duration: 0.9,
            stagger: 0.08,
            ease: 'expo.out'
          });
        }
      }
    });

    return;
  }

  /*
   * Video parallax
   */
  ScrollTrigger.create({
    trigger: '#chapter-suites',
    start: 'top bottom',
    end: 'bottom top',

    onUpdate: (self) => {
      gsap.set(video, {
        y:
          (self.progress - 0.5) *
          80
      });
    }
  });

  if (!track) return;

  const cards =
    track.querySelectorAll(
      '.suite-card'
    );

  /*
   * Calculate actual track width instead of
   * assuming every card has exactly the same width.
   */
  const totalWidth =
    track.scrollWidth;

  const viewportWidth =
    window.innerWidth;

  const totalScroll = Math.max(
    0,
    totalWidth -
      viewportWidth +
      window.innerWidth * 0.12
  );

  gsap.to(track, {
    x: -totalScroll,
    ease: 'none',

    scrollTrigger: {
      trigger: '#chapter-suites',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2
    }
  });

  ScrollTrigger.create({
    trigger: '#chapter-suites',
    start: 'top 60%',
    once: true,

    onEnter: () => {
      const inners =
        header?.querySelectorAll(
          '.line-reveal-inner'
        ) || [];

      gsap.to(inners, {
        y: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'expo.out',
        delay: 0.2
      });
    }
  });
}

/* ============================================================
   GARDENS
   ============================================================ */

function initGardens() {
  const video =
    document.getElementById(
      'gardensVideo'
    );

  setupAutoplay(video);

  const mediaWrap =
    document.getElementById(
      'gardensMediaWrap'
    );

  const floaters =
    document.querySelectorAll(
      '.floater'
    );

  if (
    isMobile() ||
    prefersReducedMotion
  ) {
    if (mediaWrap) {
      mediaWrap.style.clipPath =
        'none';
    }

    floaters.forEach((floater) => {
      floater.classList.add(
        'visible'
      );
    });

    return;
  }

  const fullClip =
    'polygon(0% 0%,100% 0%,100% 20%,100% 50%,100% 80%,100% 100%,0% 100%,0% 80%,0% 50%,0% 20%)';

  gsap.to(mediaWrap, {
    clipPath: fullClip,
    ease: 'none',

    scrollTrigger: {
      trigger: '#chapter-gardens',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5
    }
  });

  floaters.forEach((floater) => {
    const depth =
      parseFloat(
        floater.dataset.depth
      ) || 0.4;

    floater.classList.add(
      'visible'
    );

    ScrollTrigger.create({
      trigger: '#chapter-gardens',
      start: 'top bottom',
      end: 'bottom top',

      onUpdate: (self) => {
        const offset =
          (self.progress - 0.5) *
          depth *
          120;

        gsap.set(floater, {
          y: offset
        });
      }
    });
  });

  ScrollTrigger.create({
    trigger: '#chapter-gardens',
    start: 'top 80%',
    once: true,

    onEnter: () => {
      const inners =
        document.querySelectorAll(
          '.gardens-headline .line-reveal-inner'
        );

      gsap.to(inners, {
        y: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'expo.out',
        delay: 0.4
      });
    }
  });
}

/* ============================================================
   FINALE
   ============================================================ */

function initFinale() {
  const video =
    document.getElementById(
      'finaleVideo'
    );

  const words =
    document.querySelectorAll(
      '.finale-word'
    );

  const ctaWrap =
    document.getElementById(
      'finaleCta'
    );

  if (prefersReducedMotion) {
    words.forEach((word) => {
      word.style.opacity = '1';
      word.style.transform =
        'none';
    });

    if (ctaWrap) {
      ctaWrap.style.opacity = '1';
      ctaWrap.style.transform =
        'none';
    }

    return;
  }

  if (isMobile()) {
    ScrollTrigger.create({
      trigger: '#chapter-finale',
      start: 'top 70%',
      once: true,

      onEnter: () => {
        gsap.to(words, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.06,
          ease: 'expo.out'
        });

        gsap.to(ctaWrap, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'expo.out',
          delay: 0.8
        });
      }
    });

    return;
  }

  const scrub =
    new ScrubVideo(video);

  ScrollTrigger.create({
    trigger: '#chapter-finale',
    start: 'top top',
    end: 'bottom bottom',

    onUpdate: (self) => {
      scrub.setProgress(
        self.progress
      );

      const p =
        self.progress;

      words.forEach(
        (word, i) => {
          const startAt =
            0.1 + i * 0.065;

          const t = clamp(
            (p - startAt) /
              0.12,
            0,
            1
          );

          gsap.set(word, {
            opacity: t,
            y:
              (1 - t) *
              20
          });
        }
      );

      if (p > 0.8) {
        const a = clamp(
          (p - 0.8) /
            0.15,
          0,
          1
        );

        gsap.set(ctaWrap, {
          opacity: a,
          y:
            (1 - a) *
            30
        });
      } else {
        gsap.set(ctaWrap, {
          opacity: 0,
          y: 30
        });
      }
    }
  });
}

/* ============================================================
   CTA MAGNETIC BUTTON
   ============================================================ */

function initCTA() {
  const btn =
    document.getElementById(
      'ctaButton'
    );

  if (
    !btn ||
    isMobile() ||
    prefersReducedMotion
  ) {
    return;
  }

  const maxMove = 12;

  btn.addEventListener(
    'mousemove',
    (event) => {
      const rect =
        btn.getBoundingClientRect();

      const cx =
        rect.left +
        rect.width / 2;

      const cy =
        rect.top +
        rect.height / 2;

      const dx =
        (event.clientX - cx) /
        (rect.width / 2);

      const dy =
        (event.clientY - cy) /
        (rect.height / 2);

      gsap.to(btn, {
        x: dx * maxMove,
        y: dy * maxMove,
        duration: 0.5,
        ease: 'power2.out'
      });
    }
  );

  btn.addEventListener(
    'mouseleave',
    () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: 'expo.out'
      });
    }
  );
}

/* ============================================================
   FOOTER
   ============================================================ */

function initFooter() {
  // Footer styling is handled by CSS.
}

/* ============================================================
   INITIALIZE SITE
   ============================================================ */

function initSite() {
  if (
    typeof gsap === 'undefined' ||
    typeof ScrollTrigger === 'undefined'
  ) {
    console.error(
      '[Rajmahal] GSAP or ScrollTrigger failed to load.'
    );
    return;
  }

  gsap.registerPlugin(
    ScrollTrigger
  );

  /*
   * Wrap reveal lines BEFORE ScrollTrigger
   * calculates positions.
   */
  initRevealLineWrappers();

  /*
   * Initialize Lenis first.
   */
  initLenis();

  ScrollTrigger.defaults({
    markers: false
  });

  /*
   * Videos must be initialized before
   * ScrollTrigger refreshes.
   */
  initVideos();

  initCursor();
  initNav();
  initChapterIndicator();

  initHero();
  initArrival();
  initDurbar();
  initSuites();
  initGardens();
  initFinale();

  initCTA();
  initFooter();

  /*
   * Give videos/fonts time to establish dimensions.
   */
  setTimeout(() => {
    ScrollTrigger.refresh();
  }, 100);

  document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
  });

  window.addEventListener(
    'load',
    () => {
      ScrollTrigger.refresh();
    },
    { once: true }
  );
}

/* ============================================================
   PRELOADER → SITE
   ============================================================ */

window.addEventListener(
  'DOMContentLoaded',
  () => {
    runPreloader(() => {
      initSite();

      /*
       * Hero entrance starts after site initialization.
       */
      if (window._heroEntrance) {
        window._heroEntrance.play();
      }
    });
  }
);

/* ============================================================
   RESIZE
   ============================================================ */

let resizeTimer = null;

window.addEventListener(
  'resize',
  () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      if (
        typeof ScrollTrigger !==
        'undefined'
      ) {
        ScrollTrigger.refresh();
      }
    }, 250);
  }
);

