// Configuration & Thresholds (Section 82 Limits)
const CONFIG = {
    ph: { min: 6.0, max: 9.0, noise: 0.1, label: 'pH', color: '#00d2ff' },
    cod: { max: 150, noise: 5, label: 'COD', color: '#10b981' },
    bod: { max: 50, noise: 2, label: 'BOD', color: '#f97316' },
    tss: { max: 30, noise: 1, label: 'TSS', color: '#8b5cf6' },
    temp: { max: 30, noise: 0.5, label: 'Temp', color: '#f43f5e' },
    toxic: { max: 5, noise: 0.2, label: 'Toxic', color: '#eab308' }
};

// Regions setup
const createHistory = () => ({ labels: [], ph: [], cod: [], bod: [], tss: [], temp: [], toxic: [] });

const REGIONS = [
    { id: 'eu',  name: 'EURO-MAIN',   shortName: 'EUR-1',  lat: 50.0,  lng: 10.0,   ph: 7.3, cod: 120, bod: 28, tss: 18, temp: 14, tempBase: 14, toxic: 1.5, breaches: 0, history: createHistory() },
    { id: 'na',  name: 'AMRN-MAIN',   shortName: 'AMN-1',  lat: 45.0,  lng: -100.0, ph: 7.2, cod: 110, bod: 25, tss: 15, temp: 18, tempBase: 18, toxic: 1.0, breaches: 0, history: createHistory() },
    { id: 'as',  name: 'APAC-MAIN',   shortName: 'APC-1',  lat: 35.0,  lng: 100.0,  ph: 7.4, cod: 130, bod: 30, tss: 20, temp: 26, tempBase: 26, toxic: 2.0, breaches: 0, history: createHistory() },
    { id: 'af',  name: 'AFRC-MAIN',   shortName: 'AFR-1',  lat: 0.0,   lng: 20.0,   ph: 7.0, cod: 90,  bod: 20, tss: 10, temp: 29, tempBase: 29, toxic: 0.5, breaches: 0, history: createHistory() },
    { id: 'sa',  name: 'AMRS-MAIN',   shortName: 'AMS-1',  lat: -15.0, lng: -60.0,  ph: 7.1, cod: 100, bod: 22, tss: 12, temp: 25, tempBase: 25, toxic: 0.8, breaches: 0, history: createHistory() },
    { id: 'oc',  name: 'PCFC-MAIN',   shortName: 'PCF-1',  lat: -25.0, lng: 135.0,  ph: 7.2, cod: 105, bod: 24, tss: 14, temp: 23, tempBase: 23, toxic: 0.9, breaches: 0, history: createHistory() }
];

let globalHistory = createHistory();
let breachCountTotal = 0;
let mapMarkers = {};
let map;

// Near-breach warning throttle — key: 'regionId-param', value: timestamp last warned
const nearBreachLastWarned = {};
const NEAR_BREACH_COOLDOWN_MS = 30000; // only warn once every 30s per param per region
const NEAR_BREACH_PCT = 0.80; // 80% of limit triggers near-breach warning

// State Variables
let currentView = 'global'; 
let summaryTick = 0;
let unreadNotificationsCount = 0;

// Notification System
const pushNotification = (title, message, isCritical = false) => {
    unreadNotificationsCount++;
    const badge = document.getElementById('notification-badge');
    badge.innerText = unreadNotificationsCount;
    badge.style.display = 'flex';

    const list = document.getElementById('notification-list');
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const notifHtml = `
        <div class="notification-item ${isCritical ? 'critical' : ''}">
            <div class="notif-title">${title}</div>
            <div class="notif-desc">${message}</div>
            <div class="notif-footer">
                <span class="notif-time">${time}</span>
                <a href="#" class="alert-link">View Details</a>
            </div>
        </div>
    `;
    list.insertAdjacentHTML('afterbegin', notifHtml);
};

// Utility Functions
const addNormalAlert = (message, type = 'info') => {
    const feed = document.getElementById('normal-feed');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let iconName = type === 'warning' ? 'alert-triangle' : 'info';

    const alertHtml = `
        <div class="alert-item ${type}">
            <div class="alert-icon"><i data-lucide="${iconName}"></i></div>
            <div class="alert-content">
                <p>${message}</p>
                <span class="alert-time">${time}</span>
            </div>
        </div>
    `;
    feed.insertAdjacentHTML('afterbegin', alertHtml);
    lucide.createIcons();
};

// Near-breach warning: fires when a parameter exceeds NEAR_BREACH_PCT of its limit
// Logs to Summary Logs and also persists a record into analytics localStorage history
const addNearBreachWarning = (regionId, param, value, pct) => {
    const key = `${regionId}-${param}`;
    const now = Date.now();
    if (nearBreachLastWarned[key] && now - nearBreachLastWarned[key] < NEAR_BREACH_COOLDOWN_MS) return;
    nearBreachLastWarned[key] = now;

    const region = REGIONS.find(r => r.id === regionId);
    const regionLabel = region ? `[${region.shortName} · ${region.name}]` : '[GLOBAL]';
    const limitVal = param === 'ph' ? CONFIG.ph.max : CONFIG[param].max;
    const pctStr = pct.toFixed(0);

    // 1. Log to Summary Logs panel
    addNormalAlert(
        `<strong>⚠ Near-Breach Warning</strong> ${regionLabel} — <span style="color:${CONFIG[param].color};font-weight:600;">${CONFIG[param].label}</span> ` +
        `is at <strong>${value.toFixed(2)}</strong> (${pctStr}% of ${limitVal} limit). ` +
        `Approaching Section 82 threshold. Immediate review recommended.`,
        'warning'
    );

    // 2. Push notification
    pushNotification(
        `⚠ Near-Breach: ${CONFIG[param].label}`,
        `${regionLabel} ${CONFIG[param].label} is at ${pctStr}% of its Section 82 limit (${value.toFixed(2)} / ${limitVal}).`,
        false
    );

    // 3. Persist to Analytics History localStorage so analytics.html can display it
    const analyticsLog = JSON.parse(localStorage.getItem('aquaNearBreachLog') || '[]');
    analyticsLog.unshift({
        timestamp: new Date().toISOString(),
        region: region ? region.shortName : 'GLOBAL',
        regionName: region ? region.name : 'Global',
        param,
        label: CONFIG[param].label,
        value: parseFloat(value.toFixed(2)),
        limit: limitVal,
        pct: parseFloat(pctStr),
        color: CONFIG[param].color
    });
    // Keep last 200 entries
    if (analyticsLog.length > 200) analyticsLog.pop();
    localStorage.setItem('aquaNearBreachLog', JSON.stringify(analyticsLog));
};

const addBreachAlert = (message, regionId) => {
    breachCountTotal++;
    const bc = document.getElementById('breach-count');
    if (bc) bc.innerText = `${breachCountTotal} Critical`;
    // Update KPI bar
    const kpiBr = document.getElementById('kpi-breaches');
    if (kpiBr) kpiBr.innerText = breachCountTotal;
    const kpiComp = document.getElementById('kpi-compliance');
    if (kpiComp) { const pct = Math.max(0, 100 - breachCountTotal * 2); kpiComp.innerText = pct.toFixed(1) + '%'; }
    const feed = document.getElementById('breach-feed');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const region = REGIONS.find(r => r.id === regionId);
    const regionLabel = region ? `[${region.name} · ${region.shortName || region.id.toUpperCase()}]` : '[UNKNOWN]';
    const alertHtml = `
        <div class="alert-item critical">
            <div class="alert-icon"><i data-lucide="alert-octagon"></i></div>
            <div class="alert-content">
                <p><strong>${regionLabel}</strong> ${message}</p>
                <span class="alert-time">${time} - STATUS: CRITICAL SEVERITY</span>
            </div>
        </div>
    `;
    feed.insertAdjacentHTML('afterbegin', alertHtml);
    lucide.createIcons();
    pushNotification('Section 82 Breach', `[${regionName}] ${message}`, true);
};

