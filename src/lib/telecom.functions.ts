import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  CDR_COMMUNITIES,
  IPDR_CLUSTERS,
  findCdrCommunityByPhone,
  findIpdrClusterByIp,
  narrativeContext,
  statsSummary,
  getCdrAnalytics,
  getIpdrAnalytics,
  rawCdrsList,
  rawIpdrsList,
  type CdrCommunity,
  type IpdrCluster,
} from "@/lib/telecom-data.server";
import {
  getUnifiedProfile,
  getUnifiedTimeline,
  getSIMSwapDetections,
  getSharedDeviceDetections,
  getCrossCommunityAnalysis,
  getSuspiciousCorrelations,
  getUnifiedInvestigationSummary,
} from "@/lib/cross-intelligence.server";
import { resolveEgoEntity } from "@/lib/graph-ego.server";

const MODEL_ID = "google/gemini-3-flash-preview";

export const getHealth = createServerFn({ method: "GET" }).handler(async () => {
  return {
    status: process.env.LOVABLE_API_KEY ? "online" : "degraded",
    model: MODEL_ID,
    version: "1.0.0",
  };
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => statsSummary());

export const getCdrGraph = createServerFn({ method: "GET" }).handler(async () => ({
  communities: CDR_COMMUNITIES,
}));

export const getIpdrGraph = createServerFn({ method: "GET" }).handler(async () => ({
  clusters: IPDR_CLUSTERS,
}));

function egoFromCommunity(c: CdrCommunity) {
  return {
    community_id: c.id,
    leader: c.leader,
    bridge_nodes: c.bridge_nodes,
    members: c.members,
    edges: c.edges,
    density: c.density,
    size: c.size,
    risk_label: c.risk_label,
    risk_score: c.risk_score,
  };
}

function egoFromCluster(c: IpdrCluster) {
  return {
    cluster_id: c.id,
    central_ip: c.central_ip,
    dominant_app: c.dominant_app,
    peers: c.peers,
    edges: c.edges,
    density: c.density,
    size: c.size,
    high_risk_ratio: c.high_risk_ratio,
    risk_label: c.risk_label,
    risk_score: c.risk_score,
  };
}

export const getEgoPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const c = findCdrCommunityByPhone(data.phone);
    if (!c) return { found: false as const };
    return { found: true as const, ego: data.phone, ...egoFromCommunity(c) };
  });

export const getEgoIp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ip: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const c = findIpdrClusterByIp(data.ip);
    if (!c) return { found: false as const };
    return { found: true as const, ego: data.ip, ...egoFromCluster(c) };
  });

// ---------- Trace endpoints ----------

export const traceSuspectContacts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ suspect_id: z.string(), include_callers_of_suspect: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const c = findCdrCommunityByPhone(data.suspect_id);
    if (!c) return { rows: [], summary: "Suspect not found in any known community." };
    const rows = c.edges
      .filter((e) => e.source === data.suspect_id || (data.include_callers_of_suspect && e.target === data.suspect_id))
      .map((e) => {
        const contact = e.source === data.suspect_id ? e.target : e.source;
        const m = c.members.find((x) => x.phone === contact);
        return {
          contact_id: contact,
          direction: e.source === data.suspect_id ? "outgoing" : "incoming",
          calls: e.calls,
          duration: e.total_duration,
          community: c.id,
          risk: c.risk_label,
          role: m?.role ?? "member",
        };
      });
    return { rows, community: c.id, risk: c.risk_label };
  });

export const traceSubsequent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ x_id: z.string(), y_id: z.string(), include_two_hop: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data }) => {
    const c = findCdrCommunityByPhone(data.y_id);
    if (!c) return { rows: [] };
    const rows = c.edges
      .filter((e) => e.source === data.y_id && e.target !== data.x_id)
      .map((e) => ({
        from: data.y_id,
        to: e.target,
        calls: e.calls,
        duration: e.total_duration,
        community: c.id,
        risk: c.risk_label,
      }));
    if (data.include_two_hop) {
      const seconds: typeof rows = [];
      for (const r of rows) {
        for (const e of c.edges) {
          if (e.source === r.to && e.target !== data.y_id) {
            seconds.push({
              from: r.to,
              to: e.target,
              calls: e.calls,
              duration: e.total_duration,
              community: c.id,
              risk: c.risk_label,
            });
          }
        }
      }
      return { rows: [...rows, ...seconds] };
    }
    return { rows };
  });

export const traceTwoHop = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ suspect_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const c = findCdrCommunityByPhone(data.suspect_id);
    if (!c) return { rows: [] };
    const firstHop = c.edges.filter((e) => e.source === data.suspect_id).map((e) => e.target);
    const rows: {
      hop1: string;
      hop2: string;
      calls: number;
      duration: number;
    }[] = [];
    for (const h1 of firstHop) {
      for (const e of c.edges) {
        if (e.source === h1 && e.target !== data.suspect_id) {
          rows.push({ hop1: h1, hop2: e.target, calls: e.calls, duration: e.total_duration });
        }
      }
    }
    return { rows };
  });

