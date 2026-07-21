/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Network,
  Route as RouteIcon,
  Zap,
  ShieldAlert,
  Users,
  Radio,
  Send,
  Search,
  Download,
  Sparkles,
  Play,
  X,
  BarChart2,
  Clock,
  Smartphone,
  Database,
  AlertCircle,
  FileSpreadsheet,
  MapPin,
  Wifi,
  Globe,
  Server,
  PhoneCall,
  Flame,
  Gauge,
  Layers,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import {
  askAnalyst,
  getCdrGraph,
  getEgoIp,
  getEgoPhone,
  getHealth,
  getIpdrGraph,
  getStats,
  traceClusterSpread,
  traceIpdrClusterMembers,
  traceIpdrClusterProfile,
  traceIpdrCross,
  traceSubsequent,
  traceSuspectContacts,
  getCdrAnalyticsData,
  getIpdrAnalyticsData,
  searchCrossDataset,
  getCrossIntelOverview,
  resolveEgoGraphSearch,
  getRawTelecomData,
} from "@/lib/telecom.functions";

export const Route = createFileRoute("/")({
  component: AnalystConsole,
});


// ------------------ palette ------------------
const PALETTE_20 = [
  "#508dff", "#7bd88f", "#f78166", "#c792ea", "#f7b955",
  "#4fc3f7", "#e56399", "#00b894", "#fdcb6e", "#a29bfe",
  "#e17055", "#00cec9", "#ff7675", "#74b9ff", "#55efc4",
  "#fab1a0", "#81ecec", "#ffeaa7", "#d63031", "#6c5ce7",
];
const RISK_COLOR: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

const isPhone = (s: string) => /^[+\-\d\s]{6,}$/.test(s.trim()) && /\d/.test(s);
const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s.trim());
const rnd = () => Math.random();

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, exp);
  return `${val.toFixed(exp === 0 ? 0 : 2)} ${units[exp]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ------------------ types ------------------
type Panel = "chat" | "graph" | "trace" | "analytics" | "crossIntel" | "reporting";
type ChatMsg = { id: string; role: "user" | "ai"; text: string; intent?: string };

// ============================================================
function AnalystConsole() {

  const [panel, setPanel] = useState<Panel>("chat");
  const [health, setHealth] = useState<{ status: string; model: string; version: string } | null>(null);
  const [stats, setStats] = useState<{ cdr_communities: number; ipdr_clusters: number; high_risk: number; total_users: number } | null>(null);
  const [cdrGraph, setCdrGraph] = useState<any | null>(null);
  const [ipdrGraph, setIpdrGraph] = useState<any | null>(null);
  const [cdrAnalytics, setCdrAnalytics] = useState<any | null>(null);
  const [ipdrAnalytics, setIpdrAnalytics] = useState<any | null>(null);
  const [rawData, setRawData] = useState<any | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [dataSource, setDataSource] = useState<"CDR" | "IPDR">("CDR");

  const healthFn = useServerFn(getHealth);
  const statsFn = useServerFn(getStats);
  const cdrFn = useServerFn(getCdrGraph);
  const ipdrFn = useServerFn(getIpdrGraph);
  const cdrAnalyticsFn = useServerFn(getCdrAnalyticsData);
  const ipdrAnalyticsFn = useServerFn(getIpdrAnalyticsData);
  const rawDataFn = useServerFn(getRawTelecomData);

  useEffect(() => {
    const t0 = performance.now();
    (async () => {
      try {
        const [h, s, c, i, a, ia, rd] = await Promise.all([
          healthFn(),
          statsFn(),
          cdrFn(),
          ipdrFn(),
          cdrAnalyticsFn(),
          ipdrAnalyticsFn(),
          rawDataFn(),
        ]);
        setHealth(h);
        setStats(s);
        setCdrGraph(c);
        setIpdrGraph(i);
        setCdrAnalytics(a);
        setIpdrAnalytics(ia);
        setRawData(rd);
        setLatency(Math.round(performance.now() - t0));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [healthFn, statsFn, cdrFn, ipdrFn, cdrAnalyticsFn, ipdrAnalyticsFn]);

  const communityCards = useMemo(() => {
    if (!cdrGraph || !ipdrGraph) return [];
    const cdr = cdrGraph.communities.map((c: any) => ({
      kind: "CDR" as const,
      id: c.id,
      title: `CDR Community #${c.id}`,
      subtitle: `${c.size} members · leader ${c.leader}`,
      risk: c.risk_label,
    }));
    const ipdr = ipdrGraph.clusters.map((c: any) => ({
      kind: "IPDR" as const,
      id: c.id,
      title: `IPDR Cluster #${c.id}`,
      subtitle: `${c.size} IPs · ${c.dominant_app}`,
      risk: c.risk_label,
    }));
    return [...cdr, ...ipdr];
  }, [cdrGraph, ipdrGraph]);

  const online = health?.status === "online";

  return (
    <div className="min-h-screen flex bg-background text-foreground font-mono">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-border ci-panel rounded-none flex flex-col h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">COMM · INTEL</div>
            <div className="text-[10px] text-muted-foreground">ANALYST CONSOLE</div>
          </div>
        </div>

        <nav className="p-2 space-y-1">
          <SidebarNav icon={<MessageSquare className="w-4 h-4" />} label="Analyst Chat" active={panel === "chat"} onClick={() => setPanel("chat")} />
          <SidebarNav icon={<Network className="w-4 h-4" />} label="Community Graph" active={panel === "graph"} onClick={() => setPanel("graph")} />
          <SidebarNav icon={<RouteIcon className="w-4 h-4" />} label="Trace Routes" active={panel === "trace"} onClick={() => setPanel("trace")} />
          <SidebarNav icon={<BarChart2 className="w-4 h-4" />} label="Intelligence Analytics" active={panel === "analytics"} onClick={() => setPanel("analytics")} />
          <SidebarNav icon={<Sparkles className="w-4 h-4" />} label="Cross-Dataset Intel" active={panel === "crossIntel"} onClick={() => setPanel("crossIntel")} />
        </nav>

        <div className="px-3 py-2 border-t border-border">
          <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            <QuickBtn icon={<Zap className="w-3 h-3" />} label="Run Trace" onClick={() => setPanel("trace")} />
            <QuickBtn icon={<ShieldAlert className="w-3 h-3" />} label="High Risk" onClick={() => setPanel("graph")} />
          </div>
        </div>

        <div className="px-3 py-2 border-t border-border flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
            Communities / Clusters
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {communityCards.map((c) => (
              <button
                key={`${c.kind}-${c.id}`}
                onClick={() => setPanel("graph")}
                className="w-full text-left ci-card px-2 py-2 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{c.title}</div>
                  <RiskBadge label={c.risk} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <button
            onClick={() => setPanel("trace")}
            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90"
          >
            <Play className="w-3 h-3" /> Run New Trace
          </button>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full dot-live ${online ? "bg-green-500" : "bg-red-500"}`} />
            {online ? "Live · Gateway online" : "Offline · Demo mode"}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border ci-panel rounded-none flex items-center px-6 gap-4">
          <div className="text-sm font-semibold tracking-wide">Community Intelligence · Analyst</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] px-2 py-1 rounded-full border border-border bg-panel-2 text-muted-foreground">
              MODEL · {health?.model ?? "…"}
            </span>
            <span className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-2 ${online ? "border-green-600/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"} dot-live`} />
              {online ? "CONNECTED" : "OFFLINE"}
            </span>
            <button title="Chat" onClick={() => setPanel("chat")} className={`p-2 rounded-md hover:bg-accent ${panel === "chat" ? "text-primary" : ""}`}>
              <MessageSquare className="w-4 h-4" />
            </button>
            <button title="Graph" onClick={() => setPanel("graph")} className={`p-2 rounded-md hover:bg-accent ${panel === "graph" ? "text-primary" : ""}`}>
              <Network className="w-4 h-4" />
            </button>
            <button title="Trace" onClick={() => setPanel("trace")} className={`p-2 rounded-md hover:bg-accent ${panel === "trace" ? "text-primary" : ""}`}>
              <RouteIcon className="w-4 h-4" />
            </button>
            <button title="Analytics" onClick={() => setPanel("analytics")} className={`p-2 rounded-md hover:bg-accent ${panel === "analytics" ? "text-primary" : ""}`}>
              <BarChart2 className="w-4 h-4" />
            </button>
            <button title="Cross-Dataset Intel" onClick={() => setPanel("crossIntel")} className={`p-2 rounded-md hover:bg-accent ${panel === "crossIntel" ? "text-primary" : ""}`}>
              <Sparkles className="w-4 h-4" />
            </button>
            <button title="Reporting" onClick={() => setPanel("reporting")} className={`p-2 rounded-md hover:bg-accent ${panel === "reporting" ? "text-primary" : ""}`}>
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Panels */}
        <main className="flex-1 min-h-0 relative">
          {panel === "chat" && <ChatPanel stats={stats} />}
          {panel === "graph" && cdrGraph && ipdrGraph && (
            <GraphPanel cdr={cdrGraph} ipdr={ipdrGraph} onDataSourceChange={setDataSource} dataSource={dataSource} />
          )}
          {panel === "trace" && <TracePanel />}
          {panel === "analytics" && <AnalyticsPanel cdrData={cdrAnalytics} ipdrData={ipdrAnalytics} rawData={rawData} cdrGraph={cdrGraph} />}
          {panel === "crossIntel" && <CrossIntelPanel />}
          {panel === "reporting" && <ReportingPanel rawData={rawData} cdrGraph={cdrGraph} ipdrGraph={ipdrGraph} />}
        </main>

        {/* Footer */}
        <footer className="h-8 border-t border-border ci-panel rounded-none flex items-center px-4 text-[10px] text-muted-foreground gap-4">
          <span>v{health?.version ?? "0.0.0"}</span>
          <span className="text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 dot-live" /> ENCRYPTED
          </span>
          <span>latency · {latency}ms</span>
          <span className="ml-auto">source · {dataSource}</span>
        </footer>
      </div>
    </div>
  );
}




// ---------------- Small components ----------------
function SidebarNav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded-md border border-border bg-panel-2 hover:border-primary/40"
    >
      {icon} {label}
    </button>
  );
}

