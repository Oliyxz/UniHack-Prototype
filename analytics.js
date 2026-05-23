// Configuration
const CONFIG = {
    ph: { min: 6.0, max: 9.0, label: 'pH', color: '#00d2ff', base: 7.2, noise: 0.8 },
    cod: { max: 150, label: 'COD', color: '#10b981', base: 110, noise: 30 },
    bod: { max: 50, label: 'BOD', color: '#f97316', base: 25, noise: 10 },
    tss: { max: 30, label: 'TSS', color: '#8b5cf6', base: 15, noise: 8 },
    temp: { max: 30, label: 'Temp', color: '#f43f5e', base: 22, noise: 5 },
    toxic: { max: 5, label: 'Toxic', color: '#eab308', base: 1.0, noise: 1.5 }
};

const REGIONS = {
    'global': 'Global', 'na': 'North America', 'sa': 'South America',
    'eu': 'Europe', 'af': 'Africa', 'as': 'Asia', 'oc': 'Oceania'
};

// UI Elements
const regionFilter = document.getElementById('region-filter');
const dateFilter = document.getElementById('date-filter');
const breachFeed = document.getElementById('history-breach-feed');

// Chart Instances
let chartWeekly, chartMonthly, chartYearly;

// Initialize Date Picker to Today
dateFilter.valueAsDate = new Date();

const REGION_TEMP_BASES = {
    'global': 22.5,
    'eu': 14,
    'na': 18,
    'as': 26,
    'af': 29,
    'sa': 25,
    'oc': 23
};

// Helper: Generate or Get Permanent History
const getSliceOffset = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const selected = new Date(dateFilter.value);
    selected.setHours(0,0,0,0);
    const diffTime = today.getTime() - selected.getTime();
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

const getPermanentStore = () => {
    const STORE_KEY = 'aquaAnalyticsPermanentStore';
    let store = localStorage.getItem(STORE_KEY);
    if (store) return JSON.parse(store);
    
    store = {};
    const days = 3650;
    
    Object.keys(REGIONS).forEach(region => {
        store[region] = {};
        Object.keys(CONFIG).forEach(key => {
            let data = [];
            let baseVal = CONFIG[key].base;
            if (key === 'temp') baseVal = REGION_TEMP_BASES[region] || 22.5;
            let current = baseVal;
            for (let i = 0; i < days; i++) {
                current += (Math.random() - 0.5) * CONFIG[key].noise;
                if (current < 0) current = 0;
                data.push(parseFloat(current.toFixed(2)));
            }
            store[region][key] = data;
        });
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return store;
};

const generateMockData = (points, baseConfig, key = '', intervalType = 'day') => {
    const store = getPermanentStore();
    const region = regionFilter.value || 'global';
    const fullHistory = store[region][key];
    
    const diffDays = getSliceOffset();
    const endIndex = fullHistory.length - 1 - diffDays;
    
    let data = [];
    if (intervalType === 'day') {
        let start = Math.max(0, endIndex - points + 1);
        data = fullHistory.slice(start, endIndex + 1);
    } else if (intervalType === 'week') {
        for (let i = points - 1; i >= 0; i--) {
            let start = Math.max(0, endIndex - (i * 7) - 6);
            let end = endIndex - (i * 7);
            const slice = fullHistory.slice(start, end + 1);
            const avg = slice.reduce((a,b)=>a+b,0) / Math.max(slice.length, 1);
            data.push(parseFloat(avg.toFixed(2)));
        }
    } else if (intervalType === 'month') {
        for (let i = points - 1; i >= 0; i--) {
            let start = Math.max(0, endIndex - (i * 30) - 29);
            let end = endIndex - (i * 30);
            const slice = fullHistory.slice(start, end + 1);
            const avg = slice.reduce((a,b)=>a+b,0) / Math.max(slice.length, 1);
            data.push(parseFloat(avg.toFixed(2)));
        }
    }
    return data;
};

// Generate labels
const generateLabels = (points, intervalType) => {
    let labels = [];
    const date = new Date(dateFilter.value);
    for (let i = points; i > 0; i--) {
        let d = new Date(date);
        if (intervalType === 'day') {
            d.setDate(d.getDate() - i + 1);
            labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
        } else if (intervalType === 'week') {
            d.setDate(d.getDate() - (i * 7) + 7);
            labels.push(`Week ${i}`);
        } else if (intervalType === 'month') {
            d.setMonth(d.getMonth() - i + 1);
            labels.push(d.toLocaleDateString(undefined, { month: 'short' }));
        }
    }
    return labels;
};

// Update Averages
const updateAverages = (metricsData) => {
    Object.keys(CONFIG).forEach(k => {
        const val = metricsData[k][metricsData[k].length - 1]; // Use last point as "Today"
        document.getElementById(`val-avg-${k}`).innerText = val.toFixed(1);
        
        let status = 'normal';
        if (k === 'ph') {
            if (val <= CONFIG.ph.min || val >= CONFIG.ph.max) status = 'critical';
        } else {
            if (val >= CONFIG[k].max) status = 'critical';
            else if (val >= CONFIG[k].max * 0.8) status = 'warning';
        }
        
        const card = document.getElementById(`card-avg-${k}`);
        card.className = `metric-card glass-panel ${status !== 'normal' ? status : ''}`;
    });
};

// Common Chart Options
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
const commonGrid = { color: 'rgba(255, 255, 255, 0.05)' };

const createChartOptions = () => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: commonGrid },
        y: { grid: commonGrid }
    }
});

