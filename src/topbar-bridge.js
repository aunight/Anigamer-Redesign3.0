(() => {
  'use strict';
  if (globalThis.__aniTopbarBridgeInstalled) return;
  globalThis.__aniTopbarBridgeInstalled = true;

  // Observe page-script navigation in the same world as the site's player.
  if (location.pathname === '/animeVideo.php') {
    let declined = false;
    document.addEventListener('click', event => {
      if (event.isTrusted && event.target.closest?.('#ani_video .choose-btn-disagree, #ani_video .ani-consent-decline')) {
        declined = true;
      }
    }, true);
    window.navigation?.addEventListener('navigate', event => {
      if (declined || !document.body?.classList.contains('ani-ambientlight-page') ||
          !event.cancelable || event.userInitiated || event.navigationType === 'traverse' ||
          navigator.userActivation?.isActive) return;
      const destination = new URL(event.destination.url);
      if (destination.host !== location.host || !['http:', 'https:'].includes(destination.protocol) ||
          !['/', '/index.php'].includes(destination.pathname)) return;
      const consent = document.querySelector('#ani_video .choose-btn-agree, #ani_video .ani-consent-accept');
      if (consent?.getClientRects().length) event.preventDefault();
    });
  }

  function installCommentImageZoom() {
    const hoverAnimations = new Map();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const hoverTiming = { duration: 220, easing: 'cubic-bezier(.25,.7,.35,1)' };

    function animateHoverChange(element, from, to) {
      const animation = element.animate([from, to], hoverTiming);
      hoverAnimations.set(element, animation);
      animation.finished.then(() => {
        if (hoverAnimations.get(element) === animation) hoverAnimations.delete(element);
      }, () => {});
    }

    function resizeThumbnail(event, expanded) {
      if (event.pointerType !== 'mouse') return;
      const thumbnail = event.target.closest?.('#w-post-box .reply-content__cont img[data-evt-show-img]');
      if (!thumbnail?.naturalWidth || !document.body.classList.contains('ani-layout-comments')) return;
      if (!expanded && !thumbnail.hasAttribute('data-ani-image-expanded')) return;

      const before = new Map();
      if (!motion.matches) {
        const imageRect = thumbnail.getBoundingClientRect();
        before.set(thumbnail, imageRect);
        const comments = thumbnail.closest('#w-post-box');
        const viewportLimit = innerHeight + (expanded ? 0 : imageRect.height);
        // These siblings follow the image in the layout, from its caption to later comments.
        for (let node = thumbnail; node !== comments; node = node.parentElement) {
          for (let sibling = node.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
            const rect = sibling.getBoundingClientRect();
            if (rect.top >= viewportLimit) break;
            if (rect.width && rect.height && rect.bottom > 0) before.set(sibling, rect);
          }
        }
        for (const element of hoverAnimations.keys()) {
          if (element.isConnected && !element.contains(thumbnail) && !before.has(element)) {
            before.set(element, element.getBoundingClientRect());
          }
        }
      }
      for (const animation of hoverAnimations.values()) animation.cancel();
      hoverAnimations.clear();
      thumbnail.removeAttribute('data-ani-image-expanded');
      thumbnail.style.removeProperty('--ani-expanded-comment-width');
      if (expanded) {
        const originalWidth = thumbnail.getBoundingClientRect().width;
        if (originalWidth) {
          const scale = thumbnail.naturalHeight > thumbnail.naturalWidth ? 2.6 : 1.8;
          thumbnail.style.setProperty('--ani-expanded-comment-width', `${originalWidth * scale}px`);
          thumbnail.setAttribute('data-ani-image-expanded', '');
        }
      }

      // Measure the final layout before starting any compositor animations.
      const after = [...before.keys()].map(element => [element, element.getBoundingClientRect()]);
      for (const [element, rect] of after) {
        const previous = before.get(element);
        const x = previous.left - rect.left;
        const y = previous.top - rect.top;
        if (element.matches('img[data-evt-show-img]') && rect.width && rect.height) {
          const scaleX = previous.width / rect.width;
          const scaleY = previous.height / rect.height;
          if (Math.abs(scaleX - 1) + Math.abs(scaleY - 1) < .001 && Math.abs(x) + Math.abs(y) < .5) continue;
          animateHoverChange(element,
            { transformOrigin: 'top left', transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
            { transformOrigin: 'top left', transform: 'none' });
        } else if (Math.abs(y) >= .5) {
          animateHoverChange(element, { translate: `0 ${y}px` }, { translate: '0 0' });
        }
      }
    }

    document.addEventListener('pointerover', event => resizeThumbnail(event, true));
    document.addEventListener('pointerout', event => resizeThumbnail(event, false));

    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('ani-layout-comments')) return;
      const thumbnail = event.target.closest?.('#w-post-box img[data-evt-show-img], #w-post-box [data-evt-show-img] img');
      const PhotoSwipe = window.PhotoSwipe;
      const viewer = document.querySelector('.pswp');
      if (!thumbnail || typeof PhotoSwipe !== 'function' || !viewer) return;

      if (viewer.parentElement !== document.body) document.body.append(viewer);
      const enhancedPhotoSwipe = new Proxy(PhotoSwipe, {
        construct(target, args, newTarget) {
          if (args[0] === viewer) {
            const options = args[3];
            const index = options.index ?? 0;
            const item = args[2][index];
            if (item && thumbnail.complete && thumbnail.naturalWidth) {
              item.msrc = thumbnail.currentSrc || thumbnail.src;
            }
            if (motion.matches) {
              options.showAnimationDuration = 0;
              options.hideAnimationDuration = 0;
            } else if (item && thumbnail.naturalWidth && thumbnail.naturalHeight) {
              if (!item.w || !item.h) {
                item.w = thumbnail.naturalWidth;
                item.h = thumbnail.naturalHeight;
              }
              options.getThumbBoundsFn = (activeIndex) => {
                if (activeIndex !== index || !thumbnail.isConnected) return;
                const rect = thumbnail.getBoundingClientRect();
                if (rect.width > 0) return { x: rect.left, y: rect.top + window.scrollY, w: rect.width };
              };
            }
          }
          return Reflect.construct(target, args, newTarget);
        },
      });
      // The site's delegated click constructs PhotoSwipe synchronously.
      window.PhotoSwipe = enhancedPhotoSwipe;
      setTimeout(() => {
        if (window.PhotoSwipe === enhancedPhotoSwipe) window.PhotoSwipe = PhotoSwipe;
      }, 0);
    }, true);
  }

  if (typeof GM_getValue === 'function' && typeof window.PhotoSwipe !== 'function') {
    const script = document.createElement('script');
    script.textContent = `(${installCommentImageZoom.toString()})();`;
    (document.head || document.documentElement).append(script);
    script.remove();
  } else {
    installCommentImageZoom();
  }

  document.addEventListener('click', (event) => {
    if (!document.body.classList.contains('ani-layout-comments')) return;
    const report = event.target.closest?.('#w-post-box a.reply_menu');
    if (!report) return;
    let actions;
    try { actions = JSON.parse(report.dataset.tippyMenuComment); } catch { return; }
    if (!actions.accusable) return;
    // The native delegated click has populated the menu before bubbling here.
    const nativeReport = report.wrappedJSObject || report;
    nativeReport._tippy?.popper.querySelector('[data-w-menu="accuse"]')?.click();
  });
  document.addEventListener('ani-topbar-open', (event) => {
    const id = event?.detail;
    if (!id || typeof globalThis.TOPBAR_show !== 'function') return;
    const msgBox = document.getElementById(`topBarMsg_${id}`);
    if (msgBox && getComputedStyle(msgBox).display !== 'none') return;
    try {
      globalThis.TOPBAR_show(id);
    } catch {}
  });

  document.addEventListener('ani-topbar-close', () => {
    if (typeof globalThis.TOPBAR_close !== 'function') return;
    try {
      globalThis.TOPBAR_close();
    } catch {}
  });

  const ratingBooleanKeys = new Set(['enabled', 'sortEnabled', 'maskEnabled', 'blockEnabled', 'fadeWatched']);
  const ratingNumberKeys = new Set(['threshold', 'blockThreshold', 'fontSize', 'radius', 'sampleThreshold', 'fetchInterval', 'cacheLimit', 'ttlHours']);
  document.addEventListener('ani-starmap-setting-change', event => {
    const config = globalThis.__aniConfig;
    if (event.defaultPrevented || typeof config?.setBatch !== 'function') return;
    try {
      const { key, value } = JSON.parse(event.detail);
      const valid = ratingBooleanKeys.has(key) && typeof value === 'boolean' ||
        ratingNumberKeys.has(key) && Number.isFinite(value);
      if (!valid) return;
      config.setBatch({ [key]: value });
      if (config.get(key) === value) event.preventDefault();
    } catch {}
  });
})();
