const STORE_KEY = 'konnash-simple-ledger-v1';
const INTENTIONALLY_EMPTY_KEY = 'beiny-intentionally-empty-v1';
const AUTH_SESSION_KEY = 'beiny-supabase-session-v1';
const THEME_KEY = 'beiny-theme-v1';
const SUPABASE = window.BEINY_SUPABASE || {};
const STARTER_PHONES = new Set(['01012345678', '01198765432', '01222223333', '01056789012', '01544556677', '01133445566', '01099887766', '01277889900', '01566778899', '01100998877']);
const currency = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const state = {
  people: [],
  transactions: [],
  view: 'home',
  personFilter: 'all',
  activityFilter: 'all',
  search: '',
  selectedPersonId: '',
  transactionType: 'increase',
  paymentMethod: 'cash',
  editingTransactionId: ''
};

const el = {
  todayLabel: document.getElementById('todayLabel'),
  receivableTotal: document.getElementById('receivableTotal'),
  payableTotal: document.getElementById('payableTotal'),
  receivablePeople: document.getElementById('receivablePeople'),
  payablePeople: document.getElementById('payablePeople'),
  recentActivity: document.getElementById('recentActivity'),
  peopleList: document.getElementById('peopleList'),
  activityList: document.getElementById('activityList'),
  peopleSearch: document.getElementById('peopleSearch'),
  personDetail: document.getElementById('personDetail'),
  personTransactions: document.getElementById('personTransactions'),
  transactionDialog: document.getElementById('transactionDialog'),
  transactionForm: document.getElementById('transactionForm'),
  transactionPerson: document.getElementById('transactionPerson'),
  transactionPhone: document.getElementById('transactionPhone'),
  peopleOptions: document.getElementById('peopleOptions'),
  transactionAmount: document.getElementById('transactionAmount'),
  transactionNote: document.getElementById('transactionNote'),
  transactionDate: document.getElementById('transactionDate'),
  transactionKicker: document.getElementById('transactionKicker'),
  transactionTitle: document.getElementById('transactionTitle'),
  transactionSubmit: document.getElementById('transactionSubmit'),
  amountLabel: document.getElementById('amountLabel'),
  transactionTypes: document.getElementById('transactionTypes'),
  paymentMethods: document.getElementById('paymentMethods'),
  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmText: document.getElementById('confirmText'),
  confirmButton: document.getElementById('confirmButton'),
  exportButton: document.getElementById('exportButton'),
  exportProfileButton: document.getElementById('exportProfileButton'),
  starterButton: document.getElementById('starterButton'),
  clearButton: document.getElementById('clearButton'),
  aboutButton: document.getElementById('aboutButton'),
  themeButton: document.getElementById('themeButton'),
  themeProfileButton: document.getElementById('themeProfileButton'),
  themeStatus: document.getElementById('themeStatus'),
  profileEmail: document.getElementById('profileEmail'),
  logoutButton: document.getElementById('logoutButton'),
  loginGate: document.getElementById('loginGate'),
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  signupButton: document.getElementById('signupButton'),
  loginError: document.getElementById('loginError')
};

function id(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(amount) {
  return currency.format(Math.abs(Number(amount) || 0)) + ' ج.م';
}

function formatDate(date) {
  const value = new Date(String(date || '') + 'T12:00:00');
  return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function paymentMethodFromNote(note) {
  const prefix = String(note || '').split(' • ')[0];
  return Object.keys({ cash: 'كاش', instapay: 'إنستا', 'cash-payment': 'نقدي' }).find(function (key) { return paymentMethodLabel(key) === prefix; }) || 'cash';
}

function transactionNoteFromStorage(note) {
  const parts = String(note || '').split(' • ');
  return ['كاش', 'إنستا', 'نقدي'].includes(parts[0]) ? parts.slice(1).join(' • ') : String(note || '');
}

function storedTransactionNote(method, note) {
  const description = String(note || '').trim();
  return paymentMethodLabel(method) + (description ? ' • ' + description : '');
}

function session() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || 'null'); } catch { return null; }
}

function requireSession() {
  const value = session();
  if (!value || !value.access_token || !value.user || !value.user.id) {
    const error = new Error('سجّل الدخول أولًا.');
    error.status = 401;
    throw error;
  }
  return value;
}

