const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const appConfig = require('../app-config.json');

let mainWindow;
const apiBaseUrl = process.env.CHAEKNALGAE_API_URL || appConfig.firebaseApiBaseUrl;
async function requestJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Chaeknalgae/0.1' } });
  if (!response.ok) throw new Error(`API 요청 실패 (${response.status})`);
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error('API 응답을 해석하지 못했습니다. 인증키를 확인해 주세요.'); }
}

function normalizeBook(item, source) {
  const clean = (value) => String(value || '').replace(/<[^>]*>/g, '').trim();
  return { title: clean(item.bookname || item.title), author: clean(item.authors || item.author), publisher: clean(item.publisher), isbn: clean(item.isbn13 || item.isbn), cover: item.bookImageURL || item.cover || '', description: clean(item.description), pubDate: clean(item.publication_year || item.publication_date || item.pubDate), link: item.link || '', source };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f1e8',
    title: '책날개',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'geolocation');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'geolocation'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('올바른 PNG 이미지가 아닙니다.');
  return Buffer.from(match[1], 'base64');
}

ipcMain.handle('wallpaper:save', async (_event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '책날개 배경화면 저장',
    defaultPath: path.join(app.getPath('pictures'), '책날개-배경화면.png'),
    filters: [{ name: 'PNG 이미지', extensions: ['png'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, decodeDataUrl(dataUrl));
  return { canceled: false, path: result.filePath };
});

ipcMain.handle('wallpaper:apply', async (_event, dataUrl) => {
  const target = path.join(app.getPath('userData'), 'chaeknalgae-wallpaper.png');
  await fs.writeFile(target, decodeDataUrl(dataUrl));
  const script = path.join(__dirname, 'set-wallpaper.ps1');
  await new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ImagePath', target], { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
  return { path: target };
});

ipcMain.handle('books:search', async (_event, { query, provider }) => {
  const keyword = String(query || '').trim();
  if (!keyword) return [];
  const data = await callBackend('/search', { query: keyword, provider });
  return data.books || [];
});

ipcMain.handle('books:recommend', async (_event, { isbns, type = 'mania' }) => {
  const data = await callBackend('/recommend', { isbns, type });
  return data.books || [];
});

async function callBackend(route, body) {
  if (!apiBaseUrl || apiBaseUrl.includes('YOUR_FIREBASE_PROJECT_ID')) throw new Error('Firebase 프로젝트 주소가 아직 설정되지 않았습니다.');
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `책날개 서버 오류 (${response.status})`);
  return data;
}
