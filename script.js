const galaxy=document.getElementById("galaxy");
const gctx=galaxy.getContext("2d");
const canvas=document.getElementById("stars");
const ctx=canvas.getContext("2d");

let w=0,h=0,dpr=1,mouseX=.5,mouseY=.5,lastTime=0,scrollY=0,smoothScrollY=0,maxScroll=1,lastScrollForStars=0;
let stars=[], galaxyParticles=[], nebulaClouds=[], riftBlobs=[];
let bandAngle=-0.63, bandLength=0, bandWidth=0, coreU=0, coreSpread=0;

// Small deterministic pseudo-random helper so dust-rift shapes stay stable
// across frames (only the rotation of the whole band moves them).
function gaussianRand(){
  let u=0,v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*0.5;
}

function resize(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  w=window.innerWidth; h=window.innerHeight;

  galaxy.width=w*dpr; galaxy.height=h*dpr;
  galaxy.style.width=w+"px"; galaxy.style.height=h+"px";
  gctx.setTransform(dpr,0,0,dpr,0,0);

  canvas.width=w*dpr; canvas.height=h*dpr;
  canvas.style.width=w+"px"; canvas.style.height=h+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const count=Math.min(180,Math.floor((w*h)/8500));
  stars=Array.from({length:count},()=>{
    // Real starlight isn't pure white — bias toward blue-white, warm, or faint gold.
    const tRoll=Math.random();
    const tint=tRoll<.62?[235,236,255]:tRoll<.85?[255,244,222]:[196,214,255];
    return {
      x:Math.random()*w,y:Math.random()*h,
      r:Math.random()*1.1+.12,
      a:Math.random()*.44+.10,
      tw:Math.random()*Math.PI*2,
      twSpeed:Math.random()*.0014+.00025,
      vx:(Math.random()-.5)*.016,
      vy:(Math.random()-.5)*.010,
      depth:Math.random()*.8+.2,
      tint
    };
  });

  maxScroll=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);

  // A photographic Milky Way band: a dense diagonal star cloud (not a
  // face-on spiral), with a warm core patch, cooler haze toward the ends,
  // and a couple of winding dark dust rifts cutting through it.
  const diag=Math.sqrt(w*w+h*h);
  bandLength=diag*1.02;
  bandWidth=Math.min(w,h)*.6;
  coreU=-bandLength*.05;
  coreSpread=bandLength*.15;

  const pCount=Math.min(6200,Math.max(3000,Math.floor((w*h)/290)));
  galaxyParticles=Array.from({length:pCount},()=>{
    let u;
    if(Math.random()<.45){
      u=coreU+gaussianRand()*coreSpread*1.6;
    }else{
      u=(Math.random()-.5)*bandLength;
    }
    const distFromCore=Math.abs(u-coreU);
    const widthFactor=.32+.68*Math.exp(-(distFromCore*distFromCore)/(2*coreSpread*coreSpread*3.2));
    const v=gaussianRand()*bandWidth*widthFactor;

    const closeness=Math.max(0,1-Math.abs(v)/(bandWidth*widthFactor*.85+1));
    const coreness=Math.max(0,1-distFromCore/(coreSpread*2.4))*closeness;

    const isKnot=Math.random()<.03 && closeness>.35;
    const isNebulaSpeck=!isKnot && Math.random()<.028 && closeness>.3;

    let hue;
    if(coreness>.58){
      hue=[255,222,190];
    }else if(isNebulaSpeck){
      hue=[255,152,188];
    }else if(isKnot){
      hue=[196,214,255];
    }else{
      const mix=1-closeness;
      hue=[Math.round(216-18*mix),Math.round(206-14*mix),Math.round(232+12*mix)];
    }

    return {
      u,v,
      size:isKnot?Math.random()*1.45+1.05:Math.random()*.82+.2,
      alphaBase:isKnot?Math.random()*.32+.56:Math.random()*.78+.18,
      phase:Math.random()*Math.PI*2,
      twSpeed:.0007+Math.random()*.0017,
      hue,
      closeness,
      coreness
    };
  });

  // Soft glowing haze blobs threaded along the band, drawn beneath the stars,
  // elongated along the band direction to build up the diffuse photographic wash.
  nebulaClouds=Array.from({length:22},()=>{
    let u;
    if(Math.random()<.5){
      u=coreU+gaussianRand()*coreSpread*1.4;
    }else{
      u=(Math.random()-.5)*bandLength;
    }
    const distFromCore=Math.abs(u-coreU);
    const widthFactor=.32+.68*Math.exp(-(distFromCore*distFromCore)/(2*coreSpread*coreSpread*3.2));
    const v=gaussianRand()*bandWidth*widthFactor*.6;
    const coreness=Math.max(0,1-distFromCore/(coreSpread*2.2));
    const warm=[255,200,162], mid=[215,150,205], cool=[135,145,235];
    const color=coreness>.5?warm:(Math.random()<.5?mid:cool);
    return {
      u,v,
      size:bandWidth*(.18+Math.random()*.26)*(.6+coreness*.6),
      elong:2.2+Math.random()*2.2,
      alpha:.05+Math.random()*.06+coreness*.06,
      color
    };
  });

  riftBlobs=buildRiftBlobs(rift1,bandWidth*.075,.5)
    .concat(buildRiftBlobs(rift2,bandWidth*.04,.4));
}