async function supabaseRequest(path, options) {
  if (!SUPABASE.url || !SUPABASE.publishableKey) throw new Error('إعداد Supabase غير مكتمل.');
  const response = await fetch(SUPABASE.url.replace(/\/$/, '') + path, {
    cache: 'no-store',
    ...options,
    headers: {
      apikey: SUPABASE.publishableKey,
      'Content-Type': 'application/json',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    const error = new Error(data.message || data.msg || data.error_description || data.error || 'تعذر الاتصال بقاعدة البيانات.');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function db(table, options) {
  const current = requireSession();
  const query = new URLSearchParams(options && options.query ? options.query : {});
  const response = await supabaseRequest('/rest/v1/' + table + (query.toString() ? '?' + query.toString() : ''), {
    method: (options && options.method) || 'GET',
    headers: {
      Authorization: 'Bearer ' + current.access_token,
      Prefer: (options && options.prefer) || 'return=representation'
    },
    body: options && options.body == null ? undefined : JSON.stringify(options && options.body)
  });
  return response;
}

function showLogin(message) {
  el.loginGate.hidden = false;
  el.loginError.textContent = message || '';
  el.loginError.hidden = !message;
  setTimeout(function () { el.loginEmail.focus(); }, 0);
}

function hideLogin() {
  el.loginGate.hidden = true;
  el.loginError.hidden = true;
  el.loginEmail.value = '';
  el.loginPassword.value = '';
}

function preferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  if (persist) localStorage.setItem(THEME_KEY, next);
  el.themeButton.textContent = next === 'dark' ? '☀' : '☾';
  el.themeButton.title = next === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن';
  el.themeButton.setAttribute('aria-pressed', String(next === 'dark'));
  el.themeStatus.textContent = next === 'dark' ? 'الوضع الداكن مفعّل' : 'الوضع الفاتح مفعّل';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
}

async function signOut() {
  const current = session();
  try {
    if (current && current.access_token) {
      await supabaseRequest('/auth/v1/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + current.access_token } });
    }
  } catch (_) {
    // Removing the local session is enough to secure this device if the network is unavailable.
  } finally {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    state.people = [];
    state.transactions = [];
    state.selectedPersonId = '';
    setView('home', { history: false });
    showLogin('تم تسجيل الخروج بنجاح.');
  }
}

async function load() {
  const current = requireSession();
  const filters = { select: 'id,name,phone,notes,created_at', user_id: 'eq.' + current.user.id, order: 'name.asc' };
  const transactionFilters = { select: 'id,customer_id,type,amount,date,note,created_at', user_id: 'eq.' + current.user.id, order: 'date.asc,created_at.asc' };
  const results = await Promise.all([db('customers', { query: filters }), db('transactions', { query: transactionFilters })]);
  state.people = (results[0] || []).map(function (person) {
    return { id: person.id, name: person.name, phone: person.phone || '', note: person.notes || '', type: 'contact', createdAt: person.created_at };
  });
  state.transactions = (results[1] || []).map(function (entry) {
    const increase = entry.type === 'debt';
    return { id: entry.id, personId: entry.customer_id, type: increase ? 'increase' : 'decrease', amount: Number(entry.amount) || 0, delta: increase ? Number(entry.amount) || 0 : -(Number(entry.amount) || 0), method: paymentMethodFromNote(entry.note), note: transactionNoteFromStorage(entry.note), date: entry.date, createdAt: entry.created_at };
  });
}

function addStarterAccounts(force) {
  if (!force && (state.people.length || state.transactions.length || localStorage.getItem(INTENTIONALLY_EMPTY_KEY))) return false;
  if (state.people.some(function (person) { return STARTER_PHONES.has(person.phone); })) return false;
  const accounts = [
    ['محمود السيد', '01012345678', 'بقالة الحي'], ['سارة أحمد', '01198765432', 'طلبات منزلية'],
    ['خالد يوسف', '01222223333', ''], ['منى سمير', '01056789012', 'عميلة دائمة'],
    ['عمر حسام', '01544556677', ''], ['نور محمد', '01133445566', 'حساب أسبوعي'],
    ['عمرو عادل', '01099887766', ''], ['أسماء فؤاد', '01277889900', ''],
    ['طارق وائل', '01566778899', 'تسوية آخر الشهر'], ['هاني كمال', '01100998877', '']
  ].map(function (account) {
    return { id: id('person'), name: account[0], phone: account[1], note: account[2], type: 'contact', createdAt: new Date().toISOString() };
  });
  const date = function (daysAgo) {
    const value = new Date();
    value.setDate(value.getDate() - daysAgo);
    return value.toISOString().slice(0, 10);
  };
  const entry = function (personIndex, type, amount, daysAgo, method) {
    const delta = type === 'increase' ? amount : -amount;
    return { id: id('transaction'), personId: accounts[personIndex].id, type: type, amount: amount, delta: delta, method: method, note: '', date: date(daysAgo), createdAt: new Date().toISOString() };
  };
  state.people.push.apply(state.people, accounts);
  state.transactions.push.apply(state.transactions, [
    entry(0, 'increase', 2500, 9, 'cash'), entry(0, 'decrease', 500, 2, 'cash-payment'),
    entry(1, 'increase', 750, 7, 'instapay'), entry(2, 'decrease', 1200, 6, 'cash'),
    entry(3, 'increase', 600, 5, 'cash'), entry(3, 'decrease', 100, 1, 'instapay'),
    entry(4, 'decrease', 850, 8, 'cash-payment'), entry(4, 'increase', 200, 3, 'cash'),
    entry(5, 'increase', 950, 4, 'instapay'), entry(6, 'increase', 400, 6, 'cash'),
    entry(6, 'decrease', 150, 0, 'cash-payment'), entry(7, 'decrease', 300, 3, 'cash'),
    entry(8, 'increase', 1200, 2, 'instapay'), entry(9, 'increase', 275, 0, 'cash')
  ]);
  localStorage.removeItem(INTENTIONALLY_EMPTY_KEY);
  return true;
}

function personById(personId) {
  return state.people.find(function (person) { return person.id === personId; }) || null;
}

function balanceFor(personId) {
  return state.transactions.filter(function (entry) { return entry.personId === personId; }).reduce(function (total, entry) { return total + Number(entry.delta || 0); }, 0);
}

function personLabel(person) {
  return 'حساب';
}

function balanceLabel(person, amount) {
  if (amount > 0) return 'فلوس ليّا عنده';
  if (amount < 0) return 'فلوس ليه عندي';
  return 'الحساب متوازن';
}

function transactionInfo(type) {
  const info = {
    increase: { label: 'مبلغ ليّا عنده', delta: 1, category: 'owed', symbol: '↓', tone: 'receive' },
    decrease: { label: 'مبلغ ليه عندي', delta: -1, category: 'payment', symbol: '✓', tone: 'pay' },
    set: { label: 'ضبط الرصيد', delta: 0, category: 'owed', symbol: '≡', tone: 'receive' },
    'customer-debt': { label: 'زوّد عليه', delta: 1, category: 'owed', symbol: '↓', tone: 'receive' },
    'customer-payment': { label: 'نزّل منه', delta: -1, category: 'payment', symbol: '✓', tone: 'pay' },
    'supplier-debt': { label: 'نزّل منه', delta: -1, category: 'owed', symbol: '↑', tone: 'pay' },
    'supplier-payment': { label: 'زوّد عليه', delta: 1, category: 'payment', symbol: '✓', tone: 'receive' }
  };
  return info[type] || info.increase;
}

function paymentMethodLabel(method) {
  return { cash: 'كاش', instapay: 'إنستا', 'cash-payment': 'نقدي' }[method] || 'كاش';
}

function activeTransactions() {
  return state.transactions.slice().sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
  });
}

function renderActivity(target, transactions, emptyText) {
  if (!transactions.length) {
    target.innerHTML = '<div class="empty">' + escapeHtml(emptyText) + '<button type="button" data-open-transaction>＋ سجّل أول حركة</button></div>';
    return;
  }
  target.innerHTML = transactions.map(function (entry) {
    const person = personById(entry.personId);
    const info = transactionInfo(entry.type);
    const positive = Number(entry.delta) > 0;
    return '<article class="activity-item">' +
      '<span class="activity-symbol ' + info.tone + '">' + info.symbol + '</span>' +
      '<span class="activity-copy"><b>' + escapeHtml(person ? person.name : 'حساب محذوف') + '</b><small>' + info.label + ' · ' + paymentMethodLabel(entry.method) + (entry.note ? ' · ' + escapeHtml(entry.note) : '') + ' · ' + formatDate(entry.date) + '</small></span>' +
      '<span class="activity-side"><b class="activity-amount ' + (positive ? 'plus' : 'minus') + '">' + (positive ? '+ ' : '− ') + formatMoney(entry.amount) + '</b><span class="activity-actions"><button type="button" data-edit-transaction="' + entry.id + '">تعديل</button><button type="button" data-delete-transaction="' + entry.id + '">حذف</button></span></span>' +
    '</article>';
  }).join('');
}

function renderSummary() {
  const balances = state.people.map(function (person) { return { person: person, balance: balanceFor(person.id) }; });
  const receivables = balances.filter(function (entry) { return entry.balance > 0; });
  const payables = balances.filter(function (entry) { return entry.balance < 0; });
  const receiveTotal = receivables.reduce(function (sum, entry) { return sum + entry.balance; }, 0);
  const payTotal = payables.reduce(function (sum, entry) { return sum + Math.abs(entry.balance); }, 0);
  el.receivableTotal.textContent = formatMoney(receiveTotal);
  el.payableTotal.textContent = formatMoney(payTotal);
  el.receivablePeople.textContent = receivables.length ? receivables.length + ' شخص ليّا عنده' : 'لا توجد مبالغ ليّا';
  el.payablePeople.textContent = payables.length ? payables.length + ' شخص ليه عندي' : 'لا توجد مبالغ عليّ';
}

function renderPeople() {
  const query = el.peopleSearch.value.trim().toLowerCase();
  const filtered = state.people.filter(function (person) {
    const balance = balanceFor(person.id);
    const matchesType = state.personFilter === 'all' || (state.personFilter === 'receive' && balance > 0) || (state.personFilter === 'pay' && balance < 0);
    const searchable = (person.name + ' ' + (person.phone || '')).toLowerCase();
    return matchesType && (!query || searchable.includes(query));
  }).sort(function (a, b) { return Math.abs(balanceFor(b.id)) - Math.abs(balanceFor(a.id)) || a.name.localeCompare(b.name, 'ar'); });
  if (!filtered.length) {
    el.peopleList.innerHTML = '<div class="empty">لا توجد حسابات مطابقة.<button type="button" data-open-transaction>＋ أضف أول حساب</button></div>';
    return;
  }
  el.peopleList.innerHTML = filtered.map(function (person) {
    const balance = balanceFor(person.id);
    const initial = escapeHtml(person.name.trim().charAt(0) || '?');
    const tone = balance > 0 ? 'receive' : balance < 0 ? 'pay' : '';
    return '<button type="button" class="person-item" data-open-person-detail="' + person.id + '">' +
      '<span class="person-avatar ' + person.type + '">' + initial + '</span>' +
      '<span class="person-copy"><b>' + escapeHtml(person.name) + '</b><small>' + personLabel(person) + (person.phone ? ' · ' + escapeHtml(person.phone) : '') + '</small></span>' +
      '<span class="person-balance ' + tone + '">' + (balance ? formatMoney(balance) : 'متوازن') + '</span>' +
    '</button>';
  }).join('');
}

function renderActivityView() {
  const filtered = activeTransactions().filter(function (entry) {
    return state.activityFilter === 'all' || transactionInfo(entry.type).category === state.activityFilter;
  });
  renderActivity(el.activityList, filtered, 'لا توجد حركات بهذا النوع.');
}

function renderPersonDetail() {
  const person = personById(state.selectedPersonId);
  if (!person) {
    el.personDetail.innerHTML = '';
    el.personTransactions.innerHTML = '';
    return;
  }
  const balance = balanceFor(person.id);
  el.personDetail.innerHTML = '<div class="detail-person"><span class="person-avatar ' + person.type + '">' + escapeHtml(person.name.charAt(0)) + '</span><span><strong>' + escapeHtml(person.name) + '</strong><small>' + personLabel(person) + (person.phone ? ' · ' + escapeHtml(person.phone) : '') + '</small></span></div>' +
    '<div class="detail-balance"><small>' + balanceLabel(person, balance) + '</small><strong>' + formatMoney(balance) + '</strong></div>';
  const personEntries = activeTransactions().filter(function (entry) { return entry.personId === person.id; });
  renderActivity(el.personTransactions, personEntries, 'لم تسجّل أي حركة لهذا الحساب بعد.');
}

function renderTransactionPeople() {
  el.peopleOptions.innerHTML = state.people.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); }).map(function (person) {
    return '<option value="' + escapeHtml(person.name) + '">' + escapeHtml(person.phone || '') + '</option>';
  }).join('');
}

