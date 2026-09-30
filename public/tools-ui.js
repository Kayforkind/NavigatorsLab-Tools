(function(){
"use strict";
var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* ---- nav ---- */
var nav = document.getElementById("nav");
addEventListener("scroll", function(){ nav.classList.toggle("scrolled", scrollY > 24); }, {passive:true});
/* ---- reveals ---- */
var io = new IntersectionObserver(function(es){ es.forEach(function(e){
  if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }); }, {threshold:.12, rootMargin:"0px 0px -6% 0px"});
document.querySelectorAll(".rv").forEach(function(el){ io.observe(el); });
/* ---- counters ---- */
var cio = new IntersectionObserver(function(es){ es.forEach(function(e){
  if(!e.isIntersecting) return; cio.unobserve(e.target);
  var el = e.target, target = parseInt(el.dataset.count, 10), suf = el.dataset.suffix || "";
  if(reduce){ el.textContent = target + suf; return; }
  var t0 = performance.now(), dur = 1400;
  (function tick(t){ var p = Math.min((t - t0)/dur, 1), ez = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(target * ez) + suf;
    if(p < 1) requestAnimationFrame(tick); })(t0);
}); }, {threshold:.4});
document.querySelectorAll("[data-count]").forEach(function(el){ cio.observe(el); });
/* ---- magnetic ---- */
if(!reduce && matchMedia("(pointer:fine)").matches){
  document.querySelectorAll(".magnetic").forEach(function(el){
    el.addEventListener("pointermove", function(e){
      var r = el.getBoundingClientRect(),
          x = e.clientX - r.left - r.width/2, y = e.clientY - r.top - r.height/2;
      el.style.transform = "translate(" + x*.18 + "px," + y*.28 + "px)"; });
    el.addEventListener("pointerleave", function(){ el.style.transform = ""; }); });
}
/* ---- tilt cards ---- */
if(!reduce && matchMedia("(pointer:fine)").matches){
  document.querySelectorAll(".tilt").forEach(function(card){
    card.addEventListener("pointermove", function(e){
      var r = card.getBoundingClientRect(),
          x = (e.clientX - r.left)/r.width - .5, y = (e.clientY - r.top)/r.height - .5;
      card.style.transform = "perspective(900px) rotateX(" + (-y*7) + "deg) rotateY(" + (x*9) + "deg) translateY(-4px)"; });
    card.addEventListener("pointerleave", function(){ card.style.transform = ""; }); });
}
/* ---- hero stage parallax ---- */
var stage = document.getElementById("stageInner");
if(stage && !reduce && matchMedia("(pointer:fine)").matches){
  addEventListener("pointermove", function(e){
    var x = e.clientX/innerWidth - .5, y = e.clientY/innerHeight - .5;
    stage.style.transform = "rotateX(" + (-y*8) + "deg) rotateY(" + (x*12) + "deg)"; }, {passive:true});
}
/* ---- faq ---- */
document.querySelectorAll(".faq-item").forEach(function(item){
  var q = item.querySelector(".faq-q"), a = item.querySelector(".faq-a");
  q.addEventListener("click", function(){
    var open = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach(function(o){
      o.classList.remove("open"); o.querySelector(".faq-a").style.maxHeight = null; });
    if(!open){ item.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; } });
});
/* ---- cinematic void: perspective grid + particle field (deferred: decorative) ---- */
function startVoid(){
var cv = document.getElementById("void");
if(cv && !reduce){
  var ctx = cv.getContext("2d"), W, H, DPR = Math.min(devicePixelRatio || 1, 2);
  var stars = [], N = 150, horizon, running = true, last = 0;
  function resize(){ W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
    horizon = H*.62;
    stars = []; for(var i=0;i<N;i++) stars.push(spawn(true)); }
  function spawn(any){ return { x: Math.random()*2-1, y: Math.random()*2-1,
    z: any ? Math.random() : 1, s: Math.random()*1.6+.4, hue: Math.random() }; }
  var t = 0;
  function frame(now){
    requestAnimationFrame(frame);
    if(!running || document.hidden) return;
    if(now - last < 34) return; /* ~30fps cap */
    last = now;
    t += .007;
    ctx.clearRect(0,0,W,H);
    /* grid floor */
    ctx.strokeStyle = "rgba(94,234,212,.06)"; ctx.lineWidth = 1;
    var cx = W/2;
    for(var i=-14;i<=14;i++){ ctx.beginPath(); ctx.moveTo(cx + i*W*.045, horizon);
      ctx.lineTo(cx + i*W*.16, H); ctx.stroke(); }
    var off = (t*H*.55) % (H*.09);
    for(var r=0;r<8;r++){ var gy = horizon + r*r*H*.012 + off*.4;
      if(gy > H) continue;
      ctx.globalAlpha = Math.min(.28, (gy-horizon)/H*.9);
      ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
    ctx.globalAlpha = 1;
    /* stars */
    stars.forEach(function(p){
      p.z -= .0022; if(p.z <= .02) Object.assign(p, spawn(false));
      var sx = cx + p.x/p.z * W*.5, sy = horizon + (p.y*.5+.5)/p.z * (H-horizon)*.5;
      if(sy > H || sx < 0 || sx > W) return;
      var a = Math.min(1, (1-p.z)*1.2)*.85;
      ctx.fillStyle = p.hue > .82 ? "rgba(167,139,250,"+a+")" : "rgba(94,234,212,"+a+")";
      ctx.beginPath(); ctx.arc(sx, sy, p.s*(1-p.z)*2+.3, 0, 7); ctx.fill(); });
  }
  new IntersectionObserver(function(es){ running = es[0].isIntersecting; },
    {threshold: 0}).observe(cv.closest(".hero"));
  addEventListener("resize", resize); resize(); requestAnimationFrame(frame);
}
}
if("requestIdleCallback" in window) requestIdleCallback(startVoid, {timeout: 2500});
else setTimeout(startVoid, 60);
})();