function drawStars(time=0){
  const dt=Math.min(34,time-lastTime||16);
  lastTime=time;
  ctx.clearRect(0,0,w,h);

  for(const s of stars){
    s.tw+=s.twSpeed*dt;
    s.x += s.vx*dt + (mouseX-.5)*.003*s.depth*dt;
    s.y += s.vy*dt + (mouseY-.5)*.0018*s.depth*dt + (smoothScrollY-lastScrollForStars)*.00002*s.depth;
    if(s.x<-4)s.x=w+4;if(s.x>w+4)s.x=-4;
    if(s.y<-4)s.y=h+4;if(s.y>h+4)s.y=-4;

    const alpha=Math.max(.035,s.a+Math.sin(s.tw)*.12);
    ctx.beginPath();
    ctx.fillStyle=`rgba(${s.tint[0]},${s.tint[1]},${s.tint[2]},${alpha})`;
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fill();
    if(s.r>1.0){
      ctx.beginPath();
      ctx.fillStyle=`rgba(${s.tint[0]},${s.tint[1]},${s.tint[2]},${alpha*.24})`;
      ctx.arc(s.x,s.y,s.r*2,0,Math.PI*2);
      ctx.fill();
    }
  }
  lastScrollForStars=smoothScrollY;
}

// Two winding dust-rift lanes that cut across the band, as a function of
// position along it — this is what gives the photo its dark cracks.
function rift1(u){ return Math.sin(u*.0031+.4)*bandWidth*.22+Math.sin(u*.011+2.1)*bandWidth*.08; }
function rift2(u){ return Math.sin(u*.0058+3.3)*bandWidth*.13-bandWidth*.09; }

function riftShade(u,v){
  const d1=Math.abs(v-rift1(u));
  const hw1=bandWidth*.075;
  const d2=Math.abs(v-rift2(u));
  const hw2=bandWidth*.04;

  let shade=1;
  if(d1<hw1) shade=Math.min(shade,.08+.92*(d1/hw1));
  if(d2<hw2) shade=Math.min(shade,.16+.84*(d2/hw2));
  return shade;
}

// Precompute the visible dark dust-lane shapes as a chain of soft, elongated
// dark blobs threaded along each rift curve — drawn on top of the stars so
// they physically read as obscuring cracks, like the photo.
function buildRiftBlobs(riftFn,halfWidth,baseAlpha){
  const blobs=[];
  const steps=52;
  for(let i=0;i<=steps;i++){
    const u=-bandLength*.5+bandLength*i/steps;
    const v=riftFn(u);
    const fade=Math.max(0,1-Math.pow(Math.abs(u-coreU)/(bandLength*.56),2));
    if(fade<=.02) continue;
    blobs.push({u,v,size:halfWidth*1.6,elong:3.4,alpha:baseAlpha*fade});
  }
  return blobs;
}