function render() {
  renderSummary();
  renderActivity(el.recentActivity, activeTransactions().slice(0, 4), 'لسه ما فيش حركات. سجّل أول دين أو دفعة.');
  renderPeople();
  renderActivityView();
  renderPersonDetail();
  renderTransactionPeople();
  const current = session();
  el.profileEmail.textContent = current && current.user && current.user.email ? current.user.email : 'دفترك محفوظ بأمان ومتزامن بين أجهزتك';
}

function setView(view, options) {
  const settings = options || {};
  state.view = view;
  document.querySelectorAll('[data-view-panel]').forEach(function (panel) {
    panel.classList.toggle('active', panel.dataset.viewPanel === view);
  });
  document.querySelectorAll('.bottom-nav [data-view]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.view === view);
  });
  if (settings.history !== false && window.history && window.history.pushState) {
    window.history.pushState({ view: view }, '', '#' + view);
  }
  window.scrollTo({ top: 0, behavior: settings.instant ? 'auto' : 'smooth' });
}

function keepBackInsideApp() {
  if (state.view !== 'home') setView('home', { history: false, instant: true });
  window.setTimeout(function () {
    window.history.pushState({ view: 'home', guard: true }, '', '#home');
  }, 0);
}

function initializeBackNavigation() {
  if (!window.history || !window.history.pushState) return;
  window.history.replaceState({ view: 'home' }, '', '#home');
  window.history.pushState({ view: 'home', guard: true }, '', '#home');
  window.addEventListener('popstate', keepBackInsideApp);
}

