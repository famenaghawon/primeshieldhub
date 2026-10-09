// ======================================================================
// ERROR PAGES
// ======================================================================

export const ERROR_404_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>404 | QUANTUM CORE FAILURE — PrimeShieldHub</title>
  <meta name="description" content="Quantum disruption detected. The requested resource in the PrimeShieldHub continuum has been lost to a spacetime anomaly. Initiate recovery protocol.">
  <meta name="theme-color" content="#000000">
  <link rel="canonical" href="https://primeshieldhub.com/404">
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--bg-deep:#010105;--glow-cyan:#00f7ff;--glow-purple:#b200ff;--glow-gold:#ffd966;--card-bg:rgba(8,12,25,0.65);--text-primary:#f0f3ff;--text-secondary:#9ca3cf}
    body{font-family:'Inter','Space Grotesk',sans-serif;background-color:var(--bg-deep);color:var(--text-primary);overflow-x:hidden;height:100vh;width:100%;position:relative}
    #canvas-container{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;outline:none}
    .ui-overlay{position:relative;z-index:10;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;backdrop-filter:blur(2px)}
    .quantum-core-card{max-width:1200px;width:100%;background:var(--card-bg);backdrop-filter:blur(20px);border:1px solid rgba(0,247,255,0.25);border-radius:2rem;padding:2rem 2.5rem;box-shadow:0 30px 50px rgba(0,0,0,0.6),0 0 0 1px rgba(0,247,255,0.1) inset;animation:floatIn 0.8s cubic-bezier(0.2,0.9,0.4,1.1)}
    @keyframes floatIn{0%{opacity:0;transform:translateY(40px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
    .glitch{font-size:12rem;font-weight:900;font-family:'Space Grotesk',monospace;position:relative;text-shadow:0.05em 0 0 rgba(255,0,100,0.75),-0.05em -0.025em 0 rgba(0,255,255,0.75);animation:glitch-shake 0.3s infinite alternate;background:linear-gradient(135deg,#fff,#00f7ff,#b200ff);-webkit-background-clip:text;background-clip:text;color:transparent}
    .glitch::before,.glitch::after{content:"404";position:absolute;top:0;left:0;width:100%;height:100%}
    .glitch::before{left:4px;text-shadow:-2px 0 #ff00c1;clip-path:polygon(0 0,100% 0,100% 45%,0 45%);animation:glitch-anim 0.4s infinite linear alternate-reverse}
    .glitch::after{left:-4px;text-shadow:-2px 0 #00fff9;clip-path:polygon(0 80%,100% 20%,100% 100%,0 100%);animation:glitch-anim2 0.3s infinite linear alternate-reverse}
    @keyframes glitch-anim{0%{clip-path:polygon(0 0,100% 0,100% 30%,0 30%)}100%{clip-path:polygon(0 0,100% 0,100% 70%,0 70%);transform:translate(2px,-2px)}}
    @keyframes glitch-anim2{0%{clip-path:polygon(0 60%,100% 40%,100% 100%,0 100%)}100%{clip-path:polygon(0 80%,100% 60%,100% 100%,0 100%);transform:translate(-1px,1px)}}
    @keyframes glitch-shake{0%{transform:skew(0deg,0deg)}100%{transform:skew(1deg,-0.5deg)}}
    .subtitle{font-size:1.6rem;font-weight:600;background:linear-gradient(135deg,#fff,#aaccff);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:1rem;text-align:center}
    .description{color:var(--text-secondary);font-size:1.1rem;max-width:650px;margin:0 auto 2rem auto;line-height:1.5;text-align:center}
    .diagnostic-panel{background:rgba(0,0,0,0.55);border-radius:1.2rem;padding:1.5rem;margin:2rem 0;border-left:4px solid var(--glow-cyan);backdrop-filter:blur(8px)}
    .diagnostic-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,247,255,0.3);padding-bottom:0.75rem;margin-bottom:1.5rem;font-family:'JetBrains Mono',monospace;font-size:0.85rem}
    .diagnostic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
    .diag-item{background:rgba(0,0,0,0.4);padding:0.8rem 1rem;border-radius:1rem;border:1px solid rgba(0,247,255,0.2)}
    .diag-label{font-size:0.7rem;text-transform:uppercase;color:#8f9bb5;margin-bottom:0.4rem}
    .diag-value{font-family:'JetBrains Mono',monospace;font-size:1.1rem;font-weight:600;color:var(--glow-cyan)}
    .action-group{display:flex;flex-wrap:wrap;justify-content:center;gap:1.2rem;margin:2rem 0 1.5rem}
    .quantum-btn{display:inline-flex;align-items:center;gap:10px;padding:0.9rem 2rem;font-weight:600;border-radius:60px;background:rgba(16,20,35,0.8);backdrop-filter:blur(5px);border:1px solid rgba(0,247,255,0.4);color:#fff;cursor:pointer;text-decoration:none;transition:all 0.25s}
    .quantum-btn.primary{background:linear-gradient(95deg,#00a3ff,#7700ff);border:none;box-shadow:0 0 15px rgba(0,163,255,0.4)}
    .quantum-btn.primary:hover{transform:translateY(-3px);box-shadow:0 0 25px rgba(0,163,255,0.7)}
    .quantum-search{max-width:500px;margin:0 auto 1rem;position:relative}
    .quantum-search input{width:100%;background:rgba(0,0,0,0.6);border:1px solid rgba(0,247,255,0.5);padding:1rem 1rem 1rem 3rem;border-radius:60px;color:#fff}
    .quantum-search i{position:absolute;left:1.2rem;top:50%;transform:translateY(-50%);color:#00f7ff}
    .footer-brand{margin-top:2.5rem;text-align:center;font-size:0.8rem;border-top:1px solid rgba(255,255,255,0.1);padding-top:2rem}
    .owner-sign{color:#ffd966;font-weight:600}
    @media(max-width:760px){.glitch{font-size:5rem}.subtitle{font-size:1.2rem}.quantum-core-card{padding:1.5rem}}
  </style>
</head>
<body>
<div id="canvas-container"></div>
<div class="ui-overlay"><div class="quantum-core-card"><div style="text-align:center"><div class="glitch">404</div><div class="subtitle">✦ QUANTUM PATHWAY COLLAPSE ✦</div><div class="description">The hyperdimensional link you requested does not exist in the PrimeShieldHub continuum.<br>Anomaly signature: <span id="error-path" style="color:#ff77aa;font-family:monospace">/unknown/resource</span></div></div>
<div class="diagnostic-panel"><div class="diagnostic-header"><span><i class="fas fa-microchip"></i> QUANTUM CORE DIAGNOSTICS v2.6.7</span><span id="live-timestamp">--:--:--</span></div>
<div class="diagnostic-grid"><div class="diag-item"><div class="diag-label">Continuum Stability Index</div><div class="diag-value" id="stability-index">0.00 σ</div></div><div class="diag-item"><div class="diag-label">Quantum Entanglement</div><div class="diag-value" id="entanglement">-- %</div></div><div class="diag-item"><div class="diag-label">Resonance Frequency</div><div class="diag-value" id="resonance">-- THz</div></div><div class="diag-item"><div class="diag-label">Wholesale Nexus</div><div class="diag-value" style="color:#33ffaa">ONLINE · READY</div></div></div></div>
<div class="action-group"><a href="/" class="quantum-btn primary"><i class="fas fa-arrow-rotate-left"></i> RECONSTRUCT HOME</a><a href="#" id="search-trigger" class="quantum-btn secondary"><i class="fas fa-globe"></i> QUANTUM SEARCH</a><a href="https://wa.me/2348103535978" target="_blank" class="quantum-btn secondary"><i class="fab fa-whatsapp"></i> SECURE CHANNEL</a></div>
<div class="quantum-search"><i class="fas fa-search"></i><input type="text" id="quantumSearchInput" placeholder="Scan inventory, reseller portal, or product ID..."></div>
<div class="footer-brand"><div><span style="font-weight:800;background:linear-gradient(135deg,#ffd966,#ffaa33);-webkit-background-clip:text;background-clip:text;color:transparent">PRIMESHIELDHUB</span><span>© 2026 — All continua secured</span></div><div class="owner-sign">— Freedom Evbakoe Amenaghawon</div></div></div></div>
<script>
  document.getElementById('error-path').innerText = window.location.pathname;
  setInterval(function(){document.getElementById('live-timestamp').innerText=new Date().toLocaleTimeString('en-US',{hour12:false});},1000);
  var stability=0.42;
  setInterval(function(){stability=0.32+Math.sin(Date.now()*0.0023)*0.12+Math.random()*0.05;document.getElementById('stability-index').innerHTML=stability.toFixed(2)+' σ';document.getElementById('entanglement').innerHTML=(78+Math.sin(Date.now()*0.0017)*12+Math.random()*4).toFixed(1)+' %';document.getElementById('resonance').innerHTML=(442+Math.sin(Date.now()*0.004)*18).toFixed(1)+' THz';},380);
  var searchInput=document.getElementById('quantumSearchInput');
  var searchBtn=document.getElementById('search-trigger');
  function doSearch(){var q=searchInput.value.trim();if(q){var o=document.createElement('div');o.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;color:#0ff';o.innerHTML='<div style="text-align:center"><i class="fas fa-satellite-dish fa-3x"></i><h2 style="margin-top:1rem">Quantum Scan: "'+q+'"</h2><p style="margin-top:1rem">Redirecting...</p></div>';document.body.appendChild(o);setTimeout(function(){window.location.href='/?search='+encodeURIComponent(q);},1400);}}
  if(searchInput)searchInput.addEventListener('keypress',function(e){if(e.key==='Enter')doSearch();});
  if(searchBtn)searchBtn.addEventListener('click',function(e){e.preventDefault();doSearch();});
</script>
</body>
</html>`;