function drawGalaxy(time=0){
  gctx.clearRect(0,0,w,h);

  // Ease the raw scroll position so the scroll-linked motion glides
  // instead of jumping frame to frame.
  smoothScrollY += (scrollY-smoothScrollY)*.075;
  const scrollFrac=Math.min(1,Math.max(0,smoothScrollY/maxScroll));

  const cx=w*.50 + (mouseX-.5)*18;
  const cy=h*.46 + (mouseY-.5)*10 + scrollFrac*46;

  // Slow real-time rotation + scroll-linked rotation, eased via smoothScrollY —
  // the whole band gently sweeps across the sky as you scroll.
  const t=time*.000012;
  const scrollRotation=smoothScrollY*.00016;
  const angle=bandAngle+t+scrollRotation;
  const dirX=Math.cos(angle), dirY=Math.sin(angle);
  const perpX=-Math.sin(angle), perpY=Math.cos(angle);

  // A gentle zoom as the page scrolls, plus the scene dimming slightly as
  // it "recedes" further down the page.
  const scale=1+scrollFrac*.16;
  gctx.globalAlpha=1-scrollFrac*.22;

  // Soft glowing haze, drawn first so the star field reads on top.
  for(const n of nebulaClouds){
    const x=cx+(n.u*dirX+n.v*perpX)*scale;
    const y=cy+(n.u*dirY+n.v*perpY)*scale - smoothScrollY*.026;
    if(x<-260||x>w+260||y<-260||y>h+260) continue;

    gctx.save();
    gctx.translate(x,y);
    gctx.rotate(angle);
    gctx.scale(n.elong,1);
    const grad=gctx.createRadialGradient(0,0,0,0,0,n.size*scale);
    grad.addColorStop(0,`rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.alpha})`);
    grad.addColorStop(1,"rgba(0,0,0,0)");
    gctx.fillStyle=grad;
    gctx.beginPath();
    gctx.arc(0,0,n.size*scale,0,Math.PI*2);
    gctx.fill();
    gctx.restore();
  }

  for(const p of galaxyParticles){
    const x=cx+(p.u*dirX+p.v*perpX)*scale;
    const y=cy+(p.u*dirY+p.v*perpY)*scale - smoothScrollY*.026;

    if(x<-20||x>w+20||y<-20||y>h+20) continue;

    const tw=.82+.18*Math.sin(p.phase+time*p.twSpeed);
    let alpha=Math.min(.85,p.alphaBase*(.4+p.closeness*1.25)*tw);
    alpha*=riftShade(p.u,p.v);

    gctx.beginPath();
    gctx.fillStyle=`rgba(${p.hue[0]},${p.hue[1]},${p.hue[2]},${alpha})`;
    gctx.arc(x,y,Math.max(.18,p.size*scale),0,Math.PI*2);
    gctx.fill();

    // Soft halo around bright star-forming knots.
    if(p.size>1.1){
      gctx.beginPath();
      gctx.fillStyle=`rgba(${p.hue[0]},${p.hue[1]},${p.hue[2]},${alpha*.18})`;
      gctx.arc(x,y,p.size*scale*2.6,0,Math.PI*2);
      gctx.fill();
    }
  }

  // Dark dust-lane cracks, drawn on top of the stars so they visibly
  // obscure them — this is what reads as the photo's winding rifts.
  for(const rb of riftBlobs){
    const x=cx+(rb.u*dirX+rb.v*perpX)*scale;
    const y=cy+(rb.u*dirY+rb.v*perpY)*scale - smoothScrollY*.026;
    if(x<-260||x>w+260||y<-260||y>h+260) continue;

    gctx.save();
    gctx.translate(x,y);
    gctx.rotate(angle);
    gctx.scale(rb.elong,1);
    const grad=gctx.createRadialGradient(0,0,0,0,0,rb.size*scale);
    grad.addColorStop(0,`rgba(7,5,9,${rb.alpha})`);
    grad.addColorStop(1,"rgba(7,5,9,0)");
    gctx.fillStyle=grad;
    gctx.beginPath();
    gctx.arc(0,0,rb.size*scale,0,Math.PI*2);
    gctx.fill();
    gctx.restore();
  }

  // Warm core glow, positioned along the band.
  const coreX=cx+(coreU*dirX)*scale;
  const coreY=cy+(coreU*dirY)*scale - smoothScrollY*.026;
  const glow=gctx.createRadialGradient(coreX,coreY,0,coreX,coreY,bandWidth*.55);
  glow.addColorStop(0,"rgba(255,214,180,.20)");
  glow.addColorStop(.35,"rgba(230,180,175,.09)");
  glow.addColorStop(.68,"rgba(150,140,220,.045)");
  glow.addColorStop(1,"rgba(0,0,0,0)");
  gctx.fillStyle=glow;
  gctx.fillRect(0,0,w,h);

  gctx.globalAlpha=1;
  requestAnimationFrame(drawFrame);
}

