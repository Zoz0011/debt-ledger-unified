import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const APP_ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || '';

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowLocalValue() {
  return new Date().toISOString().slice(0, 16);
}

function normalizeDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return nowLocalValue();
  return raw.length === 10 ? raw + 'T00:00' : raw;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  res.end(text);
}

function passwordsMatch(candidate) {
  if (!APP_ACCESS_PASSWORD || !candidate) return false;
  const expected = Buffer.from(APP_ACCESS_PASSWORD);
  const received = Buffer.from(String(candidate));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function isAuthorized(req) {
  return passwordsMatch(req.headers['x-app-password']);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const reqUrl = new URL(req.url, 'http://localhost');
  const rel = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const filePath = path.join(__dirname, path.normalize(rel).replace(/^(\.\.([\\/]|$))+/, ''));
  if (!filePath.startsWith(__dirname)) return sendText(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, 'Not found');
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  fs.createReadStream(filePath).pipe(res);
}

function ensureSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Supabase env vars missing: ' + missing.join(', '));
  }
}

function supabaseUrl(table, query) {
  const url = new URL(SUPABASE_URL + '/rest/v1/' + table);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function sb(table, options = {}) {
  ensureSupabase();
  const response = await fetch(supabaseUrl(table, options.query), {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation'
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error((data && (data.message || data.error || data.details)) || 'Supabase request failed');
  }
  return data;
}

async function allCustomersRaw() {
  return await sb('customers', {
    query: { select: 'id,name,phone,notes,created_at', order: 'name.asc' }
  });
}

async function allTransactionsRaw() {
  return await sb('transactions', {
    query: { select: 'id,customer_id,type,amount,date,note,created_at', order: 'date.asc,created_at.asc' }
  });
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

function mapTransaction(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    amount: Number(row.amount) || 0,
    date: row.date,
    note: row.note || '',
    createdAt: row.created_at
  };
}

async function customersWithBalance() {
  const [customers, transactions] = await Promise.all([allCustomersRaw(), allTransactionsRaw()]);
  const totals = new Map();
  const latest = new Map();

  transactions.forEach((row) => {
    const amount = Number(row.amount) || 0;
    const delta = row.type === 'debt' ? amount : -amount;
    totals.set(row.customer_id, (totals.get(row.customer_id) || 0) + delta);
    const old = latest.get(row.customer_id);
    if (!old || String(row.date) > String(old.date) || (row.date === old.date && String(row.created_at) > String(old.created_at))) {
      latest.set(row.customer_id, row);
    }
  });

  return customers.map((row) => {
    const customer = mapCustomer(row);
    const latestRow = latest.get(row.id);
    return {
      ...customer,
      balance: totals.get(row.id) || 0,
      latestActivityDate: latestRow ? latestRow.date : null,
      latestCreatedAt: latestRow ? latestRow.created_at : row.created_at
    };
  }).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'ar'));
}

async function summaryData() {
  const today = todayISO();
  const [customers, transactions] = await Promise.all([customersWithBalance(), allTransactionsRaw()]);
  const totalDebt = transactions.filter((row) => row.type === 'debt').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalPaid = transactions.filter((row) => row.type === 'payment').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const todayRows = transactions.filter((row) => String(row.date || '').slice(0, 10) === today);
  return {
    customers: customers.length,
    active: customers.filter((customer) => customer.balance !== 0).length,
    totalDebt,
    totalPaid,
    todayTransactions: todayRows.length,
    todayDebt: todayRows.filter((row) => row.type === 'debt').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    todayPaid: todayRows.filter((row) => row.type === 'payment').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    openCustomers: customers.filter((customer) => customer.balance > 0).length
  };
}

async function findCustomer(id) {
  const rows = await sb('customers', {
    query: { select: 'id,name,phone,notes,created_at', id: 'eq.' + id, limit: '1' }
  });
  return rows[0] ? mapCustomer(rows[0]) : null;
}

async function statementForCustomer(customerId) {
  const rows = await sb('transactions', {
    query: {
      select: 'id,customer_id,type,amount,date,note,created_at',
      customer_id: 'eq.' + customerId,
      order: 'date.asc,created_at.asc'
    }
  });
  let running = 0;
  return rows.map((row) => {
    running += row.type === 'debt' ? Number(row.amount) : -Number(row.amount);
    return { ...mapTransaction(row), runningBalance: running };
  });
}

