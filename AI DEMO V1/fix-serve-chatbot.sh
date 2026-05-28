#!/bin/bash
# Fix: Serve chatbot HTML langsung dari FastAPI backend
# Tidak perlu container chatbot sama sekali
# Jalankan dari folder ai-ecosystem

if [ ! -f "docker-compose.yml" ]; then
    echo "Jalankan dari folder ai-ecosystem!"
    exit 1
fi

echo "=== Step 1: Cek volume mount container chatbot ==="
sudo docker inspect ai-chatbot | python3 -c "
import json,sys
data = json.load(sys.stdin)
mounts = data[0].get('Mounts',[])
print('MOUNTS:')
for m in mounts:
    print(' Source:', m.get('Source',''))
    print(' Dest:  ', m.get('Destination',''))
    print(' Mode:  ', m.get('Mode',''))
    print()
"

echo ""
echo "=== Step 2: Tambah route /chatbot ke backend FastAPI ==="

# Tambah static file serving ke main.py
cat >> backend/main.py << 'PYEOF'

# ── SERVE CHATBOT HTML LANGSUNG ───────────────────────────
from fastapi.responses import HTMLResponse

@app.get("/chatbot", response_class=HTMLResponse)
async def serve_chatbot():
    """Serve chatbot UI langsung dari backend - bypass container nginx"""
    try:
        with open("/app/chatbot.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>chatbot.html tidak ditemukan di /app/</h1>")
PYEOF

echo "✅ Route /chatbot ditambah ke backend"

echo ""
echo "=== Step 3: Copy chatbot HTML ke folder backend ==="
# Cari file HTML yang paling baru
HTML_FILE=""
for f in frontend-chatbot/index.html frontend-dashboard/index.html; do
    if [ -f "$f" ]; then
        HTML_FILE="$f"
        break
    fi
done

if [ -z "$HTML_FILE" ]; then
    echo "Tidak ada file HTML, buat baru..."
fi

echo "✅ Akan buat /app/chatbot.html di container backend"

echo ""
echo "=== Step 4: Tulis chatbot.html ke container backend via Python ==="

