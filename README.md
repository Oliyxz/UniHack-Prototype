# AquaSense AI — Wastewater Compliance Platform

Every day, industrial facilities discharge wastewater into the environment — and most have no real-time visibility into whether it's safe. Section 82 of the Water Industry Act sets strict limits on pollutants, but compliance is still managed through manual testing and delayed lab reports.

**AquaSense AI** changes this. We provide continuous monitoring, predictive alerts, and automated reporting that moves industry from reactive damage control to proactive environmental protection.

## Features

- **Real-Time Sensor Monitoring**: Continuously analyses simulated IoT sensor data for pH, COD, BOD, and TSS, updating live on a premium dark-mode dashboard.
- **Predictive Breach Detection**: A rules engine calculates the rate of change of pollutant levels to predict and flag compliance breaches *before* they occur.
- **Automated Regulatory Alerts**: Generates instant notifications when data trends towards or crosses legal limits.
- **Simulation Engine**: Includes a "Simulate Spill" feature to manually inject anomalies and watch the predictive AI react in real time.
- **AI Agent Capabilities**: Integrated conversational AI assistant to query compliance data and analyse sensor patterns (`agent.js`).
- **Comprehensive Multi-page Navigation**: Easy access to different views including Dashboard, Analytics, Reports, Sensor Health, Audit Log, Stakeholders, and Settings.
- **Advanced Analytics & Reporting**: Deep dive into historical trends (`analytics.html`) and automatically generate regulatory compliance reports (`reports.html`).
- **Sensor Health Management**: Monitor the operational status, battery levels, and calibration needs of all deployed IoT sensors (`sensor-health.html`).
- **Audit Logging**: Maintain an immutable, chronological record of all system events, warnings, and manual interventions (`audit-log.html`).
- **Stakeholder Views**: Customised, high-level dashboards designed specifically for non-technical stakeholders and regulatory bodies (`stakeholder.html`).
- **Customisable Settings & Theming**: Configure user preferences, notification thresholds, and dynamic theme adjustments (`settings.html`, `theme.js`).

## Tech Stack

This prototype is built using a robust, zero-build frontend stack for maximum portability:
- **Core**: Vanilla HTML5, CSS3, and JavaScript (ES6+).
- **Styling**: Custom CSS design system featuring glassmorphism and dynamic state animations.
- **Data Visualization**: [Chart.js](https://www.chartjs.org/) for highly performant, responsive line charts.
- **Icons**: [Lucide Icons](https://lucide.dev/) for a clean, modern aesthetic.

## How to Run the Prototype

Since this is a zero-build prototype, you do not need complex build tools to run it, but **a local web server is required** for the AI features to communicate with local APIs (due to browser CORS security policies).

### 1. Start a Local Web Server

Do not open the `index.html` file directly by double-clicking it (this causes `file:///` CORS errors). Instead, serve the directory locally:

**Using Python:**
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your web browser.

**Using Node.js:**
```bash
npx serve
```
Then navigate to `http://localhost:3000` in your web browser.

### 2. Configure Local AI Engine (Ollama)

For the AI Assistant and Analytics tools to function, you must allow cross-origin requests (CORS) from your local server to Ollama. 

**If running Ollama from terminal/PowerShell (Windows):**
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**If using the Ollama System Tray App (Windows):**
1. Right-click the Ollama icon in the system tray and select **Quit**.
2. Press the Windows key, search for **"Environment Variables"** and select **"Edit the system environment variables"**.
3. Click the **"Environment Variables..."** button.
4. Under **User variables**, click **New...**
5. Enter Variable name: `OLLAMA_ORIGINS`
6. Enter Variable value: `*`
7. Click **OK** and restart the Ollama app from your start menu.

After setting this up, navigate to the **Settings** page in the AquaSense dashboard and use the **Test Link** button to verify your connection!

## Exploring the AI Engine

1. Watch the **AI Predictive Alerts** feed on the right side of the dashboard.
2. Click the **"Simulate Spill"** button in the top right corner.
3. Observe how the engine detects the rapid rate of change and issues a **"Predictive Warning"** before the limit is breached, followed by a **"Critical Breach"** alert once the threshold is crossed.
