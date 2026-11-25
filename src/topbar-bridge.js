(() => {
  'use strict';
  if (globalThis.__aniTopbarBridgeInstalled) return;
  globalThis.__aniTopbarBridgeInstalled = true;

  if (location.pathname === '/animeVideo.php') {
    const replyEndpoint = 'https://wall.gamer.com.tw/app/v1/reply_detail.php';
    const triggerSelector = '#w-post-box [data-morereply]';
    const prefetched = new Map();
    let transportInstalled = false;
    let hoverTimer;
    const requestReplies = (jquery, url) => new Promise((resolve, reject) => {
      jquery.ajax({ url, method: 'GET', dataType: 'text', xhrFields: { withCredentials: true }, timeout: 8000 })
        .done((body, _status, xhr) => resolve({ body, headers: xhr.getAllResponseHeaders() }))
        .fail(reject);
    });
    const installTransport = jquery => {
      jquery.ajaxTransport('+*', options => {
        if (options.type !== 'GET' || !options.url.startsWith(replyEndpoint + '?')) return;
        const url = new URL(options.url);
        const key = url.searchParams.get('commentId');
        const entry = prefetched.get(key);
        if (!entry || [...url.searchParams].length !== 1) return;
        prefetched.delete(key);
        if (Date.now() >= entry.expires) return;
        let aborted = false;
        return {
          send(_headers, complete) {
            entry.request.catch(() => requestReplies(jquery, options.url)).then(
              ({ body, headers }) => { if (!aborted) complete(200, 'success', { text: body }, headers); },
              () => { if (!aborted) complete(0, 'error'); },
            );
          },
          abort() { aborted = true; },
        };
      });
      transportInstalled = true;
    };
    const preload = trigger => {
      const jquery = window.jQuery || window.$;
      if (!trigger.isConnected || typeof jquery?.ajaxTransport !== 'function') return;
      let key;
      try { key = String(JSON.parse(trigger.dataset.morereply).c); } catch { return; }
      if (!/^\d+$/.test(key) || prefetched.get(key)?.expires > Date.now()) return;
      if (!transportInstalled) installTransport(jquery);
      prefetched.delete(key);
      const entry = { expires: Date.now() + 30000, images: [] };
      entry.request = requestReplies(jquery, replyEndpoint + '?commentId=' + key).then(response => {
        const replies = JSON.parse(response.body).comments;
        if (!Array.isArray(replies)) throw new Error('Replies unavailable');
        const urls = new Set(replies.slice(0, 12).flatMap(reply => [reply?.propic, reply?.image?.B]));
        for (const url of urls) {
          if (!/^https:\/\/(?:[\w-]+\.)?bahamut\.com\.tw\//i.test(url || '')) continue;
          const image = new Image();
          image.src = url;
          image.decode?.().catch(() => {});
          entry.images.push(image);
        }
        return response;
      });
      entry.request.catch(() => {
        if (prefetched.get(key) === entry) prefetched.delete(key);
      });
      prefetched.set(key, entry);
      if (prefetched.size > 6) prefetched.delete(prefetched.keys().next().value);
    };
    document.addEventListener('pointerover', event => {
      const trigger = event.target.closest?.(triggerSelector);
      if (!trigger || event.pointerType !== 'mouse' || trigger.contains(event.relatedTarget)) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => preload(trigger), 90);
    });
    document.addEventListener('pointerout', event => {
      const trigger = event.target.closest?.(triggerSelector);
      if (trigger && !trigger.contains(event.relatedTarget)) clearTimeout(hoverTimer);
    });
    document.addEventListener('focusin', event => {
      const trigger = event.target.closest?.(triggerSelector);
      if (trigger) preload(trigger);
    });
  }

  // Slick normally measures on window resize, but the homepage theme also
  // changes the rail width without resizing the window.
  if (location.pathname === '/' || location.pathname === '/index.php') {
    const rail = document.getElementById('continueWatch');
    if (rail && typeof ResizeObserver === 'function') {
      let measuredWidth = 0;
      const measure = () => {
        if (!rail.isConnected) {
          sizes.disconnect();
          return;
        }
        const width = rail.clientWidth;
        if (!width || width === measuredWidth || !rail.classList.contains('slick-initialized')) return;
        measuredWidth = width;
        const carousel = rail.slick;
        if (typeof carousel?.setPosition === 'function') carousel.setPosition();
        else window.dispatchEvent(new Event('orientationchange'));
        rail.dataset.aniContinueSized = 'true';
      };
      const sizes = new ResizeObserver(measure);
      sizes.observe(rail);
      if (!rail.classList.contains('slick-initialized')) {
        const initialization = new MutationObserver(() => {
          if (!rail.classList.contains('slick-initialized')) return;
          initialization.disconnect();
          measure();
        });
        initialization.observe(rail, { attributes: true, attributeFilter: ['class'] });
      }
      measure();
    }
  }

  // The player can remove its prompt before requesting a homepage redirect.
  function installConsentRedirectGuard() {
    if (location.pathname !== '/animeVideo.php' || !window.navigation || window.__aniConsentGuardInstalled) return;
    window.__aniConsentGuardInstalled = true;
    const agree = '.choose-btn-agree, .ani-consent-accept';
    const choice = agree + ', .choose-btn-disagree, .ani-consent-decline';
    let awaitingChoice = false;
    let handledPrompt;
    let lastHomeLinkClickAt = 0;
    let observedPlayer = null;
    const rememberPrompt = () => {
      const player = document.getElementById('ani_video');
      const prompt = player?.querySelector(agree);
      if (prompt && prompt !== handledPrompt) awaitingChoice = true;
    };
    const playerObserver = new MutationObserver(rememberPrompt);
    const attachPlayerObserver = () => {
      const player = document.getElementById('ani_video');
      if (!player || player === observedPlayer) return false;
      observedPlayer = player;
      playerObserver.disconnect();
      playerObserver.observe(player, { childList: true, subtree: true });
      rememberPrompt();
      return true;
    };
    if (!attachPlayerObserver()) {
      const rootObserver = new MutationObserver(() => {
        if (attachPlayerObserver()) rootObserver.disconnect();
      });
      rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    document.addEventListener('click', event => {
      const link = event.target?.closest?.('a[href]');
      if (event.isTrusted && link && !link.closest('#ani_video')) {
        try {
          const url = new URL(link.getAttribute('href'), location.href);
          if (url.host === location.host && ['/', '/index.php'].includes(url.pathname)) {
            lastHomeLinkClickAt = Date.now();
          }
        } catch {}
      }
      const currentPlayer = document.getElementById('ani_video');
      if (!event.isTrusted || !currentPlayer?.contains(event.target) || !event.target.closest?.(choice)) return;
      handledPrompt = currentPlayer.querySelector(agree);
      awaitingChoice = false;
    }, true);
    document.addEventListener('playing', event => {
      const currentPlayer = document.getElementById('ani_video');
      if (currentPlayer?.contains(event.target) && !currentPlayer.querySelector(agree)) awaitingChoice = false;
    }, true);
    window.navigation.addEventListener('navigate', event => {
      if (!document.body?.classList.contains('ani-ambientlight-page') ||
          !event.cancelable || event.userInitiated || event.navigationType === 'traverse') return;
      if (Date.now() - lastHomeLinkClickAt < 2000) return;
      const destination = new URL(event.destination.url);
      if (destination.host !== location.host || !['http:', 'https:'].includes(destination.protocol) ||
          !['/', '/index.php'].includes(destination.pathname)) return;
      rememberPrompt();
      if (awaitingChoice) event.preventDefault();
    });
  }
  if (location.pathname === '/animeVideo.php') {
    if (typeof GM_getValue === 'function') {
      const script = document.createElement('script');
      script.textContent = `(${installConsentRedirectGuard.toString()})();`;
      (document.head || document.documentElement).append(script);
      script.remove();
    } else {
      installConsentRedirectGuard();
    }
  }

  function installCommentImageZoom() {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const hoverTiming = { duration: 200, easing: 'cubic-bezier(.25,.7,.35,1)' };
    let preview = null;
    let previewAnim = null;
    let activeThumbnail = null;

    function clearPreview(immediate = false) {
      if (previewAnim) {
        try { previewAnim.cancel(); } catch {}
        previewAnim = null;
      }
      const node = preview;
      const thumb = activeThumbnail;
      preview = null;
      activeThumbnail = null;
      if (!node) return;
      if (immediate || motion.matches || typeof node.animate !== 'function' || !thumb?.isConnected) {
        node.remove();
        return;
      }
      const thumbRect = thumb.getBoundingClientRect();
      const boxRect = node.getBoundingClientRect();
      if (!thumbRect.width || !thumbRect.height || !boxRect.width || !boxRect.height) {
        node.remove();
        return;
      }
      const anim = node.animate(
        [
          { transformOrigin: 'top left', transform: 'none', opacity: 1 },
          {
            transformOrigin: 'top left',
            transform: `translate(${thumbRect.left - boxRect.left}px, ${thumbRect.top - boxRect.top}px) scale(${thumbRect.width / boxRect.width}, ${thumbRect.height / boxRect.height})`,
            opacity: 0,
          },
        ],
        { duration: 150, easing: 'cubic-bezier(.4,0,.6,1)' },
      );
      anim.finished.then(() => node.remove(), () => node.remove());
    }

    function openPreview(thumbnail) {
      if (activeThumbnail === thumbnail && preview?.isConnected) return;
      clearPreview(true);
      const rect = thumbnail.getBoundingClientRect();
      if (!rect.width || !rect.height || !thumbnail.naturalWidth || !thumbnail.naturalHeight || !document.body) return;
      const aspect = thumbnail.naturalWidth / thumbnail.naturalHeight;
      const scale = thumbnail.naturalHeight > thumbnail.naturalWidth ? 2.6 : 1.8;
      const maxW = Math.min(window.innerWidth - 32, Math.max(rect.width * scale, 320), 560);
      const maxH = Math.min(window.innerHeight - 32, 520);
      let width = Math.min(rect.width * scale, maxW);
      let height = width / aspect;
      if (height > maxH) {
        height = maxH;
        width = height * aspect;
      }
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      const top = Math.max(16, Math.min(rect.top, window.innerHeight - height - 16));

      const node = document.createElement('img');
      node.className = 'ani-comment-hover-zoom';
      node.src = thumbnail.currentSrc || thumbnail.src;
      node.alt = '';
      node.setAttribute('aria-hidden', 'true');
      node.style.cssText = [
        'position:fixed',
        `left:${left}px`,
        `top:${top}px`,
        `width:${width}px`,
        `height:${height}px`,
        'max-width:none',
        'max-height:none',
        'margin:0',
        'padding:0',
        'object-fit:cover',
        'border-radius:10px',
        'box-shadow:0 14px 36px rgba(0,0,0,.48)',
        'pointer-events:none',
        'z-index:2147483640',
      ].join(';');
      document.body.append(node);
      preview = node;
      activeThumbnail = thumbnail;

      if (!motion.matches && typeof node.animate === 'function') {
        previewAnim = node.animate(
          [
            {
              transformOrigin: 'top left',
              transform: `translate(${rect.left - left}px, ${rect.top - top}px) scale(${rect.width / width}, ${rect.height / height})`,
              opacity: 0.92,
            },
            { transformOrigin: 'top left', transform: 'none', opacity: 1 },
          ],
          hoverTiming,
        );
        previewAnim.finished.then(() => {
          if (preview === node) previewAnim = null;
        }, () => {});
      }
    }

    document.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse' || !document.body.classList.contains('ani-layout-comments')) return;
      const thumbnail = event.target.closest?.('#w-post-box .reply-content__cont img[data-evt-show-img]');
      if (!thumbnail?.naturalWidth) return;
      openPreview(thumbnail);
    });

    document.addEventListener('pointerout', (event) => {
      if (!activeThumbnail) return;
      const thumbnail = event.target.closest?.('#w-post-box .reply-content__cont img[data-evt-show-img]');
      if (thumbnail === activeThumbnail && !thumbnail.contains(event.relatedTarget)) {
        clearPreview(false);
      }
    });

    document.addEventListener('scroll', () => clearPreview(true), { passive: true, capture: true });

    document.addEventListener('click', (event) => {
      const thumbnail = event.target.closest?.('#w-post-box img[data-evt-show-img], #w-post-box [data-evt-show-img] img');
      // Read the painted rectangle before cancelling an in-flight hover zoom.
      const hoverRect = thumbnail && thumbnail === activeThumbnail ? preview?.getBoundingClientRect() : null;
      const hoverBounds = hoverRect?.width > 0 && hoverRect.height > 0
        ? { x: hoverRect.left, y: hoverRect.top + window.scrollY, w: hoverRect.width }
        : null;
      clearPreview(true);
      if (!document.body.classList.contains('ani-layout-comments')) return;
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
              let openingBounds = hoverBounds;
              options.getThumbBoundsFn = (activeIndex) => {
                if (activeIndex !== index) return;
                if (openingBounds) {
                  const bounds = openingBounds;
                  openingBounds = null;
                  return bounds;
                }
                if (!thumbnail.isConnected) return;
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

  function installReviewEvents() {
    if (window.aniReviewEventsInstalled) return;
    document.addEventListener('ani-review-request-profile', () => {
      const account = window.User?.Login;
      const userId = account?.getUserid?.();
      if (!userId) return;
      const name = window.Cookies?.get?.('BAHANICK') || userId;
      const rawAvatar = account.getAvatarUrl?.() || '';
      const avatar = rawAvatar.startsWith('//') ? 'https:' + rawAvatar : rawAvatar;
      document.dispatchEvent(new CustomEvent('ani-review-profile', {
        detail: JSON.stringify({ name, avatar }),
      }));
    });
    const jquery = window.jQuery;
    if (typeof jquery !== 'function') return;
    window.aniReviewEventsInstalled = true;
    jquery(window).on('AcgScorePostNew.aniRedesign AcgScorePostEdit.aniRedesign', (_event, review) => {
      if (typeof review?.content === 'string') {
        document.dispatchEvent(new CustomEvent('ani-review-saved', { detail: review.content }));
      }
    });
  }
  if (location.pathname === '/animeVideo.php') {
    if (typeof GM_getValue === 'function' && typeof window.jQuery !== 'function') {
      const script = document.createElement('script');
      script.textContent = `(${installReviewEvents.toString()})();`;
      (document.head || document.documentElement).append(script);
      script.remove();
    } else {
      installReviewEvents();
    }
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
