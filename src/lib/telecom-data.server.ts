// Deterministic mock CDR/IPDR community data. Generated at module load.
// Replaces Neo4j + JSON pipeline for demo purposes.

export type Role = "leader" | "bridge" | "member";

export interface CdrEdge {
  source: string;
  target: string;
  calls: number;
  total_duration: number; // seconds
  avg_duration: number;
}

export interface CdrMember {
  phone: string;
  role: Role;
  centrality: number;
  external_links?: number;
}

export interface CdrCommunity {
  id: number;
  size: number;
  density: number;
  avg_betweenness: number;
  leader: string;
  bridge_nodes: string[];
  members: CdrMember[];
  edges: CdrEdge[];
  total_interactions: number;
  total_call_duration_sec: number;
  risk_score: number;
  risk_label: "LOW" | "MEDIUM" | "HIGH";
  // inter-community links: from a bridge phone in this community to a phone in another community
  bridges_to: {
    target_community: number;
    bridge_node: string;
    peer_node: string;
    strength: number;
  }[];
}

export interface IpdrPeer {
  ip: string;
  role: "central" | "member";
  flows: number;
  bytes: number;
  dominant_app: string;
  is_high_risk: boolean;
}

export interface IpdrCluster {
  id: number;
  size: number;
  density: number;
  central_ip: string;
  dominant_app: string;
  high_risk_ratio: number;
  total_bytes: number;
  total_flow_count: number;
  peers: IpdrPeer[];
  edges: { source: string; target: string; flows: number; avg_bytes: number }[];
  risk_score: number;
  risk_label: "LOW" | "MEDIUM" | "HIGH";
  app_profile: Record<string, number>;
}

// Seeded RNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const rint = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

function labelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.38) return "MEDIUM";
  return "LOW";
}

const APPS = ["WhatsApp", "Telegram", "Signal", "VPN-Tunnel", "Tor-Bridge", "YouTube", "Instagram", "Streaming"];
const HIGH_RISK_APPS = new Set(["VPN-Tunnel", "Tor-Bridge", "Telegram", "Signal"]);

function makePhone(cid: number, idx: number) {
  const base = 9000000000 + cid * 1000000 + idx * 137;
  return `+91-${base}`;
}
function makeIp(cid: number, idx: number) {
  return `10.${cid + 10}.${Math.floor(idx / 254)}.${(idx % 254) + 1}`;
}

// ---------- Build CDR communities ----------
const CDR_SIZES = [22, 18, 15, 12, 10, 8];
export const CDR_COMMUNITIES: CdrCommunity[] = CDR_SIZES.map((size, cid) => {
  const members: CdrMember[] = [];
  const leaderPhone = makePhone(cid, 0);
  members.push({ phone: leaderPhone, role: "leader", centrality: 0.85 + rnd() * 0.15 });

  const nBridges = cid < 4 ? 2 : 1;
  const bridgeNodes: string[] = [];
  for (let b = 0; b < nBridges; b++) {
    const p = makePhone(cid, 1 + b);
    bridgeNodes.push(p);
    members.push({ phone: p, role: "bridge", centrality: 0.45 + rnd() * 0.25, external_links: rint(1, 4) });
  }
  for (let m = 1 + nBridges; m < size; m++) {
    members.push({ phone: makePhone(cid, m), role: "member", centrality: rnd() * 0.35 });
  }

  // edges: leader -> everyone, plus some inner edges
  const edges: CdrEdge[] = [];
  for (let i = 1; i < size; i++) {
    const calls = rint(3, 40);
    const avg = rint(20, 400);
    edges.push({
      source: leaderPhone,
      target: members[i].phone,
      calls,
      total_duration: calls * avg,
      avg_duration: avg,
    });
  }
  const nExtra = Math.min(size, 10);
  for (let i = 0; i < nExtra; i++) {
    const a = members[rint(1, size - 1)].phone;
    const b = members[rint(1, size - 1)].phone;
    if (a === b) continue;
    const calls = rint(1, 12);
    const avg = rint(15, 250);
    edges.push({ source: a, target: b, calls, total_duration: calls * avg, avg_duration: avg });
  }

  const total_interactions = edges.reduce((s, e) => s + e.calls, 0);
  const total_call_duration_sec = edges.reduce((s, e) => s + e.total_duration, 0);
  const density = Math.min(0.95, edges.length / (size * (size - 1) * 0.5));
  const avg_betweenness = 0.15 + rnd() * 0.35;
  const bridge_ratio = nBridges / size;
  const raw = 0.28 * density + 0.32 * avg_betweenness + 0.22 * bridge_ratio + 0.18 * Math.tanh(total_interactions / 250);
  const risk_score = Math.min(0.98, raw);

  return {
    id: cid,
    size,
    density: +density.toFixed(3),
    avg_betweenness: +avg_betweenness.toFixed(3),
    leader: leaderPhone,
    bridge_nodes: bridgeNodes,
    members,
    edges,
    total_interactions,
    total_call_duration_sec,
    risk_score: +risk_score.toFixed(3),
    risk_label: labelFromScore(risk_score),
    bridges_to: [],
  };
});