window.__beinyGoHome = keepBackInsideApp;

function openTransactionDialog(entry) {
  const editing = entry || null;
  state.editingTransactionId = editing ? editing.id : '';
  state.transactionType = 'increase';
  state.paymentMethod = 'cash';
  el.transactionForm.reset();
  el.transactionDate.value = today();
  el.transactionKicker.textContent = editing ? 'تصحيح حركة' : 'إضافة حساب وحركة';
  el.transactionTitle.textContent = editing ? 'عدّل الحركة واحفظ التغيير' : 'سجّل كل حاجة مرة واحدة';
  el.transactionSubmit.textContent = editing ? 'حفظ التعديل' : 'حفظ الحساب والحركة';
  el.transactionPerson.readOnly = Boolean(editing);
  el.transactionPhone.readOnly = Boolean(editing);
  if (editing) {
    const person = personById(editing.personId);
    state.transactionType = editing.type;
    state.paymentMethod = editing.method || 'cash';
    el.transactionPerson.value = person ? person.name : '';
    el.transactionPhone.value = person ? person.phone || '' : '';
    el.transactionAmount.value = editing.amount;
    el.transactionNote.value = editing.note || '';
    el.transactionDate.value = editing.date || today();
  }
  updateTransactionTypeButtons();
  updatePaymentMethodButtons();
  renderTransactionPeople();
  const selected = personById(state.selectedPersonId);
  if (selected && !editing) {
    el.transactionPerson.value = selected.name;
    el.transactionPhone.value = selected.phone || '';
  }
  el.transactionDialog.showModal();
  setTimeout(function () { el.transactionPerson.focus(); }, 0);
}

