import { patchDOM, selectedRange } from './dom-tools.mjs';
const NS = 'trace-result-return';
let instance = 0;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  main: 'M 115 9 C 245 -4 465 15 675 5 C 890 -5 970 70 990 210 C 1019 390 982 516 858 570 C 734 616 378 587 183 590 C 45 593 6 520 4 368 C -2 195 12 34 115 9 Z',
  small: 'M 152 11 C 369 -14 514 28 704 8 C 889 -6 971 59 991 197 C 1027 427 957 551 792 581 C 637 607 335 591 187 588 C 37 581 -11 450 5 276 C 18 130 41 28 152 11 Z',
  wide: 'M 108 15 C 274 -4 476 14 717 5 C 900 -2 976 105 991 271 C 1014 489 956 572 794 588 C 601 608 325 588 180 590 C 37 592 5 505 4 332 C -1 151 22 31 108 15 Z'
};
const ICONS = {
  file:'<path d="M7 3h8l5 5v17H7z"/><path d="M15 3v6h5M11 14h6m-6 5h6"/>',
  box:'<path d="m14 3 10 6v12l-10 6-10-6V9zM4 9l10 6 10-6M14 15v12M9 6l10 6"/>',
  back:'<path d="M23 14H5m7-7-7 7 7 7"/>',
  clip:'<path d="m10 16 9-9a4 4 0 0 1 6 6L13 25a7 7 0 0 1-10-10L15 3m-7 14 10-10"/>',
  close:'<path d="m7 7 14 14M21 7 7 21"/>',
  edit:'<path d="m5 23 2-7L20 3l5 5-13 13zM17 6l5 5"/>',
  check:'<path d="m6 15 5 5 11-12"/>',
  question:'<circle cx="14" cy="14" r="11"/><path d="M11 10a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 4h.01"/>',
  target:'<circle cx="14" cy="14" r="11"/><circle cx="14" cy="14" r="6"/><path d="m14 14 10-10m-1-1v5h5"/>',
  bulb:'<path d="M10 20h8m-7 4h6m-7-6c0-3-4-3-4-8a8 8 0 0 1 16 0c0 5-4 5-4 8M14 1v-1M3 6 1 5m24 1 2-1"/>',
  user:'<circle cx="14" cy="9" r="5"/><path d="M4 26v-3a10 10 0 0 1 20 0v3"/>',
  play:'<path d="m8 4 16 10-16 10z"/>',
  source:'<ellipse cx="14" cy="6" rx="9" ry="4"/><path d="M5 6v16c0 5 18 5 18 0V6M5 13c0 5 18 5 18 0"/>',
  swap:'<path d="M4 10h19m-5-5 5 5-5 5M24 20H5m5-5-5 5 5 5"/>',
  shield:'<path d="m14 3 9 3v10c0 5-9 10-9 10S5 21 5 16V6z"/>'
};
const icon = name => `<svg class="rr-icon" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
const button = (action, label, kind = '', extra = '') => `<button type="button" class="rr-button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const field = (name, label, value, options={}) => `<label class="rr-field ${options.className||''}"><span>${label}</span><textarea data-key="${name}" data-field="${name}" aria-label="${label}" ${options.readonly?'readonly':''} ${options.rows?`rows="${options.rows}"`:''} placeholder="${escape(options.placeholder||'')}">${escape(value)}</textarea></label>`;

