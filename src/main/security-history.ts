import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BlockedRequestDetail } from './blocker';

export interface SecuritySnapshotRecord {
  id: string;
  tabId: number;
  title: string;
  url: string;
  domain: string;
  timestamp: number;
  privacyScore: number;
  isSecure: boolean;
  cookieCount: number;
  trackerCount: number;
  blockedRequests: number;
  thirdPartyCount: number;
  blockedDomains: string[];
}

export interface TrackerAggregateRecord {
  domain: string;
  blockedCount: number;
  resourceTypes: string[];
  lastSeen: number;
}

interface SecurityStore {
  snapshots: SecuritySnapshotRecord[];
  trackerAggregates: TrackerAggregateRecord[];
  stats: {
    totalPagesAnalyzed: number;
    totalBlockedRequests: number;
    totalSecurePages: number;
    totalInsecurePages: number;
    cumulativePrivacyScore: number;
  };
}

const STORE_PATH = path.join(app.getPath('userData'), 'security-history.json');

function createEmptyStore(): SecurityStore {
  return {
    snapshots: [],
    trackerAggregates: [],
    stats: {
      totalPagesAnalyzed: 0,
      totalBlockedRequests: 0,
      totalSecurePages: 0,
      totalInsecurePages: 0,
      cumulativePrivacyScore: 0,
    },
  };
}

export class SecurityHistoryManager {
  private cache: SecurityStore | null = null;
  private sessionStartedAt = Date.now();
  private sessionSnapshots: SecuritySnapshotRecord[] = [];
  private sessionTrackerMap: Map<string, TrackerAggregateRecord> = new Map();
  private latestSnapshotByTab: Map<number, string> = new Map();
  private sessionBlockedRequests = 0;