const PROJ_STEPS  = 3;  // project 3 extra points forward on analytics charts
const PROJ_WINDOW = 5;  // regression window

function linearRegression(pts) {
    const n = pts.length;
    if (n < 2) return { slope: 0, intercept: pts[0] || 0 };
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += pts[i]; sxy += i * pts[i]; sxx += i * i; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { slope, intercept: (sy - slope * sx) / n };
}

function buildProjection(data) {
    const win = data.slice(-PROJ_WINDOW);
    const { slope, intercept } = linearRegression(win);
    const base = win.length;
    return Array.from({ length: PROJ_STEPS }, (_, i) => {
        const v = intercept + slope * (base + i);
        return parseFloat(Math.max(0, v).toFixed(2));
    });
}

const getDatasets = (points, intervalType) => {
    return Object.keys(CONFIG).map(k => {
        const hist = generateMockData(points, CONFIG[k], k, intervalType);
        const proj = buildProjection(hist);
        // Observed series
        const observed = {
            label: CONFIG[k].label,
            data: [...hist, ...proj.map(() => null)],
            borderColor: CONFIG[k].color,
            backgroundColor: CONFIG[k].color + '22',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 2,
            fill: true
        };
        // Projection series
        const projection = {
            label: `${CONFIG[k].label} Forecast`,
            data: [...hist.map(() => null), ...proj],
            borderColor: CONFIG[k].color + 'aa',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
            fill: false
        };
        return [observed, projection];
    }).flat();
};

const initCharts = () => {
    const ctxW = document.getElementById('chartWeekly').getContext('2d');
    chartWeekly = new Chart(ctxW, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: createChartOptions()
    });

    const ctxM = document.getElementById('chartMonthly').getContext('2d');
    chartMonthly = new Chart(ctxM, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: createChartOptions()
    });

    const ctxY = document.getElementById('chartYearly').getContext('2d');
    chartYearly = new Chart(ctxY, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: createChartOptions()
    });
};