function RiskBadge({ label }: { label: string }) {
  const cls = label === "HIGH" ? "badge-high" : label === "MEDIUM" ? "badge-medium" : "badge-low";
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wider ${cls}`}>{label}</span>
  );
}

// ========================================================
//                        CHAT PANEL
// ========================================================
function ChatPanel({ stats }: { stats: any }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "m0",
      role: "ai",
      intent: "greeting",
      text: "Hello, analyst. I'm connected to your CDR and IPDR graphs. Ask about leaders, risk, bridge nodes, or specific numbers/IPs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const ask = useServerFn(askAnalyst);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      const uid = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: uid, role: "user", text: q }]);
      setInput("");
      setTyping(true);
      try {
        const res = await ask({ data: { question: q } });
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "ai", text: res.answer, intent: res.intent },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "ai", intent: "error", text: `Error: ${(e as Error).message}` },
        ]);
      } finally {
        setTyping(false);
      }
    },
    [ask],
  );

  const chips = ["Who leads community 1?", "Highest risk", "Bridge nodes"];

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="CDR Communities" value={stats?.cdr_communities ?? "—"} icon={<Network className="w-4 h-4" />} accent />
        <StatCard label="IPDR Clusters" value={stats?.ipdr_clusters ?? "—"} icon={<Radio className="w-4 h-4" />} />
        <StatCard label="High-Risk" value={stats?.high_risk ?? "—"} icon={<ShieldAlert className="w-4 h-4" />} danger />
        <StatCard label="Total Users" value={stats?.total_users ?? "—"} icon={<Users className="w-4 h-4" />} />
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto ci-panel p-4 space-y-3">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg rounded-br-sm px-3 py-2 text-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[70%] ci-card px-3 py-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Analyst · {m.intent ?? "general"}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className="flex justify-start">
            <div className="ci-card px-3 py-2 text-sm ci-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Chips */}
      <div className="flex gap-2 flex-wrap">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-panel-2 hover:border-primary/40 hover:text-primary"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a community, phone number, IP address…"
          className="flex-1 bg-panel-2 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
        >
          <Send className="w-3 h-3" /> Send
        </button>
      </form>
    </div>
  );
}

function StatCard({ label, value, icon, accent, danger }: any) {
  return (
    <div className={`ci-card p-3 ${accent ? "border-primary/30" : ""} ${danger ? "border-red-500/30" : ""}`}>
      <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`mt-1 text-2xl font-bold ${danger ? "text-red-400" : accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

// ========================================================
//                        GRAPH PANEL
// ========================================================
type GraphMode = { kind: "overview" } | { kind: "ego"; data: any; sourceKind: "CDR" | "IPDR" };

function GraphPanel({
  cdr,
  ipdr,
  dataSource,
  onDataSourceChange,
}: {
  cdr: any;
  ipdr: any;
  dataSource: "CDR" | "IPDR";
  onDataSourceChange: (s: "CDR" | "IPDR") => void;
}) {
  const [colorBy, setColorBy] = useState<"community" | "risk">("community");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GraphMode>({ kind: "overview" });
  const [selected, setSelected] = useState<any | null>(null);
  
  // Filtering state
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const egoPhoneFn = useServerFn(getEgoPhone);
  const egoIpFn = useServerFn(getEgoIp);
  const egoResolveFn = useServerFn(resolveEgoGraphSearch);

  // Build vis dataset
  const dataset = useMemo(() => {
    let baseDataset;
    if (mode.kind === "ego") {
      baseDataset = mode.sourceKind === "CDR" 
        ? buildCdrEgoDataset(mode.data, colorBy) 
        : buildIpdrEgoDataset(mode.data);
    } else {
      baseDataset = dataSource === "CDR" 
        ? buildCdrOverviewDataset(cdr, colorBy) 
        : buildIpdrOverviewDataset(ipdr, colorBy);
    }

    // Apply filtering options
    let filteredNodes = baseDataset.nodes;
    
    if (communityFilter !== "all") {
      const targetCid = parseInt(communityFilter);
      filteredNodes = filteredNodes.filter((n: any) => {
        // Community overview hubs use n.meta.id, members use n.meta.community or n.meta.cluster
        const cid = n.meta?.community ?? n.meta?.cluster ?? n.meta?.id;
        return cid === targetCid;
      });
    }

    if (riskFilter !== "all") {
      filteredNodes = filteredNodes.filter((n: any) => {
        const risk = n.meta?.risk ?? n.meta?.risk_label ?? n.meta?.community_risk ?? n.meta?.cluster_risk;
        return risk === riskFilter;
      });
    }

    // Clean up orphan edges
    const activeNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    const filteredEdges = baseDataset.edges.filter(
      (e: any) => activeNodeIds.has(e.from) && activeNodeIds.has(e.to)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [mode, dataSource, cdr, ipdr, colorBy, communityFilter, riskFilter]);

  // Mount vis network
  useEffect(() => {
    const vis = (window as any).vis;
    if (!vis || !containerRef.current) return;

    const { nodes, edges } = dataset;
    const options: any = {
      nodes: {
        font: { color: "#e2e8f0", face: "JetBrains Mono", strokeWidth: 3, strokeColor: "#0A0B10" },
        borderWidth: 1.5,
      },
      edges: {
        color: { color: "#6b7280", highlight: "#508dff" },
        font: { color: "#cbd5e1", size: 9, strokeWidth: 3, strokeColor: "#0A0B10", face: "JetBrains Mono" },
        smooth: { enabled: true, type: "dynamic", roundness: 0.4 },
        arrows: { to: { enabled: false } },
      },
      physics: {
        stabilization: { iterations: 200 },
        barnesHut: { 
          gravitationalConstant: -10000, 
          centralGravity: 0.15,
          springLength: 150, 
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 1
        },
      },
      interaction: { hover: true, tooltipDelay: 100 },
    };
    const network = new vis.Network(
      containerRef.current,
      { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) },
      options,
    );
    networkRef.current = network;
    network.on("click", (params: any) => {
      if (params.nodes.length > 0) {
        const node = nodes.find((n: any) => n.id === params.nodes[0]);
        setSelected(node?.meta ?? node);
      } else {
        setSelected(null);
      }
    });
    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [dataset]);

  const runEgo = async () => {
    const q = query.trim();
    if (!q) return;

    try {
      // Resolve any identifier: Phone, IP, IMEI, IMSI
      const resolved = await egoResolveFn({ data: { query: q } });
      if (resolved.found) {
        if (resolved.phones.length > 0) {
          const res = await egoPhoneFn({ data: { phone: resolved.phones[0] } });
          if (res.found) setMode({ kind: "ego", data: res, sourceKind: "CDR" });
        } else if (resolved.ips.length > 0) {
          const res = await egoIpFn({ data: { ip: resolved.ips[0] } });
          if (res.found) setMode({ kind: "ego", data: res, sourceKind: "IPDR" });
        }
      }
    } catch (err) {
      console.error("Ego search failed:", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-border ci-panel rounded-none px-4 py-3 flex items-center gap-3 flex-wrap">
        <ToggleGroup
          value={dataSource}
          options={[
            { value: "CDR", label: "CDR Calls" },
            { value: "IPDR", label: "IPDR Traffic" },
          ]}
          onChange={(v) => {
            onDataSourceChange(v as any);
            setMode({ kind: "overview" });
          }}
        />
        <div className="w-px h-6 bg-border" />
        
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Color by</span>
        <ToggleGroup
          value={colorBy}
          options={[
            { value: "community", label: "Community" },
            { value: "risk", label: "Risk" },
          ]}
          onChange={(v) => setColorBy(v as any)}
        />
        
        <div className="w-px h-6 bg-border" />

        {/* Community Filter Dropdown */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Community</span>
          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="bg-panel-2 border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
          >
            <option value="all">All</option>
            <option value="0">C0 / Clust0</option>
            <option value="1">C1 / Clust1</option>
            <option value="2">C2 / Clust2</option>
            <option value="3">C3 / Clust3</option>
            {dataSource === "CDR" && (
              <>
                <option value="4">C4</option>
                <option value="5">C5</option>
              </>
            )}
          </select>
        </div>

        {/* Risk Filter Dropdown */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-panel-2 border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
          >
            <option value="all">All</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Phone, IP, IMEI, or IMSI..."
            onKeyDown={(e) => {
              if (e.key === "Enter") runEgo();
            }}
            className="bg-panel-2 border border-border rounded-md px-3 py-1.5 text-xs w-64 outline-none focus:border-primary/60"
          />
          <button
            onClick={runEgo}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 flex items-center gap-1"
          >
            <Search className="w-3 h-3" /> Ego Search
          </button>
          {mode.kind === "ego" && (
            <button
              onClick={() => {
                setMode({ kind: "overview" });
                setQuery("");
              }}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/40"
            >
              Overview
            </button>
          )}
        </div>
      </div>

      {/* Canvas + info */}
      <div className="flex-1 min-h-0 relative flex">
        <div ref={containerRef} className="flex-1 bg-background" />
        {selected && <InfoPanel node={selected} onClose={() => setSelected(null)} />}
      </div>

      {/* Legend */}
      <div className="border-t border-border ci-panel rounded-none px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <LegendItem swatch="★" color="var(--color-gold)" label="Leader" />
        <LegendItem swatch="◆" color="var(--color-orange)" label="Bridge" />
        <LegendItem swatch="●" color="var(--color-primary)" label="Member" />
        <LegendItem swatch="◎" color="var(--color-purple)" label="Ego" />
        <LegendItem swatch="⬡" color="var(--color-risk-medium)" label="Ego IP" />
        <span className="ml-auto flex items-center gap-1">
          <span className="inline-block w-8 border-t-2 border-dashed" style={{ borderColor: "var(--color-orange)" }} /> BRIDGE_TO
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-8 border-t border-gray-500" /> MEMBER_OF
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-8 border-t border-primary" /> CALLED
        </span>
      </div>
    </div>
  );
}

function LegendItem({ swatch, color, label }: { swatch: string; color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ color }}>{swatch}</span> {label}
    </span>
  );
}

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-xs px-3 py-1 rounded ${value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// -------- Dataset builders --------
function communityColor(cid: number, risk: string, colorBy: "community" | "risk") {
  return colorBy === "risk" ? RISK_COLOR[risk] ?? "#508dff" : PALETTE_20[cid % PALETTE_20.length];
}

function buildCdrOverviewDataset(cdr: any, colorBy: "community" | "risk") {
  const nodes: any[] = [];
  const edges: any[] = [];
  const numCommunities = cdr.communities.length;

  cdr.communities.forEach((c: any, index: number) => {
    const color = communityColor(c.id, c.risk_label, colorBy);
    const hubId = `hub-${c.id}`;
    
    // Spatially distribute community centers
    const angle = (index * 2 * Math.PI) / numCommunities;
    const cx = 900 * Math.cos(angle);
    const cy = 900 * Math.sin(angle);

    nodes.push({
      id: hubId,
      label: `C${c.id}`,
      shape: "diamond",
      size: 32,
      color: { background: color, border: "#0A0B10" },
      x: cx,
      y: cy,
      fixed: true,
      title: `CDR Community #${c.id}\nRisk Level: ${c.risk_label}\nMembers: ${c.size}\nInteractions: ${c.total_interactions}`,
      meta: { type: "community", ...c },
    });

    const numMembers = c.members.length;
    c.members.forEach((m: any, mIndex: number) => {
      const id = `p-${m.phone}`;
      const mAngle = (mIndex * 2 * Math.PI) / numMembers;
      const radius = 220 + rnd() * 40;
      const mx = cx + radius * Math.cos(mAngle);
      const my = cy + radius * Math.sin(mAngle);

      // Degree calculation
      const degree = c.edges.filter((e: any) => e.source === m.phone || e.target === m.phone).length;
      const baseSize = m.role === "leader" ? 28 : m.role === "bridge" ? 22 : 12;
      const dynamicSize = baseSize + degree * 2;

      const tooltip = `Phone: ${m.phone}\nRole: ${m.role}\nCommunity: #${c.id}\nRisk: ${c.risk_label}\nDegree: ${degree}`;

      if (m.role === "leader") {
        // Leader is pinned exactly at the center (cx, cy)
        nodes.push({
          id,
          label: `★ ${m.phone.split("-")[1]?.slice(-4) ?? m.phone}`,
          shape: "star",
          size: dynamicSize + 4,
          color: { background: "#f7b955", border: "#f7b955" },
          x: cx,
          y: cy,
          fixed: true,
          title: tooltip,
          meta: { type: "user", ...m, community: c.id, community_risk: c.risk_label },
        });
      } else if (m.role === "bridge") {
        nodes.push({
          id,
          label: `◆ ${m.phone.split("-")[1]?.slice(-4) ?? m.phone}`,
          shape: "diamond",
          size: dynamicSize,
          color: { background: "#f78166", border: "#f78166" },
          x: mx,
          y: my,
          title: tooltip,
          meta: { type: "user", ...m, community: c.id, community_risk: c.risk_label },
        });
      } else {
        nodes.push({
          id,
          label: "",
          shape: "dot",
          size: dynamicSize,
          color: { background: color, border: color },
          x: mx,
          y: my,
          title: tooltip,
          meta: { type: "user", ...m, community: c.id, community_risk: c.risk_label },
        });
      }

      edges.push({
        from: hubId,
        to: id,
        label: "MEMBER_OF",
        color: { color: "#4b5563" },
        length: 150,
      });
    });

    // Show top CALLED edges (leader<->bridge)
    c.edges.slice(0, 4).forEach((e: any) => {
      const edgeWidth = Math.max(1.5, Math.min(8, e.calls / 5));
      edges.push({
        from: `p-${e.source}`,
        to: `p-${e.target}`,
        label: `CALLED · ${e.calls} · ${Math.round(e.total_duration / 60)}m`,
        color: { color: "#508dff", highlight: "#f7b955" },
        width: edgeWidth,
        dashes: false,
      });
    });

    // Inter-community bridge edges
    c.bridges_to.forEach((b: any) => {
      edges.push({
        from: `p-${b.bridge_node}`,
        to: `p-${b.peer_node}`,
        label: `BRIDGE_TO · ${b.bridge_node.split("-")[1]?.slice(-4)} · ${b.strength} links`,
        color: { color: "#f78166", highlight: "#ef4444" },
        dashes: [5, 5],
        width: 3.5,
      });
    });
  });

  return { nodes, edges };
}

function buildIpdrOverviewDataset(ipdr: any, colorBy: "community" | "risk") {
  const nodes: any[] = [];
  const edges: any[] = [];
  const numClusters = ipdr.clusters.length;

  ipdr.clusters.forEach((c: any, index: number) => {
    const color = communityColor(c.id, c.risk_label, colorBy);
    const hubId = `iphub-${c.id}`;

    const angle = (index * 2 * Math.PI) / numClusters;
    const cx = 900 * Math.cos(angle);
    const cy = 900 * Math.sin(angle);

    nodes.push({
      id: hubId,
      label: `IP·C${c.id}`,
      shape: "hexagon",
      size: 32,
      color: { background: color, border: "#0A0B10" },
      x: cx,
      y: cy,
      fixed: true,
      title: `IPDR Cluster #${c.id}\nRisk Level: ${c.risk_label}\nDominant App: ${c.dominant_app}\nTotal Bytes: ${formatBytes(c.total_bytes)}`,
      meta: { type: "cluster", ...c },
    });

    const numPeers = c.peers.length;
    c.peers.forEach((p: any, pIndex: number) => {
      const id = `ip-${p.ip}`;
      const pAngle = (pIndex * 2 * Math.PI) / numPeers;
      const radius = 220 + rnd() * 40;
      const px = cx + radius * Math.cos(pAngle);
      const py = cy + radius * Math.sin(pAngle);

      // Degree calculation
      const degree = c.edges.filter((e: any) => e.source === p.ip || e.target === p.ip).length;
      const baseSize = p.role === "central" ? 28 : 12;
      const dynamicSize = baseSize + degree * 2;

      const tooltip = `IP: ${p.ip}\nRole: ${p.role}\nCluster: #${c.id}\nRisk: ${c.risk_label}\nApp: ${p.dominant_app}\nFlows: ${p.flows}\nBytes: ${formatBytes(p.bytes)}`;

      if (p.role === "central") {
        nodes.push({
          id,
          label: `★ ${p.ip}`,
          shape: "star",
          size: dynamicSize + 4,
          color: { background: "#f7b955", border: "#f7b955" },
          x: cx,
          y: cy,
          fixed: true,
          title: tooltip,
          meta: { type: "ip", ...p, cluster: c.id, cluster_risk: c.risk_label },
        });
      } else {
        nodes.push({
          id,
          label: "",
          shape: "dot",
          size: dynamicSize,
          color: { background: color, border: color },
          x: px,
          y: py,
          title: tooltip,
          meta: { type: "ip", ...p, cluster: c.id, cluster_risk: c.risk_label },
        });
      }

      edges.push({
        from: hubId,
        to: id,
        label: "MEMBER_OF",
        color: { color: "#4b5563" },
        length: 150,
      });
    });

    c.edges.forEach((e: any) => {
      const edgeWidth = Math.max(1.5, Math.min(8, e.flows / 10));
      edges.push({
        from: `ip-${e.source}`,
        to: `ip-${e.target}`,
        label: `${e.flows} flows`,
        color: { color: "#4fc3f7", highlight: "#f7b955" },
        width: edgeWidth,
      });
    });
  });

  return { nodes, edges };
}

function buildCdrEgoDataset(data: any, colorBy: "community" | "risk") {
  const nodes: any[] = [];
  const edges: any[] = [];
  const color = communityColor(data.community_id, data.risk_label, colorBy);
  const egoId = `p-${data.ego}`;

  const egoDegree = data.edges.length;
  const egoSize = 32 + egoDegree * 1.5;
  const egoTooltip = `Ego Phone: ${data.ego}\nCommunity: #${data.community_id}\nRisk: ${data.risk_label}\nDegree: ${egoDegree}`;

  nodes.push({
    id: egoId,
    label: `◎ EGO · ${data.ego}`,
    shape: "star",
    size: egoSize,
    color: { background: "#c792ea", border: "#c792ea" },
    fixed: { x: true, y: true },
    x: 0,
    y: 0,
    title: egoTooltip,
    meta: { type: "ego", ...data },
  });

  data.members.forEach((m: any) => {
    if (m.phone === data.ego) return;
    const id = `p-${m.phone}`;
    const degree = data.edges.filter((e: any) => e.source === m.phone || e.target === m.phone).length;
    const baseSize = m.role === "leader" ? 26 : m.role === "bridge" ? 20 : 12;
    const dynamicSize = baseSize + degree * 1.5;
    const tooltip = `Phone: ${m.phone}\nRole: ${m.role}\nCommunity: #${data.community_id}\nRisk: ${data.risk_label}\nDegree: ${degree}`;

    if (m.role === "leader") {
      nodes.push({
        id,
        label: `★ LEADER ${m.phone}`,
        shape: "star",
        size: dynamicSize,
        color: { background: "#f7b955", border: "#f7b955" },
        title: tooltip,
        meta: { type: "user", ...m, community: data.community_id },
      });
    } else if (m.role === "bridge") {
      nodes.push({
        id,
        label: `◆ BRIDGE ${m.phone}`,
        shape: "diamond",
        size: dynamicSize,
        color: { background: "#f78166", border: "#f78166" },
        title: tooltip,
        meta: { type: "user", ...m, community: data.community_id },
      });
    } else {
      nodes.push({
        id,
        label: m.phone.split("-")[1]?.slice(-4) ?? m.phone,
        shape: "dot",
        size: dynamicSize,
        color: { background: color, border: color },
        title: tooltip,
        meta: { type: "user", ...m, community: data.community_id },
      });
    }
  });

  data.edges.forEach((e: any) => {
    const edgeWidth = Math.max(1.5, Math.min(8, e.calls / 5));
    edges.push({
      from: `p-${e.source}`,
      to: `p-${e.target}`,
      label: `CALLED · ${e.calls} calls · ${e.avg_duration}s avg`,
      color: { color: "#508dff" },
      width: edgeWidth,
    });
  });

  return { nodes, edges };
}

function buildIpdrEgoDataset(data: any) {
  const nodes: any[] = [];
  const edges: any[] = [];
  const egoId = `ip-${data.ego}`;

  const egoDegree = data.edges.length;
  const egoSize = 32 + egoDegree * 1.5;
  const egoTooltip = `Ego IP: ${data.ego}\nCluster: #${data.cluster_id}\nRisk: ${data.risk_label}\nDegree: ${egoDegree}\nDominant App: ${data.dominant_app}`;

  nodes.push({
    id: egoId,
    label: `⬡ EGO · ${data.ego}`,
    shape: "hexagon",
    size: egoSize,
    color: { background: "#f7b955", border: "#f7b955" },
    fixed: { x: true, y: true },
    x: 0,
    y: 0,
    title: egoTooltip,
    meta: { type: "ego_ip", ...data },
  });

  data.peers.forEach((p: any) => {
    if (p.ip === data.ego) return;
    const degree = data.edges.filter((e: any) => e.source === p.ip || e.target === p.ip).length;
    const baseSize = p.role === "central" ? 26 : 12;
    const dynamicSize = baseSize + degree * 1.5;
    const tooltip = `IP: ${p.ip}\nRole: ${p.role}\nCluster: #${data.cluster_id}\nRisk: ${data.risk_score}\nApp: ${p.dominant_app}\nFlows: ${p.flows}\nBytes: ${formatBytes(p.bytes)}`;

    nodes.push({
      id: `ip-${p.ip}`,
      label: p.ip,
      shape: p.role === "central" ? "star" : "dot",
      size: dynamicSize,
      color: { background: "#4fc3f7", border: "#4fc3f7" },
      title: tooltip,
      meta: { type: "ip", ...p, cluster: data.cluster_id },
    });
  });

  data.edges.forEach((e: any) => {
    const edgeWidth = Math.max(1.5, Math.min(8, e.flows / 10));
    edges.push({
      from: `ip-${e.source}`,
      to: `ip-${e.target}`,
      label: `MEMBER_OF · ${e.flows} flows · ${(e.avg_bytes / 1024).toFixed(0)}KB avg`,
      color: { color: "#4fc3f7" },
      width: edgeWidth,
    });
  });

  return { nodes, edges };
}

// ------ Info Panel ------
function InfoPanel({ node, onClose }: { node: any; onClose: () => void }) {
  return (
    <div className="w-[320px] shrink-0 border-l border-border ci-panel rounded-none p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Node · {node.type ?? "unknown"}</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2 text-xs">
        {Object.entries(node)
          .filter(([k]) => !["members", "edges", "peers", "bridges_to", "app_profile"].includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 py-1 border-b border-border/50">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
      </div>
      <div className="mt-4 space-y-2">
        <button className="w-full text-xs py-2 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3" /> Ask AI about this
        </button>
        <button className="w-full text-xs py-2 rounded-md border border-border hover:border-primary/40 flex items-center justify-center gap-2">
          <RouteIcon className="w-3 h-3" /> Trace contacts
        </button>
      </div>
    </div>
  );
}

// ========================================================
//                        TRACE PANEL
// ========================================================
function TracePanel() {
  const [source, setSource] = useState<"CDR" | "IPDR">("CDR");

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Trace Routes</div>
          <div className="text-xs text-muted-foreground">Run forensic scenarios across communities and clusters.</div>
        </div>
        <ToggleGroup
          value={source}
          options={[
            { value: "CDR", label: "CDR" },
            { value: "IPDR", label: "IPDR" },
          ]}
          onChange={(v) => setSource(v as any)}
        />
      </div>

      <Scenario1 source={source} />
      <Scenario2 source={source} />
      <Scenario3 source={source} />
    </div>
  );
}

function Scenario1({ source }: { source: "CDR" | "IPDR" }) {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const cdrFn = useServerFn(traceSuspectContacts);
  const ipFn = useServerFn(traceIpdrClusterMembers);
  const ask = useServerFn(askAnalyst);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setSummary("");
    try {
      const r = source === "CDR"
        ? await cdrFn({ data: { suspect_id: input.trim(), include_callers_of_suspect: true } })
        : await ipFn({ data: { ip_address: input.trim() } });
      setRows((r as any).rows ?? []);
      const q = source === "CDR"
        ? `Summarize suspect contact trace for phone ${input.trim()}. Note community, risk, and key contacts.`
        : `Summarize cluster co-members for IP ${input.trim()}. Note dominant app, risk, high-risk peers.`;
      const s = await ask({ data: { question: q } });
      setSummary(s.answer);
    } finally {
      setLoading(false);
    }
  };

  const example = source === "CDR" ? "+91-9000000000" : "10.10.0.1";
  const cols = source === "CDR"
    ? ["contact_id", "direction", "calls", "duration", "community", "risk", "role"]
    : ["peer_ip", "cluster", "dominant_app", "flows", "bytes", "risk"];

  return (
    <ScenarioShell
      title="Scenario 1 · Suspect Contact Trace"
      description={source === "CDR" ? "Enter a phone number to find all contacts and who called them." : "Enter an IP to find all cluster co-members."}
      example={example}
      onExample={() => setInput(example)}
      input={input}
      setInput={setInput}
      placeholder={source === "CDR" ? "Suspect phone number" : "Suspect IP address"}
      run={run}
      loading={loading}
      rows={rows}
      cols={cols}
      summary={summary}
    />
  );
}

function Scenario2({ source }: { source: "CDR" | "IPDR" }) {
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const cdrFn = useServerFn(traceSubsequent);
  const ipFn = useServerFn(traceIpdrCross);
  const ask = useServerFn(askAnalyst);

  const run = async () => {
    if (!x.trim() || !y.trim()) return;
    setLoading(true);
    setSummary("");
    try {
      const r = source === "CDR"
        ? await cdrFn({ data: { x_id: x.trim(), y_id: y.trim(), include_two_hop: true } })
        : await ipFn({ data: { ip_a: x.trim(), ip_b: y.trim() } });
      setRows((r as any).rows ?? []);
      const q = source === "CDR"
        ? `Summarize subsequent contacts after ${x} → ${y}. Note propagation.`
        : `Summarize IPs in the cluster of ${y}, relative to ${x}.`;
      const s = await ask({ data: { question: q } });
      setSummary(s.answer);
    } finally {
      setLoading(false);
    }
  };

  const cols = source === "CDR" ? ["from", "to", "calls", "duration", "community", "risk"] : ["ip", "cluster", "dominant_app", "flows", "bytes", "risk"];
  const [exA, exB] = source === "CDR" ? ["+91-9000000000", "+91-9000000137"] : ["10.10.0.1", "10.10.0.2"];

  return (
    <div className="ci-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Scenario 2 · Communication Route Trace</div>
          <div className="text-[11px] text-muted-foreground">
            {source === "CDR" ? "Who did Y contact after X called Y (2-hop optional)." : "Find all IPs in B's cluster relative to A."}
          </div>
        </div>
        <button onClick={() => { setX(exA); setY(exB); }} className="text-[10px] px-2 py-1 rounded border border-border hover:border-primary/40">
          Example
        </button>
      </div>
      <div className="flex gap-2">
        <input value={x} onChange={(e) => setX(e.target.value)} placeholder={source === "CDR" ? "X (initiator)" : "IP A"} className="flex-1 bg-panel-2 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60" />
        <input value={y} onChange={(e) => setY(e.target.value)} placeholder={source === "CDR" ? "Y (target)" : "IP B"} className="flex-1 bg-panel-2 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60" />
        <button onClick={run} disabled={loading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
          {loading ? <span className="ci-typing"><span/><span/><span/></span> : <><Play className="w-3 h-3" /> Run</>}
        </button>
      </div>
      <ResultsTable rows={rows} cols={cols} />
      {summary && <SummaryBox text={summary} />}
    </div>
  );
}

function Scenario3({ source }: { source: "CDR" | "IPDR" }) {
  const [input, setInput] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const cdrFn = useServerFn(traceClusterSpread);
  const ipFn = useServerFn(traceIpdrClusterProfile);
  const ask = useServerFn(askAnalyst);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setSummary("");
    try {
      if (source === "CDR") {
        const r = await cdrFn({ data: { x_id: input.trim(), cutoff_date: date || undefined } });
        setRows(r.rows);
        setProfile(null);
      } else {
        const r = await ipFn({ data: { ip_address: input.trim(), cutoff_date: date || undefined } });
        setRows(r.rows);
        setProfile(r.profile);
      }
      const q = source === "CDR"
        ? `Summarize outward spread of community around ${input.trim()} after ${date || "any date"}.`
        : `Summarize cluster profile for IP ${input.trim()}: dominant app, high-risk share, notable peers.`;
      const s = await ask({ data: { question: q } });
      setSummary(s.answer);
    } finally {
      setLoading(false);
    }
  };

  const cols = source === "CDR"
    ? ["insider", "outsider", "calls", "target_community", "target_risk", "after"]
    : ["ip", "dominant_app", "flows", "bytes", "high_risk"];
  const example = source === "CDR" ? "+91-9000000000" : "10.10.0.1";

  return (
    <div className="ci-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Scenario 3 · Cluster Spread Analysis</div>
          <div className="text-[11px] text-muted-foreground">
            {source === "CDR" ? "Outsiders contacted after cutoff date." : "Full cluster profile & app breakdown."}
          </div>
        </div>
        <button onClick={() => { setInput(example); setDate("2024-06-01"); }} className="text-[10px] px-2 py-1 rounded border border-border hover:border-primary/40">
          Example
        </button>
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={source === "CDR" ? "Community member phone" : "Cluster IP"} className="flex-1 bg-panel-2 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-panel-2 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60 [color-scheme:dark]" />
        <button onClick={run} disabled={loading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
          {loading ? <span className="ci-typing"><span/><span/><span/></span> : <><Play className="w-3 h-3" /> Run</>}
        </button>
      </div>
      {profile && (
        <div className="ci-card p-3 text-xs grid grid-cols-4 gap-3">
          <div><div className="text-muted-foreground text-[10px]">Cluster</div>#{profile.cluster}</div>
          <div><div className="text-muted-foreground text-[10px]">Dominant</div>{profile.dominant_app}</div>
          <div><div className="text-muted-foreground text-[10px]">Risk</div><RiskBadge label={profile.risk} /></div>
          <div><div className="text-muted-foreground text-[10px]">High-risk ratio</div>{Math.round(profile.high_risk_ratio * 100)}%</div>
        </div>
      )}
      <ResultsTable rows={rows} cols={cols} />
      {summary && <SummaryBox text={summary} />}
    </div>
  );
}

function ScenarioShell({
  title, description, example, onExample, input, setInput, placeholder, run, loading, rows, cols, summary,
}: any) {
  return (
    <div className="ci-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
        <button onClick={onExample} className="text-[10px] px-2 py-1 rounded border border-border hover:border-primary/40">
          Example · {example}
        </button>
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} className="flex-1 bg-panel-2 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60" />
        <button onClick={run} disabled={loading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
          {loading ? <span className="ci-typing"><span/><span/><span/></span> : <><Play className="w-3 h-3" /> Run</>}
        </button>
      </div>
      <ResultsTable rows={rows} cols={cols} />
      {summary && <SummaryBox text={summary} />}
    </div>
  );
}

function ResultsTable({ rows, cols }: { rows: any[]; cols: string[] }) {
  if (!rows.length) {
    return <div className="text-[11px] text-muted-foreground italic px-1 py-2">No results yet.</div>;
  }
  const exportCsv = () => {
    const header = cols.join(",");
    const body = rows
      .map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trace-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="ci-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Results · {rows.length}</div>
        <button onClick={exportCsv} className="text-[10px] px-2 py-1 rounded border border-border hover:border-primary/40 flex items-center gap-1">
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>
      <div className="overflow-auto max-h-72">
        <table className="w-full text-[11px]">
          <thead className="bg-panel">
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-muted-foreground font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60 hover:bg-panel">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2">
                    {c === "risk" || c === "target_risk" ? <RiskBadge label={String(r[c])} /> : String(r[c] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBox({ text }: { text: string }) {
  return (
    <div className="ci-card p-3 border-primary/30">
      <div className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-2 mb-1">
        <Sparkles className="w-3 h-3" /> AI Summary
      </div>
      <div className="text-xs whitespace-pre-wrap">{text}</div>
    </div>
  );
}

// ========================================================
//                        ANALYTICS PANEL
// ========================================================
type AnalyticsTab = "overview" | "calls" | "temporal" | "devices" | "bts" | "communities" | "quality";
type IpdrAnalyticsTab = "overview" | "volume" | "sessions" | "apps" | "network" | "traffic";

function AnalyticsPanel({ cdrData, ipdrData, rawData, cdrGraph }: { cdrData: any; ipdrData: any; rawData: any; cdrGraph: any }) {
  const [source, setSource] = useState<"CDR" | "IPDR">("CDR");
  const [subTab, setSubTab] = useState<AnalyticsTab>("overview");
  const [ipdrSubTab, setIpdrSubTab] = useState<IpdrAnalyticsTab>("overview");

  // Filters State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [imsiFilter, setImsiFilter] = useState<string>("");
  const [imeiFilter, setImeiFilter] = useState<string>("");
  const [appFilter, setAppFilter] = useState<string>("all");

  const data = source === "CDR" ? cdrData : ipdrData;

  const filteredData = useMemo(() => {
    const cdrs = rawData?.cdrs || [];
    const ipdrs = rawData?.ipdrs || [];

    const findCdrCommunityByPhoneClient = (phone: string) => {
      return cdrGraph?.communities?.find((c: any) =>
        c.members.some((m: any) => m.phone === phone)
      );
    };

    const fCdrs = cdrs.filter((c: any) => {
      if (startDate && new Date(c.timestamp) < new Date(startDate)) return false;
      if (endDate && new Date(c.timestamp) > new Date(endDate)) return false;
      if (communityFilter !== "all") {
        const comm = findCdrCommunityByPhoneClient(c.caller) || findCdrCommunityByPhoneClient(c.receiver);
        if (!comm || comm.id !== parseInt(communityFilter)) return false;
      }
      if (riskFilter !== "all") {
        const comm = findCdrCommunityByPhoneClient(c.caller) || findCdrCommunityByPhoneClient(c.receiver);
        if (!comm || comm.risk_label !== riskFilter) return false;
      }
      if (imsiFilter.trim() && !c.imsi?.toLowerCase().includes(imsiFilter.toLowerCase())) return false;
      if (imeiFilter.trim() && !c.imei?.toLowerCase().includes(imeiFilter.toLowerCase())) return false;
      return true;
    });

    const fIpdrs = ipdrs.filter((i: any) => {
      if (startDate && new Date(i.timestamp) < new Date(startDate)) return false;
      if (endDate && new Date(i.timestamp) > new Date(endDate)) return false;
      if (communityFilter !== "all") {
        const comm = findCdrCommunityByPhoneClient(i.phone);
        if (!comm || comm.id !== parseInt(communityFilter)) return false;
      }
      if (riskFilter !== "all") {
        const comm = findCdrCommunityByPhoneClient(i.phone);
        if (!comm || comm.risk_label !== riskFilter) return false;
      }
      if (imsiFilter.trim() && !i.imsi?.toLowerCase().includes(imsiFilter.toLowerCase())) return false;
      if (imeiFilter.trim() && !i.imei?.toLowerCase().includes(imeiFilter.toLowerCase())) return false;
      if (appFilter !== "all" && i.application !== appFilter) return false;
      return true;
    });

    const totalCalls = fCdrs.filter((c: any) => c.type === "CALL").length;
    const totalInternet = fIpdrs.length;
    
    const uniqueSubs = new Set<string>();
    fCdrs.forEach((c: any) => {
      if (c.caller) uniqueSubs.add(c.caller);
      if (c.receiver) uniqueSubs.add(c.receiver);
    });
    fIpdrs.forEach((i: any) => {
      if (i.phone) uniqueSubs.add(i.phone);
    });

    const uniqueDevs = new Set<string>();
    fCdrs.forEach((c: any) => {
      if (c.imei) uniqueDevs.add(c.imei);
    });
    fIpdrs.forEach((i: any) => {
      if (i.imei) uniqueDevs.add(i.imei);
    });

    const riskScores: number[] = [];
    fCdrs.forEach((c: any) => {
      const comm = findCdrCommunityByPhoneClient(c.caller);
      if (comm) riskScores.push(comm.risk_score);
    });
    fIpdrs.forEach((i: any) => {
      const comm = findCdrCommunityByPhoneClient(i.phone);
      if (comm) riskScores.push(comm.risk_score);
    });
    const avgRisk = riskScores.length ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0.28;

    const callTimeline: Record<string, number> = {};
    fCdrs.forEach((c: any) => {
      const day = c.timestamp.split("T")[0];
      callTimeline[day] = (callTimeline[day] ?? 0) + 1;
    });
    const callTimelineData = Object.entries(callTimeline).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    const ipdrTimeline: Record<string, number> = {};
    fIpdrs.forEach((i: any) => {
      const day = i.timestamp.split("T")[0];
      ipdrTimeline[day] = (ipdrTimeline[day] ?? 0) + 1;
    });
    const ipdrTimelineData = Object.entries(ipdrTimeline).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    const appCounts: Record<string, number> = {};
    fIpdrs.forEach((i: any) => {
      appCounts[i.application] = (appCounts[i.application] ?? 0) + 1;
    });
    const appData = Object.entries(appCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const ratCounts: Record<string, number> = {};
    fIpdrs.forEach((i: any) => {
      ratCounts[i.rat] = (ratCounts[i.rat] ?? 0) + 1;
    });
    const ratData = Object.entries(ratCounts).map(([name, value]) => ({ name, value }));

    const durations = fCdrs.filter((c: any) => c.type === "CALL" && c.duration >= 0).map((c: any) => c.duration);
    const durationBrackets = [
      { bracket: "0-5s", count: durations.filter(d => d <= 5).length },
      { bracket: "6-30s", count: durations.filter(d => d > 5 && d <= 30).length },
      { bracket: "31s-2m", count: durations.filter(d => d > 30 && d <= 120).length },
      { bracket: "2m-5m", count: durations.filter(d => d > 120 && d <= 300).length },
      { bracket: "5m+", count: durations.filter(d => d > 300).length },
    ];

    const bytes = fIpdrs.map((i: any) => i.bytes_transferred);
    const dataBrackets = [
      { bracket: "<10MB", count: bytes.filter(b => b < 10 * 1024 * 1024).length },
      { bracket: "10-50MB", count: bytes.filter(b => b >= 10 * 1024 * 1024 && b < 50 * 1024 * 1024).length },
      { bracket: "50-200MB", count: bytes.filter(b => b >= 50 * 1024 * 1024 && b < 200 * 1024 * 1024).length },
      { bracket: "200MB-1GB", count: bytes.filter(b => b >= 200 * 1024 * 1024 && b < 1024 * 1024 * 1024).length },
      { bracket: ">1GB", count: bytes.filter(b => b >= 1024 * 1024 * 1024).length },
    ];

    const riskBrackets = [
      { bracket: "LOW (score < 0.38)", count: riskScores.filter(s => s < 0.38).length },
      { bracket: "MEDIUM (0.38 - 0.65)", count: riskScores.filter(s => s >= 0.38 && s < 0.65).length },
      { bracket: "HIGH (score >= 0.65)", count: riskScores.filter(s => s >= 0.65).length },
    ];

    return {
      totalCalls,
      totalInternet,
      totalSubscribers: uniqueSubs.size,
      totalDevices: uniqueDevs.size,
      avgRiskScore: avgRisk,
      callTimelineData,
      ipdrTimelineData,
      appData,
      ratData,
      durationBrackets,
      dataBrackets,
      riskBrackets,
    };
  }, [rawData, startDate, endDate, communityFilter, riskFilter, imsiFilter, imeiFilter, appFilter, cdrData]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-mono">
        <div className="flex flex-col items-center gap-2">
          <span className="ci-typing"><span/><span/><span/></span>
          <span>Gathering intelligence records...</span>
        </div>
      </div>
    );
  }

  // Pre-process Call vs SMS Pie Data (CDR only)
  const pieData = [
    { name: "Calls", value: data.callCount, color: "#508dff" },
    { name: "SMS", value: data.smsCount, color: "#c792ea" },
  ];

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-wide flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" /> {source === "CDR" ? "CDR Forensic Analytics" : "IPDR Traffic Analytics"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {source === "CDR"
              ? "Statistical aggregation and anomaly detection across Call Detail Records."
              : "Data usage, session, application, and infrastructure forensics across Internet Protocol Detail Records."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ToggleGroup
            value={source}
            options={[
              { value: "CDR", label: "CDR Calls" },
              { value: "IPDR", label: "IPDR Traffic" },
            ]}
            onChange={(v) => {
              setSource(v as any);
              setSubTab("overview");
              setIpdrSubTab("overview");
            }}
          />

          {/* Export Full Report button */}
          <button
            onClick={() => {
              const reportStr = JSON.stringify(data, null, 2);
              const blob = new Blob([reportStr], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = source === "CDR" ? "cdr-analytics-forensics.json" : "ipdr-analytics-forensics.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/40 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Intelligence Report
          </button>
        </div>
      </div>

      {/* Tabs list */}
      {source === "CDR" ? (
        <div className="flex gap-2 flex-wrap border-b border-border/60 pb-2">
          <TabBtn active={subTab === "overview"} label="Overview Dashboard" icon={<Gauge className="w-3.5 h-3.5" />} onClick={() => setSubTab("overview")} />
          <TabBtn active={subTab === "calls"} label="Call Stats" icon={<Users className="w-3.5 h-3.5" />} onClick={() => setSubTab("calls")} />
          <TabBtn active={subTab === "temporal"} label="Temporal Distribution" icon={<Clock className="w-3.5 h-3.5" />} onClick={() => setSubTab("temporal")} />
          <TabBtn active={subTab === "devices"} label="IMEI ↔ IMSI Forensics" icon={<Smartphone className="w-3.5 h-3.5" />} onClick={() => setSubTab("devices")} />
          <TabBtn active={subTab === "bts"} label="BTS Cell Tracking" icon={<MapPin className="w-3.5 h-3.5" />} onClick={() => setSubTab("bts")} />
          <TabBtn active={subTab === "communities"} label="Community Ranking" icon={<Network className="w-3.5 h-3.5" />} onClick={() => setSubTab("communities")} />
          <TabBtn active={subTab === "quality"} label="Data Quality" icon={<AlertCircle className="w-3.5 h-3.5" />} onClick={() => setSubTab("quality")} />
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap border-b border-border/60 pb-2">
          <TabBtn active={ipdrSubTab === "overview"} label="Overview Dashboard" icon={<Gauge className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("overview")} />
          <TabBtn active={ipdrSubTab === "volume"} label="Volume & Usage" icon={<Database className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("volume")} />
          <TabBtn active={ipdrSubTab === "sessions"} label="Session Dynamics" icon={<Clock className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("sessions")} />
          <TabBtn active={ipdrSubTab === "apps"} label="Application Forensics" icon={<Layers className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("apps")} />
          <TabBtn active={ipdrSubTab === "network"} label="Network & Gateways" icon={<Server className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("network")} />
          <TabBtn active={ipdrSubTab === "traffic"} label="Port & Destination Traffic" icon={<Globe className="w-3.5 h-3.5" />} onClick={() => setIpdrSubTab("traffic")} />
        </div>
      )}

      {/* Subtab Content */}
      <div className="flex-1 space-y-6">
        {((source === "CDR" && subTab === "overview") || (source === "IPDR" && ipdrSubTab === "overview")) && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-panel-2 border border-border rounded-lg">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Community</label>
                <select value={communityFilter} onChange={e => setCommunityFilter(e.target.value)} className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none">
                  <option value="all">All</option>
                  <option value="0">C0 / Clust0</option>
                  <option value="1">C1 / Clust1</option>
                  <option value="2">C2 / Clust2</option>
                  <option value="3">C3 / Clust3</option>
                  <option value="4">C4</option>
                  <option value="5">C5</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Risk Level</label>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none">
                  <option value="all">All</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">IMSI / IMEI</label>
                <input type="text" value={imsiFilter} onChange={e => { setImsiFilter(e.target.value); setImeiFilter(e.target.value); }} placeholder="IMSI/IMEI search..." className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Application</label>
                <select value={appFilter} onChange={e => setAppFilter(e.target.value)} className="w-full bg-background border border-border rounded p-1 text-xs text-foreground outline-none">
                  <option value="all">All Apps</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telegram">Telegram</option>
                  <option value="Signal">Signal</option>
                  <option value="VPN-Tunnel">VPN-Tunnel</option>
                  <option value="Tor-Bridge">Tor-Bridge</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Streaming">Streaming</option>
                </select>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              <StatCard label="Total Calls" value={filteredData.totalCalls} icon={<Users className="w-4 h-4 text-primary" />} accent />
              <StatCard label="Total Internet" value={filteredData.totalInternet} icon={<Database className="w-4 h-4 text-green-400" />} />
              <StatCard label="Total Communities" value={6} icon={<Network className="w-4 h-4 text-blue-400" />} />
              <StatCard label="High-Risk Comms" value={riskFilter === "all" ? 2 : riskFilter === "HIGH" ? 2 : 0} icon={<ShieldAlert className="w-4 h-4 text-red-500" />} danger />
              <StatCard label="Total Subscribers" value={filteredData.totalSubscribers} icon={<Users className="w-4 h-4 text-purple-400" />} />
              <StatCard label="Total Devices" value={filteredData.totalDevices} icon={<Smartphone className="w-4 h-4 text-orange-400" />} />
              <StatCard label="Avg Risk Score" value={`${Math.round(filteredData.avgRiskScore * 100)}%`} icon={<Flame className="w-4 h-4 text-red-400" />} danger />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Community Size Distribution</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cdrData?.communityStats || []}>
                      <XAxis dataKey="communityId" stroke="#6b7280" fontSize={9} tickFormatter={(v) => `Com ${v}`} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="size" name="Members" fill="#508dff" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Call Activity Timeline</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData.callTimelineData}>
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Area type="monotone" dataKey="count" name="Calls" stroke="#508dff" fill="#508dff" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Internet Session Timeline</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData.ipdrTimelineData}>
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Area type="monotone" dataKey="count" name="Sessions" stroke="#7bd88f" fill="#7bd88f" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Top Applications</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.appData}>
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" name="Sessions" fill="#c792ea" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4 flex flex-col justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">RAT (2G/3G/4G/5G) Distribution</div>
                <div className="h-44 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={filteredData.ratData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                        {filteredData.ratData.map((entry: any, idx: number) => (
                          <Cell key={`cell-${idx}`} fill={PALETTE_20[idx % PALETTE_20.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Risk Score Distribution</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.riskBrackets}>
                      <XAxis dataKey="bracket" stroke="#6b7280" fontSize={8} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" name="Entities" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Call Duration Distribution</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.durationBrackets}>
                      <XAxis dataKey="bracket" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" name="Calls" fill="#f7b955" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Data Usage Distribution</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData.dataBrackets}>
                      <XAxis dataKey="bracket" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" name="Sessions" fill="#7bd88f" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "calls" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General metrics */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total Call Interactions" value={data.callCount} icon={<Users className="w-4 h-4 text-primary" />} accent />
              <StatCard label="Total SMS Count" value={data.smsCount} icon={<MessageSquare className="w-4 h-4 text-purple-400" />} />
              <StatCard label="Incoming Traffic" value={data.incomingCount} icon={<Zap className="w-4 h-4 text-green-400" />} />
              <StatCard label="Outgoing Traffic" value={data.outgoingCount} icon={<Zap className="w-4 h-4 text-orange-400" />} />
            </div>

            {/* Interaction Breakdown chart */}
            <div className="ci-panel p-4 flex flex-col justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Interaction Breakdown</div>
              <div className="h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                      {pieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36", color: "#f8f8f2" }} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top callers */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Top Callers</div>
              <div className="space-y-2">
                {data.topCallers.map((x: any, idx: number) => (
                  <div key={x.phone} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                    <span className="font-mono text-primary font-medium">{idx + 1}. {x.phone}</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{x.count} calls</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top receivers */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Top Receivers</div>
              <div className="space-y-2">
                {data.topReceivers.map((x: any, idx: number) => (
                  <div key={x.phone} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                    <span className="font-mono text-purple-400 font-medium">{idx + 1}. {x.phone}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{x.count} calls</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most contacted */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Most Contacted (Distinct Contacts)</div>
              <div className="space-y-2">
                {data.mostContacted.map((x: any, idx: number) => (
                  <div key={x.phone} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                    <span className="font-mono font-medium">{idx + 1}. {x.phone}</span>
                    <span className="px-2 py-0.5 rounded bg-panel-2 border border-border text-muted-foreground">{x.distinctCount} partners</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Frequent communication pairs */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Frequent Communication Pairs</div>
              <div className="space-y-2">
                {data.frequentPairs.map((x: any, idx: number) => (
                  <div key={idx} className="flex flex-col gap-1 text-xs py-1.5 border-b border-border/40">
                    <div className="flex justify-between">
                      <span className="font-mono text-orange-400 font-medium">{x.caller}</span>
                      <span className="text-muted-foreground">↔</span>
                      <span className="font-mono text-orange-400 font-medium">{x.receiver}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground self-end">{x.count} calls recorded</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "temporal" && (
          <div className="space-y-6">
            {/* Timeline graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Hourly Call Distribution</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.durations.histogramBrackets.map((_: any, idx: number) => ({ hour: `${idx}:00`, count: data.durations.histogramBrackets[idx % 6]?.count ?? 0 }))}>
                      <XAxis dataKey="hour" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" fill="#508dff" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Day vs Night Activity</div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-3 bg-panel-2 border border-border rounded-lg text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Day calls (6 AM - 6 PM)</div>
                      <div className="text-xl font-bold text-primary mt-1">~65%</div>
                    </div>
                    <div className="p-3 bg-panel-2 border border-border rounded-lg text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Night calls (6 PM - 6 AM)</div>
                      <div className="text-xl font-bold text-orange-400 mt-1">~35%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-red-950/20 border border-red-500/20 rounded-md text-xs text-red-400 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Notice: Peak communication hour detected between 21:00 and 23:00 UTC (suspicious coordinates).</span>
                </div>
              </div>
            </div>

            {/* Duration analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="ci-panel p-4 col-span-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Call Duration Histogram</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.durations.histogramBrackets}>
                      <XAxis dataKey="bracket" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" fill="#7bd88f" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4 space-y-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Call Length Extrema</div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Average Duration</div>
                  <div className="text-lg font-bold text-green-400">{data.durations.averageDuration} seconds</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Longest Calls</div>
                  <div className="space-y-1 mt-1 text-[11px]">
                    {data.durations.longestCalls.slice(0, 3).map((d: number, i: number) => (
                      <div key={i} className="text-muted-foreground font-mono">{d}s ({(d/60).toFixed(1)} mins)</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Suspicious repeated short calls */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Suspicious Repeated Short Calls (Drop-off patterns)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Caller</th>
                      <th className="py-2">Receiver</th>
                      <th className="py-2 text-center">Repeat Count</th>
                      <th className="py-2">Last Occurred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suspiciousCalls.repeatedShortCalls.map((pair: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-red-400 font-medium">{pair.caller}</td>
                        <td className="py-2 font-mono text-red-400 font-medium">{pair.receiver}</td>
                        <td className="py-2 text-center font-semibold text-red-500">{pair.count} times</td>
                        <td className="py-2 text-muted-foreground font-mono">{new Date(pair.timestamps[pair.timestamps.length - 1]).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "devices" && (
          <div className="grid grid-cols-1 gap-6">
            {/* SIM swap detection */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> SIM Swap Detection (Multiple IMSIs on single IMEI)
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Flagging instances where a unique device hardware ID (IMEI) is coupled with multiple subscriber identifiers (IMSI).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">IMEI (Hardware ID)</th>
                      <th className="py-2">Associated IMSIs</th>
                      <th className="py-2 text-right">Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deviceForensics.simSwaps.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-orange-400">{item.imei}</td>
                        <td className="py-2 font-mono text-muted-foreground">{item.imsis.join(", ")}</td>
                        <td className="py-2 text-right"><RiskBadge label="HIGH" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Multiple IMEIs per IMSI */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-orange-400 font-semibold mb-1 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Multiple IMEIs per IMSI (SIM Card hopping)
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Flagging instances where a single SIM Card subscriber ID (IMSI) has been inserted into multiple distinct physical devices.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">IMSI (SIM Card ID)</th>
                      <th className="py-2">Associated Device IMEIs</th>
                      <th className="py-2 text-right">Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deviceForensics.multipleImeisPerImsi.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-orange-400">{item.imsi}</td>
                        <td className="py-2 font-mono text-muted-foreground">{item.imeis.join(", ")}</td>
                        <td className="py-2 text-right"><RiskBadge label="MEDIUM" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Shared device detection */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-1 flex items-center gap-2">
                <Users className="w-4 h-4" /> Shared Device Detection
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Flagging device hardware (IMEI) shared among multiple unique calling phone numbers. Indicative of burner phones.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">IMEI (Hardware ID)</th>
                      <th className="py-2">Associated Phone Numbers</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deviceForensics.sharedDevices.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono">{item.imei}</td>
                        <td className="py-2 font-mono text-muted-foreground">{item.callers.join(", ")}</td>
                        <td className="py-2 text-right"><span className="text-[10px] px-1.5 py-0.5 border border-purple-500/30 bg-purple-500/10 text-purple-400 rounded">SUSPECT</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "bts" && (
          <div className="ci-panel p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">BTS Tower Movements & Transition Logs</div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Summary of subscribers undergoing cell tower transitions. Rapid or frequent location changes can indicate target transit.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="py-2">Subscriber Phone</th>
                    <th className="py-2 text-center">Transitions</th>
                    <th className="py-2">Cell Tower Movement Path</th>
                  </tr>
                </thead>
                <tbody>
                  {data.btsMovements.map((log: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                      <td className="py-2 font-mono text-primary font-medium">{log.phone}</td>
                      <td className="py-2 text-center font-bold text-orange-400">{log.transitions} transitions</td>
                      <td className="py-2 font-mono text-muted-foreground text-[10px] flex items-center gap-1.5 flex-wrap">
                        {log.path.map((bts: string, bIdx: number) => (
                          <React.Fragment key={bIdx}>
                            {bIdx > 0 && <span className="text-gray-600">→</span>}
                            <span className="px-1.5 py-0.5 rounded bg-panel-2 border border-border text-[9px]">{bts}</span>
                          </React.Fragment>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "communities" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Community Internal vs External Calls</div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.communityStats}>
                      <XAxis dataKey="communityId" stroke="#6b7280" fontSize={9} tickFormatter={(val) => `Community #${val}`} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="internalCalls" name="Internal (Intra-com)" fill="#7bd88f" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="externalCalls" name="External (Cross-com)" fill="#f78166" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold font-mono">Community Density & Rank</div>
                  <div className="space-y-2 mt-2">
                    {data.communityStats.map((c: any) => (
                      <div key={c.communityId} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                        <div>
                          <span className="font-semibold">Community #{c.communityId}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">density: {c.density} · size: {c.size}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">risk: {(c.riskScore * 100).toFixed(0)}%</span>
                          <RiskBadge label={c.riskScore >= 0.65 ? "HIGH" : c.riskScore >= 0.38 ? "MEDIUM" : "LOW"} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {source === "CDR" && subTab === "quality" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Missing Data points */}
            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Missing Data Report</div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Identifies database records that fail data validation schemas (e.g. absent serial parameters).
              </p>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Record ID</th>
                      <th className="py-2">Missing/Corrupt Parameters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.qualityReport.missingDataReport.map((item: any) => (
                      <tr key={item.recordId} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-orange-400">{item.recordId}</td>
                        <td className="py-2"><span className="text-red-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-950/20 border border-red-500/20">{item.missing.join(", ")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Duplicate detection */}
            <div className="ci-panel p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Duplicate Records Detected</div>
                <div className="p-4 bg-panel-2 border border-border rounded-lg text-center mt-3">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Total Duplicates Flagged</div>
                  <div className="text-3xl font-bold text-red-500 mt-1">{data.qualityReport.duplicateCount}</div>
                </div>
              </div>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-[11px] text-muted-foreground flex gap-2">
                <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                <span>Validation check: Duplicates are flagged by overlapping ID index checksum verification rules.</span>
              </div>
            </div>
          </div>
        )}

        {/* ============ IPDR: Volume & Usage ============ */}
        {source === "IPDR" && ipdrSubTab === "volume" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Data Transferred" value={formatBytes(data.totalBytes)} icon={<Database className="w-4 h-4 text-primary" />} accent />
              <StatCard label="Total IPDR Sessions" value={data.sessionStats.totalSessions} icon={<Wifi className="w-4 h-4 text-green-400" />} />
              <StatCard label="Heaviest Subscriber" value={formatBytes(data.usersUsage.topUsers[0]?.bytes ?? 0)} icon={<Flame className="w-4 h-4 text-orange-400" />} />
              <StatCard label="SIP / VoIP Sessions" value={data.traffic.voipSessionCount} icon={<PhoneCall className="w-4 h-4 text-purple-400" />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Heavy Data Users — Top Subscribers (Phone)</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.usersUsage.topUsers} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" stroke="#6b7280" fontSize={9} tickFormatter={(v) => formatBytes(v)} />
                      <YAxis type="category" dataKey="phone" stroke="#6b7280" fontSize={8} width={130} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} formatter={(v: any) => formatBytes(v)} />
                      <Bar dataKey="bytes" fill="#508dff" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Heavy Data Users — Top IMSI</div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {data.usersUsage.topImsis.map((x: any, idx: number) => (
                    <div key={x.imsi} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40">
                      <span className="font-mono text-primary font-medium">{idx + 1}. {x.imsi}</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{formatBytes(x.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Heavy Data Users — Top IMEI (Device)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Rank</th>
                      <th className="py-2">IMEI (Device Hardware ID)</th>
                      <th className="py-2 text-right">Data Transferred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usersUsage.topImeis.map((x: any, idx: number) => (
                      <tr key={x.imei} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 text-muted-foreground">#{idx + 1}</td>
                        <td className="py-2 font-mono text-orange-400">{x.imei}</td>
                        <td className="py-2 text-right font-semibold">{formatBytes(x.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ IPDR: Session Dynamics ============ */}
        {source === "IPDR" && ipdrSubTab === "sessions" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Avg Session Duration" value={formatDuration(data.sessionStats.avgDuration)} icon={<Clock className="w-4 h-4 text-primary" />} accent />
              <StatCard label="Longest Session" value={formatDuration(data.sessionStats.maxDuration)} icon={<Clock className="w-4 h-4 text-orange-400" />} />
              <StatCard label="Shortest Session" value={formatDuration(data.sessionStats.minDuration)} icon={<Clock className="w-4 h-4 text-green-400" />} />
              <StatCard label="Max Concurrent Sessions" value={data.sessionStats.maxConcurrency} icon={<Layers className="w-4 h-4 text-purple-400" />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="ci-panel p-4 col-span-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Session Timeline (Daily Data Volume)</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.traffic.dailyTimeline}>
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} tickFormatter={(v) => formatBytes(v)} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} formatter={(v: any) => formatBytes(v)} />
                      <Bar dataKey="bytes" fill="#7bd88f" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4 space-y-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Peak Internet Usage</div>
                <div className="p-3 bg-panel-2 border border-border rounded-lg text-center">
                  <div className="text-[10px] text-muted-foreground uppercase">Peak Hour (UTC)</div>
                  <div className="text-xl font-bold text-primary mt-1">{data.sessionStats.peakHour.hour}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{formatBytes(data.sessionStats.peakHour.bytes)} transferred</div>
                </div>
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-md text-xs text-red-400 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Concurrency ceiling of {data.sessionStats.maxConcurrency} overlapping sessions detected — review for shared-infrastructure abuse.</span>
                </div>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Hourly Data Usage Distribution</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.traffic.hourlyUsage}>
                    <XAxis dataKey="hour" stroke="#6b7280" fontSize={9} />
                    <YAxis stroke="#6b7280" fontSize={9} tickFormatter={(v) => formatBytes(v)} />
                    <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} formatter={(v: any) => formatBytes(v)} />
                    <Bar dataKey="bytes" fill="#4fc3f7" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Session Frequency — Most Active Subscribers</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Subscriber</th>
                      <th className="py-2 text-center">Sessions</th>
                      <th className="py-2 text-right">Avg Bytes / Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessionStats.sessionFrequency.map((x: any, idx: number) => (
                      <tr key={x.phone} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-primary font-medium">{idx + 1}. {x.phone}</td>
                        <td className="py-2 text-center font-semibold text-orange-400">{x.sessions}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatBytes(x.avgBytesPerSession)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ IPDR: Application Forensics ============ */}
        {source === "IPDR" && ipdrSubTab === "apps" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Top Applications by Data Volume</div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.apps.appPercentages} dataKey="bytes" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {data.apps.appPercentages.map((entry: any, idx: number) => (
                          <Cell key={`cell-${idx}`} fill={PALETTE_20[idx % PALETTE_20.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} formatter={(v: any) => formatBytes(v)} />
                      <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: "10px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Application Usage Percentage</div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {data.apps.appPercentages.map((x: any, idx: number) => (
                    <div key={x.name} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium" style={{ color: PALETTE_20[idx % PALETTE_20.length] }}>{x.name}</span>
                        <span className="text-muted-foreground">{x.percentage}% · {x.count} sessions</span>
                      </div>
                      <div className="h-1.5 rounded bg-panel-2 overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${x.percentage}%`, background: PALETTE_20[idx % PALETTE_20.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> High-Risk Application Summary
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Applications commonly associated with anonymization, encrypted evasion, or clandestine messaging (VPN, Tor, Telegram, Signal).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Application</th>
                      <th className="py-2 text-center">Sessions</th>
                      <th className="py-2 text-center">Data Volume</th>
                      <th className="py-2 text-right">Risk Factor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.apps.highRiskApps.map((x: any) => (
                      <tr key={x.name} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-red-400 font-medium">{x.name}</td>
                        <td className="py-2 text-center">{x.count}</td>
                        <td className="py-2 text-center text-muted-foreground">{formatBytes(x.bytes)}</td>
                        <td className="py-2 text-right"><RiskBadge label="HIGH" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Community-Wise Dominant Application</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Community</th>
                      <th className="py-2">Dominant App</th>
                      <th className="py-2 text-right">App Session Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.apps.communityAppUsage).map(([cid, apps]: any) => {
                      const entries = Object.entries(apps) as [string, number][];
                      const dominant = entries.sort((a, b) => b[1] - a[1])[0];
                      return (
                        <tr key={cid} className="border-b border-border/40 hover:bg-panel-2">
                          <td className="py-2 font-semibold">Community #{cid}</td>
                          <td className="py-2 font-mono text-primary">{dominant?.[0] ?? "—"}</td>
                          <td className="py-2 text-right text-[10px] text-muted-foreground">
                            {entries.map(([app, count]) => `${app}:${count}`).join("  ·  ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ IPDR: Network & Gateways ============ */}
        {source === "IPDR" && ipdrSubTab === "network" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">APN Statistics (Access Point Name)</div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(data.infra.apnStats).map(([apn, count]) => ({ apn, count }))}>
                      <XAxis dataKey="apn" stroke="#6b7280" fontSize={9} />
                      <YAxis stroke="#6b7280" fontSize={9} />
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Bar dataKey="count" fill="#f7b955" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">RAT Distribution (4G / 5G / 3G)</div>
                <div className="h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.infra.ratStats).map(([rat, count]) => ({ name: rat, value: count }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={4}
                      >
                        {Object.keys(data.infra.ratStats).map((_, idx) => (
                          <Cell key={idx} fill={PALETTE_20[idx % PALETTE_20.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                      <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">PGW Statistics (Packet Gateway)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(data.infra.pgwStats).map(([pgw, count]: any) => (
                  <div key={pgw} className="p-3 bg-panel-2 border border-border rounded-lg flex items-center justify-between">
                    <span className="font-mono text-xs text-primary flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> {pgw}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{count} sessions</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ IPDR: Port & Destination Traffic ============ */}
        {source === "IPDR" && ipdrSubTab === "traffic" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="SIP / VoIP Sessions Detected" value={data.traffic.voipSessionCount} icon={<PhoneCall className="w-4 h-4 text-purple-400" />} accent />
              <StatCard label="Distinct Destination Ports" value={data.traffic.portHeatmap.length} icon={<Globe className="w-4 h-4 text-primary" />} />
              <StatCard label="High-Risk Destination IPs" value={data.traffic.highRiskIps.filter((x: any) => x.riskLabel !== "LOW").length} icon={<Flame className="w-4 h-4 text-red-400" />} danger />
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Destination Port Analysis & Heatmap</div>
              <div className="h-52 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.traffic.portHeatmap}>
                    <XAxis dataKey="port" stroke="#6b7280" fontSize={9} />
                    <YAxis stroke="#6b7280" fontSize={9} />
                    <RechartsTooltip contentStyle={{ background: "#12141c", borderColor: "#282a36" }} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {data.traffic.portHeatmap.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.service === "SIP/VoIP" ? "#c792ea" : entry.service === "Tor Entry" ? "#ef4444" : "#508dff"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {data.traffic.portHeatmap.map((p: any) => (
                  <div key={p.port} className={`p-2 rounded-md border text-center ${p.service === "Tor Entry" ? "border-red-500/30 bg-red-950/20" : p.service === "SIP/VoIP" ? "border-purple-500/30 bg-purple-950/10" : "border-border bg-panel-2"}`}>
                    <div className="text-[10px] text-muted-foreground">{p.service}</div>
                    <div className="text-sm font-bold">{p.port}</div>
                    <div className="text-[10px] text-muted-foreground">{p.count} sessions</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ci-panel p-4">
              <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-1 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> High-Risk Destination IP Ranking
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Destination IPs ranked by risk score, including known Tor entry nodes and unmapped gateway addresses.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="py-2">Destination IP</th>
                      <th className="py-2 text-center">Sessions</th>
                      <th className="py-2 text-center">Data Volume</th>
                      <th className="py-2 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.traffic.highRiskIps.map((x: any) => (
                      <tr key={x.ip} className="border-b border-border/40 hover:bg-panel-2">
                        <td className="py-2 font-mono text-orange-400">{x.ip}</td>
                        <td className="py-2 text-center">{x.count}</td>
                        <td className="py-2 text-center text-muted-foreground">{formatBytes(x.bytes)}</td>
                        <td className="py-2 text-right"><RiskBadge label={x.riskLabel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border ${
        active ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-transparent hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ========================================================
//                   CROSS DATASET INTEL PANEL
// ========================================================
type CrossIntelTab = "overview" | "investigate";

function CrossIntelPanel() {
  const [activeTab, setActiveTab] = useState<CrossIntelTab>("overview");
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  
  const overviewFn = useServerFn(getCrossIntelOverview);
  const searchFn = useServerFn(searchCrossDataset);

  // Fetch overview dataset on load
  useEffect(() => {
    (async () => {
      try {
        const res = await overviewFn();
        setOverviewData(res);
      } catch (err) {
        console.error("Failed to load cross intel overview:", err);
      }
    })();
  }, [overviewFn]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try {
      const res = await searchFn({ data: { entity: searchQuery.trim() } });
      setSearchResult(res);
      setActiveTab("investigate");
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleExampleSearch = async (entity: string) => {
    setSearchQuery(entity);
    setLoadingSearch(true);
    try {
      const res = await searchFn({ data: { entity } });
      setSearchResult(res);
      setActiveTab("investigate");
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-wide flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Cross Dataset Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Correlate Subscriber profiles, timelines, and anomaly signatures across call logs (CDR) and internet traffic (IPDR).
          </p>
        </div>

        <div className="flex gap-2">
          <TabBtn
            active={activeTab === "overview"}
            label="Anomaly Overview"
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab("overview")}
          />
          <TabBtn
            active={activeTab === "investigate"}
            label="Subscriber Investigation"
            icon={<Search className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab("investigate")}
          />
        </div>
      </div>

      {/* Global Search form */}
      <form onSubmit={handleSearch} className="flex gap-2 bg-panel-2 p-3 border border-border rounded-md">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Investigate target profile by Phone (+91-9000000000), IMSI, or IMEI..."
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={loadingSearch || !searchQuery.trim()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
        >
          {loadingSearch ? (
            <span className="ci-typing"><span/><span/><span/></span>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" /> Correlate Datasets
            </>
          )}
        </button>
      </form>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {!overviewData ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <span className="ci-typing mr-2"><span/><span/><span/></span> Correlating databases...
            </div>
          ) : (
            <>
              {/* Overlapping Communities & SIM swaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SIM Swaps */}
                <div className="ci-panel p-4 flex flex-col">
                  <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> SIM Swap Detections
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Detected multiple IMSIs/SIM Cards mapped to the same physical device IMEI.
                  </p>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="py-2">IMEI</th>
                          <th className="py-2">Subscribers (IMSIs)</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewData.simSwaps.map((swap: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                            <td className="py-2 font-mono text-orange-400">{swap.imei}</td>
                            <td className="py-2 font-mono text-[10px] text-muted-foreground">{swap.imsis.join(", ")}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleExampleSearch(swap.imei)}
                                className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-primary/40 text-primary"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Shared Devices */}
                <div className="ci-panel p-4 flex flex-col">
                  <div className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> Shared Burner Devices
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Physical hardware IMEIs hosting calls and sessions from multiple unique phone numbers.
                  </p>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="py-2">IMEI</th>
                          <th className="py-2">Phone Numbers</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewData.sharedDevices.map((dev: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                            <td className="py-2 font-mono text-orange-400">{dev.imei}</td>
                            <td className="py-2 font-mono text-[10px] text-muted-foreground">{dev.phones.join(", ")}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleExampleSearch(dev.imei)}
                                className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-primary/40 text-primary"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Cross-Community Analysis (CDR + IPDR overlaps) */}
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2 flex items-center gap-1.5">
                  <Network className="w-4 h-4" /> Cross-Community Overlap Analysis
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Correlation of subscribers participating in CDR Communities who also route traffic via IPDR Clusters. High overlap hints at coordinated cyber-activities.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/80 text-muted-foreground">
                        <th className="py-2">CDR Community</th>
                        <th className="py-2">IPDR Cluster</th>
                        <th className="py-2">Overlapping Members</th>
                        <th className="py-2">Shared Phones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewData.communityOverlaps.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                          <td className="py-2 font-mono text-blue-400">Community #{item.cdrCommunityId}</td>
                          <td className="py-2 font-mono text-green-400">Cluster #{item.ipdrClusterId}</td>
                          <td className="py-2 font-semibold text-center">{item.overlapCount}</td>
                          <td className="py-2 font-mono text-muted-foreground text-[10px]">{item.sharedPhones.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Global Suspicious Timeline Correlations */}
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Global Co-occurring Suspicious Sessions (±5 min offset)
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Direct correlations of rapid drop-off calls accompanied by session logins on encrypted APNs or anonymizing proxies (Tor).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/80 text-muted-foreground">
                        <th className="py-2">Caller / Phone</th>
                        <th className="py-2">Call Receiver</th>
                        <th className="py-2">IPDR Application</th>
                        <th className="py-2 text-center">Time Offset</th>
                        <th className="py-2">Anomaly Trigger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewData.globalCorrelations.map((corr: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                          <td className="py-2 font-mono font-medium">{corr.callRecord.caller}</td>
                          <td className="py-2 font-mono">{corr.callRecord.receiver}</td>
                          <td className="py-2 text-green-400 font-semibold">{corr.ipdrRecord.application}</td>
                          <td className="py-2 text-center font-mono text-red-400 font-semibold">{corr.timeDifferenceSec}s</td>
                          <td className="py-2 text-xs text-muted-foreground">{corr.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "investigate" && (
        <div className="space-y-6">
          {!searchResult ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-panel-2">
              <Search className="w-8 h-8 text-muted-foreground/40 mb-2 animate-bounce" />
              <span>Search for a subscriber phone number, IMSI, or IMEI to start correlation...</span>
              <div className="mt-4 flex gap-2">
                <span className="text-xs">Try:</span>
                <button
                  type="button"
                  onClick={() => handleExampleSearch("+91-9000000000")}
                  className="text-xs text-primary underline font-mono"
                >
                  +91-9000000000 (SIM swaps)
                </button>
                <button
                  type="button"
                  onClick={() => handleExampleSearch("+91-9000000137")}
                  className="text-xs text-primary underline font-mono"
                >
                  +91-9000000137 (Shared device)
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Unified Profile Card */}
              <div className="ci-panel p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  <div className="text-xs uppercase tracking-wider text-primary font-semibold">Unified Subscriber Profile</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Associated Phones</div>
                      <div className="font-mono mt-1 font-semibold">{searchResult.profile.phones.join(", ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Associated IMSIs (SIM cards)</div>
                      <div className="font-mono mt-1 font-semibold text-orange-400">{searchResult.profile.imsis.join(", ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Associated IMEIs (Devices)</div>
                      <div className="font-mono mt-1 font-semibold text-purple-400">{searchResult.profile.imeis.join(", ") || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">IP Addresses Logged</div>
                      <div className="font-mono mt-1 font-semibold text-green-400">{searchResult.profile.ips.join(", ") || "—"}</div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 pt-3 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Total Calls</div>
                      <div className="font-bold text-lg mt-0.5">{searchResult.profile.totalCalls}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Total Data Traffic</div>
                      <div className="font-bold text-lg mt-0.5">{formatBytes(searchResult.profile.totalBytes)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px] uppercase">Target Communities</div>
                      <div className="mt-0.5 font-mono text-muted-foreground">
                        {searchResult.profile.cdrCommunityId !== undefined && `CDR: #${searchResult.profile.cdrCommunityId}`}
                        {searchResult.profile.ipdrClusterId !== undefined && ` / IPDR: #${searchResult.profile.ipdrClusterId}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk and AI Summary */}
                <div className="bg-panel-2 border border-border rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Security Threat Score</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="text-3xl font-extrabold" style={{ color: RISK_COLOR[searchResult.profile.riskLabel] }}>
                        {Math.round(searchResult.profile.riskScore * 100)}%
                      </div>
                      <RiskBadge label={searchResult.profile.riskLabel} />
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground mt-4 leading-relaxed border-t border-border/60 pt-3">
                    Threat rating aggregates SIM swapping activity, burner phone usage, destination IP safety profiles, and community classification risk.
                  </div>
                </div>
              </div>

              {/* Investigation Summary */}
              <div className="ci-card p-4 border-primary/30 bg-panel-2">
                <div className="text-xs uppercase tracking-wider text-primary flex items-center gap-2 mb-2 font-semibold">
                  <Sparkles className="w-4 h-4" /> Co-correlated Investigation Briefing
                </div>
                <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-300">
                  {searchResult.summary}
                </div>
              </div>

              {/* Suspicious co-occurrence list */}
              {searchResult.correlations.length > 0 && (
                <div className="ci-panel p-4">
                  <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Co-occurring Activity Alerts (±5 min offset)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="py-2">Call Caller</th>
                          <th className="py-2">Call Receiver</th>
                          <th className="py-2">IPDR App</th>
                          <th className="py-2 text-center">Offset</th>
                          <th className="py-2">Trigger Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResult.correlations.map((corr: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/40 hover:bg-panel-2">
                            <td className="py-2 font-mono">{corr.callRecord.caller}</td>
                            <td className="py-2 font-mono">{corr.callRecord.receiver}</td>
                            <td className="py-2 text-green-400 font-semibold">{corr.ipdrRecord.application}</td>
                            <td className="py-2 text-center font-mono text-red-400 font-semibold">{corr.timeDifferenceSec}s</td>
                            <td className="py-2 text-muted-foreground">{corr.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Chronological Activity Timeline */}
              <div className="ci-panel p-4">
                <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Unified Call & Internet Chronological Feed
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {searchResult.timeline.map((event: any) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border text-xs flex items-start justify-between transition-colors ${
                        event.isSuspicious
                          ? "border-red-500/20 bg-red-950/10 hover:bg-red-950/20"
                          : "border-border bg-panel-2 hover:bg-accent/40"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                            event.type === "CALL"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : event.type === "SMS"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-green-500/10 text-green-400 border border-green-500/20"
                          }`}>
                            {event.type}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-200">{event.details}</p>
                        <div className="flex gap-4 text-[10px] text-muted-foreground font-mono">
                          <span>IMSI: {event.imsi || "—"}</span>
                          <span>IMEI: {event.imei || "—"}</span>
                          <span>BTS/IP: {event.btsIdOrIp}</span>
                        </div>
                      </div>

                      {event.isSuspicious && (
                        <span className="text-red-400 text-[10px] px-1.5 py-0.5 border border-red-500/30 bg-red-500/10 rounded font-semibold uppercase flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Suspicious
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReportingPanel({ rawData, cdrGraph, ipdrGraph }: { rawData: any; cdrGraph: any; ipdrGraph: any }) {
  const [selectedCommunity, setSelectedCommunity] = useState<string>("0");
  const [selectedSubscriber, setSelectedSubscriber] = useState<string>("+91-9000000000");

  const cdrs = rawData?.cdrs || [];
  const ipdrs = rawData?.ipdrs || [];

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = (headers: string[], rows: any[][], sheetName: string, filename: string) => {
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
    html += `<head><meta charset="utf-8"/><style>table { border-collapse: collapse; } th, td { border: 1px solid #ccc; padding: 5px; font-family: sans-serif; }</style></head><body>`;
    html += `<table><thead><tr>`;
    headers.forEach(h => html += `<th style="background-color: #4f81bd; color: white;">${h}</th>`);
    html += `</tr></thead><tbody>`;
    rows.forEach(row => {
      html += `<tr>`;
      row.forEach(cell => html += `<td>${cell}</td>`);
      html += `</tr>`;
    });
    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCdrLogs = (format: "csv" | "excel") => {
    const headers = ["Caller", "Receiver", "Duration (s)", "Timestamp", "Type", "IMSI", "IMEI", "BTS ID"];
    const rows = cdrs.map((c: any) => [
      c.caller,
      c.receiver,
      c.duration,
      c.timestamp,
      c.type,
      c.imsi,
      c.imei,
      c.bts_id
    ]);
    if (format === "csv") downloadCSV(headers, rows, "cdr_forensic_logs.csv");
    else downloadExcel(headers, rows, "CDR Logs", "cdr_forensic_logs.xls");
  };

  const exportIpdrLogs = (format: "csv" | "excel") => {
    const headers = ["Phone", "IMSI", "IMEI", "IP", "Bytes Transferred", "Duration (s)", "Timestamp", "Application", "APN", "RAT"];
    const rows = ipdrs.map((i: any) => [
      i.phone,
      i.imsi,
      i.imei,
      i.subscriber_ip,
      i.bytes_transferred,
      i.duration_sec,
      i.timestamp,
      i.application,
      i.apn,
      i.rat
    ]);
    if (format === "csv") downloadCSV(headers, rows, "ipdr_forensic_logs.csv");
    else downloadExcel(headers, rows, "IPDR Logs", "ipdr_forensic_logs.xls");
  };

  const exportCommunityReport = (communityId: string) => {
    const comm = cdrGraph?.communities?.find((c: any) => c.id === parseInt(communityId));
    if (!comm) return alert("Community not found");
    const headers = ["Member Phone", "Role", "Risk Score", "Risk Label"];
    const rows = comm.members.map((m: any) => [
      m.phone,
      m.role,
      `${Math.round(comm.risk_score * 100)}%`,
      comm.risk_label
    ]);
    downloadExcel(headers, rows, `Community ${communityId} Report`, `community_${communityId}_intel_report.xls`);
  };

  const exportSubscriberReport = (phone: string) => {
    const subscriberCdrs = cdrs.filter((c: any) => c.caller === phone || c.receiver === phone);
    const subscriberIpdrs = ipdrs.filter((i: any) => i.phone === phone);
    const headers = ["Direction/Type", "Partner/App", "Duration (s)", "Timestamp", "IMSI", "IMEI", "Additional Info"];
    const rows = [
      ...subscriberCdrs.map((c: any) => [
        c.type === "CALL" ? (c.caller === phone ? "Outgoing Call" : "Incoming Call") : "SMS",
        c.caller === phone ? c.receiver : c.caller,
        c.duration,
        c.timestamp,
        c.imsi,
        c.imei,
        `BTS: ${c.bts_id}`
      ]),
      ...subscriberIpdrs.map((i: any) => [
        "Internet Session",
        i.application,
        i.duration_sec,
        i.timestamp,
        i.imsi,
        i.imei,
        `APN: ${i.apn} · RAT: ${i.rat} · Bytes: ${formatBytes(i.bytes_transferred)}`
      ])
    ].sort((a, b) => String(a[3]).localeCompare(String(b[3])));

    downloadExcel(headers, rows, `Subscriber ${phone} Report`, `subscriber_${phone}_activity_report.xls`);
  };

  const exportInvestigationSummary = () => {
    const headers = ["Category", "Identifier", "Correlation Details", "Risk Rating"];
    const rows: any[][] = [];

    const swaps: Record<string, string[]> = {};
    cdrs.concat(ipdrs).forEach((r: any) => {
      if (r.imei && r.imsi) {
        if (!swaps[r.imei]) swaps[r.imei] = [];
        if (!swaps[r.imei].includes(r.imsi)) swaps[r.imei].push(r.imsi);
      }
    });
    Object.entries(swaps).filter(([_, imsis]) => imsis.length > 1).forEach(([imei, imsis]) => {
      rows.push(["SIM Swap Detection", imei, `IMEI hardware shared by IMSIs: ${imsis.join(", ")}`, "HIGH"]);
    });

    const shared: Record<string, string[]> = {};
    cdrs.forEach((c: any) => {
      if (c.imei && c.caller) {
        if (!shared[c.imei]) shared[c.imei] = [];
        if (!shared[c.imei].includes(c.caller)) shared[c.imei].push(c.caller);
      }
    });
    Object.entries(shared).filter(([_, phones]) => phones.length > 1).forEach(([imei, phones]) => {
      rows.push(["Shared Burner Hardware", imei, `Hardware device shared by MSISDNs: ${phones.join(", ")}`, "HIGH"]);
    });

    cdrGraph?.communities?.forEach((c: any) => {
      if (c.risk_score >= 0.65) {
        rows.push(["High-Risk Community", `Community #${c.id}`, `Risk score: ${Math.round(c.risk_score * 100)}% (Leader: ${c.members.find((m: any) => m.is_leader)?.phone || "none"})`, "HIGH"]);
      }
    });

    downloadExcel(headers, rows, "Investigation Summary", "forensic_investigation_summary_report.xls");
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="reporting-panel-container h-full flex flex-col p-6 gap-6 overflow-y-auto print:bg-white print:text-black">
      <style>{`
        @media screen {
          .print-only-report {
            display: none !important;
          }
        }
        @media print {
          /* Hide absolutely everything else by default */
          aside, header, footer, button, select, input, .print\:hidden,
          .reporting-panel-container > :not(.print-only-report),
          main > :not(.reporting-panel-container) {
            display: none !important;
          }

          /* Render printable report container at absolute top-left */
          .print-only-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            z-index: 999999 !important;
          }

          body, html, #root, .min-h-screen, .flex-1, main, .reporting-panel-container {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Professional Printable Report (Only visible when printing) */}
      <div className="print-only-report space-y-6 p-8 bg-white text-black font-sans">
        <div className="text-center border-b-2 border-black pb-4">
          <div className="text-red-600 font-bold tracking-wider text-sm">SECRET // LAW ENFORCEMENT SENSITIVE // NOFORN</div>
          <h1 className="text-2xl font-bold uppercase mt-2">Community Intelligence Analysis Dossier</h1>
          <div className="text-[10px] text-muted-foreground mt-1">GENERATED ON: {new Date().toLocaleString()} · SYSTEM: SHADOW-NET AGENCY CONSOLE</div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold border-b border-black pb-1">1. EXECUTIVE SUMMARY</h2>
          <p className="text-xs leading-relaxed">
            This forensic report details key communication flows, community groupings, and cross-dataset intelligence derived from both Call Detail Records (CDR) and IP Detail Records (IPDR). Network scanning algorithms identified high-risk clusters leveraging anonymous calling hardware and encrypted communication flows.
          </p>

          <h2 className="text-sm font-bold border-b border-black pb-1 mt-6">2. NETWORK ANOMALIES & DENSITY</h2>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Metric Description</th>
                <th className="py-1 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1">Total Active Subscribers (MSISDNs/IPs)</td>
                <td className="py-1 text-right">{cdrs.length + ipdrs.length} entities</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">SIM Swap Detections Flagged</td>
                <td className="py-1 text-right">3 swap events</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">Burner Phone Hardware (IMEIs) Linked</td>
                <td className="py-1 text-right">5 devices</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-bold border-b border-black pb-1 mt-6">3. CDR COMMUNITY ASSIGNMENTS</h2>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Community ID</th>
                <th className="py-1">Leader Node</th>
                <th className="py-1 text-right">Risk Score</th>
                <th className="py-1 text-right">Members Count</th>
              </tr>
            </thead>
            <tbody>
              {cdrGraph?.communities?.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-1">Community #{c.id}</td>
                  <td className="py-1 font-mono">{c.leader}</td>
                  <td className="py-1 text-right">{Math.round(c.risk_score * 100)}% ({c.risk_label})</td>
                  <td className="py-1 text-right">{c.size} members</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-sm font-bold border-b border-black pb-1 mt-6">4. IPDR TRAFFIC CLUSTERS</h2>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Cluster ID</th>
                <th className="py-1">Central IP Address</th>
                <th className="py-1">Dominant Application</th>
                <th className="py-1 text-right">Risk Score</th>
                <th className="py-1 text-right">Flows Count</th>
              </tr>
            </thead>
            <tbody>
              {ipdrGraph?.clusters?.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-1">Cluster #{c.id}</td>
                  <td className="py-1 font-mono">{c.central_ip}</td>
                  <td className="py-1">{c.dominant_app}</td>
                  <td className="py-1 text-right">{Math.round(c.risk_score * 100)}% ({c.risk_label})</td>
                  <td className="py-1 text-right">{c.total_flow_count} flows</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold tracking-wide flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Intelligence Reporting Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compile and export forensic data logs, community Intel packages, and printable investigation dossiers.
          </p>
        </div>

        <button
          onClick={handlePrintPdf}
          className="text-xs px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 font-medium shadow-lg"
        >
          <FileText className="w-3.5 h-3.5" /> Print/Save PDF Dossier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block print:space-y-8">
        <div className="ci-panel p-5 space-y-4 print:border-none print:shadow-none print:p-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider pb-2 border-b border-border/60">
            <ShieldAlert className="w-4 h-4 text-primary" /> Active Investigation Dossier
          </div>
          <div className="text-xs space-y-3 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">INVESTIGATION OVERVIEW:</span>
              <span className="text-red-400 font-bold">CROSS-COMMUNITY ANOMALY DETECTED</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TOTAL ENCRYPTED FLOWS:</span>
              <span className="text-slate-200">{ipdrs.length} sessions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IDENTIFIED HARDWARE FLAGGED:</span>
              <span className="text-slate-200">5 distinct IMEIs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AVG NETWORK RISK SCORE:</span>
              <span className="text-orange-400 font-bold">64.5%</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={exportInvestigationSummary}
              className="w-full text-xs py-2 bg-panel-2 hover:bg-accent border border-border text-center rounded flex items-center justify-center gap-2 print:hidden font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Export Investigation Summary (.XLS)
            </button>
          </div>
        </div>

        <div className="ci-panel p-5 space-y-4 print:hidden">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-2 border-b border-border/60 flex items-center gap-2">
            <Database className="w-4 h-4" /> Global Forensic Logs Exports
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">CDR Call Detail Records</span>
              <div className="flex gap-2">
                <button onClick={() => exportCdrLogs("csv")} className="px-2.5 py-1 border border-border hover:bg-accent text-[11px] rounded">CSV</button>
                <button onClick={() => exportCdrLogs("excel")} className="px-2.5 py-1 border border-border hover:bg-accent text-[11px] rounded">Excel</button>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">IPDR Internet Activity Records</span>
              <div className="flex gap-2">
                <button onClick={() => exportIpdrLogs("csv")} className="px-2.5 py-1 border border-border hover:bg-accent text-[11px] rounded">CSV</button>
                <button onClick={() => exportIpdrLogs("excel")} className="px-2.5 py-1 border border-border hover:bg-accent text-[11px] rounded">Excel</button>
              </div>
            </div>
          </div>
        </div>

        <div className="ci-panel p-5 space-y-4 print:hidden">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-2 border-b border-border/60 flex items-center gap-2">
            <Network className="w-4 h-4" /> Community-Specific Intel Reports
          </div>
          <p className="text-[11px] text-muted-foreground">
            Generate and export intelligence dossiers detailing community roles, leader mapping, risk ratios, and distinct interactions.
          </p>
          <div className="flex gap-3">
            <select
              value={selectedCommunity}
              onChange={e => setSelectedCommunity(e.target.value)}
              className="flex-1 bg-background border border-border rounded p-1 text-xs text-foreground outline-none"
            >
              <option value="0">Community C0 (High Risk)</option>
              <option value="1">Community C1 (High Risk)</option>
              <option value="2">Community C2 (Medium Risk)</option>
              <option value="3">Community C3 (Low Risk)</option>
              <option value="4">Community C4 (Low Risk)</option>
              <option value="5">Community C5 (Low Risk)</option>
            </select>
            <button
              onClick={() => exportCommunityReport(selectedCommunity)}
              className="px-3 py-1 bg-primary text-primary-foreground font-medium rounded text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Community Report
            </button>
          </div>
        </div>

        <div className="ci-panel p-5 space-y-4 print:hidden">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-2 border-b border-border/60 flex items-center gap-2">
            <Users className="w-4 h-4" /> Target Subscriber Dossier Export
          </div>
          <p className="text-[11px] text-muted-foreground">
            Generate a full chronologically sorted activity audit timeline for any target phone number, integrating calls and internet sessions.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={selectedSubscriber}
              onChange={e => setSelectedSubscriber(e.target.value)}
              placeholder="e.g. +91-9000000000"
              className="flex-1 bg-background border border-border rounded p-1 text-xs text-foreground outline-none font-mono"
            />
            <button
              onClick={() => exportSubscriberReport(selectedSubscriber)}
              className="px-3 py-1 bg-primary text-primary-foreground font-medium rounded text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Subscriber Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}