  private read(): SecurityStore {
    if (this.cache) return this.cache;

    try {
      this.cache = { ...createEmptyStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
      return this.cache!;
    } catch {
      this.cache = createEmptyStore();
      return this.cache;
    }
  }

  private write(store: SecurityStore): void {
    this.cache = store;
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  }

  private isTrackableUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private updateAggregate(list: TrackerAggregateRecord[], detail: BlockedRequestDetail): TrackerAggregateRecord[] {
    const existing = list.find(item => item.domain === detail.domain);
    if (existing) {
      existing.blockedCount += 1;
      existing.lastSeen = detail.timestamp;
      if (!existing.resourceTypes.includes(detail.resourceType)) {
        existing.resourceTypes.push(detail.resourceType);
      }
      return list;
    }

    list.push({
      domain: detail.domain,
      blockedCount: 1,
      resourceTypes: [detail.resourceType],
      lastSeen: detail.timestamp,
    });

    return list;
  }

  private updateSnapshotTracking(tabId: number, detail: BlockedRequestDetail): void {
    const latestSnapshotId = this.latestSnapshotByTab.get(tabId);
    if (!latestSnapshotId) return;

    const updateSnapshot = (snapshot: SecuritySnapshotRecord) => {
      snapshot.blockedRequests += 1;
      if (!snapshot.blockedDomains.includes(detail.domain)) {
        snapshot.blockedDomains.push(detail.domain);
        snapshot.trackerCount = snapshot.blockedDomains.length;
      }
    };

    const sessionSnapshot = this.sessionSnapshots.find(snapshot => snapshot.id === latestSnapshotId);
    if (sessionSnapshot) updateSnapshot(sessionSnapshot);

    const store = this.read();
    const persistedSnapshot = store.snapshots.find(snapshot => snapshot.id === latestSnapshotId);
    if (persistedSnapshot) {
      updateSnapshot(persistedSnapshot);
      this.write(store);
    }
  }

  recordSnapshot(input: Omit<SecuritySnapshotRecord, 'id' | 'timestamp' | 'blockedRequests'>): void {
    if (!this.isTrackableUrl(input.url)) return;

    const snapshot: SecuritySnapshotRecord = {
      ...input,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      blockedRequests: 0,
      blockedDomains: [...input.blockedDomains],
      trackerCount: input.blockedDomains.length || input.trackerCount,
    };

    this.sessionSnapshots.unshift(snapshot);
    this.sessionSnapshots = this.sessionSnapshots.slice(0, 120);
    this.latestSnapshotByTab.set(input.tabId, snapshot.id);

    const store = this.read();
    store.snapshots.unshift(snapshot);
    store.snapshots = store.snapshots.slice(0, 400);
    store.stats.totalPagesAnalyzed += 1;
    store.stats.cumulativePrivacyScore += snapshot.privacyScore;
    if (snapshot.isSecure) {
      store.stats.totalSecurePages += 1;
    } else {
      store.stats.totalInsecurePages += 1;
    }
    this.write(store);
  }

  recordBlockedRequest(tabId: number, detail: BlockedRequestDetail): void {
    this.sessionBlockedRequests += 1;

    const sessionAggregate = this.sessionTrackerMap.get(detail.domain);
    if (sessionAggregate) {
      sessionAggregate.blockedCount += 1;
      sessionAggregate.lastSeen = detail.timestamp;
      if (!sessionAggregate.resourceTypes.includes(detail.resourceType)) {
        sessionAggregate.resourceTypes.push(detail.resourceType);
      }
    } else {
      this.sessionTrackerMap.set(detail.domain, {
        domain: detail.domain,
        blockedCount: 1,
        resourceTypes: [detail.resourceType],
        lastSeen: detail.timestamp,
      });
    }

    const store = this.read();
    store.stats.totalBlockedRequests += 1;
    store.trackerAggregates = this.updateAggregate(store.trackerAggregates, detail)
      .sort((a, b) => b.blockedCount - a.blockedCount)
      .slice(0, 200);
    this.write(store);
    this.updateSnapshotTracking(tabId, detail);
  }

  getOverview() {
    const store = this.read();
    const averagePrivacyScore = store.stats.totalPagesAnalyzed > 0
      ? Math.round(store.stats.cumulativePrivacyScore / store.stats.totalPagesAnalyzed)
      : 100;
    const sessionAveragePrivacy = this.sessionSnapshots.length > 0
      ? Math.round(this.sessionSnapshots.reduce((sum, snapshot) => sum + snapshot.privacyScore, 0) / this.sessionSnapshots.length)
      : 100;

    return {
      currentSession: {
        startedAt: this.sessionStartedAt,
        pagesAnalyzed: this.sessionSnapshots.length,
        blockedRequests: this.sessionBlockedRequests,
        securePages: this.sessionSnapshots.filter(snapshot => snapshot.isSecure).length,
        insecurePages: this.sessionSnapshots.filter(snapshot => !snapshot.isSecure).length,
        averagePrivacyScore: sessionAveragePrivacy,
        recentPages: this.sessionSnapshots.slice(0, 20),
        topTrackers: Array.from(this.sessionTrackerMap.values()).sort((a, b) => b.blockedCount - a.blockedCount).slice(0, 12),
      },
      allTime: {
        pagesAnalyzed: store.stats.totalPagesAnalyzed,
        blockedRequests: store.stats.totalBlockedRequests,
        securePages: store.stats.totalSecurePages,
        insecurePages: store.stats.totalInsecurePages,
        averagePrivacyScore,
        recentPages: store.snapshots.slice(0, 40),
        topTrackers: [...store.trackerAggregates].sort((a, b) => b.blockedCount - a.blockedCount).slice(0, 20),
      },
    };
  }

  clear(): void {
    this.cache = createEmptyStore();
    this.sessionStartedAt = Date.now();
    this.sessionSnapshots = [];
    this.sessionTrackerMap.clear();
    this.latestSnapshotByTab.clear();
    this.sessionBlockedRequests = 0;
    this.write(this.cache);
  }
}