function drawFrame(time){
  drawStars(time);
  drawGalaxy(time);
}

resize();
requestAnimationFrame(drawFrame);

window.addEventListener("resize",resize);
window.addEventListener("scroll",()=>{scrollY=window.scrollY;});
window.addEventListener("mousemove",e=>{
  mouseX=e.clientX/w;
  mouseY=e.clientY/h;
});

function spawnMainShootingStar(){
  if(document.hidden)return;
  const star=document.createElement("span");
  star.className="shooting-star";
  const startX=window.innerWidth+100;
  const startY=window.innerHeight*(0.60+Math.random()*0.20);
  const travelX=window.innerWidth*(.95+Math.random()*.20);
  const travelY=-(window.innerHeight*(.62+Math.random()*.10));
  const duration=3900+Math.random()*700;
  const angle=-150+(Math.random()*5-2.5);
  star.style.left=startX+"px";
  star.style.top=startY+"px";
  document.body.appendChild(star);
  star.animate([
    {transform:`translate(0,0) rotate(${angle}deg) scale(.48)`,opacity:0},
    {transform:`translate(${-travelX*.10}px,${travelY*.10}px) rotate(${angle}deg) scale(1)`,opacity:.92,offset:.10},
    {transform:`translate(${-travelX*.58}px,${travelY*.58}px) rotate(${angle}deg) scale(.92)`,opacity:.68,offset:.70},
    {transform:`translate(${-travelX}px,${travelY}px) rotate(${angle}deg) scale(.65)`,opacity:0}
  ],{duration,easing:"cubic-bezier(.18,.48,.22,1)"});
  setTimeout(()=>star.remove(),duration+100);
}
setInterval(spawnMainShootingStar,12000);
setTimeout(spawnMainShootingStar,3000);

function spawnTinyStreak(){
  if(document.hidden)return;
  const streak=document.createElement("span");
  streak.className="tiny-streak";
  const left=Math.random()>.5;
  streak.style.left=left?(-20-Math.random()*80)+"px":(window.innerWidth+20)+"px";
  streak.style.top=(Math.random()*window.innerHeight*.75)+"px";
  document.body.appendChild(streak);
  const dx=left?(80+Math.random()*120):-(80+Math.random()*120);
  const dy=20+Math.random()*50;
  const angle=left?18+Math.random()*8:162+Math.random()*8;
  const duration=1150+Math.random()*700;
  streak.animate([
    {transform:`translate(0,0) rotate(${angle}deg)`,opacity:0},
    {transform:`translate(${dx*.45}px,${dy*.45}px) rotate(${angle}deg)`,opacity:.34,offset:.3},
    {transform:`translate(${dx}px,${dy}px) rotate(${angle}deg)`,opacity:0}
  ],{duration,easing:"ease-out"});
  setTimeout(()=>streak.remove(),duration+80);
}
setInterval(()=>{if(Math.random()>.48)spawnTinyStreak()},3600);

const cursor=document.querySelector(".cursor-star");
let mx=-100,my=-100,cx=-100,cy=-100,rot=0;
window.addEventListener("mousemove",e=>{mx=e.clientX;my=e.clientY;cursor?.classList.add("active");});
function moveCursor(){
  cx += (mx-cx)*.18; cy += (my-cy)*.18; rot+=1.5;
  if(cursor) cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%) rotate(${rot}deg)`;
  requestAnimationFrame(moveCursor);
}
moveCursor();
window.addEventListener("mouseleave",()=>cursor?.classList.remove("active"));

const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add("show");
      observer.unobserve(e.target);
    }
  });
},{threshold:.12,rootMargin:"0px 0px -40px 0px"});
document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));

const menu=document.querySelector(".menu"), nav=document.querySelector(".nav nav");
menu?.addEventListener("click",()=>nav.classList.toggle("open"));
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));

window.addEventListener("scroll",()=>{
  const header=document.querySelector(".nav");
  if(header) header.style.boxShadow=window.scrollY>20?"0 8px 30px rgba(0,0,0,.22)":"none";

  // Very subtle mouse + scroll parallax for the hero orbit/photo.
  const hero=document.querySelector(".hero-photo");
  if(hero){
    const offset=(window.scrollY*.05);
    hero.style.transform=`translate3d(${(mouseX-.5)*8}px,${offset*.02}px,0)`;
  }
});