// Wire inter-community bridge links (bridge node -> another community's bridge node or leader)
for (const c of CDR_COMMUNITIES) {
  for (const bn of c.bridge_nodes) {
    const targetCid = (c.id + 1 + Math.floor(rnd() * (CDR_COMMUNITIES.length - 1))) % CDR_COMMUNITIES.length;
    if (targetCid === c.id) continue;
    const targetCom = CDR_COMMUNITIES[targetCid];
    const peer = targetCom.bridge_nodes[0] ?? targetCom.leader;
    c.bridges_to.push({
      target_community: targetCid,
      bridge_node: bn,
      peer_node: peer,
      strength: rint(2, 12),
    });
  }
}

// ---------- Build IPDR clusters ----------
const IPDR_SIZES = [14, 11, 9, 7];
export const IPDR_CLUSTERS: IpdrCluster[] = IPDR_SIZES.map((size, cid) => {
  const dominant = pick(APPS);
  const peers: IpdrPeer[] = [];
  const centralIp = makeIp(cid, 0);
  peers.push({
    ip: centralIp,
    role: "central",
    flows: rint(80, 200),
    bytes: rint(1e8, 5e8),
    dominant_app: dominant,
    is_high_risk: HIGH_RISK_APPS.has(dominant),
  });
  let hi = HIGH_RISK_APPS.has(dominant) ? 1 : 0;
  for (let i = 1; i < size; i++) {
    const app = rnd() < 0.6 ? dominant : pick(APPS);
    const isHigh = HIGH_RISK_APPS.has(app);
    if (isHigh) hi++;
    peers.push({
      ip: makeIp(cid, i),
      role: "member",
      flows: rint(10, 90),
      bytes: rint(1e6, 8e7),
      dominant_app: app,
      is_high_risk: isHigh,
    });
  }
  const edges = peers.slice(1).map((p) => ({
    source: centralIp,
    target: p.ip,
    flows: p.flows,
    avg_bytes: Math.floor(p.bytes / Math.max(1, p.flows)),
  }));
  const total_bytes = peers.reduce((s, p) => s + p.bytes, 0);
  const total_flow_count = peers.reduce((s, p) => s + p.flows, 0);
  const high_risk_ratio = hi / size;
  const density = Math.min(0.9, edges.length / (size * (size - 1) * 0.5));
  const flowVol = Math.tanh(total_flow_count / 500);
  const risk_score = Math.min(0.98, 0.45 * high_risk_ratio + 0.25 * density + 0.3 * flowVol);
  const app_profile: Record<string, number> = {};
  for (const p of peers) app_profile[p.dominant_app] = (app_profile[p.dominant_app] ?? 0) + 1;

  return {
    id: cid,
    size,
    density: +density.toFixed(3),
    central_ip: centralIp,
    dominant_app: dominant,
    high_risk_ratio: +high_risk_ratio.toFixed(3),
    total_bytes,
    total_flow_count,
    peers,
    edges,
    risk_score: +risk_score.toFixed(3),
    risk_label: labelFromScore(risk_score),
    app_profile,
  };
});

// ---------- Helpers ----------
export function findCdrCommunityByPhone(phone: string): CdrCommunity | undefined {
  return CDR_COMMUNITIES.find((c) => c.members.some((m) => m.phone === phone));
}

export function findIpdrClusterByIp(ip: string): IpdrCluster | undefined {
  return IPDR_CLUSTERS.find((c) => c.peers.some((p) => p.ip === ip));
}

