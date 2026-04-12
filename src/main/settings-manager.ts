import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface BrowserSettings {
  homepage: string;
  searchEngine: string;
  clearDataOnExit: boolean;
  blockTrackers: boolean;
  showBookmarksBar: boolean;
  defaultZoom: number;
  torProxyUrl: string;
  autoConnectTor: boolean;
  downloadPath: string;
  askBeforeDownload: boolean;
  referrerPolicy: string;
  fingerprintProtection: boolean;
}

const DEFAULT_SETTINGS: BrowserSettings = {
  homepage: 'https://sa.atlasiant.com',
  searchEngine: 'Search Angel',
  clearDataOnExit: true,
  blockTrackers: true,
  showBookmarksBar: true,
  defaultZoom: 100,
  torProxyUrl: 'socks5://sa.atlasiant.com:9050',
  autoConnectTor: false,
  downloadPath: '',
  askBeforeDownload: false,
  referrerPolicy: 'no-referrer',
  fingerprintProtection: true,
};

function getStorePath(): string {
  try { return path.join(app.getPath('userData'), 'settings.json'); }
  catch { return path.join(process.env.HOME || '/tmp', '.atlasiant-browser-settings.json'); }
}

export class SettingsManager {
  private cache: BrowserSettings | null = null;

  private read(): BrowserSettings {
    if (this.cache) return this.cache;
    try {
      const data = JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
      this.cache = { ...DEFAULT_SETTINGS, ...data };
      return this.cache!;
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
      return this.cache;
    }
  }

  private write(data: BrowserSettings): void {
    this.cache = data;
    try { fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2)); }
    catch { /* ignore write errors during early startup */ }
  }

  getAll(): BrowserSettings {
    return { ...this.read() };
  }

  get<K extends keyof BrowserSettings>(key: K): BrowserSettings[K] {
    return this.read()[key];
  }

  set<K extends keyof BrowserSettings>(key: K, value: BrowserSettings[K]): void {
    const all = this.read();
    all[key] = value;
    this.write(all);
  }

  setMultiple(updates: Partial<BrowserSettings>): void {
    const all = this.read();
    Object.assign(all, updates);
    this.write(all);
  }

  reset(): void {
    this.write({ ...DEFAULT_SETTINGS });
  }
}
