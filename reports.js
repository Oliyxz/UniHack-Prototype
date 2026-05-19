// reports.js — Document Archive Page
const reportsList = document.getElementById('reports-list');
const btnClear    = document.getElementById('btn-clear-reports');

// ── Render Reports from localStorage ─────────────────────────────────────────
const renderReports = () => {
    const reports = JSON.parse(localStorage.getItem('aquaReports') || '[]');
    reportsList.innerHTML = '';

    if (reports.length === 0) {
        reportsList.innerHTML = `
            <div class="report-empty">
                <i data-lucide="folder-open" style="width:48px;height:48px;margin-bottom:12px;opacity:0.5;"></i>
                <p>No reports generated yet.</p>
                <small>Go to the Dashboard to export a general report, or simulate a spill to trigger a breach report.</small>
            </div>
        `;
        if (lucide) lucide.createIcons();
        return;
    }

    reports.forEach((report, index) => {
        const dateStr    = new Date(report.timestamp).toLocaleString();
        const badgeClass = report.type === 'Breach' ? 'breach' : 'general';
        const typeLabel  = report.type === 'Breach' ? 'Section 82 Breach' : 'General Compliance';
        const isBreach   = report.type === 'Breach';

        let detailsText = 'Routine monitoring average snapshot.';
        if (isBreach && report.breachDetails) {
            detailsText = `[${report.breachDetails.region}] ${report.breachDetails.message}`;
        }

        // Extra metadata badges for breach reports
        let extraMeta = '';
        if (isBreach && report.incidentClass) {
            extraMeta = `<span style="background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">${report.incidentClass}</span>`;
        }
        if (isBreach && report.contact) {
            extraMeta += ` <span style="font-size:12px;color:var(--text-secondary);">· Contact: <strong style="color:var(--text-primary);">${report.contact.name}</strong></span>`;
        }

        const html = `
            <div class="report-card">
                <div class="report-info">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;flex-wrap:wrap;">
                        <span class="report-badge ${badgeClass}">${report.type}</span>
                        <h4>${typeLabel} Report (${report.id})</h4>
                        ${extraMeta}
                    </div>
                    <div class="report-meta">
                        <span><i data-lucide="calendar"></i> ${dateStr}</span>
                        ${isBreach && report.geo ? `<span><i data-lucide="map-pin"></i> ${report.geo.city}</span>` : ''}
                    </div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${detailsText}</div>
                </div>
                <div class="report-actions">
                    <button class="btn btn-outline" onclick="downloadDoc(${index})">
                        <i data-lucide="file-text"></i> Download .doc
                    </button>
                    <button class="btn btn-outline" onclick="downloadCsv(${index})">
                        <i data-lucide="table"></i> Download .csv
                    </button>
                </div>
            </div>
        `;
        reportsList.insertAdjacentHTML('beforeend', html);
    });

    if (lucide) lucide.createIcons();
};

// ── Clear Logic ───────────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all historical reports? This cannot be undone.')) {
        localStorage.removeItem('aquaReports');
        renderReports();
    }
});

