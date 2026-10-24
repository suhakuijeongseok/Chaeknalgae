const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const express = require('express');

const YES24_API_KEY = defineSecret('YES24_API_KEY');
const DATA4LIBRARY_KEY = defineSecret('DATA4LIBRARY_KEY');
const api = express();
api.disable('x-powered-by');
api.use(express.json({ limit: '20kb' }));

const cache = new Map();
const requests = new Map();
const CACHE_MS = 1000 * 60 * 30;
const LIMIT_WINDOW_MS = 1000 * 60;
const LIMIT_PER_WINDOW = 40;

function rateLimit(req, res, next) {
  const key = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now - current.started > LIMIT_WINDOW_MS) requests.set(key, { started: now, count: 1 });
  else if (++current.count > LIMIT_PER_WINDOW) return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  next();
}

api.use(rateLimit);

function clean(value) { return String(value || '').replace(/<[^>]*>/g, '').trim(); }
function yes24HighRes(url) {
  const value = String(url || '').replace(/^http:/, 'https:');
  return /^https:\/\/image\.yes24\.com\/goods\/\d+(?:\/(?:SIDE|BACK))?\/(?:S|M|L|XL)$/i.test(value) ? value.replace(/\/(?:S|M|L|XL)$/i, '/XL') : value;
}
function normalizeBook(item, source) {
  const rawIsbn = clean(item.isbn13 || item.isbn);
  const isbn = rawIsbn.split(/\s+/).find(value => value.length === 13) || rawIsbn.split(/\s+/)[0] || '';
  return { title: clean(item.bookname || item.title), author: Array.isArray(item.authors) ? item.authors.map(clean).join(', ') : clean(item.authors || item.author), publisher: clean(item.publisher), isbn, cover: yes24HighRes(item.bookImageURL || item.cover || item.thumbnail), coverFallback: item.cover || item.bookImageURL || item.thumbnail || '', sideCover: yes24HighRes(item.sideCover), backCover: yes24HighRes(item.backCover), description: clean(item.description || item.contents || item.contentDetail?.bookIntroduction || item.contentDetail?.bookSummary), pubDate: clean(item.publication_year || item.publication_date || item.pubDate || item.publishDate || item.datetime).slice(0, 10), link: item.link || item.url || '', totalPages: Number(item.pages) || 300, source };
}
async function requestJson(url, options = {}) {
  const key = url.toString(), hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.data;
  const response = await fetch(url, { ...options, headers: { 'User-Agent': 'Chaeknalgae/0.1', ...(options.headers || {}) }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`외부 도서 API 오류 (${response.status})`);
  const data = await response.json(); cache.set(key, { time: Date.now(), data }); return data;
}
function asyncRoute(handler) { return (req, res) => Promise.resolve(handler(req, res)).catch(error => { console.error(error); res.status(502).json({ error: error.message || '도서 API 요청에 실패했습니다.' }); }); }

api.get('/health', (_req, res) => res.json({ ok: true, service: 'chaeknalgae-api' }));

api.post('/search', asyncRoute(async (req, res) => {
  const query = clean(req.body.query).slice(0, 100), provider = req.body.provider === 'data4library' ? 'data4library' : 'yes24';
  if (!query) return res.status(400).json({ error: '검색어가 필요합니다.' });
  if (provider === 'data4library') {
    const url = new URL('https://data4library.kr/api/srchBooks');
    url.search = new URLSearchParams({ authKey: DATA4LIBRARY_KEY.value(), keyword: query, pageNo: '1', pageSize: '20', format: 'json' });
    const data = await requestJson(url);
    return res.json({ books: (data.response?.docs || []).map(x => normalizeBook(x.doc || x, '도서관 정보나루')).filter(x => x.title) });
  }
  const url = new URL('https://apis.yes24.com/v1/goods/itemList');
  url.search = new URLSearchParams({ query, category: 'BOOK', page: '1', pageSize: '20', detail: 'Y' });
  const data = await requestJson(url, { headers: { 'X-Api-Key': YES24_API_KEY.value() } });
  if (data.success === false) throw new Error(data.message || '예스24 API 요청에 실패했습니다.');
  res.json({ books: (data.data?.items || []).map(x => normalizeBook(x, '예스24')).filter(x => x.title) });
}));

api.post('/recommend', asyncRoute(async (req, res) => {
  const isbns = Array.isArray(req.body.isbns) ? req.body.isbns.map(clean).filter(x => /^\d{10,13}$/.test(x)).slice(0, 5) : [];
  const type = req.body.type === 'reader' ? 'reader' : 'mania';
  let endpoint = 'recommandList';
  const params = { authKey: DATA4LIBRARY_KEY.value(), format: 'json' };
  if (isbns.length) { params.isbn13 = isbns.join(';'); params.type = type; }
  else { endpoint = 'loanItemSrch'; const end = new Date(), start = new Date(end); start.setMonth(start.getMonth() - 1); Object.assign(params, { startDt: start.toISOString().slice(0, 10), endDt: end.toISOString().slice(0, 10), pageNo: '1', pageSize: '20' }); }
  const url = new URL(`https://data4library.kr/api/${endpoint}`); url.search = new URLSearchParams(params);
  const data = await requestJson(url);
  res.json({ books: (data.response?.docs || []).map(x => normalizeBook(x.doc || x, '도서관 정보나루')).filter(x => x.title) });
}));

exports.api = onRequest({ region: 'asia-northeast3', secrets: [YES24_API_KEY, DATA4LIBRARY_KEY], timeoutSeconds: 30, memory: '256MiB', maxInstances: 10, cors: false }, api);
