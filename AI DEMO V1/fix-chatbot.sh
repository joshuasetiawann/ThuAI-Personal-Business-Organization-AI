#!/bin/bash
# ═══════════════════════════════════════════════════
# FIX CHATBOT - Jalankan dari folder ai-ecosystem
# Usage: bash fix-chatbot.sh
# ═══════════════════════════════════════════════════

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Jalankan dari folder ai-ecosystem!"
    exit 1
fi

echo "▶ Menulis ulang frontend-chatbot/index.html ..."

cat > frontend-chatbot/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Agent — Multi-Agent Chatbot</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0c0e13;--bg2:#12151f;--bg3:#1a1d2e;--bg4:#1e2235;
  --border:#252a3d;--border2:#2d3348;
  --analyst:#4f8ef7;--critic:#f7614f;--synthesizer:#4fca8e;
  --accent:#a78bfa;--text:#dde3f0;--text2:#7a84a0;
}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}

/* HEADER */
.header{height:56px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:14px;flex-shrink:0}
.logo{font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:500;letter-spacing:1px;color:var(--accent)}
.agent-pills{display:flex;gap:6px}
.pill{display:flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:'IBM Plex Mono',monospace}
.pill.a{background:rgba(79,142,247,.15);color:var(--analyst);border:1px solid rgba(79,142,247,.25)}
.pill.c{background:rgba(247,97,79,.15);color:var(--critic);border:1px solid rgba(247,97,79,.25)}
.pill.s{background:rgba(79,202,142,.15);color:var(--synthesizer);border:1px solid rgba(79,202,142,.25)}
.pill-dot{width:6px;height:6px;border-radius:50%}
.pill.a .pill-dot{background:var(--analyst)}.pill.c .pill-dot{background:var(--critic)}.pill.s .pill-dot{background:var(--synthesizer)}
.header-modes{display:flex;gap:6px;margin-left:auto}
.mode-btn{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:12px;cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif}
.mode-btn.active{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
.hdr-icon{width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px}
.hdr-icon:hover{background:var(--bg3);color:var(--text)}

/* LAYOUT */
.app-body{display:flex;flex:1;min-height:0}

/* SIDEBAR */
.sidebar{width:240px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
.sidebar-sec{padding:12px;border-bottom:1px solid var(--border)}
.sidebar-lbl{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-family:'IBM Plex Mono',monospace}
.new-btn{width:100%;padding:9px 14px;border-radius:8px;border:1px dashed var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:13px;text-align:left;display:flex;align-items:center;gap:8px;transition:all .2s;font-family:'Inter',sans-serif}
.new-btn:hover{background:var(--bg3);color:var(--text);border-color:var(--accent)}
.conv-list{flex:1;overflow-y:auto;padding:8px}
.conv-item{padding:10px 12px;border-radius:8px;cursor:pointer;margin-bottom:2px;transition:all .2s;border-left:2px solid transparent}
.conv-item:hover{background:var(--bg3)}
.conv-item.active{background:var(--bg4);border-left-color:var(--accent)}
.conv-title{font-size:13px;font-weight:500}
.conv-time{font-size:11px;color:var(--text2);margin-top:2px}
.sidebar-bottom{padding:12px;border-top:1px solid var(--border)}
.model-info{font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--text2);margin-bottom:8px}
.dash-link{font-size:12px;color:var(--text2);cursor:pointer;display:flex;align-items:center;gap:6px}
.dash-link:hover{color:var(--accent)}

/* CHAT AREA */
.chat-area{flex:1;display:flex;flex-direction:column;min-width:0}

/* PROGRESS BAR */
.prog-bar{height:34px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:8px;font-size:12px;color:var(--text2)}
.prog-bar.hidden{display:none}
.pstep{display:flex;align-items:center;gap:5px;padding:2px 8px;border-radius:4px;transition:all .3s}
.pstep.active{background:var(--bg4);color:var(--text);font-weight:500}
.pstep.done{color:var(--synthesizer)}
.pnum{width:16px;height:16px;border-radius:50%;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:9px;font-family:'IBM Plex Mono',monospace}
.pstep.active .pnum{background:var(--accent);border-color:var(--accent);color:#fff}
.pstep.done .pnum{background:var(--synthesizer);border-color:var(--synthesizer);color:#000}
.psep{color:var(--border2);font-size:10px}
#prog-status{margin-left:auto;font-size:11px}

/* MESSAGES */
.messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px}

/* BUBBLE */
.bubble{max-width:84%;padding:12px 16px;border-radius:14px;font-size:13.5px;line-height:1.7;word-break:break-word}
.bubble.user{background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.2);align-self:flex-end;border-bottom-right-radius:3px}
.bubble.analyst-msg{background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);align-self:flex-start;border-bottom-left-radius:3px}
.bubble.critic-msg{background:rgba(247,97,79,.08);border:1px solid rgba(247,97,79,.2);align-self:flex-start;border-bottom-left-radius:3px}
.bubble.synthesizer-msg{background:rgba(79,202,142,.08);border:1px solid rgba(79,202,142,.2);align-self:flex-start;border-bottom-left-radius:3px}
.bubble.sys-msg{background:var(--bg3);border:1px dashed var(--border2);align-self:center;text-align:center;font-size:12px;color:var(--text2);max-width:65%;border-radius:20px;padding:7px 16px}
.bub-hdr{font-size:10px;font-weight:700;font-family:'IBM Plex Mono',monospace;letter-spacing:.8px;margin-bottom:6px}
.bub-hdr.analyst-hdr{color:var(--analyst)}.bub-hdr.critic-hdr{color:var(--critic)}.bub-hdr.synthesizer-hdr{color:var(--synthesizer)}.bub-hdr.user-hdr{color:var(--accent)}
.bub-body{color:var(--text)}
.bub-body pre{background:rgba(0,0,0,.4);border:1px solid var(--border);border-radius:6px;padding:12px;margin:8px 0;overflow-x:auto;font-family:'IBM Plex Mono',monospace;font-size:12px}
.bub-body code{font-family:'IBM Plex Mono',monospace;font-size:12px;background:rgba(255,255,255,.07);padding:1px 5px;border-radius:3px}
.bub-body strong{font-weight:600;color:#fff}
.bub-body li{margin:3px 0}
.bub-body ul,.bub-body ol{padding-left:20px;margin:6px 0}
.blink-cursor{display:inline-block;animation:blink 1s step-end infinite;color:var(--accent)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.typing-dots{display:flex;gap:4px;padding:4px 0}
.typing-dot{width:7px;height:7px;border-radius:50%;background:var(--text2);animation:tdot 1.4s infinite}
.typing-dot:nth-child(2){animation-delay:.2s}.typing-dot:nth-child(3){animation-delay:.4s}
@keyframes tdot{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}

/* INPUT */
.input-area{background:var(--bg2);border-top:1px solid var(--border);padding:12px 20px;flex-shrink:0}
.tools-row{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.tool-btn{padding:4px 11px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:'Inter',sans-serif;transition:all .2s}
.tool-btn:hover{background:var(--bg3);color:var(--text)}
.tool-btn.on{background:rgba(167,139,250,.15);color:var(--accent);border-color:var(--accent)}
.mode-lbl{margin-left:auto;font-size:11px;color:var(--text2)}
.mode-lbl strong{color:var(--accent)}
.input-row{display:flex;gap:8px;align-items:flex-end}
.msg-input{flex:1;padding:10px 14px;border:1px solid var(--border2);border-radius:10px;background:var(--bg3);color:var(--text);font-size:13px;font-family:'Inter',sans-serif;resize:none;outline:none;min-height:40px;max-height:120px;line-height:1.5;transition:border-color .2s}
.msg-input:focus{border-color:var(--accent)}
.send-btn{width:40px;height:40px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:opacity .2s}
.send-btn:hover{opacity:.85}
.send-btn:disabled{background:var(--border2);cursor:not-allowed;opacity:.5}
.input-hint{font-size:11px;color:var(--text2);text-align:center;margin-top:8px}

/* VOICE MODAL */
.voice-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:1000}
.voice-overlay.hidden{display:none}
.voice-modal{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:36px;text-align:center;width:300px}
.wave{display:flex;justify-content:center;gap:4px;height:36px;align-items:center;margin:16px 0}
.wave-bar{width:4px;border-radius:2px;background:var(--accent);animation:wav 1s ease-in-out infinite}
.wave-bar:nth-child(1){height:20%}.wave-bar:nth-child(2){height:60%;animation-delay:.1s}.wave-bar:nth-child(3){height:100%;animation-delay:.2s}.wave-bar:nth-child(4){height:60%;animation-delay:.3s}.wave-bar:nth-child(5){height:20%;animation-delay:.4s}
@keyframes wav{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}

/* SCREEN PREVIEW */
.screen-preview{position:fixed;bottom:90px;right:16px;width:220px;border-radius:10px;overflow:hidden;border:2px solid var(--accent);background:var(--bg2);z-index:100;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.screen-preview.hidden{display:none}
.screen-hdr{padding:5px 10px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;font-family:'IBM Plex Mono',monospace;display:flex;justify-content:space-between;align-items:center}
.screen-preview video{width:100%;display:block;max-height:130px;object-fit:cover}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
.animate-in{animation:slideUp .2s ease-out}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<header class="header">
  <div class="logo">AI<span style="color:var(--text)">AGENT</span></div>
  <div class="agent-pills">
    <div class="pill a"><div class="pill-dot"></div>ANALYST</div>
    <div class="pill c"><div class="pill-dot"></div>CRITIC</div>
    <div class="pill s"><div class="pill-dot"></div>SYNTHESIZER</div>
  </div>
  <div class="header-modes">
    <button class="mode-btn active" onclick="setMode('collaborative',this)">🤝 Kolaboratif</button>
    <button class="mode-btn" onclick="setMode('analyst',this)">🔍 Analyst</button>
    <button class="mode-btn" onclick="setMode('critic',this)">⚔️ Critic</button>
    <button class="mode-btn" onclick="setMode('synthesizer',this)">✨ Synthesizer</button>
  </div>
  <button class="hdr-icon" onclick="clearChat()" title="Chat Baru" style="margin-left:8px">✕</button>
</header>

<div class="app-body">
  <aside class="sidebar">
    <div class="sidebar-sec">
      <div class="sidebar-lbl">Percakapan</div>
      <button class="new-btn" onclick="newChat()">+ Mulai Chat Baru</button>
    </div>
    <div class="conv-list" id="convList">
      <div class="conv-item active">
        <div class="conv-title">Percakapan Baru</div>
        <div class="conv-time">Sekarang</div>
      </div>
    </div>
    <div class="sidebar-bottom">
      <div class="sidebar-lbl">Model Aktif</div>
      <div class="model-info" id="modelInfo">Memeriksa...</div>
      <div class="dash-link" onclick="window.open('http://localhost:3000','_blank')">⬡ Admin Dashboard</div>
    </div>
  </aside>

  <div class="chat-area">
    <div class="prog-bar hidden" id="progBar">
      <div class="pstep" id="ps-analyst"><div class="pnum">1</div>Analyst</div>
      <span class="psep">→</span>
      <div class="pstep" id="ps-critic"><div class="pnum">2</div>Critic</div>
      <span class="psep">→</span>
      <div class="pstep" id="ps-synthesizer"><div class="pnum">3</div>Synthesizer</div>
      <span id="prog-status"></span>
    </div>

    <div class="messages" id="messages">
      <div class="bubble sys-msg animate-in">
        Selamat datang! Saya adalah sistem AI multi-agent. Pilih mode di atas lalu mulai bertanya. Dalam mode Kolaboratif, tiga agent (Analyst, Critic, Synthesizer) akan berdiskusi untuk memberi jawaban terbaik.
      </div>
    </div>

    <div id="mediaPreview" style="display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 6px"></div>

    <div class="input-area">
      <div class="tools-row">
        <button class="tool-btn" onclick="document.getElementById('fileInput').click()">📎 File</button>
        <button class="tool-btn" onclick="document.getElementById('imageInput').click()">🖼️ Gambar</button>
        <button class="tool-btn" id="voiceBtn" onclick="toggleVoice()">🎤 Suara</button>
        <button class="tool-btn" id="screenBtn" onclick="toggleScreen()">🖥️ Screen Share</button>
        <button class="tool-btn" id="ttsBtn" onclick="toggleTTS()">🔊 TTS</button>
        <div class="mode-lbl">Mode: <strong id="modeLbl">Kolaboratif (3 Agent)</strong></div>
      </div>
      <div class="input-row">
        <textarea class="msg-input" id="msgInput"
          placeholder="Tanyakan apa saja — strategi bisnis, debugging code, analisis dokumen..."
          rows="1"
          onkeydown="handleKey(event)"
          oninput="autoH(this)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()">➤</button>
      </div>
      <div class="input-hint">Enter untuk kirim · Shift+Enter untuk baris baru</div>
    </div>
  </div>
</div>

<!-- VOICE MODAL -->
<div class="voice-overlay hidden" id="voiceOverlay">
  <div class="voice-modal">
    <div style="font-size:42px;margin-bottom:12px">🎤</div>
    <h3 style="font-family:'IBM Plex Mono',monospace;margin-bottom:6px">Berbicara...</h3>
    <p style="font-size:12px;color:var(--text2)">Katakan pertanyaan Anda</p>
    <div class="wave">
      <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
      <div class="wave-bar"></div><div class="wave-bar"></div>
    </div>
    <div id="voiceText" style="font-size:13px;min-height:18px;padding:8px;background:var(--bg3);border-radius:8px;margin-bottom:14px;color:var(--text)"></div>
    <button onclick="stopVoice()" style="padding:8px 24px;border-radius:8px;border:none;background:var(--critic);color:white;cursor:pointer;font-size:13px">■ Stop</button>
  </div>
</div>

<!-- SCREEN PREVIEW -->
<div class="screen-preview hidden" id="screenPreview">
  <div class="screen-hdr">🖥️ SCREEN SHARE <button onclick="stopScreen()" style="background:none;border:none;color:white;cursor:pointer;font-size:11px">✕</button></div>
  <video id="screenVideo" autoplay muted></video>
</div>

<input type="file" id="fileInput" hidden accept=".txt,.md,.pdf,.docx,.csv,.json,.py,.js,.ts,.html" onchange="handleFile(event)">
<input type="file" id="imageInput" hidden accept="image/*" onchange="handleImage(event)">

<script>
// ── CONFIG ────────────────────────────────────────────────
const API_URL = 'http://localhost:8000';
let currentMode = 'collaborative';
let chatHistory = [];
let pendingMedia = [];
let isStreaming  = false;
let ttsEnabled   = false;
let recognition  = null;
let screenStream = null;

// ── INIT ─────────────────────────────────────────────────
window.onload = () => {
  checkHealth();
};

async function checkHealth() {
  try {
    const r = await fetch(`${API_URL}/api/agents/health`);
    const d = await r.json();
    const models = d.ollama?.models || [];
    document.getElementById('modelInfo').textContent =
      models.length ? models[0] : 'Tidak ada model';
  } catch(e) {
    document.getElementById('modelInfo').textContent = 'Offline — jalankan Docker';
    addSysMsg('⚠️ Backend tidak tersambung. Pastikan: sudo docker compose up -d');
  }
}

// ── MODE ─────────────────────────────────────────────────
function setMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const labels = {
    collaborative: 'Kolaboratif (3 Agent)',
    analyst:       'Analyst',
    critic:        'Critic',
    synthesizer:   'Synthesizer'
  };
  document.getElementById('modeLbl').textContent = labels[mode] || mode;
}

// ── SEND ─────────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById('msgInput');
  const msg   = input.value.trim();
  if (!msg && pendingMedia.length === 0) return;

  isStreaming = true;
  document.getElementById('sendBtn').disabled = true;
  input.value = '';
  input.style.height = 'auto';

  // Hapus welcome message
  const msgs = document.getElementById('messages');
  const welcome = msgs.querySelector('.sys-msg');
  if (welcome && msgs.children.length === 1) welcome.remove();

  addUserBubble(msg, pendingMedia);
  pendingMedia = [];
  document.getElementById('mediaPreview').innerHTML = '';

  chatHistory.push({ role: 'user', content: msg });

  try {
    if (currentMode === 'collaborative') {
      showProgress();
      await streamCollaborative(msg);
    } else {
      await streamSingle(currentMode, msg);
    }
  } catch(e) {
    addSysMsg('❌ Error: ' + e.message + '. Cek: sudo docker logs ai-backend --tail 20');
  }

  isStreaming = false;
  document.getElementById('sendBtn').disabled = false;
  hideProgress();
}

// ── STREAM COLLABORATIVE ─────────────────────────────────
async function streamCollaborative(msg) {
  let resp;
  try {
    resp = await fetch(`${API_URL}/api/agents/chat/stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: msg, history: chatHistory.slice(-8), mode: 'collaborative', rounds: 2 })
    });
  } catch(e) {
    throw new Error('Tidak bisa konek ke backend: ' + e.message);
  }

  if (!resp.ok) throw new Error('Backend error: ' + resp.status);

  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentBubble = null;
  let currentAgent  = null;
  let currentText   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // simpan baris tidak lengkap

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      let event;
      try { event = JSON.parse(raw); } catch(e) { continue; }

      if (event.type === 'agent_start') {
        currentAgent  = event.agent;
        currentText   = '';
        currentBubble = createAgentBubble(event.agent);
        setProgressStep(event.agent);

      } else if (event.type === 'chunk') {
        if (!currentBubble) currentBubble = createAgentBubble(currentAgent || 'analyst');
        currentText += event.content || '';
        updateBubble(currentBubble, currentText, true);

      } else if (event.type === 'agent_done') {
        const finalText = event.full_response || currentText;
        if (currentBubble) updateBubble(currentBubble, finalText, false);
        chatHistory.push({ role: 'assistant', content: `[${(currentAgent||'').toUpperCase()}]: ${finalText}` });
        if (ttsEnabled && event.agent === 'synthesizer') speak(finalText);
        currentBubble = null;
        currentText   = '';

      } else if (event.type === 'error') {
        addSysMsg('❌ Agent error: ' + (event.message || 'unknown'));
      }
    }
  }
}

// ── STREAM SINGLE ─────────────────────────────────────────
async function streamSingle(agentName, msg) {
  let resp;
  try {
    resp = await fetch(`${API_URL}/api/agents/chat/stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: msg, history: chatHistory.slice(-8), mode: 'single', agent_name: agentName })
    });
  } catch(e) {
    throw new Error('Tidak bisa konek ke backend: ' + e.message);
  }

  if (!resp.ok) throw new Error('Backend error: ' + resp.status);

  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentBubble = null;
  let currentText   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      let event;
      try { event = JSON.parse(raw); } catch(e) { continue; }

      if (event.type === 'agent_start') {
        currentBubble = createAgentBubble(event.agent);
        currentText   = '';

      } else if (event.type === 'chunk') {
        if (!currentBubble) currentBubble = createAgentBubble(agentName);
        currentText += event.content || '';
        updateBubble(currentBubble, currentText, true);

      } else if (event.type === 'session_complete') {
        if (currentBubble) updateBubble(currentBubble, currentText, false);
        chatHistory.push({ role: 'assistant', content: currentText });
        if (ttsEnabled) speak(currentText);
      }
    }
  }
}

