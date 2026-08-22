const api = {
  state: '/api/state',
  summary: '/api/summary',
  customers: '/api/customers',
  transactions: '/api/transactions',
  seed: '/api/seed',
  reset: '/api/reset'
};

const state = {
  customers: [],
  summary: {},
  selectedCustomerId: ''
};

const el = {
  stats: document.getElementById('stats'),
  reportGrid: document.getElementById('reportGrid'),
  customersTable: document.getElementById('customersTable'),
  statementTable: document.getElementById('statementTable'),
  statementTitle: document.getElementById('statementTitle'),
  statementSummary: document.getElementById('statementSummary'),
  searchResult: document.getElementById('searchResult'),
  searchInput: document.getElementById('phoneSearch'),
  searchSuggestions: document.getElementById('searchSuggestions'),
  transactionCustomer: document.getElementById('transactionCustomer'),
  transactionType: document.getElementById('transactionType'),
  transactionAmount: document.getElementById('transactionAmount'),
  transactionDate: document.getElementById('transactionDate'),
  transactionNote: document.getElementById('transactionNote'),
  transactionNoteLabel: document.getElementById('transactionNoteLabel'),
  transactionPaymentMethod: document.getElementById('transactionPaymentMethod'),
  paymentMethodField: document.getElementById('paymentMethodField'),
  customerForm: document.getElementById('customerForm'),
  customerId: document.getElementById('customerId'),
  customerName: document.getElementById('customerName'),
  customerPhone: document.getElementById('customerPhone'),
  openingDebt: document.getElementById('openingDebt'),
  openingDebtDate: document.getElementById('openingDebtDate'),
  customerNotes: document.getElementById('customerNotes'),
  linkedTransactionType: document.getElementById('linkedTransactionType'),
  linkedTransactionAmount: document.getElementById('linkedTransactionAmount'),
  linkedTransactionDate: document.getElementById('linkedTransactionDate'),
  linkedTransactionNote: document.getElementById('linkedTransactionNote'),
  linkedTransactionNoteLabel: document.getElementById('linkedTransactionNoteLabel'),
  linkedPaymentMethod: document.getElementById('linkedPaymentMethod'),
  linkedPaymentMethodField: document.getElementById('linkedPaymentMethodField'),
  clearCustomerForm: document.getElementById('clearCustomerForm'),
  scrollToSearch: document.getElementById('scrollToSearch'),
  seedDemo: document.getElementById('seedDemo'),
  exportAll: document.getElementById('exportAll'),
  resetAll: document.getElementById('resetAll'),
  exportCustomers: document.getElementById('exportCustomers'),
  exportLedger: document.getElementById('exportLedger'),
  transactionForm: document.getElementById('transactionForm'),
  customerReport: document.getElementById('customerReport'),
  confirmDialog: document.getElementById('confirmDialog'),
  dialogTitle: document.getElementById('dialogTitle'),
  dialogMessage: document.getElementById('dialogMessage'),
  dialogCancel: document.getElementById('dialogCancel'),
  dialogConfirm: document.getElementById('dialogConfirm')
};

const money = new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMoney(value) {
  return '<span class="money num" dir="ltr">' + money.format(value) + ' ج.م</span>';
}

function formatDateInline(value) {
  return '<span class="num" dir="ltr">' + formatDate(value) + '</span>';
}

function formatPhoneInline(value) {
  return value ? '<span class="num" dir="ltr">' + String(value) + '</span>' : '<span class="muted-text">بدون رقم</span>';
}

function typeLabel(type) {
  return type === 'payment' ? 'دفع فلوس' : 'أخذ من المحل';
}

function transactionDirection(type) {
  return type === 'payment'
    ? '<span class="direction-arrow payment" title="دفع">▲</span>'
    : '<span class="direction-arrow debt" title="أخذ">▼</span>';
}

function paymentNote(method, note) {
  const selectedMethod = String(method || '').trim();
  const cleanNote = String(note || '').trim();
  return [selectedMethod, cleanNote].filter(Boolean).join(' - ');
}

function transactionDetail(entry) {
  const note = String(entry.note || '').trim();
  if (entry.type === 'payment') return note || 'دفع فلوس';
  return note || 'أخذ من المحل';
}