async function resetData() {
  await sb('transactions', { method: 'DELETE', query: { id: 'not.is.null' }, prefer: 'return=minimal' });
  await sb('customers', { method: 'DELETE', query: { id: 'not.is.null' }, prefer: 'return=minimal' });
}

async function seedDemo() {
  await resetData();
  const now = new Date().toISOString();
  const transactionTime = nowLocalValue();
  const customers = [
    { id: uid('cus'), name: 'أحمد محمود', phone: '01012345678', notes: 'عميل دائم', created_at: now },
    { id: uid('cus'), name: 'منى حسن', phone: '01198765432', notes: 'استحقاق شهري', created_at: now },
    { id: uid('cus'), name: 'سامي فوزي', phone: '01222223333', notes: 'يحتاج متابعة', created_at: now },
    { id: uid('cus'), name: 'سارة أحمد', phone: '01056789011', notes: 'تجربة بحث', created_at: now },
    { id: uid('cus'), name: 'محمد علي', phone: '01122334455', notes: 'عميل تجريبي', created_at: now },
    { id: uid('cus'), name: 'أسماء فؤاد', phone: '01233445566', notes: 'منطقة شرق', created_at: now },
    { id: uid('cus'), name: 'يوسف نبيل', phone: '01099887766', notes: 'متابعة أسبوعية', created_at: now },
    { id: uid('cus'), name: 'نادية كمال', phone: '01544556677', notes: 'استحقاق آخر الشهر', created_at: now },
    { id: uid('cus'), name: 'خالد جمال', phone: '01277889900', notes: 'بحث سريع', created_at: now },
    { id: uid('cus'), name: 'مها سمير', phone: '01155667788', notes: 'عميل نشط', created_at: now },
    { id: uid('cus'), name: 'عمرو شريف', phone: '01033221144', notes: 'خدمة متكررة', created_at: now },
    { id: uid('cus'), name: 'ريم حسام', phone: '01566778899', notes: 'تجربة أرقام', created_at: now },
    { id: uid('cus'), name: 'طارق وائل', phone: '01100998877', notes: 'عميل جديد', created_at: now }
  ];
  await sb('customers', { method: 'POST', body: customers, prefer: 'return=minimal' });
  const tx = [
    [customers[0].id, 'debt', 1200, 'فاتورة أولى'],
    [customers[0].id, 'payment', 500, 'دفعة جزئية'],
    [customers[1].id, 'debt', 750, 'توريد'],
    [customers[2].id, 'debt', 300, 'خدمة'],
    [customers[3].id, 'debt', 420, 'بيانات تجريبية'],
    [customers[4].id, 'payment', 200, 'بيانات تجريبية'],
    [customers[5].id, 'debt', 580, 'بيانات تجريبية'],
    [customers[6].id, 'debt', 190, 'بيانات تجريبية'],
    [customers[7].id, 'payment', 120, 'بيانات تجريبية'],
    [customers[8].id, 'debt', 760, 'بيانات تجريبية'],
    [customers[9].id, 'debt', 330, 'بيانات تجريبية'],
    [customers[10].id, 'payment', 150, 'بيانات تجريبية']
  ].map(([customer_id, type, amount, note]) => ({
    id: uid('trx'),
    customer_id,
    type,
    amount,
    date: transactionTime,
    note,
    created_at: now
  }));
  await sb('transactions', { method: 'POST', body: tx, prefer: 'return=minimal' });
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health') return sendJson(res, 200, { ok: true, db: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY), storage: 'supabase' });
  if (!APP_ACCESS_PASSWORD) return sendJson(res, 503, { error: 'كلمة مرور التطبيق غير مضبوطة على الخادم.' });
  if (!isAuthorized(req)) return sendJson(res, 401, { error: 'كلمة المرور غير صحيحة أو انتهت الجلسة.' });
  if (pathname === '/api/summary' && req.method === 'GET') return sendJson(res, 200, await summaryData());
  if (pathname === '/api/customers' && req.method === 'GET') return sendJson(res, 200, await customersWithBalance());
  if (pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, { customers: await customersWithBalance(), ledger: (await allTransactionsRaw()).map(mapTransaction), selectedCustomerId: '' });

  if (pathname === '/api/seed' && req.method === 'POST') {
    await seedDemo();
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/reset' && req.method === 'POST') {
    await resetData();
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/customers' && req.method === 'POST') {
    const body = await parseBody(req);
    const id = body.id ? String(body.id) : '';
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const notes = String(body.notes || '').trim();
    const openingDebt = Number(body.openingDebt || 0);
    const openingDebtDate = normalizeDateTime(body.openingDebtDate || todayISO());
    if (!name) return sendJson(res, 400, { error: 'اسم العميل مطلوب' });
    if (openingDebt < 0 || !Number.isFinite(openingDebt)) return sendJson(res, 400, { error: 'المديونية الافتتاحية غير صحيحة' });
    if (phone) {
      const duplicate = await sb('customers', { query: { select: 'id', phone: 'eq.' + phone } });
      if (duplicate.some((row) => row.id !== id)) return sendJson(res, 400, { error: 'رقم الهاتف مسجل مسبقًا' });
    }

    let savedCustomerId = id;
    if (id) {
      await sb('customers', {
        method: 'PATCH',
        query: { id: 'eq.' + id },
        body: { name, phone, notes },
        prefer: 'return=minimal'
      });
    } else {
      const now = new Date().toISOString();
      savedCustomerId = uid('cus');
      await sb('customers', {
        method: 'POST',
        body: { id: savedCustomerId, name, phone, notes, created_at: now },
        prefer: 'return=minimal'
      });
      const linkedType = body.linkedTransactionType === 'payment' ? 'payment' : 'debt';
      const linkedAmount = Number(body.linkedTransactionAmount || openingDebt || 0);
      const linkedDate = normalizeDateTime(body.linkedTransactionDate || openingDebtDate);
      const linkedNote = String(body.linkedTransactionNote || '').trim() || (linkedType === 'payment' ? 'دفع فلوس' : 'مديونية افتتاحية');
      if (linkedAmount > 0) {
        await sb('transactions', {
          method: 'POST',
          body: { id: uid('trx'), customer_id: savedCustomerId, type: linkedType, amount: linkedAmount, date: linkedDate, note: linkedNote, created_at: now },
          prefer: 'return=minimal'
        });
      }
    }
    return sendJson(res, 200, { ok: true, customerId: savedCustomerId });
  }
  if (pathname.match(/^\/api\/customers\/[^/]+$/) && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    await sb('customers', { method: 'DELETE', query: { id: 'eq.' + id }, prefer: 'return=minimal' });
    return sendJson(res, 200, { ok: true });
  }
  if (pathname.match(/^\/api\/customers\/[^/]+\/statement$/) && req.method === 'GET') {
    const id = pathname.split('/')[3];
    const customer = await findCustomer(id);
    if (!customer) return sendJson(res, 404, { error: 'العميل غير موجود' });
    const enriched = (await customersWithBalance()).find((item) => item.id === id) || customer;
    return sendJson(res, 200, { customer: enriched, statement: await statementForCustomer(id), latestActivityDate: enriched.latestActivityDate || null });
  }
  if (pathname === '/api/transactions' && req.method === 'POST') {
    const body = await parseBody(req);
    const customerId = String(body.customerId || '');
    const type = body.type === 'payment' ? 'payment' : 'debt';
    const amount = Number(body.amount);
    const date = normalizeDateTime(body.date || todayISO());
    const note = String(body.note || '').trim();
    if (!(await findCustomer(customerId))) return sendJson(res, 400, { error: 'العميل غير موجود' });
    if (!Number.isFinite(amount) || amount <= 0) return sendJson(res, 400, { error: 'المبلغ غير صحيح' });
    await sb('transactions', {
      method: 'POST',
      body: { id: uid('trx'), customer_id: customerId, type, amount, date, note, created_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
    return sendJson(res, 200, { ok: true });
  }
  if (pathname.match(/^\/api\/transactions\/[^/]+$/) && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    await sb('transactions', { method: 'DELETE', query: { id: 'eq.' + id }, prefer: 'return=minimal' });
    return sendJson(res, 200, { ok: true });
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, pathname);
      if (handled !== null) return;
    }
    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'حدث خطأ في الخادم' });
  }
});

server.listen(PORT, () => {
  console.log('Debt ledger running on http://localhost:' + PORT);
});