// Generate Mock Breaches (Persistent)
const generateBreaches = () => {
    breachFeed.innerHTML = '';
    const region = regionFilter.value;
    const regionName = REGIONS[region];
    
    let allMockBreaches = JSON.parse(localStorage.getItem('aquaAnalyticsBreaches'));
    if (!allMockBreaches) {
        allMockBreaches = [];
        const types = ['pH', 'COD', 'BOD', 'TSS', 'Temperature', 'Toxic Contaminants'];
        
        Object.keys(REGIONS).forEach(regId => {
            const rName = REGIONS[regId];
            const subRegions = regId === 'global' ? Object.values(REGIONS).slice(1) : [rName];
            for (let i = 0; i < 400; i++) {
                allMockBreaches.push({
                    regionId: regId,
                    location: subRegions[Math.floor(Math.random() * subRegions.length)],
                    isCritical: Math.random() > 0.5,
                    type: types[Math.floor(Math.random() * types.length)],
                    daysAgo: Math.floor(Math.random() * 3650)
                });
            }
        });
        localStorage.setItem('aquaAnalyticsBreaches', JSON.stringify(allMockBreaches));
    }

    const diffDays = getSliceOffset();
    const relevantBreaches = allMockBreaches.filter(b => 
        b.regionId === region && 
        b.daysAgo >= diffDays && 
        b.daysAgo <= diffDays + 30
    ).sort((a,b) => a.daysAgo - b.daysAgo);

    const todayCount = relevantBreaches.filter(b => b.daysAgo === diffDays).length;
    const weekCount = relevantBreaches.filter(b => b.daysAgo >= diffDays && b.daysAgo <= diffDays + 7).length;
    const monthCount = relevantBreaches.length;

    document.getElementById('breach-count-day').innerText = `${todayCount} Today`;
    document.getElementById('breach-count-week').innerText = `${weekCount} This Week`;
    document.getElementById('breach-count-month').innerText = `${monthCount} This Month`;

    if (monthCount === 0) {
        breachFeed.innerHTML = '<div class="empty-state">No historical breaches found for this period.</div>';
        return;
    }

    relevantBreaches.forEach(b => {
        const d = new Date();
        d.setDate(d.getDate() - b.daysAgo);
        const dateStr = d.toLocaleDateString();

        const html = `
            <div class="alert-item ${b.isCritical ? 'critical' : 'warning'}">
                <div class="alert-icon"><i data-lucide="${b.isCritical ? 'alert-octagon' : 'alert-triangle'}"></i></div>
                <div class="alert-content">
                    <p><strong>[${b.location}]</strong> Limit violation detected for ${b.type}.</p>
                    <span class="alert-time">Date: ${dateStr} - STATUS: ${b.isCritical ? 'CRITICAL' : 'WARNING'}</span>
                </div>
            </div>
        `;
        breachFeed.insertAdjacentHTML('beforeend', html);
    });
    if (window.lucide) window.lucide.createIcons();
};

const updateDashboard = () => {
    // Regenerate data
    const weeklyData  = getDatasets(7, 'day');
    const weeklyLabels = [...generateLabels(7, 'day'), 'Proj+1', 'Proj+2', 'Proj+3'];
    chartWeekly.data.labels   = weeklyLabels;
    chartWeekly.data.datasets = weeklyData;
    chartWeekly.update();

    const monthlyData  = getDatasets(4, 'week');
    const monthlyLabels = [...generateLabels(4, 'week'), 'Proj+1', 'Proj+2', 'Proj+3'];
    chartMonthly.data.labels   = monthlyLabels;
    chartMonthly.data.datasets = monthlyData;
    chartMonthly.update();

    const yearlyData  = getDatasets(12, 'month');
    const yearlyLabels = [...generateLabels(12, 'month'), 'Proj+1', 'Proj+2', 'Proj+3'];
    chartYearly.data.labels   = yearlyLabels;
    chartYearly.data.datasets = yearlyData;
    chartYearly.update();

    // Extract latest observed points for averages (last hist point per param)
    let latestAverages = {};
    const paramKeys = Object.keys(CONFIG);
    paramKeys.forEach((k, idx) => {
        // Each param now takes 2 datasets (observed + projection); observed is at idx*2
        latestAverages[k] = weeklyData[idx * 2].data.filter(v => v !== null);
    });
    updateAverages(latestAverages);

    generateBreaches();
    renderNearBreachLog();
};

