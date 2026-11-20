import { isMotionPaused } from './motion.js';

(() => {
  'use strict';
  const root=document.documentElement,body=document.body;
  const sections=[...document.querySelectorAll('.journey-content>section')];
  const links=[...document.querySelectorAll('.header-nav a,.depth-nav a,.mobile-menu a')];
  const toggle=document.querySelector('.menu-toggle'),menu=document.getElementById('mobile-menu');
  const current=document.getElementById('chapter-current'),next=document.getElementById('chapter-next');
  const masthead=document.querySelector('.masthead');
  const menuBackground=document.querySelectorAll('main,.skip-link,.journey-dock,.depth-nav');
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/Math.max(1,b-a));return t*t*(3-2*t);};
  const state={visual:0,page:0,depth:0,logoOpacity:1,drift:0,chapter:0};
  let positions=[],height=innerHeight,diveEnd=height*3,travel=height*7,active=-1,resizeFrame=0;
  body.classList.add('has-js');
  function update(){
    const y=Math.max(0,scrollY);
    state.visual=clamp(y/diveEnd);state.page=clamp(y/travel);
    state.depth=smooth(positions[3]-height*.35,positions[6]-height*.3,y);
    state.drift=smooth(height*.28,height*1.15,y);
    state.logoOpacity=1-smooth(height*(innerWidth<701?.43:.55),height*(innerWidth<701?1.05:1.2),y);
    root.style.setProperty('--page',state.page.toFixed(5));
    root.style.setProperty('--veil',(smooth(height*.47,height*1.12,y)*(.72+state.depth*.05)).toFixed(4));
    root.style.setProperty('--route',smooth(positions[1]-height*.4,positions[1]+height*.35,y).toFixed(4));
    body.classList.toggle('is-reading',y>height*.4);
    body.classList.toggle('at-surface',y<height);
    if(y<height)root.style.setProperty('--still-offset',`-${y}px`);
    let chapter=0;for(let i=1;i<positions.length;i++)if(y+height*.44>=positions[i])chapter=i;
    state.chapter=chapter;if(chapter===active)return;active=chapter;
    const id=sections[chapter].id,label=sections[chapter].dataset.label;
    links.forEach(link=>{if(link.hash==='#'+id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    const index=document.createElement('span');index.textContent=String(chapter+1).padStart(2,'0');
    const slash=document.createElement('i');slash.textContent='/';
    current.replaceChildren(index,slash,document.createTextNode(label));
    const destination=sections[(chapter+1)%sections.length];next.href='#'+destination.id;
    const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('viewBox','0 0 16 16');arrow.classList.add('ui-arrow');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',chapter===sections.length-1?'M8 13V3M4 7l4-4 4 4':'M8 3v10M4 9l4 4 4-4');arrow.append(path);
    next.replaceChildren(document.createTextNode(chapter===sections.length-1?'The surface':destination.dataset.label),arrow);
    document.getElementById('phase-announcement').textContent=label.replace(/[.?!]$/,'')+'.';
  }
  function measure(){
    if(!menu.hidden&&!toggle.getClientRects().length){
      closeMenu();
      masthead.querySelector('.brand').focus();
    }
    height=document.getElementById('stage').clientHeight||innerHeight;
    root.style.setProperty('--header-height', `${masthead.offsetHeight}px`);
    positions=sections.map(el=>el.getBoundingClientRect().top+scrollY);
    diveEnd=Math.max(height*2.2,Math.min(height*2.45,positions[3]-height*.28));
    travel=Math.max(1,document.getElementById('experience').offsetHeight-height);
    update();
  }
  function closeMenu(restoreFocus=false){
    menu.hidden=true;toggle.setAttribute('aria-expanded','false');body.classList.remove('menu-open');
    menuBackground.forEach(element=>{element.inert=false;});
    if(restoreFocus)toggle.focus();
  }
  toggle.addEventListener('click',()=>{
    if(!menu.hidden){closeMenu(true);return;}
    toggle.setAttribute('aria-expanded','true');
    menu.hidden=false;body.classList.add('menu-open');
    menuBackground.forEach(element=>{element.inert=true;});
    menu.scrollTop=0;
    menu.querySelector('a').focus();
  });
  document.addEventListener('keydown',e=>{
    if(menu.hidden)return;
    if(e.key==='Escape'){closeMenu(true);return;}
    if(e.key==='Tab'){
      const items=[...masthead.querySelectorAll('a,button'),...menu.querySelectorAll('a')].filter(item=>item.getClientRects().length);
      const index=items.indexOf(document.activeElement);
      if(e.shiftKey&&index===0){e.preventDefault();items.at(-1).focus();}
      else if(!e.shiftKey&&index===items.length-1){e.preventDefault();items[0].focus();}
    }
  });
  document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',e=>{
    const target=document.getElementById(link.hash.slice(1));if(!target)return;
    e.preventDefault();closeMenu();
    const offset=masthead.offsetHeight+12;
    const y=Math.max(0,target.getBoundingClientRect().top+scrollY-(target.id==='surface'?0:offset));
    history.replaceState(null,'',link.hash);
    window.scrollTo({top:y,behavior:isMotionPaused()?'instant':'smooth'});
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
  }));
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.12,rootMargin:'0px 0px -5% 0px'});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  }else document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;measure();});},{passive:true});
  window.addEventListener('load',measure,{once:true});
  if('ResizeObserver' in window){
    const observer=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;measure();});});
    observer.observe(document.querySelector('.journey-content'));
    observer.observe(masthead);
  }
  window.TDCJourney={state,target:()=>clamp(scrollY/diveEnd),render:p=>root.style.setProperty('--p',p.toFixed(5))};
  measure();
})();