export function statsSummary() {
  const totalUsers =
    CDR_COMMUNITIES.reduce((s, c) => s + c.size, 0) + IPDR_CLUSTERS.reduce((s, c) => s + c.size, 0);
  const highRisk =
    CDR_COMMUNITIES.filter((c) => c.risk_label === "HIGH").length +
    IPDR_CLUSTERS.filter((c) => c.risk_label === "HIGH").length;
  return {
    cdr_communities: CDR_COMMUNITIES.length,
    ipdr_clusters: IPDR_CLUSTERS.length,
    high_risk: highRisk,
    total_users: totalUsers,
  };
}

export function narrativeContext(): string {
  const cdrLines = CDR_COMMUNITIES.map(
    (c) =>
      `CDR#${c.id}: size=${c.size}, leader=${c.leader}, bridges=[${c.bridge_nodes.join(", ")}], risk=${c.risk_label}(${c.risk_score}), density=${c.density}, betweenness=${c.avg_betweenness}, total_calls=${c.total_interactions}`,
  ).join("\n");
  const ipdrLines = IPDR_CLUSTERS.map(
    (c) =>
      `IPDR#${c.id}: size=${c.size}, central=${c.central_ip}, app=${c.dominant_app}, high_risk_ratio=${c.high_risk_ratio}, risk=${c.risk_label}(${c.risk_score}), flows=${c.total_flow_count}`,
  ).join("\n");
  return `CDR COMMUNITIES:\n${cdrLines}\n\nIPDR CLUSTERS:\n${ipdrLines}`;
}

// Raw CDR Transaction interface for analytics
export interface RawCdrRecord {
  id: string;
  caller: string;
  receiver: string;
  duration: number; // seconds
  timestamp: string; // ISO format
  type: "CALL" | "SMS";
  imei: string;
  imsi: string;
  bts_id: string; // Base Transceiver Station (Cell Tower)
  missing_fields?: string[];
  is_duplicate?: boolean;
}

// Generate deterministic granular CDR records
export const rawCdrsList: RawCdrRecord[] = [];
const allPhones: string[] = [];
CDR_COMMUNITIES.forEach(c => {
  c.members.forEach(m => {
    allPhones.push(m.phone);
  });
});

// Create IMEIs and IMSIs mapping
const imeiMap = new Map<string, string[]>();
const imsiMap = new Map<string, string[]>();

const getImei = (phone: string, idx: number) => {
  // Simulate IMEI based on phone
  const clean = phone.replace(/\D/g, "");
  return `35890100${clean.slice(-6)}`;
};

const getImsi = (phone: string, idx: number) => {
  const clean = phone.replace(/\D/g, "");
  return `40445${clean.slice(-10)}`;
};

// Seed records
const towerIds = ["BTS-101", "BTS-102", "BTS-103", "BTS-201", "BTS-202", "BTS-301", "BTS-302"];
const baseDate = new Date("2026-07-15T00:00:00Z");

for (let i = 0; i < 240; i++) {
  const caller = allPhones[i % allPhones.length];
  // select a receiver
  let receiver = allPhones[(i * 3 + 1) % allPhones.length];
  if (caller === receiver) {
    receiver = allPhones[(i * 3 + 2) % allPhones.length];
  }

  // Duration: short calls, long calls, normal calls
  let duration = 60 + (i % 10) * 80;
  if (i % 12 === 0) duration = 3; // suspicious short call
  if (i % 25 === 0) duration = 4200; // long call
  if (i % 7 === 0) duration = 0; // missed call/short drop

  // Type
  const type = (i % 4 === 0) ? "SMS" as const : "CALL" as const;

  // IMSI/IMEI logic with anomalies
  let imei = getImei(caller, i);
  let imsi = getImsi(caller, i);

  // Trigger SIM swap anomaly: phone +91-9000000000 swaps SIMs (different IMSIs on same IMEI)
  if (caller === allPhones[0]) {
    if (i % 3 === 0) {
      imsi = "404450000000001";
    } else if (i % 3 === 1) {
      imsi = "404450000000002";
    } else {
      imsi = "404450000000003";
    }
  }

  // Trigger Multiple IMEIs per IMSI (SIM inserted in multiple devices)
  if (caller === allPhones[1]) {
    imei = `35890100000000${i % 4}`;
  }

  // Track IMSI/IMEI relationships
  if (!imeiMap.has(imei)) imeiMap.set(imei, []);
  if (!imeiMap.get(imei)!.includes(imsi)) imeiMap.get(imei)!.push(imsi);

  if (!imsiMap.has(imsi)) imsiMap.set(imsi, []);
  if (!imsiMap.get(imsi)!.includes(imei)) imsiMap.get(imsi)!.push(imei);

  // Time sequence: spread calls over the week
  const callTime = new Date(baseDate.getTime() + i * 4 * 3600 * 1000 + (i % 59) * 60 * 1000);
  const bts_id = towerIds[(i + (i % 3)) % towerIds.length];

  const rec: RawCdrRecord = {
    id: `cdr-${i}`,
    caller,
    receiver,
    duration,
    timestamp: callTime.toISOString(),
    type,
    imei,
    imsi,
    bts_id,
  };

  // Add missing data report simulation
  if (i === 13 || i === 47) {
    rec.missing_fields = ["imei"];
    rec.imei = "";
  }
  if (i === 88) {
    rec.missing_fields = ["duration"];
    rec.duration = -1;
  }

  // Add duplicate record simulation
  if (i === 110 || i === 111) {
    rec.is_duplicate = true;
    rec.id = "cdr-dup-110";
  }

  rawCdrsList.push(rec);
}

