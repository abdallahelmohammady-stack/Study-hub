/* ================================================================
   🎓 StudyHub — مركز الدراسة (نسخة 1)
   ----------------------------------------------------------------
   موقع واحد يجمعلك:
   1) 📚 تقدّمك في موقع المواد (قسم اتصالات وحاسبات)
   2) 🗺️ تقدّمك في الكورسات الهندسية (قسم الاتصالات والحاسبات)
   3) 🛡️ تقدّمك في رود ماب الأمن السيبراني (الموقع كله)
   4) ✅ مهامك الشخصية اللي بتضيفها بنفسك

   إزاي بيشتغل؟ كل موقع من التلاتة ليه زرار «⬇️ حمّل تقدمي» —
   بتدوسه فيتنزّل ملف JSON صغير، وترفعه هنا من كارت المصدر.
   ده بيشتغل عبر المواقع المختلفة لأن كل موقع محفوظ تقدمه لوحده
   في متصفحك (localStorage لينكه منفصل).

   مفاتيح التخزين (كلها studyhub_* — مبتقربش من أي موقع تاني):
     studyhub_tasks_v1   → مهامك
     studyhub_sources_v1 → آخر تقدم مستورد من المواقع التلاتة
     studyhub_links_v1   → لينكات المواقع (عشان زرار «افتح الموقع»)
     studyhub_theme_v1   → 'dark' / 'light' / غير موجود = حسب جهازك
   ================================================================ */
'use strict';

/* ---------------- الثوابت ---------------- */
const TASKS_KEY = 'studyhub_tasks_v1';
const SOURCES_KEY = 'studyhub_sources_v1';
const LINKS_KEY = 'studyhub_links_v1';
const THEME_KEY = 'studyhub_theme_v1';

/* تعريف المصادر التلاتة المربوطة — ثابتة، بس اسم الملف واللون بيتقروا من هنا */
const SOURCES_DEF = [
  { key: 'materials', app: 'eng-materials',          file: 'materials-progress.json', title: 'موقع المواد',            scope: 'قسم اتصالات وحاسبات',        icon: 'fa-book',        hex: '#6366f1' },
  { key: 'roadmap',   app: 'eng-roadmap',            file: 'roadmap-progress.json',   title: 'الكورسات الهندسية',      scope: 'قسم الاتصالات والحاسبات',      icon: 'fa-route',       hex: '#0ea5e9' },
  { key: 'cyber',     app: 'cyberpentest-roadmap',   file: 'cyber-progress.json',     title: 'رود ماب الأمن السيبراني', scope: 'الموقع كله (٥ أقسام)',        icon: 'fa-shield-halved', hex: '#06b6d4' }
];

/* تصنيفات المهام + الأولويات */
const CATS = [
  { id: 'study',    name: 'مذاكرة', icon: 'fa-book-open',      hex: '#0ea5e9' },
  { id: 'project',  name: 'مشروع',  icon: 'fa-diagram-project', hex: '#8b5cf6' },
  { id: 'course',   name: 'كورس',   icon: 'fa-laptop-code',    hex: '#06b6d4' },
  { id: 'personal', name: 'شخصي',   icon: 'fa-house',          hex: '#10b981' }
];
const PRIOS = [
  { id: 'high', name: 'عالية',   hex: '#f43f5e' },
  { id: 'med',  name: 'متوسطة', hex: '#f59e0b' },
  { id: 'low',  name: 'منخفضة', hex: '#10b981' }
];
const FILTERS = [
  { id: 'all',     name: 'الكل' },
  { id: 'late',    name: 'متأخرة' },
  { id: 'today',   name: 'النهارده' },
  { id: 'waiting', name: 'قيد التنفيذ' },
  { id: 'done',    name: 'مكتملة' }
];

/* ---------------- أدوات صغيرة ---------------- */
const $ = id => document.getElementById(id);
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function pctOf(d, t) { return t > 0 ? Math.round((d / t) * 100) : 0; }

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

function showToast(msg, isErr) {
  const root = $('toasts'); if (!root) return;
  const el = document.createElement('div');
  el.className = 'sh-toast' + (isErr ? ' err' : '');
  el.innerHTML = '<i class="fa ' + (isErr ? 'fa-circle-xmark text-rose-400' : 'fa-circle-check text-emerald-400') + '"></i><span>' + esc(msg) + '</span>';
  el.onclick = () => el.remove();
  root.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 3800);
}

