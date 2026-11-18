(function mountIntro() {
  if(window.self!==window.top)return;
  const root = document.documentElement;
  if (!root) {
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      mountIntro();
    });
    observer.observe(document, {childList: true});
    return;
  }
  if (root.querySelector(':scope > .ani-home-intro')) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reload = performance.getEntriesByType?.('navigation')[0]?.type === 'reload';
  try{const font=localStorage.getItem('aniIntroFontHint')||sessionStorage.getItem('aniIntroFont');if(font)root.style.setProperty('--ani-font',font);}catch{}
  const fontUrls={sans:'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=block',serif:'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&display=block',wenkai:'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@300;400;700&display=block',chironHei:'https://fonts.googleapis.com/css2?family=Chiron+Hei+HK:wght@400;500;700&display=block',chironSung:'https://fonts.googleapis.com/css2?family=Chiron+Sung+HK:wght@400;600;700&display=block',iansui:'https://fonts.googleapis.com/css2?family=Iansui&display=block'};
  const ensureLink=(id,rel,href,crossOrigin)=>{let el=document.getElementById(id);if(el)return el;el=document.createElement('link');el.id=id;el.rel=rel;el.href=href;if(crossOrigin)el.crossOrigin=crossOrigin;(document.head||root).append(el);return el;};
  ensureLink('ani-gf-preconnect-1','preconnect','https://fonts.googleapis.com');
  ensureLink('ani-gf-preconnect-2','preconnect','https://fonts.gstatic.com','anonymous');
  try{const hintUrl=localStorage.getItem('aniFontUrlHint');if(hintUrl)ensureLink('ani-intro-font','stylesheet',hintUrl.replace('display=swap','display=block'));}catch{}
  try {
    const internal = document.referrer && new URL(document.referrer).origin === location.origin;
    if (internal && !reload) {
      const cover = document.createElement('div');
      cover.className = 'ani-route-cover';
      cover.setAttribute('aria-hidden', 'true');
      root.append(cover);
      const finish = () => {
        cover.classList.add('ani-route-visible');
        setTimeout(() => cover.remove(), 200);
      };
      if (root.dataset.aniUiReady) finish();
      else window.addEventListener('ani-ui-ready', finish, {once:true});
      setTimeout(() => { if (cover.isConnected) finish(); }, 2000);
      return;
    }
  } catch {}
  root.dataset.aniBooting='true';
  const curtain=document.createElement('div');curtain.className='ani-home-intro';curtain.setAttribute('aria-hidden','true');
  const plate=document.createElement('div');plate.className='ani-intro-plate';const logo=document.createElement('div');logo.className='ani-intro-logo';logo.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 516 200\" role=\"img\" aria-label=\"動畫瘋\"><style>.ani-logo-c1{fill:#d15e7d;}.ani-logo-c1,.ani-logo-c2,.ani-logo-c3,.ani-logo-c4,.ani-logo-c5,.ani-logo-c6,.ani-logo-c7,.ani-logo-c8{stroke-width:0px;}.ani-logo-c1,.ani-logo-c3,.ani-logo-c7{fill-rule:evenodd;}.ani-logo-c2{fill:#ef9b3f;}.ani-logo-c3{fill:#ea7b94;}.ani-logo-c4{fill:#0094a8;}.ani-logo-c5{fill:#d37f2d;}.ani-logo-c9{opacity:.95;}.ani-logo-c6{fill:#00b4d8;}.ani-logo-c7,.ani-logo-c8{fill:#fff;}</style><g transform=\"translate(.3) scale(.52)\"><g class=\"ani-logo-letter ani-logo-letter-1\"><rect class=\"ani-logo-c4\" x=\"18.5\" y=\"47.99\" width=\"320\" height=\"320\" rx=\"11\" ry=\"11\" /><rect class=\"ani-logo-c6\" x=\"0\" y=\"29.5\" width=\"320\" height=\"320\" rx=\"11\" ry=\"11\" /><g class=\"ani-logo-c9 ani-logo-ink\"><rect class=\"ani-logo-c8\" x=\"37.68\" y=\"65.85\" width=\"156.64\" height=\"13.7\" rx=\"2\" ry=\"2\" /><rect class=\"ani-logo-c8\" x=\"24.08\" y=\"104.79\" width=\"170.24\" height=\"13.93\" rx=\"2\" ry=\"2\" /><rect class=\"ani-logo-c8\" x=\"198.5\" y=\"114.39\" width=\"99.89\" height=\"13.93\" rx=\"2\" ry=\"2\" /><path class=\"ani-logo-c7\" d=\"M104.85,304.5V78.8c0-1.1.9-2,2-2h14.43c1.1,0,2,.9,2,2v225.7c0,1.1-.9,2-2,2h-14.43c-1.1,0-2-.9-2-2Z\" /><polygon class=\"ani-logo-c7\" points=\"213.9 349.5 213.9 29.5 232.32 29.5 232.32 349.5 213.9 349.5\" /><path class=\"ani-logo-c7\" d=\"M45.07,229.94v-86.68c0-1.1.9-2,2-2h14.43c1.1,0,2,.9,2,2v86.68c0,1.1-.9,2-2,2h-14.43c-1.1,0-2-.9-2-2Z\" /><path class=\"ani-logo-c7\" d=\"M164.64,229.94v-86.68c0-1.1.9-2,2-2h14.43c1.1,0,2,.9,2,2v86.68c0,1.1-.9,2-2,2h-14.43c-1.1,0-2-.9-2-2Z\" /><rect class=\"ani-logo-c8\" x=\"45.07\" y=\"141.26\" width=\"138\" height=\"13.93\" rx=\"2\" ry=\"2\" /><rect class=\"ani-logo-c8\" x=\"45.07\" y=\"181.46\" width=\"138\" height=\"13.93\" rx=\"2\" ry=\"2\" /><rect class=\"ani-logo-c8\" x=\"45.07\" y=\"221.65\" width=\"138\" height=\"13.93\" rx=\"2\" ry=\"2\" /><rect class=\"ani-logo-c8\" x=\"39.94\" y=\"259.8\" width=\"144.25\" height=\"13.93\" rx=\"2\" ry=\"2\" /><path class=\"ani-logo-c7\" d=\"M188.52,306.85l-162.83,22.11c-1.11.15-2.08-.73-2.05-1.85v-11.01c.03-.96.78-1.7,1.74-1.76,23.97-1.42,144.54-18.89,161.3-21.28,1-.14,1.92.56,2.05,1.56l1.35,10.2c.13.99-.57,1.9-1.56,2.04Z\" /><path class=\"ani-logo-c7\" d=\"M281.8,119.34c-1.01,0-1.83.82-1.81,1.83.21,15.89,1.71,129.99,1.25,147.05-.51,18.71-10.79,33.48-24.78,34.57-.94.07-1.68.85-1.68,1.8v14.23c0,1.04.87,1.86,1.91,1.81,21.8-.9,41.7-17.27,41.7-52.42V121.16c0-1-.81-1.81-1.81-1.81h-14.77Z\" /></g></g><g class=\"ani-logo-letter ani-logo-letter-2\"><rect class=\"ani-logo-c5\" x=\"333.04\" y=\"18.5\" width=\"320\" height=\"320\" rx=\"11\" ry=\"11\" /><rect class=\"ani-logo-c2\" x=\"314.54\" y=\"0\" width=\"320\" height=\"320\" rx=\"11\" ry=\"11\" /><g class=\"ani-logo-c9 ani-logo-ink\"><rect class=\"ani-logo-c8\" x=\"369.34\" y=\"32.46\" width=\"210.41\" height=\"13.93\" rx=\"2.2\" ry=\"2.2\" /><rect class=\"ani-logo-c8\" x=\"329.67\" y=\"63.65\" width=\"289.74\" height=\"13.93\" rx=\"2.05\" ry=\"2.05\" /><rect class=\"ani-logo-c8\" x=\"362.62\" y=\"95.74\" width=\"223.84\" height=\"13.93\" rx=\"2.2\" ry=\"2.2\" /><rect class=\"ani-logo-c8\" x=\"362.62\" y=\"126.48\" width=\"223.84\" height=\"13.93\" rx=\"2.08\" ry=\"2.08\" /><rect class=\"ani-logo-c8\" x=\"340.06\" y=\"157.22\" width=\"267.19\" height=\"13.93\" rx=\"2.1\" ry=\"2.1\" /><rect class=\"ani-logo-c8\" x=\"329.67\" y=\"281.93\" width=\"289.74\" height=\"13.93\" rx=\"2.07\" ry=\"2.07\" /><polygon class=\"ani-logo-c7\" points=\"463.22 170.16 463.22 0 481.64 0 481.64 170.16 463.22 170.16\" /><path class=\"ani-logo-c7\" d=\"M568.04,108.51V33.62c0-.64.52-1.16,1.16-1.16h16.11c.64,0,1.16.52,1.16,1.16v74.89c0,.64-.52,1.16-1.16,1.16h-16.11c-.64,0-1.16-.52-1.16-1.16Z\" /><rect class=\"ani-logo-c8\" x=\"368.76\" y=\"187.08\" width=\"211.56\" height=\"13.93\" rx=\"2.14\" ry=\"2.14\" /><rect class=\"ani-logo-c8\" x=\"368.76\" y=\"219.57\" width=\"211.56\" height=\"13.93\" rx=\"2.14\" ry=\"2.14\" /><rect class=\"ani-logo-c8\" x=\"368.76\" y=\"252.07\" width=\"211.56\" height=\"13.93\" rx=\"2.14\" ry=\"2.14\" /><path class=\"ani-logo-c7\" d=\"M463.22,264v-72.3c0-1.1.9-2,2-2h14.43c1.1,0,2,.9,2,2v72.3c0,1.1-.9,2-2,2h-14.43c-1.1,0-2-.9-2-2Z\" /><path class=\"ani-logo-c7\" d=\"M362.62,263.96v-74.85c0-1.12.91-2.03,2.03-2.03h14.36c1.12,0,2.03.91,2.03,2.03v74.85c0,1.12-.91,2.03-2.03,2.03h-14.36c-1.12,0-2.03-.91-2.03-2.03Z\" /><path class=\"ani-logo-c7\" d=\"M568.04,263.96v-74.85c0-1.12.91-2.03,2.03-2.03h14.36c1.12,0,2.03.91,2.03,2.03v74.85c0,1.12-.91,2.03-2.03,2.03h-14.36c-1.12,0-2.03-.91-2.03-2.03Z\" /></g></g><g class=\"ani-logo-letter ani-logo-letter-3\"><path class=\"ani-logo-c1\" d=\"M983.81,344.57l-295.2,40.77c-6.02.83-11.57-3.37-12.4-9.39l-40.77-295.2c-.83-6.02,3.37-11.57,9.39-12.4l295.2-40.77c6.02-.83,11.57,3.37,12.4,9.39l40.77,295.2c.83,6.02-3.37,11.57-9.39,12.4Z\" /><path class=\"ani-logo-c3\" d=\"M962.95,328.78l-295.2,40.77c-6.02.83-11.57-3.37-12.4-9.39l-40.77-295.2c-.83-6.02,3.37-11.57,9.39-12.4L919.17,11.79c6.02-.83,11.57,3.37,12.4,9.39l40.77,295.2c.83,6.02-3.37,11.57-9.39,12.4Z\" /><g class=\"ani-logo-c9 ani-logo-ink\"><path class=\"ani-logo-c7\" d=\"M916.64,57.37l-244.78,33.81c-1.09.15-2.1-.61-2.25-1.71l-1.36-9.84c-.15-1.09.61-2.1,1.71-2.25l244.78-33.81c1.09-.15,2.1.61,2.25,1.71l1.36,9.84c.15,1.09-.61,2.1-1.71,2.25Z\" /><path class=\"ani-logo-c7\" d=\"M686.14,161.81l-42.86-17.44c-.61-.25-1.04-.81-1.12-1.46l-1.44-11.71c-.17-1.37,1.2-2.42,2.48-1.9l42.37,17.24c.59.24,1.01.77,1.11,1.39l1.93,11.91c.23,1.4-1.16,2.5-2.47,1.97Z\" /><path class=\"ani-logo-c7\" d=\"M661.19,260.78l36.53-28.4c.52-.4.78-1.06.68-1.71l-1.79-11.66c-.21-1.37-1.81-2.01-2.91-1.16l-36.11,28.08c-.5.39-.76,1.01-.69,1.64l1.37,11.99c.16,1.41,1.8,2.1,2.92,1.23Z\" /><path class=\"ani-logo-c7\" d=\"M893.49,96.71l-175.2,24.2c-1.09.15-2.1-.61-2.25-1.71l-1.36-9.84c-.15-1.09.61-2.1,1.71-2.25l175.2-24.2c1.09-.15,2.1.61,2.25,1.71l1.36,9.84c.15,1.09-.61,2.1-1.71,2.25Z\" /><path class=\"ani-logo-c7\" d=\"M669.71,77.41c-1,.14-1.7,1.07-1.55,2.07,2.38,15.71,26.76,181.25,28.64,198.21,2.06,18.6-6.11,34.64-19.82,37.64-.93.2-1.54,1.08-1.41,2.01l1.95,14.1c.14,1.03,1.12,1.72,2.14,1.54,21.47-3.87,38.95-22.81,34.14-57.64l-27.4-198.4c-.14-.99-1.05-1.69-2.05-1.55l-14.64,2.02Z\" /><path class=\"ani-logo-c7\" d=\"M917.08,313.88l-31.78-230.08,16.29-2.25c1.08-.15,2.08.61,2.23,1.69l31.51,228.12c.15,1.08-.61,2.08-1.69,2.23l-14.33,1.98c-1.08.15-2.08-.61-2.23-1.69Z\" /><path class=\"ani-logo-c7\" d=\"M749.01,358.34l-34.39-248.96c-.15-1.09.61-2.1,1.7-2.25l14.3-1.98c1.09-.15,2.1.61,2.25,1.7l34.39,248.96-18.25,2.52Z\" /><path class=\"ani-logo-c7\" d=\"M887.49,316.58l-27.87-52.74c-.55-1.05.03-2.34,1.19-2.61l10.34-2.45c.8-.19,1.64.19,2.02.92l26.84,50.78c.48.91.11,2.04-.83,2.49l-9.31,4.41c-.88.42-1.93.07-2.38-.79Z\" /><path class=\"ani-logo-c7\" d=\"M828.84,302.21l-23.06-166.96c-.15-1.09.61-2.1,1.71-2.25l14.29-1.97c1.09-.15,2.1.61,2.25,1.71l23.06,166.96c.15,1.09-.61,2.1-1.71,2.25l-14.29,1.97c-1.09.15-2.1-.61-2.25-1.71Z\" /><path class=\"ani-logo-c8\" d=\"M759.66,141.16l1.41,10.21c.14.99,1.05,1.69,2.05,1.55,23.59-3.33,53.13-7.91,79.12-14.32,9.87-2.44,18.47-4.89,24.72-7.2.8-.3,1.29-1.11,1.17-1.95l-1.34-11.12c-.16-1.15-1.32-1.85-2.41-1.46-27.7,9.91-64.01,17.22-103.18,22.26-.99.13-1.68,1.05-1.54,2.04Z\" /><path class=\"ani-logo-c8\" d=\"M779.9,306.43l1.41,10.2c.14,1,1.06,1.69,2.05,1.55,22.99-3.25,46.06-7.92,72.04-14.34,9.87-2.44,18.47-4.89,24.72-7.2.8-.3,1.29-1.11,1.17-1.95l-1.4-10.12c-.16-1.15-1.33-1.85-2.42-1.45-22.42,8.26-64.27,16.78-96.04,21.26-.99.14-1.68,1.05-1.54,2.04Z\" /><path class=\"ani-logo-c7\" d=\"M868.94,178.76l-94.91,13.11c-1.09.15-2.1-.61-2.25-1.71l-1.36-9.84c-.15-1.09.61-2.1,1.71-2.25l94.91-13.11c1.09-.15,2.1.61,2.25,1.71l1.36,9.84c.15,1.09-.61,2.1-1.71,2.25Z\" /><path class=\"ani-logo-c7\" d=\"M877.47,240.54l-94.91,13.11c-1.09.15-2.1-.61-2.25-1.71l-1.36-9.84c-.15-1.09.61-2.1,1.71-2.25l94.91-13.11c1.09-.15,2.1.61,2.25,1.71l1.36,9.84c.15,1.09-.61,2.1-1.71,2.25Z\" /><path class=\"ani-logo-c7\" d=\"M780.31,251.94l-9.89-71.62c-.15-1.09.61-2.1,1.71-2.25l14.29-1.97c1.09-.15,2.1.61,2.25,1.71l9.89,71.62c.15,1.09-.61,2.1-1.71,2.25l-14.29,1.97c-1.09.15-2.1-.61-2.25-1.71Z\" /><path class=\"ani-logo-c7\" d=\"M860.83,240.82l-9.89-71.62c-.15-1.09.61-2.1,1.71-2.25l14.29-1.97c1.09-.15,2.1.61,2.25,1.71l9.89,71.62c.15,1.09-.61,2.1-1.71,2.25l-14.29,1.97c-1.09.15-2.1-.61-2.25-1.71Z\" /><polygon class=\"ani-logo-c7\" points=\"783.72 75.35 774.55 31.76 792.81 29.24 801.97 72.83 783.72 75.35\" /><path class=\"ani-logo-c7\" d=\"M971.24,308.38l-44.4,6.13c-1.09.15-2.1-.61-2.25-1.71l-1.36-9.84c-.15-1.09.61-2.1,1.71-2.25l44.4-6.13,1.91,13.8Z\" /></g></g></g></svg>";const caption=document.createElement('span');caption.className='ani-intro-caption';caption.textContent='Redesign 3.0';const credit=document.createElement('small');credit.className='ani-intro-credit';credit.textContent='（此版本為 秋夜 AuNight 設計版本）';plate.append(logo,caption,credit);curtain.append(plate);
  const svg = logo.firstElementChild;
  const layers = [...svg.querySelectorAll('.ani-logo-letter')].map((letter, index) => {
    const layer = document.createElement('span');
    layer.className = 'ani-logo-layer ani-logo-layer-' + (index + 1);
    const artwork = svg.cloneNode(false);
    artwork.append(svg.querySelector('style').cloneNode(true));
    const group = letter.parentNode.cloneNode(false);
    group.append(letter);
    artwork.append(group);
    layer.append(artwork);
    return layer;
  });
  logo.replaceChildren(...layers);
  root.append(curtain);
  let done = false;
  let ready = document.readyState !== 'loading' || Boolean(root.dataset.aniUiReady);
  let firstFrame = 0;
  let fontSettled = false;
  const frame = window.requestAnimationFrame?.bind(window) || (fn => setTimeout(fn, 16));
  function reveal() {
    if (done) return;
    done = true;
    clearTimeout(deadline);
    try { sessionStorage.setItem('aniIntroPlayed', '1'); } catch {}
    delete root.dataset.aniBooting;
    curtain.classList.add('ani-intro-reveal');
    if (reduced) curtain.remove();
    else {
      const remove = event => {
        if (event.target === curtain && event.propertyName === 'opacity') curtain.remove();
      };
      curtain.addEventListener('transitionend', remove);
      setTimeout(() => curtain.remove(), 650);
    }
  }
  function finishWhenReady() {
    if (!ready || !firstFrame || !fontSettled || done) return;
    setTimeout(reveal, Math.max(0, firstFrame + (reduced ? 0 : 850) - performance.now()));
  }
  function settled() {
    ready = true;
    finishWhenReady();
  }
  const deadline = setTimeout(reveal, reduced ? 900 : 2000);
  frame(() => {
    firstFrame = performance.now();
    finishWhenReady();
  });
  document.addEventListener('DOMContentLoaded', settled, {once: true});
  window.addEventListener('ani-ui-ready', settled, {once: true});
  async function settings(saved) {
    if (saved.themeEnabled === false) { reveal(); curtain.remove(); return; }
    const families = {sans:'Noto Sans TC', serif:'Noto Serif TC', wenkai:'LXGW WenKai TC', chironHei:'Chiron Hei HK', chironSung:'Chiron Sung HK', iansui:'Iansui'};
    const choice = saved.fontFamily || 'sans';
    const name = choice === 'custom' ? saved.customFontName : families[choice];
    const url = fontUrls[choice] || (name && saved.customFontGoogle
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}&display=block` : null);
    if (name) {
      const family = JSON.stringify(name);
      const stack = family + ',system-ui,sans-serif';
      curtain.style.setProperty('--ani-font', stack);
      if (url && document.fonts) {
        let link = document.getElementById('ani-intro-font');
        if (link && link.getAttribute('href') !== url) { link.remove(); link = null; }
        if (!link) link = ensureLink('ani-intro-font', 'stylesheet', url);
        try {
          if (!link.sheet) await new Promise((resolve, reject) => {
            link.addEventListener('load', resolve, {once:true});
            link.addEventListener('error', reject, {once:true});
          });
          await Promise.all([caption, credit].map(async element => {
            const weight = element === caption ? 600 : 400;
            const faces = await document.fonts.load(weight + ' 16px ' + family, element.textContent);
            if (!faces.length) throw new Error('Font unavailable');
          }));
        } catch {
          // The logo and the page can still open when the selected face is unavailable.
          fontSettled = true;
          finishWhenReady();
          return;
        }
      }
    }
    curtain.classList.add('ani-intro-font-ready');
    fontSettled = true;
    finishWhenReady();
  }
  if(globalThis.chrome?.storage?.sync)chrome.storage.sync.get({themeEnabled:true,fontFamily:'sans',customFontName:'',customFontGoogle:false},settings);
  else if(typeof GM_getValue==='function')Promise.resolve(GM_getValue('aniAmbientSettingsV1',{})).then(settings).catch(reveal);
  else settings({});
  window.addEventListener('pageshow',event=>{if(event.persisted)reveal();});
})();
