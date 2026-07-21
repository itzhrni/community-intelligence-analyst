Here is a professional and comprehensive `README.md` text content for your GitHub repository:

```markdown
# Shadow-Net: Cross-Dataset Community Intelligence Analyst Console

An advanced, real-time forensic intelligence and network analysis console designed to detect community structures, link anonymous identifiers, and correlate suspicious activities across Call Detail Records (CDR) and IP Detail Records (IPDR) datasets.

## 🚀 Key Features

### 1. Cross-Dataset Intelligence
* **Unified Subscriber Profile:** Chronologically merges calling activities (MSISDNs) with internet detail records (IPs).
* **SIM Swap Detection:** Flags hardware anomalies where a single IMEI is registered with multiple IMSIs.
* **Burner Phone Detection:** Identifies physical device hardware (IMEIs) shared across multiple phone numbers.
* **Cross-Dataset Correlations:** Automatically flags temporal overlaps (±5-minute window) between suspicious call interactions and encrypted IPDR communications (e.g., VPN-Tunnel, Tor-Bridge, Signal, Telegram).

### 2. High-Priority Graph Visualization
* **Radial Community Layouts:** Puts community leader nodes fixed at the spatial center of each community cluster.
* **Dynamic Node & Edge Styling:** Nodes are sized dynamically based on their degree of connectivity; edge thickness represents interaction count.
* **Bridge Node Highlight:** Automatically highlights and paths inter-community connections with dotted bridge link lines.
* **Interactive Tooltips:** Interactive vis.js node tooltips show real-time roles, risk scoring, and subscriber metrics on hover.
* **Ego Graph Search:** Search parameters supporting queries by Phone Number, IP Address, IMEI, or IMSI with Community and Risk Level filtering.

### 3. Overview Forensic Dashboard
* **Dynamic KPIs:** Key analytics displaying Total Calls, Internet Sessions, Communities, High-Risk Communities, Subscribers, Devices, and Average Risk Score.
* **Interactive Filtering:** Global filters (Date Range, Community, Risk Level, IMSI, IMEI, and Application) that automatically recalculate all KPIs and distributions in real-time.
* **Forensic Analytics Charts:** 8 interactive Recharts visualization panels including:
  * Community Size Distribution
  * Call Activity Timeline
  * Internet Session Timeline
  * Top Applications (WhatsApp, Tor, Signal, etc.)
  * RAT Network Distribution (2G/3G/4G/5G)
  * Risk Score Distribution
  * Call Duration Distribution
  * Data Usage Distribution

### 4. Intelligence Reporting Center
* **PDF Dossier Generation:** Dedicated CSS `@media print` layouts that isolate and print structured, professional intelligence dossiers without UI element clutter.
* **Granular Excel/CSV Exports:** Support for exporting global forensic logs, community lists (with leader/risk index), and subscriber audit records in `.csv` and `.xls` (Microsoft Excel-compatible) formats.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, TailwindCSS (for max responsive styling), Recharts (data visualization), Vis.js (network graphs)
* **Routing & SSR:** TanStack Start, TanStack Router
* **Backend Integration:** TanStack Server Functions

---

## 💻 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shadow-net.git
   cd shadow-net
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build the application for production:
   ```bash
   npm run build
   ```
```
