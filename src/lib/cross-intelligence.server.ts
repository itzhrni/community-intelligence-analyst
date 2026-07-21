import {
  rawCdrsList,
  rawIpdrsList,
  findCdrCommunityByPhone,
  findIpdrClusterByIp,
  type RawCdrRecord,
  type RawIpdrRecord,
} from "./telecom-data.server";

export interface UnifiedProfile {
  phones: string[];
  imsis: string[];
  imeis: string[];
  ips: string[];
  totalCalls: number;
  totalBytes: number;
  riskScore: number;
  riskLabel: "LOW" | "MEDIUM" | "HIGH";
  cdrCommunityId?: number;
  ipdrClusterId?: number;
}

export interface UnifiedTimelineEvent {
  id: string;
  type: "CALL" | "SMS" | "IPDR";
  timestamp: string;
  phone: string;
  imsi: string;
  imei: string;
  details: string;
  isSuspicious: boolean;
  btsIdOrIp: string;
}

export interface SuspiciousCorrelation {
  callRecord: RawCdrRecord;
  ipdrRecord: RawIpdrRecord;
  timeDifferenceSec: number;
  reason: string;
}

// Helper to determine risk label from score
function labelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 0.65) return "HIGH";
  if (score >= 0.38) return "MEDIUM";
  return "LOW";
}

// 1. Unified subscriber profile search
export function getUnifiedProfile(entity: string): UnifiedProfile {
  const clean = entity.trim();
  
  // Find initial matches
  const matchingCdrs = rawCdrsList.filter(
    (c) => c.caller === clean || c.receiver === clean || c.imei === clean || c.imsi === clean
  );
  const matchingIpdrs = rawIpdrsList.filter(
    (i) => i.phone === clean || i.imei === clean || i.imsi === clean || i.subscriber_ip === clean
  );

  const phones = new Set<string>();
  const imsis = new Set<string>();
  const imeis = new Set<string>();
  const ips = new Set<string>();

  // If search matches phone, imsi, imei directly, seed them
  if (clean.startsWith("+91-")) phones.add(clean);
  else if (clean.length === 15 && clean.startsWith("404")) imsis.add(clean);
  else if (clean.length === 14 && clean.startsWith("358")) imeis.add(clean);
  else if (clean.includes(".")) ips.add(clean);

  // Collect from matches
  matchingCdrs.forEach((c) => {
    if (c.caller) phones.add(c.caller);
    if (c.receiver) phones.add(c.receiver);
    if (c.imei) imeis.add(c.imei);
    if (c.imsi) imsis.add(c.imsi);
  });

  matchingIpdrs.forEach((i) => {
    if (i.phone) phones.add(i.phone);
    if (i.imei) imeis.add(i.imei);
    if (i.imsi) imsis.add(i.imsi);
    if (i.subscriber_ip) ips.add(i.subscriber_ip);
  });

  // Calculate cumulative stats
  const phoneList = Array.from(phones);
  const imsiList = Array.from(imsis);
  const imeiList = Array.from(imeis);
  const ipList = Array.from(ips);

  let totalCalls = 0;
  let totalBytes = 0;

  rawCdrsList.forEach((c) => {
    if (phoneList.includes(c.caller) || phoneList.includes(c.receiver)) {
      totalCalls++;
    }
  });

  rawIpdrsList.forEach((i) => {
    if (phoneList.includes(i.phone) || ipList.includes(i.subscriber_ip)) {
      totalBytes += i.bytes_transferred;
    }
  });

  // Determine CDR communities and IPDR clusters
  let cdrCommunityId: number | undefined;
  let ipdrClusterId: number | undefined;
  let maxRiskScore = 0.1;

  for (const phone of phoneList) {
    const comm = findCdrCommunityByPhone(phone);
    if (comm) {
      cdrCommunityId = comm.id;
      if (comm.risk_score > maxRiskScore) maxRiskScore = comm.risk_score;
    }
  }

  for (const ip of ipList) {
    const clust = findIpdrClusterByIp(ip);
    if (clust) {
      ipdrClusterId = clust.id;
      if (clust.risk_score > maxRiskScore) maxRiskScore = clust.risk_score;
    }
  }

  // Elevate risk if using multiple IMEIs/IMSIs
  if (imeiList.length > 1) maxRiskScore += 0.15;
  if (imsiList.length > 1) maxRiskScore += 0.15;
  maxRiskScore = Math.min(0.98, maxRiskScore);

  return {
    phones: phoneList,
    imsis: imsiList,
    imeis: imeiList,
    ips: ipList,
    totalCalls,
    totalBytes,
    riskScore: +maxRiskScore.toFixed(2),
    riskLabel: labelFromScore(maxRiskScore),
    cdrCommunityId,
    ipdrClusterId,
  };
}