sudo docker exec ai-backend python3 << 'PYEOF'
html = """<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Agent - Chatbot</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0c0e13;--bg2:#12151f;--bg3:#1a1d2e;--bg4:#1e2235;--border:#252a3d;--analyst:#4f8ef7;--critic:#f7614f;--synth:#4fca8e;--accent:#a78bfa;--text:#dde3f0;--text2:#7a84a0}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.hdr{height:54px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0}
.logo{font-size:15px;font-weight:700;font-family:monospace;color:var(--accent)}
.pill{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;font-family:monospace;display:inline-block}
.pill.a{background:rgba(79,142,247,.2);color:var(--analyst);border:1px solid rgba(79,142,247,.3)}
.pill.c{background:rgba(247,97,79,.2);color:var(--critic);border:1px solid rgba(247,97,79,.3)}
.pill.s{background:rgba(79,202,142,.2);color:var(--synth);border:1px solid rgba(79,202,142,.3)}
.modes{display:flex;gap:6px;margin-left:auto}
.mb{padding:5px 14px;border-radius:20px;border:1px solid #2d3348;background:transparent;color:var(--text2);font-size:12px;cursor:pointer}
.mb.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.app{display:flex;flex:1;min-height:0}
.sidebar{width:200px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:12px}
.slbl{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:monospace}
.mi{font-size:11px;font-family:monospace;color:var(--text2);margin-top:auto;padding-top:12px;border-top:1px solid var(--border)}
.chat{flex:1;display:flex;flex-direction:column;min-width:0}
.pbar{height:32px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:8px;font-size:12px;color:var(--text2)}
.pbar.hid{display:none}
.ps{display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px}
.ps.on{background:var(--bg4);color:var(--text);font-weight:500}
.ps.done{color:var(--synth)}
.pn{width:15px;height:15px;border-radius:50%;border:1px solid #2d3348;display:flex;align-items:center;justify-content:center;font-size:9px;font-family:monospace}
.ps.on .pn{background:var(--accent);border-color:var(--accent);color:#fff}
.ps.done .pn{background:var(--synth);border-color:var(--synth);color:#000}
#pstat{margin-left:auto;font-size:11px}
.msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px}
.b{max-width:82%;padding:12px 16px;border-radius:14px;font-size:13.5px;line-height:1.75;word-break:break-word}
.b.user{background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.2);align-self:flex-end;border-bottom-right-radius:3px}
.b.am{background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.cm{background:rgba(247,97,79,.08);border:1px solid rgba(247,97,79,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.sm{background:rgba(79,202,142,.08);border:1px solid rgba(79,202,142,.2);align-self:flex-start;border-bottom-left-radius:3px}
.b.sys{background:var(--bg3);border:1px dashed #2d3348;align-self:center;text-align:center;font-size:12px;color:var(--text2);max-width:65%;border-radius:20px;padding:7px 16px}
.bh{font-size:10px;font-weight:700;font-family:monospace;letter-spacing:.8px;margin-bottom:6px}
.bh.ah{color:var(--analyst)}.bh.ch{color:var(--critic)}.bh.sh{color:var(--synth)}.bh.uh{color:var(--accent)}
.bb{color:var(--text)}
.bb pre{background:rgba(0,0,0,.4);border:1px solid var(--border);border-radius:6px;padding:10px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:12px}
.bb code{font-family:monospace;font-size:12px;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:3px}
.bb strong{color:#fff;font-weight:600}
.bb ul{padding-left:18px;margin:5px 0}
.bb li{margin:2px 0}
.cursor{display:inline-block;animation:blink 1s step-end infinite;color:var(--accent)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.dots{display:flex;gap:4px;padding:4px 0;align-items:center}
.dot{width:7px;height:7px;border-radius:50%;background:var(--text2);animation:d 1.4s infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes d{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
.inp{background:var(--bg2);border-top:1px solid var(--border);padding:12px 18px;flex-shrink:0}
.trow{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.tb{padding:4px 11px;border-radius:6px;border:1px solid #2d3348;background:transparent;color:var(--text2);font-size:11px;cursor:pointer;transition:all .2s}
.tb:hover{background:var(--bg3);color:var(--text)}
.tb.on{background:rgba(167,139,250,.15);color:var(--accent);border-color:var(--accent)}
.ml{margin-left:auto;font-size:11px;color:var(--text2)}
.ml strong{color:var(--accent)}
.irow{display:flex;gap:8px;align-items:flex-end}
.ti{flex:1;padding:10px 14px;border:1px solid #2d3348;border-radius:10px;background:var(--bg3);color:var(--text);font-size:13px;font-family:system-ui,sans-serif;resize:none;outline:none;min-height:40px;max-height:120px;line-height:1.5;transition:border-color .2s}
.ti:focus{border-color:var(--accent)}
.sb2{width:40px;height:40px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:15px;flex-shrink:0}
.sb2:disabled{background:#2d3348;cursor:not-allowed;opacity:.5}
.hint{font-size:11px;color:var(--text2);text-align:center;margin-top:8px}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
</style>
</head>
<body>
<header class="hdr">
  <div class="logo">AIAGENT</div>
  <span class="pill a">● ANALYST</span>
  <span class="pill c">● CRITIC</span>
  <span class="pill s">● SYNTHESIZER</span>
  <div class="modes">
    <button class="mb on" onclick="setMode('collaborative',this)">🤝 Kolaboratif</button>
    <button class="mb" onclick="setMode('analyst',this)">🔍 Analyst</button>
    <button class="mb" onclick="setMode('critic',this)">⚔️ Critic</button>
    <button class="mb" onclick="setMode('synthesizer',this)">✨ Synthesizer</button>
  </div>
  <button onclick="clearChat()" style="margin-left:8px;background:none;border:1px solid #2d3348;color:var(--text2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">✕ Baru</button>
</header>
<div class="app">
  <aside class="sidebar">
    <div class="slbl">Percakapan</div>
    <div style="padding:8px 0;font-size:13px;font-weight:500;border-bottom:1px solid var(--border)">Percakapan Baru</div>
    <div class="mi">
      <div class="slbl">Model Aktif</div>
      <div id="minfo">Memeriksa...</div>
      <div style="margin-top:8px;font-size:12px;cursor:pointer;color:var(--text2)" onclick="window.open('http://localhost:3000','_blank')">⬡ Dashboard</div>
    </div>
  </aside>
  <div class="chat">
    <div class="pbar hid" id="pbar">
      <div class="ps" id="ps-analyst"><div class="pn">1</div>Analyst</div>
      <span style="color:#252a3d;font-size:10px">→</span>
      <div class="ps" id="ps-critic"><div class="pn">2</div>Critic</div>
      <span style="color:#252a3d;font-size:10px">→</span>
      <div class="ps" id="ps-synthesizer"><div class="pn">3</div>Synthesizer</div>
      <span id="pstat"></span>
    </div>
    <div class="msgs" id="msgs">
      <div class="b sys">Selamat datang! Pilih mode lalu kirim pertanyaan. Mode Kolaboratif: 3 agent berdiskusi bersama untuk jawaban terbaik.</div>
    </div>
    <div class="inp">
      <div class="trow">
        <button class="tb" onclick="document.getElementById('fi').click()">📎 File</button>
        <button class="tb" onclick="document.getElementById('ii').click()">🖼️ Gambar</button>
        <button class="tb" id="vbtn" onclick="toggleVoice()">🎤 Suara</button>
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
    <div id="vtxt" style="font-size:13px;padding:8px;background:var(--bg3);border-radius:8px;margin:12px 0;min-height:20px;color:var(--text)"></div>
    <button onclick="stopVoice()" style="padding:8px 20px;border-radius:8px;border:none;background:var(--critic);color:white;cursor:pointer">■ Stop</button>
  </div>
</div>
<input type="file" id="fi" hidden accept=".txt,.md,.pdf,.docx,.csv,.json,.py,.js" onchange="hfile(event)">
<input type="file" id="ii" hidden accept="image/*" onchange="himg(event)">
<script>
const API='http://localhost:8000';
let mode='collaborative',hist=[],media=[],busy=false,tts=false,rec=null;

window.onload=async()=>{
  try{
    const r=await fetch(API+'/api/agents/health');
    const d=await r.json();
    const ms=d.ollama?.models||[];
    document.getElementById('minfo').textContent=ms.length?ms[0]:'Model tidak ditemukan';
  }catch(e){
    document.getElementById('minfo').textContent='Offline';
    sysmsg('Backend offline. Jalankan: sudo docker compose up -d');
  }
};

function setMode(m,btn){
  mode=m;
  document.querySelectorAll('.mb').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const L={collaborative:'Kolaboratif (3 Agent)',analyst:'Analyst',critic:'Critic',synthesizer:'Synthesizer'};
  document.getElementById('mlbl').textContent=L[m]||m;
}

async function send(){
  if(busy)return;
  const ti=document.getElementById('ti');
  const msg=ti.value.trim();
  if(!msg&&!media.length)return;
  busy=true;
  document.getElementById('sbtn').disabled=true;
  ti.value='';ti.style.height='auto';
  const msgs=document.getElementById('msgs');
  if(msgs.children.length===1&&msgs.firstChild.classList.contains('sys'))msgs.innerHTML='';
  addUser(msg,media);
  media=[];
  hist.push({role:'user',content:msg});
  try{
    if(mode==='collaborative'){showPbar();await doStream(msg,'collaborative',null);}
    else{await doStream(msg,'single',mode);}
  }catch(e){sysmsg('Error: '+e.message);}
  busy=false;
  document.getElementById('sbtn').disabled=false;
  hidePbar();
}

async function doStream(msg,m,agent){
  const body={message:msg,history:hist.slice(-8),mode:m};
  if(agent)body.agent_name=agent;
  if(m==='collaborative')body.rounds=2;
  let resp;
  try{resp=await fetch(API+'/api/agents/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
  catch(e){throw new Error('Tidak bisa konek: '+e.message);}
  if(!resp.ok)throw new Error('HTTP '+resp.status);
  const reader=resp.body.getReader();
  const dec=new TextDecoder();
  let buf='',curBub=null,curAgent=null,curTxt='';
  while(true){
    const{done,value}=await reader.read();
    if(done)break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split('\n');buf=lines.pop();
    for(const line of lines){
      const t=line.trim();
      if(!t.startsWith('data: '))continue;
      const raw=t.slice(6).trim();
      if(!raw||raw==='[DONE]')continue;
      let ev;try{ev=JSON.parse(raw);}catch(e){continue;}
      if(ev.type==='agent_start'){
        curAgent=ev.agent;curTxt='';curBub=mkBub(ev.agent);setPbar(ev.agent);
      }else if(ev.type==='chunk'){
        if(!curBub)curBub=mkBub(curAgent||agent||'analyst');
        curTxt+=(ev.content||'');setBub(curBub,curTxt,true);
      }else if(ev.type==='agent_done'){
        const fin=ev.full_response||curTxt;
        if(curBub)setBub(curBub,fin,false);
        hist.push({role:'assistant',content:'['+(curAgent||'').toUpperCase()+']: '+fin});
        if(tts&&ev.agent==='synthesizer')speak(fin);
        curBub=null;curTxt='';
      }else if(ev.type==='session_complete'){
        if(curBub)setBub(curBub,curTxt,false);
        if(tts)speak(curTxt);
      }else if(ev.type==='error'){
        sysmsg('Error: '+(ev.message||''));
      }
    }
  }
}

function mkBub(agent){
  const msgs=document.getElementById('msgs');
  const div=document.createElement('div');
  const cls={analyst:'am',critic:'cm',synthesizer:'sm'}[agent]||'am';
  const hcls={analyst:'ah',critic:'ch',synthesizer:'sh'}[agent]||'ah';
  const ico={analyst:'🔍',critic:'⚔️',synthesizer:'✨'}[agent]||'';
  const lbl={analyst:'ANALYST',critic:'CRITIC',synthesizer:'SYNTHESIZER'}[agent]||agent.toUpperCase();
  div.className='b '+cls;
  div.innerHTML='<div class="bh '+hcls+'">'+ico+' '+lbl+'</div><div class="bb"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
  msgs.appendChild(div);scrl();return div;
}
function setBub(bub,txt,streaming){
  if(!bub)return;
  const bb=bub.querySelector('.bb');if(!bb)return;
  bb.innerHTML=md(txt)+(streaming?'<span class="cursor">▋</span>':'');scrl();
}
function addUser(txt,med){
  const msgs=document.getElementById('msgs');
  const div=document.createElement('div');div.className='b user';
  let h='<div class="bh uh">👤 ANDA</div><div class="bb">';
  if(txt)h+=esc(txt).replace(/\\n/g,'<br>');
  med.forEach(m=>{if(m.type==='image')h+='<img src="'+m.data+'" style="max-width:160px;border-radius:6px;margin-top:6px;display:block">';else h+='<div style="margin-top:6px;background:var(--bg3);padding:3px 8px;border-radius:4px;font-size:11px">📄 '+m.name+'</div>';});
  h+='</div>';div.innerHTML=h;msgs.appendChild(div);scrl();
}
function sysmsg(txt){const msgs=document.getElementById('msgs');const div=document.createElement('div');div.className='b sys';div.textContent=txt;msgs.appendChild(div);scrl();}
function scrl(){const m=document.getElementById('msgs');m.scrollTop=m.scrollHeight;}
function md(t){
  if(!t)return'';
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g,'<pre><code>\$1</code></pre>')
    .replace(/\`([^\`\\n]+)\`/g,'<code>\$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>\$1</strong>')
    .replace(/^[-•] (.+)\$/gm,'<li>\$1</li>')
    .replace(/(<li>.*?<\\/li>)+/gs,s=>'<ul style="padding-left:16px;margin:4px 0">'+s+'</ul>')
    .replace(/\\n{2,}/g,'<br><br>').replace(/\\n/g,'<br>');
}
function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function showPbar(){document.getElementById('pbar').classList.remove('hid');}
function hidePbar(){document.getElementById('pbar').classList.add('hid');}
function setPbar(agent){
  const steps=['analyst','critic','synthesizer'];
  const idx=steps.indexOf(agent);
  steps.forEach((s,i)=>{const el=document.getElementById('ps-'+s);el.classList.remove('on','done');if(i<idx)el.classList.add('done');if(s===agent)el.classList.add('on');});
  const L={analyst:'Analyst menganalisis...',critic:'Critic mengevaluasi...',synthesizer:'Synthesizer merumuskan...'};
  document.getElementById('pstat').textContent=L[agent]||'';
}
function hk(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
function ah(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}
function clearChat(){document.getElementById('msgs').innerHTML='<div class="b sys">Chat baru!</div>';hist=[];media=[];}
function hfile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{media.push({type:'file',name:f.name,data:ev.target.result});const cur=document.getElementById('ti').value;document.getElementById('ti').value=cur+'\\n\\n[File: '+f.name+']\\n'+ev.target.result.substring(0,3000);};r.readAsText(f,'utf-8');e.target.value='';}
function himg(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{media.push({type:'image',name:f.name,data:ev.target.result});};r.readAsDataURL(f);e.target.value='';}
function toggleVoice(){
  const ov=document.getElementById('vov');
  if(ov.style.display!=='none'){stopVoice();return;}
  if(!('webkitSpeechRecognition'in window)&&!('SpeechRecognition'in window)){alert('Gunakan Chrome');return;}
  ov.style.display='flex';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  rec=new SR();rec.lang='id-ID';rec.continuous=true;rec.interimResults=true;
  rec.onresult=ev=>{let t='';for(let i=ev.resultIndex;i<ev.results.length;i++)t+=ev.results[i][0].transcript;document.getElementById('vtxt').textContent=t;document.getElementById('ti').value=t;};
  rec.onend=stopVoice;rec.start();
}
function stopVoice(){if(rec){rec.stop();rec=null;}document.getElementById('vov').style.display='none';}
function toggleTTS(){tts=!tts;const b=document.getElementById('ttsbtn');b.classList.toggle('on',tts);b.textContent=tts?'🔊 TTS ON':'🔊 TTS';}
function speak(txt){if(!tts||!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(txt.replace(/<[^>]*>/g,'').substring(0,400));u.lang='id-ID';window.speechSynthesis.speak(u);}
</script>
</body>
</html>"""

with open('/app/chatbot.html', 'w') as f:
    f.write(html)
print('OK:', len(html), 'bytes ditulis ke /app/chatbot.html')
PYEOF

echo ""
echo "=== Step 5: Restart backend ==="
sudo docker compose restart backend

echo ""
echo "Menunggu 8 detik..."
sleep 8

echo ""
echo "=== SELESAI ==="
echo ""
echo "Buka chatbot di: http://localhost:8000/chatbot"
echo "(Bukan lagi :3001, tapi :8000/chatbot)"
echo ""
echo "Ctrl+Shift+R untuk hard refresh"
