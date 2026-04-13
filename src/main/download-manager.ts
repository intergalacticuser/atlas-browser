import { Session, DownloadItem, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface DownloadRecord {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startTime: number;
}

const STORE_PATH = path.join(app.getPath('userData'), 'downloads.json');
function readDL(): DownloadRecord[] { try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return []; } }
function writeDL(d: DownloadRecord[]): void { fs.writeFileSync(STORE_PATH, JSON.stringify(d, null, 2)); }

export class DownloadManager {
  private activeDownloads: Map<string, DownloadItem> = new Map();
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  setup(session: Session): void {
    session.on('will-download', (_event, item, _webContents) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const filename = item.getFilename();
      const savePath = path.join(app.getPath('downloads'), filename);
      item.setSavePath(savePath);

      this.activeDownloads.set(id, item);

      const record: DownloadRecord = {
        id,
        filename,
        url: item.getURL(),
        savePath,
        totalBytes: item.getTotalBytes(),
        receivedBytes: 0,
        state: 'progressing',
        startTime: Date.now(),
      };

      // Save to history
      const all = readDL();
      all.unshift(record);
      writeDL(all);

      // Notify renderer
      this.window.webContents.send('download-started', record);

      item.on('updated', (_e, state) => {
        record.receivedBytes = item.getReceivedBytes();
        record.totalBytes = item.getTotalBytes();
        record.state = state === 'progressing' ? 'progressing' : 'interrupted';
        this.updateRecord(record);
        this.window.webContents.send('download-progress', record);
      });

      item.once('done', (_e, state) => {
        record.receivedBytes = item.getReceivedBytes();
        record.state = state === 'completed' ? 'completed' : 'cancelled';
        this.updateRecord(record);
        this.activeDownloads.delete(id);
        this.window.webContents.send('download-done', record);
      });
    });
  }

  getHistory(): DownloadRecord[] {
    return readDL();
  }

  clearHistory(): void {
    writeDL([]);
  }

  pause(id: string): void {
    this.activeDownloads.get(id)?.pause();
  }

  resume(id: string): void {
    this.activeDownloads.get(id)?.resume();
  }

  cancel(id: string): void {
    this.activeDownloads.get(id)?.cancel();
  }

  private updateRecord(record: DownloadRecord): void {
    const all = readDL();
    const idx = all.findIndex(d => d.id === record.id);
    if (idx >= 0) {
      all[idx] = record;
      writeDL(all);
    }
  }
}