const updateMetricCard = (id, value, status, trendDir) => {
    document.getElementById(`val-${id}`).innerText = value.toFixed(1);
    const card = document.getElementById(`card-${id}`);
    const trend = document.getElementById(`trend-${id}`);
    
    card.className = `metric-card glass-panel ${status !== 'normal' ? status : ''}`;
    let icon = trendDir > 0 ? 'trending-up' : 'trending-down';
    let text = status.charAt(0).toUpperCase() + status.slice(1);
    
    trend.innerHTML = `<i data-lucide="${icon}"></i> <span>${text}</span>`;
    lucide.createIcons();
};

// Map Initialization
const initMap = () => {
    map = L.map('global-map', { center: [20, 0], zoom: 1, zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);

    REGIONS.forEach(region => {
        const marker = L.marker([region.lat, region.lng], {
            icon: L.divIcon({ className: 'pulse-marker grey', html: '0', iconSize: [24, 24] })
        }).addTo(map);
        
        marker.bindTooltip(`Click to view ${region.name} dashboard`, { direction: 'top' });
        marker.on('click', () => {
            currentView = region.id;
            summaryTick = 0; // Reset summary timer
            document.getElementById('dashboard-title').innerText = `${region.name} Live Monitoring`;
            document.getElementById('btn-global-view').style.display = 'flex';
            
            // Update UI titles for the region
            document.querySelectorAll('.station-tag').forEach(tag => tag.innerText = region.shortName);
            document.getElementById('chart-station-label').innerText = `${region.shortName} · ${region.name.toUpperCase()}`;
            
            const metricsList = [
                {id: 'ph', label: 'pH'}, {id: 'cod', label: 'COD'}, {id: 'bod', label: 'BOD'}, 
                {id: 'tss', label: 'TSS'}, {id: 'temp', label: 'Temperature'}, {id: 'toxic', label: 'Toxic Contam.'}
            ];
            metricsList.forEach(m => {
                const headerSpan = document.querySelector(`#box-chart-${m.id} .mini-header span`);
                if (headerSpan) headerSpan.innerText = `${m.label} — ${region.shortName}`;
            });

            addNormalAlert(`Dashboard context switched to ${region.name}. Logs & Charts will now filter strictly to this region.`, 'info');
            updateChartData();
        });
        mapMarkers[region.id] = marker;
    });
};

const updateMapMarker = (regionId) => {
    const region = REGIONS.find(r => r.id === regionId);
    const marker = mapMarkers[regionId];
    const size = Math.min(24 + (region.breaches * 4), 60); 
    
    let colorClass = 'grey';
    let pulseClass = '';
    
    if (region.breaches > 0 && region.breaches < 3) {
        colorClass = 'yellow'; pulseClass = 'has-breaches';
    } else if (region.breaches >= 3) {
        colorClass = 'red'; pulseClass = 'has-breaches';
    }
    
    marker.setIcon(L.divIcon({
        className: `pulse-marker ${colorClass} ${pulseClass}`,
        html: region.breaches,
        iconSize: [size, size]
    }));
};

// Chart Initialization
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

// Helpers for Chart options
const commonGrid = { color: 'rgba(255, 255, 255, 0.05)' };
const createAnnotation = (yScaleID, value, color) => ({
    type: 'line',
    yScaleID,
    yMin: value,
    yMax: value,
    borderColor: color + '40', // 25% opacity
    borderWidth: 1,
    borderDash: [5, 5],
    display: true,
    label: {
        display: false
    }
});

let mainChart;
let miniCharts = {};

const initCharts = () => {
    // MAIN CHART
    const ctxMain = document.getElementById('mainChart').getContext('2d');
    mainChart = new Chart(ctxMain, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { id: 'ph', label: 'pH', data: [], borderColor: CONFIG.ph.color, yAxisID: 'y_ph', tension: 0.4 },
                { id: 'cod', label: 'COD (mg/L)', data: [], borderColor: CONFIG.cod.color, yAxisID: 'y_cod', tension: 0.4 },
                { id: 'bod', label: 'BOD (mg/L)', data: [], borderColor: CONFIG.bod.color, yAxisID: 'y_bod', tension: 0.4 },
                { id: 'tss', label: 'TSS (mg/L)', data: [], borderColor: CONFIG.tss.color, yAxisID: 'y_tss', tension: 0.4 },
                { id: 'temp', label: 'Temp (°C)', data: [], borderColor: CONFIG.temp.color, yAxisID: 'y_temp', tension: 0.4 },
                { id: 'toxic', label: 'Toxic (mg/L)', data: [], borderColor: CONFIG.toxic.color, yAxisID: 'y_toxic', tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                annotation: {
                    annotations: {
                        limit_ph: createAnnotation('y_ph', CONFIG.ph.max, CONFIG.ph.color),
                        limit_cod: createAnnotation('y_cod', CONFIG.cod.max, CONFIG.cod.color),
                        limit_bod: createAnnotation('y_bod', CONFIG.bod.max, CONFIG.bod.color),
                        limit_tss: createAnnotation('y_tss', CONFIG.tss.max, CONFIG.tss.color),
                        limit_temp: createAnnotation('y_temp', CONFIG.temp.max, CONFIG.temp.color),
                        limit_toxic: createAnnotation('y_toxic', CONFIG.toxic.max, CONFIG.toxic.color)
                    }
                }
            },
            scales: {
                x: { grid: commonGrid, display: false }, // Hide x axis grid for clean look
                y_ph: { type: 'linear', position: 'left', min: 4, max: 10, display: false },
                y_cod: { type: 'linear', position: 'left', min: 0, max: 200, display: false },
                y_bod: { type: 'linear', position: 'left', min: 0, max: 100, display: false },
                y_tss: { type: 'linear', position: 'left', min: 0, max: 60, display: false },
                y_temp: { type: 'linear', position: 'left', min: 10, max: 40, display: false },
                y_toxic: { type: 'linear', position: 'left', min: 0, max: 10, display: false }
            }
        }
    });

    // MINI CHARTS
    const metrics = ['ph', 'cod', 'bod', 'tss', 'temp', 'toxic'];
    metrics.forEach(m => {
        const ctx = document.getElementById(`chart-${m}`).getContext('2d');
        let minMax = {};
        if (m==='ph') minMax = {min: 4, max: 10};
        else if (m==='cod') minMax = {min: 0, max: 200};
        else if (m==='bod') minMax = {min: 0, max: 100};
        else if (m==='tss') minMax = {min: 0, max: 60};
        else if (m==='temp') minMax = {min: 10, max: 40};
        else if (m==='toxic') minMax = {min: 0, max: 10};

        miniCharts[m] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{ 
                    label: CONFIG[m].label, 
                    data: [], 
                    borderColor: CONFIG[m].color, 
                    backgroundColor: CONFIG[m].color + '22',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    annotation: {
                        annotations: {
                            limit: {
                                type: 'line', yMin: CONFIG[m].max, yMax: CONFIG[m].max,
                                borderColor: 'rgba(239, 68, 68, 0.5)', borderDash: [5, 5]
                            }
                        }
                    }
                },
                scales: {
                    x: { display: false },
                    y: { type: 'linear', display: true, min: minMax.min, max: minMax.max, grid: commonGrid, ticks: {font: {size: 10}} }
                }
            }
        });
    });
};

// ── Predictive Projection Engine ──────────────────────────────────────────────
// Uses simple linear regression over the last N observed points to project
// the next PROJ_STEPS data points forward.
const PROJ_STEPS  = 8;   // how many future ticks to forecast
const PROJ_WINDOW = 10;  // how many recent points to use for trend calc

function linearRegression(points) {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: points[0] || 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX  += i;
        sumY  += points[i];
        sumXY += i * points[i];
        sumXX += i * i;
    }
    const slope     = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

function buildProjection(historicData, metricKey) {
    const window = historicData.slice(-PROJ_WINDOW);
    const { slope, intercept } = linearRegression(window);
    const base = window.length;
    const proj = [];
    for (let i = 1; i <= PROJ_STEPS; i++) {
        let val = intercept + slope * (base - 1 + i);
        // Clamp to sane physical bounds
        if (metricKey !== 'ph') val = Math.max(0, val);
        else val = Math.max(0, Math.min(14, val));
        proj.push(parseFloat(val.toFixed(2)));
    }
    return proj;
}