function updateTransactionTypeButtons() {
  el.transactionTypes.querySelectorAll('button').forEach(function (button) {
    button.classList.toggle('active', button.dataset.transactionType === state.transactionType);
  });
  const copy = { increase: 'المبلغ اللي ليا عنده', decrease: 'المبلغ اللي ليه عندي' };
  el.amountLabel.childNodes[0].nodeValue = copy[state.transactionType] || copy.increase;
  el.transactionAmount.min = '0.01';
}

function updatePaymentMethodButtons() {
  el.paymentMethods.querySelectorAll('button').forEach(function (button) {
    button.classList.toggle('active', button.dataset.paymentMethod === state.paymentMethod);
  });
}

async function saveTransaction(event) {
  event.preventDefault();
  const name = el.transactionPerson.value.trim();
  const phone = el.transactionPhone.value.trim();
  let person = state.people.find(function (item) { return item.name.trim().toLowerCase() === name.toLowerCase(); }) || null;
  const amount = Number(el.transactionAmount.value);
  const info = transactionInfo(state.transactionType);
  if (!name) {
    alert('اكتب اسم الشخص.');
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('اكتب مبلغًا صحيحًا.');
    return;
  }
  try {
    const current = requireSession();
    const date = el.transactionDate.value || today();
    const type = info.delta > 0 ? 'debt' : 'payment';
    const note = storedTransactionNote(state.paymentMethod, el.transactionNote.value);
    if (state.editingTransactionId) {
      const existing = state.transactions.find(function (item) { return item.id === state.editingTransactionId; });
      if (!existing) throw new Error('لم نعثر على الحركة المطلوب تعديلها.');
      await db('transactions', { method: 'PATCH', prefer: 'return=minimal', query: { id: 'eq.' + existing.id }, body: { customer_id: existing.personId, type: type, amount: amount, date: date, note: note } });
      state.selectedPersonId = existing.personId;
    } else if (!person) {
      const customerId = id('person');
      await db('customers', { method: 'POST', prefer: 'return=minimal', body: { id: customerId, user_id: current.user.id, name: name, phone: phone, notes: '', created_at: new Date().toISOString() } });
      await db('transactions', { method: 'POST', prefer: 'return=minimal', body: { id: id('transaction'), user_id: current.user.id, customer_id: customerId, type: type, amount: amount, date: date, note: note, created_at: new Date().toISOString() } });
      state.selectedPersonId = customerId;
    } else {
      if (phone && !person.phone) await db('customers', { method: 'PATCH', prefer: 'return=minimal', query: { id: 'eq.' + person.id }, body: { phone: phone } });
      await db('transactions', { method: 'POST', prefer: 'return=minimal', body: { id: id('transaction'), user_id: current.user.id, customer_id: person.id, type: type, amount: amount, date: date, note: note, created_at: new Date().toISOString() } });
      state.selectedPersonId = person.id;
    }
    localStorage.removeItem(INTENTIONALLY_EMPTY_KEY);
    await load();
    render();
    el.transactionDialog.close();
    setView('detail');
  } catch (error) {
    if (error.status === 401) showLogin('انتهت الجلسة. اكتب كلمة المرور مجددًا.');
    else alert(error.message || 'تعذر حفظ الحركة.');
  }
}