// Add a high-frequency suspicious pair calling sequence
const suspCaller = allPhones[2];
const suspReceiver = allPhones[3];
for (let j = 0; j < 6; j++) {
  rawCdrsList.push({
    id: `cdr-susp-${j}`,
    caller: suspCaller,
    receiver: suspReceiver,
    duration: 2, // 2 seconds
    timestamp: new Date(baseDate.getTime() + 10 * 24 * 3600 * 1000 + j * 45 * 1000).toISOString(), // call every 45s
    type: "CALL",
    imei: getImei(suspCaller, 0),
    imsi: getImsi(suspCaller, 0),
    bts_id: "BTS-101",
  });
}

export function getCdrAnalytics() {
  // 1. Top callers / Top receivers
  const callerCounts: Record<string, number> = {};
  const receiverCounts: Record<string, number> = {};
  const contactedCounts: Record<string, Set<string>> = {};
  const pairsCounts: Record<string, { caller: string; receiver: string; count: number }> = {};
  
  let incomingCount = 0;
  let outgoingCount = 0;
  let smsCount = 0;
  let callCount = 0;

  const durations: number[] = [];

  // Temporal analysis
  const hourlyDistribution = Array(24).fill(0);
  let dayCalls = 0; // 6am - 6pm
  let nightCalls = 0; // 6pm - 6am
  const dailyTimeline: Record<string, number> = {};

  // BTS Cell movements
  const userTowerLogs: Record<string, { bts_id: string; time: string }[]> = {};

  // Data Quality
  let duplicateCount = 0;
  const missingDataReport: { recordId: string; missing: string[] }[] = [];

  rawCdrsList.forEach(rec => {
    // Quality check
    if (rec.is_duplicate) duplicateCount++;
    if (rec.missing_fields && rec.missing_fields.length > 0) {
      missingDataReport.push({ recordId: rec.id, missing: rec.missing_fields });
    }

    if (rec.type === "CALL") {
      callCount++;
      if (rec.duration >= 0) {
        durations.push(rec.duration);
      }
    } else {
      smsCount++;
    }

    // Counts
    callerCounts[rec.caller] = (callerCounts[rec.caller] ?? 0) + 1;
    receiverCounts[rec.receiver] = (receiverCounts[rec.receiver] ?? 0) + 1;

    // Contacted
    if (!contactedCounts[rec.caller]) contactedCounts[rec.caller] = new Set();
    contactedCounts[rec.caller].add(rec.receiver);

    // Pair
    const pairKey = [rec.caller, rec.receiver].sort().join("<->");
    if (!pairsCounts[pairKey]) {
      pairsCounts[pairKey] = { caller: rec.caller, receiver: rec.receiver, count: 0 };
    }
    pairsCounts[pairKey].count++;

    // Direction (from the perspective of community leaders/bridge nodes)
    const callerCommunity = findCdrCommunityByPhone(rec.caller);
    const isCallerLeaderOrBridge = callerCommunity?.leader === rec.caller || callerCommunity?.bridge_nodes.includes(rec.caller);
    if (isCallerLeaderOrBridge) {
      outgoingCount++;
    } else {
      incomingCount++;
    }

    // Temporal
    const date = new Date(rec.timestamp);
    const hour = date.getUTCHours();
    hourlyDistribution[hour]++;

    if (hour >= 6 && hour < 18) {
      dayCalls++;
    } else {
      nightCalls++;
    }

    const dayStr = date.toISOString().slice(0, 10);
    dailyTimeline[dayStr] = (dailyTimeline[dayStr] ?? 0) + 1;

    // Tower tracking
    if (!userTowerLogs[rec.caller]) userTowerLogs[rec.caller] = [];
    userTowerLogs[rec.caller].push({ bts_id: rec.bts_id, time: rec.timestamp });
  });

  // Top Callers list
  const topCallers = Object.entries(callerCounts)
    .map(([phone, count]) => ({ phone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top Receivers list
  const topReceivers = Object.entries(receiverCounts)
    .map(([phone, count]) => ({ phone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most Contacted numbers
  const mostContacted = Object.entries(contactedCounts)
    .map(([phone, set]) => ({ phone, distinctCount: set.size }))
    .sort((a, b) => b.distinctCount - a.distinctCount)
    .slice(0, 5);

  // Frequent communication pairs
  const frequentPairs = Object.values(pairsCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Call duration statistics
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const longestCalls = sortedDurations.slice(-5).reverse();
  const shortestCalls = sortedDurations.slice(0, 5);
  const averageDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  // Short call (< 5s) / Long call (> 600s) detection
  const shortCallsDetected = rawCdrsList.filter(rec => rec.type === "CALL" && rec.duration > 0 && rec.duration < 5);
  const longCallsDetected = rawCdrsList.filter(rec => rec.type === "CALL" && rec.duration > 600);

  // Suspicious repeated short calls
  const repeatedShortCalls: { caller: string; receiver: string; count: number; timestamps: string[] }[] = [];
  const shortPairMap: Record<string, string[]> = {};
  shortCallsDetected.forEach(rec => {
    const key = `${rec.caller}->${rec.receiver}`;
    if (!shortPairMap[key]) shortPairMap[key] = [];
    shortPairMap[key].push(rec.timestamp);
  });
  Object.entries(shortPairMap).forEach(([key, list]) => {
    if (list.length >= 3) {
      const [caller, receiver] = key.split("->");
      repeatedShortCalls.push({ caller, receiver, count: list.length, timestamps: list });
    }
  });

  // Duration Histogram brackets
  const histogramBrackets = [
    { bracket: "0-5s", count: durations.filter(d => d <= 5).length },
    { bracket: "6s-30s", count: durations.filter(d => d > 5 && d <= 30).length },
    { bracket: "31s-2m", count: durations.filter(d => d > 30 && d <= 120).length },
    { bracket: "2m-5m", count: durations.filter(d => d > 120 && d <= 300).length },
    { bracket: "5m-15m", count: durations.filter(d => d > 300 && d <= 900).length },
    { bracket: "15m+", count: durations.filter(d => d > 900).length },
  ];

  // SIM swap / Multiple IMSIs per IMEI / Multiple IMEIs per IMSI / Shared device detection
  const simSwaps: { imei: string; imsis: string[] }[] = [];
  const multipleImeisPerImsi: { imsi: string; imeis: string[] }[] = [];
  const sharedDevices: { imei: string; callers: string[] }[] = [];

  imeiMap.forEach((imsis, imei) => {
    if (imsis.length > 1 && imei !== "") {
      simSwaps.push({ imei, imsis });
    }
  });

  imsiMap.forEach((imeis, imsi) => {
    if (imeis.length > 1) {
      multipleImeisPerImsi.push({ imsi, imeis });
    }
  });

  // Shared devices (multiple unique callers using the same IMEI)
  const deviceUsersMap = new Map<string, Set<string>>();
  rawCdrsList.forEach(rec => {
    if (rec.imei) {
      if (!deviceUsersMap.has(rec.imei)) deviceUsersMap.set(rec.imei, new Set());
      deviceUsersMap.get(rec.imei)!.add(rec.caller);
    }
  });
  deviceUsersMap.forEach((users, imei) => {
    if (users.size > 1) {
      sharedDevices.push({ imei, callers: Array.from(users) });
    }
  });

  // BTS Movements summary
  const btsTransitionSummary: { phone: string; transitions: number; path: string[] }[] = [];
  Object.entries(userTowerLogs).forEach(([phone, logs]) => {
    // Sort logs by time
    const sortedLogs = logs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const path: string[] = [];
    let transitions = 0;
    sortedLogs.forEach((log, idx) => {
      if (idx === 0) {
        path.push(log.bts_id);
      } else if (log.bts_id !== sortedLogs[idx - 1].bts_id) {
        path.push(log.bts_id);
        transitions++;
      }
    });
    if (transitions > 0) {
      btsTransitionSummary.push({ phone, transitions, path });
    }
  });

  // Community statistics
  const communityStats = CDR_COMMUNITIES.map(c => {
    // Compute internal vs external communication
    let internalCalls = 0;
    let externalCalls = 0;
    rawCdrsList.forEach(rec => {
      const callerIn = c.members.some(m => m.phone === rec.caller);
      const receiverIn = c.members.some(m => m.phone === rec.receiver);
      if (callerIn && receiverIn) {
        internalCalls++;
      } else if (callerIn || receiverIn) {
        externalCalls++;
      }
    });

    return {
      communityId: c.id,
      internalCalls,
      externalCalls,
      density: c.density,
      riskScore: c.risk_score,
      size: c.size,
    };
  }).sort((a, b) => b.riskScore - a.riskScore); // Community ranking

  return {
    topCallers,
    topReceivers,
    mostContacted,
    frequentPairs,
    incomingCount,
    outgoingCount,
    callCount,
    smsCount,
    durations: {
      longestCalls,
      shortestCalls,
      averageDuration,
      histogramBrackets,
    },
    suspiciousCalls: {
      repeatedShortCalls,
      shortCallsDetected: shortCallsDetected.length,
      longCallsDetected: longCallsDetected.length,
    },
    deviceForensics: {
      simSwaps,
      multipleImeisPerImsi,
      sharedDevices,
    },
    btsMovements: btsTransitionSummary.sort((a, b) => b.transitions - a.transitions).slice(0, 10),
    communityStats,
    qualityReport: {
      duplicateCount,
      missingDataReport,
    },
  };
}

// IPDR Transaction schema
export interface RawIpdrRecord {
  id: string;
  phone: string;
  imsi: string;
  imei: string;
  subscriber_ip: string;
  bytes_transferred: number;
  duration_sec: number;
  timestamp: string; // ISO
  application: string;
  apn: string;
  rat: "4G" | "5G" | "3G";
  pgw_ip: string;
  dest_ip: string;
  dest_port: number;
}

// Generate raw IPDR transactional records
export const rawIpdrsList: RawIpdrRecord[] = [];
const allIps: string[] = [];
IPDR_CLUSTERS.forEach(c => {
  c.peers.forEach(p => {
    allIps.push(p.ip);
  });
});

const apns = ["internet", "ims", "vpn.secured", "enterprise.apn"];
const rats = ["5G" as const, "4G" as const, "3G" as const];
const pgws = ["172.16.100.1", "172.16.100.2", "172.16.200.5"];
const destIps = ["8.8.8.8", "1.1.1.1", "203.0.113.50", "198.51.100.99", "185.220.101.5", "109.105.109.2"]; // including Tor entry nodes, high-risk IPs

// Seed IPDR transactions
for (let i = 0; i < 260; i++) {
  const ip = allIps[i % allIps.length];
  // Find associated phone/IMEI/IMSI from CDR members to keep data unified
  const userIdx = i % allPhones.length;
  const phone = allPhones[userIdx];
  const imsi = getImsi(phone, userIdx);
  const imei = getImei(phone, userIdx);

  // Bytes & session duration
  let bytes = 1024 * 1024 * (1 + (i % 15) * 15); // Normal usage
  if (i % 18 === 0) bytes = 1024 * 1024 * 1024 * (1.5 + (i % 3)); // Heavy usage (GBs)

  let duration = 30 + (i % 10) * 180;
  if (i % 15 === 0) duration = 7200; // 2 hour session

  // App selection
  const app = APPS[i % APPS.length];

  const apn = apns[i % apns.length];
  const rat = rats[i % rats.length];
  const pgw = pgws[i % pgws.length];
  const destIp = destIps[i % destIps.length];

  // Port definitions
  let dest_port = 443;
  if (i % 7 === 0) dest_port = 80;
  if (i % 9 === 0) dest_port = 5060; // SIP / VoIP
  if (i % 15 === 0) dest_port = 22; // SSH
  if (i % 22 === 0) dest_port = 9001; // Tor

  const sessionTime = new Date(baseDate.getTime() + i * 2.5 * 3600 * 1000 + (i % 47) * 60 * 1000);

  rawIpdrsList.push({
    id: `ipdr-${i}`,
    phone,
    imsi,
    imei,
    subscriber_ip: ip,
    bytes_transferred: bytes,
    duration_sec: duration,
    timestamp: sessionTime.toISOString(),
    application: app,
    apn,
    rat,
    pgw_ip: pgw,
    dest_ip: destIp,
    dest_port,
  });
}

export function getIpdrAnalytics() {
  const usageBySubscriber: Record<string, number> = {};
  const usageByImsi: Record<string, number> = {};
  const usageByImei: Record<string, number> = {};

  const appUsageCounts: Record<string, number> = {};
  const appBytes: Record<string, number> = {};
  const communityAppUsage: Record<number, Record<string, number>> = {};

  // Concurrency & temporal
  const hourlyUsage = Array(24).fill(0);
  const dailyTimeline: Record<string, number> = {};
  
  // Infrastructure
  const apnStats: Record<string, number> = {};
  const ratStats: Record<string, number> = {};
  const pgwStats: Record<string, number> = {};

  // Port & dest IP
  const portStats: Record<number, number> = {};
  const destIpStats: Record<string, { bytes: number; count: number }> = {};
  let voipSessionCount = 0;

  // Track session details
  const sessionDurations: number[] = [];
  let concurrentSessionsMax = 0;

  // Session frequency (sessions per subscriber)
  const sessionCountByPhone: Record<string, number> = {};

  rawIpdrsList.forEach(rec => {
    // 1. Data usage
    usageBySubscriber[rec.phone] = (usageBySubscriber[rec.phone] ?? 0) + rec.bytes_transferred;
    usageByImsi[rec.imsi] = (usageByImsi[rec.imsi] ?? 0) + rec.bytes_transferred;
    usageByImei[rec.imei] = (usageByImei[rec.imei] ?? 0) + rec.bytes_transferred;

    // 2. Apps
    appUsageCounts[rec.application] = (appUsageCounts[rec.application] ?? 0) + 1;
    appBytes[rec.application] = (appBytes[rec.application] ?? 0) + rec.bytes_transferred;

    // Community-wise app usage
    const callerCommunity = findCdrCommunityByPhone(rec.phone);
    if (callerCommunity) {
      const cid = callerCommunity.id;
      if (!communityAppUsage[cid]) communityAppUsage[cid] = {};
      communityAppUsage[cid][rec.application] = (communityAppUsage[cid][rec.application] ?? 0) + 1;
    }

    // 3. Infrastructure
    apnStats[rec.apn] = (apnStats[rec.apn] ?? 0) + 1;
    ratStats[rec.rat] = (ratStats[rec.rat] ?? 0) + 1;
    pgwStats[rec.pgw_ip] = (pgwStats[rec.pgw_ip] ?? 0) + 1;

    // 4. Ports & Dest IPs
    portStats[rec.dest_port] = (portStats[rec.dest_port] ?? 0) + 1;
    
    if (!destIpStats[rec.dest_ip]) {
      destIpStats[rec.dest_ip] = { bytes: 0, count: 0 };
    }
    destIpStats[rec.dest_ip].bytes += rec.bytes_transferred;
    destIpStats[rec.dest_ip].count++;

    if (rec.dest_port === 5060) {
      voipSessionCount++;
    }

    // Session frequency
    sessionCountByPhone[rec.phone] = (sessionCountByPhone[rec.phone] ?? 0) + 1;

    // 5. Durations & Timelines
    sessionDurations.push(rec.duration_sec);
    const date = new Date(rec.timestamp);
    const hour = date.getUTCHours();
    hourlyUsage[hour] += rec.bytes_transferred;

    const dayStr = date.toISOString().slice(0, 10);
    dailyTimeline[dayStr] = (dailyTimeline[dayStr] ?? 0) + rec.bytes_transferred;
  });

  // Calculate top/heavy users
  const topUsers = Object.entries(usageBySubscriber)
    .map(([phone, bytes]) => ({ phone, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const topImsis = Object.entries(usageByImsi)
    .map(([imsi, bytes]) => ({ imsi, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const topImeis = Object.entries(usageByImei)
    .map(([imei, bytes]) => ({ imei, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  // App usage percentage
  const totalBytesTransferred = Object.values(appBytes).reduce((a, b) => a + b, 0);
  const appPercentages = Object.entries(appBytes).map(([name, bytes]) => ({
    name,
    bytes,
    percentage: +((bytes / totalBytesTransferred) * 100).toFixed(1),
    count: appUsageCounts[name] ?? 0,
  })).sort((a, b) => b.bytes - a.bytes);

  // High-risk app summary (Tor, VPN, Telegram, Signal)
  const highRiskApps = appPercentages.filter(app => HIGH_RISK_APPS.has(app.name));

  // Destination Port analysis & Port Heatmap
  const portHeatmap = Object.entries(portStats).map(([port, count]) => {
    let service = "Unknown";
    const p = parseInt(port);
    if (p === 443) service = "HTTPS";
    else if (p === 80) service = "HTTP";
    else if (p === 5060) service = "SIP/VoIP";
    else if (p === 22) service = "SSH";
    else if (p === 9001) service = "Tor Entry";

    return { port: p, service, count };
  }).sort((a, b) => b.count - a.count);

  // High-risk IP ranking (known Tor nodes or unmapped gateway addresses)
  const highRiskIps = Object.entries(destIpStats)
    .map(([ip, stats]) => {
      // Artificially rank risk: Tor IP (185.220.101.5 / 109.105.109.2) are high risk
      let riskLabel = "LOW";
      let riskScore = 0.1;
      if (ip === "185.220.101.5" || ip === "109.105.109.2") {
        riskLabel = "HIGH";
        riskScore = 0.95;
      } else if (ip === "203.0.113.50") {
        riskLabel = "MEDIUM";
        riskScore = 0.55;
      }
      return { ip, bytes: stats.bytes, count: stats.count, riskLabel, riskScore };
    })
    .sort((a, b) => b.riskScore - a.riskScore || b.bytes - a.bytes);

  // Session duration analysis
  const sortedDurations = [...sessionDurations].sort((a, b) => a - b);
  const avgSessionDuration = Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length);
  const maxSessionDuration = sortedDurations[sortedDurations.length - 1] ?? 0;
  const minSessionDuration = sortedDurations[0] ?? 0;

  // Concurrent sessions simulation (overlapping windows)
  // Let's analyze overlaps: sort sessions by start timestamp
  const sortedSessions = rawIpdrsList
    .map(s => ({
      start: new Date(s.timestamp).getTime(),
      end: new Date(s.timestamp).getTime() + s.duration_sec * 1000,
    }))
    .sort((a, b) => a.start - b.start);

  let maxConcurrency = 0;
  for (let i = 0; i < sortedSessions.length; i++) {
    let concurrent = 0;
    const currentStart = sortedSessions[i].start;
    for (let j = 0; j < sortedSessions.length; j++) {
      if (sortedSessions[j].start <= currentStart && sortedSessions[j].end >= currentStart) {
        concurrent++;
      }
    }
    if (concurrent > maxConcurrency) {
      maxConcurrency = concurrent;
    }
  }

  // Session frequency ranking (most sessions initiated per subscriber)
  const sessionFrequency = Object.entries(sessionCountByPhone)
    .map(([phone, sessions]) => ({
      phone,
      sessions,
      avgBytesPerSession: Math.round((usageBySubscriber[phone] ?? 0) / sessions),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  // Peak internet usage hour (by total bytes transferred)
  const hourlyUsageFormatted = hourlyUsage.map((bytes, hour) => ({ hour: `${hour}:00`, bytes }));
  const peakHourEntry = hourlyUsageFormatted.reduce(
    (max, cur) => (cur.bytes > max.bytes ? cur : max),
    hourlyUsageFormatted[0] ?? { hour: "0:00", bytes: 0 },
  );

  return {
    totalBytes: totalBytesTransferred,
    usersUsage: {
      topUsers,
      topImsis,
      topImeis,
    },
    sessionStats: {
      avgDuration: avgSessionDuration,
      maxDuration: maxSessionDuration,
      minDuration: minSessionDuration,
      maxConcurrency,
      totalSessions: rawIpdrsList.length,
      sessionFrequency,
      peakHour: peakHourEntry,
    },
    apps: {
      appPercentages,
      highRiskApps,
      communityAppUsage,
    },
    infra: {
      apnStats,
      ratStats,
      pgwStats,
    },
    traffic: {
      portHeatmap,
      highRiskIps,
      voipSessionCount,
      hourlyUsage: hourlyUsageFormatted,
      dailyTimeline: Object.entries(dailyTimeline).map(([date, bytes]) => ({ date, bytes })).sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}