function buildProjectionLabels(existingLabels) {
    const projLabels = [];
    const now = new Date();
    for (let i = 1; i <= PROJ_STEPS; i++) {
        const t = new Date(now.getTime() + i * 2000); // 2s per tick
        projLabels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    return projLabels;
}

// Projection dataset config — null-padded historical + dashed forecast
function buildProjDataset(historicData, projData, color) {
    // Pad historical with nulls where projection goes, then append projection
    const hist = historicData.map(v => v); // existing points
    const nullPad = hist.map(() => null);  // same length as hist but null (for projection series)
    return {
        historical: hist,
        projection: [...nullPad, ...projData],
        projLabels:  projData
    };
}

const updateChartData = () => {
    let sourceData = currentView === 'global' ? globalHistory : REGIONS.find(r => r.id === currentView).history;
    const metrics  = ['ph','cod','bod','tss','temp','toxic'];

    // Build combined labels: existing + future projection ticks
    const projLabels = buildProjectionLabels(sourceData.labels);
    const allLabels  = [...sourceData.labels, ...projLabels];

    // ── Main chart ────────────────────────────────────────────────────────────
    mainChart.data.labels = allLabels;
    mainChart.data.datasets.forEach(ds => {
        if (ds._isProjection) return; // handled below
        const hist = sourceData[ds.id] || [];
        const proj = buildProjection(hist, ds.id);
        // Observed data padded with nulls for projection slots
        ds.data = [...hist, ...proj.map(() => null)];
    });

    // Ensure projection datasets exist on main chart (one per metric)
    metrics.forEach(m => {
        const projId = `proj_${m}`;
        let projDs = mainChart.data.datasets.find(d => d._projId === projId);
        const hist  = sourceData[m] || [];
        const proj  = buildProjection(hist, m);
        const paddedHistNull = hist.map(() => null);
        const projData = [...paddedHistNull, ...proj];

        if (!projDs) {
            projDs = {
                _isProjection: true,
                _projId: projId,
                id: m,         // needed for yAxisID lookup
                label: `${CONFIG[m].label} Forecast`,
                data: projData,
                borderColor: CONFIG[m].color + 'aa',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                tension: 0.3,
                yAxisID: `y_${m}`
            };
            mainChart.data.datasets.push(projDs);
        } else {
            projDs.data = projData;
        }
    });
    mainChart.update('none');

    // ── Mini charts ───────────────────────────────────────────────────────────
    Object.keys(miniCharts).forEach(m => {
        const hist = sourceData[m] || [];
        const proj = buildProjection(hist, m);
        const paddedHistNull = hist.map(() => null);

        miniCharts[m].data.labels = allLabels;
        // Dataset 0 = observed
        miniCharts[m].data.datasets[0].data = [...hist, ...proj.map(() => null)];

        // Dataset 1 = projection (create if missing)
        if (!miniCharts[m].data.datasets[1]) {
            miniCharts[m].data.datasets.push({
                _isProjection: true,
                label: `${CONFIG[m].label} Forecast`,
                data: [...paddedHistNull, ...proj],
                borderColor: CONFIG[m].color + 'aa',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                tension: 0.3,
                backgroundColor: 'transparent'
            });
        } else {
            miniCharts[m].data.datasets[1].data = [...paddedHistNull, ...proj];
        }
        miniCharts[m].update('none');
    });

    // ── Modal chart (silent pass-through) ─────────────────────────────────────
    if (typeof modalChartInstance !== 'undefined' && modalChartInstance && activeModalSource) {
        modalChartInstance.data.labels = allLabels;
        if (activeModalSource === 'main') {
            modalChartInstance.data.datasets.forEach(ds => {
                if (!ds._isProjection) ds.data = [...(sourceData[ds.id] || []), ...Array(PROJ_STEPS).fill(null)];
            });
        } else {
            const hist = sourceData[activeModalSource] || [];
            modalChartInstance.data.datasets[0].data = [...hist, ...Array(PROJ_STEPS).fill(null)];
        }
        modalChartInstance.update('none');
    }
};

// Simulation Engine
const generateData = () => {
    let gSums = { ph: 0, cod: 0, bod: 0, tss: 0, temp: 0, toxic: 0 };
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    REGIONS.forEach(region => {
        // Random walk & mean reversion — temp uses per-region baseline
        region.ph    += (Math.random() - 0.5) * CONFIG.ph.noise    + (7.2              - region.ph)    * 0.05;
        region.cod   += (Math.random() - 0.5) * CONFIG.cod.noise   + (110              - region.cod)   * 0.05;
        region.bod   += (Math.random() - 0.5) * CONFIG.bod.noise   + (25               - region.bod)   * 0.05;
        region.tss   += (Math.random() - 0.5) * CONFIG.tss.noise   + (15               - region.tss)   * 0.05;
        region.temp  += (Math.random() - 0.5) * CONFIG.temp.noise  + (region.tempBase  - region.temp)  * 0.05;
        region.toxic += (Math.random() - 0.5) * CONFIG.toxic.noise + (1.0              - region.toxic) * 0.05;

        // Ensure non-negative except temp
        ['cod','bod','tss','toxic'].forEach(k => { if(region[k] < 0) region[k] = 0; });

        // Evaluate breaches
        let breachMessages = [];
        let didBreach = false;

        ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
            let isBreached = false;
            if (k === 'ph') {
                if (region.ph <= CONFIG.ph.min || region.ph >= CONFIG.ph.max) isBreached = true;
            } else {
                if (region[k] >= CONFIG[k].max) isBreached = true;
            }

            if (isBreached && Math.random() > 0.8) {
                breachMessages.push(`${CONFIG[k].label} (${region[k].toFixed(1)})`);
                didBreach = true;
            }
        });

        if (didBreach) {
            region.breaches++; 
            updateMapMarker(region.id);
            let combinedMsg = breachMessages.join(' & ') + ' violated limits.';
            addBreachAlert(combinedMsg, region.id);
            
            const pipes = ['Main Effluent Discharge Pipe 4B', 'Secondary Treatment Valve A', 'Stormwater Overflow Drain 2', 'Primary Clarifier Outlet Pipe', 'Bioreactor Feed Line C'];
            const randomPipe = pipes[Math.floor(Math.random() * pipes.length)];
            
            // Generate automated breach report
            generateReport('Breach', { region: region.name, message: combinedMsg, pipeline: randomPipe });
        }

        // Update region history
        region.history.labels.push(timeStr);
        ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
            region.history[k].push(region[k]);
            if (region.history[k].length > 30) region.history[k].shift();
            gSums[k] += region[k];
        });
        if (region.history.labels.length > 30) region.history.labels.shift();
    });

    // Global Stats Update
    globalHistory.labels.push(timeStr);
    if (globalHistory.labels.length > 30) globalHistory.labels.shift();
    
    ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
        let avg = gSums[k] / REGIONS.length;
        globalHistory[k].push(avg);
        if (globalHistory[k].length > 30) globalHistory[k].shift();
    });

    // UI Updates based on context
    let activeData = {};
    let activeHistory = {};
    if (currentView === 'global') {
        ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
            activeData[k] = gSums[k] / REGIONS.length;
            activeHistory[k] = globalHistory[k];
        });
    } else {
        const r = REGIONS.find(r => r.id === currentView);
        ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
            activeData[k] = r[k];
            activeHistory[k] = r.history[k];
        });
    }

    // Update Metric Cards + fire near-breach warnings
    let riskyCount = 0;
    ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
        let status = 'normal';
        let pct = (activeData[k] / CONFIG[k].max) * 100;
        if (k === 'ph') pct = (activeData[k] / 9.0) * 100;

        if (k === 'ph' && (activeData[k] <= CONFIG.ph.min || activeData[k] >= CONFIG.ph.max)) status = 'critical';
        else if (k !== 'ph' && activeData[k] >= CONFIG[k].max) status = 'critical';
        else if (pct > 80) {
            status = 'warning';
            riskyCount++;
            // Fire near-breach warning log (throttled per param per region)
            const regionId = currentView === 'global' ? 'global' : currentView;
            addNearBreachWarning(regionId, k, activeData[k], pct);
        }

        let trendDir = activeHistory[k].length > 1 ? activeData[k] - activeHistory[k][activeHistory[k].length - 2] : 0;
        updateMetricCard(k, activeData[k], status, trendDir);
    });

    const riskBadge = document.getElementById('risk-badge');
    if (riskBadge) {
        riskBadge.innerText = `Risky Parameters: ${riskyCount}`;
        if (riskyCount > 0) {
            riskBadge.style.background = 'rgba(239, 160, 68, 0.2)';
            riskBadge.style.color = '#efa044';
        } else {
            riskBadge.style.background = 'rgba(0, 210, 255, 0.1)';
            riskBadge.style.color = 'var(--accent-blue)';
        }
    }

    updateChartData();

    // Summary Timer Logic
    summaryTick += 2; // runs every 2s
    
    const formatAIResponse = (text) => {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        Object.keys(CONFIG).forEach(key => {
            const regex = new RegExp(`\\b${CONFIG[key].label}\\b`, 'gi');
            formatted = formatted.replace(regex, `<span style="color:${CONFIG[key].color}; font-weight:600;">$&</span>`);
        });
        return formatted;
    };
    
    const generateLogSummary = (regionName, averages, riskyCount) => {
        let riskMsg = riskyCount > 0 ? `<br><br><span style="color:#efa044;">⚠️ At Risk (>80% Limit): ${riskyCount} Parameter(s) detected.</span>` : '<br><br>All systems operational.';
        const tempMsgId = 'log-' + Math.random().toString(36).substr(2, 9);
        addNormalAlert(`<div id="${tempMsgId}"><strong>Summary:</strong> ${regionName} monitoring active.<br><br>Averages - ${averages}.${riskMsg}<br><br><span style="color:var(--accent-blue);">⏳ AI predicting potential breaches...</span></div>`, 'info');

        const prompt = `You are a wastewater AI monitor. Current region: ${regionName}. Recent averages: ${averages}. Risky parameters: ${riskyCount}. Write a concise 1-sentence prediction about potential breaches that could occur due to these ongoing factors. Use HTML <strong> tags to highlight critical variables or risks. Do not use asterisks.`;
        
        const ollamaBase = (localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434').replace(/\/+$/, '');
        const ollamaModel = localStorage.getItem('aquaOllamaModel') || 'llama3';
        
        fetch(`${ollamaBase}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ollamaModel, prompt: prompt, stream: false })
        })
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById(tempMsgId);
            if (el) el.innerHTML = `<strong>Summary:</strong> ${regionName} monitoring active.<br><br>Averages - ${averages}.${riskMsg}<br><br><span style="color:var(--text-primary);"><strong>AI Prediction:</strong></span> ${formatAIResponse(data.response)}`;
        })
        .catch(err => {
            const el = document.getElementById(tempMsgId);
            if (el) el.innerHTML = `<strong>Summary:</strong> ${regionName} monitoring active.<br><br>Averages - ${averages}.${riskMsg}<br><br><span style="color:var(--status-critical);">⚠ AI Prediction unavailable.</span>`;
        });
    };

    if (currentView === 'global' && summaryTick >= 30) {
        summaryTick = 0;
        const sums = `pH: ${activeData.ph.toFixed(1)}, COD: ${activeData.cod.toFixed(1)}, BOD: ${activeData.bod.toFixed(1)}, TSS: ${activeData.tss.toFixed(1)}, Temp: ${activeData.temp.toFixed(1)}, Toxic: ${activeData.toxic.toFixed(1)}`;
        generateLogSummary('Global', sums, riskyCount);
    } else if (currentView !== 'global' && summaryTick >= 30) {
        summaryTick = 0;
        const r = REGIONS.find(r => r.id === currentView);
        let sumsArr = [];
        ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
            const last5 = r.history[k].slice(-5);
            const avg = (last5.reduce((a,b)=>a+b,0) / Math.max(last5.length, 1)).toFixed(1);
            sumsArr.push(`${CONFIG[k].label}: ${avg}`);
        });
        generateLogSummary(r.name, sumsArr.join(', '), riskyCount);
    }
};

// ── Breach Report Enrichment Helpers ─────────────────────────────────────────
const FAKE_CONTACTS = [
    { name: 'Dr. Sarah Whitmore',  role: 'Regional Plant Manager',  phone: '+44 7700 900421', email: 's.whitmore@aquasense-ops.net',   org: 'AquaSense Operations UK' },
    { name: 'James R. Callahan',   role: 'Senior Compliance Officer',phone: '+1 312 555 0182',  email: 'j.callahan@aquasense-na.com',    org: 'AquaSense North America' },
    { name: 'Dr. Mei-Lin Zhao',    role: 'APAC Facility Director',   phone: '+86 21 6000 4821', email: 'ml.zhao@aquasense-apac.cn',      org: 'AquaSense Asia Pacific' },
    { name: 'Emmanuel Osei',       role: 'Africa Ops Lead',          phone: '+27 11 900 3847',  email: 'e.osei@aquasense-africa.co.za',  org: 'AquaSense Africa Division' },
    { name: 'Camila Torres',       role: 'South America Plant Chief', phone: '+55 11 3500 9921', email: 'c.torres@aquasense-latam.com.br',org: 'AquaSense LatAm Operations' },
    { name: 'Liam Nguyen',         role: 'Pacific Operations Manager',phone: '+61 2 9000 4432',  email: 'l.nguyen@aquasense-pacific.au', org: 'AquaSense Pacific Ltd.' },
];

const REGION_GEO = {
    eu: { city: 'Frankfurt, Germany',     grid: 'UTM 32U MH 4823 9102', nearest: 'Rhine Effluent Channel 7B',   emergencyLine: '+49 800 600 3210' },
    na: { city: 'Chicago, IL, USA',       grid: 'UTM 16T EL 4481 3294', nearest: 'Chicago Southside Drain 3A', emergencyLine: '+1 800 555 3900' },
    as: { city: 'Shanghai, China',        grid: 'UTM 51R QH 2910 0847', nearest: 'Yangtze Tributary Pipe 12',  emergencyLine: '+86 400 120 3912' },
    af: { city: 'Nairobi, Kenya',         grid: 'UTM 37M BE 0012 2934', nearest: 'Nairobi River Outlet 4',     emergencyLine: '+254 800 720 199' },
    sa: { city: 'São Paulo, Brazil',      grid: 'UTM 23K GP 3849 7212', nearest: 'Tietê Basin Discharge 8C',   emergencyLine: '+55 0800 723 4001' },
    oc: { city: 'Perth, Australia',       grid: 'UTM 50H MF 9012 4831', nearest: 'Swan River Effluent Line 2', emergencyLine: '+61 1800 200 911' },
};

// Build a minimal inline SVG map showing a pulsing breach marker at an approximate coord
function buildGeoMapSVG(region) {
    const geo = REGION_GEO[region.id] || REGION_GEO['eu'];
    // Normalise lat/lng to a 400x240 SVG viewport
    const svgX = Math.round(((region.lng + 180) / 360) * 400);
    const svgY = Math.round(((90 - region.lat)  / 180) * 240);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" style="background:#1e293b;border-radius:8px;border:1px solid #334155;">
  <!-- Grid lines -->
  <line x1="0" y1="80"  x2="400" y2="80"  stroke="#334155" stroke-width="0.5"/>
  <line x1="0" y1="160" x2="400" y2="160" stroke="#334155" stroke-width="0.5"/>
  <line x1="133" y1="0" x2="133" y2="240" stroke="#334155" stroke-width="0.5"/>
  <line x1="267" y1="0" x2="267" y2="240" stroke="#334155" stroke-width="0.5"/>
  <!-- Equator -->
  <line x1="0" y1="120" x2="400" y2="120" stroke="#0ea5e9" stroke-width="0.8" stroke-dasharray="4,4"/>
  <!-- Breach pulse rings -->
  <circle cx="${svgX}" cy="${svgY}" r="28" fill="none" stroke="#ef4444" stroke-width="1" opacity="0.3"/>
  <circle cx="${svgX}" cy="${svgY}" r="18" fill="none" stroke="#ef4444" stroke-width="1.5" opacity="0.5"/>
  <circle cx="${svgX}" cy="${svgY}" r="8"  fill="#ef444466" stroke="#ef4444" stroke-width="2"/>
  <circle cx="${svgX}" cy="${svgY}" r="3"  fill="#ef4444"/>
  <!-- Cross-hair -->
  <line x1="${svgX - 14}" y1="${svgY}" x2="${svgX + 14}" y2="${svgY}" stroke="#ef4444" stroke-width="1"/>
  <line x1="${svgX}" y1="${svgY - 14}" x2="${svgX}" y2="${svgY + 14}" stroke="#ef4444" stroke-width="1"/>
  <!-- Label -->
  <rect x="${Math.min(svgX + 14, 310)}" y="${Math.max(svgY - 26, 4)}" width="86" height="22" rx="4" fill="#ef4444" opacity="0.9"/>
  <text x="${Math.min(svgX + 18, 314)}" y="${Math.max(svgY - 10, 20)}" font-size="10" fill="white" font-family="Arial">⚠ BREACH SITE</text>
  <!-- Title -->
  <text x="6" y="16" font-size="10" fill="#94a3b8" font-family="Arial">${region.shortName} · ${geo.city}</text>
  <text x="6" y="30" font-size="9"  fill="#64748b" font-family="Arial">Grid: ${geo.grid}</text>
  <!-- North indicator -->
  <text x="380" y="18" font-size="11" fill="#00d2ff" font-family="Arial" font-weight="bold">N↑</text>
  <!-- Scale bar -->
  <line x1="10" y1="228" x2="60" y2="228" stroke="#64748b" stroke-width="1"/>
  <text x="12" y="238" font-size="8" fill="#64748b" font-family="Arial">~250 km</text>
</svg>`;
}

function svgToDataUri(svg) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// ── Reporting Engine ──────────────────────────────────────────────────────────
// Reports are saved to localStorage only. Downloads happen from the Reports page.
const downloadDocFile = (report) => {
    const isBreach = report.type === 'Breach';
    const ts       = new Date(report.timestamp).toLocaleString();

    let html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>AquaSense ${report.type} Report ${report.id}</title>
<style>
  body        { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 40px; }
  h1          { color: #0d8abc; font-size: 20pt; border-bottom: 2px solid #0d8abc; padding-bottom: 6px; }
  h2          { color: #1e293b; font-size: 14pt; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3          { color: #334155; font-size: 12pt; margin-top: 18px; }
  .critical   { color: #ef4444; font-weight: bold; }
  .warning    { color: #f59e0b; font-weight: bold; }
  .label      { color: #64748b; font-size: 10pt; }
  table       { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th          { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 10pt; }
  td          { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 10pt; }
  .banner     { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; }
  .info-box   { background: #f0f9ff; border-left: 4px solid #0d8abc; padding: 12px 16px; margin: 16px 0; }
  .footer     { font-size: 9pt; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .geo-img    { max-width: 400px; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; margin: 10px 0; }
</style>
</head>
<body>

<h1>AquaSense AI &mdash; ${report.type} Report</h1>
<p class="label">Report ID: <strong>${report.id}</strong> &nbsp;|&nbsp; Generated: <strong>${ts}</strong> &nbsp;|&nbsp; System: AquaSense AI v2.0 Predictive Engine</p>
<p class="label">Classification: <strong>${isBreach ? (report.incidentClass || 'CLASS-C BIOLOGICAL') : 'ROUTINE COMPLIANCE'}</strong></p>
<hr>
`;

    if (isBreach && report.breachDetails) {
        const bd = report.breachDetails;
        const c  = report.contact  || {};
        const g  = report.geo      || {};

        html += `
<div class="banner">
  <h2 class="critical">&#9888; CRITICAL SECTION 82 BREACH DETECTED</h2>
  <p><strong>Incident Region:</strong> ${bd.region}</p>
  <p><strong>Affected Infrastructure:</strong> ${bd.pipeline || 'Unknown Pipeline'}</p>
  <p><strong>Contaminants Involved:</strong> ${bd.message}</p>
  <p><strong>Nearest Waterway / Drain:</strong> ${g.nearest || 'N/A'}</p>
  <p><strong>Emergency Response Line:</strong> ${g.emergencyLine || 'N/A'}</p>
</div>

<h2>Incident Classification &amp; Location</h2>
<table>
  <tr><th>Field</th><th>Details</th></tr>
  <tr><td>Incident Class</td><td class="critical">${report.incidentClass || 'CLASS-C BIOLOGICAL'}</td></tr>
  <tr><td>Site City / Region</td><td>${g.city || bd.region}</td></tr>
  <tr><td>Grid Reference</td><td>${g.grid || 'N/A'}</td></tr>
  <tr><td>Nearest Infrastructure</td><td>${g.nearest || bd.pipeline || 'Unknown'}</td></tr>
  <tr><td>Emergency Hotline</td><td>${g.emergencyLine || 'N/A'}</td></tr>
  <tr><td>Incident Timestamp</td><td>${ts}</td></tr>
  <tr><td>Regulatory Reference</td><td>Environment Act 2021 &mdash; Section 82 (Illegal Discharge)</td></tr>
</table>

<h2>Geo-Incident Map</h2>
<p class="label">Approximate breach location based on real-time telemetry triangulation:</p>
${report.geomapDataUri ? `<img class="geo-img" src="${report.geomapDataUri}" alt="Geo-Incident Map" />` : '<p><em>Map unavailable</em></p>'}

<h2>Responsible Plant Manager &mdash; Contact Details</h2>
<div class="info-box">
  <table>
    <tr><th>Field</th><th>Details</th></tr>
    <tr><td>Full Name</td><td><strong>${c.name || 'N/A'}</strong></td></tr>
    <tr><td>Role</td><td>${c.role || 'N/A'}</td></tr>
    <tr><td>Organisation</td><td>${c.org || 'N/A'}</td></tr>
    <tr><td>Direct Phone</td><td>${c.phone || 'N/A'}</td></tr>
    <tr><td>Email Address</td><td>${c.email || 'N/A'}</td></tr>
    <tr><td>Response SLA</td><td>Immediate (within 30 minutes of breach detection)</td></tr>
  </table>
</div>

<h2>Required Immediate Actions</h2>
<ol>
  <li>Contact plant manager <strong>${c.name || 'on file'}</strong> at ${c.phone || 'number on file'} within 30 minutes.</li>
  <li>Initiate emergency divert valve protocol and redirect discharge to holding tank.</li>
  <li>Dispatch field crew to <strong>${g.nearest || bd.pipeline}</strong> for physical inspection.</li>
  <li>Notify Environment Agency (EA) duty officer within 1 hour of confirmed breach.</li>
  <li>Preserve telemetry snapshots and submit this report to regulatory team within 24 hours.</li>
</ol>
`;
    } else {
        html += `<h2>General Compliance Status</h2><p>All monitoring systems operating within normal parameters. No Section 82 violations detected at time of report generation.</p>`;
    }

    html += `
<h2>Global Sensor Averages at Time of Report</h2>
<table>
  <tr><th>Parameter</th><th>Average Level</th><th>Section 82 Limit</th><th>Status</th></tr>
  <tr><td>pH</td><td>${report.avgs.ph}</td><td>6.0 &ndash; 9.0</td><td>${parseFloat(report.avgs.ph) < 6 || parseFloat(report.avgs.ph) > 9 ? '<span class="critical">BREACH</span>' : 'Normal'}</td></tr>
  <tr><td>COD (mg/L)</td><td>${report.avgs.cod}</td><td>&lt; 150 mg/L</td><td>${parseFloat(report.avgs.cod) >= 150 ? '<span class="critical">BREACH</span>' : parseFloat(report.avgs.cod) >= 120 ? '<span class="warning">WARNING</span>' : 'Normal'}</td></tr>
  <tr><td>BOD (mg/L)</td><td>${report.avgs.bod}</td><td>&lt; 50 mg/L</td><td>${parseFloat(report.avgs.bod) >= 50 ? '<span class="critical">BREACH</span>' : parseFloat(report.avgs.bod) >= 40 ? '<span class="warning">WARNING</span>' : 'Normal'}</td></tr>
  <tr><td>TSS (mg/L)</td><td>${report.avgs.tss}</td><td>&lt; 30 mg/L</td><td>${parseFloat(report.avgs.tss) >= 30 ? '<span class="critical">BREACH</span>' : parseFloat(report.avgs.tss) >= 24 ? '<span class="warning">WARNING</span>' : 'Normal'}</td></tr>
  <tr><td>Temperature (&deg;C)</td><td>${report.avgs.temp}</td><td>&lt; 30 &deg;C</td><td>${parseFloat(report.avgs.temp) >= 30 ? '<span class="critical">BREACH</span>' : parseFloat(report.avgs.temp) >= 24 ? '<span class="warning">WARNING</span>' : 'Normal'}</td></tr>
  <tr><td>Toxic Contaminants (mg/L)</td><td>${report.avgs.toxic}</td><td>&lt; 5.0 mg/L</td><td>${parseFloat(report.avgs.toxic) >= 5 ? '<span class="critical">BREACH</span>' : parseFloat(report.avgs.toxic) >= 4 ? '<span class="warning">WARNING</span>' : 'Normal'}</td></tr>
</table>
`;

    if (report.risks && report.risks.length > 0) {
        html += `<h2>Near-Threshold Risks (&gt;80% of Limit)</h2><ul>`;
        report.risks.forEach(r => html += `<li>${r}</li>`);
        html += `</ul>`;
    }

    if (isBreach && report.imageStr) {
        html += `
<h2>Live Telemetry Snapshot</h2>
<p class="label">Real-time multi-parameter chart captured at moment of breach detection:</p>
<img src="${report.imageStr}" style="width:100%;max-width:800px;height:auto;border:1px solid #cbd5e1;" alt="Telemetry Chart" />
`;
    }

    html += `
<div class="footer">
  <p>This document was automatically generated by the <strong>AquaSense AI Predictive Compliance Engine</strong>.</p>
  <p>Regulatory Framework: Environment Act 2021 &mdash; Section 82 | Classification System: AquaSense Incident Response Protocol v3.1</p>
  <p>For questions contact: compliance@aquasense-ai.net | Emergency: +44 800 AQS-ALERT</p>
</div>
</body>
</html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `AquaSense_${report.type}_Report_${report.id}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const generateReport = (type, details = null) => {
    const id = 'REP-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const timestamp = new Date().toISOString();

    // Calculate global averages and risks
    let avgs = {};
    let risks = [];
    ['ph','cod','bod','tss','temp','toxic'].forEach(k => {
        let avg = 0;
        REGIONS.forEach(r => avg += r[k]);
        avg = (avg / REGIONS.length).toFixed(1);
        avgs[k] = avg;
        let limit = CONFIG[k].max;
        if (k === 'ph') limit = 9.0;
        let pct = (avg / limit) * 100;
        if (pct > 80 && pct <= 100) risks.push(`${CONFIG[k].label} is at ${pct.toFixed(0)}% of critical limit.`);
    });

    let report = { id, type, timestamp, avgs, risks, breachDetails: details, imageStr: null };

    if (type === 'Breach') {
        // Capture chart snapshot
        try { report.imageStr = mainChart.toBase64Image(); } catch (e) {}

        // Enrich with fake contact + geo data for the Word doc
        const region = details && REGIONS.find(r => r.name === details.region);
        const rIdx   = region ? REGIONS.indexOf(region) : 0;
        const contact = FAKE_CONTACTS[rIdx] || FAKE_CONTACTS[0];
        const geo     = region ? (REGION_GEO[region.id] || REGION_GEO['eu']) : REGION_GEO['eu'];
        const geoSvg  = region ? buildGeoMapSVG(region) : buildGeoMapSVG(REGIONS[0]);

        report.contact = contact;
        report.geo     = geo;
        report.geomapDataUri = svgToDataUri(geoSvg);
        report.incidentClass = details && details.message
            ? (details.message.toLowerCase().includes('toxic') ? 'CLASS-A TOXIC' :
               details.message.toLowerCase().includes('ph')    ? 'CLASS-B CHEMICAL' : 'CLASS-C BIOLOGICAL')
            : 'CLASS-C BIOLOGICAL';
    }

    // Save to localStorage (Reports page handles all downloads)
    let reports = JSON.parse(localStorage.getItem('aquaReports') || '[]');
    reports.unshift(report);
    // Cap at 100 reports to prevent localStorage overflow
    if (reports.length > 100) reports.pop();
    localStorage.setItem('aquaReports', JSON.stringify(reports));

    // Notify — direct user to Reports page
    pushNotification(
        `${type} Report Saved`,
        `${id} has been saved. Open the Reports page to download the full document.`,
        type === 'Breach'
    );
    addNormalAlert(
        `<strong>📄 Report ${id} generated</strong> — <a href="reports.html" style="color:var(--accent-blue);">Open Reports page</a> to download.`,
        'info'
    );

    // Trigger immediate download for breach reports
    if (type === 'Breach') {
        downloadDocFile(report);
    }
};


// Fullscreen & Chart Logic
let modalChartInstance = null;
let activeModalSource = null;

window.toggleFullscreen = (containerId) => {
    const modal = document.getElementById('chart-modal');
    
    // If minimizing
    if (!containerId || modal.style.display === 'flex') {
        modal.style.display = 'none';
        if (modalChartInstance) {
            modalChartInstance.destroy();
            modalChartInstance = null;
        }
        activeModalSource = null;
        return;
    }

    // Maximizing
    modal.style.display = 'flex';
    let sourceChart, title, newOptions;
    
    if (containerId === 'box-main-chart') {
        activeModalSource = 'main';
        title = 'Real-Time Multi-Parameter Levels';
        newOptions = {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                annotation: {
                    annotations: {
                        limit_ph: createAnnotation('y_ph', CONFIG.ph.max, CONFIG.ph.color),
                        limit_cod: createAnnotation('y_cod', CONFIG.cod.max, CONFIG.cod.color),
                        limit_bod: createAnnotation('y_bod', CONFIG.bod.max, CONFIG.bod.color),
                        limit_tss: createAnnotation('y_tss', CONFIG.tss.max, CONFIG.tss.color),
                        limit_temp: createAnnotation('y_temp', CONFIG.temp.max, CONFIG.temp.color),
                        limit_toxic: createAnnotation('y_toxic', CONFIG.toxic.max, CONFIG.toxic.color)
                    }
                }
            },
            scales: {
                x: { grid: commonGrid, display: false },
                y_ph: { type: 'linear', position: 'left', min: 4, max: 10, display: false },
                y_cod: { type: 'linear', position: 'left', min: 0, max: 200, display: false },
                y_bod: { type: 'linear', position: 'left', min: 0, max: 100, display: false },
                y_tss: { type: 'linear', position: 'left', min: 0, max: 60, display: false },
                y_temp: { type: 'linear', position: 'left', min: 10, max: 40, display: false },
                y_toxic: { type: 'linear', position: 'left', min: 0, max: 10, display: false }
            }
        };
    } else {
        const metric = containerId.split('chart-')[1];
        activeModalSource = metric;
        title = CONFIG[metric].label + ' Level';
        
        let minMax = {min: 0, max: 100};
        if (metric==='ph') minMax = {min: 4, max: 10};
        else if (metric==='cod') minMax = {min: 0, max: 200};
        else if (metric==='bod') minMax = {min: 0, max: 100};
        else if (metric==='tss') minMax = {min: 0, max: 60};
        else if (metric==='temp') minMax = {min: 10, max: 40};
        else if (metric==='toxic') minMax = {min: 0, max: 10};

        newOptions = {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { 
                legend: { display: false },
                annotation: {
                    annotations: {
                        limit: {
                            type: 'line', yMin: CONFIG[metric].max, yMax: CONFIG[metric].max,
                            borderColor: 'rgba(239, 68, 68, 0.5)', borderDash: [5, 5]
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { type: 'linear', display: true, min: minMax.min, max: minMax.max, grid: commonGrid, ticks: {font: {size: 10}} }
            }
        };
    }

    document.getElementById('chart-modal-title').innerText = title;
    const ctx = document.getElementById('modalChartCanvas').getContext('2d');
    
    const sourceData = activeModalSource === 'main' ? mainChart.data : miniCharts[activeModalSource].data;
    
    // Create new datasets array to avoid mutating original
    const clonedDatasets = sourceData.datasets.map(ds => Object.assign({}, ds, { data: [...ds.data] }));
    
    modalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...sourceData.labels],
            datasets: clonedDatasets
        },
        options: newOptions
    });
};

window.toggleLogFullscreen = (containerId) => {
    const el = document.getElementById(containerId);
    if (el) el.classList.toggle('fullscreen-panel');
};

window.toggleMetric = (metricId) => {
    const legItem = document.getElementById(`leg-${metricId}`);
    legItem.classList.toggle('disabled');
    const isHidden = legItem.classList.contains('disabled');

    const dsIndex = mainChart.data.datasets.findIndex(ds => ds.id === metricId);
    if (dsIndex !== -1) {
        mainChart.setDatasetVisibility(dsIndex, !isHidden);
    }

    if (mainChart.options.plugins.annotation.annotations[`limit_${metricId}`]) {
        mainChart.options.plugins.annotation.annotations[`limit_${metricId}`].display = !isHidden;
    }
    
    mainChart.update();
};

// Event Listeners
document.getElementById('btn-notifications').addEventListener('click', () => {
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'flex'; badge.style.display = 'none'; unreadNotificationsCount = 0;
    } else {
        dropdown.style.display = 'none';
    }
});

document.getElementById('btn-clear-notifications').addEventListener('click', () => {
    document.getElementById('notification-list').innerHTML = '<div class="empty-state">No new alerts.</div>';
    document.getElementById('notification-dropdown').style.display = 'none';
});

document.getElementById('btn-global-view').addEventListener('click', () => {
    currentView = 'global';
    summaryTick = 0;
    document.getElementById('dashboard-title').innerText = 'Global Live Monitoring';
    document.getElementById('btn-global-view').style.display = 'none';
    
    // Revert UI titles to global
    document.querySelectorAll('.station-tag').forEach(tag => tag.innerText = 'ALL STATIONS');
    document.getElementById('chart-station-label').innerText = 'ALL STATIONS · GLOBAL COMPOSITE';
    
    const metricsList = [
        {id: 'ph', label: 'pH'}, {id: 'cod', label: 'COD'}, {id: 'bod', label: 'BOD'}, 
        {id: 'tss', label: 'TSS'}, {id: 'temp', label: 'Temperature'}, {id: 'toxic', label: 'Toxic Contam.'}
    ];
    metricsList.forEach(m => {
        const headerSpan = document.querySelector(`#box-chart-${m.id} .mini-header span`);
        if (headerSpan) headerSpan.innerText = `${m.label} — All Stations`;
    });

    addNormalAlert(`Dashboard context returned to Global View.`, 'info');
    updateChartData();
});

document.getElementById('btn-simulate-spike').addEventListener('click', () => {
    const targetRegion = currentView === 'global' ? REGIONS[Math.floor(Math.random() * REGIONS.length)] : REGIONS.find(r => r.id === currentView);
    targetRegion.cod += 60; 
    targetRegion.ph -= 1.5; 
    targetRegion.toxic += 3;
    addNormalAlert(`MANUAL OVERRIDE: Simulated toxic spill injected into ${targetRegion.name} sensor streams.`, 'warning');

    // Immediately generate and save Breach report (triggers immediate .doc download and logs to Reports page)
    const pipes = ['Main Effluent Discharge Pipe 4B', 'Secondary Treatment Valve A', 'Stormwater Overflow Drain 2', 'Primary Clarifier Outlet Pipe', 'Bioreactor Feed Line C'];
    const randomPipe = pipes[Math.floor(Math.random() * pipes.length)];
    generateReport('Breach', {
        region: targetRegion.name,
        message: 'Simulated toxic spill detected. COD, pH & Toxic Contaminants violated limits.',
        pipeline: randomPipe
    });
});

const btnExport = document.getElementById('btn-export-report');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        generateReport('General', null);
        addNormalAlert(`General Compliance Report generated and saved to Reports page.`, 'info');
    });
}

// Initialization
initMap();
initCharts();
setInterval(generateData, 2000);
generateData();

// ============================================================
//  MODULE 1: SOURCE APPORTIONMENT (Root Cause AI)
// ============================================================
const APPORT_NODES = {
    'dyeing-a': { name: 'EUR-1 SUB-A / Process Vat Alpha', cx: 80, cy: 30, param: 'ph' },
    'dyeing-b': { name: 'EUR-1 SUB-B / Effluent Channel Secondary', cx: 80, cy: 80, param: 'cod' },
    'bioreactor': { name: 'EUR-1 SUB-C / Bioreactor Feed Line', cx: 80, cy: 130, param: 'toxic' },
};

function runSourceApportionment(breachedParam) {
    const confEl = document.getElementById('apport-confidence');
    const resultEl = document.getElementById('apport-result');
    if (!confEl || !resultEl) return;

    // Reset all nodes
    Object.keys(APPORT_NODES).forEach(id => {
        const el = document.getElementById('node-' + id);
        if (el) { el.setAttribute('fill', 'rgba(16,185,129,0.2)'); el.setAttribute('stroke', '#10b981'); }
    });

    // Find most likely node based on breached parameter
    const match = Object.entries(APPORT_NODES).find(([, n]) => n.param === breachedParam) || Object.entries(APPORT_NODES)[Math.floor(Math.random() * 3)];
    const [nodeId, node] = match;

    // Animate — highlight the offending node
    const nodeEl = document.getElementById('node-' + nodeId);
    const dischargeEl = document.getElementById('node-discharge');
    if (nodeEl) { nodeEl.setAttribute('fill', 'rgba(239,68,68,0.4)'); nodeEl.setAttribute('stroke', '#ef4444'); }
    if (dischargeEl) { dischargeEl.setAttribute('fill', 'rgba(239,68,68,0.3)'); dischargeEl.setAttribute('stroke', '#ef4444'); }

    const confidence = Math.round(82 + Math.random() * 14);
    confEl.innerText = `${confidence}% Confidence`;
    confEl.style.color = '#ef4444';

    resultEl.innerHTML = `<span style="color:var(--status-critical);font-weight:600;">⚠ Analyzing with local LLM...</span><br>Awaiting Ollama response...`;
    
    // Call local Ollama LLM
    const ollamaBase = (localStorage.getItem('aquaOllamaUrl') || 'http://localhost:11434').replace(/\/+$/, '');
    const ollamaModel = localStorage.getItem('aquaOllamaModel') || 'llama3';
    
    fetch(`${ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: ollamaModel,
            prompt: `You are an AI assistant for a wastewater monitoring dashboard. A spike in ${breachedParam.toUpperCase()} was detected. Upstream analysis points to ${node.name}. In 2 short sentences, explain why this node might cause this spike and recommend an immediate action. Do not use formatting like bold or asterisks.`,
            stream: false
        })
    })
    .then(res => res.json())
    .then(data => {
        resultEl.innerHTML = `<span style="color:var(--status-critical);font-weight:600;">⚠ High Confidence Alert</span><br>
        Anomaly correlated to <strong style="color:var(--text-primary);">${node.name}</strong>.<br>
        ${data.response}`;
        resultEl.style.background = 'rgba(239,68,68,0.08)';
        resultEl.style.borderLeft = '3px solid var(--status-critical)';
    })
    .catch(err => {
        console.error("Ollama fetch failed:", err);
        resultEl.innerHTML = `<span style="color:var(--status-critical);font-weight:600;">⚠ High Confidence Alert</span><br>
        Anomaly correlated to <strong style="color:var(--text-primary);">${node.name}</strong>.<br>
        AI detected upstream sub-meter deviation 3.2 min prior to main discharge spike. Dispatch crew to ${node.name} for immediate inspection. (LLM Error)`;
        resultEl.style.background = 'rgba(239,68,68,0.08)';
        resultEl.style.borderLeft = '3px solid var(--status-critical)';
    });

    // Auto-reset after 30s
    setTimeout(() => {
        if (nodeEl) { nodeEl.setAttribute('fill', 'rgba(16,185,129,0.2)'); nodeEl.setAttribute('stroke', '#10b981'); }
        if (dischargeEl) { dischargeEl.setAttribute('fill', 'rgba(16,185,129,0.1)'); dischargeEl.setAttribute('stroke', '#10b981'); }
        if (confEl) { confEl.innerText = 'Monitoring…'; confEl.style.color = 'var(--accent-blue)'; }
        if (resultEl) { resultEl.innerHTML = 'Awaiting anomaly data to run correlation analysis…'; resultEl.style.background = 'rgba(0,0,0,0.2)'; resultEl.style.borderLeft = 'none'; }
    }, 30000);
}

// Patch simulate-spill to also run apportionment
document.getElementById('btn-simulate-spike').addEventListener('click', () => {}, false);
const origSimBtn = document.getElementById('btn-simulate-spike');
origSimBtn.addEventListener('click', () => {
    setTimeout(() => {
        const params = ['ph', 'cod', 'toxic'];
        runSourceApportionment(params[Math.floor(Math.random() * params.length)]);
    }, 1500);
});


// ============================================================
//  MODULE 2: WEATHER-CORRELATED OVERFLOW PREDICTION
// ============================================================
const WEATHER_SCENARIOS = [
    { icon: '☀️', temp: 18, desc: 'Clear Skies', risk: 10, color: 'var(--status-normal)', alert: '' },
    { icon: '⛅', temp: 14, desc: 'Partly Cloudy', risk: 30, color: 'var(--status-normal)', alert: '' },
    { icon: '🌧️', temp: 11, desc: 'Light Rain', risk: 55, color: 'var(--status-warning)', alert: 'Moderate rainfall detected. First-flush risk elevated. Treatment capacity at 70%.' },
    { icon: '⛈️', temp: 8, desc: 'Thunderstorm', risk: 88, color: 'var(--status-critical)', alert: '⚡ CRITICAL: Storm event imminent. Pollutant capacity at 90%. High risk of weather-induced overflow within 2 hrs. Recommend preemptive divert to holding tanks.' },
    { icon: '🌩️', temp: 9, desc: 'Heavy Storm', risk: 95, color: 'var(--status-critical)', alert: '🚨 EMERGENCY: Extreme rainfall event. Overflow HIGHLY PROBABLE. Automated divert valve triggered. Immediate operator inspection required.' },
];

function updateWeatherWidget() {
    const s = WEATHER_SCENARIOS[Math.floor(Math.random() * WEATHER_SCENARIOS.length)];
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const fillEl = document.getElementById('overflow-risk-fill');
    const labelEl = document.getElementById('overflow-risk-label');
    const alertEl = document.getElementById('weather-alert');
    if (!iconEl) return;

    iconEl.innerText = s.icon;
    tempEl.innerText = s.temp + '°C';
    descEl.innerText = s.desc;
    fillEl.style.width = s.risk + '%';
    fillEl.style.background = s.color;
    labelEl.innerText = (s.risk < 40 ? 'LOW' : s.risk < 70 ? 'MEDIUM' : 'HIGH') + ' — ' + s.risk + '% Risk';
    labelEl.style.color = s.color;

    if (s.alert) {
        alertEl.innerText = s.alert;
        alertEl.style.display = 'block';
        alertEl.style.borderLeftColor = s.risk > 80 ? 'var(--status-critical)' : 'var(--status-warning)';
        alertEl.style.background = s.risk > 80 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
        alertEl.style.color = s.risk > 80 ? 'var(--status-critical)' : 'var(--status-warning)';
        if (s.risk > 80) {
            addNormalAlert(`<strong>Weather Alert:</strong> ${s.alert}`, 'warning');
        }
    } else {
        alertEl.style.display = 'none';
    }
}

updateWeatherWidget();
setInterval(updateWeatherWidget, 45000); // Rotate every 45s


// ============================================================
//  MODULE 3: FINANCIAL IMPACT — FINES AVOIDED WIDGET
// ============================================================
let finesBreachesPrevented = 47;
let uptimeHours = 312 * 24;

function updateFinesWidget() {
    const finesEl = document.getElementById('fines-counter-dash');
    const countEl = document.getElementById('fines-breach-count');
    const uptimeEl = document.getElementById('uptime-counter');
    const kpiFines = document.getElementById('kpi-fines');
    const total = finesBreachesPrevented * 25000;
    if (finesEl)  finesEl.innerText  = '£' + total.toLocaleString();
    if (countEl)  countEl.innerText  = finesBreachesPrevented;
    if (uptimeEl) uptimeEl.innerText = uptimeHours.toLocaleString();
    if (kpiFines) kpiFines.innerText = '£' + total.toLocaleString();
}

// Increment fines whenever a breach is prevented (hook into existing breach counter)
const _origAddBreachAlert = window.addBreachAlert;
function incrementFinesPrevented() {
    finesBreachesPrevented++;
    uptimeHours = Math.max(0, uptimeHours - 1);
    updateFinesWidget();
}
// Attach to simulate button
origSimBtn.addEventListener('click', () => {
    setTimeout(incrementFinesPrevented, 4000);
});

updateFinesWidget();
setInterval(() => { uptimeHours += 1; updateFinesWidget(); }, 3600000); // Increment every real hour


// ============================================================
//  MODULE 4: CLOSED-LOOP ACTUATOR SYSTEM
// ============================================================
const ACTUATORS = [
    { id: 'act-valve-a', name: 'Discharge Valve A', state: 'OPEN', auto: true },
    { id: 'act-divert', name: 'Storm Divert Gate', state: 'CLOSED', auto: true },
    { id: 'act-holding', name: 'Holding Tank Inlet', state: 'CLOSED', auto: true },
];

function renderActuators() {
    const list = document.getElementById('actuator-list');
    if (!list) return;
    list.innerHTML = ACTUATORS.map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;">
            <div style="font-size:12px;color:var(--text-secondary);">${a.name}</div>
            <span id="${a.id}-badge" style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${a.state === 'OPEN' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.2)'};color:${a.state === 'OPEN' ? 'var(--status-normal)' : 'var(--text-secondary)'};">${a.state}</span>
        </div>
    `).join('');
}

function triggerActuatorMitigation(reason) {
    // Close discharge, open divert + holding
    ACTUATORS[0].state = 'CLOSED';
    ACTUATORS[1].state = 'OPEN';
    ACTUATORS[2].state = 'OPEN';
    renderActuators();

    const logEl = document.getElementById('actuator-log');
    if (logEl) {
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML = `<span style="color:var(--status-critical);font-weight:600;">[${time}] AUTO-MITIGATION TRIGGERED</span><br>${reason}<br>Discharge valve CLOSED. Divert gate OPEN. Holding tank active.`;
        logEl.style.borderLeft = '3px solid var(--status-critical)';
    }

    addNormalAlert(`<strong>🔒 Actuator Auto-Response:</strong> ${reason}. Discharge valve has been automatically closed. Water diverted to holding tank.`, 'warning');
    pushNotification('Actuator Triggered', reason, true);

    // Auto-restore after 60s
    setTimeout(() => {
        ACTUATORS[0].state = 'OPEN';
        ACTUATORS[1].state = 'CLOSED';
        ACTUATORS[2].state = 'CLOSED';
        renderActuators();
        const logEl = document.getElementById('actuator-log');
        if (logEl) { logEl.innerHTML = 'Mitigation complete. All valves restored to normal operation.'; logEl.style.borderLeft = 'none'; }
    }, 60000);
}

renderActuators();

// Trigger actuator when spill is simulated
origSimBtn.addEventListener('click', () => {
    setTimeout(() => {
        triggerActuatorMitigation('AI breach prediction confidence exceeded 92% threshold. pH drop & COD spike detected at main discharge.');
    }, 3000);
});

