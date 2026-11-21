const favoriteStudioPrefix = 'ani-favorite-studio:';
const studioCatalogData = STUDIO_CATALOG_DATA;
const studioProfileData = STUDIO_PROFILE_DATA;
const studioDirectoryIcons = STUDIO_DIRECTORY_ICON_DATA;

function studioAliasLabel(alias) {
  return (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(alias) ? '日文名：' : '常稱：') + alias;
}
const studioRepresentativeTitles = {
  ufotable: ['鬼滅之刃', 'Fate/stay night [Unlimited Blade Works]'],
  'A-1 Pictures': ['刀劍神域', '輝夜姬想讓人告白'],
  'WHITE FOX': ['命運石之門', 'Re:從零開始的異世界生活'],
  MADHOUSE: ['一拳超人 第一季', '葬送的芙莉蓮'],
  'Kyoto Animation': ['K-ON！輕音部', '紫羅蘭永恆花園'],
  MAPPA: ['咒術迴戰', '鏈鋸人'],
  'J.C.STAFF': ['科學超電磁砲', '食戟之靈'],
  CloverWorks: ['孤獨搖滾！', 'SPY×FAMILY 間諜家家酒'],
  '8-bit': ['關於我轉生變成史萊姆這檔事', '藍色監獄'],
  'WIT STUDIO': ['進擊的巨人（前三季）', '海盜戰記（第一季）'],
  bones: ['鋼之鍊金術師 BROTHERHOOD', '路人超能100'],
  'Doga Kobo': ['【我推的孩子】', '輕鬆百合'],
  'Studio Pierrot': ['火影忍者', 'BLEACH 死神'],
  WolfsBane: ['彼得・格里爾的賢者時間', '快藏好！瑪琪娜同學!!'],
};
const studioLogosNeedingLightContrast = new Set([
  'A-1 Pictures', 'MAPPA', '8-bit', 'WIT STUDIO', 'bones', 'Doga Kobo', 'Studio Pierrot', 'Actas',
]);
const normalizeStudioName = name => name.normalize('NFKC').toLowerCase().replace(/[\s.]+/g, '');
const studioDisplayNames = new Map([
  ['Doga Kobo', '動畫工房'],
]);
const studioDisplayName = name => studioDisplayNames.get(name) || name;
let studioNamesByAlias;

function catalogStudiosForEpisode(sn, title) {
  const work = studioCatalogData.find(([id, videoSn]) => id === sn || videoSn === sn)
    || studioCatalogData.find(([, , workTitle]) => title && workTitle === title);
  return work?.at(-1).join(' / ') || '';
}

function studioCreditLinks(value) {
  if (!studioNamesByAlias) {
    studioNamesByAlias = new Map();
    for (const name of new Set(studioCatalogData.flatMap(work => work.at(-1)))) {
      studioNamesByAlias.set(normalizeStudioName(name), name);
      studioNamesByAlias.set(normalizeStudioName(studioDisplayName(name)), name);
      for (const alias of (studioProfileData[name]?.[0] || '').split('、')) {
        if (alias.trim()) studioNamesByAlias.set(normalizeStudioName(alias), name);
      }
    }
  }
  const canonical = studioNamesByAlias.get(normalizeStudioName(value));
  const parts = canonical ? [value] : value.split(/(\s*[×✕、／]\s*|\s+\/\s+)/u);
  return parts.map((label, index) => {
    if (index % 2 || !label.trim()) return { label };
    const name = canonical || studioNamesByAlias.get(normalizeStudioName(label)) || label.trim();
    return { label: studioDisplayName(name) === name ? label : studioDisplayName(name), href: '/animeList.php?studio=' + encodeURIComponent(name) };
  });
}
const studioIconPaths = {
  explore: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="m8 3 4 4 4-4m-6 8 5 3-5 3Z"/>',
  studio: '<circle cx="10" cy="8" r="4"/><path d="M2 21v-2a8 8 0 0 1 16 0v2M17 5a4 4 0 0 1 0 7m2 3q3 1 3 5"/>',
};

function studioIcon(path) {
  const span = document.createElement('span');
  span.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  return span.firstChild;
}

