import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "debt-ledger.sqlite");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const db = new DatabaseSync(DB_FILE);
db.exec(
  "PRAGMA foreign_keys = ON;" +
  "CREATE TABLE IF NOT EXISTS customers (" +
  "id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, notes TEXT DEFAULT '', created_at TEXT NOT NULL);" +
  "CREATE TABLE IF NOT EXISTS transactions (" +
  "id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE, " +
  "type TEXT NOT NULL CHECK (type IN ('debt', 'payment')), amount REAL NOT NULL CHECK (amount > 0), " +
  "date TEXT NOT NULL, note TEXT DEFAULT '', created_at TEXT NOT NULL);"
);

function ensureOptionalPhoneSchema() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'customers'").get();
  const hasUniquePhone = row && /phones+TEXTs+NOTs+NULLs+UNIQUE/i.test(row.sql || '');
  if (hasUniquePhone) {
    db.exec(
      "PRAGMA foreign_keys = OFF;" +
      "BEGIN TRANSACTION;" +
      "CREATE TABLE customers_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL);" +
      "INSERT INTO customers_new (id, name, phone, notes, created_at) SELECT id, name, COALESCE(phone, ''), COALESCE(notes, ''), created_at FROM customers;" +
      "DROP TABLE customers;" +
      "ALTER TABLE customers_new RENAME TO customers;" +
      "COMMIT;" +
      "PRAGMA foreign_keys = ON;"
    );
  }
  db.exec("UPDATE customers SET phone = '' WHERE phone IS NULL;");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_filled ON customers(phone) WHERE phone <> '';");
}

ensureOptionalPhoneSchema();

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

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
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

function seedDemo() {
  db.exec('DELETE FROM transactions; DELETE FROM customers;');
  const now = new Date().toISOString();
  const transactionTime = nowLocalValue();
  const customers = [
    { id: uid('cus'), name: 'أحمد محمود', phone: '01012345678', notes: 'عميل دائم' },
    { id: uid('cus'), name: 'منى حسن', phone: '01198765432', notes: 'استحقاق شهري' },
    { id: uid('cus'), name: 'سامي فوزي', phone: '01222223333', notes: 'يحتاج متابعة' },
    { id: uid('cus'), name: 'سارة أحمد', phone: '01056789011', notes: 'تجربة بحث' },
    { id: uid('cus'), name: 'محمد علي', phone: '01122334455', notes: 'عميل تجريبي' },
    { id: uid('cus'), name: 'أسماء فؤاد', phone: '01233445566', notes: 'منطقة شرق' },
    { id: uid('cus'), name: 'يوسف نبيل', phone: '01099887766', notes: 'متابعة أسبوعية' },
    { id: uid('cus'), name: 'نادية كمال', phone: '01544556677', notes: 'استحقاق آخر الشهر' },
    { id: uid('cus'), name: 'خالد جمال', phone: '01277889900', notes: 'بحث سريع' },
    { id: uid('cus'), name: 'مها سمير', phone: '01155667788', notes: 'عميل نشط' },
    { id: uid('cus'), name: 'عمرو شريف', phone: '01033221144', notes: 'خدمة متكررة' },
    { id: uid('cus'), name: 'ريم حسام', phone: '01566778899', notes: 'تجربة أرقام' },
    { id: uid('cus'), name: 'طارق وائل', phone: '01100998877', notes: 'عميل جديد' }
  ];
  const insertCustomer = db.prepare('INSERT INTO customers (id, name, phone, notes, created_at) VALUES (?, ?, ?, ?, ?)');
  const insertTxn = db.prepare('INSERT INTO transactions (id, customer_id, type, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const c of customers) insertCustomer.run(c.id, c.name, c.phone, c.notes, now);
  insertTxn.run(uid('trx'), customers[0].id, 'debt', 1200, transactionTime, 'فاتورة أولى', now);
  insertTxn.run(uid('trx'), customers[0].id, 'payment', 500, transactionTime, 'دفعة جزئية', now);
  insertTxn.run(uid('trx'), customers[1].id, 'debt', 750, transactionTime, 'توريد', now);
  insertTxn.run(uid('trx'), customers[2].id, 'debt', 300, transactionTime, 'خدمة', now);
  insertTxn.run(uid('trx'), customers[3].id, 'debt', 420, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[4].id, 'payment', 200, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[5].id, 'debt', 580, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[6].id, 'debt', 190, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[7].id, 'payment', 120, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[8].id, 'debt', 760, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[9].id, 'debt', 330, transactionTime, 'بيانات تجريبية', now);
  insertTxn.run(uid('trx'), customers[10].id, 'payment', 150, transactionTime, 'بيانات تجريبية', now);
}

function customersWithBalance() {
  const rows = db.prepare(
    "SELECT c.id, c.name, c.phone, c.notes, c.created_at AS createdAt, " +
    "COALESCE(SUM(CASE WHEN t.type = 'debt' THEN t.amount ELSE -t.amount END), 0) AS balance, " +
    "MAX(t.date) AS latestActivityDate, MAX(t.created_at) AS latestCreatedAt " +
    "FROM customers c LEFT JOIN transactions t ON t.customer_id = c.id " +
    "GROUP BY c.id ORDER BY balance DESC, c.name ASC"
  ).all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes || '',
    createdAt: row.createdAt,
    balance: Number(row.balance) || 0,
    latestActivityDate: row.latestActivityDate || null,
    latestCreatedAt: row.latestCreatedAt || row.createdAt || null
  }));
}