/* تواريخ: كل المقارنات على بداية اليوم المحلي (من غير ساعات عشان المنطقة الزمنية) */
function dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function todayStart() { return dayStart(new Date()); }
function parseDue(s) { // 'YYYY-MM-DD' → تاريخ محلي
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]);
}
function dueState(task) { // 'late' | 'today' | 'soon' | 'future' | 'none'
  const d = parseDue(task.due);
  if (!d) return 'none';
  const diff = Math.round((dayStart(d) - todayStart()) / 86400000);
  if (diff < 0) return 'late';
  if (diff === 0) return 'today';
  if (diff <= 2) return 'soon';
  return 'future';
}
function dueLabel(task) {
  const d = parseDue(task.due); if (!d) return '';
  const diff = Math.round((dayStart(d) - todayStart()) / 86400000);
  if (diff < 0) return 'متأخر ' + (diff === -1 ? 'بيوم' : 'من ' + (-diff) + ' يوم');
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'بكره';
  if (diff <= 7) return 'بعد ' + diff + ' يوم';
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}
function relTime(ts) { // «آخر مزامنة من …» بصيغة مصرية بسيطة
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'دلوقتي حالًا';
  if (m < 60) return 'من ' + m + ' دقيقة';
  const h = Math.floor(m / 60);
  if (h < 24) return 'من ' + h + ' ساعة';
  const d = Math.floor(h / 24);
  if (d === 1) return 'إمبارح';
  if (d < 30) return 'من ' + d + ' يوم';
  return new Date(ts).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------------- الحالة (تتحفظ محليًا على جهازك بس) ---------------- */
function normalizeTask(t) { // توافقية: أي مهمة قديمة ناقصها حقول تتكمّل بقيم افتراضية
  return {
    id: String(t.id || uid()),
    title: String(t.title || '').slice(0, 200),
    note: String(t.note || '').slice(0, 600),
    cat: CATS.some(c => c.id === t.cat) ? t.cat : 'study',
    prio: PRIOS.some(p => p.id === t.prio) ? t.prio : 'med',
    due: typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '',
    done: !!t.done,
    createdAt: t.createdAt || Date.now(),
    doneAt: t.doneAt || null
  };
}
let tasks = readJSON(TASKS_KEY, []).map(normalizeTask);
let sources = readJSON(SOURCES_KEY, {});
let links = readJSON(LINKS_KEY, {});
let filter = 'all';
let editingId = null;       // null = مودال إضافة / id = مودال تعديل

const saveTasks = () => writeJSON(TASKS_KEY, tasks);
const saveSources = () => writeJSON(SOURCES_KEY, sources);
const saveLinks = () => writeJSON(LINKS_KEY, links);

function taskStats() {
  const done = tasks.filter(t => t.done).length;
  return { total: tasks.length, done: done, pct: pctOf(done, tasks.length) };
}
function sourcesStats() { // متوسط نسب المصادر اللي عندها إجمالي معروف بس
  let t = 0, d = 0, imported = 0, lastSync = 0;
  SOURCES_DEF.forEach(def => {
    const s = sources[def.key];
    if (!s) return;
    imported++;
    if (s.importedAt > lastSync) lastSync = s.importedAt;
    if (s.stats && typeof s.stats.total === 'number' && s.stats.total > 0) { t += s.stats.total; d += Math.min(s.stats.done || 0, s.stats.total); }
  });
  return { total: t, done: d, pct: pctOf(d, t), imported: imported, lastSync: lastSync };
}

/* ---------------- الثيم (حفظ > جهازك) ---------------- */
function savedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
function isDark() { return document.documentElement.classList.contains('dark'); }
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  document.documentElement.classList.toggle('dark', next === 'dark');
  paintThemeBtn();
}
function paintThemeBtn() {
  document.querySelectorAll('[data-theme-icon]').forEach(el => {
    el.className = 'fa ' + (isDark() ? 'fa-sun' : 'fa-moon') + ' text-base';
  });
}
/* متابعة تفضيل الجهاز لو المستخدم مثبّتش اختيار (الوضع التلقائي) */
try {
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSys = () => { if (!savedTheme()) { document.documentElement.classList.toggle('dark', !!mq.matches); paintThemeBtn(); } };
    if (mq.addEventListener) mq.addEventListener('change', onSys);
    else if (mq.addListener) mq.addListener(onSys);
  }
} catch (e) {}

/* ---------------- حلقة تقدم SVG ---------------- */
function ringSVG(pct, size, hex, gid) {
  const r = (size - 12) / 2, c = +(2 * Math.PI * r).toFixed(1);
  const off = +(c * (1 - Math.min(pct, 100) / 100)).toFixed(1);
  return '<svg class="sh-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' + hex + '"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs>' +
    '<circle class="track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="10"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="url(#' + gid + ')" stroke-width="10" ' +
    'stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/></svg>';
}

/* ---------------- الهيدر + البطل ---------------- */
function headerHTML() {
  return '<header class="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-[#0a0f1c]/85 backdrop-blur-md">' +
    '<div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">' +
      '<div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-cyan-500/25 bg-gradient-to-br from-cyan-500 to-indigo-600 flex-shrink-0"><i class="fa fa-graduation-cap"></i></div>' +
      '<div class="min-w-0">' +
        '<h1 class="font-black text-lg sm:text-xl leading-tight" dir="ltr">Study<span class="text-cyan-500">Hub</span></h1>' +
        '<p class="text-[11px] text-slate-400 dark:text-slate-500 -mt-0.5">مركز الدراسة — مهامك وتقدمك في مكان واحد</p>' +
      '</div>' +
      '<div class="mr-auto flex items-center gap-2">' +
        '<button onclick="exportAll()" title="نسخة احتياطية كاملة (مهام + مصادر)" class="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"><i class="fa fa-cloud-arrow-down"></i><span class="hidden sm:inline">نسخة احتياطية</span></button>' +
        '<button onclick="$(\'file-import-backup\').click()" title="استرجاع نسخة احتياطية" class="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-2 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"><i class="fa fa-cloud-arrow-up"></i><span class="hidden sm:inline">استرجاع</span></button>' +
        '<button onclick="toggleTheme()" title="الوضع الليلي/النهاري" class="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-md"><i data-theme-icon class="fa fa-moon text-base"></i></button>' +
      '</div>' +
    '</div>' +
  '</header>';
}