/** Render-only adapter. The host owns all domain state and all persistence receipts. */
export function mountResultReturn(container, { view: initialView, dispatch, assets = {}, onNavigate } = {}) {
  if (!container || typeof dispatch !== 'function') throw new TypeError('container and dispatch are required');
  const id = `rr-${++instance}`;
  const document = container.ownerDocument;
  const win = document.defaultView;
  let view = initialView, destroyed = false, signature = '', panel = null, priorFocus = null;
  let resizeObserver, currentAnimation, toastTimer;
  const composing = new WeakSet();
  const fonts = [];
  const root = document.createElement('section');
  root.className = NS;
  root.setAttribute('aria-label', '结果回来');
  if (assets.backgroundUrl) root.style.backgroundImage = `url(${JSON.stringify(assets.backgroundUrl)})`;
  container.append(root);
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  if (win.FontFace) for (const [role,url] of [['serif',assets.serifUrl],['sans',assets.sansUrl],['serif-delta',assets.serifDeltaUrl],['sans-delta',assets.sansDeltaUrl]]) {
    if (!url) continue;
    const family=`TraceResult-${role}-${id}`;
    const face=new win.FontFace(family,`url(${JSON.stringify(url)})`,{display:'swap',weight:'100 900'});
    document.fonts.add(face); fonts.push(face);
    face.load().catch(()=>{});
    const baseRole=role.replace('-delta','');
    const fallback=baseRole==='serif'?'"Songti SC",SimSun,serif':'"Microsoft YaHei","PingFang SC",sans-serif';
    root.style.setProperty(`--rr-${baseRole}`,`"${family}",${role.endsWith('-delta')?`"TraceResult-${baseRole}-${id}",`:''}${fallback}`);
  }
  function glass(name, klass, contents, shape='main') {
    const clip=`${id}-${name}-clip`, fill=`${id}-${name}-fill`;
    return `<section class="rr-panel ${klass}" data-key="${name}" data-panel="${name}"><div class="rr-glass" aria-hidden="true"><div class="rr-glass-blur" style="clip-path:url(#${clip})"></div><svg viewBox="0 0 1000 600" preserveAspectRatio="none"><defs><clipPath id="${clip}" clipPathUnits="objectBoundingBox"><path d="${paths[shape]}" transform="scale(.001,.001666667)"/></clipPath><radialGradient id="${fill}"><stop stop-color="#fcfcf7" stop-opacity=".98"/><stop offset=".74" stop-color="#f8fcf6" stop-opacity=".94"/><stop offset="1" stop-color="#edf8f1" stop-opacity=".80"/></radialGradient></defs><path d="${paths[shape]}" fill="url(#${fill})" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="${paths[shape]}" fill="none" stroke="#aad4cf" stroke-opacity=".38" stroke-width=".8" vector-effect="non-scaling-stroke"/></svg></div><div class="rr-panel-content">${contents}</div></section>`;
  }
  function title(label, symbol='file') { return `<h2 class="rr-panel-title"><span class="rr-icon-disc">${icon(symbol)}</span>${label}</h2>`; }
  const sourceLabel = () => typeof view.intake?.source === 'string' ? view.intake.source : (view.intake?.source?.title || view.intake?.source?.label || [view.intake?.source?.agent,view.intake?.source?.project].filter(Boolean).join(' · ') || '来源未填写');
  const matterTitle = () => view.intake?.matter?.title || '当前未关联';
  const original = () => view.impact?.understanding || view.intake?.matter?.understanding || view.revision?.before || '';
  const trialText = () => view.intake?.trialText || original() || '暂无原来的理解，仍可只保存结果。';
  function target(small=false) {
    return `${title('准备接回','box')}<h3 class="rr-matter-title">${escape(matterTitle())}</h3>${small?'':`<div class="rr-detail-label">当时准备试</div><blockquote>${escape(trialText())}</blockquote><div class="rr-target-actions">${button('view-source',`${icon('file')} 查看当时的想法`,'rr-text')}${button('choose-matter',`${icon('swap')} 换一处`,'rr-text')}</div><div class="rr-divider"></div>${button('unlink','先不关联','rr-text rr-center', view.intake?.matter?'':'disabled')}`}`;
  }
  function intake() {
    const materialItems=(view.intake?.materials||[]).map(m=>`<span class="rr-material"><button type="button" data-action="view-material" data-id="${escape(m.id)}">${icon('file')}${escape(m.title||'选中材料')}</button><button type="button" data-action="remove-material" data-id="${escape(m.id)}" aria-label="移除材料 ${escape(m.title)}" ${view.intake?.rawLocked?'disabled':''}>${icon('close')}</button></span>`).join('');
    return glass('intake','rr-intake',`${title('这次实际发生了什么？')}<span class="rr-selection-note">${icon('shield')} 只带回选中内容</span>${field('intake','原文内容',view.intake?.text,{className:'rr-intake-text rr-label-hidden',readonly:view.intake?.rawLocked,placeholder:'写下这次实际发生的事，不必先得出结论。'})}<div class="rr-materials">${materialItems}${button('add-material',`${icon('clip')} 添加材料`,'rr-text',view.intake?.rawLocked?'disabled':'')}</div><p class="rr-source-line">${icon('source')} 来自 <span>${escape(sourceLabel())}</span></p><div class="rr-actions">${button('keep-result','先留结果','',view.intake?.canSave?'':'disabled')}${button('open-comparison','展开比较','rr-primary',view.intake?.canCompare?'':'disabled')}</div><p class="rr-footnote">比较不会自动修改理解</p>`) + glass('target','rr-target',target(),'small');
  }
  function comparison() {
    return glass('trial','rr-trial',`${title('当时准备试')}<blockquote>${escape(trialText())}</blockquote>${button('view-source',`${icon('file')} 看当时的现场`,'rr-text')}`,'small')+
      glass('comparison','rr-comparison',`${title(escape(view.comparison?.summary || '这次，发生了什么'))}<div class="rr-comparison-source">${escape(sourceLabel())}${button('edit-raw',`${icon('edit')} 编辑这段`,'rr-text')}</div><div class="rr-observation rr-kind"><i></i>${field('observation','实际观察',view.comparison?.observation,{placeholder:'只写可观察到的事情。'})}</div><div class="rr-interpretation rr-kind"><i></i>${field('interpretation','我的一种解释',view.comparison?.interpretation,{placeholder:'这是你的解释，可以继续修正。'})}</div><div class="rr-unconfirmed rr-kind"><i></i>${field('unconfirmed','仍未确认',view.comparison?.unconfirmed,{placeholder:'哪些地方还不能判断？'})}</div><div class="rr-divider"></div><p class="rr-inline-note">把实际发生的事与自己的解释分开。</p><div class="rr-actions">${button('save-draft','先留到这里')}${button('open-impact','看看影响哪一处','rr-primary')}</div>`)+glass('target','rr-target rr-target-small',target(true),'small');
  }
  function impact() {
    const fragments=view.impact?.fragments||[];
    const selected=fragments.find(f=>f.id===view.impact?.selectedFragmentId);
    let text=escape(original());
    if(selected && original().slice(selected.start,selected.end)===selected.text) text=escape(original().slice(0,selected.start))+`<mark>${escape(selected.text)}</mark>`+escape(original().slice(selected.end));
    const relationNames={support:'支持',limit:'限制',challenge:'挑战',unknown:'暂时无法判断'};
    const relationButtons=Object.entries(relationNames).map(([value,label])=>button('set-relation',`<span class="rr-radio-mark"></span>${label}`,`rr-relation${selected?.relation===value?' rr-selected':''}`,`data-relation="${value}" aria-pressed="${selected?.relation===value}" ${selected?'':'disabled'}`)).join('');
    const fragmentChips=fragments.map(f=>button('pick-fragment',escape(f.text),'rr-fragment-chip',`data-id="${escape(f.id)}" aria-pressed="${selected?.id===f.id}"`)).join('');
    return glass('original','rr-original',`${title('原来的理解')}<p class="rr-original-text" data-original-text>${text||'暂无原来的理解，仍可只保存结果。'}</p><p class="rr-inline-note">选中一处，看看这次影响了什么。</p><div class="rr-fragments">${fragmentChips}${button('select-fragment','选择原句片段','rr-text',original()?'':'disabled')}</div>`,'small')+
      glass('observation','rr-observation-bubble',`${title('这次观察')}<p>${escape(view.comparison?.observation||view.intake?.text)}</p>`,'small')+
      glass('relation','rr-relation-panel',`${title(escape(view.impact?.suggestion?.title || '关系与边界'),'bulb')}<p class="rr-relation-explanation">${escape(view.impact?.suggestion?.text||'对选中片段，这次结果意味着什么？')}</p><div class="rr-relations" role="group" aria-label="片段关系">${relationButtons}</div><p class="rr-relation-hint">${selected?'尚未确认，不会直接修改理解。':'先选择原句片段，再判断这一处的关系。'}</p>${field('relation-note','说明这一处的影响',selected?.note,{className:'rr-relation-note',placeholder:'不同片段可以有不同关系。'})}<div class="rr-actions">${button('open-revision','是，打开修订草稿','rr-primary',view.impact?.canReview?'':'disabled')}${button('edit-relation','我想改一下')}</div>${button('unknown','现在还不能判断','rr-text rr-center',selected?'':'disabled')}<div class="rr-divider"></div><p class="rr-footnote">打开草稿后，仍需查看并确认修改。</p>`)+glass('keep','rr-keep',button('keep-result',`${icon('file')} 只留结果，暂不改理解`),'small');
  }
  function revision() {
    return glass('source','rr-revision-source',`${title(view.isDemo?'一次原型试用':'这次结果')}${button('view-raw','查看原文','rr-text')}`,'small')+glass('revision','rr-revision',`<div class="rr-revision-main">${title('这次修改什么？')}<div class="rr-diff-row rr-before"><span>原来</span><p>${escape(view.revision?.before)}</p></div><div class="rr-diff-row rr-after"><span>准备改成</span>${field('after','准备改成',view.revision?.after,{className:'rr-label-hidden',placeholder:'先写出准备采用的理解。'})}</div><details class="rr-basis"><summary>${icon('file')} 这次依据：${escape(view.comparison?.observation || view.intake?.text)}</summary><p>${escape(view.intake?.text)}</p></details><div class="rr-divider"></div><div class="rr-unresolved-row">${icon('question')}${field('unresolved','仍待弄清',view.revision?.unresolved)}</div><div class="rr-actions">${button('confirm-revision','确认这处修改','rr-primary',view.revision?.canConfirm?'':'disabled')}${button('save-draft','暂存草稿')}${button('keep-result','暂不修改','rr-text')}</div><p class="rr-footnote">确认后保留旧版本，可撤销</p></div><aside class="rr-scope">${title('修改范围','target')}<p>仅这件事里的当前理解</p><p>不自动改动项目规则或进行中工作</p><small>当前理解版本 <b>${escape(view.revision?.baseVersion??'—')}</b></small></aside>`,'wide');
  }
  function completed() {
    return glass('old','rr-old',`${title('当时的理解')}<p>${escape(view.revision?.before)}</p>${button('old-version','看旧版本','rr-text')}`,'small')+
      glass('result','rr-result',`${title('这次试用','box')}<p>${escape(view.comparison?.observation||view.intake?.text)}</p><small>${escape(sourceLabel())}</small>`,'small')+
      glass('unresolved','rr-unresolved',`${title('仍待弄清','question')}<p>${escape(view.revision?.unresolved||view.comparison?.unconfirmed||'暂无未决问题')}</p>`,'small')+
      glass('completed','rr-completed',`<div class="rr-success-heading"><span class="rr-success-disc">${icon('check')}</span><div><p>现在的理解</p><h2>理解已修订</h2></div></div><p class="rr-current-understanding">${escape(view.revision?.after)}</p><div class="rr-divider"></div><p class="rr-scope-note">${icon('question')} 仅更新这件事的理解；进行中工作未自动改动。</p><div class="rr-divider"></div><div class="rr-actions">${button('go-matter',`${icon('back')} 回到这件事`,'rr-primary')}${button('retry-work',`${icon('play')} 再带去试一次`)}</div><div class="rr-undo-row">${button('undo','撤销这次修改','rr-text',view.status?.canUndo?'':'disabled')}<span>撤销修改仍保留原始结果</span></div>`) +
      glass('matter','rr-matter',`${title(escape(matterTitle()))}<p>新增一次结果 · 理解已修订</p>`,'small');
  }
  const screenMeta={intake:['带回这次观察','待接回 · 理解未修改'],comparison:['看清这次的差别','比较中 · 理解未修改'],impact:['它改变了哪一处','关系待确认 · 理解未修改'],revision:['只改这一次分清的地方','修订草稿 · 尚未生效'],completed:['这次经历，回到了原来的事情里。','']};
  const scenes={intake:{bird:[753,272],nodes:[[1114,391]],path:'M-20 278 C90 326 145 365 227 323 S462 305 671 284 S799 252 946 302 S1030 395 1114 391 S1436 317 1700 379'},comparison:{bird:[1494,655],nodes:[[139,355],[505,447]],path:'M-20 278 C110 392 212 320 317 356 S422 457 505 447 C646 490 1053 425 1251 505 S1355 660 1494 655 S1600 664 1700 700'},impact:{bird:[722,276],nodes:[[319,573],[963,336]],path:'M-20 276 C170 305 110 359 205 320 S501 300 649 285 S750 256 832 297 S916 338 963 336 M205 320 C157 421 190 533 319 573'},revision:{bird:[997,248],nodes:[[301,420]],path:'M-20 219 C181 361 187 347 335 342 S511 274 745 273 S881 257 997 248 S1096 278 1250 273 S1564 278 1700 357'},completed:{bird:[1273,249],nodes:[[214,345],[671,344],[480,588]],path:'M-20 319 C87 352 115 347 214 345 S372 430 470 384 S570 316 671 344 S841 383 930 311 S1119 248 1273 249 S1470 226 1700 352 M214 345 C409 474 425 498 480 588 S582 559 643 659 S805 762 1071 726 S1200 597 1273 249'}};
  function pathsLayer(screen) {
    const s=scenes[screen];
    return `<svg class="rr-streams" viewBox="0 0 1672 941" aria-hidden="true"><path d="${s.path}" fill="none" stroke="#ffffff" stroke-width="5" opacity=".8"/><path d="${s.path}" fill="none" stroke="#1b6c59" stroke-width="1.4"/><path d="${s.path}" fill="none" stroke="#d3a24c" stroke-width="1.4" stroke-dasharray="100 1900" stroke-dashoffset="-610"/>${s.nodes.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="10" fill="#075340" stroke="#f8fff6" stroke-width="4"/><circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join('')}<circle class="rr-attention" cx="${s.bird[0]}" cy="${s.bird[1]}" r="13" fill="${screen==='completed'?'#12634a':'#d88a11'}" stroke="#fff7da" stroke-width="4"/><circle cx="${s.bird[0]}" cy="${s.bird[1]}" r="3" fill="#fff"/></svg>${assets.birdPerchedUrl?`<div class="rr-bird" style="left:${s.bird[0]}px;top:${s.bird[1]}px"><img src="${escape(assets.birdPerchedUrl)}" alt=""/></div>`:''}`;
  }
  function statusMarkup() {
    const phase=view.status?.phase||'';
    const error=view.status?.error;
    const isWaiting=Boolean(view.status?.pending);
    const notice=typeof view.notice==='string'?view.notice:view.notice?.message||view.notice?.text||'';
    const message=isWaiting?'正在等待保存回执，理解尚未更新。':error?.message||error||notice;
    if(!message) return '';
    return `<div class="rr-notice ${error?'rr-error':''}" role="${error?'alert':'status'}"><span>${escape(message)}</span>${view.status?.canRetry?button('retry-command','重试','rr-text'):''}${phase==='conflict'?button('view-source','查看当前理解','rr-text'):''}${!isWaiting?button('clear-notice','关闭','rr-text'):''}</div>`;
  }
  function build() {
    const previousScreen=root.dataset.screen;
    const screen=screenMeta[view?.screen]?view.screen:'intake';
    root.dataset.screen=screen;
    const fresh=document.createElement('div');
    fresh.innerHTML=`<div class="rr-stage"><header class="rr-header"><button type="button" class="rr-brand" data-action="go-worksite" aria-label="Trace，返回工作现场"><span class="rr-brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 11h10v10H11zM11 11H7a4 4 0 1 1 4-4v18a4 4 0 1 1-4-4h18a4 4 0 1 1-4 4V7a4 4 0 1 1 4 4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span>Trace</button><span class="rr-breadcrumb">工作现场 <i>/</i> 结果回来</span>${button('go-worksite',`${icon('back')} 返回工作现场`,'rr-back')}</header><div class="rr-heading"><h1>结果回来${screen==='completed'?'<span>。</span>':''}</h1><p>${screenMeta[screen][0]} ${screenMeta[screen][1]?`<span class="rr-phase"><i></i>${screenMeta[screen][1]}</span>`:''}</p><div>${escape(sourceLabel())} <i>|</i> ${escape(matterTitle())}</div></div>${pathsLayer(screen)}<main class="rr-content">${({intake,comparison,impact,revision,completed})[screen]()}</main><button type="button" class="rr-profile" data-action="about" aria-label="原型说明">${icon('user')}</button><small class="rr-demo-label">${view.isDemo?'交互示例 · 非真实测试数据':'仅本次会话 · 保存以宿主回执为准'}</small></div><div class="rr-notices">${statusMarkup()}</div><div class="rr-overlay-host"></div><div class="rr-toast" role="status"></div>`;
    patchDOM(root,fresh,el=>composing.has(el));
    resize();
    if(previousScreen&&previousScreen!==screen&&!reducedMotion.matches) {
      currentAnimation?.cancel();
      const primary=root.querySelector(`.rr-${screen==='impact'?'relation-panel':screen}`);
      currentAnimation=primary?.animate([{opacity:.78,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:340,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    renderPanel();
  }
  function structuralKey(v) {
    return JSON.stringify([v.screen,v.identity?.sessionKey,v.identity?.matterId,v.intake?.rawLocked,(v.intake?.materials||[]).map(m=>[m.id,m.title]),(v.impact?.fragments||[]).map(f=>[f.id,f.relation]),v.impact?.selectedFragmentId,v.status?.phase,v.status?.pending?.commandId,v.status?.error,v.notice,v.receipt,v.oldVersionOpen,v.retry?.open]);
  }
  function patchFields() {
    const fragment=(view.impact?.fragments||[]).find(f=>f.id===view.impact?.selectedFragmentId);
    const values={intake:view.intake?.text,observation:view.comparison?.observation,interpretation:view.comparison?.interpretation,unconfirmed:view.comparison?.unconfirmed,after:view.revision?.after,unresolved:view.revision?.unresolved,'relation-note':fragment?.note};
    for(const el of root.querySelectorAll('[data-field]')) {
      if(!(el.dataset.field in values)) continue;
      const next=String(values[el.dataset.field]??'');
      if(el.value!==next&&!composing.has(el)) {
        const active=document.activeElement===el; const start=el.selectionStart,end=el.selectionEnd;
        el.value=next;
        if(active&&start!==null)el.setSelectionRange(Math.min(start,next.length),Math.min(end,next.length));
      }
    }
    const enabled={'keep-result':view.intake?.canSave,'open-comparison':view.intake?.canCompare,'open-revision':view.impact?.canReview,'confirm-revision':view.revision?.canConfirm,undo:view.status?.canUndo};
    for(const [action,can]of Object.entries(enabled))for(const el of root.querySelectorAll(`[data-action="${action}"]`))el.disabled=!can;
    for(const el of root.querySelectorAll('.rr-actions button')) if(view.status?.pending)el.disabled=true;
  }
  function update(next) {
    if(destroyed)return;
    view=next;
    const nextSignature=structuralKey(view);
    if(signature!==nextSignature) {
      const active=document.activeElement;
      const focus=active&&root.contains(active)?{field:active.dataset.field,action:active.dataset.action,start:active.selectionStart,end:active.selectionEnd}:null;
      signature=nextSignature;
      build();
      if(focus) {
        const el=focus.field?root.querySelector(`[data-field="${focus.field}"]`):focus.action?root.querySelector(`[data-action="${focus.action}"]`):null;
        if(el){el.focus({preventScroll:true});if(focus.field&&focus.start!=null)el.setSelectionRange(focus.start,focus.end);}
      }
    }
    patchFields();
  }
  function resize() {
    if(destroyed)return;
    const box=root.getBoundingClientRect();
    const compact=box.width<1100;
    root.classList.toggle('rr-compact',compact);
    const stage=root.querySelector('.rr-stage'); if(!stage)return;
    if(compact){stage.style.transform='';stage.style.left='';stage.style.top='';return;}
    const scale=Math.min(box.width/1672,box.height/941);
    stage.style.transform=`scale(${scale})`;stage.style.left=`${(box.width-1672*scale)/2}px`;stage.style.top=`${Math.max(0,(box.height-941*scale)/2)}px`;
  }
  function toast(message) {
    const el=root.querySelector('.rr-toast'); if(!el)return;
    el.textContent=message;el.classList.add('rr-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('rr-visible'),4800);
  }
  function navigate(target) {
    const payload={target,...view.identity};
    delete payload.sessionKey;delete payload.resultId;
    if(typeof onNavigate!=='function'){toast('当前入口未接入宿主，不会发送外部任务。');return;}
    const result=onNavigate(payload);
    if(result===false)toast('当前入口未接入宿主，不会发送外部任务。');
  }
  function openPanel(kind,data) { priorFocus=document.activeElement;panel={kind,data};renderPanel(); }
  function closePanel() { const old=panel?.kind;panel=null;renderPanel();if(old==='old'&&view.oldVersionOpen)dispatchAction({type:'VIEW_OLD_VERSION'});if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true}); }
  function renderPanel() {
    const host=root.querySelector('.rr-overlay-host');if(!host)return;
    if(!panel){host.innerHTML='';return;}
    let heading='',body='';
    if(panel.kind==='material') {
      heading='添加材料';body=`<p>只保留本次选中的内容，不自动带回整个会话。</p><label>材料名称<input data-local="material-title" maxlength="120" /></label><label>材料原文<textarea data-local="material-text" rows="6"></textarea></label>${button('confirm-material','添加这一份','rr-primary')}`;
    } else if(panel.kind==='choose-matter') {
      heading='选择接回哪件事';body=(view.intake?.targets||[]).map(m=>button('link-matter',`<strong>${escape(m.title)}</strong><small>当前理解版本 ${escape(m.version??'—')}</small>`,'rr-choice',`data-id="${escape(m.id)}"`)).join('')||'<p>还没有可接回的事项，可以先保存结果。</p>';
    } else if(panel.kind==='fragment') {
      heading='选择原句片段';body=`<p>选中或输入能在原文中定位的文字。一个片段对应一种关系。</p><blockquote data-fragment-original>${escape(original())}</blockquote><label>已选片段<input data-local="fragment-text" value="${escape(panel.data?.text||'')}" /></label>${button('confirm-fragment','使用这个片段','rr-primary')}${view.impact?.selectedFragmentId?button('remove-fragment','移除此片段','rr-text'):''}`;
    } else if(panel.kind==='old') {
      heading='查看旧版本';body=`<p>当前理解版本 ${escape(view.revision?.baseVersion??'—')}</p><blockquote>${escape(view.revision?.before)}</blockquote><p>原始结果仍会保留。</p>`;
    } else if(panel.kind==='undo') {
      heading='撤销这次修改';body=`<p>撤销后回到修改前的理解，并保留这次结果。</p><blockquote>${escape(view.revision?.before)}</blockquote><div class="rr-actions">${button('confirm-undo','确认撤销','rr-primary')}${button('close-panel','不撤销')}</div>`;
    } else if(panel.kind==='retry') {
      heading='选择工作目标';const destination=view.retry?.destination||{};body=`<p>选择目标后仍需在工作现场确认，不自动发送。</p><label>Agent<input data-local="retry-agent" value="${escape(destination.agent||'')}" /></label><label>项目<input data-local="retry-project" value="${escape(destination.project||'')}" /></label><label>任务<input data-local="retry-task" value="${escape(destination.task||'')}" /></label>${button('confirm-retry','回到工作现场确认','rr-primary')}`;
    } else if(panel.kind==='material-view') {
      const material=(view.intake?.materials||[]).find(m=>m.id===panel.data);heading=material?.title||'选中材料';body=`<pre>${escape(material?.text||'这份材料没有可展示的文本。')}</pre>`;
    } else if(panel.kind==='raw') {
      heading='查看原文';body=`<blockquote>${escape(view.intake?.text)}</blockquote><p>${escape(sourceLabel())}</p>`;
    } else if(panel.kind==='source') {
      heading='当时准备试';body=`<blockquote>${escape(trialText())}</blockquote><p>${escape(matterTitle())}</p>`;
    } else {heading='交互原型';body='<p>只有明确匹配的宿主成功回执才表示保存。示例、草稿和暂存不会自动修改理解。</p>';}
    host.innerHTML=`<div class="rr-panel-scrim"><section class="rr-popover" role="dialog" aria-modal="true" aria-labelledby="${id}-dialog-title"><header><h2 id="${id}-dialog-title">${heading}</h2>${button('close-panel',icon('close'),'rr-icon-button','aria-label="关闭"')}</header>${body}<p class="rr-panel-error" role="alert"></p></section></div>`;
    host.querySelector('input,textarea,button')?.focus({preventScroll:true});
  }
  function dispatchAction(action){dispatch(action);}
  function onInput(event) {
    const el=event.target;if(!el.dataset?.field)return;
    const name=el.dataset.field,text=el.value;
    if(name==='intake')dispatchAction({type:'EDIT_INTAKE',text});
    else if(['observation','interpretation','unconfirmed'].includes(name))dispatchAction({type:'EDIT_COMPARISON',field:name,text});
    else if(name==='after'||name==='unresolved')dispatchAction({type:'EDIT_REVISION',[name]:text});
    else if(name==='relation-note') {
      const fragment=(view.impact?.fragments||[]).find(f=>f.id===view.impact?.selectedFragmentId);
      if(fragment)dispatchAction({type:'SET_RELATION',fragmentId:fragment.id,relation:fragment.relation||'unknown',note:text});
    }
  }
  function onClick(event) {
    const el=event.target.closest('[data-action]');if(!el||!root.contains(el)||el.disabled)return;
    const action=el.dataset.action;
    const simple={'open-comparison':'OPEN_COMPARISON','open-impact':'OPEN_IMPACT','open-revision':'OPEN_REVISION','keep-result':'KEEP_RESULT_ONLY','save-draft':'SAVE_DRAFT','confirm-revision':'CONFIRM_REVISION','retry-command':'RETRY_COMMAND','clear-notice':'CLEAR_NOTICE',unlink:'UNLINK_MATTER'};
    if(simple[action]){dispatchAction({type:simple[action]});return;}
    if(action==='go-worksite')navigate('worksite');
    else if(action==='go-matter')navigate('matter');
    else if(action==='add-material')openPanel('material');
    else if(action==='remove-material')dispatchAction({type:'REMOVE_MATERIAL',id:el.dataset.id});
    else if(action==='view-material')openPanel('material-view',el.dataset.id);
    else if(action==='choose-matter')openPanel('choose-matter');
    else if(action==='link-matter'){const matter=(view.intake?.targets||[]).find(m=>m.id===el.dataset.id);closePanel();if(matter)dispatchAction({type:'LINK_MATTER',matter});}
    else if(action==='confirm-material') {
      const title=root.querySelector('[data-local="material-title"]').value.trim();const text=root.querySelector('[data-local="material-text"]').value;
      if(!text.trim()){root.querySelector('.rr-panel-error').textContent='原文内容不能为空';return;}
      closePanel();dispatchAction({type:'ADD_MATERIAL',material:{id:`material-${win.crypto?.randomUUID?.()||Date.now()}`,title:title||'选中材料',text,kind:'text'}});
    } else if(action==='select-fragment') {
      const range=selectedRange(root.querySelector('[data-original-text]'));
      openPanel('fragment',range);
    } else if(action==='confirm-fragment') {
      const text=root.querySelector('[data-local="fragment-text"]').value;const exact=panel?.data?.text===text&&original().slice(panel.data.start,panel.data.end)===text;const start=exact?panel.data.start:original().indexOf(text);
      if(!exact&&text&&original().indexOf(text,start+1)!==-1){root.querySelector('.rr-panel-error').textContent='原文有多个相同片段，请关闭后直接选中原文中的那一处。';return;}
      if(!text.trim()||start<0){root.querySelector('.rr-panel-error').textContent='所选片段必须能在原文中定位。';return;}
      closePanel();dispatchAction({type:'SELECT_FRAGMENT',start,end:start+text.length,text,baseVersion:view.impact?.baseVersion});
    } else if(action==='pick-fragment') {
      const f=(view.impact?.fragments||[]).find(f=>f.id===el.dataset.id);if(f)dispatchAction({type:'SELECT_FRAGMENT',start:f.start,end:f.end,text:f.text,baseVersion:f.baseVersion});
    } else if(action==='remove-fragment') {closePanel();dispatchAction({type:'REMOVE_FRAGMENT',id:view.impact?.selectedFragmentId});}
    else if(action==='set-relation'||action==='unknown')dispatchAction({type:'SET_RELATION',fragmentId:view.impact?.selectedFragmentId,relation:action==='unknown'?'unknown':el.dataset.relation});
    else if(action==='edit-relation')root.querySelector('[data-field="relation-note"]')?.focus();
    else if(action==='edit-raw')dispatchAction({type:'GO_SCREEN',screen:'intake'});
    else if(action==='view-source')openPanel('source');
    else if(action==='view-raw')openPanel('raw');
    else if(action==='old-version'){dispatchAction({type:'VIEW_OLD_VERSION'});openPanel('old');}
    else if(action==='undo')openPanel('undo');
    else if(action==='confirm-undo'){closePanel();dispatchAction({type:'REQUEST_UNDO'});}
    else if(action==='retry-work'){dispatchAction({type:'OPEN_RETRY'});openPanel('retry');}
    else if(action==='confirm-retry') {
      const destination=Object.fromEntries(['agent','project','task'].map(k=>[k,root.querySelector(`[data-local="retry-${k}"]`).value.trim()]));
      if(!destination.agent||!destination.project||!destination.task){root.querySelector('.rr-panel-error').textContent='请填写 Agent、项目和任务。';return;}
      closePanel();dispatchAction({type:'EDIT_RETRY_TARGET',destination});dispatchAction({type:'CONFIRM_RETRY_TARGET'});navigate('retry-work');
    } else if(action==='close-panel')closePanel();else if(action==='about')openPanel('about');
  }
  function onKeydown(event) {
    if(event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'&&panel){event.preventDefault();closePanel();return;}
    if(event.key==='Tab'&&panel) {
      const els=[...root.querySelectorAll('.rr-popover button:not(:disabled),.rr-popover input,.rr-popover textarea')];
      if(!els.length)return;const first=els[0],last=els.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  }
  const compositionStart=e=>composing.add(e.target);
  const compositionEnd=e=>{composing.delete(e.target);onInput(e);};
  root.addEventListener('compositionstart',compositionStart);root.addEventListener('compositionend',compositionEnd);
  root.addEventListener('input',onInput);root.addEventListener('click',onClick);root.addEventListener('keydown',onKeydown);
  if(win.ResizeObserver){resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(root);}else win.addEventListener('resize',resize);
  update(initialView);
  return {update,destroy(){if(destroyed)return;destroyed=true;resizeObserver?.disconnect();win.removeEventListener('resize',resize);root.removeEventListener('compositionstart',compositionStart);root.removeEventListener('compositionend',compositionEnd);root.removeEventListener('input',onInput);root.removeEventListener('click',onClick);root.removeEventListener('keydown',onKeydown);currentAnimation?.cancel();clearTimeout(toastTimer);for(const face of fonts)document.fonts.delete(face);root.remove();}};
}
