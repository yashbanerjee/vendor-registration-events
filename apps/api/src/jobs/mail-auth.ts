import { Resolver } from "node:dns/promises";

const dkimSelectors = ["hostingermail-a", "hostingermail-b", "hostingermail-c", "default", "google", "selector1", "selector2", "k1", "s1", "s2"];

export type MailAuth = {
  domain: string;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  dmarcName: string;
  dmarcValue: string;
};

export function spfPresent(records: string[][]) {
  return records.some((chunks) => chunks.join("").trim().toLowerCase().startsWith("v=spf1"));
}

export function dkimKeyPresent(records: string[][]) {
  return records.some((chunks) => {
    const key = /p=([A-Za-z0-9+/=]*)/.exec(chunks.join(""))?.[1] ?? "";
    return key.length >= 32;
  });
}

export function dmarcPresent(records: string[][]) {
  return records.some((chunks) => chunks.join("").trim().toLowerCase().startsWith("v=dmarc1"));
}

export async function lookupMailAuth(address: string): Promise<MailAuth | null> {
  const domain = address.trim().toLowerCase().split("@")[1] ?? "";
  if (!domain || domain === "localhost" || !domain.includes(".")) return null;
  const resolver = new Resolver();
  const [spf, dkim, dmarc] = await Promise.all([
    readTxt(resolver, domain).then(spfPresent),
    Promise.all(dkimSelectors.map((selector) => readTxt(resolver, `${selector}._domainkey.${domain}`))).then((groups) => groups.some(dkimKeyPresent)),
    readTxt(resolver, `_dmarc.${domain}`).then(dmarcPresent),
  ]);
  return {
    domain,
    spf,
    dkim,
    dmarc,
    dmarcName: `_dmarc.${domain}`,
    dmarcValue: `v=DMARC1; p=none; rua=mailto:${address.trim().toLowerCase()}`,
  };
}

function readTxt(resolver: Resolver, name: string) {
  return Promise.race<string[][]>([
    resolver.resolveTxt(name).catch(() => []),
    new Promise<string[][]>((resolve) => setTimeout(() => resolve([]), 4000)),
  ]);
}