function heroHTML() {
  const ts = taskStats(), ss = sourcesStats();
  const pooledT = ts.total + ss.total, pooledD = ts.done + ss.done;
  const hasAny = pooledT > 0;
  const pct = pctOf(pooledD, pooledT);
  return '<section class="max-w-6xl mx-auto px-4 pt-6 pb-2 w-full">' +
    '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">' +

      '<div class="sh-in rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 flex items-center gap-5" style="--i:0">' +
        '<div class="relative flex-shrink-0">' + ringSVG(pct, 116, '#06b6d4', 'shGradHero') +
          '<div class="absolute inset-0 flex flex-col items-center justify-center"><span class="font-mono-num font-black text-2xl text-slate-800 dark:text-white">' + pct + '%</span><span class="text-[10px] text-slate-400">إجمالي</span></div>' +
        '</div>' +
        '<div class="min-w-0"><h2 class="font-black text-base mb-1">أهلًا بيك يا هندسة 👋</h2>' +
        (hasAny
          ? '<p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">خلّصت <b class="text-cyan-500 font-mono-num">' + pooledD + '</b> من <b class="font-mono-num">' + pooledT + '</b> عنصر متتبّع — كمّل، انت ماشي صح 💪</p>'
          : '<p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">لسه مفيش حاجة متتبّعة — ضيف أول مهمة أو استورد تقدمك من مواقعك تحت 👇</p>') +
        (ss.lastSync ? '<p class="text-[11px] text-slate-400 mt-2"><i class="fa fa-rotate text-[10px]"></i> آخر مزامنة: ' + esc(relTime(ss.lastSync)) + '</p>' : '') +
        '</div>' +
      '</div>' +

      '<div class="sh-in rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 flex flex-col justify-center gap-2" style="--i:1">' +
        '<div class="flex items-center justify-between"><span class="font-bold text-sm"><i class="fa fa-list-check text-indigo-400 ml-1"></i> مهامي الشخصية</span><span class="font-mono-num text-sm font-black text-slate-700 dark:text-slate-200">' + ts.done + '/' + ts.total + '</span></div>' +
        '<div class="sh-bar"><i style="width:' + ts.pct + '%;background:linear-gradient(90deg,#6366f1,#8b5cf6)"></i></div>' +
        '<p class="text-[11px] text-slate-400">' + (ts.total ? pctOf(ts.done, ts.total) + '% مكتمل — ' + (ts.total - ts.done) + ' فاضل' : 'مفيش مهام لسه') + '</p>' +
      '</div>' +

      '<div class="sh-in rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 flex flex-col justify-center gap-2" style="--i:2">' +
        '<div class="flex items-center justify-between"><span class="font-bold text-sm"><i class="fa fa-satellite-dish text-cyan-400 ml-1"></i> المواقع المربوطة</span><span class="font-mono-num text-sm font-black text-slate-700 dark:text-slate-200">' + ss.imported + '/3</span></div>' +
        '<div class="sh-bar"><i style="width:' + ss.pct + '%;background:linear-gradient(90deg,#06b6d4,#6366f1)"></i></div>' +
        '<p class="text-[11px] text-slate-400">' + (ss.imported ? ss.pct + '% تقدم وسطي فيها' : 'استورد أول ملف تقدم من أي موقع') + '</p>' +
      '</div>' +

    '</div>' +
  '</section>';
}