function updateTransactionFields() {
  const isPayment = el.transactionType.value === 'payment';
  el.paymentMethodField.hidden = !isPayment;
  el.transactionNoteLabel.textContent = 'سبب الحركة - اكتبه بإيدك';
  el.transactionNote.placeholder = isPayment ? 'اكتب سبب الدفع أو رقم الإيصال...' : 'اكتب الحاجة اللي أخدها: تليفون، اسكرينة، جراب...';
}

function updateLinkedTransactionFields() {
  const isPayment = el.linkedTransactionType.value === 'payment';
  el.linkedPaymentMethodField.hidden = !isPayment;
  el.linkedTransactionNoteLabel.textContent = 'سبب الحركة - اكتبه بإيدك';
  el.linkedTransactionNote.placeholder = isPayment ? 'اكتب سبب الدفع أو رقم الإيصال...' : 'اكتب الحاجة اللي أخدها: تليفون، اسكرينة، جراب...';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowLocalInput() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeDateTimeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return nowLocalInput();
  return raw.length === 10 ? raw + 'T00:00' : raw;
}

function csvEscape(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}

async function request(path, options) {
  const response = await fetch(path, Object.assign({
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }
  }, options || {}));
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function customerById(id) {
  return state.customers.find(function (customer) { return customer.id === id; }) || null;
}

function customerByPhone(phone) {
  const normalized = normalizePhone(phone);
  return state.customers.find(function (customer) { return normalizePhone(customer.phone) === normalized; }) || null;
}

function sortCustomers(list) {
  return list.slice().sort(function (a, b) {
    return b.balance - a.balance || a.name.localeCompare(b.name, 'ar');
  });
}

function statementForCustomer(customerId) {
  const customer = customerById(customerId);
  if (!customer) return [];
  const ledger = state.statementMap && state.statementMap[customerId] ? state.statementMap[customerId] : [];
  return ledger.slice();
}

async function loadData(selectedCustomerId) {
  const [customers, summary] = await Promise.all([
    request(api.customers),
    request(api.summary)
  ]);
  state.customers = customers;
  state.summary = summary;
  const requestedCustomerId = arguments.length ? selectedCustomerId : state.selectedCustomerId;
  const customerExists = customers.some(function (customer) { return customer.id === requestedCustomerId; });
  state.selectedCustomerId = customerExists ? requestedCustomerId : (customers[0] ? customers[0].id : '');
  await loadStatementIfNeeded(state.selectedCustomerId);
  render();
}

state.statementCache = {};

async function loadStatementIfNeeded(customerId) {
  if (!customerId) return;
  if (state.statementCache[customerId]) return;
  const data = await request('/api/customers/' + encodeURIComponent(customerId) + '/statement');
  state.statementCache[customerId] = data;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/s+/g, ' ');
}

function normalizePhone(value) {
  const digits = String(value || '')
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, function (digit) {
      return '٠١٢٣٤٥٦٧٨٩'.indexOf(digit);
    })
    .replace(/\D/g, '');

  if (digits.startsWith('0020')) return digits.slice(4);
  if (digits.startsWith('20') && digits.length > 10) return digits.slice(2);
  return digits;
}

function phoneSearchKey(value) {
  return normalizePhone(value);
}

function searchMatches(query) {
  const rawTerm = normalizeText(query);
  const term = phoneSearchKey(query);
  if (!rawTerm && !term) return [];
  const ranked = state.customers
    .map(function (customer) {
      const name = normalizeText(customer.name);
      const phone = phoneSearchKey(customer.phone);
      let score = 0;
      if (term && phone === term) score += 120;
      if (rawTerm && name === rawTerm) score += 115;
      if (rawTerm && name.startsWith(rawTerm)) score += 85;
      if (term && phone.startsWith(term)) score += 70;
      if (rawTerm && name.includes(rawTerm)) score += 60;
      if (term && phone.includes(term)) score += 30;
      return { customer: customer, score: score };
    })
    .filter(function (item) { return item.score > 0; })
    .sort(function (a, b) {
      return b.score - a.score || a.customer.name.localeCompare(b.customer.name, 'ar');
    });
  return ranked.slice(0, 6).map(function (item) { return item.customer; });
}

function renderSuggestions() {
  const query = el.searchInput.value.trim();
  const suggestions = searchMatches(query);
  if (!query || !suggestions.length) {
    el.searchSuggestions.innerHTML = '';
    return;
  }
  el.searchSuggestions.innerHTML = suggestions.map(function (customer) {
    return '<button type="button" class="suggestion-item" data-action="suggest-customer" data-id="' + customer.id + '">' +
      '<strong>' + customer.name + '</strong>' +
      '<small>رقم: ' + formatPhoneInline(customer.phone) + ' · رصيد: ' + formatMoney(customer.balance) + '</small>' +
      '</button>';
  }).join('');
}