// ── UI HELPERS ────────────────────────────────────────────
function createAgentBubble(agent) {
  const msgs  = document.getElementById('messages');
  const div   = document.createElement('div');
  const map   = { analyst:'analyst-msg', critic:'critic-msg', synthesizer:'synthesizer-msg' };
  const hdrs  = { analyst:'ANALYST', critic:'CRITIC', synthesizer:'SYNTHESIZER' };
  const hcls  = { analyst:'analyst-hdr', critic:'critic-hdr', synthesizer:'synthesizer-hdr' };
  const icons = { analyst:'🔍', critic:'⚔️', synthesizer:'✨' };

  div.className = 'bubble ' + (map[agent] || 'analyst-msg') + ' animate-in';
  div.innerHTML = `
    <div class="bub-hdr ${hcls[agent] || 'analyst-hdr'}">${icons[agent]||''} ${hdrs[agent]||agent.toUpperCase()}</div>
    <div class="bub-body">
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollBot();
  return div;
}

function updateBubble(bubble, text, streaming) {
  if (!bubble) return;
  const body = bubble.querySelector('.bub-body');
  if (!body) return;
  body.innerHTML = renderMD(text) + (streaming ? '<span class="blink-cursor">▋</span>' : '');
  scrollBot();
}

function addUserBubble(text, media) {
  const msgs = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = 'bubble user animate-in';
  let html = '<div class="bub-hdr user-hdr">👤 ANDA</div><div class="bub-body">';
  if (text) html += escHTML(text).replace(/\n/g, '<br>');
  if (media.length) {
    media.forEach(m => {
      if (m.type === 'image') html += `<img src="${m.data}" style="max-width:180px;border-radius:6px;margin-top:6px;display:block">`;
      else html += `<div style="margin-top:6px;background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">📄 ${m.name}</div>`;
    });
  }
  html += '</div>';
  div.innerHTML = html;
  msgs.appendChild(div);
  scrollBot();
}

function addSysMsg(text) {
  const msgs = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = 'bubble sys-msg animate-in';
  div.textContent = text;
  msgs.appendChild(div);
  scrollBot();
}

function scrollBot() {
  const m = document.getElementById('messages');
  m.scrollTop = m.scrollHeight;
}

// ── MARKDOWN RENDERER ─────────────────────────────────────
function renderMD(text) {
  if (!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>')
    .replace(/`([^`\n]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/^### (.+)$/gm,'<h4 style="margin:8px 0 4px;color:var(--text)">$1</h4>')
    .replace(/^## (.+)$/gm,'<h3 style="margin:10px 0 4px;color:var(--text)">$1</h3>')
    .replace(/^# (.+)$/gm,'<h2 style="margin:10px 0 4px;color:var(--text)">$1</h2>')
    .replace(/^[-•] (.+)$/gm,'<li style="margin:2px 0">$1</li>')
    .replace(/(<li.*<\/li>)/gs, s => `<ul style="padding-left:18px;margin:4px 0">${s}</ul>`)
    .replace(/^(\d+)\. (.+)$/gm,'<li>$2</li>')
    .replace(/\n{2,}/g,'<br><br>')
    .replace(/\n/g,'<br>');
}

function escHTML(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PROGRESS BAR ──────────────────────────────────────────
function showProgress() {
  document.getElementById('progBar').classList.remove('hidden');
  ['analyst','critic','synthesizer'].forEach(a => {
    const el = document.getElementById('ps-'+a);
    el.classList.remove('active','done');
  });
}
function hideProgress() {
  document.getElementById('progBar').classList.add('hidden');
}
function setProgressStep(agent) {
  const steps = ['analyst','critic','synthesizer'];
  const idx   = steps.indexOf(agent);
  steps.forEach((s,i) => {
    const el = document.getElementById('ps-'+s);
    el.classList.remove('active','done');
    if (i < idx) el.classList.add('done');
    if (s === agent) el.classList.add('active');
  });
  const labels = { analyst:'Analyst menganalisis...', critic:'Critic mengevaluasi...', synthesizer:'Synthesizer merumuskan...' };
  document.getElementById('prog-status').textContent = labels[agent]||'';
}

// ── INPUT ─────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoH(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ── CHAT MANAGEMENT ───────────────────────────────────────
function clearChat() {
  document.getElementById('messages').innerHTML =
    '<div class="bubble sys-msg animate-in">Chat baru dimulai.</div>';
  chatHistory = [];
  pendingMedia = [];
  document.getElementById('mediaPreview').innerHTML = '';
}

function newChat() {
  clearChat();
  const list = document.getElementById('convList');
  const time = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const item = document.createElement('div');
  item.className = 'conv-item';
  item.innerHTML = `<div class="conv-title">Percakapan ${list.children.length+1}</div><div class="conv-time">${time}</div>`;
  item.onclick = () => {
    document.querySelectorAll('.conv-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
  };
  list.prepend(item);
  document.querySelectorAll('.conv-item').forEach(i=>i.classList.remove('active'));
  item.classList.add('active');
}

// ── FILE & IMAGE ──────────────────────────────────────────
function handleFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const content = ev.target.result;
    pendingMedia.push({ type:'file', name:file.name, data:content });
    const cur = document.getElementById('msgInput').value;
    document.getElementById('msgInput').value = cur + `\n\n[File: ${file.name}]\n${content.substring(0,3000)}`;
    updateMediaPreview();
  };
  reader.readAsText(file,'utf-8');
  e.target.value = '';
}

function handleImage(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingMedia.push({ type:'image', name:file.name, data:ev.target.result });
    updateMediaPreview();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function updateMediaPreview() {
  const p = document.getElementById('mediaPreview');
  p.innerHTML = pendingMedia.map((m,i) => {
    if (m.type==='image') return `<div style="position:relative"><img src="${m.data}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"><button onclick="removeMedia(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);border:none;color:white;border-radius:50%;width:16px;height:16px;cursor:pointer;font-size:9px">✕</button></div>`;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border-radius:6px;font-size:12px">📄 ${m.name}<button onclick="removeMedia(${i})" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:11px">✕</button></div>`;
  }).join('');
}