/* ---------------- كروت المصادر ---------------- */
function sourceCardHTML(def, i) {
  const s = sources[def.key];
  const link = links[def.key];
  let body;
  if (!s) {
    body = '<div class="text-center py-4">' +
      '<div class="w-12 h-12 mx-auto rounded-full grid place-items-center mb-3" style="background:' + def.hex + '1a;color:' + def.hex + '"><i class="fa fa-cloud-arrow-up text-lg"></i></div>' +
      '<p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">لسه مفيش بيانات — افتح <b>' + esc(def.title) + '</b> ودوس «⬇️ حمّل تقدمي» وبعدين ارفع الملف هنا.</p>' +
      '<button onclick="askImport(\'' + def.key + '\')" class="mt-3 h-10 px-4 rounded-xl text-xs font-black text-white shadow-md transition hover:brightness-110" style="background:linear-gradient(135deg,' + def.hex + ',#6366f1)"><i class="fa fa-file-import ml-1"></i> استيراد ملف التقدم</button>' +
    '</div>';
  } else {
    const pct = (s.stats && typeof s.stats.total === 'number') ? pctOf(s.stats.done, s.stats.total) : null;
    const groups = (s.groups || []).map(g => {
      const gd = g.items.filter(x => x.done).length;
      return '<details class="sh-group border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">' +
        '<summary class="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition">' +
          '<i class="fa fa-chevron-down sh-caret text-[10px] text-slate-400"></i>' +
          '<span class="text-xs font-bold flex-1 truncate">' + esc(g.name) + '</span>' +
          '<span class="font-mono-num text-[10px] ' + (gd === g.items.length && g.items.length ? 'text-emerald-500' : 'text-slate-400') + '">' + gd + '/' + g.items.length + '</span>' +
        '</summary>' +
        '<div class="max-h-44 overflow-y-auto sh-scroll divide-y divide-slate-100 dark:divide-slate-800">' +
          g.items.map(it =>
            '<div class="flex items-center gap-2 px-3 py-1.5">' +
              '<i class="fa ' + (it.done ? 'fa-circle-check text-emerald-500' : 'fa-circle text-slate-300 dark:text-slate-600') + ' text-xs"></i>' +
              '<span class="text-[11px] truncate ' + (it.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300') + '" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
            '</div>').join('') +
        '</div>' +
      '</details>';
    }).join('');
    body = '<div class="flex items-center gap-4 mb-3">' +
        '<div class="relative flex-shrink-0">' + ringSVG(pct == null ? 0 : pct, 74, def.hex, 'shGrad_' + def.key) +
          '<div class="absolute inset-0 flex items-center justify-center font-mono-num font-black text-sm">' + (pct == null ? '—' : pct + '%') + '</div></div>' +
        '<div class="min-w-0 flex-1">' +
          '<p class="text-xs text-slate-500 dark:text-slate-400">' + (s.label && s.label !== def.title ? esc(s.label) : esc(def.scope)) + '</p>' +
          '<p class="font-black text-sm mt-0.5">' + (typeof s.stats.done === 'number' ? '<span class="font-mono-num text-emerald-500">' + s.stats.done + '</span> مكتمل' : '') +
            (typeof s.stats.total === 'number' ? ' من <span class="font-mono-num">' + s.stats.total + '</span>' : '') + '</p>' +
          '<p class="text-[10px] text-slate-400 mt-1"><i class="fa fa-rotate text-[9px]"></i> ' + esc(relTime(s.importedAt)) + '</p>' +
        '</div>' +
      '</div>' +
      (groups ? '<div class="space-y-2 mb-3">' + groups + '</div>' : '') +
      '<div class="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">' +
        '<button onclick="askImport(\'' + def.key + '\')" title="تحديث البيانات بملف جديد" class="h-8 px-3 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"><i class="fa fa-arrows-rotate"></i> تحديث من ملف</button>' +
        '<button onclick="' + (link ? 'goSite(\'' + def.key + '\')' : 'openLinkModal(\'' + def.key + '\')') + '" title="' + (link ? 'فتح الموقع' : 'حط لينك الموقع مرة واحدة') + '" class="h-8 px-3 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5" style="color:' + def.hex + '"><i class="fa fa-arrow-up-right-from-square"></i> ' + (link ? 'افتح الموقع' : 'حط اللينك') + '</button>' +
        '<div class="mr-auto flex items-center gap-1">' +
          (link ? '<button onclick="openLinkModal(\'' + def.key + '\')" title="تعديل اللينك" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><i class="fa fa-link text-xs"></i></button>' : '') +
          '<button onclick="clearSource(\'' + def.key + '\')" title="مسح بيانات المصدر ده من هنا بس" class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><i class="fa fa-trash-can text-xs"></i></button>' +
        '</div>' +
      '</div>';
  }
  return '<div class="sh-in rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 flex flex-col" style="--i:' + i + '" data-source-card="' + def.key + '">' +
    '<div class="flex items-center gap-2.5 mb-4">' +
      '<div class="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style="background:' + def.hex + '1a;color:' + def.hex + '"><i class="fa ' + def.icon + '"></i></div>' +
      '<div class="min-w-0"><h3 class="font-black text-sm truncate">' + esc(def.title) + '</h3><p class="text-[10px] text-slate-400 truncate">' + esc(def.scope) + '</p></div>' +
      (s ? '<span class="mr-auto w-2 h-2 rounded-full bg-emerald-400 sh-pulse" title="متزامن"></span>' : '') +
    '</div>' + body +
  '</div>';
}

function sourcesHTML() {
  return '<section class="max-w-6xl mx-auto px-4 py-4 w-full">' +
    '<div class="flex items-center gap-2 mb-3 px-1">' +
      '<h2 class="font-black text-base"><i class="fa fa-link text-cyan-400 ml-1"></i> المصادر المربوطة</h2>' +
      '<span class="text-[10px] text-slate-400">— التقدم بيتقرأ من ملفات بتصدّرها من كل موقع</span>' +
    '</div>' +
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' + SOURCES_DEF.map((d, i) => sourceCardHTML(d, i)).join('') + '</div>' +
  '</section>';
}

/* ---------------- المهام ---------------- */
function visibleTasks() {
  const arr = tasks.slice();
  const isLate = t => !t.done && dueState(t) === 'late';
  const isToday = t => !t.done && dueState(t) === 'today';
  if (filter === 'all') return arr; // الترتيب اليدوي (سحب وإفلات)
  if (filter === 'late') return arr.filter(isLate);
  if (filter === 'today') return arr.filter(isToday);
  if (filter === 'waiting') return arr.filter(t => !t.done);
  if (filter === 'done') return arr.filter(t => t.done);
  return arr;
}
function filterCounts() {
  return {
    all: tasks.length,
    late: tasks.filter(t => !t.done && dueState(t) === 'late').length,
    today: tasks.filter(t => !t.done && dueState(t) === 'today').length,
    waiting: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length
  };
}
function catOf(id) { return CATS.find(c => c.id === id) || CATS[0]; }
function prioOf(id) { return PRIOS.find(p => p.id === id) || PRIOS[1]; }

function taskRowHTML(t, i) {
  const c = catOf(t.cat), p = prioOf(t.prio);
  const ds = dueState(t);
  const dueCls = t.done ? 'text-slate-400' : ds === 'late' ? 'text-rose-500 font-black' : ds === 'today' ? 'text-amber-500 font-black' : 'text-slate-400';
  return '<div class="sh-row sh-in group flex items-start gap-2.5 rounded-2xl border p-3.5 transition ' +
      (t.done ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-70 '
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-cyan-300 dark:hover:border-cyan-800 ') +
      (ds === 'late' && !t.done ? '!border-rose-300 dark:!border-rose-900/60' : '') + '" data-task-row="' + t.id + '" style="--i:' + Math.min(i, 12) + '">' +
    (filter === 'all'
      ? '<span class="sh-grip mt-1 w-5 text-center text-slate-300 dark:text-slate-600 hover:text-cyan-500 select-none" data-grip="' + t.id + '" title="اسحب للترتيب"><i class="fa fa-grip-vertical text-sm"></i></span>'
      : '<span class="w-5 mt-1"></span>') +
    '<button onclick="toggleTask(\'' + t.id + '\')" title="' + (t.done ? 'رجّعها غير مكتملة' : 'علّمها مكتملة') + '" class="mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 grid place-items-center transition ' +
      (t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-cyan-400') + '"><i class="fa fa-check text-[11px]"></i></button>' +
    '<div class="min-w-0 flex-1" ondblclick="openTaskModal(\'' + t.id + '\')" title="دوس مرتين للتعديل">' +
      '<p class="text-sm font-bold leading-snug ' + (t.done ? 'line-through text-slate-400 dark:text-slate-500' : '') + '">' + esc(t.title) + '</p>' +
      (t.note ? '<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed line-clamp-2">' + esc(t.note) + '</p>' : '') +
      '<div class="flex flex-wrap items-center gap-1.5 mt-2">' +
        '<span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold" style="background:' + c.hex + '1a;color:' + c.hex + '"><i class="fa ' + c.icon + ' text-[9px]"></i> ' + c.name + '</span>' +
        '<span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold" style="background:' + p.hex + '1a;color:' + p.hex + '"><i class="fa fa-flag text-[9px]"></i> ' + p.name + '</span>' +
        (t.due ? '<span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ' + dueCls + '"><i class="fa fa-calendar-day text-[9px]"></i> ' + esc(dueLabel(t)) + '</span>' : '') +
        (t.done && t.doneAt ? '<span class="text-[10px] text-emerald-500/80"><i class="fa fa-circle-check text-[9px]"></i> خلّصتها ' + esc(relTime(t.doneAt)) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="flex flex-col gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition">' +
      '<button onclick="openTaskModal(\'' + t.id + '\')" title="تعديل" class="w-8 h-8 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition"><i class="fa fa-pen text-xs"></i></button>' +
      '<button onclick="deleteTask(\'' + t.id + '\')" title="حذف" class="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"><i class="fa fa-trash-can text-xs"></i></button>' +
    '</div>' +
  '</div>';
}

function tasksHTML() {
  const counts = filterCounts();
  const chips = FILTERS.map(f =>
    '<button onclick="setFilter(\'' + f.id + '\')" class="h-8 px-3.5 rounded-full text-[11px] font-black transition flex items-center gap-1.5 ' +
    (filter === f.id ? 'text-white shadow-md' : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-800') + '"' +
    (filter === f.id ? ' style="background:linear-gradient(135deg,#06b6d4,#6366f1)"' : '') + '>' +
    esc(f.name) + ' <span class="font-mono-num text-[10px] ' + (filter === f.id ? 'text-white/85' : 'text-slate-400') + '">' + (counts[f.id] || 0) + '</span></button>').join('');

  const list = visibleTasks();
  const rows = list.length
    ? list.map((t, i) => taskRowHTML(t, i)).join('')
    : '<div class="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">' +
        '<i class="fa ' + (filter === 'done' ? 'fa-medal' : 'fa-clipboard-list') + ' text-3xl text-slate-300 dark:text-slate-600 mb-3"></i>' +
        '<p class="text-sm font-bold text-slate-400">' + (filter === 'all' ? 'مفيش مهام لسه — دوس «مهمة جديدة» وابدأ 🚀' : 'مفيش مهام في الفلتر ده') + '</p></div>';

  return '<section class="max-w-6xl mx-auto px-4 py-4 w-full flex-1">' +
    '<div class="flex items-center gap-3 mb-3 px-1 flex-wrap">' +
      '<h2 class="font-black text-base"><i class="fa fa-list-check text-indigo-400 ml-1"></i> مهامي</h2>' +
      '<button onclick="openTaskModal(null)" class="h-9 px-4 rounded-xl text-xs font-black text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 flex items-center gap-2" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><i class="fa fa-plus"></i> مهمة جديدة</button>' +
      '<span class="text-[10px] text-slate-400 mr-auto hidden sm:block">في فلتر «الكل» تقدر ترتّب بالسحب من اليد ⠿</span>' +
    '</div>' +
    '<div class="flex items-center gap-2 mb-4 flex-wrap px-1">' + chips + '</div>' +
    '<div id="tasks-list" class="space-y-2.5">' + rows + '</div>' +
  '</section>';
}

function footerHTML() {
  return '<footer class="mt-6 border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-[#0a0f1c]/60">' +
    '<div class="max-w-6xl mx-auto px-4 py-5 text-center">' +
      '<p class="text-[10px] uppercase tracking-[.25em] text-slate-400 dark:text-slate-500 font-bold font-mono-num">StudyHub · your study command center</p>' +
      '<span class="sh-signature" dir="ltr">Created by abdallah elmohammady</span>' +
    '</div>' +
  '</footer>';
}

/* ---------------- الرسم الرئيسي ---------------- */
function render() {
  $('root').innerHTML = headerHTML() + heroHTML() + sourcesHTML() + tasksHTML() + footerHTML();
  paintThemeBtn();
}

/* ---------------- أكشنز المهام ---------------- */
function toggleTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  saveTasks(); render();
  if (t.done) showToast('برافو! مهمة اتخلّصت ✅');
}
function deleteTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  if (!confirm('تمسح مهمة «' + t.title.slice(0, 40) + '»؟')) return;
  tasks = tasks.filter(x => x.id !== id);
  saveTasks(); render();
  showToast('اتمسحت المهمة');
}
function setFilter(f) { filter = f; render(); }

/* ---------------- مودال إضافة/تعديل مهمة ---------------- */
function openTaskModal(id) {
  editingId = id || null;
  const t = id ? tasks.find(x => x.id === id) : null;
  const catChips = CATS.map(c =>
    '<label class="cursor-pointer"><input type="radio" name="f-cat" value="' + c.id + '" class="peer sr-only" ' + ((t ? t.cat : 'study') === c.id ? 'checked' : '') + '>' +
    '<span class="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition border-slate-200 dark:border-slate-700 peer-checked:text-white peer-checked:border-transparent" style="--ch:' + c.hex + '" onmouseover="" data-cat-chip><i class="fa ' + c.icon + '"></i> ' + c.name + '</span></label>').join('');
  const prioChips = PRIOS.map(p =>
    '<label class="cursor-pointer"><input type="radio" name="f-prio" value="' + p.id + '" class="peer sr-only" ' + ((t ? t.prio : 'med') === p.id ? 'checked' : '') + '>' +
    '<span class="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition border-slate-200 dark:border-slate-700 peer-checked:text-white peer-checked:border-transparent" data-prio-chip="' + p.hex + '"><i class="fa fa-flag"></i> ' + p.name + '</span></label>').join('');
  $('modal-root').innerHTML =
  '<div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm" onclick="if(event.target===this)closeModal()">' +
    '<div class="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sh-in" role="dialog" aria-modal="true">' +
      '<div class="flex items-center justify-between mb-4">' +
        '<h3 class="font-black text-base">' + (t ? 'تعديل المهمة' : 'مهمة جديدة ✍️') + '</h3>' +
        '<button onclick="closeModal()" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa fa-xmark"></i></button>' +
      '</div>' +
      '<form onsubmit="saveTaskModal(event)">' +
        '<input id="f-title" type="text" required maxlength="200" placeholder="عنوان المهمة — مثلًا: خلّص شابتر 3 إشارات" value="' + esc(t ? t.title : '') + '" class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-bold focus:outline-none focus:ring-2 ring-cyan-500/60 mb-3" />' +
        '<textarea id="f-note" rows="2" maxlength="600" placeholder="ملاحظات (اختياري) — تفاصيل، لينك، صفحات…" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs focus:outline-none focus:ring-2 ring-cyan-500/60 mb-3 resize-none">' + esc(t ? t.note : '') + '</textarea>' +
        '<p class="text-[11px] font-bold text-slate-400 mb-1.5">التصنيف</p><div class="flex flex-wrap gap-2 mb-3" id="cat-chips">' + catChips + '</div>' +
        '<p class="text-[11px] font-bold text-slate-400 mb-1.5">الأولوية</p><div class="flex flex-wrap gap-2 mb-3" id="prio-chips">' + prioChips + '</div>' +
        '<p class="text-[11px] font-bold text-slate-400 mb-1.5">تاريخ التسليم (اختياري)</p>' +
        '<input id="f-due" type="date" value="' + esc(t ? t.due : '') + '" class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm focus:outline-none focus:ring-2 ring-cyan-500/60 mb-4" />' +
        '<div class="flex gap-2">' +
          '<button type="submit" class="flex-1 h-11 rounded-xl text-sm font-black text-white shadow-lg shadow-cyan-500/25 hover:brightness-110 transition" style="background:linear-gradient(135deg,#06b6d4,#6366f1)">' + (t ? 'حفظ التعديلات' : 'إضافة المهمة') + '</button>' +
          '<button type="button" onclick="closeModal()" class="h-11 px-5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">إلغاء</button>' +
        '</div>' +
      '</form>' +
    '</div>' +
  '</div>';
  /* تلوين التشيب المختار بـ JS (Tailwind peer-checked مش بياخد ألوان ديناميكية) */
  paintChips();
  document.querySelectorAll('#cat-chips input, #prio-chips input').forEach(i => i.addEventListener('change', paintChips));
  setTimeout(() => { const f = $('f-title'); if (f) f.focus(); }, 50);
}
function paintChips() {
  document.querySelectorAll('#cat-chips input').forEach(inp => {
    const chip = inp.nextElementSibling, hex = chip.getAttribute('style').match(/--ch:([^;]+)/)[1];
    chip.style.background = inp.checked ? hex : '';
    chip.style.borderColor = inp.checked ? 'transparent' : '';
  });
  document.querySelectorAll('#prio-chips input').forEach(inp => {
    const chip = inp.nextElementSibling, hex = chip.getAttribute('data-prio-chip');
    chip.style.background = inp.checked ? hex : '';
    chip.style.borderColor = inp.checked ? 'transparent' : '';
  });
}
function closeModal() { $('modal-root').innerHTML = ''; editingId = null; }
function saveTaskModal(ev) {
  ev.preventDefault();
  const title = ($('f-title').value || '').trim();
  if (!title) { showToast('اكتب عنوان للمهمة الأول', true); return; }
  const catInp = document.querySelector('#cat-chips input:checked');
  const prioInp = document.querySelector('#prio-chips input:checked');
  const fields = {
    title: title,
    note: ($('f-note').value || '').trim(),
    cat: catInp ? catInp.value : 'study',
    prio: prioInp ? prioInp.value : 'med',
    due: $('f-due').value || ''
  };
  if (editingId) {
    const t = tasks.find(x => x.id === editingId);
    if (t) { t.title = fields.title; t.note = fields.note; t.cat = fields.cat; t.prio = fields.prio; t.due = fields.due; }
    showToast('اتحفظت التعديلات ✔');
  } else {
    const t = normalizeTask(fields); t.id = uid(); t.createdAt = Date.now();
    tasks.unshift(t);
    filter = 'all'; // المهمة الجديدة تبان فورًا
    showToast('اتضافت المهمة — بالتوفيق 💪');
  }
  saveTasks(); closeModal(); render();
}

/* ---------------- السحب والإفلات (Pointer events — شغال موبايل وديسكتوب) ---------------- */
let drag = null; // {id, line}
document.addEventListener('pointerdown', e => {
  const grip = e.target.closest && e.target.closest('[data-grip]');
  if (!grip || filter !== 'all') return;
  e.preventDefault();
  drag = { id: grip.getAttribute('data-grip'), overId: null, before: true };
  const row = document.querySelector('[data-task-row="' + drag.id + '"]');
  if (row) row.classList.add('dragging');
  const line = document.createElement('div'); line.className = 'sh-drop-line'; drag.line = line;
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const rows = Array.from(document.querySelectorAll('[data-task-row]')).filter(r => r.getAttribute('data-task-row') !== drag.id);
  let placed = false;
  for (const r of rows) {
    const rect = r.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (e.clientY < mid) { r.parentNode.insertBefore(drag.line, r); drag.overId = r.getAttribute('data-task-row'); drag.before = true; placed = true; break; }
  }
  if (!placed && rows.length) { const last = rows[rows.length - 1]; last.parentNode.appendChild(drag.line); drag.overId = last.getAttribute('data-task-row'); drag.before = false; }
  if (!rows.length) { const list = $('tasks-list'); if (list) list.appendChild(drag.line); drag.overId = null; }
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const srcRow = document.querySelector('[data-task-row="' + drag.id + '"]');
  if (srcRow) srcRow.classList.remove('dragging');
  if (drag.line && drag.line.parentNode) drag.line.remove();
  if (drag.overId && drag.overId !== drag.id) {
    const from = tasks.findIndex(t => t.id === drag.id);
    const over = tasks.findIndex(t => t.id === drag.overId);
    if (from > -1 && over > -1) {
      const item = tasks.splice(from, 1)[0];
      let to = tasks.findIndex(t => t.id === drag.overId);
      if (!drag.before) to++;
      tasks.splice(to, 0, item);
      saveTasks();
    }
  }
  drag = null;
  render();
});

/* ---------------- استيراد تقدم من موقع ---------------- */
let pendingSourceKey = null;
function askImport(key) { pendingSourceKey = key; $('file-import-source').click(); }
function onSourceFileChosen(input) {
  const key = pendingSourceKey; pendingSourceKey = null;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !key) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const res = handleSourceData(key, data);
      if (res.ok) { render(); showToast('اتحدّث «' + SOURCES_DEF.find(s => s.key === key).title + '» ✅'); }
      else showToast(res.err, true);
    } catch (e) { showToast('الملف ده مش JSON سليم', true); }
  };
  rd.readAsText(file);
}