function confirmAction(title, text, action) {
  el.confirmTitle.textContent = title;
  el.confirmText.textContent = text;
  el.confirmButton.onclick = function () {
    el.confirmDialog.close();
    Promise.resolve(action()).catch(function (error) { alert(error.message || 'تعذر تنفيذ العملية.'); });
  };
  el.confirmDialog.showModal();
}

function csvEscape(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}

function downloadCsv() {
  const rows = [['النوع', 'الاسم', 'رقم الهاتف', 'الحركة', 'المبلغ', 'التاريخ', 'طريقة التعامل', 'الرصيد الحالي']];
  activeTransactions().forEach(function (entry) {
    const person = personById(entry.personId);
    if (!person) return;
    rows.push([personLabel(person), person.name, person.phone || '', transactionInfo(entry.type).label, entry.amount, entry.date, paymentMethodLabel(entry.method), balanceFor(person.id)]);
  });
  if (rows.length === 1) rows.push(['', 'لا توجد بيانات', '', '', '', '', '', '']);
  const blob = new Blob(['\ufeff' + rows.map(function (row) { return row.map(csvEscape).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'beiny-ledger.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', function (event) {
  const target = event.target.closest('[data-view], [data-open-person], [data-open-transaction], [data-open-person-detail], [data-person-filter], [data-activity-filter], [data-transaction-type], [data-payment-method], [data-edit-transaction], [data-delete-transaction]');
  if (!target) return;
  if (target.dataset.editTransaction) {
    const entry = state.transactions.find(function (item) { return item.id === target.dataset.editTransaction; });
    if (entry) openTransactionDialog(entry);
    return;
  }
  if (target.dataset.deleteTransaction) {
    const entry = state.transactions.find(function (item) { return item.id === target.dataset.deleteTransaction; });
    if (entry) confirmAction('حذف الحركة', 'سيتم حذف هذه الحركة فقط، ولن يمكن استرجاعها.', function () {
      return db('transactions', { method: 'DELETE', prefer: 'return=minimal', query: { id: 'eq.' + entry.id } }).then(function () { return load(); }).then(function () { render(); });
    });
    return;
  }
  if (target.dataset.view) {
    if (target.tagName === 'A') event.preventDefault();
    if (target.dataset.showBalance) {
      state.personFilter = target.dataset.showBalance;
      document.querySelectorAll('[data-person-filter]').forEach(function (button) { button.classList.toggle('active', button.dataset.personFilter === state.personFilter); });
      renderPeople();
    }
    setView(target.dataset.view);
    return;
  }
  if (target.hasAttribute('data-open-transaction')) { openTransactionDialog(); return; }
  if (target.dataset.openPersonDetail) { state.selectedPersonId = target.dataset.openPersonDetail; renderPersonDetail(); setView('detail'); return; }
  if (target.dataset.personFilter) { state.personFilter = target.dataset.personFilter; document.querySelectorAll('[data-person-filter]').forEach(function (button) { button.classList.toggle('active', button === target); }); renderPeople(); return; }
  if (target.dataset.activityFilter) { state.activityFilter = target.dataset.activityFilter; document.querySelectorAll('[data-activity-filter]').forEach(function (button) { button.classList.toggle('active', button === target); }); renderActivityView(); return; }
  if (target.dataset.transactionType) { state.transactionType = target.dataset.transactionType; updateTransactionTypeButtons(); renderTransactionPeople(); }
  if (target.dataset.paymentMethod) { state.paymentMethod = target.dataset.paymentMethod; updatePaymentMethodButtons(); }
});

el.peopleSearch.addEventListener('input', renderPeople);
el.transactionForm.addEventListener('submit', saveTransaction);
el.exportButton.addEventListener('click', downloadCsv);
el.exportProfileButton.addEventListener('click', downloadCsv);
el.starterButton.addEventListener('click', function () {
  confirmAction('إضافة حسابات جاهزة', 'سيتم إضافة ١٠ حسابات وحركات لتجربة التطبيق. يمكنك مسحها من الإعدادات لاحقًا.', function () {
    alert('الحسابات الجاهزة غير متاحة بعد التحويل إلى الحسابات الآمنة. أضف حسابك الأول من زر إضافة حركة.');
  });
});
el.clearButton.addEventListener('click', function () {
  confirmAction('مسح كل البيانات', 'سيتم حذف كل الحسابات والحركات من الدفتر على كل أجهزتك.', function () {
    const current = requireSession();
    return db('transactions', { method: 'DELETE', prefer: 'return=minimal', query: { user_id: 'eq.' + current.user.id } }).then(function () {
      return db('customers', { method: 'DELETE', prefer: 'return=minimal', query: { user_id: 'eq.' + current.user.id } });
    }).then(function () {
      state.people = [];
      state.transactions = [];
      state.selectedPersonId = '';
      localStorage.setItem(INTENTIONALLY_EMPTY_KEY, 'true');
      render();
      setView('home');
    });
  });
});
document.querySelectorAll('.close-dialog').forEach(function (button) {
  button.addEventListener('click', function () {
    const dialog = button.closest('dialog');
    if (dialog) dialog.close('cancel');
  });
});

el.aboutButton.addEventListener('click', function () { alert('صافي: تطبيق بسيط للحسابات بينك وبين الناس.'); });
el.themeButton.addEventListener('click', toggleTheme);
el.themeProfileButton.addEventListener('click', toggleTheme);
el.logoutButton.addEventListener('click', function () {
  confirmAction('تسجيل الخروج', 'سيتم تسجيل خروجك من هذا الجهاز فقط، وستظل بياناتك محفوظة في حسابك.', signOut);
});

el.todayLabel.textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
el.transactionDate.value = today();
applyTheme(preferredTheme(), false);
initializeBackNavigation();
el.loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  try {
    const result = await supabaseRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: el.loginEmail.value.trim(), password: el.loginPassword.value }) });
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(result));
    await load();
    hideLogin();
    render();
  } catch (error) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    showLogin(error.message || 'تعذر الدخول.');
  }
});

el.signupButton.addEventListener('click', async function () {
  const email = el.loginEmail.value.trim();
  const passwordValue = el.loginPassword.value;
  if (!email || passwordValue.length < 8) return showLogin('اكتب بريدًا صحيحًا وكلمة مرور من ٨ أحرف على الأقل.');
  try {
    await supabaseRequest('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: passwordValue }) });
    showLogin('أُرسل رابط تأكيد إلى بريدك. افتحه ثم سجّل الدخول من هنا.');
  } catch (error) {
    showLogin(error.message || 'تعذر إنشاء الحساب.');
  }
});

(async function start() {
  if (!session()) return showLogin();
  try {
    await load();
    hideLogin();
    render();
  } catch (error) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    showLogin(error.status === 401 ? 'انتهت الجلسة. سجّل الدخول مجددًا.' : error.message);
  }
})();