function savedStudioNames() {
  return Object.keys(localStorage)
    .filter(key => key.startsWith(favoriteStudioPrefix) && localStorage.getItem(key) === '1')
    .map(key => key.slice(favoriteStudioPrefix.length))
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

function mountStudioCatalog(host, enhanceCards, loadMetadata, {favoritesOnly = false} = {}) {
  if (!host || host.classList.contains('ani-studio-explore')) return;
  const toolbar = host.querySelector(favoritesOnly ? ':scope > .theme-title-block' : ':scope > .filter-title-block');
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const paths = {
    ...studioIconPaths,
    play:'<path d="M8 5v14l12-7z" fill="currentColor" stroke="none"/>',
    more:'<path d="M12 5v14M5 12h14"/>',
    all:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    views:'<path d="M5 19v-6m7 6V5m7 14v-9"/>',
    score:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/>',
    date:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16"/>'
  };
  function icon(key) {
    return studioIcon(paths[key]);
  }
  function segmented(options, initial, change) {
    const group = el('div','ani-catalog-sort');
    group.setAttribute('role','group');
    group.setAttribute('aria-label',options.length === 2 ? '動畫分類' : '作品排序');
    for (const [label,key] of options) {
      const btn = el('button');
      btn.type = 'button';
      btn.append(icon(key),label);
      btn.setAttribute('aria-pressed',String(label===initial));
      btn.onclick = () => {
        for (const item of group.children) item.setAttribute('aria-pressed',String(item===btn));
        change(label);
      };
      group.append(btn);
    }
    return group;
  }
  const shell = el('nav','ani-studio-shell');
  const panel = el('section','ani-studio-panel');
  panel.hidden = true;
  panel.classList.toggle('ani-favorite-studios', favoritesOnly);
  const [animeLabel, studioLabel] = favoritesOnly ? ['收藏動畫', '收藏製作組'] : ['探索動畫', '製作組動畫'];
  const savedView = history.state?.aniStudioView;
  const pageSize = 12;
  let visibleCount = pageSize;
  let studioSelection = savedView?.selection;
  let studioQuery = savedView?.query || '';
  let studioScrollTop = savedView?.top;
  const railPositions = new Map(Object.entries(savedView?.rails || {}));
  let rememberScrollTimer;
  let savedSnapshot;
  let disconnectPanelObservers;
  const decodedCovers = new Set();
  function finishCoverFades() {
    for (const placeholder of panel.querySelectorAll('.ani-studio-cover-placeholder.is-decoded')) {
      placeholder.remove();
    }
  }
  function render() {
    const favorites = savedStudioNames();
    const snapshot = JSON.stringify(favorites);
    if (panel.hidden || (panel.childElementCount && snapshot === savedSnapshot)) return;
    const firstBuild = savedSnapshot === undefined;
    const paddingBottom = panel.style.paddingBottom;
    savedSnapshot = snapshot;
    disconnectPanelObservers?.();
    panel.replaceChildren();
    disconnectPanelObservers = build(favorites, firstBuild ? requestedStudio : null);
    panel.style.paddingBottom = paddingBottom;
  }
  function rememberStudioPosition(leaving = false) {
    const navigationBottom = document.querySelector('.top_sky')?.getBoundingClientRect().bottom || 0;
    // Scrolling back to the tabs to switch views should not replace the reading position.
    if (shell.getBoundingClientRect().bottom <= navigationBottom || (leaving && studioScrollTop === undefined)) {
      studioScrollTop = window.scrollY;
    }
  }
  window.addEventListener('scroll', () => {
    if (panel.hidden) return;
    clearTimeout(rememberScrollTimer);
    rememberScrollTimer = setTimeout(() => rememberStudioPosition(), 180);
  }, {passive:true});
  panel.addEventListener('scroll', event => {
    if (!event.target.matches?.('.theme-list-block')) return;
    const name = event.target.closest('.ani-studio-row')?.dataset.studio;
    if (name) railPositions.set(name, event.target.scrollLeft);
  }, {capture:true, passive:true});
  function saveStudioView(top = studioScrollTop) {
    history.replaceState({...history.state, aniStudioView:{
      active:!panel.hidden, top, selection:studioSelection, query:studioQuery,
      rails:Object.fromEntries(railPositions),
    }}, '');
  }
  window.addEventListener('pagehide', () => saveStudioView(panel.hidden ? studioScrollTop : window.scrollY));
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith(favoriteStudioPrefix)) render();
  });
  window.addEventListener('pageshow', render);
  host.classList.add('ani-studio-explore');
  if (favoritesOnly && toolbar) toolbar.classList.add('ani-collection-studio-toolbar');
  if (toolbar) toolbar.prepend(shell);
  else host.before(shell);
  host.after(panel);
  shell.append(segmented([[animeLabel,'explore'],[studioLabel,'studio']], animeLabel, label => {
    const active = label===studioLabel;
    if (active === !panel.hidden) return;
    if (!active) {
      clearTimeout(rememberScrollTimer);
      rememberStudioPosition(true);
      finishCoverFades();
    }
    panel.hidden = !active;
    // Populate the destination before the browser can paint the switched view.
    if (active) render();
    host.classList.toggle(toolbar ? 'ani-studio-showing' : 'ani-explore-inactive', active);
    if (active && studioScrollTop !== undefined) {
      window.scrollTo({top:studioScrollTop, behavior:'instant'});
    }
    saveStudioView();
  }));
  const requestedStudio = favoritesOnly || savedView ? null : new URLSearchParams(location.search).get('studio');
  if (requestedStudio || savedView?.active) shell.querySelector('button:last-child').click();
  function build(favorites, initialStudio) {
    const logos=STUDIO_LOGO_DATA;
    const groups=new Map();
    for (const [id,sn,title,date,views,episodes,cover,tags,names] of studioCatalogData) {
      const work={id,sn,title,date,views,episodes,cover,tags,popularity:parseFloat(views.replaceAll(',',''))*(views.includes('億')?1e8:views.includes('萬')?1e4:1)};
      for (const name of names) {
        if (!groups.has(name)) groups.set(name,[]);
        groups.get(name).push(work);
      }
    }
    const featured = [...new Set(favoritesOnly ? favorites : [
      ...favorites, 'ufotable', 'A-1 Pictures', 'WHITE FOX', 'MADHOUSE', 'Kyoto Animation', 'MAPPA',
      'J.C.STAFF', 'CloverWorks', '8-bit', 'WIT STUDIO', 'bones', 'Doga Kobo', 'Studio Pierrot'
    ])].filter(name => groups.has(name));
    if (favoritesOnly && !featured.length) {
      panel.append(el('p', 'ani-studio-no-results', '尚未收藏製作組'));
      return;
    }
    const railTitle = favoritesOnly ? '收藏製作組' : '熱門製作組';
    const featuredHeader = el('div', 'ani-studio-featured-header');
    featuredHeader.append(el('h2', 'theme-title', railTitle));
    const viewport = el('div', 'ani-studio-features');
    const features = el('div', 'ani-studio-feature-track');
    viewport.append(features);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const rail = el('div', 'ani-studio-feature-rail');
    rail.append(viewport);
    function scrollButton(direction, label) {
      const button = el('button');
      button.type = 'button';
      button.className = 'ani-rail-arrow ' + (direction < 0 ? 'ani-rail-prev' : 'ani-rail-next');
      button.setAttribute('aria-label', label);
      button.append(studioIcon(direction < 0 ? '<path d="m14 6-6 6 6 6"/>' : '<path d="m10 6 6 6-6 6"/>'));
      button.onclick = () => viewport.scrollBy({
        left: direction * viewport.clientWidth * .8,
        behavior: reducedMotion.matches ? 'instant' : 'smooth'
      });
      rail.append(button);
      return button;
    }
    const previous = scrollButton(-1, '向左滑動' + railTitle);
    const next = scrollButton(1, '向右滑動' + railTitle);
    function updateArrows() {
      const limit = viewport.scrollWidth - viewport.clientWidth;
      previous.disabled = viewport.scrollLeft <= 1;
      next.disabled = viewport.scrollLeft >= limit - 1;
    }
    viewport.addEventListener('scroll', updateArrows, {passive:true});
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(viewport);
    resizeObserver.observe(features);
    panel.append(featuredHeader, rail);
    const rows=new Map();
    const knownScores=new Map();
    const template=el('template');
    template.innerHTML='<a class="theme-list-main"><div class="theme-img-block"><img loading="lazy" class="theme-img" alt=""><div class="btn-card-block btn-favorite btn-not-active"></div></div><div class="anime-detail-block"><div class="anime-tag-row"><div class="anime-label-block"></div><div class="show-view-number"><i class="pic-eye-style material-icons">remove_red_eye</i><p></p></div></div><div class="theme-info-block"><p class="theme-name"></p><div class="theme-detail-info-block"><p class="theme-time"></p><span class="theme-number"></span></div></div></div></a>';
    function makeCard(w) {
      const card=template.content.firstElementChild.cloneNode(true);
      card.href='animeRef.php?sn='+w.sn;
      const image = card.querySelector('img');
      const placeholder = el('span', 'ani-studio-cover-placeholder');
      placeholder.setAttribute('aria-hidden', 'true');
      image.after(placeholder);
      image.decoding = 'async';
      function showUnavailableCover() {
        placeholder.classList.add('is-unavailable');
        placeholder.append(icon('explore'));
      }
      image.addEventListener('load', async () => {
        try {
          await image.decode();
        } catch {
          showUnavailableCover();
          return;
        }
        const firstDecode = !decodedCovers.has(w.cover);
        decodedCovers.add(w.cover);
        if (!firstDecode || reducedMotion.matches || !card.isConnected || card.closest('[hidden]')) {
          placeholder.remove();
        } else {
          placeholder.classList.add('is-decoded');
          placeholder.animate([{opacity:1}, {opacity:0}], {
            duration:240, easing:'ease-out', fill:'forwards'
          }).onfinish = () => placeholder.remove();
        }
      }, {once:true});
      image.addEventListener('error', showUnavailableCover, {once:true});
      if (w.cover) {
        image.src = w.cover;
        if (decodedCovers.has(w.cover) && image.complete && image.naturalWidth) placeholder.remove();
      } else {
        showUnavailableCover();
      }
      card.querySelector('.theme-name').textContent=w.title;
      card.querySelector('.theme-time').textContent=w.date;
      card.querySelector('.theme-number').textContent=w.episodes;
      card.querySelector('.show-view-number p').textContent=w.views;
      card.querySelector('.btn-favorite').setAttribute('onclick',`animefun.toggleGather(${Number(w.id)}, ${Number(w.sn)}, $(this), "btn-is-active"); return false;`);
      for (const tag of w.tags) card.querySelector('.anime-label-block').append(el('span','label-edition',tag));
      return card;
    }
    const profiles = new Map(Object.entries(studioProfileData));
    function studioMark(name) {
      const mark = el('span', 'ani-studio-mark');
      mark.setAttribute('aria-hidden', 'true');
      const words = name.match(/[\p{L}\p{N}]+/gu) || [];
      const initials = words.length > 1
        ? words.slice(0, 2).map(word => Array.from(word)[0]).join('')
        : Array.from(words[0] || name).slice(0, 2).join('');
      const fallback = el('span', 'ani-studio-mark-fallback', initials.toUpperCase());
      mark.append(fallback);
      const logo = logos[name];
      const entry = studioDirectoryIcons[name];
      if (logo || entry) {
        const image = el('img', 'ani-studio-favicon');
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('load', () => {
          if (image.naturalWidth >= 12 && image.naturalHeight >= 12) fallback.remove();
        });
        mark.append(image);
        if (entry?.wide || name === 'Ascension' || name === 'Asread') mark.classList.add('ani-studio-mark-wide');
        if (logo) {
          mark.classList.add('ani-studio-mark-logo');
          if (name === 'CloverWorks') mark.classList.add('ani-studio-logo-white');
          if (studioLogosNeedingLightContrast.has(name)) mark.classList.add('ani-studio-logo-light-contrast');
        }
        image.src = logo || entry.image;
      }
      return mark;
    }
    function studioSite(name) {
      const [, website, , reference] = profiles.get(name) || [];
      const url = website || reference;
      if (!url) return null;
      const label = website ? '官方網站' : '公司資料';
      const site = el('a', 'ani-studio-site');
      site.setAttribute('aria-label', studioDisplayName(name) + ' ' + label);
      site.title = label;
      site.append(studioIcon(website
        ? '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'
        : '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/>'));
      site.href = url;
      site.target = '_blank';
      site.rel = 'noopener noreferrer';
      return site;
    }
    function favoriteButton(name) {
      const heart=el('button','ani-studio-heart');
      heart.type='button';
      heart.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
      heart.dataset.studio=name;
      const key=favoriteStudioPrefix+name;
      const syncHeart=()=>{
        const saved=localStorage.getItem(key)==='1';
        for(const item of [heart,...panel.querySelectorAll('.ani-studio-heart')]) {
          if(item.dataset.studio!==name) continue;
          item.setAttribute('aria-pressed',String(saved));
          item.setAttribute('aria-label',(saved?'取消收藏 ':'收藏 ')+studioDisplayName(name));
        }
      };
      heart.onclick=()=>{
        if(localStorage.getItem(key)==='1') localStorage.removeItem(key);
        else localStorage.setItem(key,'1');
        syncHeart();
        if (favoritesOnly) render();
      };
      heart.addEventListener('ani-refresh-favorite', syncHeart);
      syncHeart();
      return heart;
    }
    function watchButton(action) {
      const button = el('button', 'ani-studio-watch');
      button.type = 'button';
      button.append(icon('play'), '觀看作品');
      button.onclick = action;
      return button;
    }
    function scrollToWork(row) {
      const target = row.querySelector('.ani-studio-tools');
      const navigation = document.querySelector('.top_sky');
      const offset = (navigation?.getBoundingClientRect().height || 0) + 20;
      const scroller = document.scrollingElement;
      const destination = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
      const missingSpace = destination - (scroller.scrollHeight - window.innerHeight);
      if (missingSpace > 0) {
        const currentSpace = parseFloat(panel.style.paddingBottom) || 0;
        panel.style.paddingBottom = Math.ceil(currentSpace + missingSpace) + 'px';
      }
      window.scrollTo({top:destination, behavior:reducedMotion.matches ? 'instant' : 'smooth'});
    }
    function prepareRow(name, container) {
      const section=el('section','animate-theme-list ani-studio-row');
      section.dataset.studio = name;
      const bar=el('div','ani-studio-tools');
      const gallery=el('div','ani-studio-gallery');
      const list=el('div','theme-list-block');
      const works=groups.get(name);
      const cards=new Map();
      let current='人氣';
      function order() {
        const sorted=[...works].sort((a,b)=>current==='最新'?b.date.localeCompare(a.date):current==='評分'?(b.score||0)-(a.score||0)||b.popularity-a.popularity:b.popularity-a.popularity);
        list.append(...sorted.map(w=>cards.get(w)));
      }
      let loading=false;
      async function rate() {
        if (loading) return;
        loading=true;
        try {
          for (const w of works) {
            if (current!=='評分'||panel.hidden) break;
            if (!knownScores.has(w.sn)) {
              const meta=await loadMetadata(cards.get(w).href).catch(()=>null);
              if (meta?.score) knownScores.set(w.sn,Number(meta.score));
            }
            w.score=knownScores.get(w.sn);
            if (w.score) cards.get(w).dataset.aniRelatedScore=String(w.score);
          }
          if (current==='評分') {order(); enhanceCards([section]);}
        } finally {loading=false;}
      }
      const summary=el('div','ani-studio-summary');
      const identity=el('div','ani-studio-identity');
      const title = el('h2', 'theme-title');
      const displayName = studioDisplayName(name);
      title.textContent = displayName;
      const portrait = el('div', 'ani-studio-portrait');
      portrait.append(studioMark(name), favoriteButton(name));
      const [alias] = profiles.get(name) || [];
      identity.append(title);
      if (alias && alias !== displayName) identity.append(el('small', '', studioAliasLabel(alias)));
      const actions=el('div','ani-studio-actions');
      const watch = watchButton(() => {
        if (!cards.size) loadFeatured(name);
        const first=list.querySelector('a');
        if (!first) return;
        first.focus({preventScroll:true});
        list.scrollTo({left:0, behavior:reducedMotion.matches ? 'instant' : 'smooth'});
        scrollToWork(section);
      });
      const site = studioSite(name);
      if (site) actions.append(site);
      actions.append(watch);
      summary.append(portrait,identity,actions);
      bar.append(summary,segmented([['人氣','views'],['評分','score'],['最新','date']],'人氣',label=>{
        if (!cards.size) loadFeatured(name);
        current=label;order();if(label==='評分')void rate();
      }));
      section.append(bar,gallery);
      container.append(section);
      function populate() {
        if (cards.size) return;
        for (const work of works) cards.set(work, makeCard(work));
        gallery.append(list);
        order();
        enhanceCards([section]);
        const left = railPositions.get(name);
        if (left) list.scrollLeft = left;
      }
      const row = {section, gallery, populate};
      rows.set(name, row);
      return row;
    }
    function addRow(name, container) {
      const {section, populate} = rows.get(name) || prepareRow(name, container);
      populate();
      return section;
    }
    let activeCard;
    function setExpanded(card, expanded) {
      card.classList.toggle('is-expanded', expanded);
      card.querySelector('.ani-studio-open').setAttribute('aria-expanded', String(expanded));
      card.querySelector('.ani-studio-profile').inert = !expanded;
    }
    function expandFeatured(card) {
      if (activeCard === card) return;
      const animate = activeCard && !reducedMotion.matches;
      const cards = [...features.children];
      const before = animate && cards.map(item => {
        const surface = item.firstElementChild;
        const clip = getComputedStyle(surface).clipPath;
        const rightInset = Number.parseFloat(clip.split(' ')[1]) || 0;
        return {left:item.getBoundingClientRect().left, width:surface.offsetWidth - rightInset};
      });
      if (activeCard) setExpanded(activeCard, false);
      activeCard = card;
      setExpanded(card, true);
      if (!animate) return;
      for (const item of cards) {
        item.getAnimations().forEach(animation => animation.cancel());
        item.firstElementChild.getAnimations().forEach(animation => animation.cancel());
      }
      const after = cards.map(item => item.getBoundingClientRect());
      const timing = {duration:220, easing:'cubic-bezier(.2,.7,.25,1)'};
      cards.forEach((item, index) => {
        const surface = item.firstElementChild;
        const offset = before[index].left - after[index].left;
        if (Math.abs(offset) > .5) item.animate([
          {transform:'translateX(' + offset + 'px)'}, {transform:'none'}
        ], timing);
        const start = surface.offsetWidth - before[index].width;
        const end = surface.offsetWidth - after[index].width;
        if (Math.abs(start - end) > .5) surface.animate([start, end].map(inset => ({
          clipPath:'inset(0px ' + Math.max(0, inset) + 'px 0px 0px round var(--ani-radius,12px))'
        })), timing);
      });
    }
    for (const name of featured) {
      const displayName = studioDisplayName(name);
      const card = el('article', 'ani-studio-feature');
      const toggle = el('button', 'ani-studio-open');
      toggle.type = 'button';
      const logo = el('span', 'ani-studio-feature-logo');
      if (studioLogosNeedingLightContrast.has(name)) logo.classList.add('ani-studio-logo-light-contrast');
      if (name === 'CloverWorks') logo.classList.add('ani-studio-logo-white');
      if (logos[name]) {
        const image = el('img');
        image.src = logos[name];
        image.alt = '';
        logo.append(image);
      } else {
        logo.append(studioMark(name));
      }
      const compactName = el('strong', 'ani-studio-compact-name', displayName);
      compactName.title = displayName;
      toggle.append(logo, compactName);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.onclick = () => expandFeatured(card);
      card.addEventListener('focusin', () => expandFeatured(card));
      card.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse') expandFeatured(card);
      });
      const [alias] = profiles.get(name) || [];
      const details = el('div', 'ani-studio-profile');
      const featuredName = el('strong', 'ani-studio-feature-name', displayName);
      featuredName.title = displayName;
      details.append(featuredName);
      const nameWidth = [...displayName].reduce((width, character) =>
        width + (/\s/.test(character) ? 0.38 : /^[MWmw]$/.test(character) ? 1 : /^[A-Z]$/.test(character) ? 0.82 : /^[\x00-\x7f]$/.test(character) ? 0.68 : 1.08), 0);
      card.style.setProperty('--ani-studio-name-width', String(Math.max(1, nameWidth)));
      if (alias && alias !== displayName) details.append(el('small', '', studioAliasLabel(alias)));
      const examples = studioRepresentativeTitles[name] ?? [];
      const titleLength = Math.max(0, ...examples.map(title =>
        [...title].reduce((length, character) => length + (/^[\x00-\x7f]$/.test(character) ? 0.55 : 1), 0)
      ));
      card.style.setProperty('--ani-studio-title-length', String(titleLength));
      if (examples.length) {
        const works = el('div', 'ani-studio-feature-works');
        works.append(el('small', '', '代表作品'));
        for (const title of examples) works.append(el('span', '', title));
        details.append(works);
      }
      const actions = el('div', 'ani-studio-actions');
      const site = studioSite(name);
      if (site) actions.append(site);
      actions.append(watchButton(() => {
        const row = selectedName ? chooseStudio(name) : loadFeatured(name);
        scrollToWork(row);
      }));
      details.append(actions);
      details.inert = true;
      const surface = el('div', 'ani-studio-feature-surface');
      surface.append(toggle, details, favoriteButton(name));
      card.append(surface);
      features.append(card);
    }
    if (features.firstElementChild) expandFeatured(features.firstElementChild);
    const directory = el('section', 'ani-studio-directory');
    const directoryHeader = el('div', 'ani-studio-directory-header');
    const search = el('input', 'ani-studio-search');
    search.type = 'search';
    search.value = studioQuery;
    search.placeholder = '搜尋名稱或別名';
    search.setAttribute('aria-label', '搜尋其他製作組');
    const searchField = el('div', 'ani-studio-search-field');
    searchField.append(search, icon('search'));
    directoryHeader.append(el('h2', 'theme-title', '其他製作組'), searchField);

    const chips = el('div', 'ani-studio-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', '其他製作組');
    const empty = el('p', 'ani-studio-no-results', '找不到符合的製作組');
    empty.setAttribute('role', 'status');
    const more = el('button', 'ani-studio-show-more', '顯示更多');
    more.type = 'button';
    more.prepend(icon('more'));
    const selectedWorks = el('div', 'ani-studio-directory-works');
    const featuredWorks = el('div', 'ani-studio-featured-works');
    directory.append(directoryHeader, chips, empty, selectedWorks);
    if (!favoritesOnly) panel.append(directory);
    panel.append(featuredWorks);

    const slots = new Map();
    const normalize = text => text.normalize('NFKC').toLowerCase().trim();
    const featuredNames = new Set(featured);
    const choices = [...groups.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        name,
        names: [normalize(name), normalize(studioDisplayName(name))],
        terms: normalize(name + ' ' + studioDisplayName(name) + ' ' + (profiles.get(name)?.[0] || '')),
      }));
    const defaultChoices = choices.filter(({name}) => !featuredNames.has(name));
    const choiceButtons = new Map();
    let selectedName;
    let workTransition;
    const all = el('button', 'ani-studio-chip', '全部');
    all.type = 'button';
    all.prepend(icon('all'));
    all.onclick = () => {
      if (search.value) {
        resetStudioSearch();
        all.focus({preventScroll:true});
      } else chooseStudio();
    };
    function resetStudioSearch() {
      search.value = studioQuery = '';
      visibleCount = pageSize;
      chooseStudio(undefined, all, false);
      updateChoices();
    }
    function updateChoices() {
      const query = normalize(search.value);
      const rank = ({names}) => names.includes(query) ? 0 : names.some(name => name.startsWith(query)) ? 1 : 2;
      const matches = query
        ? choices.filter(({terms}) => terms.includes(query)).sort((a, b) => rank(a) - rank(b))
        : defaultChoices.slice(0, visibleCount);
      all.setAttribute('aria-pressed', String(!selectedName));
      chips.replaceChildren(all, ...matches.map(({name}) => {
        let button = choiceButtons.get(name);
        if (!button) {
          button = el('button', 'ani-studio-chip');
          button.type = 'button';
          button.append(studioMark(name), el('span', '', studioDisplayName(name)));
          button.onclick = () => {
            if (selectedName === name) {
              resetStudioSearch();
              all.focus({preventScroll:true});
            } else {
              chooseStudio(name, button);
            }
          };
          choiceButtons.set(name, button);
        }
        button.setAttribute('aria-pressed', String(name === selectedName));
        return button;
      }), more);
      empty.hidden = matches.length > 0;
      more.hidden = Boolean(query) || defaultChoices.length <= visibleCount;
    }
    function chooseStudio(name, button = name ? null : all, animate = true) {
      if (selectedName === name) return selectedWorks.firstElementChild;
      panel.style.removeProperty('padding-bottom');
      const previousSlot = slots.get(selectedName);
      if (previousSlot && selectedWorks.firstElementChild) {
        previousSlot.append(selectedWorks.firstElementChild);
      }
      selectedName = studioSelection = name;
      chips.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
      button?.setAttribute('aria-pressed', 'true');
      const filtered = Boolean(name);
      featuredWorks.hidden = filtered;
      workTransition?.cancel();
      if (!filtered) {
        selectedWorks.replaceChildren();
        return;
      }
      const row = slots.has(name) ? loadFeatured(name) : addRow(name, selectedWorks);
      selectedWorks.replaceChildren(row);
      if (animate && !reducedMotion.matches) {
        workTransition = row.querySelector('.ani-studio-tools').animate(
          [{opacity:.85}, {opacity:1}],
          {duration:120, easing:'ease-out'}
        );
      }
      return row;
    }
    search.oninput = () => {
      if (!search.value && studioQuery) {
        resetStudioSearch();
        return;
      }
      studioQuery = search.value;
      visibleCount = pageSize;
      updateChoices();
    };
    search.addEventListener('search', () => {
      if (!search.value && studioQuery) resetStudioSearch();
    });
    more.onclick = () => {
      const firstNew = visibleCount + 1;
      visibleCount += pageSize;
      updateChoices();
      chips.children[firstNew]?.focus({preventScroll:true});
    };

    const pendingRows = new Set();
    let prepareTimer;
    const canScheduleIdle = typeof window.requestIdleCallback === 'function';
    function schedulePendingRow() {
      if (prepareTimer !== undefined || !pendingRows.size) return;
      const prepare = () => {
        prepareTimer = undefined;
        if (panel.hidden || featuredWorks.hidden) return;
        const name = pendingRows.values().next().value;
        if (name !== undefined) loadFeatured(name);
        schedulePendingRow();
      };
      prepareTimer = canScheduleIdle
        ? window.requestIdleCallback(prepare, {timeout:180})
        : window.setTimeout(prepare, 32);
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const name = entry.target.dataset.studio;
        if (entry.isIntersecting) pendingRows.add(name);
        else pendingRows.delete(name);
      }
      schedulePendingRow();
    }, {rootMargin:'420px 0px'});
    function loadFeatured(name) {
      pendingRows.delete(name);
      const slot = slots.get(name);
      const {section, gallery, populate} = rows.get(name);
      if (!slot.classList.contains('ani-studio-rail-pending')) return section;
      observer.unobserve(slot);
      const placeholder = gallery.firstElementChild;
      populate();
      placeholder.remove();
      slot.classList.remove('ani-studio-rail-pending');
      slot.removeAttribute('aria-busy');
      return section;
    }
    for (const name of featured) {
      const slot = el('div', 'ani-studio-slot ani-studio-rail-pending');
      slot.dataset.studio = name;
      slot.setAttribute('aria-busy', 'true');
      const {gallery} = prepareRow(name, slot);
      const placeholder = el('div', 'ani-studio-placeholder ani-studio-poster-grid');
      placeholder.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < Math.min(groups.get(name).length, 12); index++) {
        const card = el('span', 'ani-studio-placeholder-card');
        card.append(el('span', 'ani-studio-placeholder-cover'));
        placeholder.append(card);
      }
      gallery.append(placeholder);
      slots.set(name, slot);
      featuredWorks.append(slot);
      observer.observe(slot);
    }
    if (groups.has(initialStudio)) {
      if (featured.includes(initialStudio)) {
        loadFeatured(initialStudio).scrollIntoView({block:'start'});
      } else {
        search.value = studioQuery = initialStudio;
        chooseStudio(initialStudio).scrollIntoView({block:'start'});
      }
    } else if (initialStudio) {
      search.value = studioQuery = initialStudio;
      directory.scrollIntoView({block:'start'});
    } else if (!favoritesOnly && groups.has(studioSelection)) {
      chooseStudio(studioSelection, null, false);
    }
    if (!favoritesOnly) updateChoices();
    return () => {
      if (prepareTimer !== undefined) {
        if (canScheduleIdle) window.cancelIdleCallback(prepareTimer);
        else window.clearTimeout(prepareTimer);
      }
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }
}
