#!/bin/bash
# Jalankan dari folder ai-ecosystem
# bash update-chatbot.sh

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Jalankan dari folder ai-ecosystem!"
    echo "   cd ~/ai-ecosystem && bash update-chatbot.sh"
    exit 1
fi

echo "▶ Menulis index.html baru..."

cat > frontend-chatbot/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Agent</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0c0e13;--bg2:#12151f;--bg3:#1a1d2e;--bg4:#1e2235;
  --border:#252a3d;--border2:#2d3348;
  --analyst:#4f8ef7;--critic:#f7614f;--synth:#4fca8e;
  --accent:#a78bfa;--text:#dde3f0;--text2:#7a84a0;
}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.header{height:54px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0}
.logo{font-size:15px;font-weight:600;font-family:monospace;letter-spacing:1px;color:var(--accent)}
.pills{display:flex;gap:6px;align-items:center}
.pill{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;font-family:monospace}
.pill.a{background:rgba(79,142,247,.2);color:var(--analyst);border:1px solid rgba(79,142,247,.3)}
.pill.c{background:rgba(247,97,79,.2);color:var(--critic);border:1px solid rgba(247,97,79,.3)}
.pill.s{background:rgba(79,202,142,.2);color:var(--synth);border:1px solid rgba(79,202,142,.3)}
.modes{display:flex;gap:6px;margin-left:auto}
.mbtn{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:12px;cursor:pointer;transition:all .2s}
.mbtn.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.app{display:flex;flex:1;min-height:0}
.sidebar{width:220px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
.sb-sec{padding:12px;border-bottom:1px solid var(--border)}
.sb-lbl{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:monospace}
.nb{width:100%;padding:8px 12px;border-radius:8px;border:1px dashed var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:13px;text-align:left;transition:all .2s}
.nb:hover{background:var(--bg3);color:var(--text)}
.clist{flex:1;overflow-y:auto;padding:8px}
.ci{padding:9px 12px;border-radius:8px;cursor:pointer;margin-bottom:2px;border-left:2px solid transparent;transition:all .2s}
.ci:hover{background:var(--bg3)}
.ci.on{background:var(--bg4);border-left-color:var(--accent)}
.ci-t{font-size:13px;font-weight:500}
.ci-d{font-size:11px;color:var(--text2);margin-top:2px}
.sb-bot{padding:12px;border-top:1px solid var(--border)}
.mi{font-size:11px;font-family:monospace;color:var(--text2);margin-bottom:6px}
.dl{font-size:12px;color:var(--text2);cursor:pointer}
.dl:hover{color:var(--accent)}
.chat{flex:1;display:flex;flex-direction:column;min-width:0}
.pbar{height:32px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:8px;font-size:12px;color:var(--text2);transition:all .3s}
.pbar.hid{display:none}
.ps{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;font-size:12px}
.ps.on{background:var(--bg4);color:var(--text);font-weight:500}
.ps.done{color:var(--synth)}
.pn{width:15px;height:15px;border-radius:50%;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:9px;font-family:monospace}
.ps.on .pn{background:var(--accent);border-color:var(--accent);color:#fff}
.ps.done .pn{background:var(--synth);border-color:var(--synth);color:#000}
.sep{color:var(--border2);font-size:10px}
#pstat{margin-left:auto;font-size:11px}
.msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:14px}
.b{max-width:82%;padding:12px 16px;border-radius:14px;font-size:13.5px;line-height:1.75;word-break:break-word}
.b.user{background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.2);align-self:flex-end;border-bottom-right-radius:3px}
.b.am{background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.cm{background:rgba(247,97,79,.08);border:1px solid rgba(247,97,79,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.sm{background:rgba(79,202,142,.08);border:1px solid rgba(79,202,142,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.sys{background:var(--bg3);border:1px dashed var(--border2);align-self:center;text-align:center;font-size:12px;color:var(--text2);max-width:65%;border-radius:20px;padding:7px 16px}
.bh{font-size:10px;font-weight:700;font-family:monospace;letter-spacing:.8px;margin-bottom:6px}
.bh.ah{color:var(--analyst)}.bh.ch{color:var(--critic)}.bh.sh{color:var(--synth)}.bh.uh{color:var(--accent)}
.bb{color:var(--text)}
.bb pre{background:rgba(0,0,0,.4);border:1px solid var(--border);border-radius:6px;padding:10px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:12px}
.bb code{font-family:monospace;font-size:12px;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:3px}
.bb strong{color:#fff;font-weight:600}
.bb ul,.bb ol{padding-left:18px;margin:5px 0}
.bb li{margin:2px 0}
.cursor{display:inline-block;animation:blink 1s step-end infinite;color:var(--accent)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.dots{display:flex;gap:4px;padding:4px 0;align-items:center}
.dot{width:7px;height:7px;border-radius:50%;background:var(--text2);animation:d 1.4s infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes d{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
.inp{background:var(--bg2);border-top:1px solid var(--border);padding:12px 18px;flex-shrink:0}
.trow{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.tb{padding:4px 11px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:11px;cursor:pointer;font-family:system-ui,sans-serif;transition:all .2s}
.tb:hover{background:var(--bg3);color:var(--text)}
.tb.on{background:rgba(167,139,250,.15);color:var(--accent);border-color:var(--accent)}
.ml{margin-left:auto;font-size:11px;color:var(--text2)}
.ml strong{color:var(--accent)}
.irow{display:flex;gap:8px;align-items:flex-end}
.ti{flex:1;padding:10px 14px;border:1px solid var(--border2);border-radius:10px;background:var(--bg3);color:var(--text);font-size:13px;font-family:system-ui,sans-serif;resize:none;outline:none;min-height:40px;max-height:120px;line-height:1.5;transition:border-color .2s}
.ti:focus{border-color:var(--accent)}
.sb2{width:40px;height:40px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:opacity .2s}
.sb2:hover{opacity:.85}
.sb2:disabled{background:var(--border2);cursor:not-allowed;opacity:.5}
.hint{font-size:11px;color:var(--text2);text-align:center;margin-top:8px}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.ani{animation:su .2s ease-out}
@keyframes su{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<header class="header">
  <div class="logo">AI<span style="color:var(--text)">AGENT</span></div>
  <div class="pills">
    <span class="pill a">● ANALYST</span>
    <span class="pill c">● CRITIC</span>
    <span class="pill s">● SYNTHESIZER</span>
  </div>
  <div class="modes">
    <button class="mbtn on" onclick="setMode('collaborative',this)">🤝 Kolaboratif</button>
    <button class="mbtn" onclick="setMode('analyst',this)">🔍 Analyst</button>
    <button class="mbtn" onclick="setMode('critic',this)">⚔️ Critic</button>
    <button class="mbtn" onclick="setMode('synthesizer',this)">✨ Synthesizer</button>
  </div>
  <button onclick="clearChat()" style="margin-left:8px;background:none;border:1px solid var(--border2);color:var(--text2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">✕ Baru</button>
</header>

<div class="app">
  <aside class="sidebar">
    <div class="sb-sec">
      <div class="sb-lbl">Percakapan</div>
      <button class="nb" onclick="newChat()">+ Mulai Chat Baru</button>
    </div>
    <div class="clist" id="clist">
      <div class="ci on"><div class="ci-t">Percakapan Baru</div><div class="ci-d">Sekarang</div></div>
    </div>
    <div class="sb-bot">
      <div class="sb-lbl">Model Aktif</div>
      <div class="mi" id="minfo">Memeriksa...</div>
      <div class="dl" onclick="window.open('http://localhost:3000','_blank')">⬡ Admin Dashboard</div>
    </div>
  </aside>

  <div class="chat">
    <div class="pbar hid" id="pbar">
      <div class="ps" id="ps-analyst"><div class="pn">1</div>Analyst</div>
      <span class="sep">→</span>
      <div class="ps" id="ps-critic"><div class="pn">2</div>Critic</div>
      <span class="sep">→</span>
      <div class="ps" id="ps-synthesizer"><div class="pn">3</div>Synthesizer</div>
      <span id="pstat"></span>
    </div>

    <div class="msgs" id="msgs">
      <div class="b sys ani">Selamat datang! Pilih mode lalu kirim pertanyaan. Mode Kolaboratif: 3 agent berdiskusi bersama.</div>
    </div>

    <div id="mprev" style="display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 6px"></div>

    <div class="inp">
      <div class="trow">
        <button class="tb" onclick="document.getElementById('fi').click()">📎 File</button>
        <button class="tb" onclick="document.getElementById('ii').click()">🖼️ Gambar</button>
        <button class="tb" id="vbtn" onclick="toggleVoice()">🎤 Suara</button>
        <button class="tb" id="scbtn" onclick="toggleScreen()">🖥️ Screen</button>
        <button class="tb" id="ttsbtn" onclick="toggleTTS()">🔊 TTS</button>
        <div class="ml">Mode: <strong id="mlbl">Kolaboratif (3 Agent)</strong></div>
      </div>
      <div class="irow">
        <textarea class="ti" id="ti" placeholder="Tanyakan apa saja — strategi bisnis, debugging code, analisis data..." rows="1" onkeydown="hk(event)" oninput="ah(this)"></textarea>
        <button class="sb2" id="sbtn" onclick="send()">➤</button>
      </div>
      <div class="hint">Enter kirim · Shift+Enter baris baru</div>
    </div>
  </div>
</div>

<div id="vov" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);align-items:center;justify-content:center;z-index:999">
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:32px;text-align:center;width:280px">
    <div style="font-size:40px;margin-bottom:10px">🎤</div>
    <h3 style="font-family:monospace;margin-bottom:6px">Berbicara...</h3>
    <div id="vtxt" style="font-size:13px;padding:8px;background:var(--bg3);border-radius:8px;margin:12px 0;min-height:20px;color:var(--text)"></div>
    <button onclick="stopVoice()" style="padding:8px 20px;border-radius:8px;border:none;background:var(--critic);color:white;cursor:pointer">■ Stop</button>
  </div>
</div>

<div id="scprev" style="display:none;position:fixed;bottom:90px;right:16px;width:210px;border-radius:10px;overflow:hidden;border:2px solid var(--accent);background:var(--bg2);z-index:100">
  <div style="padding:5px 10px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;font-family:monospace;display:flex;justify-content:space-between">
    🖥️ SCREEN SHARE
    <button onclick="stopScreen()" style="background:none;border:none;color:white;cursor:pointer;font-size:11px">✕</button>
  </div>
  <video id="scvid" autoplay muted style="width:100%;display:block;max-height:120px;object-fit:cover"></video>
</div>

<input type="file" id="fi" hidden accept=".txt,.md,.pdf,.docx,.csv,.json,.py,.js,.ts,.html" onchange="hfile(event)">
<input type="file" id="ii" hidden accept="image/*" onchange="himg(event)">

<script>
const API = 'http://localhost:8000';
let mode = 'collaborative';
let hist = [];
let media = [];
let busy = false;
let tts = false;
let rec = null;
let scStream = null;

// Init
window.onload = async () => {
  try {
    const r = await fetch(API+'/api/agents/health');
    const d = await r.json();
    const ms = d.ollama?.models || [];
    document.getElementById('minfo').textContent = ms.length ? ms[0] : 'Model tidak ditemukan';
  } catch(e) {
    document.getElementById('minfo').textContent = 'Offline';
    sysmsg('⚠️ Backend offline. Jalankan: sudo docker compose up -d');
  }
};

function setMode(m, btn) {
  mode = m;
  document.querySelectorAll('.mbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const L = {collaborative:'Kolaboratif (3 Agent)',analyst:'Analyst',critic:'Critic',synthesizer:'Synthesizer'};
  document.getElementById('mlbl').textContent = L[m]||m;
}

async function send() {
  if (busy) return;
  const ti = document.getElementById('ti');
  const msg = ti.value.trim();
  if (!msg && !media.length) return;
  busy = true;
  document.getElementById('sbtn').disabled = true;
  ti.value = ''; ti.style.height = 'auto';

  const msgs = document.getElementById('msgs');
  const w = msgs.querySelector('.sys');
  if (w && msgs.children.length === 1) w.remove();

  addUser(msg, media);
  media = [];
  document.getElementById('mprev').innerHTML = '';
  hist.push({role:'user', content:msg});

  try {
    if (mode === 'collaborative') {
      showPbar();
      await doStream(msg, 'collaborative', null);
    } else {
      await doStream(msg, 'single', mode);
    }
  } catch(e) {
    sysmsg('❌ '+e.message);
  }

  busy = false;
  document.getElementById('sbtn').disabled = false;
  hidePbar();
}

async function doStream(msg, m, agent) {
  const body = {message:msg, history:hist.slice(-8), mode:m};
  if (agent) body.agent_name = agent;
  if (m==='collaborative') body.rounds = 2;

  let resp;
  try {
    resp = await fetch(API+'/api/agents/chat/stream', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  } catch(e) { throw new Error('Tidak bisa konek backend: '+e.message); }

  if (!resp.ok) throw new Error('Backend HTTP '+resp.status);

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let curBub = null;
  let curAgent = null;
  let curTxt = '';

  while(true) {
    const {done, value} = await reader.read();
    if (done) break;

    buf += dec.decode(value, {stream:true});
    const lines = buf.split('\n');
    buf = lines.pop(); // keep incomplete line

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data: ')) continue;
      const raw = t.slice(6).trim();
      if (!raw || raw==='[DONE]') continue;

      let ev;
      try { ev = JSON.parse(raw); } catch(e) { continue; }

      if (ev.type === 'agent_start') {
        curAgent = ev.agent;
        curTxt = '';
        curBub = mkBub(ev.agent);
        setPbar(ev.agent);

      } else if (ev.type === 'chunk') {
        if (!curBub) curBub = mkBub(curAgent||agent||'analyst');
        curTxt += (ev.content||'');
        setBub(curBub, curTxt, true);

      } else if (ev.type === 'agent_done') {
        const fin = ev.full_response || curTxt;
        if (curBub) setBub(curBub, fin, false);
        hist.push({role:'assistant', content:'['+(curAgent||'').toUpperCase()+']: '+fin});
        if (tts && ev.agent==='synthesizer') speak(fin);
        curBub = null; curTxt = '';

      } else if (ev.type === 'session_complete') {
        if (curBub) setBub(curBub, curTxt, false);
        hist.push({role:'assistant', content:curTxt});
        if (tts) speak(curTxt);

      } else if (ev.type === 'error') {
        sysmsg('❌ Agent error: '+(ev.message||''));
      }
    }
  }
}

// ── BUBBLE HELPERS ────────────────────
function mkBub(agent) {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  const cls = {analyst:'am',critic:'cm',synthesizer:'sm'}[agent]||'am';
  const hcls = {analyst:'ah',critic:'ch',synthesizer:'sh'}[agent]||'ah';
  const ico = {analyst:'🔍',critic:'⚔️',synthesizer:'✨'}[agent]||'';
  const lbl = {analyst:'ANALYST',critic:'CRITIC',synthesizer:'SYNTHESIZER'}[agent]||agent.toUpperCase();
  div.className = 'b '+cls+' ani';
  div.innerHTML = '<div class="bh '+hcls+'">'+ico+' '+lbl+'</div>'
    +'<div class="bb"><div class="dots">'
    +'<div class="dot"></div><div class="dot"></div><div class="dot"></div>'
    +'</div></div>';
  msgs.appendChild(div);
  scrl();
  return div;
}

function setBub(bub, txt, streaming) {
  if (!bub) return;
  const bb = bub.querySelector('.bb');
  if (!bb) return;
  bb.innerHTML = md(txt) + (streaming ? '<span class="cursor">▋</span>' : '');
  scrl();
}

function addUser(txt, med) {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'b user ani';
  let h = '<div class="bh uh">👤 ANDA</div><div class="bb">';
  if (txt) h += esc(txt).replace(/\n/g,'<br>');
  med.forEach(m=>{
    if(m.type==='image') h += '<img src="'+m.data+'" style="max-width:160px;border-radius:6px;margin-top:6px;display:block">';
    else h += '<div style="margin-top:6px;background:var(--bg3);padding:3px 8px;border-radius:4px;font-size:11px">📄 '+m.name+'</div>';
  });
  h += '</div>';
  div.innerHTML = h;
  msgs.appendChild(div);
  scrl();
}

function sysmsg(txt) {
  const msgs = document.getElementById('msgs');
  const div = document.createElement('div');
  div.className = 'b sys ani';
  div.textContent = txt;
  msgs.appendChild(div);
  scrl();
}

function scrl() {
  const m = document.getElementById('msgs');
  m.scrollTop = m.scrollHeight;
}

// ── MARKDOWN ──────────────────────────
function md(t) {
  if (!t) return '';
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>')
    .replace(/`([^`\n]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/^#{3} (.+)$/gm,'<strong style="display:block;margin:8px 0 4px">$1</strong>')
    .replace(/^#{1,2} (.+)$/gm,'<strong style="display:block;font-size:15px;margin:10px 0 4px">$1</strong>')
    .replace(/^[-•✅⚠️🚀📋] (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*?<\/li>)+/gs,s=>'<ul style="padding-left:16px;margin:4px 0">'+s+'</ul>')
    .replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
}
function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── PROGRESS ─────────────────────────
function showPbar(){document.getElementById('pbar').classList.remove('hid');}
function hidePbar(){document.getElementById('pbar').classList.add('hid');}
function setPbar(agent){
  const steps=['analyst','critic','synthesizer'];
  const idx=steps.indexOf(agent);
  steps.forEach((s,i)=>{
    const el=document.getElementById('ps-'+s);
    el.classList.remove('on','done');
    if(i<idx) el.classList.add('done');
    if(s===agent) el.classList.add('on');
  });
  const L={analyst:'Analyst menganalisis...',critic:'Critic mengevaluasi...',synthesizer:'Synthesizer merumuskan...'};
  document.getElementById('pstat').textContent=L[agent]||'';
}

// ── INPUT ─────────────────────────────
function hk(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
function ah(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}

// ── CHAT MGMT ─────────────────────────
function clearChat(){
  document.getElementById('msgs').innerHTML='<div class="b sys ani">Chat baru. Mulai bertanya!</div>';
  hist=[];media=[];document.getElementById('mprev').innerHTML='';
}
function newChat(){
  clearChat();
  const cl=document.getElementById('clist');
  const t=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className='ci';
  d.innerHTML='<div class="ci-t">Percakapan '+(cl.children.length+1)+'</div><div class="ci-d">'+t+'</div>';
  d.onclick=()=>{document.querySelectorAll('.ci').forEach(i=>i.classList.remove('on'));d.classList.add('on');};
  cl.prepend(d);
  document.querySelectorAll('.ci').forEach(i=>i.classList.remove('on'));
  d.classList.add('on');
}

// ── FILE & IMAGE ──────────────────────
function hfile(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    media.push({type:'file',name:f.name,data:ev.target.result});
    const cur=document.getElementById('ti').value;
    document.getElementById('ti').value=cur+'\n\n[File: '+f.name+']\n'+ev.target.result.substring(0,3000);
    updMprev();
  };
  r.readAsText(f,'utf-8');e.target.value='';
}
function himg(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{media.push({type:'image',name:f.name,data:ev.target.result});updMprev();};
  r.readAsDataURL(f);e.target.value='';
}
function updMprev(){
  document.getElementById('mprev').innerHTML=media.map((m,i)=>{
    if(m.type==='image') return '<div style="position:relative"><img src="'+m.data+'" style="width:65px;height:65px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"><button onclick="rmMedia('+i+')" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,.8);border:none;color:white;border-radius:50%;width:14px;height:14px;cursor:pointer;font-size:8px">✕</button></div>';
    return '<div style="display:flex;align-items:center;gap:5px;padding:4px 8px;background:var(--bg3);border-radius:6px;font-size:11px">📄 '+m.name+'<button onclick="rmMedia('+i+')" style="background:none;border:none;color:var(--text2);cursor:pointer">✕</button></div>';
  }).join('');
}
function rmMedia(i){media.splice(i,1);updMprev();}

// ── VOICE ─────────────────────────────
function toggleVoice(){
  const ov=document.getElementById('vov');
  if(ov.style.display!=='none'){stopVoice();return;}
  if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){alert('Gunakan Chrome untuk fitur suara');return;}
  ov.style.display='flex';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  rec=new SR();rec.lang='id-ID';rec.continuous=true;rec.interimResults=true;
  rec.onresult=ev=>{let t='';for(let i=ev.resultIndex;i<ev.results.length;i++)t+=ev.results[i][0].transcript;document.getElementById('vtxt').textContent=t;document.getElementById('ti').value=t;};
  rec.onend=stopVoice;rec.start();
}
function stopVoice(){if(rec){rec.stop();rec=null;}document.getElementById('vov').style.display='none';}

// ── TTS ───────────────────────────────
function toggleTTS(){
  tts=!tts;
  const b=document.getElementById('ttsbtn');
  b.classList.toggle('on',tts);b.textContent=tts?'🔊 TTS ON':'🔊 TTS';
}
function speak(txt){
  if(!tts||!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(txt.replace(/<[^>]*>/g,'').replace(/[#*`]/g,'').substring(0,400));
  u.lang='id-ID';u.rate=1.0;window.speechSynthesis.speak(u);
}

// ── SCREEN SHARE ──────────────────────
async function toggleScreen(){
  const p=document.getElementById('scprev');
  if(p.style.display!=='none'){stopScreen();return;}
  try{
    scStream=await navigator.mediaDevices.getDisplayMedia({video:true});
    document.getElementById('scvid').srcObject=scStream;
    p.style.display='block';
    document.getElementById('scbtn').classList.add('on');
    scStream.getVideoTracks()[0].onended=stopScreen;
    sysmsg('🖥️ Screen sharing aktif.');
  }catch(e){if(e.name!=='AbortError')sysmsg('Gagal: '+e.message);}
}
function stopScreen(){
  if(scStream){scStream.getTracks().forEach(t=>t.stop());scStream=null;}
  document.getElementById('scprev').style.display='none';
  document.getElementById('scbtn').classList.remove('on');
}
</script>
</body>
</html>
HTMLEOF

echo "✅ File index.html baru ditulis"

echo ""
echo "▶ Copy langsung ke container (tanpa rebuild)..."
sudo docker cp frontend-chatbot/index.html ai-chatbot:/usr/share/nginx/html/index.html

echo ""
echo "▶ Reload nginx di container..."
sudo docker exec ai-chatbot nginx -s reload

echo ""
echo "✅ SELESAI!"
echo ""
echo "Sekarang:"
echo "1. Buka http://localhost:3001"
echo "2. Tekan Ctrl+Shift+R (hard refresh) untuk clear cache browser"
echo "3. Coba kirim pesan"