function removeMedia(i) { pendingMedia.splice(i,1); updateMediaPreview(); }

// ── VOICE ─────────────────────────────────────────────────
function toggleVoice() {
  const ov = document.getElementById('voiceOverlay');
  if (!ov.classList.contains('hidden')) { stopVoice(); return; }
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Gunakan Chrome untuk fitur suara'); return;
  }
  ov.classList.remove('hidden');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'id-ID';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = ev => {
    let t = '';
    for (let i=ev.resultIndex;i<ev.results.length;i++) t += ev.results[i][0].transcript;
    document.getElementById('voiceText').textContent = t;
    document.getElementById('msgInput').value = t;
  };
  recognition.onend = stopVoice;
  recognition.start();
}
function stopVoice() {
  if (recognition) { recognition.stop(); recognition = null; }
  document.getElementById('voiceOverlay').classList.add('hidden');
}

// ── TTS ───────────────────────────────────────────────────
function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('ttsBtn');
  btn.classList.toggle('on', ttsEnabled);
  btn.textContent = ttsEnabled ? '🔊 TTS ON' : '🔊 TTS';
}
function speak(text) {
  if (!ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(
    text.replace(/<[^>]*>/g,'').replace(/[#*`]/g,'').substring(0,500)
  );
  u.lang = 'id-ID'; u.rate = 1.0;
  window.speechSynthesis.speak(u);
}

// ── SCREEN SHARE ──────────────────────────────────────────
async function toggleScreen() {
  const preview = document.getElementById('screenPreview');
  if (!preview.classList.contains('hidden')) { stopScreen(); return; }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    document.getElementById('screenVideo').srcObject = screenStream;
    preview.classList.remove('hidden');
    document.getElementById('screenBtn').classList.add('on');
    screenStream.getVideoTracks()[0].onended = stopScreen;
    addSysMsg('🖥️ Screen sharing aktif. Jelaskan apa yang ingin dianalisis dari layar Anda.');
  } catch(e) {
    if (e.name !== 'AbortError') addSysMsg('Gagal screen share: ' + e.message);
  }
}
function stopScreen() {
  if (screenStream) { screenStream.getTracks().forEach(t=>t.stop()); screenStream = null; }
  document.getElementById('screenPreview').classList.add('hidden');
  document.getElementById('screenBtn').classList.remove('on');
}
</script>
</body>
</html>
HTMLEOF

echo "✅ frontend-chatbot/index.html updated"

echo ""
echo "▶ Restart container chatbot..."
sudo docker compose restart chatbot

echo ""
echo "✅ Selesai! Refresh browser di http://localhost:3001"
echo ""
echo "══════════════════════════════════════"
echo "CARA IMPORT WORKFLOW N8N:"
echo "1. Buka http://localhost:5678"
echo "2. Login: admin / admin123"
echo "3. Klik + (New Workflow) → Import from file"
echo "4. Upload file dari folder: n8n-workflows/"
echo "══════════════════════════════════════"
