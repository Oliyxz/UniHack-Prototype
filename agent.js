// agent.js — AquaSense AI Assistant (llama3 via Ollama)
// Self-contained: creates floating chat button + drawer, appended to document.body.

(function () {
    'use strict';

    const getOllamaUrl = () => (localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434').replace(/\/+$/, '') + '/api/chat';
    const getOllamaTagsUrl = () => (localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434').replace(/\/+$/, '') + '/api/tags';
    const getOllamaModel = () => localStorage.getItem('aquaOllamaModel') || 'llama3';

    let messages    = [];   // conversation history
    let isStreaming = false;
    let isOpen      = false;

    // ── Quick-action prompts ───────────────────────────────────────────────────
    const QUICK_ACTIONS = [
        { label: '📊 Compliance status',  prompt: 'Summarise the current compliance status across all stations.' },
        { label: '⚠️ Latest breach',      prompt: 'Explain the latest breach alert in detail and what action should be taken.' },
        { label: '📈 COD risk analysis',   prompt: 'Analyse the current COD reading and whether it poses an imminent breach risk.' },
        { label: '📋 Incident summary',    prompt: 'Generate a brief incident summary report for the current monitoring session.' },
        { label: '💰 ROI breakdown',       prompt: 'Explain the estimated regulatory fines avoided figure and how it is calculated.' },
        { label: '🌍 Station overview',    prompt: 'Give a quick health overview of all 6 monitoring stations.' },
    ];

    // ── Context builder — reads live DOM state ─────────────────────────────────
    function readDOM(id, fallback) {
        return document.getElementById(id)?.textContent?.trim() || fallback;
    }

    function cardStatus(cardId) {
        const el = document.getElementById(cardId);
        if (!el) return 'Unknown';
        if (el.classList.contains('critical')) return 'CRITICAL ⚠️';
        if (el.classList.contains('warning'))  return 'WARNING ⚠️';
        return 'Normal ✓';
    }

    function buildSystemPrompt() {
        const role = localStorage.getItem('aquaRole') || 'operator';

        const toneLine = {
            operator:  'You are assisting a technical Operator. Be precise, technical, and reference thresholds and equipment actions.',
            executive: 'You are assisting an Executive. Focus on KPIs, financial impact, ROI, and regulatory risk. Avoid excessive technical jargon.',
            regulator: 'You are assisting a Regulator (read-only). Focus on Section 82 Environment Act 2021 compliance obligations, discharge consents, and breach reporting.',
        }[role] || '';

        const page = window.location.pathname.split('/').pop() || 'index.html';
        const pageLabel = {
            'index.html': 'Live Dashboard', 'analytics.html': 'Analytics History',
            'reports.html': 'Reports Archive', 'stakeholder.html': 'Stakeholder Views',
            'sensor-health.html': 'Sensor Health', 'audit-log.html': 'Audit Log',
            'support.html': 'IT Support', 'settings.html': 'Settings',
        }[page] || 'Dashboard';

        return `You are AquaSense AI Assistant — an expert in industrial wastewater monitoring and UK Section 82 Environment Act 2021 compliance.
${toneLine}

CURRENT PLATFORM STATE:
- Page: ${pageLabel}
- Active View: ${readDOM('chart-station-label', 'ALL STATIONS · GLOBAL COMPOSITE')}
- ${readDOM('risk-badge', 'Risky Parameters: 0')}

LIVE SENSOR READINGS:
- pH: ${readDOM('val-ph','N/A')} (${cardStatus('card-ph')}) | Limit: 6.0–9.0
- COD: ${readDOM('val-cod','N/A')} mg/L (${cardStatus('card-cod')}) | Limit: <150 mg/L
- BOD: ${readDOM('val-bod','N/A')} mg/L (${cardStatus('card-bod')}) | Limit: <50 mg/L
- TSS: ${readDOM('val-tss','N/A')} mg/L (${cardStatus('card-tss')}) | Limit: <30 mg/L
- Temperature: ${readDOM('val-temp','N/A')} °C (${cardStatus('card-temp')}) | Limit: <30 °C
- Toxic Contaminants: ${readDOM('val-toxic','N/A')} mg/L (${cardStatus('card-toxic')}) | Limit: <5.0 mg/L

COMPLIANCE KPIs:
- Active Breaches: ${readDOM('kpi-breaches','0')}
- 24h Compliance Rate: ${readDOM('kpi-compliance','100%')}
- Est. Fines Avoided: ${readDOM('kpi-fines','£0')}
- Monitoring: 6 stations (EUR-1 · AMN-1 · APC-1 · AFR-1 · AMS-1 · PCF-1)

INSTRUCTIONS:
- Answer concisely and accurately based only on the data above.
- If a parameter is at WARNING or CRITICAL, proactively flag it.
- For compliance questions cite Section 82 Environment Act 2021 where relevant.
- Do not fabricate values not listed above.`;
    }

    // ── Ollama streaming API ───────────────────────────────────────────────────
    async function streamChat(userMessage, onToken, onDone, onError) {
        const apiMessages = [
            { role: 'system', content: buildSystemPrompt() },
            ...messages,
            { role: 'user', content: userMessage },
        ];

        try {
            const res = await fetch(getOllamaUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: getOllamaModel(), messages: apiMessages, stream: true }),
            });

            if (!res.ok) throw new Error(`Ollama error ${res.status}`);

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let full = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                for (const line of decoder.decode(value, { stream: true }).split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const j = JSON.parse(line);
                        if (j.message?.content) { full += j.message.content; onToken(j.message.content); }
                        if (j.done) { onDone(full); return; }
                    } catch (_) {}
                }
            }
            onDone(full);
        } catch (err) {
            onError(err.name === 'TypeError' ? 'offline' : err.message);
        }
    }

    // ── Ollama health check ────────────────────────────────────────────────────
    async function checkConnection() {
        try {
            const res = await fetch(getOllamaTagsUrl(), { signal: AbortSignal.timeout(3000) });
            setStatus(res.ok ? 'online' : 'offline');
        } catch { setStatus('offline'); }
    }

    function setStatus(state) {
        const el = document.getElementById('aqua-ai-sub');
        if (!el) return;
        el.innerHTML = state === 'online'
            ? `<span class="aq-dot online"></span> ${getOllamaModel()} · Ready`
            : `<span class="aq-dot offline"></span> Ollama Offline`;
    }

    // ── UI helpers ─────────────────────────────────────────────────────────────
    function esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }

    function scrollBottom() {
        const f = document.getElementById('aq-feed');
        if (f) f.scrollTop = f.scrollHeight;
    }

    function appendUserMsg(text) {
        const f = document.getElementById('aq-feed');
        const d = document.createElement('div');
        d.className = 'aq-msg user';
        d.innerHTML = `<div class="aq-bubble"><span>${esc(text)}</span></div>`;
        f.appendChild(d); scrollBottom();
    }

    function appendAiTyping(id) {
        const f = document.getElementById('aq-feed');
        const d = document.createElement('div');
        d.className = 'aq-msg ai'; d.id = id;
        d.innerHTML = `<div class="aq-bubble"><div class="aq-typing"><span></span><span></span><span></span></div><span class="aq-text"></span></div>`;
        f.appendChild(d); scrollBottom();
    }

    function chipsHTML() {
        return `<div class="aq-chips" id="aq-chips">${QUICK_ACTIONS.map(a =>
            `<button class="aq-chip" onclick="aquaQuick(${JSON.stringify(a.prompt)})">${a.label}</button>`
        ).join('')}</div>`;
    }

    // ── Build DOM ──────────────────────────────────────────────────────────────
    function buildUI() {
        // Floating button
        const btn = document.createElement('button');
        btn.id = 'aq-btn';
        btn.innerHTML = `<span class="aq-btn-star">✦</span><span>Ask AI</span>`;
        btn.onclick = toggleDrawer;
        document.body.appendChild(btn);

        // Drawer
        const drawer = document.createElement('div');
        drawer.id = 'aq-drawer';
        drawer.innerHTML = `
        <div class="aq-head">
            <div class="aq-head-left">
                <div class="aq-avatar">✦</div>
                <div>
                    <div class="aq-title">AquaSense AI</div>
                    <div class="aq-sub" id="aqua-ai-sub"><span class="aq-dot"></span> Connecting…</div>
                </div>
            </div>
            <div class="aq-head-right">
                <button title="Clear" onclick="aquaClear()">↺</button>
                <button title="Close" onclick="aquaClose()">✕</button>
            </div>
        </div>
        <div class="aq-feed" id="aq-feed">
            <div class="aq-welcome">
                <div class="aq-welcome-icon">✦</div>
                <p>Hi! I'm your AquaSense AI assistant, powered by <strong>${getOllamaModel()}</strong>. I have live access to all your sensor readings and compliance data.</p>
                <p class="aq-welcome-hint">Ask me anything about your wastewater monitoring, breaches, or compliance.</p>
            </div>
            ${chipsHTML()}
        </div>
        <div class="aq-footer">
            <div class="aq-input-row">
                <textarea id="aq-input" placeholder="Ask about sensors, compliance, breaches…" rows="1" onkeydown="aquaKey(event)"></textarea>
                <button id="aq-send" onclick="aquaSend()" title="Send">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
            </div>
            <div class="aq-powered">Powered by Ollama · ${getOllamaModel()} · Running locally on your machine</div>
        </div>`;
        document.body.appendChild(drawer);

        // Auto-resize textarea
        document.getElementById('aq-input').addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        checkConnection();
    }

    // ── Public API (window globals) ────────────────────────────────────────────
    function toggleDrawer() {
        isOpen = !isOpen;
        document.getElementById('aq-drawer').classList.toggle('open', isOpen);
        document.getElementById('aq-btn').classList.toggle('active', isOpen);
        if (isOpen) setTimeout(() => document.getElementById('aq-input')?.focus(), 300);
    }

    window.aquaClose = function () {
        isOpen = false;
        document.getElementById('aq-drawer')?.classList.remove('open');
        document.getElementById('aq-btn')?.classList.remove('active');
    };

    window.aquaClear = function () {
        messages = [];
        document.getElementById('aq-feed').innerHTML =
            `<div class="aq-welcome"><div class="aq-welcome-icon">✦</div><p>Conversation cleared. How can I help?</p></div>${chipsHTML()}`;
    };

    window.aquaQuick = function (prompt) {
        const inp = document.getElementById('aq-input');
        if (inp) { inp.value = prompt; inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; }
        aquaSend();
    };

    window.aquaKey = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aquaSend(); }
    };

    window.aquaSend = async function () {
        if (isStreaming) return;
        const inp  = document.getElementById('aq-input');
        const text = inp?.value?.trim();
        if (!text) return;

        inp.value = ''; inp.style.height = 'auto';
        document.getElementById('aq-chips')?.remove();

        appendUserMsg(text);
        messages.push({ role: 'user', content: text });

        const aiId = 'ai-' + Date.now();
        appendAiTyping(aiId);
        isStreaming = true;
        document.getElementById('aq-send').disabled = true;

        let full = '';

        await streamChat(text,
            (token) => {
                full += token;
                const el = document.getElementById(aiId);
                if (el) {
                    el.querySelector('.aq-typing')?.remove();
                    el.querySelector('.aq-text').innerHTML = esc(full);
                    scrollBottom();
                }
            },
            (finalText) => {
                isStreaming = false;
                document.getElementById('aq-send').disabled = false;
                messages.push({ role: 'assistant', content: finalText });
                scrollBottom();
            },
            (err) => {
                isStreaming = false;
                document.getElementById('aq-send').disabled = false;
                const el = document.getElementById(aiId);
                if (el) {
                    el.querySelector('.aq-typing')?.remove();
                    el.querySelector('.aq-text').innerHTML = err === 'offline'
                        ? `<span class="aq-err">⚠️ Ollama is not running. Start it with <code>ollama serve</code> in your terminal, then try again.</span>`
                        : `<span class="aq-err">Error: ${esc(err)}</span>`;
                    if (err === 'offline') setStatus('offline');
                }
            }
        );
    };

    // ── Init ───────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', buildUI);

})();