/* قلب الاستيراد — دالة نقية (بتاخد object وترجع نتيجة) عشان سهلة الاختبار */
function handleSourceData(key, data) {
  const def = SOURCES_DEF.find(s => s.key === key);
  if (!def) return { ok: false, err: 'مصدر مجهول' };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, err: 'الملف مش بالشكل المتوقع' };
  if (data.app && data.app !== def.app) return { ok: false, err: 'ده ملف موقع تاني («' + String(data.app) + '») — استورده في الكارت الصح' };

  let groups = null, stats = null;
  if (Array.isArray(data.groups) && data.groups.length) {
    groups = data.groups.slice(0, 60).map(g => ({
      id: String(g.id || 'g'),
      name: String(g.name || 'مجموعة').slice(0, 120),
      items: (Array.isArray(g.items) ? g.items : []).slice(0, 400).map(it => ({
        id: String(it.id || ''),
        name: String(it.name != null ? it.name : it.id || 'عنصر').slice(0, 200),
        done: !!it.done
      }))
    })).filter(g => g.items.length);
    if (!groups.length) return { ok: false, err: 'الملف مفيهوش عناصر' };
    const t = groups.reduce((a, g) => a + g.items.length, 0);
    const d = groups.reduce((a, g) => a + g.items.filter(i => i.done).length, 0);
    stats = {
      total: (data.stats && typeof data.stats.total === 'number') ? data.stats.total : t,
      done: (data.stats && typeof data.stats.done === 'number') ? data.stats.done : d
    };
  } else {
    /* صيغة قديمة: {progress:{id:true}} أو ماب خام — نعرف العدد المكتمل بس (من غير أسماء) */
    const map = (data.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)) ? data.progress
      : (!data.app && !data.type && Object.keys(data).length && Object.keys(data).every(k => data[k] === true)) ? data : null; /* ماب خام = كل قيمه true بالظبط، عشان ملفات غريبة متتقبلش بالغلط */
    if (!map) return { ok: false, err: 'الملف مفيهوش بيانات تقدم — صدّر «ملف تقدمي» من الموقع نفسه' };
    const keys = Object.keys(map).filter(k => map[k]);
    groups = [{ id: 'legacy', name: 'عناصر مكتملة (من ملف قديم — الأسماء بتظهر بملف أحدث من الموقع)', items: keys.map(k => ({ id: k, name: k, done: true })) }];
    stats = { total: null, done: keys.length };
    if (!keys.length) return { ok: false, err: 'الملف القديم ده فاضي (مفيش عناصر مكتملة)' };
  }
  sources[key] = { app: def.app, label: String(data.label || def.title).slice(0, 120), stats: stats, groups: groups, importedAt: Date.now() };
  saveSources();
  return { ok: true };
}

