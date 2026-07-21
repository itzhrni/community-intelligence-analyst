import {
  rawCdrsList,
  rawIpdrsList,
  findCdrCommunityByPhone,
  findIpdrClusterByIp,
} from "./telecom-data.server";

export interface EgoSearchResult {
  found: boolean;
  type?: "phone" | "ip" | "imei" | "imsi";
  value?: string;
  phones: string[];
  ips: string[];
  imeis: string[];
  imsis: string[];
  cdrCommunityId?: number;
  ipdrClusterId?: number;
}

export function resolveEgoEntity(query: string): EgoSearchResult {
  const clean = query.trim();
  if (!clean) return { found: false, phones: [], ips: [], imeis: [], imsis: [] };

  const phones = new Set<string>();
  const ips = new Set<string>();
  const imeis = new Set<string>();
  const imsis = new Set<string>();
  let type: "phone" | "ip" | "imei" | "imsi" | undefined;

  // 1. Identify query type and match starting records
  if (clean.startsWith("+91-") || /^\d{10}$/.test(clean)) {
    phones.add(clean.startsWith("+91-") ? clean : `+91-${clean}`);
    type = "phone";
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    ips.add(clean);
    type = "ip";
  } else if (clean.length === 14 && clean.startsWith("358")) {
    imeis.add(clean);
    type = "imei";
  } else if (clean.length === 15 && clean.startsWith("404")) {
    imsis.add(clean);
    type = "imsi";
  } else {
    // General fallback search
    type = "phone";
    phones.add(clean);
  }

  // 2. Scan CDR and IPDR to find all linked entities
  rawCdrsList.forEach((c) => {
    const matchesPhone = phones.has(c.caller) || phones.has(c.receiver);
    const matchesImei = imeis.has(c.imei);
    const matchesImsi = imsis.has(c.imsi);

    if (matchesPhone || matchesImei || matchesImsi) {
      if (c.caller) phones.add(c.caller);
      if (c.receiver) phones.add(c.receiver);
      if (c.imei) imeis.add(c.imei);
      if (c.imsi) imsis.add(c.imsi);
    }
  });

  rawIpdrsList.forEach((i) => {
    const matchesPhone = phones.has(i.phone);
    const matchesIp = ips.has(i.subscriber_ip);
    const matchesImei = imeis.has(i.imei);
    const matchesImsi = imsis.has(i.imsi);

    if (matchesPhone || matchesIp || matchesImei || matchesImsi) {
      if (i.phone) phones.add(i.phone);
      if (i.subscriber_ip) ips.add(i.subscriber_ip);
      if (i.imei) imeis.add(i.imei);
      if (i.imsi) imsis.add(i.imsi);
    }
  });

  const phoneList = Array.from(phones);
  const ipList = Array.from(ips);

  if (phoneList.length === 0 && ipList.length === 0) {
    return { found: false, phones: [], ips: [], imeis: [], imsis: [] };
  }

  let cdrCommunityId: number | undefined;
  let ipdrClusterId: number | undefined;

  for (const phone of phoneList) {
    const comm = findCdrCommunityByPhone(phone);
    if (comm) {
      cdrCommunityId = comm.id;
      break;
    }
  }

  for (const ip of ipList) {
    const clust = findIpdrClusterByIp(ip);
    if (clust) {
      ipdrClusterId = clust.id;
      break;
    }
  }

  return {
    found: true,
    type,
    value: clean,
    phones: phoneList,
    ips: ipList,
    imeis: Array.from(imeis),
    imsis: Array.from(imsis),
    cdrCommunityId,
    ipdrClusterId,
  };
}