function renderStats() {
  const summary = state.summary || {};
  const cards = [
    ['عدد العملاء', summary.customers || 0],
    ['إجمالي المديونيات', formatMoney(summary.totalDebt || 0)],
    ['إجمالي المدفوعات', formatMoney(summary.totalPaid || 0)],
    ['حسابات مفتوحة', summary.openCustomers || 0]
  ];

  el.stats.innerHTML = cards.map(function (item) {
    return '<div class="stat"><div class="label">' + item[0] + '</div><div class="value">' + item[1] + '</div></div>';
  }).join('');

  const reportCards = [
    ['حركات اليوم', summary.todayTransactions || 0],
    ['ديون اليوم', formatMoney(summary.todayDebt || 0)],
    ['دفعات اليوم', formatMoney(summary.todayPaid || 0)],
    ['عملاء نشطون', summary.active || 0]
  ];

  el.reportGrid.innerHTML = reportCards.map(function (item) {
    return '<div class="report"><div class="label">' + item[0] + '</div><div class="value">' + item[1] + '</div></div>';
  }).join('');
}

function renderCustomerSelect() {
  const options = ['<option value="">اختر عميلًا</option>'].concat(
    state.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); }).map(function (customer) {
      return '<option value="' + customer.id + '">' + customer.name + (customer.phone ? ' - ' + customer.phone : ' - بدون رقم') + '</option>';
    })
  ).join('');
  el.transactionCustomer.innerHTML = options;
  el.transactionCustomer.value = state.selectedCustomerId || '';
}