function summaryData() {
  const today = todayISO();
  const customers = customersWithBalance();
  const totalDebt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'debt'").get().total;
  const totalPaid = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'payment'").get().total;
  const todayTransactions = db.prepare('SELECT COUNT(*) AS total FROM transactions WHERE substr(date, 1, 10) = ?').get(today).total;
  const todayDebt = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE substr(date, 1, 10) = ? AND type = 'debt'").get(today).total;
  const todayPaid = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE substr(date, 1, 10) = ? AND type = 'payment'").get(today).total;
  return {
    customers: customers.length,
    active: customers.filter((customer) => customer.balance !== 0).length,
    totalDebt: Number(totalDebt) || 0,
    totalPaid: Number(totalPaid) || 0,
    todayTransactions: Number(todayTransactions) || 0,
    todayDebt: Number(todayDebt) || 0,
    todayPaid: Number(todayPaid) || 0,
    openCustomers: customers.filter((customer) => customer.balance > 0).length
  };
}

function findCustomer(id) {
  return db.prepare('SELECT id, name, phone, notes, created_at AS createdAt FROM customers WHERE id = ?').get(id) || null;
}

function statementForCustomer(customerId) {
  const rows = db.prepare('SELECT id, customer_id AS customerId, type, amount, date, note, created_at AS createdAt FROM transactions WHERE customer_id = ? ORDER BY date ASC, created_at ASC').all(customerId);
  let running = 0;
  return rows.map((row) => {
    running += row.type === 'debt' ? Number(row.amount) : -Number(row.amount);
    return { ...row, amount: Number(row.amount), note: row.note || '', runningBalance: running };
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname;

  if (pathname === '/api/health') return sendJson(res, 200, { ok: true, db: true });
  if (pathname === '/api/summary' && req.method === 'GET') return sendJson(res, 200, summaryData());
  if (pathname === '/api/customers' && req.method === 'GET') return sendJson(res, 200, customersWithBalance());
  if (pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, { customers: customersWithBalance(), ledger: db.prepare('SELECT id, customer_id AS customerId, type, amount, date, note, created_at AS createdAt FROM transactions ORDER BY created_at DESC').all(), selectedCustomerId: '' });

  if (pathname === '/api/seed' && req.method === 'POST') {
    seedDemo();
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/reset' && req.method === 'POST') {
    db.exec('DELETE FROM transactions; DELETE FROM customers;');
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
      const duplicate = db.prepare('SELECT id FROM customers WHERE phone = ? AND id <> ?').get(phone, id || '');
      if (duplicate) return sendJson(res, 400, { error: 'رقم الهاتف مسجل مسبقًا' });
    }
    let savedCustomerId = id;
    if (id) {
      db.prepare('UPDATE customers SET name = ?, phone = ?, notes = ? WHERE id = ?').run(name, phone, notes, id);
    } else {
      const customerId = uid('cus');
      savedCustomerId = customerId;
      const now = new Date().toISOString();
      db.prepare('INSERT INTO customers (id, name, phone, notes, created_at) VALUES (?, ?, ?, ?, ?)').run(customerId, name, phone, notes, now);
      const linkedType = body.linkedTransactionType === 'payment' ? 'payment' : 'debt';
      const linkedAmount = Number(body.linkedTransactionAmount || openingDebt || 0);
      const linkedDate = normalizeDateTime(body.linkedTransactionDate || openingDebtDate);
      const linkedNote = String(body.linkedTransactionNote || '').trim() || (linkedType === 'payment' ? 'دفع فلوس' : 'مديونية افتتاحية');
      if (linkedAmount > 0) {
        db.prepare('INSERT INTO transactions (id, customer_id, type, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uid('trx'), customerId, linkedType, linkedAmount, linkedDate, linkedNote, now);
      }
    }
    return sendJson(res, 200, { ok: true, customerId: savedCustomerId });
  }
  if (pathname.match(/^\/api\/customers\/[^/]+$/) && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return sendJson(res, 200, { ok: true });
  }
  if (pathname.match(/^\/api\/customers\/[^/]+\/statement$/) && req.method === 'GET') {
    const id = pathname.split('/')[3];
    const customer = findCustomer(id);
    if (!customer) return sendJson(res, 404, { error: 'العميل غير موجود' });
    const enriched = customersWithBalance().find((item) => item.id === id) || customer;
    return sendJson(res, 200, { customer: enriched, statement: statementForCustomer(id), latestActivityDate: enriched.latestActivityDate || null });
  }
  if (pathname === '/api/transactions' && req.method === 'POST') {
    const body = await parseBody(req);
    const customerId = String(body.customerId || '');
    const type = body.type === 'payment' ? 'payment' : 'debt';
    const amount = Number(body.amount);
    const date = normalizeDateTime(body.date || todayISO());
    const note = String(body.note || '').trim();
    if (!findCustomer(customerId)) return sendJson(res, 400, { error: 'العميل غير موجود' });
    if (!Number.isFinite(amount) || amount <= 0) return sendJson(res, 400, { error: 'المبلغ غير صحيح' });
    db.prepare('INSERT INTO transactions (id, customer_id, type, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uid('trx'), customerId, type, amount, date, note, new Date().toISOString());
    return sendJson(res, 200, { ok: true });
  }
  if (pathname.match(/^\/api\/transactions\/[^/]+$/) && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return sendJson(res, 200, { ok: true });
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('Debt ledger running on http://localhost:' + PORT);
});
