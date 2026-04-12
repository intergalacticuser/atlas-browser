import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon: string;
  folder: string;
  createdAt: number;
}

const STORE_PATH = path.join(app.getPath('userData'), 'bookmarks.json');

function readStore(): Bookmark[] {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return []; }
}

function writeStore(data: Bookmark[]): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export class BookmarkManager {
  getAll(): Bookmark[] {
    return readStore();
  }

  getByFolder(folder: string): Bookmark[] {
    return this.getAll().filter(b => b.folder === folder);
  }

  getBarBookmarks(): Bookmark[] {
    return this.getByFolder('bar');
  }

  add(title: string, url: string, favicon: string = '', folder: string = 'bar'): Bookmark {
    const bookmark: Bookmark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      url,
      favicon,
      folder,
      createdAt: Date.now(),
    };
    const all = this.getAll();
    all.push(bookmark);
    writeStore(all);
    return bookmark;
  }

  remove(id: string): boolean {
    const all = this.getAll();
    const filtered = all.filter(b => b.id !== id);
    if (filtered.length === all.length) return false;
    writeStore(filtered);
    return true;
  }

  update(id: string, updates: Partial<Bookmark>): boolean {
    const all = this.getAll();
    const idx = all.findIndex(b => b.id === id);
    if (idx < 0) return false;
    all[idx] = { ...all[idx], ...updates };
    writeStore(all);
    return true;
  }

  isBookmarked(url: string): boolean {
    return this.getAll().some(b => b.url === url);
  }

  findByUrl(url: string): Bookmark | undefined {
    return this.getAll().find(b => b.url === url);
  }

  getFolders(): string[] {
    const folders = new Set(this.getAll().map(b => b.folder));
    return Array.from(folders);
  }

  exportAll(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  importAll(json: string): number {
    const imported: Bookmark[] = JSON.parse(json);
    const all = this.getAll();
    let count = 0;
    for (const bm of imported) {
      if (!all.some(b => b.url === bm.url)) {
        all.push({ ...bm, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
        count++;
      }
    }
    writeStore(all);
    return count;
  }
}