// 2. Calls + Internet activity timeline
export function getUnifiedTimeline(entity: string): UnifiedTimelineEvent[] {
  const profile = getUnifiedProfile(entity);
  const events: UnifiedTimelineEvent[] = [];

  // Filter CDRs
  rawCdrsList.forEach((c) => {
    const isCaller = profile.phones.includes(c.caller);
    const isReceiver = profile.phones.includes(c.receiver);
    
    if (isCaller || isReceiver) {
      const isSuspicious = c.duration > 0 && c.duration < 5; // short calls
      const durationStr = c.type === "CALL" ? `duration: ${c.duration}s` : "SMS";
      
      events.push({
        id: c.id,
        type: c.type,
        timestamp: c.timestamp,
        phone: isCaller ? c.caller : c.receiver,
        imsi: c.imsi,
        imei: c.imei,
        details: `${c.type} ${isCaller ? "to" : "from"} ${isCaller ? c.receiver : c.caller} (${durationStr})`,
        isSuspicious,
        btsIdOrIp: c.bts_id,
      });
    }
  });

  // Filter IPDRs
  rawIpdrsList.forEach((i) => {
    if (profile.phones.includes(i.phone) || profile.ips.includes(i.subscriber_ip)) {
      const HIGH_RISK_APPS = new Set(["VPN-Tunnel", "Tor-Bridge", "Telegram", "Signal"]);
      const isSuspicious = HIGH_RISK_APPS.has(i.application) || i.dest_ip === "185.220.101.5" || i.dest_ip === "109.105.109.2";
      const bytesStr = (i.bytes_transferred / (1024 * 1024)).toFixed(2) + " MB";

      events.push({
        id: i.id,
        type: "IPDR",
        timestamp: i.timestamp,
        phone: i.phone,
        imsi: i.imsi,
        imei: i.imei,
        details: `Internet Session via APN '${i.apn}' using ${i.application} (${bytesStr}, ${i.duration_sec}s, destination: ${i.dest_ip}:${i.dest_port})`,
        isSuspicious,
        btsIdOrIp: i.subscriber_ip,
      });
    }
  });

  // Sort chronologically
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// 3. SIM swap detection
export interface SimSwapAnomaly {
  imei: string;
  phones: string[];
  imsis: string[];
  count: number;
}

export function getSIMSwapDetections(): SimSwapAnomaly[] {
  const imeiToImsis = new Map<string, Set<string>>();
  const imeiToPhones = new Map<string, Set<string>>();

  // Populate maps from CDRs
  rawCdrsList.forEach((c) => {
    if (!c.imei) return;
    if (!imeiToImsis.has(c.imei)) imeiToImsis.set(c.imei, new Set());
    if (!imeiToPhones.has(c.imei)) imeiToPhones.set(c.imei, new Set());

    if (c.imsi) imeiToImsis.get(c.imei)!.add(c.imsi);
    if (c.caller) imeiToPhones.get(c.imei)!.add(c.caller);
  });

  // Populate from IPDRs
  rawIpdrsList.forEach((i) => {
    if (!i.imei) return;
    if (!imeiToImsis.has(i.imei)) imeiToImsis.set(i.imei, new Set());
    if (!imeiToPhones.has(i.imei)) imeiToPhones.set(i.imei, new Set());

    if (i.imsi) imeiToImsis.get(i.imei)!.add(i.imsi);
    if (i.phone) imeiToPhones.get(i.imei)!.add(i.phone);
  });

  const anomalies: SimSwapAnomaly[] = [];
  imeiToImsis.forEach((imsis, imei) => {
    if (imsis.size > 1) {
      anomalies.push({
        imei,
        imsis: Array.from(imsis),
        phones: Array.from(imeiToPhones.get(imei) || []),
        count: imsis.size,
      });
    }
  });

  return anomalies.sort((a, b) => b.count - a.count);
}

// 4. Shared device detection
export interface SharedDeviceAnomaly {
  imei: string;
  phones: string[];
  count: number;
}

export function getSharedDeviceDetections(): SharedDeviceAnomaly[] {
  const imeiToPhones = new Map<string, Set<string>>();

  rawCdrsList.forEach((c) => {
    if (!c.imei) return;
    if (!imeiToPhones.has(c.imei)) imeiToPhones.set(c.imei, new Set());
    if (c.caller) imeiToPhones.get(c.imei)!.add(c.caller);
  });

  rawIpdrsList.forEach((i) => {
    if (!i.imei) return;
    if (!imeiToPhones.has(i.imei)) imeiToPhones.set(i.imei, new Set());
    if (i.phone) imeiToPhones.get(i.imei)!.add(i.phone);
  });

  const anomalies: SharedDeviceAnomaly[] = [];
  imeiToPhones.forEach((phones, imei) => {
    if (phones.size > 1) {
      anomalies.push({
        imei,
        phones: Array.from(phones),
        count: phones.size,
      });
    }
  });

  return anomalies.sort((a, b) => b.count - a.count);
}

// 5. Cross-community analysis
export interface CommunityOverlap {
  cdrCommunityId: number;
  ipdrClusterId: number;
  overlapCount: number;
  sharedPhones: string[];
}

export function getCrossCommunityAnalysis(): CommunityOverlap[] {
  const overlaps: Record<string, { cdr: number; ipdr: number; phones: Set<string> }> = {};

  rawCdrsList.forEach((c) => {
    const cdrComm = findCdrCommunityByPhone(c.caller);
    if (!cdrComm) return;

    // Look for matching IPDR records for the same caller
    const callerIpdrs = rawIpdrsList.filter((i) => i.phone === c.caller);
    callerIpdrs.forEach((ipdr) => {
      const ipdrClust = findIpdrClusterByIp(ipdr.subscriber_ip);
      if (!ipdrClust) return;

      const key = `${cdrComm.id}-${ipdrClust.id}`;
      if (!overlaps[key]) {
        overlaps[key] = {
          cdr: cdrComm.id,
          ipdr: ipdrClust.id,
          phones: new Set<string>(),
        };
      }
      overlaps[key].phones.add(c.caller);
    });
  });

  return Object.values(overlaps)
    .map((o) => ({
      cdrCommunityId: o.cdr,
      ipdrClusterId: o.ipdr,
      overlapCount: o.phones.size,
      sharedPhones: Array.from(o.phones),
    }))
    .sort((a, b) => b.overlapCount - a.overlapCount);
}

// 6. Correlation of suspicious calls and internet sessions
export function getSuspiciousCorrelations(entity?: string): SuspiciousCorrelation[] {
  let targetCdrs = rawCdrsList;
  let targetIpdrs = rawIpdrsList;

  if (entity) {
    const profile = getUnifiedProfile(entity);
    targetCdrs = rawCdrsList.filter(
      (c) => profile.phones.includes(c.caller) || profile.phones.includes(c.receiver)
    );
    targetIpdrs = rawIpdrsList.filter(
      (i) => profile.phones.includes(i.phone) || profile.ips.includes(i.subscriber_ip)
    );
  }

  const suspiciousCalls = targetCdrs.filter((c) => c.duration > 0 && c.duration < 5);
  const correlations: SuspiciousCorrelation[] = [];

  const HIGH_RISK_APPS = new Set(["VPN-Tunnel", "Tor-Bridge", "Telegram", "Signal"]);

  suspiciousCalls.forEach((call) => {
    const callTime = new Date(call.timestamp).getTime();

    // Look for IPDR sessions within ±5 minutes (300 seconds)
    targetIpdrs.forEach((ipdr) => {
      // Must be same phone/subscriber if general search, or matching profiles
      if (ipdr.phone === call.caller || ipdr.phone === call.receiver) {
        const ipdrTime = new Date(ipdr.timestamp).getTime();
        const diffMs = Math.abs(callTime - ipdrTime);
        
        if (diffMs <= 300 * 1000) {
          let reason = "";
          let score = 0;

          if (HIGH_RISK_APPS.has(ipdr.application)) {
            reason += `High-risk application '${ipdr.application}' active. `;
            score += 2;
          }
          if (ipdr.dest_ip === "185.220.101.5" || ipdr.dest_ip === "109.105.109.2") {
            reason += "Connected to Tor Exit node IP. ";
            score += 3;
          }
          if (call.duration < 5) {
            reason += "Suspicious short duration call. ";
            score += 1;
          }

          if (score >= 1) {
            correlations.push({
              callRecord: call,
              ipdrRecord: ipdr,
              timeDifferenceSec: Math.round(diffMs / 1000),
              reason: reason.trim(),
            });
          }
        }
      }
    });
  });

  return correlations.sort((a, b) => a.timeDifferenceSec - b.timeDifferenceSec);
}

// 7. Unified investigation summary
export function getUnifiedInvestigationSummary(entity: string): string {
  const profile = getUnifiedProfile(entity);
  const timeline = getUnifiedTimeline(entity);
  const correlations = getSuspiciousCorrelations(entity);

  const riskLabel = profile.riskLabel;
  const simSwapsCount = getSIMSwapDetections().filter((s) => profile.imeis.includes(s.imei)).length;
  const sharedDeviceCount = getSharedDeviceDetections().filter((s) => profile.imeis.includes(s.imei)).length;

  let summary = `INVESTIGATION BRIEFING FOR SUBSTANCE ENTITY: ${entity}\n`;
  summary += `==============================================\n\n`;
  summary += `RISK LEVEL: [${riskLabel}] (Risk Score: ${Math.round(profile.riskScore * 100)}%)\n\n`;
  
  summary += `IDENTIFIED CORRELATIONS & LINKED IDENTITY NODES:\n`;
  summary += `- Phone Numbers Associated: ${profile.phones.join(", ") || "None"}\n`;
  summary += `- IMSI (SIM Card) Associated: ${profile.imsis.join(", ") || "None"}\n`;
  summary += `- IMEI (Device Hardware) Associated: ${profile.imeis.join(", ") || "None"}\n`;
  summary += `- Subscriber IPs Used: ${profile.ips.join(", ") || "None"}\n`;
  if (profile.cdrCommunityId !== undefined) {
    summary += `- Assigned CDR Community: #${profile.cdrCommunityId}\n`;
  }
  if (profile.ipdrClusterId !== undefined) {
    summary += `- Assigned IPDR Cluster: #${profile.ipdrClusterId}\n`;
  }
  summary += `\n`;

  summary += `FORENSIC METRICS SUMMARY:\n`;
  summary += `- Total Call Detail Records: ${profile.totalCalls} calls\n`;
  summary += `- Total Data Volume Exchanged: ${(profile.totalBytes / (1024 * 1024)).toFixed(2)} MB\n`;
  summary += `- Chronological Events Logged: ${timeline.length} transactions\n`;
  summary += `\n`;

  summary += `DETECTED ANOMALIES:\n`;
  if (simSwapsCount > 0) {
    summary += `- [ALERT] SIM SWAP DETECTED: Hardware IMEI associated with multiple IMSIs.\n`;
  }
  if (sharedDeviceCount > 0) {
    summary += `- [ALERT] SHARED BURNER DEVICE DETECTED: Device IMEI shared among multiple subscriber phone numbers.\n`;
  }
  if (simSwapsCount === 0 && sharedDeviceCount === 0) {
    summary += `- No direct hardware/IMSI anomalies detected.\n`;
  }
  summary += `\n`;

  summary += `CO-OCCURRING CHRONOLOGICAL CORRELATIONS (CDR + IPDR):\n`;
  if (correlations.length > 0) {
    summary += `- Found ${correlations.length} instances of call activity and data traffic within a ±5-minute window.\n`;
    correlations.slice(0, 3).forEach((c, idx) => {
      summary += `  * Event ${idx + 1}: Short call coincided with data session using ${c.ipdrRecord.application} (Time Offset: ${c.timeDifferenceSec}s). Trigger: ${c.reason}\n`;
    });
  } else {
    summary += `- No simultaneous/co-occurring call and internet traffic alerts.\n`;
  }
  summary += `\n`;

  summary += `CONCLUSION:\n`;
  if (riskLabel === "HIGH") {
    summary += `Target shows high-risk markers including overlapping communities, multiple linked hardware profiles, and communication using secure encrypted tunnel/VoIP channels. Immediate surveillance and device tracking is advised.`;
  } else if (riskLabel === "MEDIUM") {
    summary += `Target shows intermediate threat markers. Advise continuous monitoring of BTS tower transitions and active destination IPs.`;
  } else {
    summary += `Target activity aligns with baseline community metrics. No immediate threat signature recognized.`;
  }

  return summary;
}