// AI Trend Summary Logic
const generateAISummary = () => {
    const summaryContent = document.getElementById('ai-summary-content');
    if (!summaryContent) return;
    
    summaryContent.innerHTML = '<span style="color:var(--status-warning);">⏳ Analyzing data with local Ollama LLM...</span>';
    
    const region = REGIONS[regionFilter.value];
    const ph = document.getElementById('val-avg-ph').innerText;
    const cod = document.getElementById('val-avg-cod').innerText;
    const bod = document.getElementById('val-avg-bod').innerText;
    const toxic = document.getElementById('val-avg-toxic').innerText;
    const breaches = document.getElementById('breach-count-month').innerText;
    
    const prompt = `You are a Senior Wastewater Compliance AI. Analyze the following data for the ${region} region:
    - Average pH: ${ph}
    - Average COD: ${cod} mg/L
    - Average BOD: ${bod} mg/L
    - Average Toxic Contaminants: ${toxic} mg/L
    - Historical Breaches: ${breaches}
    
    Provide a concise, highly professional executive summary of these trends. Highlight the most critical information or potential risks by wrapping important keywords or metrics in HTML <strong> tags. Format your response as a single, well-structured paragraph suitable for a regulatory dashboard. Do NOT use markdown asterisks (*).`;
    const ollamaBase = (localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434').replace(/\/+$/, '');
    const ollamaModel = localStorage.getItem('aquaOllamaModel') || 'llama3';
    
    const formatAIResponse = (text) => {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        Object.keys(CONFIG).forEach(key => {
            const regex = new RegExp(`\\b${CONFIG[key].label}\\b`, 'gi');
            formatted = formatted.replace(regex, `<span style="color:${CONFIG[key].color}; font-weight:600;">$&</span>`);
        });
        return formatted;
    };

    fetch(`${ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: ollamaModel,
            prompt: prompt,
            stream: false
        })
    })
    .then(res => res.json())
    .then(data => {
        summaryContent.innerHTML = `<span style="color:var(--text-primary);"><strong>AI Insight:</strong></span> ${formatAIResponse(data.response)}`;
    })
    .catch(err => {
        console.error("Ollama fetch failed:", err);
        summaryContent.innerHTML = '<span style="color:var(--status-critical);">⚠ Error: Could not connect to local Ollama instance. Ensure Ollama is running.</span>';
    });
};

// Event Listeners
regionFilter.addEventListener('change', () => { updateDashboard(); document.getElementById('ai-summary-content').innerHTML = "Click 'Generate Summary' to interpret the selected day's data using the local Ollama LLM."; });
dateFilter.addEventListener('change', () => { updateDashboard(); document.getElementById('ai-summary-content').innerHTML = "Click 'Generate Summary' to interpret the selected day's data using the local Ollama LLM."; });
const btnGenerateAI = document.getElementById('btn-generate-ai');
if (btnGenerateAI) btnGenerateAI.addEventListener('click', generateAISummary);

// Fullscreen Logic
let modalChartInstance = null;
window.toggleFullscreen = (containerId) => {
    const modal = document.getElementById('chart-modal');
    
    if (!containerId || modal.style.display === 'flex') {
        modal.style.display = 'none';
        if (modalChartInstance) {
            modalChartInstance.destroy();
            modalChartInstance = null;
        }
        return;
    }

    modal.style.display = 'flex';
    let sourceChart, title;
    
    if (containerId === 'box-weekly') { sourceChart = chartWeekly; title = '7-Day Trend'; }
    else if (containerId === 'box-monthly') { sourceChart = chartMonthly; title = '30-Day Trend'; }
    else if (containerId === 'box-yearly') { sourceChart = chartYearly; title = '12-Month Trend'; }

    document.getElementById('chart-modal-title').innerText = title;
    const ctx = document.getElementById('modalChartCanvas').getContext('2d');
    
    console.log("toggleFullscreen called for containerId:", containerId);
    console.log("Source chart data labels:", sourceChart.data.labels);
    console.log("Source chart data datasets count:", sourceChart.data.datasets.length);
    
    // Create a fresh options object to avoid passing mutated internals, exactly like app.js
    const modalOptions = createChartOptions();
    modalOptions.animation = false;
    
    // Clone labels and datasets to avoid Chart.js multi-instance conflicts
    const clonedDatasets = sourceChart.data.datasets.map(ds => {
        console.log("Cloning dataset:", ds.label, "data points count:", ds.data.length);
        return Object.assign({}, ds, { data: [...ds.data] });
    });
    
    try {
        if (modalChartInstance) {
            console.log("Destroying old modalChartInstance");
            modalChartInstance.destroy();
        }
        
        console.log("Creating new modalChartInstance");
        modalChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...sourceChart.data.labels],
                datasets: clonedDatasets
            },
            options: modalOptions
        });
        console.log("modalChartInstance created successfully:", modalChartInstance);
    } catch (err) {
        console.error("Error creating modalChartInstance:", err);
    }
};

// ── Near-Breach Warning History (reads from localStorage populated by dashboard) ──
const renderNearBreachLog = () => {
    const container = document.getElementById('near-breach-log');
    if (!container) return;

    const log = JSON.parse(localStorage.getItem('aquaNearBreachLog') || '[]');
    const regionFilter = document.getElementById('region-filter')?.value || 'global';

    const filtered = regionFilter === 'global'
        ? log
        : log.filter(e => e.region.toLowerCase().includes(regionFilter));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No near-breach warnings recorded yet. They appear here when live sensor readings exceed 80% of their Section 82 limits.</div>';
        return;
    }

    container.innerHTML = filtered.slice(0, 50).map(e => {
        const ts  = new Date(e.timestamp).toLocaleString();
        const bar = Math.min(e.pct, 100);
        const col = e.pct >= 95 ? 'var(--status-critical)' : 'var(--status-warning)';
        return `
        <div class="alert-item warning" style="flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);">
                    <span style="color:${e.color};">${e.label}</span>
                    — <span style="font-family:monospace;font-size:12px;color:var(--accent-blue);">${e.region}</span>
                </span>
                <span style="font-size:11px;color:var(--text-secondary);">${ts}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">
                Reading <strong style="color:var(--text-primary);">${e.value}</strong> / limit <strong>${e.limit}</strong>
                &nbsp;·&nbsp; <span style="color:${col};font-weight:700;">${e.pct}% of threshold</span>
            </div>
            <div style="height:5px;border-radius:3px;background:rgba(255,255,255,0.07);overflow:hidden;">
                <div style="height:100%;width:${bar}%;background:${col};border-radius:3px;transition:width 0.5s;"></div>
            </div>
        </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
};

// Initialize
initCharts();
updateDashboard();

// Export Report from Analytics Page
const btnExportReport = document.getElementById('btn-export-report');
if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
        const id = 'REP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const timestamp = new Date().toISOString();

        let avgs = {};
        let risks = [];
        Object.keys(CONFIG).forEach(k => {
            const valEl = document.getElementById(`val-avg-${k}`);
            const avg = valEl ? parseFloat(valEl.innerText) : CONFIG[k].base;
            avgs[k] = avg.toFixed(1);
            
            let limit = CONFIG[k].max;
            if (k === 'ph') limit = 9.0;
            let pct = (avg / limit) * 100;
            if (pct > 80 && pct <= 100) {
                risks.push(`${CONFIG[k].label} is at ${pct.toFixed(0)}% of critical limit.`);
            }
        });

        const report = {
            id,
            type: 'General',
            timestamp,
            avgs,
            risks,
            breachDetails: null,
            imageStr: null
        };

        let reports = JSON.parse(localStorage.getItem('aquaReports') || '[]');
        reports.unshift(report);
        if (reports.length > 100) reports.pop();
        localStorage.setItem('aquaReports', JSON.stringify(reports));

        // Premium visual feedback on the button
        const originalText = btnExportReport.innerHTML;
        btnExportReport.innerHTML = '<i data-lucide="check"></i> Saved to Reports Page';
        btnExportReport.style.background = '#10b981';
        btnExportReport.style.borderColor = '#10b981';
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            btnExportReport.innerHTML = originalText;
            btnExportReport.style.background = '';
            btnExportReport.style.borderColor = '';
            if (window.lucide) window.lucide.createIcons();
        }, 2500);
    });
}