// ── Word Document (.doc) Download ─────────────────────────────────────────────
window.downloadDoc = (index) => {
    const reports = JSON.parse(localStorage.getItem('aquaReports') || '[]');
    const report  = reports[index];
    if (!report) return;

    const isBreach = report.type === 'Breach';
    const ts       = new Date(report.timestamp).toLocaleString();

    // ── Document header & styles ──────────────────────────────────────────────
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

    // ── Breach-specific content ───────────────────────────────────────────────
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

    // ── Global averages ───────────────────────────────────────────────────────
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

    // ── Near risks ────────────────────────────────────────────────────────────
    if (report.risks && report.risks.length > 0) {
        html += `<h2>Near-Threshold Risks (&gt;80% of Limit)</h2><ul>`;
        report.risks.forEach(r => html += `<li>${r}</li>`);
        html += `</ul>`;
    }

    // ── Chart snapshot ────────────────────────────────────────────────────────
    if (report.type === 'Breach' && report.imageStr) {
        html += `
<h2>Live Telemetry Snapshot</h2>
<p class="label">Real-time multi-parameter chart captured at moment of breach detection:</p>
<img src="${report.imageStr}" style="width:100%;max-width:800px;height:auto;border:1px solid #cbd5e1;" alt="Telemetry Chart" />
`;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
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

// ── CSV Download ──────────────────────────────────────────────────────────────
window.downloadCsv = (index) => {
    const reports = JSON.parse(localStorage.getItem('aquaReports') || '[]');
    const report  = reports[index];
    if (!report) return;

    let csv = [];
    csv.push(`Report ID,${report.id}`);
    csv.push(`Type,${report.type}`);
    csv.push(`Timestamp,${new Date(report.timestamp).toLocaleString()}`);
    csv.push(`Incident Class,${report.incidentClass || 'N/A'}`);

    if (report.type === 'Breach' && report.breachDetails) {
        csv.push(`Breach Region,"${report.breachDetails.region}"`);
        csv.push(`Breach Details,"${report.breachDetails.message.replace(/"/g, "'").replace(/,/g, ';')}"`);
    }
    if (report.contact) {
        csv.push(`Plant Manager,"${report.contact.name}"`);
        csv.push(`Plant Manager Role,"${report.contact.role}"`);
        csv.push(`Contact Phone,"${report.contact.phone}"`);
        csv.push(`Contact Email,"${report.contact.email}"`);
    }
    if (report.geo) {
        csv.push(`Incident City,"${report.geo.city}"`);
        csv.push(`Grid Reference,"${report.geo.grid}"`);
        csv.push(`Nearest Infrastructure,"${report.geo.nearest}"`);
    }

    csv.push('');
    csv.push('Parameter,Average Level,Section 82 Limit');
    csv.push(`pH,${report.avgs.ph},"6.0–9.0"`);
    csv.push(`COD (mg/L),${report.avgs.cod},< 150`);
    csv.push(`BOD (mg/L),${report.avgs.bod},< 50`);
    csv.push(`TSS (mg/L),${report.avgs.tss},< 30`);
    csv.push(`Temperature (°C),${report.avgs.temp},< 30`);
    csv.push(`Toxic Contaminants (mg/L),${report.avgs.toxic},< 5.0`);

    csv.push('');
    csv.push('Near Risks (>80% of Limit)');
    if (report.risks && report.risks.length > 0) {
        report.risks.forEach(r => csv.push(`"${r.replace(/"/g, "'")}"`));
    } else {
        csv.push('None detected');
    }

    csv.push('');
    csv.push('Historical Telemetry Data (Last 500 Minutes)');
    csv.push('Timestamp,pH,COD (mg/L),BOD (mg/L),TSS (mg/L),Temp (°C),Toxic (mg/L)');

    let mockDate = new Date(report.timestamp);
    mockDate.setMinutes(mockDate.getMinutes() - 500);

    for (let i = 0; i < 500; i++) {
        mockDate.setMinutes(mockDate.getMinutes() + 1);
        let rPh, rCod, rBod, rTss, rTemp, rToxic;
        if (i < 480) {
            rPh    = (7.2  + (Math.random() * 0.4  - 0.2 )).toFixed(2);
            rCod   = (80.0 + (Math.random() * 10   - 5   )).toFixed(1);
            rBod   = (20.0 + (Math.random() * 4    - 2   )).toFixed(1);
            rTss   = (15.0 + (Math.random() * 2    - 1   )).toFixed(1);
            rTemp  = (parseFloat(report.avgs.temp || 22) + (Math.random() * 1 - 0.5)).toFixed(1);
            rToxic = (0.5  + (Math.random() * 0.2  - 0.1 )).toFixed(2);
        } else {
            const p = (i - 480) / 20;
            rPh    = (7.2  + (parseFloat(report.avgs.ph)    - 7.2 ) * p + (Math.random() * 0.2 - 0.1)).toFixed(2);
            rCod   = (80.0 + (parseFloat(report.avgs.cod)   - 80.0) * p + (Math.random() * 5   - 2.5)).toFixed(1);
            rBod   = (20.0 + (parseFloat(report.avgs.bod)   - 20.0) * p + (Math.random() * 2   - 1  )).toFixed(1);
            rTss   = (15.0 + (parseFloat(report.avgs.tss)   - 15.0) * p + (Math.random() * 1   - 0.5)).toFixed(1);
            rTemp  = (parseFloat(report.avgs.temp || 22) + (Math.random() * 1 - 0.5)).toFixed(1);
            rToxic = Math.max(0, (0.5 + (parseFloat(report.avgs.toxic) - 0.5) * p + (Math.random() * 0.2 - 0.1))).toFixed(2);
        }
        csv.push(`"${mockDate.toLocaleString()}",${rPh},${rCod},${rBod},${rTss},${rTemp},${rToxic}`);
    }

    const blob = new Blob([csv.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `AquaSense_${report.type}_Report_${report.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ── Init ──────────────────────────────────────────────────────────────────────
renderReports();
