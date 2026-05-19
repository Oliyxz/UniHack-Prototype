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

Since this is a zero-build prototype, you do not need Node.js or any build tools to run it.

1. Clone or download this repository.
2. Open the `index.html` file directly in any modern web browser.
3. You will immediately see the dashboard populating with live simulated data.

## Exploring the AI Engine

1. Watch the **AI Predictive Alerts** feed on the right side of the dashboard.
2. Click the **"Simulate Spill"** button in the top right corner.
3. Observe how the engine detects the rapid rate of change and issues a **"Predictive Warning"** before the limit is breached, followed by a **"Critical Breach"** alert once the threshold is crossed.
