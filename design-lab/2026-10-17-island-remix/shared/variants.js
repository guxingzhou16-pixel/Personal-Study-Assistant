/* Round 2 changes the visual language while preserving Sunny Isle's layout and behavior. */
(() => {
  'use strict';
  const variants = {
    mono: { number: '04', name: '玄墨', english: 'MONO NOIR', folder: '01-mono' },
    terra: { number: '05', name: '赤陶', english: 'TERRA STUDIO', folder: '02-terra' },
    blue: { number: '06', name: '蓝调', english: 'BLUE ATELIER', folder: '03-blue' },
  };
  const selected = variants[document.body.dataset.variant];
  const switcher = document.querySelector('.design-switch');
  switcher.replaceChildren();
  const original = document.createElement('a');
  original.href = '../../2026-10-17-three-directions/03-island/index.html';
  original.textContent = '03 晴岛原版';
  switcher.append(original);
  for (const variant of Object.values(variants)) {
    const link = document.createElement('a');
    link.href = `../${variant.folder}/index.html`;
    link.textContent = `${variant.number} ${variant.name}`;
    if (variant === selected) link.setAttribute('aria-current', 'page');
    switcher.append(link);
  }
  document.querySelector('.design-bar > span').textContent = '第二轮 · 同一排版 / 示例内容';
  document.querySelector('.brand small').textContent = selected.english;
  document.querySelector('.workspace-status > span:last-child').textContent =
    `${selected.name} / ${selected.english} · 设计概念 ${selected.number}`;
  document.querySelector('.island-greeting .eyebrow').textContent =
    'A LITTLE SPACE FOR YOUR NEXT BIG IDEA';
  document.querySelector('.greeting-sticker').innerHTML =
    `<span class="sticker-number">${selected.number}</span>保持好奇<span>STAY CURIOUS</span>`;

  const artwork = {
    mono: `<svg class="plant-art" viewBox="0 0 320 240" fill="none" aria-hidden="true"><defs><linearGradient id="mono-face" x1="105" y1="130" x2="237" y2="205" gradientUnits="userSpaceOnUse"><stop stop-color="#bcbcbc"/><stop offset="1" stop-color="#333333"/></linearGradient></defs><ellipse cx="159" cy="218" rx="113" ry="8" fill="#0c0c0c"/><path d="m55 185 113 19 99-44-109-16Z" fill="#282828" stroke="#7b7b7b"/><path d="m55 185 1 12 112 20 99-44v-13l-99 44Z" fill="#191919" stroke="#777777"/><path d="m84 160 81 14 76-33-80-12Z" fill="url(#mono-face)" stroke="#a5a5a5"/><path d="m84 160 1 10 80 15 76-34v-10l-76 33Z" fill="#333333" stroke="#9d9d9d"/><circle cx="163" cy="85" r="58" fill="#202020" stroke="#c1c1c1"/><ellipse cx="163" cy="85" rx="58" ry="20" stroke="#7c7c7c"/><ellipse cx="163" cy="85" rx="58" ry="40" stroke="#7c7c7c"/><ellipse cx="163" cy="85" rx="19" ry="58" stroke="#9c9c9c"/><ellipse cx="163" cy="85" rx="40" ry="58" stroke="#7c7c7c"/><path d="M105 85h116M163 27v116" stroke="#9c9c9c"/><circle cx="193" cy="57" r="4" fill="#ededed"/><path d="M245 76h24m-12-12v24M67 108h12m-6-6v12" stroke="#bcbcbc"/><circle cx="77" cy="46" r="2.5" fill="#8e8e8e"/><path d="M99 223h121" stroke="#535353"/></svg>`,
    terra: `<svg class="plant-art" viewBox="0 0 320 240" fill="none" aria-hidden="true"><ellipse cx="159" cy="216" rx="115" ry="8" fill="#d3bda6" opacity=".55"/><circle cx="179" cy="79" r="56" fill="#c17b54"/><circle cx="179" cy="79" r="44" stroke="#e4b28b"/><path d="m48 177 110 21 111-44-110-20Z" fill="#b15d3d" stroke="#704b36" stroke-width="1.5"/><path d="m48 177 1 15 109 21 111-44v-15l-111 44Z" fill="#d2a782" stroke="#704b36" stroke-width="1.5"/><path d="M72 140c33-23 62-20 87-2 22-22 53-26 87-9v48c-35-15-63-10-87 11-26-16-53-21-87-6Z" fill="#fcf4e4" stroke="#704b36" stroke-width="1.5"/><path d="M159 138v50m-70-43c21-10 39-8 54 1m-54 11c21-10 39-8 54 1m-54 11c21-10 39-8 54 1m32-25c18-13 36-15 54-9m-54 21c18-13 36-15 54-9m-54 21c18-13 36-15 54-9" stroke="#b59d7f" stroke-width="1.5"/><path d="m158 188 13-9 13 3-1 26-12-5-13 7Z" fill="#ad5136"/><path d="M57 82h23m-11-12v24M246 56l8-10 8 10-8 10Z" stroke="#9b6d4d" stroke-width="1.5"/><path d="M92 52c0-14 6-21 17-22-1 11-7 18-17 22Z" fill="#9d885f"/></svg>`,
    blue: `<svg class="plant-art" viewBox="0 0 320 240" fill="none" aria-hidden="true"><ellipse cx="163" cy="218" rx="112" ry="7" fill="#a6b5e4"/><path d="m45 179 111 20 112-46-111-20Z" fill="#f8e7a3" stroke="#222d48" stroke-width="2.5"/><path d="m45 179 1 16 110 20 112-46v-16l-112 46Z" fill="#f1cf58" stroke="#222d48" stroke-width="2.5"/><path d="m78 141 81 13 78-32-81-13Z" fill="#fdfbf2" stroke="#222d48" stroke-width="2.5"/><path d="m78 141 1 16 80 14 78-33v-16l-78 32Z" fill="#9baff4" stroke="#222d48" stroke-width="2.5"/><path d="m122 78 43-24 43 24v50l-43 25-43-25Z" fill="#5675e5" stroke="#222d48" stroke-width="2.5"/><path d="m122 78 43 25 43-25m-43 25v50" stroke="#222d48" stroke-width="2.5"/><path d="m165 54 43 24-43 25-43-25Z" fill="#eef1fd" stroke="#222d48" stroke-width="2.5"/><path d="m249 49 5-17 5 17 17 5-17 5-5 17-5-17-17-5Z" fill="#f8e7a3" stroke="#222d48" stroke-width="2"/><path d="M59 87h24m-12-12v24" stroke="#2d53d7" stroke-width="3"/><circle cx="111" cy="36" r="5" fill="#2d53d7"/><path d="m264 110 8 8-8 8-8-8Z" fill="#fdfbf2" stroke="#222d48" stroke-width="2"/></svg>`,
  };
  document.querySelector('.plant-art').outerHTML = artwork[document.body.dataset.variant];
})();
