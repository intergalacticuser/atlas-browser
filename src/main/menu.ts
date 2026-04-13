import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { TabManager } from './tab-manager';

export function setupMenu(window: BrowserWindow, tabManager: TabManager): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Angle Browser',
      submenu: [
        { label: 'About Angle Browser', role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const p = path.join(__dirname, '..', '..', 'src', 'renderer', 'settings.html');
            tabManager.createTab(`file://${p}`);
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => tabManager.createTab(),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) tabManager.closeTab(tab.id);
          },
        },
        { type: 'separator' },
        {
          label: 'Open Location',
          accelerator: 'CmdOrCtrl+L',
          click: () => window.webContents.send('focus-address-bar'),
        },
        { type: 'separator' },
        {
          label: 'Downloads',
          accelerator: 'CmdOrCtrl+J',
          click: () => {
            const p = path.join(__dirname, '..', '..', 'src', 'renderer', 'downloads.html');
            tabManager.createTab(`file://${p}`);
          },
        },
        {
          label: 'Bookmarks',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            const p = path.join(__dirname, '..', '..', 'src', 'renderer', 'bookmarks.html');
            tabManager.createTab(`file://${p}`);
          },
        },
        {
          label: 'Internet Map',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            const p = path.join(__dirname, '..', '..', 'src', 'renderer', 'internet-map.html');
            tabManager.createTab(`file://${p}`);
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => tabManager.reload(),
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'CmdOrCtrl+Option+I',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) tab.view.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) {
              const z = tab.view.webContents.getZoomFactor();
              tab.view.webContents.setZoomFactor(Math.min(z + 0.1, 3));
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) {
              const z = tab.view.webContents.getZoomFactor();
              tab.view.webContents.setZoomFactor(Math.max(z - 0.1, 0.3));
            }
          },
        },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const tab = tabManager.getActiveTab();
            if (tab) tab.view.webContents.setZoomFactor(1);
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+[',
          click: () => tabManager.goBack(),
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+]',
          click: () => tabManager.goForward(),
        },
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => tabManager.goHome(),
        },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        {
          label: 'Bookmark This Page',
          accelerator: 'CmdOrCtrl+D',
          click: () => window.webContents.send('focus-address-bar'), // handled in renderer
        },
        {
          label: 'Show All Bookmarks',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            const p = path.join(__dirname, '..', '..', 'src', 'renderer', 'bookmarks.html');
            tabManager.createTab(`file://${p}`);
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
