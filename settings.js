// settings.js
const themeToggle = document.getElementById('theme-toggle');
const roleSelect = document.getElementById('role-select');
const ollamaUrlInput = document.getElementById('ollama-url-input');
const ollamaModelInput = document.getElementById('ollama-model-input');
const testOllamaBtn = document.getElementById('test-ollama-btn');
const testStatus = document.getElementById('ollama-test-status');

// Initialize settings from localStorage
const currentTheme = localStorage.getItem('aquaTheme');
if (currentTheme === 'light') {
    themeToggle.checked = true;
}

const currentRole = localStorage.getItem('aquaRole') || 'operator';
roleSelect.value = currentRole;

const currentOllamaUrl = localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434';
ollamaUrlInput.value = currentOllamaUrl;

const currentOllamaModel = localStorage.getItem('aquaOllamaModel') || 'llama3';
ollamaModelInput.value = currentOllamaModel;

// Handle theme toggle click
themeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('aquaTheme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('aquaTheme', 'dark');
    }
});

// Handle role selection
roleSelect.addEventListener('change', (e) => {
    localStorage.setItem('aquaRole', e.target.value);
});

// Handle Ollama URL input
ollamaUrlInput.addEventListener('input', (e) => {
    localStorage.setItem('aquaOllamaUrl', e.target.value.trim());
});

// Handle Ollama Model input
ollamaModelInput.addEventListener('input', (e) => {
    localStorage.setItem('aquaOllamaModel', e.target.value.trim());
});

// Test connection
testOllamaBtn.addEventListener('click', async () => {
    const url = (ollamaUrlInput.value || 'http://localhost:11434').trim().replace(/\/+$/, '');
    const model = (ollamaModelInput.value || 'llama3').trim();
    
    testStatus.style.display = 'block';
    testStatus.style.background = 'rgba(245, 158, 11, 0.1)';
    testStatus.style.color = 'var(--status-warning)';
    testStatus.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    testStatus.innerHTML = '⚡ Testing connection to Ollama server...';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(`${url}/api/tags`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json();
            const models = data.models ? data.models.map(m => m.name) : [];
            const isModelLoaded = models.some(m => m.startsWith(model));
            
            testStatus.style.background = 'rgba(16, 185, 129, 0.1)';
            testStatus.style.color = 'var(--status-normal)';
            testStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            
            let statusText = `<strong>✓ Connected successfully!</strong><br>Ollama is running at <code>${url}</code>.<br><br>`;
            statusText += `<strong>Local models found:</strong> ${models.join(', ') || 'None'}<br>`;
            
            if (isModelLoaded) {
                statusText += `<span style="color:var(--status-normal); font-weight:600;">✓ Model "${model}" is available and ready to use.</span>`;
            } else {
                statusText += `<span style="color:var(--status-warning); font-weight:600;">⚠️ Model "${model}" was not found in your local models.</span><br>`;
                statusText += `Please run <code>ollama pull ${model}</code> in your terminal to use it, or change the Model Name above to a model you already have downloaded.`;
            }
            testStatus.innerHTML = statusText;
        } else {
            throw new Error(`HTTP error ${res.status}`);
        }
    } catch (err) {
        testStatus.style.background = 'rgba(239, 68, 68, 0.1)';
        testStatus.style.color = 'var(--status-critical)';
        testStatus.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        
        let errorMsg = `<strong>⚠️ Connection Failed:</strong> Could not reach Ollama at <code>${url}</code>.<br><br>`;
        errorMsg += `<strong>Troubleshooting steps:</strong><br>`;
        errorMsg += `1. Verify Ollama is running. Open a terminal and run: <code>ollama serve</code> or check the system tray.<br>`;
        errorMsg += `2. <strong>CORS Configuration (Crucial)</strong>: By default, web browsers block local web app requests to Ollama. To fix this, you must run Ollama with CORS allowed:<br>`;
        errorMsg += `   • <strong>Windows Command Prompt</strong>: <code>set OLLAMA_ORIGINS=* && ollama serve</code><br>`;
        errorMsg += `   • <strong>Windows PowerShell</strong>: <code>$env:OLLAMA_ORIGINS="*" ; ollama serve</code><br>`;
        errorMsg += `   • <strong>Mac/Linux</strong>: <code>OLLAMA_ORIGINS="*" ollama serve</code><br>`;
        errorMsg += `3. Verify the model <strong>${model}</strong> is downloaded. Run: <code>ollama pull ${model}</code>.`;
        
        testStatus.innerHTML = errorMsg;
    }
});