function clearSource(key) {
  const def = SOURCES_DEF.find(s => s.key === key);
  if (!sources[key]) return;
  if (!confirm('تمسح بيانات «' + def.title + '» من هنا؟ (تقدمك في الموقع نفسه مش هيتأثر)')) return;
  delete sources[key];
  saveSources(); render();
  showToast('اتمسحت بيانات المصدر من StudyHub بس');
}

/* ---------------- لينكات المواقع (زرار «افتح الموقع») ---------------- */
function openLinkModal(key) {
  const def = SOURCES_DEF.find(s => s.key === key);
  $('modal-root').innerHTML =
  '<div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm" onclick="if(event.target===this)closeModal()">' +
    '<div class="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sh-in">' +
      '<div class="flex items-center justify-between mb-3"><h3 class="font-black text-base">لينك «' + esc(def.title) + '»</h3>' +
      '<button onclick="closeModal()" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fa fa-xmark"></i></button></div>' +
      '<p class="text-xs text-slate-400 mb-3 leading-relaxed">حط لينك نسخة الزوّار بتاعة الموقع (بتخلص من Vercel) — بيتحفظ على جهازك بس، وزرار «افتح الموقع» هيفتّحهولك على طول.</p>' +
      '<form onsubmit="saveLink(event, \'' + key + '\')">' +
        '<input id="f-link" dir="ltr" type="url" placeholder="https://example.vercel.app/user/" value="' + esc(links[key] || '') + '" class="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm focus:outline-none focus:ring-2 ring-cyan-500/60 mb-4" />' +
        '<div class="flex gap-2"><button type="submit" class="flex-1 h-11 rounded-xl text-sm font-black text-white hover:brightness-110 transition" style="background:linear-gradient(135deg,' + def.hex + ',#6366f1)">حفظ اللينك</button>' +
        '<button type="button" onclick="closeModal()" class="h-11 px-5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">إلغاء</button></div>' +
      '</form>' +
    '</div>' +
  '</div>';
  setTimeout(() => { const f = $('f-link'); if (f) f.focus(); }, 50);
}
function saveLink(ev, key) {
  ev.preventDefault();
  const v = ($('f-link').value || '').trim();
  if (v && !/^https?:\/\//i.test(v)) { showToast('اللينك لازم يبدأ بـ https://‎ أو http://‎', true); return; }
  if (v) links[key] = v; else delete links[key];
  saveLinks(); closeModal(); render();
  showToast(v ? 'اتحفظ اللينك 🔗' : 'اتمسح اللينك');
}
function goSite(key) {
  const url = links[key];
  if (!url) { openLinkModal(key); return; }
  window.open(url, '_blank', 'noopener');
}

/* ---------------- نسخة احتياطية كاملة (كل حاجة في StudyHub) ---------------- */
function exportAll() {
  try {
    const payload = { app: 'studyhub', type: 'backup', version: 1, exportedAt: Date.now(), tasks: tasks, sources: sources, links: links };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'studyhub-backup.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('اتنزّلت النسخة الاحتياطية (studyhub-backup.json) 💾');
  } catch (e) { showToast('حصلت مشكلة في التصدير', true); }
}
function onBackupFileChosen(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const res = applyBackup(JSON.parse(ev.target.result));
      if (res.ok) { render(); showToast('اترجّعت النسخة الاحتياطية كاملة ✅'); }
      else showToast(res.err, true);
    } catch (e) { showToast('الملف ده مش نسخة StudyHub صالحة', true); }
  };
  rd.readAsText(file);
}
function applyBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'studyhub') return { ok: false, err: 'ده مش ملف نسخة احتياطية بتاع StudyHub' };
  tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTask);
  sources = (data.sources && typeof data.sources === 'object' && !Array.isArray(data.sources)) ? data.sources : {};
  links = (data.links && typeof data.links === 'object' && !Array.isArray(data.links)) ? data.links : {};
  saveTasks(); saveSources(); saveLinks();
  return { ok: true };
}

/* ---------------- تشغيل ---------------- */
(function boot() {
  render();
  const fs = $('file-import-source'); if (fs) fs.addEventListener('change', () => onSourceFileChosen(fs));
  const fb = $('file-import-backup'); if (fb) fb.addEventListener('change', () => onBackupFileChosen(fb));
})();
