const money = new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const el = {
  title: document.getElementById('pageStatementTitle'),
  meta: document.getElementById('pageStatementMeta'),
  summary: document.getElementById('pageStatementSummary'),
  report: document.getElementById('pageCustomerReport'),
  table: document.getElementById('pageStatementTable'),
  print: document.getElementById('printStatement')
};

function formatMoney(value) {
  return '<span class="money num" dir="ltr">' + money.format(value) + ' ج.م</span>';
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

function formatDateInline(value) {
  return '<span class="num" dir="ltr">' + formatDate(value) + '</span>';
}

function formatPhoneInline(value) {
  return '<span class="num" dir="ltr">' + String(value || '') + '</span>';
}

async function request(path) {
  const response = await fetch(path, { cache: 'no-store', headers: { 'X-App-Password': sessionStorage.getItem('beiny-access-password-v1') || '' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'فشل تحميل البيانات');
  return data;
}

function render(data) {
  const customer = data.customer;
  const statement = data.statement || [];
  const totalDebts = statement.filter((entry) => entry.type === 'debt').reduce((sum, entry) => sum + entry.amount, 0);
  const totalPayments = statement.filter((entry) => entry.type === 'payment').reduce((sum, entry) => sum + entry.amount, 0);
  const lastEntry = statement.length ? statement[statement.length - 1] : null;

  el.title.textContent = 'كشف حساب: ' + customer.name;
  el.meta.innerHTML = 'رقم الهاتف: ' + formatPhoneInline(customer.phone) + ' · آخر تحديث: ' + formatDateInline(new Date().toISOString());

  el.summary.innerHTML =
    '<div class="stat compact"><div class="label">الرصيد الحالي</div><div class="value">' + formatMoney(customer.balance) + '</div></div>' +
    '<div class="stat compact"><div class="label">إجمالي المديونيات</div><div class="value">' + formatMoney(totalDebts) + '</div></div>' +
    '<div class="stat compact"><div class="label">إجمالي المدفوعات</div><div class="value">' + formatMoney(totalPayments) + '</div></div>' +
    '<div class="stat compact"><div class="label">آخر حركة</div><div class="value">' + (lastEntry ? formatDateInline(lastEntry.date) : '-') + '</div></div>';

  el.report.innerHTML =
    '<div class="report-card statement-report-card">' +
      '<div><p class="eyebrow">تقرير العميل</p><h3>' + customer.name + '</h3><p>' + (customer.notes || 'لا توجد ملاحظات مسجلة.') + '</p></div>' +
      '<div class="report-metrics">' +
        '<span><b class="num" dir="ltr">' + statement.length + '</b><small>عدد العمليات</small></span>' +
        '<span><b>' + formatPhoneInline(customer.phone) + '</b><small>رقم الهاتف</small></span>' +
      '</div>' +
    '</div>';

  el.table.innerHTML = statement.map(function (entry) {
    return '<tr>' +
      '<td>' + formatDateInline(entry.date) + '</td>' +
      '<td><span class="badge ' + entry.type + '">' + (entry.type === 'debt' ? 'مديونية' : 'دفعة') + '</span></td>' +
      '<td>' + formatMoney(entry.amount) + '</td>' +
      '<td class="' + (entry.runningBalance >= 0 ? 'amount-positive' : 'amount-negative') + '">' + formatMoney(entry.runningBalance) + '</td>' +
      '<td>' + (entry.note || '-') + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5">لا توجد حركات لهذا العميل.</td></tr>';
}

(async function init() {
  try {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) throw new Error('لا يوجد عميل محدد');
    const data = await request('/api/customers/' + encodeURIComponent(id) + '/statement');
    render(data);
  } catch (error) {
    el.title.textContent = 'تعذر تحميل كشف الحساب';
    el.meta.textContent = error.message;
    el.table.innerHTML = '<tr><td colspan="5">' + error.message + '</td></tr>';
  }
})();

el.print.addEventListener('click', function () {
  window.print();
});