function renderCustomersTable() {
  const rows = sortCustomers(state.customers).map(function (customer) {
    return '<tr>' +
      '<td>' + customer.name + '</td>' +
      '<td>' + formatPhoneInline(customer.phone) + '</td>' +
      '<td class="' + (customer.balance >= 0 ? 'amount-positive' : 'amount-negative') + '">' + formatMoney(customer.balance) + '</td>' +
      '<td>' + (customer.latestActivityDate ? formatDateInline(customer.latestActivityDate) : '-') + '</td>' +
      '<td><div class="inline-actions">' +
      '<button class="text-btn" data-action="select-customer" data-id="' + customer.id + '">كشف</button>' +
      '<button class="text-btn" data-action="edit-customer" data-id="' + customer.id + '">تعديل</button>' +
      '<button class="text-btn danger" data-action="delete-customer" data-id="' + customer.id + '">حذف</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');

  el.customersTable.innerHTML = rows || '<tr><td colspan="5">لا توجد بيانات بعد.</td></tr>';
}

function renderSearchResult() {
  const exactPhone = phoneSearchKey(el.searchInput.value);
  const exactName = normalizeText(el.searchInput.value);
  const customer = state.customers.find(function (item) {
    return (exactPhone && phoneSearchKey(item.phone) === exactPhone) || normalizeText(item.name) === exactName;
  }) || null;
  if (!el.searchInput.value.trim()) {
    el.searchResult.innerHTML = '<div class="search-empty"><strong>ابدأ بالاسم أو رقم الموبايل</strong><p>اكتب اسم العميل أو رقمه، وستظهر لك النتيجة والاقتراحات مباشرة.</p></div>';
    el.searchSuggestions.innerHTML = '';
    return;
  }
  if (!customer) {
    const matches = searchMatches(el.searchInput.value);
    el.searchResult.innerHTML = matches.length
      ? '<div class="search-empty warn"><strong>فيه نتائج قريبة</strong><p>اختار من الاقتراحات أو كمّل الاسم/الرقم.</p></div>'
      : '<div class="search-empty warn"><strong>لا توجد نتيجة</strong><p>راجع الاسم أو الرقم وحاول مرة تانية.</p></div>';
    renderSuggestions();
    return;
  }
  el.searchSuggestions.innerHTML = '';
  el.searchResult.innerHTML =
    '<div class="search-card">' +
      '<div class="search-card-head">' +
        '<div>' +
          '<p class="eyebrow">نتيجة البحث</p>' +
          '<h3>' + customer.name + '</h3>' +
          '<p class="search-phone">' + formatPhoneInline(customer.phone) + '</p>' +
        '</div>' +
        '<div class="search-balance ' + (customer.balance >= 0 ? 'positive' : 'negative') + '">' + formatMoney(customer.balance) + '</div>' +
      '</div>' +
      '<p class="search-notes">' + (customer.notes || 'لا توجد ملاحظات.') + '</p>' +
      '<button class="btn primary" data-action="open-statement" data-id="' + customer.id + '">فتح كشف الحساب</button>' +
    '</div>';
}

function renderStatement() {
  const customer = customerById(state.selectedCustomerId);
  if (!customer) {
    el.statementTitle.textContent = 'اختر عميلًا لعرض الكشـف';
    el.statementSummary.innerHTML = '';
    el.customerReport.innerHTML = '';
    el.statementTable.innerHTML = '<tr><td colspan="6">لا يوجد عميل محدد.</td></tr>';
    return;
  }

  const snapshot = state.statementCache[customer.id] || { statement: [] };
  const statement = snapshot.statement || [];
  const totalDebts = statement.filter(function (entry) { return entry.type === 'debt'; }).reduce(function (sum, entry) { return sum + entry.amount; }, 0);
  const totalPayments = statement.filter(function (entry) { return entry.type === 'payment'; }).reduce(function (sum, entry) { return sum + entry.amount; }, 0);
  const lastEntry = statement.length ? statement[statement.length - 1] : null;
  el.statementTitle.textContent = 'كشف حساب: ' + customer.name;
  el.statementSummary.innerHTML =
    '<div class="stat compact"><div class="label">الرصيد الحالي</div><div class="value">' + formatMoney(customer.balance) + '</div></div>' +
    '<div class="stat compact"><div class="label">عدد العمليات</div><div class="value num" dir="ltr">' + statement.length + '</div></div>' +
    '<div class="stat compact"><div class="label">رقم الهاتف</div><div class="value">' + formatPhoneInline(customer.phone) + '</div></div>' +
    '<div class="stat compact"><div class="label">آخر حركة</div><div class="value">' + (lastEntry ? formatDateInline(lastEntry.date) : '-') + '</div></div>';

  el.customerReport.innerHTML =
    '<div class="report-card">' +
      '<div><p class="eyebrow">تقرير العميل</p><h3>' + customer.name + '</h3><p>' + (customer.notes || 'لا توجد ملاحظات مسجلة.') + '</p></div>' +
      '<div class="report-metrics">' +
        '<span><b>' + formatMoney(totalDebts) + '</b><small>إجمالي المديونيات</small></span>' +
        '<span><b>' + formatMoney(totalPayments) + '</b><small>إجمالي المدفوعات</small></span>' +
        '<span><b>' + (lastEntry ? formatDateInline(lastEntry.date) : '-') + '</b><small>آخر حركة</small></span>' +
      '</div>' +
    '</div>';

  const rows = statement.map(function (entry) {
    return '<tr>' +
      '<td>' + formatDateInline(entry.date) + '</td>' +
      '<td>' + transactionDirection(entry.type) + '</td>' +
      '<td><span class="detail-text">' + transactionDetail(entry) + '</span><small class="type-hint">' + typeLabel(entry.type) + '</small></td>' +
      '<td>' + formatMoney(entry.amount) + '</td>' +
      '<td class="' + (entry.runningBalance >= 0 ? 'amount-positive' : 'amount-negative') + '">' + formatMoney(entry.runningBalance) + '</td>' +
      '<td><button class="text-btn danger" data-action="delete-transaction" data-id="' + entry.id + '">حذف</button></td>' +
      '</tr>';
  }).join('');

  el.statementTable.innerHTML = rows || '<tr><td colspan="6">لا توجد حركات لهذا العميل.</td></tr>';
}

function render() {
  renderStats();
  renderCustomerSelect();
  renderCustomersTable();
  renderSearchResult();
  renderStatement();
  renderSuggestions();
}

function clearCustomerForm() {
  el.customerId.value = '';
  el.customerName.value = '';
  el.customerPhone.value = '';
  el.openingDebt.value = '';
  el.openingDebtDate.value = nowLocalInput();
  el.openingDebt.disabled = false;
  el.openingDebtDate.disabled = false;
  el.linkedTransactionType.value = 'debt';
  el.linkedPaymentMethod.value = 'كاش';
  el.linkedTransactionAmount.value = '';
  el.linkedTransactionDate.value = nowLocalInput();
  el.linkedTransactionNote.value = '';
  updateLinkedTransactionFields();
  el.customerNotes.value = '';
  el.customerForm.querySelector("button[type='submit']").textContent = 'حفظ العميل';
}

function loadCustomerToForm(customer) {
  el.customerId.value = customer.id;
  el.customerName.value = customer.name;
  el.customerPhone.value = customer.phone;
  el.openingDebt.value = '';
  el.openingDebtDate.value = nowLocalInput();
  el.openingDebt.disabled = true;
  el.openingDebtDate.disabled = true;
  el.linkedTransactionType.value = 'debt';
  el.linkedPaymentMethod.value = 'كاش';
  el.linkedTransactionAmount.value = '';
  el.linkedTransactionDate.value = nowLocalInput();
  el.linkedTransactionNote.value = '';
  updateLinkedTransactionFields();
  el.customerNotes.value = customer.notes || '';
  el.customerForm.querySelector("button[type='submit']").textContent = 'تحديث العميل';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function confirmAction(title, message, onConfirm) {
  el.dialogTitle.textContent = title;
  el.dialogMessage.textContent = message;
  el.dialogConfirm.onclick = function () {
    el.confirmDialog.close();
    Promise.resolve(onConfirm()).catch(function (error) {
      alert(error.message || 'حدث خطأ أثناء تنفيذ الأمر');
    });
  };
  el.confirmDialog.showModal();
}

function exportCSV(filename, rows) {
  const csv = rows.map(function (row) {
    return row.map(csvEscape).join(',');
  }).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

async function handleAddCustomer(event) {
  event.preventDefault();
  try {
    const hasLinkedAmount = Number(el.linkedTransactionAmount.value || 0) > 0;
    const fallbackAmount = Number(el.openingDebt.value || 0);
    const linkedAmount = hasLinkedAmount ? Number(el.linkedTransactionAmount.value) : fallbackAmount;
    const linkedDate = hasLinkedAmount ? normalizeDateTimeInput(el.linkedTransactionDate.value) : normalizeDateTimeInput(el.openingDebtDate.value);
    const payload = {
      id: el.customerId.value,
      name: el.customerName.value.trim(),
      phone: el.customerPhone.value.trim(),
      notes: el.customerNotes.value.trim(),
      openingDebt: linkedAmount,
      openingDebtDate: linkedDate,
      linkedTransactionType: hasLinkedAmount ? el.linkedTransactionType.value : 'debt',
      linkedTransactionAmount: linkedAmount,
      linkedTransactionDate: linkedDate,
      linkedTransactionNote: hasLinkedAmount && el.linkedTransactionType.value === 'payment'
        ? paymentNote(el.linkedPaymentMethod.value, el.linkedTransactionNote.value)
        : (hasLinkedAmount ? el.linkedTransactionNote.value.trim() : 'مديونية افتتاحية')
    };
    const result = await request(api.customers, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.statementCache = {};
    clearCustomerForm();
    await loadData(result.customerId || state.selectedCustomerId);
  } catch (error) {
    alert(error.message);
  }
}

async function handleAddTransaction(event) {
  event.preventDefault();
  if (!el.transactionCustomer.value) {
    alert('اختر عميلًا أولًا');
    return;
  }
  try {
    const payload = {
      customerId: el.transactionCustomer.value,
      type: el.transactionType.value,
      amount: el.transactionAmount.value,
      date: normalizeDateTimeInput(el.transactionDate.value),
      note: el.transactionType.value === 'payment'
        ? paymentNote(el.transactionPaymentMethod.value, el.transactionNote.value)
        : el.transactionNote.value
    };
    await request(api.transactions, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    el.transactionAmount.value = '';
    el.transactionNote.value = '';
    el.transactionPaymentMethod.value = 'كاش';
    el.transactionDate.value = nowLocalInput();
    updateTransactionFields();
    state.statementCache = {};
    await loadData(el.transactionCustomer.value || state.selectedCustomerId);
  } catch (error) {
    alert(error.message);
  }
}

async function seedDemoData() {
  try {
    await request(api.seed, { method: 'POST' });
    state.statementCache = {};
    await loadData();
  } catch (error) {
    alert(error.message);
  }
}

async function resetAllData() {
  confirmAction('مسح البيانات', 'هل تريد حذف كل العملاء والحركات من هذا الجهاز؟', async function () {
    await request(api.reset, { method: 'POST' });
    state.statementCache = {};
    state.selectedCustomerId = '';
    await loadData('');
    clearCustomerForm();
  });
}

document.addEventListener('click', async function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.getAttribute('data-action');
  const id = button.getAttribute('data-id');

  if (action === 'select-customer' || action === 'open-statement') {
    window.location.href = 'statement.html?id=' + encodeURIComponent(id);
    return;
  }

  if (action === 'suggest-customer') {
    const customer = customerById(id);
    if (customer) {
      el.searchInput.value = customer.phone || customer.name;
      state.selectedCustomerId = id;
      await loadStatementIfNeeded(id);
      render();
    }
    return;
  }

  if (action === 'edit-customer') {
    const customer = customerById(id);
    if (customer) loadCustomerToForm(customer);
    return;
  }

  if (action === 'delete-customer') {
    confirmAction('حذف عميل', 'سيتم حذف العميل وكل الحركات المرتبطة به. هل أنت متأكد؟', async function () {
      await request(api.customers + '/' + encodeURIComponent(id), { method: 'DELETE' });
      if (state.selectedCustomerId === id) state.selectedCustomerId = '';
      state.statementCache = {};
      await loadData(state.selectedCustomerId);
    });
    return;
  }

  if (action === 'delete-transaction') {
    confirmAction('حذف حركة', 'هل تريد حذف هذه الحركة؟', async function () {
      await request(api.transactions + '/' + encodeURIComponent(id), { method: 'DELETE' });
      state.statementCache = {};
      await loadData(state.selectedCustomerId);
    });
  }
});

el.customerForm.addEventListener('submit', handleAddCustomer);
el.transactionType.addEventListener('change', updateTransactionFields);
el.linkedTransactionType.addEventListener('change', updateLinkedTransactionFields);
el.transactionForm.addEventListener('submit', handleAddTransaction);
el.searchInput.addEventListener('input', renderSearchResult);
el.transactionCustomer.addEventListener('change', function (event) {
  state.selectedCustomerId = event.target.value;
  loadStatementIfNeeded(state.selectedCustomerId).then(render);
});
el.clearCustomerForm.addEventListener('click', clearCustomerForm);
el.scrollToSearch.addEventListener('click', function () { el.searchInput.focus(); });
el.seedDemo.addEventListener('click', seedDemoData);
async function exportCustomersCSV() {
  try {
    const customers = await request(api.customers);
    exportCSV('customers.csv', [
      ['الاسم', 'الموبايل', 'الرصيد', 'الملاحظات'],
      ...customers.map(function (customer) {
        return [customer.name, customer.phone, customer.balance, customer.notes || ''];
      })
    ]);
  } catch (error) {
    alert(error.message);
  }
}

async function exportLedgerCSV() {
  try {
    const customers = await request(api.customers);
    const rows = [['العميل', 'التاريخ', 'النوع', 'المبلغ', 'الرصيد بعد الحركة', 'الملاحظة']];
    for (const customer of customers) {
      const snap = await request('/api/customers/' + encodeURIComponent(customer.id) + '/statement');
      const statement = snap.statement || [];
      statement.forEach(function (entry) {
        rows.push([
          customer.name,
          entry.date,
          typeLabel(entry.type),
          entry.amount,
          entry.runningBalance,
          entry.note || ''
        ]);
      });
    }
    exportCSV('ledger.csv', rows);
  } catch (error) {
    alert(error.message);
  }
}

el.exportCustomers.addEventListener('click', exportCustomersCSV);
el.exportLedger.addEventListener('click', exportLedgerCSV);
el.exportAll.addEventListener('click', async function () {
  await exportCustomersCSV();
  setTimeout(exportLedgerCSV, 250);
});
el.resetAll.addEventListener('click', resetAllData);
el.dialogCancel.addEventListener('click', function () { el.confirmDialog.close(); });
el.transactionDate.value = nowLocalInput();
el.openingDebtDate.value = nowLocalInput();
el.linkedTransactionDate.value = nowLocalInput();
updateTransactionFields();
updateLinkedTransactionFields();

(async function init() {
  try {
    await loadData();
    if (state.selectedCustomerId) {
      await loadStatementIfNeeded(state.selectedCustomerId);
      render();
    }
  } catch (error) {
    el.searchResult.innerHTML = '<p class="danger">فشل الاتصال بالخادم: ' + error.message + '</p>';
  }
})();