export const traceClusterSpread = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ x_id: z.string(), cutoff_date: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const c = findCdrCommunityByPhone(data.x_id);
    if (!c) return { rows: [] };
    // Outward: bridge_to links + fabricated "post-cutoff" calls from bridge nodes to peers in other communities.
    const rows = c.bridges_to.map((b) => {
      const peerCom = CDR_COMMUNITIES[b.target_community];
      return {
        insider: b.bridge_node,
        outsider: b.peer_node,
        calls: b.strength,
        target_community: b.target_community,
        target_risk: peerCom.risk_label,
        after: data.cutoff_date ?? "n/a",
      };
    });
    return { rows, community: c.id };
  });

export const traceIpdrClusterMembers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ip_address: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const c = findIpdrClusterByIp(data.ip_address);
    if (!c) return { rows: [] };
    const rows = c.peers
      .filter((p) => p.ip !== data.ip_address)
      .map((p) => ({
        peer_ip: p.ip,
        cluster: c.id,
        dominant_app: p.dominant_app,
        high_risk_ratio: c.high_risk_ratio,
        risk: c.risk_label,
        flows: p.flows,
        bytes: p.bytes,
      }));
    return { rows, cluster: c.id, risk: c.risk_label };
  });

export const traceIpdrCross = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ip_a: z.string(), ip_b: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const cb = findIpdrClusterByIp(data.ip_b);
    if (!cb) return { rows: [] };
    const rows = cb.peers.map((p) => ({
      ip: p.ip,
      cluster: cb.id,
      dominant_app: p.dominant_app,
      flows: p.flows,
      bytes: p.bytes,
      risk: cb.risk_label,
    }));
    return { rows, cluster_b: cb.id };
  });

export const traceIpdrClusterProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ip_address: z.string(), cutoff_date: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const c = findIpdrClusterByIp(data.ip_address);
    if (!c) return { rows: [], profile: null };
    const rows = c.peers.map((p) => ({
      ip: p.ip,
      dominant_app: p.dominant_app,
      flows: p.flows,
      bytes: p.bytes,
      high_risk: p.is_high_risk,
    }));
    return {
      rows,
      profile: {
        cluster: c.id,
        central_ip: c.central_ip,
        dominant_app: c.dominant_app,
        app_profile: c.app_profile,
        high_risk_ratio: c.high_risk_ratio,
        total_flows: c.total_flow_count,
        total_bytes: c.total_bytes,
        risk: c.risk_label,
      },
    };
  });

// ---------- LLM query ----------
export const askAnalyst = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ question: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        answer: "AI Gateway is not configured. Running in offline mode.",
        intent: "offline",
      };
    }
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(MODEL_ID);
    const system = `You are a Community Intelligence Analyst working with telecom surveillance data (CDR call records + IPDR internet sessions). Answer concisely (3-6 sentences). Use ONLY the data provided below.

You must classify your answer with one of these INTENTS:
- leader_lookup: identifying leader of a community
- risk_ranking: which community is highest/lowest risk
- bridge_nodes: bridge nodes / cross-community connectors
- ego_analysis: specific phone/IP analysis
- cluster_profile: IPDR cluster / dominant app
- general: anything else

Reply in EXACTLY this JSON format on a single line:
{"intent":"<intent>","answer":"<answer>"}

DATA:
${narrativeContext()}`;

    try {
      const { text } = await generateText({
        model,
        system,
        prompt: data.question,
      });
      const trimmed = text.trim();
      // Try to parse JSON
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const obj = JSON.parse(match[0]) as { intent?: string; answer?: string };
          if (obj.answer) return { answer: obj.answer, intent: obj.intent ?? "general" };
        } catch {
          // fallthrough
        }
      }
      return { answer: trimmed, intent: "general" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { answer: `Gateway error: ${message}`, intent: "error" };
    }
  });

export const getCdrAnalyticsData = createServerFn({ method: "GET" }).handler(async () => {
  return getCdrAnalytics();
});

export const getIpdrAnalyticsData = createServerFn({ method: "GET" }).handler(async () => {
  return getIpdrAnalytics();
});

export const searchCrossDataset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ entity: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const profile = getUnifiedProfile(data.entity);
    const timeline = getUnifiedTimeline(data.entity);
    const correlations = getSuspiciousCorrelations(data.entity);
    const summary = getUnifiedInvestigationSummary(data.entity);
    return { profile, timeline, correlations, summary };
  });

export const getCrossIntelOverview = createServerFn({ method: "GET" }).handler(async () => {
  const simSwaps = getSIMSwapDetections();
  const sharedDevices = getSharedDeviceDetections();
  const communityOverlaps = getCrossCommunityAnalysis();
  const globalCorrelations = getSuspiciousCorrelations();
  return { simSwaps, sharedDevices, communityOverlaps, globalCorrelations };
});

export const resolveEgoGraphSearch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ query: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return resolveEgoEntity(data.query);
  });

export const getRawTelecomData = createServerFn({ method: "GET" }).handler(async () => {
  return { cdrs: rawCdrsList, ipdrs: rawIpdrsList };
});