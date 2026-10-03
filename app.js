const STORAGE = {
  templates: "teachinglog.v08.templates",
  logs: "teachinglog.v08.logs",
  draft: "teachinglog.v08.draft",
  fixes: "teachinglog.courseFixes.v1",
  progressCache: "teachinglog.v09.progressCache",
  productionScopeCache: "teachinglog.productionScopeCache.v1",
  homeworkPhrases: "teachinglog.v09.homeworkPhrases",
  handoutExamples: "teachinglog.handoutExamples.v1"
};

const $ = (id) => document.getElementById(id);

let currentText = "";
let templates = readJson(STORAGE.templates, []);
let logs = readJson(STORAGE.logs, []);
let filenameCourseData = {};
let activeView = "progress";
let courseReviewExpanded = false;
let courseFixes = readJson(STORAGE.fixes, []);
let progressCache = readJson(STORAGE.progressCache, []);
let productionScopeCache = readJson(STORAGE.productionScopeCache, []);
let productionMode = readJson("teachinglog.productionMode.v1", "singleQuestion");
let homeworkPhrases = readJson(STORAGE.homeworkPhrases, ["完成講義", "訂正錯題", "複習今日進度", "預習下次範圍"]);
let sharedSelectedTopics = new Set();
let questionSelectedTopics = new Set();
let handoutSelectedTopics = new Set();

const DEFAULT_HANDOUT_EXAMPLES = [
  {
    id: "biologyInheritance",
    name: "生物遺傳範例",
    grade: "高一",
    subject: "生物",
    book: "基礎生物（全）",
    chapter: "第2章 遺傳",
    section: "2-2 遺傳的染色體學說之發展歷程",
    title: "第2章 遺傳：2-2 遺傳的染色體學說之發展歷程",
    audience: "both",
    style: "softGray",
    topics: ["遺傳的染色體學說", "性染色體的發現與性聯遺傳"],
    include: {
      toc: true,
      concepts: true,
      examples: true,
      practice: true,
      answers: true,
      teacherNotes: false
    },
    exampleCount: 2,
    practiceCount: 4,
    questionCounts: { calculation: 5, concept: 5, thinking: 5 },
    questionSource: "mixed",
    questionCandidateCount: 30,
    notes: "無；請依課程範圍自行整理成適合上課使用的講義。"
  }
];
let handoutExamples = readJson(STORAGE.handoutExamples, DEFAULT_HANDOUT_EXAMPLES);

const HANDOUT_TEACHER_BACKGROUND = [
  "你將扮演一位擁有四十年教學經驗的專業高中自然科學老師，專精於高中自然科學所有領域（物理、化學、生物、地球科學），並對課綱、考試趨勢與學生盲點有深刻洞察。你的教學風格嚴謹、權威且能深入淺出。",
  "核心任務是根據指定主題，規劃教學進度並編寫高三升大學程度的參考書講義，目標是建立完整、深入且權威的知識體系，以應對考試並培養科學素養。",
  "講義應嚴格遵循大標題、子標題、小標題架構；每個小節目標篇幅約 20 頁。若單次任務無法完成完整篇幅，先完成第一小節並等待下一個指令。",
  "每個小標題的內容模組、題數與答案顯示方式，嚴格依照下方內容結構及本次勾選設定，不得加入未勾選的模組。",
  "講義說明部分應專業、權威、詳盡且富有啟發性；詳解部分應簡潔、精準、一針見血。",
  "互動流程：用戶將提供主題，你需根據上述要求製作第一小節講義內容。完成後，等待下一個指令。在開始之前，請先確認你已完全理解以上所有指令，並準備好開始教學。"
].join("\n");

const QUESTION_STYLE_LABELS = {
  standard: "標準快考版",
  gray: "灰階列印版",
  reference: "參考書精緻版",
  exam: "段考模擬版",
  correction: "錯題訂正版",
  teacher: "教師備課版"
};

const QUESTION_LAYOUT_LABELS = {
  spacious: "寬鬆作答版",
  compact: "緊湊省紙版",
  twoColumn: "雙欄選擇題版",
  card: "單題卡片版",
  formal: "正式考卷版",
  separateAnswers: "答案分離版",
  bw: "黑白影印版"
};

const TYPOGRAPHY_LABELS = {
  kai14: "標楷體 14 pt",
  kai13: "標楷體 13 pt",
  kai12: "標楷體 12 pt",
  kai11: "標楷體 11 pt",
  kai105: "標楷體 10.5 pt",
  jhenghei14: "微軟正黑體 14 pt",
  jhenghei13: "微軟正黑體 13 pt",
  jhenghei12: "微軟正黑體 12 pt",
  jhenghei11: "微軟正黑體 11 pt",
  jhenghei105: "微軟正黑體 10.5 pt",
  ming12: "新細明體 12 pt",
  ming11: "新細明體 11 pt",
  ming105: "新細明體 10.5 pt",
  sourceHanSans12: "思源黑體 12 pt",
  sourceHanSans11: "思源黑體 11 pt",
  sourceHanSerif12: "思源宋體 12 pt",
  sourceHanSerif11: "思源宋體 11 pt"
};
const QUESTION_TYPOGRAPHY_LABELS = TYPOGRAPHY_LABELS;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function schoolLevelFromGrade(grade) {
  if (/^小/.test(grade)) return "primary";
  if (/^國/.test(grade)) return "junior";
  if (/^高/.test(grade)) return "senior";
  return "";
}

function bookMatchesGrade(book, grade) {
  const level = schoolLevelFromGrade(grade);
  if (!level) return true;
  const name = String(book || "");
  if (level === "primary") return /^國小/.test(name) || /升私中/.test(name);
  if (level === "junior") return /^國中/.test(name);
  return /^高中/.test(name) || /^基礎/.test(name) || /^選修/.test(name) || /^地球科學/.test(name);
}

const COURSE_COLLATOR = new Intl.Collator("zh-Hant", { numeric: true, sensitivity: "base" });
const SUBJECT_ORDER = ["數學", "物理", "化學", "生物", "地科", "國文", "英文", "歷史", "地理", "公民"];
const SUBJECT_RANK = new Map(SUBJECT_ORDER.map((subject, index) => [subject, index]));

function sortSubjects(subjects) {
  return [...subjects].sort((a, b) => {
    const rankA = SUBJECT_RANK.has(a) ? SUBJECT_RANK.get(a) : 999;
    const rankB = SUBJECT_RANK.has(b) ? SUBJECT_RANK.get(b) : 999;
    return rankA - rankB || COURSE_COLLATOR.compare(a, b);
  });
}

function courseLevelRank(book) {
  const name = String(book || "");
  if (/^國小/.test(name)) return 1;
  if (/^國中/.test(name)) return 2;
  if (/^高中|^基礎|^選修|^地球科學/.test(name)) return 3;
  return 9;
}

function courseVersionName(book) {
  const name = String(book || "");
  const match = name.match(/^(?:國小|國中|高中)?(.+?)版/);
  if (match) return match[1];
  if (/^基礎/.test(name)) return "基礎";
  if (/^選修/.test(name)) return "選修";
  if (/^地球科學/.test(name)) return "地球科學";
  return name.replace(/\(.+?\)/g, "");
}

function seniorScienceCurriculumRank(book) {
  const name = String(book || "").replace(/\s+/g, "");
  if (/^基礎(?:物理|化學|生物)[（(]?全[）)]?/.test(name) || /^地球科學[（(]?全[）)]?/.test(name)) return 0;
  if (/^選修(?:物理|化學|生物|地球科學|地科)[（(]?[IVX]+[）)]?/i.test(name)) return 1;
  return 9;
}

function seniorMathVersionRank(book, subject = "") {
  const name = String(book || "");
  if (subject === "數學" && /^高中翰林版/.test(name)) return 0;
  return 9;
}

function chineseNumberValue(text) {
  const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  const tenParts = text.split("十");
  if (tenParts.length === 2) {
    const tens = tenParts[0] ? map[tenParts[0]] : 1;
    const ones = tenParts[1] ? map[tenParts[1]] : 0;
    return (tens || 0) * 10 + (ones || 0);
  }
  return map[text] ?? 999;
}

function romanNumberValue(text) {
  const clean = String(text || "").replace(/[()（）\s]/g, "").toUpperCase();
  return { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }[clean] ?? 999;
}

function courseVolumeRank(book) {
  const name = String(book || "");
  const volume = name.match(/第([零一二三四五六七八九十\d]+)冊/);
  if (volume) return chineseNumberValue(volume[1]);
  const elective = name.match(/選修[^IVX]*[（(]?\s*([IVX]+)\s*[）)]?/i);
  if (elective) return 100 + romanNumberValue(elective[1]);
  if (/全/.test(name)) return 0;
  if (/總複習|會考|升私中/.test(name)) return 900;
  return 999;
}

function courseYear(book) {
  const match = String(book || "").match(/(\d{2,3})(?:學年|上|下)/);
  return match ? Number(match[1]) : 0;
}

function courseTermRank(book) {
  const name = String(book || "");
  if (/\d{2,3}上/.test(name)) return 1;
  if (/\d{2,3}下/.test(name)) return 2;
  return 0;
}

function sortCourseBooks(books, subject = "") {
  return [...books].sort((a, b) =>
    courseLevelRank(a) - courseLevelRank(b) ||
    seniorMathVersionRank(a, subject) - seniorMathVersionRank(b, subject) ||
    seniorScienceCurriculumRank(a) - seniorScienceCurriculumRank(b) ||
    (seniorScienceCurriculumRank(a) < 9 && seniorScienceCurriculumRank(b) < 9
      ? courseVolumeRank(a) - courseVolumeRank(b)
      : 0) ||
    COURSE_COLLATOR.compare(courseVersionName(a), courseVersionName(b)) ||
    courseVolumeRank(a) - courseVolumeRank(b) ||
    courseYear(a) - courseYear(b) ||
    courseTermRank(a) - courseTermRank(b) ||
    COURSE_COLLATOR.compare(a, b)
  );
}

function booksForGrade(subjectNode, grade, subject = "") {
  const books = Object.keys(subjectNode?.books || {});
  const filtered = books.filter(book => bookMatchesGrade(book, grade));
  return sortCourseBooks(filtered.length ? filtered : books, subject);
}

function subjectsForGrade(grade) {
  const subjects = Object.keys(filenameCourseData);
  const filtered = subjects.filter(subject => booksForGrade(filenameCourseData[subject], grade, subject).length);
  return sortSubjects(filtered.length ? filtered : subjects);
}

function setSelectOptions(selectId, values, preferred = "") {
  const select = $(selectId);
  select.innerHTML = values.map(value => `<option>${escapeHtml(value)}</option>`).join("");
  if (preferred && values.includes(preferred)) {
    select.value = preferred;
  }
}

function setSelectValueIfPossible(selectId, value) {
  const select = $(selectId);
  if (!select || !value) return;
  if ([...select.options].some(option => option.value === value)) {
    select.value = value;
  }
}

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function composedClassName() {
  return $("className").value.trim() || `${$("grade").value}${$("subject").value}${$("classType").value}`;
}

function lineAppend(field, text, joiner = "\n") {
  const el = $(field);
  const value = el.value.trim();
  if (!value) {
    el.value = text;
  } else if (!value.includes(text)) {
    el.value = `${value}${joiner}${text}`;
  }
  saveDraft();
}

function phraseAppend(field, text) {
  const el = $(field);
  const value = el.value.trim();
  if (!value) {
    el.value = text;
  } else if (!value.includes(text)) {
    el.value = `${value}＋${text}`;
  }
  saveDraft();
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function collectForm() {
  return {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    grade: $("grade").value,
    subject: $("subject").value,
    classType: $("classType").value,
    className: composedClassName(),
    customClassName: $("className").value.trim(),
    date: $("date").value || todayIso(),
    progress: $("progress").value.trim(),
    pages: $("pages").value.trim(),
    quiz: $("quiz").value.trim(),
    homework: $("homework").value.trim(),
    mode: $("outputMode").value
  };
}

function generateText(data = collectForm()) {
  const progress = formatProgressText(data.progress);
  if (data.mode === "formal") {
    return [
      `教學日誌`,
      `班級：${data.className}`,
      `日期：${data.date}`,
      `科目：${data.subject}`,
      `今日進度：${progress}`,
      data.pages ? `頁數：${data.pages}` : "",
      data.quiz ? `小考：${data.quiz}` : "",
      data.homework ? `回家作業：${data.homework}` : ""
    ].filter(Boolean).join("\n");
  }

  if (data.mode === "parent") {
    return [
      `${data.className} ${data.date}`,
      `今天課程進度：${progress.replace(/\n/g, "、")}`,
      data.quiz ? `課堂檢核：${data.quiz}` : "",
      data.homework ? `回家請完成：${data.homework}` : "",
      `請協助孩子依照作業內容複習。`
    ].filter(Boolean).join("\n");
  }

  return [
    `班級：${data.className}`,
    `日期：${data.date}`,
    `進度：${progress.replace(/\n/g, " / ")}`,
    data.pages ? `頁數：${data.pages}` : "",
    data.quiz ? `小考：${data.quiz}` : "",
    data.homework ? `作業：${data.homework}` : ""
  ].filter(Boolean).join("\n");
}

function splitProgressPath(row) {
  return String(row || "")
    .split(/\s+\/\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function groupProgressRows(value) {
  const rows = String(value || "")
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
  const grouped = [];
  const groups = new Map();

  rows.forEach(row => {
    const parts = splitProgressPath(row);
    if (parts.length < 4) {
      grouped.push({ type: "single", text: row });
      return;
    }

    const base = parts.slice(0, 3).join(" / ");
    const topic = parts.slice(3).join(" / ");
    if (!topic) {
      grouped.push({ type: "single", text: row });
      return;
    }

    if (!groups.has(base)) {
      const group = { type: "group", base, topics: [] };
      groups.set(base, group);
      grouped.push(group);
    }
    const group = groups.get(base);
    if (!group.topics.includes(topic)) group.topics.push(topic);
  });

  return grouped;
}

function formatProgressText(value, fallback = "未填寫") {
  const rows = groupProgressRows(value).map(item => {
    if (item.type === "group" && item.topics.length) {
      return `${item.base}：${item.topics.join("、")}`;
    }
    return item.text;
  });
  return rows.length ? rows.join("\n") : fallback;
}

function renderProgressText(value, fallback = "未填寫") {
  const rows = groupProgressRows(value);
  if (!rows.length) return `<p>${escapeHtml(fallback)}</p>`;

  return rows.map(item => {
    if (item.type !== "group" || !item.topics.length) {
      return `<p>${escapeHtml(item.text)}</p>`;
    }

    return `
      <div class="progress-group">
        <div class="progress-base">${escapeHtml(item.base)}</div>
        <div class="progress-topic-line">${item.topics.map(topic => `<span>${escapeHtml(topic)}</span>`).join("")}</div>
      </div>
    `;
  }).join("");
}

function outputModeLabel(mode) {
  return {
    line: "LINE 緊實",
    formal: "正式紀錄",
    parent: "給家長版"
  }[mode] || "上課紀錄";
}

function displayDate(value) {
  if (!value) return todayIso();
  const [yyyy, mm, dd] = value.split("-");
  return yyyy && mm && dd ? `${yyyy}.${mm}.${dd}` : value;
}

function renderListText(value, fallback = "未填寫") {
  const rows = String(value || fallback)
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
  return rows.length
    ? rows.map(item => `<p>${escapeHtml(item)}</p>`).join("")
    : `<p>${escapeHtml(fallback)}</p>`;
}

function previewItem(label, value, tone, fallback = "未填寫", renderer = renderListText) {
  const hasValue = String(value || "").trim();
  return `
    <section class="preview-item ${tone}">
      <div class="preview-item-label">${escapeHtml(label)}</div>
      <div class="preview-item-body">${renderer(hasValue ? value : fallback, fallback)}</div>
    </section>
  `;
}

function renderPreviewCard(data, text) {
  const modeClass = `mode-${data.mode || "line"}`;
  const parentNote = data.mode === "parent"
    ? `<div class="preview-note">請協助孩子依照作業內容複習。</div>`
    : "";
  const formalMeta = data.mode === "formal"
    ? `<span>紀錄類型：${escapeHtml(data.classType)}</span>`
    : "";

  return `
    <div class="preview-card ${modeClass}" data-copy-text="${escapeHtml(text)}">
      <header class="preview-hero">
        <div>
          <div class="preview-kicker">${escapeHtml(outputModeLabel(data.mode))}</div>
          <h3>${escapeHtml(data.className)}</h3>
        </div>
        <div class="preview-date">${escapeHtml(displayDate(data.date))}</div>
      </header>
      <div class="preview-meta">
        <span>科目：${escapeHtml(data.subject)}</span>
        <span>班型：${escapeHtml(data.classType)}</span>
        ${formalMeta}
      </div>
      <div class="preview-grid">
        ${previewItem("今日進度", data.progress, "tone-progress", "未填寫", renderProgressText)}
        ${data.pages ? previewItem("頁數", data.pages, "tone-pages") : ""}
        ${data.quiz ? previewItem("小考", data.quiz, "tone-quiz") : ""}
        ${data.homework ? previewItem(data.mode === "parent" ? "回家請完成" : "作業", data.homework, "tone-homework") : ""}
      </div>
      ${parentNote}
    </div>
  `;
}

function updatePreviewSizeClass() {
  const preview = $("preview");
  const size = $("imageSize").value || "auto";
  preview.classList.remove("size-auto", "size-line", "size-a4", "size-ig");
  preview.classList.add(`size-${size}`);
}

function generate() {
  flushProgressCacheForGenerate();
  const data = collectForm();
  currentText = generateText(data);
  const preview = $("preview");
  preview.innerHTML = renderPreviewCard(data, currentText);
  preview.classList.add("ready");
  updatePreviewSizeClass();
  saveDraft();
}

async function copyCurrent() {
  if (!currentText) generate();
  await navigator.clipboard.writeText(currentText);
  toast("已複製");
}

function saveOutputImage() {
  if (!currentText) generate();
  const preview = $("preview");
  if (!preview.textContent.trim() || !preview.classList.contains("ready")) {
    toast("請先產生日誌");
    return;
  }

  loadHtml2Canvas().then(() => {
    const restore = applyImageSizeForCapture(preview, $("imageSize").value);
    return html2canvas(preview, {
      backgroundColor: "#ffffff",
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true
    }).finally(restore);
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = `教學日誌_${$("date").value || todayIso()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("已產生圖片");
  }).catch(() => {
    toast("圖片產生失敗");
  });
}

function applyImageSizeForCapture(target, imageSize) {
  const original = {
    width: target.style.width,
    maxWidth: target.style.maxWidth,
    minHeight: target.style.minHeight
  };
  const sizes = {
    line: { width: "720px", minHeight: "" },
    a4: { width: "794px", minHeight: "1123px" },
    ig: { width: "720px", minHeight: "960px" }
  };
  const size = sizes[imageSize];
  if (size) {
    target.style.width = size.width;
    target.style.maxWidth = size.width;
    target.style.minHeight = size.minHeight;
  }
  return () => {
    target.style.width = original.width;
    target.style.maxWidth = original.maxWidth;
    target.style.minHeight = original.minHeight;
  };
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-html2canvas]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.dataset.html2canvas = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function saveTemplate() {
  const data = collectForm();
  const template = {
    id: `${Date.now()}`,
    label: data.className,
    grade: data.grade,
    subject: data.subject,
    classType: data.classType,
    customClassName: data.customClassName
  };
  templates = [template, ...templates.filter(item => item.label !== template.label)].slice(0, 24);
  writeJson(STORAGE.templates, templates);
  renderTemplates();
  toast("已儲存班級");
}

function deleteTemplate(id) {
  templates = templates.filter(template => template.id !== id);
  writeJson(STORAGE.templates, templates);
  renderTemplates();
  toast("已刪除班級");
}

function applyTemplate(id) {
  const item = templates.find(template => template.id === id);
  if (!item) return;
  $("grade").value = item.grade;
  $("subject").value = item.subject;
  $("classType").value = item.classType;
  $("className").value = item.customClassName || "";
  saveDraft();
}

function renderTemplates() {
  const wrap = $("templateChips");
  if (!templates.length) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = templates.map(item => (
    `<span class="template-chip">
      <button class="chip" type="button" data-template="${item.id}">${escapeHtml(item.label)}</button>
      <button class="chip-delete" type="button" data-delete-template="${item.id}" title="刪除班級">x</button>
    </span>`
  )).join("");
}

function clearTemplates() {
  if (!confirm("確定清空所有班級模板嗎？")) return;
  templates = [];
  writeJson(STORAGE.templates, templates);
  renderTemplates();
}

function saveLog() {
  const data = collectForm();
  const text = generateText(data);
  logs = [{ ...data, text, favorite: false }, ...logs.filter(item => item.id !== data.id)].slice(0, 80);
  writeJson(STORAGE.logs, logs);
  currentText = text;
  $("preview").innerHTML = renderPreviewCard(data, text);
  $("preview").classList.add("ready");
  updatePreviewSizeClass();
  renderArchives();
  renderHistoryPicker();
  toast("已存到本機");
}

function loadLog(id) {
  const item = logs.find(log => log.id === id);
  if (!item) return;
  $("grade").value = item.grade || $("grade").value;
  $("subject").value = item.subject || $("subject").value;
  $("classType").value = item.classType || $("classType").value;
  $("className").value = item.customClassName || "";
  $("date").value = item.date || todayIso();
  $("progress").value = item.progress || "";
  $("pages").value = item.pages || "";
  $("quiz").value = item.quiz || "";
  $("homework").value = item.homework || "";
  $("outputMode").value = item.mode || "line";
  generate();
}

function deleteLog(id) {
  logs = logs.filter(log => log.id !== id);
  writeJson(STORAGE.logs, logs);
  renderArchives();
  renderHistoryPicker();
}

function saveProgressCache() {
  writeJson(STORAGE.progressCache, progressCache);
  renderProgressCache();
}

function normalizeProgressCacheItem(pathText) {
  const path = String(pathText || "").trim();
  if (!path) return null;
  const parts = path.split(" / ").map(part => part.trim()).filter(Boolean);
  return {
    id: encodeURIComponent(path),
    path,
    topic: parts.at(-1) || path
  };
}

function addProgressCacheItem(pathText) {
  const item = normalizeProgressCacheItem(pathText);
  if (!item) {
    toast("沒有可暫存的進度");
    return;
  }
  if (!progressCache.some(row => row.path === item.path)) {
    progressCache.push(item);
    saveProgressCache();
  }
  toast("已存入暫存區");
}

function addCurrentProgressToCache() {
  addProgressCacheItem(progressPath());
}

function removeProgressCacheItem(encodedPath) {
  const path = decodeURIComponent(encodedPath);
  progressCache = progressCache.filter(item => item.path !== path);
  saveProgressCache();
}

function clearProgressCache(confirmFirst = true) {
  if (!progressCache.length) return;
  if (confirmFirst && !confirm("確定清空所有暫存進度嗎？")) return;
  progressCache = [];
  saveProgressCache();
}

function applyProgressCacheToProgress() {
  if (!progressCache.length) {
    toast("暫存區目前沒有進度");
    return;
  }
  const text = progressCache.map(item => item.path).join("\n");
  lineAppend("progress", text);
  progressCache = [];
  saveProgressCache();
  toast("已加入今日進度");
}

function renderProgressCache() {
  const wrap = $("progressCacheList");
  if (!wrap) return;
  $("progressCacheCount").textContent = progressCache.length;
  if (!progressCache.length) {
    wrap.innerHTML = `<div class="empty compact-empty">目前沒有暫存進度。</div>`;
    return;
  }
  wrap.innerHTML = progressCache.map(item => `
    <div class="cache-item">
      <div class="cache-text">${escapeHtml(item.path)}</div>
      <button class="secondary danger-text mini-btn" type="button" data-remove-progress-cache="${escapeHtml(encodeURIComponent(item.path))}">刪除</button>
    </div>
  `).join("");
}

function productionScopePath(item) {
  const main = [item.book, item.chapter, item.section].filter(Boolean).join(" / ");
  const topics = item.topics?.length ? ` / ${item.topics.join("、")}` : "";
  const keyword = item.keyword ? `（補充：${item.keyword}）` : "";
  return `${main}${topics}${keyword}`;
}

function currentProductionScopeItem() {
  const item = {
    id: "",
    enabled: true,
    questionCount: "",
    grade: $("sharedGrade").value,
    subject: $("sharedSubject").value,
    book: $("sharedBook").value,
    chapter: $("sharedChapter").value,
    section: $("sharedSection").value,
    topics: Array.from(sharedSelectedTopics),
    keyword: $("sharedKeyword").value.trim()
  };
  item.path = productionScopePath(item);
  item.id = encodeURIComponent([
    item.grade,
    item.subject,
    item.book,
    item.chapter,
    item.section,
    item.topics.join("|"),
    item.keyword
  ].join("::"));
  return item;
}

function saveProductionScopeCache() {
  invalidateBatchOutput();
  productionScopeCache = productionScopeCache.map(normalizeProductionScopeItem);
  writeJson(STORAGE.productionScopeCache, productionScopeCache);
  renderProductionScopeCache();
  buildQuestionPrompt();
  buildHandoutPrompt();
  renderProductionFinalSummary();
}

function addCurrentProductionScope() {
  const item = currentProductionScopeItem();
  if (!item.book && !item.chapter && !item.section) {
    toast("請先選擇製作範圍");
    return;
  }
  if (!productionScopeCache.some(row => row.id === item.id)) {
    productionScopeCache.push(item);
    syncProductionModeButtons($("batchOutputHandout")?.checked ? ($("batchOutputQuestion")?.checked ? "questionHandout" : "multiHandout") : "multiQuestion");
    saveProductionScopeCache();
  }
  toast("已加入製作範圍");
}

function removeProductionScopeItem(id) {
  productionScopeCache = productionScopeCache.filter(item => item.id !== id);
  saveProductionScopeCache();
}

function normalizeProductionScopeItem(item) {
  return {
    ...item,
    enabled: item.enabled !== false,
    questionCount: item.questionCount ?? "",
    path: item.path || productionScopePath(item)
  };
}

function toggleProductionScopeItem(id, enabled) {
  productionScopeCache = productionScopeCache.map(item => (
    item.id === id ? { ...normalizeProductionScopeItem(item), enabled } : normalizeProductionScopeItem(item)
  ));
  saveProductionScopeCache();
}

function updateProductionScopeQuestionCount(id, value) {
  productionScopeCache = productionScopeCache.map(item => (
    item.id === id ? { ...normalizeProductionScopeItem(item), questionCount: value } : normalizeProductionScopeItem(item)
  ));
  writeJson(STORAGE.productionScopeCache, productionScopeCache);
  buildQuestionPrompt();
  buildHandoutPrompt();
  renderProductionFinalSummary();
}

function moveProductionScopeItem(id, direction) {
  const index = productionScopeCache.findIndex(item => item.id === id);
  if (index < 0) return;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= productionScopeCache.length) return;
  const items = productionScopeCache.map(normalizeProductionScopeItem);
  [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
  productionScopeCache = items;
  saveProductionScopeCache();
}

function clearProductionScopeCache(confirmFirst = true) {
  if (!productionScopeCache.length) return;
  if (confirmFirst && !confirm("確定清空所有製作範圍嗎？")) return;
  productionScopeCache = [];
  saveProductionScopeCache();
}

function productionScopeItemsForPrompt() {
  if (!usingProductionScopeCache()) return [currentProductionScopeItem()];
  const enabledItems = productionScopeCache.map(normalizeProductionScopeItem).filter(item => item.enabled !== false);
  return enabledItems.length ? enabledItems : [currentProductionScopeItem()];
}

function usingProductionScopeCache() {
  return !productionMode.startsWith("single") && productionScopeCache.map(normalizeProductionScopeItem).some(item => item.enabled !== false);
}

function productionScopePromptLines(items = productionScopeItemsForPrompt()) {
  return items.map((item, index) => {
    const topicText = item.topics?.length ? ` / 知識點：${item.topics.join("、")}` : "";
    const keywordText = item.keyword ? ` / 補充關鍵字：${item.keyword}` : "";
    const countText = item.questionCount ? ` / 題數分配：${item.questionCount} 題` : "";
    return `${index + 1}. ${item.grade} ${item.subject} / ${item.book} / ${item.chapter} / ${item.section}${topicText}${keywordText}${countText}\n   題庫 API subject：${questionBankSubjectName(item.grade, item.subject)} / level：${inferQuestionLevelKey(item.grade)}`;
  });
}

function productionScopeKeywordParts(items = productionScopeItemsForPrompt()) {
  const parts = [];
  items.forEach(item => {
    parts.push(item.keyword, item.chapter, item.section, ...(item.topics || []));
  });
  return [...new Set(parts.filter(Boolean))];
}

function productionScopeSummaryText(items = productionScopeItemsForPrompt()) {
  if (usingProductionScopeCache()) {
    const firstItems = items.slice(0, 3).map(item => productionScopePath(item));
    const more = items.length > 3 ? ` 等 ${items.length} 個範圍` : "";
    return `跨 ${items.length} 個範圍：${firstItems.join("；")}${more}`;
  }
  return productionScopePath(items[0]);
}

function selectedOutputLabels() {
  const labels = [];
  if ($("batchOutputFilename")?.checked) labels.push("檔名");
  if ($("batchOutputQuestion")?.checked) labels.push("題目");
  if ($("batchOutputHandout")?.checked) labels.push("講義");
  if ($("batchOutputWorkCard")?.checked) labels.push("工作卡提示詞");
  if ($("batchOutputLearningAid")?.checked) labels.push("AI學習輔助包");
  return labels;
}

const LEARNING_AID_MODULES = [
  { id: "learningAidMap", folder: "00_全冊學習地圖", title: "全冊學習地圖", purpose: "整理全冊或本章學習路線、概念先後關係與考試定位。", styleId: "learningAidMapStyle", useId: "learningAidMapUse" },
  { id: "learningAidPreview", folder: "01_章前預習", title: "章前預習", purpose: "把學生上課前需要知道的先備知識、關鍵問題與預習任務整理清楚。", styleId: "learningAidPreviewStyle", useId: "learningAidPreviewUse" },
  { id: "learningAidVisual", folder: "02_小節視覺圖解", title: "小節視覺圖解", purpose: "把抽象概念轉成流程圖、因果鏈、比較表、時間線、口訣與可視化圖解。", styleId: "learningAidVisualStyle", useId: "learningAidVisualUse" },
  { id: "learningAidParent", folder: "03_家長白話版", title: "家長白話版", purpose: "用家長聽得懂的語言說明孩子正在學什麼、常卡在哪裡、家長可以怎麼問。", styleId: "learningAidParentStyle", useId: "learningAidParentUse" }
];

const LEARNING_AID_STYLE_OPTIONS = [
  {
    group: "考生實用",
    options: [
      { value: "examSenior", label: "高三考生版", description: "黑白技術線稿、少裝飾、公式、判讀表與解題流程為主，適合學測分科考前複習。" },
      { value: "referencePolished", label: "參考書精修版", description: "粗細線分層、重點框、比較表清楚，像補習班講義或參考書內頁。" },
      { value: "examSprint", label: "段考速讀版", description: "重點密度高、標題精簡、常考句型與陷阱整理，適合段考前快速掃讀。" },
      { value: "gsatLiteracy", label: "學測素養版", description: "情境資料、圖表判讀、實驗流程與跨概念連結，適合素養題訓練。" },
      { value: "mistakeDiagnosis", label: "錯題診斷版", description: "錯因分類、陷阱提示、正確判讀流程與易混概念對照。" },
      { value: "formulaMap", label: "公式地圖版", description: "公式來源、適用條件、變形方向與單位檢查，適合物理化學。" },
      { value: "labAnalysis", label: "實驗判讀版", description: "裝置圖、變因控制、數據表與結論推理流程，適合自然科實驗題。" }
    ]
  },
  {
    group: "吸引學生",
    options: [
      { value: "candyCartoon", label: "卡通糖果風格", description: "明亮、可愛、低壓力，適合國小國中預習或課前引起動機。" },
      { value: "comicPanel", label: "漫畫分鏡風格", description: "3 到 5 格分鏡，呈現概念衝突、科學史或常見誤解。" },
      { value: "gameQuest", label: "遊戲關卡風格", description: "章節任務地圖、Boss 關、技能解鎖，適合學習路線與複習進度。" },
      { value: "detective", label: "偵探推理風格", description: "線索、證據、推論與真相，適合遺傳判讀、化學鑑定、地科證據題。" },
      { value: "medicalCase", label: "醫療病例風格", description: "病例卡、檢驗數據、診斷流程，適合生物生理與化學檢測。" },
      { value: "spaceMission", label: "太空任務風格", description: "任務控制台、航行路線與任務節點，適合物理、地科與跨單元學習。" },
      { value: "sciFiHud", label: "科幻 HUD 風格", description: "深色介面、數據框、向量線與儀表資訊，適合物理與資訊感題材。" },
      { value: "journalNotes", label: "手帳筆記風格", description: "紙感、貼紙、手寫註記與重點框，適合預習單與家長版。" },
      { value: "minimalWhiteboard", label: "極簡白板風格", description: "老師板書感、線條乾淨、重點直覺，適合概念暖身。" },
      { value: "infographic", label: "資訊圖表風格", description: "圖示、流程、比較表、比例圖，適合社群圖卡與講義摘要。" },
      { value: "newspaperFeature", label: "報紙專題風格", description: "科學新聞版面、標題、引言與資料圖，適合素養題、地科災害、科技議題。" },
      { value: "museumPanel", label: "博物館展板風格", description: "沉穩、標本感、說明牌式，適合生物分類、演化、地科岩石。" },
      { value: "labNotebook", label: "實驗室筆記風格", description: "格線紙、裝置圖、變因表與觀察紀錄，適合實驗設計。" },
      { value: "blueprintEngineering", label: "藍圖工程風格", description: "技術線稿、尺寸標記、箭頭與結構標注，適合物理裝置與結構圖。" }
    ]
  },
  {
    group: "原本模組風格",
    options: [
      { value: "routeMap", label: "地圖式路線圖", description: "以路線、節點與學習順序呈現全冊或章節架構。" },
      { value: "mindMap", label: "心智圖", description: "用中心主題向外分枝，整理概念分類與關聯。" },
      { value: "knowledgeTree", label: "知識樹", description: "用主幹、分枝、葉節點表現先備知識、核心概念與延伸。" },
      { value: "dashboard", label: "課程導航圖", description: "以儀表板方式整合進度、重點、易錯點與檢核項目。" },
      { value: "warmup", label: "概念暖身圖", description: "用少量問題與情境讓學生進入新章節。" },
      { value: "taskCard", label: "預習任務卡", description: "將預習任務拆成可勾選的短任務。" },
      { value: "scenario", label: "情境導入圖", description: "用生活或實驗情境帶出核心問題。" },
      { value: "onePage", label: "一頁式預習單", description: "在單頁內放先備知識、關鍵問題與課前檢核。" },
      { value: "auto", label: "依內容自動選流程圖／比較表／因果鏈／結構標示圖／時間軸圖", description: "依主題自動選擇最合適的視覺圖解形式。" },
      { value: "flow", label: "流程圖", description: "呈現步驟、機制、推理或操作流程。" },
      { value: "compare", label: "比較表圖解", description: "用欄列比較易混概念、條件、特徵與結果。" },
      { value: "cause", label: "因果鏈圖", description: "呈現原因、過程、影響與結果的連鎖關係。" },
      { value: "structure", label: "結構標示圖", description: "用標注線清楚指出構造、部位或圖像元素。" },
      { value: "timeline", label: "時間軸圖", description: "呈現科學史、發展歷程或事件先後。" },
      { value: "parentBrief", label: "家長懶人包", description: "用白話摘要孩子正在學的重點與家長可協助方向。" },
      { value: "dialogue", label: "親子對話圖", description: "用親子問答呈現概念檢核與常見卡點。" },
      { value: "poster", label: "學習重點海報", description: "用海報式版面整理少量關鍵概念。" },
      { value: "diagnosis", label: "成績診斷圖", description: "用診斷表方式呈現錯因、補救方向與追問問題。" }
    ]
  }
];

const LEARNING_AID_DEFAULT_STYLES = {
  learningAidMapStyle: "routeMap",
  learningAidPreviewStyle: "warmup",
  learningAidVisualStyle: "auto",
  learningAidParentStyle: "parentBrief"
};

const LEARNING_AID_STYLE_LABELS = Object.fromEntries(
  LEARNING_AID_STYLE_OPTIONS.flatMap(group => group.options.map(option => [option.value, option.label]))
);

const LEARNING_AID_STYLE_DESCRIPTIONS = Object.fromEntries(
  LEARNING_AID_STYLE_OPTIONS.flatMap(group => group.options.map(option => [option.value, option.description]))
);

const LEARNING_AID_USE_LABELS = {
  handout: "講義用",
  slide: "投影片用",
  social: "社群圖卡用",
  parentMessage: "家長傳訊用"
};

function selectedLearningAidModules() {
  return LEARNING_AID_MODULES.filter(item => $(item.id)?.checked);
}

function learningAidStyleLabel(item) {
  const value = $(item.styleId)?.value || "";
  return LEARNING_AID_STYLE_LABELS[value] || value || "未指定";
}

function learningAidStyleDescription(item) {
  const value = $(item.styleId)?.value || "";
  return LEARNING_AID_STYLE_DESCRIPTIONS[value] || "依教學內容選擇清楚、可讀、適合指定用途的視覺呈現。";
}

function renderLearningAidStyleOptions() {
  Object.entries(LEARNING_AID_DEFAULT_STYLES).forEach(([selectId, defaultValue]) => {
    const select = $(selectId);
    if (!select) return;
    const currentValue = select.value || defaultValue;
    select.innerHTML = LEARNING_AID_STYLE_OPTIONS.map(group => {
      const options = group.options.map(option => (
        `<option value="${option.value}">${option.label}</option>`
      )).join("");
      return `<optgroup label="${group.group}">${options}</optgroup>`;
    }).join("");
    select.value = LEARNING_AID_STYLE_LABELS[currentValue] ? currentValue : defaultValue;
  });
}

function learningAidUseLabel(item) {
  const value = $(item.useId)?.value || "";
  return LEARNING_AID_USE_LABELS[value] || value || "未指定";
}

function activeProductionModeLabel() {
  const active = document.querySelector("[data-production-mode].active");
  return active?.querySelector("strong")?.textContent?.trim() || "未指定";
}

function productionJobCardTitle(scopeItems, outputItems) {
  const first = scopeItems[0] || currentProductionScopeItem();
  const scopeType = usingProductionScopeCache() ? "跨單元" : "單元";
  const outputText = outputItems.length ? outputItems.join("＋") : "工作卡";
  return `${first.grade}${first.subject}_${scopeType}_${outputText}`;
}

function learningAidFolderTree(modules = selectedLearningAidModules()) {
  const folders = modules.map(item => item.folder);
  const readme = $("learningAidReadme")?.checked;
  return [
    "AI學習輔助包",
    folders.includes("00_全冊學習地圖") ? "├─ 00_全冊學習地圖" : "",
    folders.includes("01_章前預習") ? "├─ 01_章前預習" : "",
    folders.includes("02_小節視覺圖解") ? "├─ 02_小節視覺圖解" : "",
    folders.includes("03_家長白話版") ? "├─ 03_家長白話版" : "",
    readme ? "└─ README.md" : ""
  ].filter(Boolean).join("\n");
}

function buildLearningAidImagePromptLines(scopeItems, modules) {
  if (!modules.length) return "未勾選圖片輸出。";
  const scopeText = productionScopeSummaryText(scopeItems);
  const keywordText = productionScopeKeywordParts(scopeItems).join("、") || "依章節與小節名稱自行整理核心概念";
  return modules.map((item, index) => [
    `圖片提示詞 ${index + 1}：${item.title}`,
    `風格：${learningAidStyleLabel(item)}`,
    `風格說明：${learningAidStyleDescription(item)}`,
    `用途：${learningAidUseLabel(item)}`,
    `主題：${scopeText}`,
    `核心概念：${keywordText}`,
    `請生成一張「${learningAidStyleLabel(item)}」形式的${learningAidUseLabel(item)}教學圖片，對應資料夾為「${item.folder}」。`,
    `內容重點：${item.purpose}`,
    "視覺要求：乾淨、清楚、適合教學使用；文字使用繁體中文；避免過度裝飾、避免卡通化、避免看不清楚的小字。",
    "排版要求：標題清楚、層次分明、資訊可掃讀；講義用優先灰階高對比，社群或家長傳訊用可加入少量柔和色彩。"
  ].join("\n")).join("\n\n");
}

function buildLearningAidPrompt() {
  syncSharedScopeToTools();
  const scopeItems = productionScopeItemsForPrompt();
  const modules = selectedLearningAidModules();
  const moduleLines = modules.length
    ? modules.map((item, index) => `${index + 1}. ${item.folder}：${item.purpose} 圖片風格：${learningAidStyleLabel(item)}；用途：${learningAidUseLabel(item)}。`).join("\n")
    : "未勾選模組，請先確認 AI學習輔助包內容。";
  const readmeLine = $("learningAidReadme")?.checked
    ? "包含 README.md：說明各檔案用途、適用對象與建議使用順序。"
    : "不輸出 README.md。";
  return [
    "【AI學習輔助包指令】",
    "請依照下列範圍建立 AI學習輔助包，內容需適合台灣高中/國中/國小課程脈絡，語氣清楚、白話但不失準確。",
    "",
    "資料夾結構：",
    learningAidFolderTree(modules),
    "",
    "製作範圍：",
    productionScopePromptLines(scopeItems).join("\n"),
    "",
    "輸出模組：",
    moduleLines,
    readmeLine,
    "",
    "內容規則：",
    "1. 不改動正式講義 DOCX；AI學習輔助包屬於課前、課後、家長溝通與視覺化輔助素材。",
    "2. 內容要依照已選範圍，不要擴寫到無關章節。",
    "3. 每個小節都要包含學習主線、先備知識、核心概念、常見誤解、記憶口訣或判斷流程。",
    "4. 若跨多個範圍，先做總覽，再逐範圍輸出，避免混在一起看不懂。",
    "5. 家長白話版避免術語堆疊，要寫出孩子容易卡住的地方與可追問的檢核問題。",
    "",
    "四張圖片生成提示詞：",
    buildLearningAidImagePromptLines(scopeItems, modules)
  ].join("\n");
}

function buildCodexWorkCardPrompt() {
  syncSharedScopeToTools();
  const scopeItems = productionScopeItemsForPrompt();
  const outputItems = [];
  if ($("batchOutputFilename")?.checked) outputItems.push("檔名");
  if ($("batchOutputQuestion")?.checked) outputItems.push("題目 Word 測驗卷");
  if ($("batchOutputHandout")?.checked) outputItems.push("Word 講義");
  if ($("batchOutputLearningAid")?.checked) outputItems.push("AI學習輔助包");
  const taskTitle = productionJobCardTitle(scopeItems, outputItems);
  const scopeLines = productionScopePromptLines(scopeItems).join("\n");
  const outputLines = outputItems.length
    ? outputItems.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "1. 工作卡提示詞（僅整理任務範圍與執行規則）";
  const questionText = $("batchOutputQuestion")?.checked
    ? `題目設定：${questionGenerationModeLabel($("questionGenerationMode").value)}；${$("questionType").value}；共 ${$("questionTotalCount").value || 0} 題；基礎 ${$("questionBasicCount").value || 0}、中等 ${$("questionMiddleCount").value || 0}、挑戰 ${$("questionChallengeCount").value || 0}；${QUESTION_STYLE_LABELS[$("questionStyle").value] || $("questionStyle").value}／${QUESTION_LAYOUT_LABELS[$("questionLayout").value] || $("questionLayout").value}／${QUESTION_TYPOGRAPHY_LABELS[$("questionTypography").value] || $("questionTypography").value}`
    : "題目設定：未勾選題目輸出。";
  const handoutText = $("batchOutputHandout")?.checked
    ? `講義設定：${handoutAudienceLabel($("handoutAudience").value)}；${handoutStyleLabel($("handoutStyle").value)}；範例 ${$("handoutExampleCount").value || 0} 題；隨堂演練 ${$("handoutPracticeCount").value || 0} 題；${TYPOGRAPHY_LABELS[$("handoutTypography").value] || $("handoutTypography").value}`
    : "講義設定：未勾選講義輸出。";
  return [
    "【Codex 工作卡提示詞】",
    `請建立一張 Codex 工作卡，標題：${taskTitle}`,
    "",
    "【任務卡基本資料】",
    `任務名稱：${taskTitle}`,
    `製作模式：${activeProductionModeLabel()}`,
    `範圍型態：${usingProductionScopeCache() ? `跨 ${scopeItems.length} 個範圍` : "單一範圍"}`,
    "",
    "【任務目標】",
    `依照下列已選範圍，完成${outputItems.join("、") || "工作卡整理"}。請先讀取專案規則，再開始產出；只處理本工作卡列出的範圍與輸出，不要改動無關檔案。`,
    "",
    "【工作路徑】",
    "工作資料夾：",
    "D:\\Workspace\\Codex\\Projects\\製作題目",
    "講義輸出與題目輸出也使用 Codex 專案底下的新路徑；不要使用舊資料夾路徑。",
    "",
    "製作範圍：",
    scopeLines,
    "",
    "輸出項目：",
    outputLines,
    "",
    questionText,
    handoutText,
    $("batchOutputFilename")?.checked ? `【完整檔名】\n${buildFilename()}` : "",
    $("batchOutputQuestion")?.checked ? `【完整題目指令】\n${$("questionPromptOutput").value}` : "",
    $("batchOutputHandout")?.checked ? `【完整講義指令】\n${$("handoutPromptOutput").value}` : "",
    $("batchOutputLearningAid")?.checked ? buildLearningAidPrompt() : "",
    "",
    "【硬規則】",
    "1. 若使用本機題庫，必須沿用 question_bank_client.py 與題庫 API，不要直接讀 SQLite。",
    "2. 大量抓完整題目時，先用 questions() 取得 ID，再用 questions_by_id() 批次取得完整題目。",
    "3. Word/PDF 產出後要回報完整路徑；需要轉 PDF 時使用英文暫存路徑避開 LibreOffice 中文路徑問題。",
    "4. 若候選題不足，明確回報不足數量，不要用 AI 題冒充本機題庫原題。",
    "5. 完成後列出已產出檔案、題數/頁數檢查結果與任何不足。",
    "6. 若是正式講義，依專案規則區分學生可見內容與教師用內容，並做 Word/PDF 版面檢查。"
  ].join("\n");
}

function renderProductionFinalSummary() {
  const wrap = $("productionFinalSummary");
  if (!wrap) return;
  const scopeItems = productionScopeItemsForPrompt();
  const outputs = selectedOutputLabels();
  const questionText = $("batchOutputQuestion")?.checked
    ? `${questionGenerationModeLabel($("questionGenerationMode").value)}，${$("questionTotalCount").value || 0} 題`
    : "未勾選題目";
  const handoutText = $("batchOutputHandout")?.checked
    ? `${handoutAudienceLabel($("handoutAudience").value)}，${handoutStyleLabel($("handoutStyle").value)}`
    : "未勾選講義";
  const workCardText = $("batchOutputWorkCard")?.checked
    ? "已勾選工作卡提示詞"
    : "未勾選工作卡";
  const learningAidText = $("batchOutputLearningAid")?.checked
    ? `${selectedLearningAidModules().length} 張圖，${$("learningAidReadme")?.checked ? "含 README" : "不含 README"}`
    : "未勾選學習輔助包";
  wrap.innerHTML = [
    `<div><span>範圍</span><strong>${escapeHtml(usingProductionScopeCache() ? `跨 ${scopeItems.length} 個範圍` : "單一範圍")}</strong></div>`,
    `<div><span>輸出</span><strong>${escapeHtml(outputs.join("、") || "尚未勾選")}</strong></div>`,
    `<div><span>題目</span><strong>${escapeHtml(questionText)}</strong></div>`,
    `<div><span>講義</span><strong>${escapeHtml(handoutText)}</strong></div>`,
    `<div><span>工作卡</span><strong>${escapeHtml(workCardText)}</strong></div>`,
    `<div><span>AI輔助包</span><strong>${escapeHtml(learningAidText)}</strong></div>`
  ].join("");
}

function syncProductionModeButtons(activeMode) {
  productionMode = activeMode;
  writeJson("teachinglog.productionMode.v1", productionMode);
  document.querySelectorAll("[data-production-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.productionMode === activeMode);
  });
}

function applyProductionMode(mode) {
  const modes = {
    singleQuestion: { filename: false, question: true, handout: false },
    multiQuestion: { filename: false, question: true, handout: false },
    singleHandout: { filename: false, question: false, handout: true },
    multiHandout: { filename: false, question: false, handout: true },
    questionHandout: { filename: false, question: true, handout: true }
  };
  const selected = modes[mode] || modes.singleQuestion;
  $("batchOutputFilename").checked = selected.filename;
  $("batchOutputQuestion").checked = selected.question;
  $("batchOutputHandout").checked = selected.handout;
  syncProductionModeButtons(mode);
  updateProductionTaskVisibility();
  if ($("batchOutputText")) {
    $("batchOutputText").value = "";
    $("batchOutputText").classList.add("collapsed");
  }
  if ($("batchOutputPreview")) {
    $("batchOutputPreview").classList.add("muted");
    $("batchOutputPreview").textContent = "尚未產生結果。";
  }
  renderProductionFinalSummary();
}

function applyProductionPreset(preset) {
  const presets = {
    quiz20: () => {
      applyProductionMode("singleQuestion");
      $("questionUseCase").value = "quiz";
      $("questionType").value = "隨堂測驗";
      $("questionTotalCount").value = 20;
      $("questionBasicCount").value = 10;
      $("questionMiddleCount").value = 6;
      $("questionChallengeCount").value = 4;
      $("questionStyle").value = "standard";
      $("questionLayout").value = "spacious";
      $("questionTypography").value = "kai12";
    },
    examReview: () => {
      applyProductionMode("multiQuestion");
      $("questionUseCase").value = "review";
      $("questionType").value = "段考複習";
      $("questionTotalCount").value = 30;
      $("questionBasicCount").value = 12;
      $("questionMiddleCount").value = 12;
      $("questionChallengeCount").value = 6;
      $("questionStyle").value = "exam";
      $("questionLayout").value = "formal";
    },
    referenceHandout: () => {
      applyProductionMode("singleHandout");
      $("handoutAudience").value = "both";
      $("handoutStyle").value = "referenceBlack";
      $("handoutTypography").value = "ming11";
      $("handoutExampleCount").value = 4;
      $("handoutPracticeCount").value = 8;
      $("handoutQuestionSource").value = "mixed";
    },
    juniorExam: () => {
      applyProductionMode("multiQuestion");
      $("questionUseCase").value = "review";
      $("questionType").value = "段考複習";
      $("questionTotalCount").value = 25;
      $("questionBasicCount").value = 10;
      $("questionMiddleCount").value = 10;
      $("questionChallengeCount").value = 5;
      $("questionStyle").value = "gray";
      $("questionLayout").value = "bw";
    },
    bothPackage: () => {
      applyProductionMode("questionHandout");
      $("questionOutput").value = "pdf";
      $("handoutAudience").value = "both";
      $("handoutQuestionSource").value = "mixed";
    }
  };
  presets[preset]?.();
  syncSharedScopeToTools();
  buildQuestionPrompt();
  buildHandoutPrompt();
  renderProductionFinalSummary();
  toast("已套用常用組合");
}

function renderProductionScopeCache() {
  const wrap = $("productionScopeCacheList");
  if (!wrap) return;
  $("productionScopeCacheCount").textContent = productionScopeCache.length;
  if (!productionScopeCache.length) {
    wrap.innerHTML = `<div class="empty compact-empty">目前沒有暫存製作範圍；若只做單一單元，可直接產生結果。</div>`;
    renderProductionFinalSummary();
    return;
  }
  productionScopeCache = productionScopeCache.map(normalizeProductionScopeItem);
  wrap.innerHTML = productionScopeCache.map((item, index) => `
    <div class="cache-item production-scope-item ${item.enabled === false ? "disabled" : ""}">
      <label class="scope-use-check">
        <input type="checkbox" data-toggle-production-scope="${escapeHtml(item.id)}" ${item.enabled === false ? "" : "checked"}>
        <span>使用</span>
      </label>
      <div class="cache-text">
        <strong>${escapeHtml(item.grade)} ${escapeHtml(item.subject)}</strong>
        <span>${escapeHtml(productionScopePath(item))}</span>
      </div>
      <label class="scope-count-field">
        <span>題數</span>
        <input type="number" min="0" max="99" value="${escapeHtml(item.questionCount)}" data-production-scope-count="${escapeHtml(item.id)}" placeholder="自動">
      </label>
      <div class="scope-order-actions">
        <button class="secondary mini-btn" type="button" data-move-production-scope="${escapeHtml(item.id)}" data-scope-direction="-1" ${index === 0 ? "disabled" : ""}>上移</button>
        <button class="secondary mini-btn" type="button" data-move-production-scope="${escapeHtml(item.id)}" data-scope-direction="1" ${index === productionScopeCache.length - 1 ? "disabled" : ""}>下移</button>
        <button class="secondary danger-text mini-btn" type="button" data-remove-production-scope="${escapeHtml(item.id)}">刪除</button>
      </div>
    </div>
  `).join("");
  renderProductionFinalSummary();
}

function saveHomeworkPhrases() {
  writeJson(STORAGE.homeworkPhrases, homeworkPhrases);
  renderHomeworkPhrases();
}

function renderHomeworkPhrases() {
  const wrap = $("homeworkPhraseList");
  if (!wrap) return;
  wrap.innerHTML = homeworkPhrases.map((phrase, index) => `
    <span class="template-chip">
      <button class="chip quiet" type="button" data-homework="${escapeHtml(phrase)}">${escapeHtml(phrase)}</button>
      <button class="chip-delete" type="button" data-delete-homework-phrase="${index}" title="刪除片語">x</button>
    </span>
  `).join("");
}

function addHomeworkPhrase() {
  const value = $("newHomeworkPhrase").value.trim();
  if (!value) {
    toast("請先輸入片語");
    return;
  }
  if (!homeworkPhrases.includes(value)) {
    homeworkPhrases.push(value);
    saveHomeworkPhrases();
  }
  $("newHomeworkPhrase").value = "";
  toast("已加入句庫");
}

function deleteHomeworkPhrase(index) {
  homeworkPhrases.splice(Number(index), 1);
  saveHomeworkPhrases();
}

function clearProgressSearch() {
  $("progressSearch").value = "";
  $("progressSearchResults").innerHTML = "";
}

function clearArchiveSearch() {
  $("search").value = "";
  renderArchives();
}

function clearDataSearch() {
  $("dataSearchInput").value = "";
  renderCourseReviewCurrent();
}

function copyLog(id) {
  const item = logs.find(log => log.id === id);
  if (!item) return;
  navigator.clipboard.writeText(item.text || generateText(item));
  toast("已複製舊紀錄");
}

function toggleLogFavorite(id) {
  logs = logs.map(log => log.id === id ? { ...log, favorite: !log.favorite } : log);
  writeJson(STORAGE.logs, logs);
  renderArchives();
}

function downloadLogText(id) {
  const item = logs.find(log => log.id === id);
  if (!item) return;
  const text = item.text || generateText(item);
  const filename = `教學日誌_${cleanFilenamePart(item.className || "未命名")}_${item.date || todayIso()}.txt`;
  downloadTextFile(filename, text);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderArchives() {
  const keyword = $("search").value.trim().toLowerCase();
  const subject = $("filterSubject").value;
  const className = $("filterClass").value;
  const favoriteOnly = $("favoriteOnly").checked;
  const list = logs.filter(item => {
    const haystack = `${item.className} ${item.subject} ${item.date} ${item.progress} ${item.homework} ${item.text}`.toLowerCase();
    return (!keyword || haystack.includes(keyword))
      && (!subject || item.subject === subject)
      && (!className || item.className === className)
      && (!favoriteOnly || item.favorite);
  });

  renderSubjectFilter();
  renderClassFilter();

  if (!list.length) {
    $("archiveList").textContent = logs.length ? "沒有符合條件的存檔。" : "目前沒有存檔。";
    return;
  }

  const groups = groupArchives(list, $("archiveGroupBy").value);
  $("archiveList").innerHTML = Array.from(groups.entries()).map(([group, items]) => `
    <div class="archive-group">
      <div class="archive-group-title">${escapeHtml(group)} <span>${items.length}</span></div>
      ${items.map(item => renderArchiveCard(item)).join("")}
    </div>
  `).join("");
}

function groupArchives(items, groupBy) {
  const groups = new Map();
  items.forEach(item => {
    const key = groupBy === "className"
      ? item.className || "未填班級"
      : groupBy === "subject"
        ? item.subject || "未分類"
        : item.date || "未填日期";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function renderArchiveCard(item) {
  return `
    <div class="archive-card ${item.favorite ? "favorite" : ""}">
      <strong>${escapeHtml(item.className)}　${escapeHtml(item.date)}</strong>
      <div class="archive-meta">${escapeHtml(item.subject)} / ${escapeHtml(item.classType)}</div>
      <div>${escapeHtml((item.progress || "未填進度").slice(0, 80))}</div>
      <div class="archive-actions">
        <button class="secondary" type="button" data-favorite-log="${item.id}">${item.favorite ? "取消收藏" : "收藏"}</button>
        <button class="secondary" type="button" data-load="${item.id}">帶入</button>
        <button class="secondary" type="button" data-copy="${item.id}">複製</button>
        <button class="secondary" type="button" data-download-log="${item.id}">文字檔</button>
        <button class="secondary danger-text" type="button" data-delete="${item.id}">刪除</button>
      </div>
    </div>
  `;
}

function renderSubjectFilter() {
  const filter = $("filterSubject");
  const current = filter.value;
  const subjects = sortSubjects(Array.from(new Set(logs.map(item => item.subject).filter(Boolean))));
  filter.innerHTML = `<option value="">全部科目</option>${subjects.map(item => `<option>${escapeHtml(item)}</option>`).join("")}`;
  filter.value = current;
}

function renderClassFilter() {
  const filter = $("filterClass");
  const current = filter.value;
  const classes = Array.from(new Set(logs.map(item => item.className).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  filter.innerHTML = `<option value="">全部班級</option>${classes.map(item => `<option>${escapeHtml(item)}</option>`).join("")}`;
  filter.value = current;
}

function renderHistoryPicker() {
  const currentClass = composedClassName();
  const options = logs
    .filter(item => item.className === currentClass)
    .slice(0, 12)
    .map(item => `<option value="${item.id}">${escapeHtml(item.date)} ${escapeHtml((item.progress || "").slice(0, 24))}</option>`);
  $("historyPicker").innerHTML = `<option value="">選擇舊紀錄帶入</option>${options.join("")}`;
}

function saveDraft() {
  writeJson(STORAGE.draft, collectForm());
  renderHistoryPicker();
}

function restoreDraft() {
  const draft = readJson(STORAGE.draft, null);
  $("date").value = todayIso();
  if (!draft) return;
  $("grade").value = draft.grade || $("grade").value;
  $("subject").value = draft.subject || $("subject").value;
  $("classType").value = draft.classType || $("classType").value;
  $("className").value = draft.customClassName || "";
  $("date").value = draft.date || todayIso();
  $("progress").value = draft.progress || "";
  $("pages").value = draft.pages || "";
  $("quiz").value = draft.quiz || "";
  $("homework").value = draft.homework || "";
  $("outputMode").value = draft.mode || "line";
}

function quickToday() {
  $("date").value = todayIso();
  const lastSameClass = logs.find(item => item.className === composedClassName());
  if (lastSameClass && !$("progress").value.trim()) {
    $("progress").value = `接續上次：${lastSameClass.progress || ""}`.trim();
  }
  generate();
}

function quickYesterday() {
  $("date").value = todayIso(-1);
  generate();
}

function flushProgressCacheForGenerate() {
  if (!progressCache.length) return;
  const text = progressCache.map(item => item.path).join("\n");
  lineAppend("progress", text);
  progressCache = [];
  saveProgressCache();
}

function clearForm() {
  if (!confirm("確定清空目前填寫內容嗎？")) return;
  ["className", "progress", "pages", "quiz", "homework"].forEach(id => $(id).value = "");
  $("date").value = todayIso();
  currentText = "";
  $("preview").textContent = "尚未產生日誌。";
  $("preview").classList.remove("ready");
  saveDraft();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ templates, logs }, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `教學日誌備份_${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function initFilenameTool() {
  $("filenameDate").value = todayIso();
  try {
    filenameCourseData = await fetch("course-data.json").then(res => res.json());
    renderProgressSubjects();
    renderFilenameSubjects();
    initQuestionBuilder();
    initHandoutBuilder();
    initCourseReview();
    initSharedProductionScope();
  } catch {
    $("filenamePreview").textContent = "課程資料載入失敗，仍可手動輸入其他類型檔名。";
    $("topicChoices").textContent = "課程資料載入失敗，仍可手動輸入今日進度。";
    $("questionTopicChoices").textContent = "課程資料載入失敗，請確認 course-data.json 是否存在。";
    $("handoutTopicChoices").textContent = "課程資料載入失敗，請確認 course-data.json 是否存在。";
    $("dataOutline").innerHTML = `<div class="empty">課程資料載入失敗，請確認 course-data.json 是否存在。</div>`;
  }
  updateFilenameFields();
  updateFilenamePreview();
}

function renderProgressSubjects() {
  const subjects = subjectsForGrade($("grade").value);
  setSelectOptions("progressSubject", subjects, $("subject").value);
  renderProgressBooks();
}

function renderProgressBooks() {
  const books = booksForGrade(currentProgressSubject(), $("grade").value, $("progressSubject").value);
  setSelectOptions("progressBook", books, $("progressBook").value);
  renderProgressChapters();
}

function renderProgressChapters() {
  const chapters = Object.keys(currentProgressBook());
  $("progressChapter").innerHTML = chapters.map(chapter => `<option>${escapeHtml(chapter)}</option>`).join("");
  renderProgressSections();
}

function renderProgressSections() {
  const sections = Object.keys(currentProgressChapter());
  $("progressSection").innerHTML = sections.map(section => `<option>${escapeHtml(section)}</option>`).join("");
  renderProgressTopics();
}

function renderProgressTopics() {
  const topics = currentProgressSection();
  if (!topics.length) {
    $("topicChoices").textContent = "這個節目前沒有小重點，可直接加入目前章節。";
    return;
  }
  $("topicChoices").innerHTML = topics.map(topic => (
    `<span class="path-action">
      <button class="path-chip" type="button" data-progress-topic="${escapeHtml(encodeURIComponent(progressPath(topic)))}">${escapeHtml(topic)}</button>
      <button class="mini-icon-btn" type="button" data-cache-progress-topic="${escapeHtml(encodeURIComponent(progressPath(topic)))}" title="存入暫存">+</button>
    </span>`
  )).join("");
}

function currentProgressSubject() {
  return filenameCourseData[$("progressSubject").value] || { books: {} };
}

function currentProgressBook() {
  return currentProgressSubject().books?.[$("progressBook").value] || {};
}

function currentProgressChapter() {
  return currentProgressBook()[$("progressChapter").value] || {};
}

function currentProgressSection() {
  return currentProgressChapter()[$("progressSection").value] || [];
}

function progressPath(topic = "") {
  return [
    $("progressBook").value,
    $("progressChapter").value,
    $("progressSection").value,
    topic
  ].filter(Boolean).join(" / ");
}

function addCurrentProgressPath() {
  const text = progressPath();
  if (!text) {
    toast("請先選擇章節");
    return;
  }
  lineAppend("progress", text);
  toast("已加入今日進度");
}

function searchProgressOptions() {
  const keyword = $("progressSearch").value.trim().toLowerCase();
  if (!keyword) {
    $("progressSearchResults").innerHTML = "";
    return;
  }
  const rows = [];
  Object.entries(currentProgressSubject().books || {}).forEach(([book, chapters]) => {
    Object.entries(chapters || {}).forEach(([chapter, sections]) => {
      Object.entries(sections || {}).forEach(([section, topics]) => {
        const pathText = `${book} / ${chapter} / ${section}`;
        if (pathText.toLowerCase().includes(keyword)) {
          rows.push(pathText);
        }
        (topics || []).forEach(topic => {
          const full = `${pathText} / ${topic}`;
          if (full.toLowerCase().includes(keyword)) rows.push(full);
        });
      });
    });
  });
  const unique = Array.from(new Set(rows)).slice(0, 36);
  $("progressSearchResults").innerHTML = unique.length
    ? unique.map(row => `<span class="path-action">
        <button type="button" data-progress-search="${escapeHtml(encodeURIComponent(row))}">${escapeHtml(row)}</button>
        <button class="mini-icon-btn" type="button" data-cache-progress-search="${escapeHtml(encodeURIComponent(row))}" title="存入暫存">+</button>
      </span>`).join("")
    : `<span>找不到符合的章節。</span>`;
}

function initSharedProductionScope() {
  if (!$("sharedGrade")) return;
  $("sharedGrade").value = $("grade").value;
  renderSharedSubjects();
}

function renderSharedSubjects() {
  const subjects = subjectsForGrade($("sharedGrade").value);
  setSelectOptions("sharedSubject", subjects, $("subject").value);
  renderSharedBooks();
}

function renderSharedBooks() {
  const books = booksForGrade(currentSharedSubject(), $("sharedGrade").value, $("sharedSubject").value);
  setSelectOptions("sharedBook", books, $("sharedBook").value);
  renderSharedChapters();
}

function renderSharedChapters() {
  const chapters = Object.keys(currentSharedBook());
  $("sharedChapter").innerHTML = chapters.map(chapter => {
    const code = chapterCode(chapter);
    const label = code ? `${code} ${chapter}` : chapter;
    return `<option value="${escapeHtml(chapter)}">${escapeHtml(label)}</option>`;
  }).join("");
  renderSharedSections();
}

function renderSharedSections() {
  const sections = Object.keys(currentSharedChapter());
  $("sharedSection").innerHTML = sections.map(section => `<option>${escapeHtml(section)}</option>`).join("");
  renderSharedTopics();
}

function renderSharedTopics() {
  sharedSelectedTopics.clear();
  const topics = currentSharedSection();
  if (!topics.length) {
    $("sharedTopicChoices").textContent = "這個節目前沒有小重點，可直接使用目前章節與節名。";
    $("sharedTopicCount").textContent = "0";
    syncSharedScopeToTools();
    return;
  }
  $("sharedTopicChoices").innerHTML = topics.map(topic => (
    `<button class="path-chip selectable" type="button" data-shared-topic="${escapeHtml(topic)}">${escapeHtml(topic)}</button>`
  )).join("");
  $("sharedTopicCount").textContent = "0";
  syncSharedScopeToTools();
}

function currentSharedSubject() {
  return filenameCourseData[$("sharedSubject").value] || { books: {} };
}

function currentSharedBook() {
  return currentSharedSubject().books?.[$("sharedBook").value] || {};
}

function currentSharedChapter() {
  return currentSharedBook()[$("sharedChapter").value] || {};
}

function currentSharedSection() {
  return currentSharedChapter()[$("sharedSection").value] || [];
}

function toggleSharedTopic(topic, button) {
  if (sharedSelectedTopics.has(topic)) {
    sharedSelectedTopics.delete(topic);
    button.classList.remove("selected");
  } else {
    sharedSelectedTopics.add(topic);
    button.classList.add("selected");
  }
  $("sharedTopicCount").textContent = sharedSelectedTopics.size;
  syncSharedScopeToTools();
}

function syncSharedScopeToTools() {
  if (!$("sharedGrade")) return;
  const grade = $("sharedGrade").value;
  const subject = $("sharedSubject").value;
  const book = $("sharedBook").value;
  const chapter = $("sharedChapter").value;
  const section = $("sharedSection").value;
  const keyword = $("sharedKeyword").value.trim();

  if (filenameCourseData[subject]) {
    $("filenameSubject").value = subject;
    renderFilenameCourses();
    setSelectValueIfPossible("filenameCourse", book);
    renderFilenameChapters();
    setSelectValueIfPossible("filenameChapter", chapter);
    syncFilenameCourseAlias();
    syncFilenameUnit();
    updateFilenamePreview();
  }

  $("questionGrade").value = grade;
  renderQuestionSubjects();
  setSelectValueIfPossible("questionSubject", subject);
  renderQuestionBooks();
  setSelectValueIfPossible("questionBook", book);
  renderQuestionChapters();
  setSelectValueIfPossible("questionChapter", chapter);
  renderQuestionSections();
  setSelectValueIfPossible("questionSection", section);
  $("questionKeyword").value = keyword;
  renderQuestionTopics();
  questionSelectedTopics = new Set(sharedSelectedTopics);
  $("questionTopicCount").textContent = questionSelectedTopics.size;
  buildQuestionPrompt();

  $("handoutGrade").value = grade;
  renderHandoutSubjects();
  setSelectValueIfPossible("handoutSubject", subject);
  renderHandoutBooks();
  setSelectValueIfPossible("handoutBook", book);
  renderHandoutChapters();
  setSelectValueIfPossible("handoutChapter", chapter);
  renderHandoutSections();
  setSelectValueIfPossible("handoutSection", section);
  renderHandoutTopics();
  handoutSelectedTopics = new Set(sharedSelectedTopics);
  $("handoutTopicCount").textContent = handoutSelectedTopics.size;
  buildHandoutPrompt();
}

function questionValidationError(spec = questionSpec()) {
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  if (!integer(spec.totalCount, 1, 60)) return "總題數須為 1 至 60 的整數。";
  const counts = Object.values(spec.difficulty);
  if (counts.some(value => !integer(value, 0, 60))) return "難度題數須為 0 至 60 的整數。";
  if (counts.reduce((sum, value) => sum + value, 0) !== spec.totalCount) return "基礎、中等、挑戰題數合計必須等於總題數。";
  if (!integer(spec.candidateCount, 5, 100) || spec.candidateCount < spec.totalCount) return "候選題數須為 5 至 100 的整數，且不可少於總題數。";
  const assigned = spec.scopeItems.filter(item => String(item.questionCount ?? "").trim() !== "");
  if (assigned.some(item => !integer(Number(item.questionCount), 1, spec.totalCount))) return "各範圍題數須為正整數，或留空自動分配。";
  const sum = assigned.reduce((total, item) => total + Number(item.questionCount), 0);
  const autoCount = spec.scopeItems.length - assigned.length;
  if (sum + autoCount > spec.totalCount || (!autoCount && sum !== spec.totalCount)) return "範圍題數分配與總題數不一致，請調整或留空自動分配。";
  return "";
}

function handoutValidationError(spec = handoutSpec()) {
  const counts = [];
  if (spec.include.examples) counts.push([spec.exampleCount, 12]);
  if (spec.include.practice) counts.push([spec.practiceCount, 20], ...Object.values(spec.questionCounts).map(value => [value, 30]));
  if (counts.some(([value, max]) => !Number.isInteger(value) || value < 0 || value > max)) return "講義題數須為整數：範例 0–12、演練 0–20、各素養題 0–30。";
  if (!Object.values(spec.include).some(Boolean)) return "請至少選擇一個講義內容模組。";
  return "";
}

function productionValidationError() {
  return ($("batchOutputQuestion")?.checked && questionValidationError()) ||
    ($("batchOutputHandout")?.checked && handoutValidationError()) || "";
}

function invalidateBatchOutput() {
  if (!$("batchOutputText")) return;
  $("batchOutputText").value = "";
  $("batchOutputText").classList.add("collapsed");
  $("batchOutputPreview").textContent = "設定已更新，請重新產生結果。";
}

function buildBatchOutput() {
  syncSharedScopeToTools();
  const validationError = productionValidationError();
  if (validationError) {
    $("batchOutputText").value = "";
    $("batchOutputPreview").textContent = validationError;
    toast(validationError);
    return false;
  }
  updateProductionTaskVisibility();
  const blocks = [];
  const summary = [];
  if ($("batchOutputFilename").checked) {
    blocks.push(["【檔名】", buildFilename()].join("\n"));
    summary.push("檔名");
  }
  if ($("batchOutputQuestion").checked) {
    buildQuestionPrompt();
    blocks.push(["【題目指令】", $("questionPromptOutput").value].join("\n"));
    summary.push("題目指令");
  }
  if ($("batchOutputHandout").checked) {
    buildHandoutPrompt();
    blocks.push(["【講義指令】", $("handoutPromptOutput").value].join("\n"));
    summary.push("講義指令");
  }
  if ($("batchOutputWorkCard")?.checked) {
    blocks.push(buildCodexWorkCardPrompt());
    summary.push("工作卡提示詞");
  }
  if ($("batchOutputLearningAid")?.checked) {
    blocks.push(buildLearningAidPrompt());
    summary.push("AI學習輔助包");
  }
  const outputText = $("batchOutputText");
  outputText.value = blocks.length ? blocks.join("\n\n---\n\n") : "請至少勾選一個輸出項目。";
  outputText.scrollTop = 0;
  outputText.classList.toggle("collapsed", !blocks.length);
  $("batchOutputPreview").classList.toggle("muted", !blocks.length);
  $("batchOutputPreview").textContent = blocks.length
    ? `已產生：${summary.join("、")}；${usingProductionScopeCache() ? `跨 ${productionScopeItemsForPrompt().length} 個範圍` : "單一範圍"}。${$("batchOutputWorkCard")?.checked ? "工作卡提示詞已放入下方欄位。" : ""}${$("batchOutputLearningAid")?.checked ? "AI學習輔助包與圖片提示詞已放入下方欄位。" : ""}可直接複製全部結果。`
    : "請至少勾選一個輸出項目。";
  renderProductionFinalSummary();
  toast("已產生勾選項目");
}

async function copyBatchOutput() {
  if (buildBatchOutput() === false) return;
  await navigator.clipboard.writeText($("batchOutputText").value);
  toast("已複製全部結果");
}

function downloadWorkCardMarkdown() {
  syncSharedScopeToTools();
  const validationError = productionValidationError();
  if (validationError) { toast(validationError); return; }
  if (!$("batchOutputWorkCard")?.checked) {
    $("batchOutputWorkCard").checked = true;
  }
  const text = buildCodexWorkCardPrompt();
  const scopeItems = productionScopeItemsForPrompt();
  const outputItems = selectedOutputLabels().filter(label => label !== "工作卡提示詞");
  const filename = `Codex工作卡_${cleanFilenamePart(productionJobCardTitle(scopeItems, outputItems))}_${todayIso()}.md`;
  downloadTextFile(filename, text);
  toast("已下載工作卡 Markdown");
}

function updateProductionTaskVisibility() {
  const visibleByTask = {
    filename: $("batchOutputFilename")?.checked,
    question: $("batchOutputQuestion")?.checked,
    handout: $("batchOutputHandout")?.checked
  };
  $("learningAidOptions")?.classList.toggle("hidden-view", !$("batchOutputLearningAid")?.checked);
  document.querySelectorAll("[data-production-task]").forEach(panel => {
    const shouldShow = activeView === "production" && visibleByTask[panel.dataset.productionTask];
    panel.classList.toggle("hidden-view", !shouldShow);
  });
  if ($("batchOutputText") && !$("batchOutputText").value.trim()) {
    $("batchOutputText").classList.add("collapsed");
    $("batchOutputPreview").classList.add("muted");
    $("batchOutputPreview").textContent = "尚未產生結果。";
  }
  renderProductionFinalSummary();
}

function initQuestionBuilder() {
  $("questionGrade").value = $("grade").value;
  renderQuestionSubjects();
  buildQuestionPrompt();
}

function renderQuestionSubjects() {
  const subjects = subjectsForGrade($("questionGrade").value);
  setSelectOptions("questionSubject", subjects, $("subject").value);
  renderQuestionBooks();
}

function renderQuestionBooks() {
  const books = booksForGrade(currentQuestionSubject(), $("questionGrade").value, $("questionSubject").value);
  setSelectOptions("questionBook", books, $("questionBook").value);
  renderQuestionChapters();
}

function renderQuestionChapters() {
  const chapters = Object.keys(currentQuestionBook());
  $("questionChapter").innerHTML = chapters.map(chapter => `<option>${escapeHtml(chapter)}</option>`).join("");
  renderQuestionSections();
}

function renderQuestionSections() {
  const sections = Object.keys(currentQuestionChapter());
  $("questionSection").innerHTML = sections.map(section => `<option>${escapeHtml(section)}</option>`).join("");
  renderQuestionTopics();
}

function renderQuestionTopics() {
  questionSelectedTopics.clear();
  const topics = currentQuestionSection();
  if (!topics.length) {
    $("questionTopicChoices").textContent = "這個節目前沒有知識點，會使用章節與節名當搜尋範圍。";
    $("questionTopicCount").textContent = "0";
    buildQuestionPrompt();
    return;
  }
  $("questionTopicChoices").innerHTML = topics.map(topic => (
    `<button class="path-chip selectable" type="button" data-question-topic="${escapeHtml(topic)}">${escapeHtml(topic)}</button>`
  )).join("");
  $("questionTopicCount").textContent = "0";
  buildQuestionPrompt();
}

function currentQuestionSubject() {
  return filenameCourseData[$("questionSubject").value] || { books: {} };
}

function currentQuestionBook() {
  return currentQuestionSubject().books?.[$("questionBook").value] || {};
}

function currentQuestionChapter() {
  return currentQuestionBook()[$("questionChapter").value] || {};
}

function currentQuestionSection() {
  return currentQuestionChapter()[$("questionSection").value] || [];
}

function toggleQuestionTopic(topic, button) {
  if (questionSelectedTopics.has(topic)) {
    questionSelectedTopics.delete(topic);
    button.classList.remove("selected");
  } else {
    questionSelectedTopics.add(topic);
    button.classList.add("selected");
  }
  $("questionTopicCount").textContent = questionSelectedTopics.size;
  buildQuestionPrompt();
}

function inferQuestionLevelKey(grade) {
  if (/^高/.test(grade)) return "senior";
  if (/^國/.test(grade)) return "junior";
  if (/^小/.test(grade)) return "primary";
  return "";
}

function questionBankSubjectName(grade, subject) {
  const prefix = /^高/.test(grade) ? "高中" : /^國/.test(grade) ? "國中" : /^小/.test(grade) ? "國小" : "";
  if (!prefix) return subject;
  if (prefix === "高中" && ["物理", "化學", "生物", "地科", "國文", "英文", "數學"].includes(subject)) {
    return `${prefix}${subject}`;
  }
  if (prefix === "國中" && ["自然", "社會", "國文", "英文", "數學"].includes(subject)) {
    return `${prefix}${subject}`;
  }
  if (prefix === "國小" && ["自然", "社會", "國文", "英文", "數學"].includes(subject)) {
    return `${prefix}${subject}`;
  }
  return `${prefix}${subject}`;
}

function questionKeywordParts() {
  if (usingProductionScopeCache()) return productionScopeKeywordParts();
  const manual = $("questionKeyword").value.trim();
  const topics = Array.from(questionSelectedTopics);
  return [
    manual,
    $("questionChapter").value,
    $("questionSection").value,
    ...topics
  ].filter(Boolean);
}

function questionSpec() {
  const grade = $("questionGrade").value;
  const subject = $("questionSubject").value;
  const scopeItems = productionScopeItemsForPrompt();
  const basic = Number($("questionBasicCount").value || 0);
  const middle = Number($("questionMiddleCount").value || 0);
  const challenge = Number($("questionChallengeCount").value || 0);
  const total = Number($("questionTotalCount").value);
  const scopeValue = (getValue) => [...new Set(scopeItems.map(getValue))].join("、");
  return {
    grade: scopeValue(item => item.grade),
    subject: scopeValue(item => item.subject),
    api: "http://127.0.0.1:8787",
    level: scopeValue(item => inferQuestionLevelKey(item.grade)),
    questionBankSubject: scopeValue(item => questionBankSubjectName(item.grade, item.subject)),
    book: $("questionBook").value,
    chapter: $("questionChapter").value,
    section: $("questionSection").value,
    topics: Array.from(questionSelectedTopics),
    scopeItems,
    keyword: questionKeywordParts().join(" "),
    candidateCount: Number($("questionCandidateCount").value),
    totalCount: total,
    difficulty: { basic, middle, challenge },
    generationMode: $("questionGenerationMode").value,
    useCase: $("questionUseCase").value,
    type: $("questionType").value,
    output: $("questionOutput").value,
    style: $("questionStyle").value,
    styleLabel: QUESTION_STYLE_LABELS[$("questionStyle").value] || $("questionStyle").value,
    layout: $("questionLayout").value,
    layoutLabel: QUESTION_LAYOUT_LABELS[$("questionLayout").value] || $("questionLayout").value,
    typography: $("questionTypography").value,
    typographyLabel: QUESTION_TYPOGRAPHY_LABELS[$("questionTypography").value] || $("questionTypography").value,
    notes: $("questionNotes").value.trim()
  };
}

function questionGenerationModeLabel(value) {
  return {
    bankOriginal: "本機題庫原題",
    aiVariant: "AI 生成仿題"
  }[value] || value;
}

function questionUseCaseLabel(value) {
  return {
    quiz: "一般隨堂測驗",
    exam: "正式考卷",
    practice: "練習題組",
    review: "考前複習"
  }[value] || value;
}

function syncQuestionModeButtons() {
  if (!$("questionGenerationMode")) return;
  const current = $("questionGenerationMode").value;
  document.querySelectorAll("[data-question-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.questionMode === current);
  });
}

function updateQuestionCurrentSummary(spec = questionSpec()) {
  if (!$("questionCurrentSummary")) return;
  const topicText = usingProductionScopeCache()
    ? [...new Set(spec.scopeItems.flatMap(item => item.topics || []))].join("、") || "依各範圍章節與節名"
    : spec.topics.length ? spec.topics.join("、") : "依章節與節名";
  $("questionCurrentTitle").textContent = `${spec.grade} ${spec.subject}｜${spec.type}`;
  $("questionCurrentSummary").innerHTML = [
    `<p>${escapeHtml(productionScopeSummaryText(spec.scopeItems))}</p>`,
    `<p>${escapeHtml(questionUseCaseLabel(spec.useCase))}，${escapeHtml(spec.totalCount)} 題：基礎 ${escapeHtml(spec.difficulty.basic)}、中等 ${escapeHtml(spec.difficulty.middle)}、挑戰 ${escapeHtml(spec.difficulty.challenge)}</p>`,
    `<p>${escapeHtml(spec.styleLabel)} / ${escapeHtml(spec.layoutLabel)} / ${escapeHtml(spec.typographyLabel)}</p>`,
    `<p>知識點：${escapeHtml(topicText)}</p>`
  ].join("");
  $("questionModeSummary").textContent = questionGenerationModeLabel(spec.generationMode);
  $("questionCountSummary").textContent = `${spec.candidateCount} -> ${spec.totalCount} 題`;
  syncQuestionModeButtons();
}

function outputLabel(value) {
  return {
    word: "Word 檔",
    pdf: "Word 檔並轉出 PDF",
    obsidian: "Obsidian Markdown"
  }[value] || value;
}

function buildQuestionPrompt() {
  if (!$("questionPromptOutput")) return;
  const spec = questionSpec();
  const error = questionValidationError(spec);
  if (error) { $("questionPromptOutput").value = error; return false; }
  updateQuestionCurrentSummary(spec);
  const topicText = usingProductionScopeCache()
    ? [...new Set(spec.scopeItems.flatMap(item => item.topics || []))].join("、") || "未指定，使用各範圍章節與節名"
    : spec.topics.length ? spec.topics.join("、") : "未指定，使用章節與節名";
  const isBankOriginal = spec.generationMode === "bankOriginal";
  const rangeLines = productionScopePromptLines(spec.scopeItems);
  const rangeLabel = usingProductionScopeCache() ? `跨 ${spec.scopeItems.length} 個範圍` : `${spec.book} / ${spec.chapter} / ${spec.section}`;
  const notes = spec.notes || (isBankOriginal
    ? "使用本機題庫原題，不改寫題幹與選項；僅整理成指定版型並附答案解析。"
    : "AI 生成仿題不要照抄原題；保留同一考點與難度，改數字、情境或問法。若原題明確標記為會考題，可以直接使用原題。");
  const opening = isBankOriginal
    ? [
        `請用本機題庫抓${spec.grade}${spec.subject}「${spec.keyword || rangeLabel}」相關題目 ${spec.candidateCount} 題，`,
        `直接篩選 ${spec.totalCount} 題本機題庫原題，製作成${spec.type}。`
      ]
    : [
        `請用本機題庫抓${spec.grade}${spec.subject}「${spec.keyword || rangeLabel}」相關題目 ${spec.candidateCount} 題作為參考，`,
        `幫我用 AI 生成 ${spec.totalCount} 題同考點仿題，製作成${spec.type}。`
      ];
  const requirementLines = isBankOriginal
    ? [
        `基礎 ${spec.difficulty.basic} 題、中等 ${spec.difficulty.middle} 題、挑戰 ${spec.difficulty.challenge} 題。`,
        `出題方式：本機題庫原題。`,
        `請直接使用本機題庫題目，不改寫題幹、選項與答案；可整理標點、換行與版面，但不得改變原題內容。`,
        `若題庫候選題不足，請明確回報不足數量，不要自行補 AI 題冒充原題。`,
        `每題附答案與解析；若題庫已有解析可整理語句，若解析不足可補充教師用解析並標示為補充。`,
        `產出格式：${outputLabel(spec.output)}。`
      ]
    : [
        `基礎 ${spec.difficulty.basic} 題、中等 ${spec.difficulty.middle} 題、挑戰 ${spec.difficulty.challenge} 題。`,
        `出題方式：AI 生成仿題。`,
        `使用仿題方式輸出，一般題庫題不要直接照抄原題；若原題明確標記為會考題，可以直接使用原題。`,
        `非會考題先用題庫原題作為考點與難度參考，再重新生成同概念題目，需改數字、情境、問法或選項配置。`,
        `每題附答案與詳細解析。`,
        `產出格式：${outputLabel(spec.output)}。`
      ];
  if (usingProductionScopeCache()) {
    requirementLines.push(`若為跨單元範圍，請平均涵蓋上列範圍；題目不足時可依教學重點調整比例，並在題庫參考摘要中註明。`);
  }
  const prompt = [
    ...opening,
    ``,
    `範圍：`,
    `年級：${spec.grade}`,
    `科目：${spec.subject}`,
    `題庫 API subject：${spec.questionBankSubject}`,
    `level：${spec.level}`,
    `製作範圍：${rangeLabel}`,
    ...rangeLines,
    `知識點：${topicText}`,
    `搜尋關鍵字：${spec.keyword}`,
    `出題方式：${questionGenerationModeLabel(spec.generationMode)}`,
    `使用情境：${questionUseCaseLabel(spec.useCase)}`,
    ``,
    `要求：`,
    ...requirementLines,
    ``,
    `版型與排版：`,
    `版型：${spec.styleLabel}`,
    `排版：${spec.layoutLabel}`,
    `字體：${spec.typographyLabel}`,
    `Word 測驗卷請以此字體設定為準；標題與大題標可依階層加大，本文、題目、選項與解析以指定字級為基準。`,
    ``,
    `串接規則：`,
    `請沿用 D:\\Workspace\\Codex\\Projects\\製作題目\\question_bank_client.py。`,
    `題庫 API：${spec.api}`,
    `不要直接讀 SQLite。`,
    `大量抓完整題目時，先用 questions() 取得 ID，再用 questions_by_id() 批次取得完整題目。`,
    ``,
    `補充要求：`,
    notes
  ].join("\n");
  $("questionPromptOutput").value = prompt;
  $("questionSearchSummary").textContent = `${questionGenerationModeLabel(spec.generationMode)} / ${spec.level} / ${spec.questionBankSubject} / ${spec.keyword || "未填關鍵字"} / ${spec.candidateCount} -> ${spec.totalCount} / ${spec.styleLabel} / ${spec.layoutLabel} / ${spec.typographyLabel}`;
  renderProductionFinalSummary();
}

async function copyQuestionPrompt() {
  if (buildQuestionPrompt() === false) { toast($("questionPromptOutput").value); return; }
  await navigator.clipboard.writeText($("questionPromptOutput").value);
  toast("已複製出題指令");
}

async function makeQuestions() {
  if (buildQuestionPrompt() === false) { toast($("questionPromptOutput").value); return; }
  const spec = questionSpec();
  try {
    await navigator.clipboard.writeText($("questionPromptOutput").value);
    $("questionSearchSummary").textContent = `已準備製作：${spec.level} / ${spec.questionBankSubject} / ${spec.keyword || "未填關鍵字"} / ${spec.styleLabel} / ${spec.layoutLabel} / ${spec.typographyLabel}；指令已複製，請貼給 Codex 開始出卷。`;
    toast("製作題目指令已複製");
  } catch {
    $("questionSearchSummary").textContent = "已產生製作題目指令；瀏覽器未允許自動複製，請手動複製下方文字。";
    toast("已產生指令，請手動複製");
  }
}

function downloadQuestionSpec() {
  if (buildQuestionPrompt() === false) { toast($("questionPromptOutput").value); return; }
  const spec = questionSpec();
  const blob = new Blob([JSON.stringify({ ...spec, prompt: $("questionPromptOutput").value }, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `出題需求_${cleanFilenamePart(spec.grade + spec.subject)}_${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function initHandoutBuilder() {
  $("handoutGrade").value = $("grade").value;
  renderHandoutSubjects();
  buildHandoutPrompt();
}

function renderHandoutSubjects() {
  const subjects = subjectsForGrade($("handoutGrade").value);
  setSelectOptions("handoutSubject", subjects, $("subject").value);
  renderHandoutBooks();
}

function renderHandoutBooks() {
  const books = booksForGrade(currentHandoutSubject(), $("handoutGrade").value, $("handoutSubject").value);
  setSelectOptions("handoutBook", books, $("handoutBook").value);
  renderHandoutChapters();
}

function renderHandoutChapters() {
  const chapters = Object.keys(currentHandoutBook());
  $("handoutChapter").innerHTML = chapters.map(chapter => `<option>${escapeHtml(chapter)}</option>`).join("");
  renderHandoutSections();
}

function renderHandoutSections() {
  const sections = Object.keys(currentHandoutChapter());
  $("handoutSection").innerHTML = sections.map(section => `<option>${escapeHtml(section)}</option>`).join("");
  renderHandoutTopics();
}

function renderHandoutTopics() {
  handoutSelectedTopics.clear();
  const topics = currentHandoutSection();
  if (!topics.length) {
    $("handoutTopicChoices").textContent = "這個節目前沒有知識點，會使用章節與節名安排講義。";
    $("handoutTopicCount").textContent = "0";
    buildHandoutPrompt();
    return;
  }
  $("handoutTopicChoices").innerHTML = topics.map(topic => (
    `<button class="path-chip selectable" type="button" data-handout-topic="${escapeHtml(topic)}">${escapeHtml(topic)}</button>`
  )).join("");
  $("handoutTopicCount").textContent = "0";
  buildHandoutPrompt();
}

function currentHandoutSubject() {
  return filenameCourseData[$("handoutSubject").value] || { books: {} };
}

function currentHandoutBook() {
  return currentHandoutSubject().books?.[$("handoutBook").value] || {};
}

function currentHandoutChapter() {
  return currentHandoutBook()[$("handoutChapter").value] || {};
}

function currentHandoutSection() {
  return currentHandoutChapter()[$("handoutSection").value] || [];
}

function toggleHandoutTopic(topic, button) {
  if (handoutSelectedTopics.has(topic)) {
    handoutSelectedTopics.delete(topic);
    button.classList.remove("selected");
  } else {
    handoutSelectedTopics.add(topic);
    button.classList.add("selected");
  }
  $("handoutTopicCount").textContent = handoutSelectedTopics.size;
  buildHandoutPrompt();
}

function handoutAudienceLabel(value) {
  return {
    student: "學生版",
    teacher: "教師版",
    both: "學生版與教師版各一份"
  }[value] || value;
}

function handoutStyleLabel(value) {
  return {
    softGray: "灰階章節分隔版",
    modulePack: "灰階講義模組包",
    freshBlue: "清爽青藍細線版",
    referenceBlack: "黑白參考書分隔線版",
    referenceFormula: "黑白參考書＋LaTeX公式版"
  }[value] || value;
}

function handoutStyleInstructions(value) {
  const instructions = {
    softGray: [
      `套用灰階章節分隔版。`,
      `章節使用左側符號、章節標題與右側水平線的分隔方式。`,
      `整體以淡灰、黑灰、低對比為主，適合一般上課講義與黑白列印。`
    ],
    modulePack: [
      `套用灰階講義模組包樣式。`,
      `已勾選的內容請用可複製模組呈現；不新增未勾選的範例、演練或解析。`,
      `模組標題、題號、作答空間與解析區塊需固定格式，方便之後複製延伸。`
    ],
    freshBlue: [
      `套用清爽青藍細線版。`,
      `使用小色標、章節編號、細水平線與淺底提示框，不使用大面積粗色條。`,
      `版面保留大量白底與清楚留白，適合短講義、重點複習、題型整理與測驗卷前導講義。`
    ],
    referenceBlack: [
      `套用黑白參考書分隔線版，正式講義不可出現樣式名稱、適用情境、視覺語言等版型說明表。`,
      `頁面以黑白為主，章節標題下方使用細水平線，靠編號、粗體關鍵詞、表格與短提示框建立閱讀層次。`,
      `採加厚內容密度，避免一頁只有少量文字；已勾選模組可加入觀念脈絡、判讀流程、考點深化、常見錯誤與延伸比較。`,
      `頁尾使用「第 X 頁（共 Y 頁）」格式；公式整理表使用深灰表頭、淺灰首欄與細框線。`
    ],
    referenceFormula: [
      `套用黑白參考書＋LaTeX公式版，正式講義不可出現樣式名稱、適用情境、視覺語言等版型說明表。`,
      `頁面以黑白參考書分隔線版為基礎，章節標題下方使用細水平線，靠編號、粗體關鍵詞、表格與短提示框建立閱讀層次。`,
      `採加厚內容密度，避免一頁只有少量文字；已勾選模組可加入觀念脈絡、判讀流程、考點深化、常見錯誤與延伸比較。`,
      `頁尾使用「第 X 頁（共 Y 頁）」格式；公式整理表使用深灰表頭、淺灰首欄與細框線。`,
      `正式 PDF 不能出現 sqrt(...)、v_esc、1/2 mv^2、(GM/r)^(1/2) 這類純文字公式；核心公式需正常呈現分式、根號、上下標、希臘字母、近似符號與比例符號。`,
      `若 Word 原生公式轉 PDF 會跑版，請使用 D:\\Workspace\\Codex\\Projects\\製作題目\\render_latex_formula.js，先將 LaTeX 公式渲染成圖片，再嵌入 Word。`,
      `公式圖片需白底或透明底、黑色字、解析度清楚；插入後不得模糊、裁切、壓縮變形或超出欄寬。`,
      `正文公式頁、公式整理表、範例解法頁、答案解析頁都要處理；表格中的公式欄也必須用 LaTeX 渲染或同等品質公式圖。`,
      `大型公式不要把兩個以上擠在同一行；分式、根號、上下標並列時，拆成上下獨立公式行。`,
      `每次修公式後，需重新轉 PDF 並檢查相關頁面 PNG，至少檢查正文公式頁、公式整理表、範例解法頁、答案解析頁。`
    ]
  };
  return instructions[value] || instructions.softGray;
}

function handoutQuestionSourceLabel(value) {
  return {
    mixed: "題庫＋自創混合",
    bank: "優先從題庫提取",
    original: "自創題目"
  }[value] || value;
}

function handoutSpec() {
  const title = $("handoutTitleInput").value.trim() || `${$("handoutChapter").value}：${$("handoutSection").value}`;
  const scopeItems = productionScopeItemsForPrompt();
  return {
    grade: [...new Set(scopeItems.map(item => item.grade))].join("、"),
    subject: [...new Set(scopeItems.map(item => item.subject))].join("、"),
    book: $("handoutBook").value,
    chapter: $("handoutChapter").value,
    section: $("handoutSection").value,
    title,
    audience: $("handoutAudience").value,
    style: $("handoutStyle").value,
    typography: $("handoutTypography").value,
    typographyLabel: TYPOGRAPHY_LABELS[$("handoutTypography").value] || $("handoutTypography").value,
    topics: Array.from(handoutSelectedTopics),
    scopeItems,
    include: {
      toc: $("handoutIncludeToc").checked,
      concepts: $("handoutIncludeConcepts").checked,
      examples: $("handoutIncludeExamples").checked,
      practice: $("handoutIncludePractice").checked,
      answers: $("handoutIncludeAnswers").checked,
      teacherNotes: $("handoutIncludeTeacherNotes").checked
    },
    exampleCount: Number($("handoutExampleCount").value || 0),
    practiceCount: Number($("handoutPracticeCount").value || 0),
    questionCounts: {
      calculation: Number($("handoutCalculationCount").value || 0),
      concept: Number($("handoutConceptQuestionCount").value || 0),
      thinking: Number($("handoutThinkingQuestionCount").value || 0)
    },
    questionSource: $("handoutQuestionSource").value,
    questionCandidateCount: Number($("handoutQuestionCandidateCount").value || 0),
    notes: $("handoutNotes").value.trim()
  };
}

function setSelectToOption(selectId, preferred, fallbackIncludes = []) {
  const select = $(selectId);
  const options = [...select.options];
  const exact = options.find(option => option.value === preferred || option.textContent === preferred);
  const fuzzy = exact || options.find(option => fallbackIncludes.every(part => option.value.includes(part) || option.textContent.includes(part)));
  if (fuzzy) select.value = fuzzy.value;
  return Boolean(fuzzy);
}

function renderHandoutExamples() {
  const container = $("handoutExampleChips");
  if (!container) return;
  if (!handoutExamples.length) {
    container.innerHTML = `<span class="empty-inline">尚無講義範例，可先選好設定後新增。</span>`;
    return;
  }
  container.innerHTML = handoutExamples.map(example => `
    <span class="template-chip handout-example-chip">
      <button class="chip" type="button" data-apply-handout-example="${escapeHtml(example.id)}">${escapeHtml(example.name || "未命名範例")}</button>
      <button class="chip-delete" type="button" data-delete-handout-example="${escapeHtml(example.id)}" title="刪除範例">×</button>
    </span>
  `).join("");
}

function saveHandoutExamples() {
  writeJson(STORAGE.handoutExamples, handoutExamples);
  renderHandoutExamples();
}

function applyHandoutExample(exampleId) {
  const example = handoutExamples.find(item => item.id === exampleId);
  if (!example) return;

  $("handoutGrade").value = example.grade || "高一";
  renderHandoutSubjects();
  setSelectToOption("handoutSubject", example.subject || "", [example.subject || ""]);
  renderHandoutBooks();
  setSelectToOption("handoutBook", example.book || "", []);
  renderHandoutChapters();
  setSelectToOption("handoutChapter", example.chapter || "", []);
  renderHandoutSections();
  setSelectToOption("handoutSection", example.section || "", []);
  renderHandoutTopics();

  $("handoutTitleInput").value = example.title || "";
  $("handoutAudience").value = example.audience || "both";
  $("handoutStyle").value = example.style || "softGray";
  $("handoutTypography").value = example.typography || "kai12";
  $("handoutExampleCount").value = example.exampleCount ?? 2;
  $("handoutPracticeCount").value = example.practiceCount ?? 4;
  $("handoutCalculationCount").value = example.questionCounts?.calculation ?? 5;
  $("handoutConceptQuestionCount").value = example.questionCounts?.concept ?? 5;
  $("handoutThinkingQuestionCount").value = example.questionCounts?.thinking ?? 5;
  $("handoutQuestionSource").value = example.questionSource || "mixed";
  $("handoutQuestionCandidateCount").value = example.questionCandidateCount ?? 30;
  $("handoutIncludeToc").checked = example.include?.toc ?? true;
  $("handoutIncludeConcepts").checked = example.include?.concepts ?? true;
  $("handoutIncludeExamples").checked = example.include?.examples ?? true;
  $("handoutIncludePractice").checked = example.include?.practice ?? true;
  $("handoutIncludeAnswers").checked = example.include?.answers ?? true;
  $("handoutIncludeTeacherNotes").checked = example.include?.teacherNotes ?? false;
  $("handoutNotes").value = example.notes || "";

  handoutSelectedTopics.clear();
  (example.topics || []).forEach(topic => handoutSelectedTopics.add(topic));
  document.querySelectorAll("[data-handout-topic]").forEach(button => {
    button.classList.toggle("selected", handoutSelectedTopics.has(button.dataset.handoutTopic));
  });
  $("handoutTopicCount").textContent = handoutSelectedTopics.size;
  buildHandoutPrompt();
  toast(`已套用${example.name || "講義範例"}`);
}

function addCurrentHandoutExample() {
  const spec = handoutSpec();
  const name = spec.title || `${spec.grade}${spec.subject}${spec.section}` || "講義範例";
  const example = {
    ...spec,
    id: `${Date.now()}`,
    name: name.length > 24 ? `${name.slice(0, 24)}...` : name
  };
  handoutExamples.unshift(example);
  saveHandoutExamples();
  toast("已新增講義範例");
}

function deleteHandoutExample(exampleId) {
  handoutExamples = handoutExamples.filter(item => item.id !== exampleId);
  saveHandoutExamples();
  toast("已刪除講義範例");
}

function buildHandoutPrompt() {
  if (!$("handoutPromptOutput")) return;
  const spec = handoutSpec();
  const error = handoutValidationError(spec);
  if (error) { $("handoutPromptOutput").value = error; return false; }
  const solution = spec.include.answers ? "並附詳解" : "不附答案或詳解";
  const sections = [];
  if (spec.include.concepts) sections.push(
    "定義：提供精確嚴謹的學術定義。",
    "說明：深入詳盡闡述，包含歷史脈絡、內容詳解、應用時機與技巧、延伸與比較，必要時使用表格。",
    "定理：列出相關重要定理、適用範圍與限制。",
    "公式：列出相關公式，並解釋每個符號的意義、單位和使用注意事項。"
  );
  if (spec.include.examples) sections.push(`${spec.include.answers ? "範例與解法" : "範例（不含解法）"}：${spec.exampleCount} 題。`);
  if (spec.include.practice) sections.push(
    `隨堂演練：${spec.practiceCount} 題，${solution}。`,
    `科學素養計算題：${spec.questionCounts.calculation} 題，重點在觀念應用而非複雜計算，${solution}。`,
    `科學素養觀念理解題：${spec.questionCounts.concept} 題，可為選擇、是非或簡答，${solution}。`,
    `科學素養思考題：${spec.questionCounts.thinking} 題，採情境式或開放性問題，訓練邏輯推理與批判性思考，${solution}。`
  );
  if (spec.include.teacherNotes) sections.push("教師備註：教學節奏、學生盲點與提問建議，僅限教師版。 ");
  const bankRoutes = [...new Set(spec.scopeItems.map(item => questionBankSubjectName(item.grade, item.subject)))].join("、");
  const bankLevels = [...new Set(spec.scopeItems.map(item => inferQuestionLevelKey(item.grade)))].join("、");
  const topicText = usingProductionScopeCache()
    ? [...new Set(spec.scopeItems.flatMap(item => item.topics || []))].join("、") || "未指定，使用各範圍章節與節名"
    : spec.topics.length ? spec.topics.join("、") : "未指定，使用章節與節名";
  const rangeLines = productionScopePromptLines(spec.scopeItems);
  const rangeLabel = usingProductionScopeCache() ? `跨 ${spec.scopeItems.length} 個範圍` : `${spec.book} / ${spec.chapter} / ${spec.section}`;
  const bankKeyword = productionScopeKeywordParts(spec.scopeItems).join(" ");
  const questionSourceInstructions = {
    original: [
      `題目來源：自創題目。`,
      `請依照講義內容與考試趨勢自行設計題目，不需要串接本機題庫。`
    ],
    bank: [
      `題目來源：優先從題庫提取。`,
      `請用本機題庫先抓 ${spec.questionCandidateCount} 題候選題，依本講義範圍篩選、改寫並整理進講義題組。`,
      `若原題明確標記為會考題，可以直接使用原題。`,
      `若題庫題目不足，請明確標示不足處並用自創題補足。`
    ],
    mixed: [
      `題目來源：題庫＋自創混合。`,
      `請用本機題庫先抓 ${spec.questionCandidateCount} 題候選題作為考點、難度與題型參考；一般題庫題需改寫、重組或補充自創題，若原題明確標記為會考題，可以直接使用原題。`
    ]
  }[spec.questionSource] || [];
  const includeText = Object.entries({
    toc: "目錄",
    concepts: "定義、說明、定理、公式",
    examples: spec.include.answers ? "範例與解法" : "範例（不含解法）",
    practice: "科學素養題組",
    answers: "答案解析",
    teacherNotes: "教師備註"
  }).filter(([key]) => spec.include[key]).map(([, label]) => label).join("、") || "依內容判斷";
  const prompt = [
    `講義生成背景：`,
    HANDOUT_TEACHER_BACKGROUND,
    ``,
    `請依照同專案中已製作的 Word 講義範本，幫我生成「${spec.title}」上課講義。`,
    ``,
    `講義基本資料：`,
    `年級：${spec.grade}`,
    `科目：${spec.subject}`,
    `製作範圍：${rangeLabel}`,
    ...rangeLines,
    `知識點：${topicText}`,
    `版本：${handoutAudienceLabel(spec.audience)}`,
    `版型：${handoutStyleLabel(spec.style)}`,
    `題目來源：${handoutQuestionSourceLabel(spec.questionSource)}`,
    usingProductionScopeCache() ? `跨單元要求：請整合上列範圍製作成連貫講義，可依概念順序重新排序，但不可漏掉已選範圍。` : "",
    ``,
    `內容結構：`,
    `請包含：${includeText}`,
    `每個小節依本次勾選設定包含以下 ${sections.length} 個內容部分：`,
    ...sections.map((text, index) => `${index + 1}. ${text}`),
    spec.include.answers ? `答案解析：學生版不顯示演練答案與教師解析；教師版保留完整詳解，清楚區分學生可見內容與教師用內容。` : `未勾選答案模組：所有版本均不附作答答案、解題步驟或解析。`,
    ``,
    `題庫使用規則：`,
    ...questionSourceInstructions,
    spec.questionSource === "original" ? "" : `題庫搜尋關鍵字：${bankKeyword}`,
    spec.questionSource === "original" ? "" : `題庫 API subject：${bankRoutes}；依各範圍分別查詢，不可共用最後選取的科目。`,
    spec.questionSource === "original" ? "" : `level：${bankLevels}`,
    spec.questionSource === "original" ? "" : `請沿用 D:\\Workspace\\Codex\\Projects\\製作題目\\question_bank_client.py。`,
    spec.questionSource === "original" ? "" : `題庫 API：http://127.0.0.1:8787`,
    spec.questionSource === "original" ? "" : `不要直接讀 SQLite；大量抓完整題目時，先用 questions() 取得 ID，再用 questions_by_id() 批次取得完整題目。`,
    ``,
    `排版要求：`,
    ...handoutStyleInstructions(spec.style),
    `字體：${spec.typographyLabel}`,
    `Word 講義請以此字體設定為正文、題目、表格與解析的基準；標題、大標、小標可依階層加大，但需保持整份講義一致。`,
    `已勾選的內容請用可複製模組呈現，不要加入未勾選的內容。`,
    spec.include.toc ? `目錄請使用 Word 可更新的目錄欄位。` : `本次不包含目錄。`,
    ``,
    `補充文案或要求：`,
    spec.notes || "無；請依課程範圍自行整理成適合上課使用的講義。"
  ].join("\n");
  $("handoutPromptOutput").value = prompt;
  $("handoutSummary").textContent = `${spec.grade}${spec.subject} / ${usingProductionScopeCache() ? `跨 ${spec.scopeItems.length} 個範圍` : `${spec.book} / ${spec.chapter} ${spec.section}`} / ${handoutStyleLabel(spec.style)} / ${spec.typographyLabel} / ${handoutAudienceLabel(spec.audience)}`;
  renderProductionFinalSummary();
}

async function copyHandoutPrompt() {
  if (buildHandoutPrompt() === false) { toast($("handoutPromptOutput").value); return; }
  await navigator.clipboard.writeText($("handoutPromptOutput").value);
  toast("已複製講義指令");
}

function downloadHandoutSpec() {
  if (buildHandoutPrompt() === false) { toast($("handoutPromptOutput").value); return; }
  const spec = handoutSpec();
  const blob = new Blob([JSON.stringify({ ...spec, prompt: $("handoutPromptOutput").value }, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `講義需求_${cleanFilenamePart(spec.grade + spec.subject)}_${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderFilenameSubjects() {
  const subjects = sortSubjects(Object.keys(filenameCourseData));
  $("filenameSubject").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
  if (subjects.includes($("subject").value)) {
    $("filenameSubject").value = $("subject").value;
  }
  renderFilenameCourses();
}

function renderFilenameCourses() {
  const books = sortCourseBooks(Object.keys(currentFilenameSubject().books || {}), $("filenameSubject").value);
  $("filenameCourse").innerHTML = books.map(book => `<option>${escapeHtml(book)}</option>`).join("");
  renderFilenameChapters();
  syncFilenameCourseAlias();
}

function renderFilenameChapters() {
  const chapters = Object.keys(currentFilenameBook());
  $("filenameChapter").innerHTML = chapters.map(chapter => {
    const code = chapterCode(chapter);
    const label = code ? `${code} ${chapter}` : chapter;
    return `<option value="${escapeHtml(chapter)}">${escapeHtml(label)}</option>`;
  }).join("");
  syncFilenameUnit();
}

function currentFilenameSubject() {
  return filenameCourseData[$("filenameSubject").value] || { books: {} };
}

function currentFilenameBook() {
  return currentFilenameSubject().books?.[$("filenameCourse").value] || {};
}

function syncFilenameCourseAlias() {
  $("filenameCourseAlias").value = normalizeCourseName($("filenameCourse").value);
}

function syncFilenameUnit() {
  $("filenameUnit").value = unitNameFromChapter($("filenameChapter").value);
}

function updateFilenameFields() {
  const type = $("filenameType").value;
  document.querySelectorAll("[data-filename-fields]").forEach(group => {
    group.classList.toggle("hidden", group.dataset.filenameFields !== type);
  });
}

function buildFilename() {
  const type = $("filenameType").value;
  const ext = cleanExtension($("filenameExt").value);
  const base = type === "mock"
    ? buildMockFilename()
    : type === "term"
      ? buildTermFilename()
      : type === "other"
        ? buildOtherFilename()
        : buildHandoutFilename();
  return ext ? `${base}.${ext}` : base;
}

function buildHandoutFilename() {
  return [
    currentFilenameCourseName(),
    chapterCode($("filenameChapter").value),
    $("filenameUnit").value,
    normalizeSequencedName($("filenameDocName").value),
    $("filenameFormatSuffix").value,
    $("filenameAudience").value,
    $("filenameStatus").value
  ].map(cleanFilenamePart).filter(Boolean).join("_") || "未命名";
}

function buildMockFilename() {
  return [
    currentFilenameCourseName(),
    $("mockYear").value,
    $("mockExamType").value,
    $("mockName").value,
    "模擬考"
  ].map(cleanFilenamePart).filter(Boolean).join("_") || "未命名";
}

function buildTermFilename() {
  return [
    currentFilenameCourseName(),
    $("termSemester").value,
    $("termSchool").value,
    $("termGrade").value,
    $("termExam").value,
    "段考"
  ].map(cleanFilenamePart).filter(Boolean).join("_") || "未命名";
}

function buildOtherFilename() {
  const yymmdd = yymmddFromIso($("filenameDate").value || todayIso());
  return [
    yymmdd,
    $("otherTopic").value || currentFilenameCourseName(),
    $("otherContent").value,
    $("otherNote").value
  ].map(cleanFilenamePart).filter(Boolean).join("_") || yymmdd;
}

function updateFilenamePreview() {
  $("filenamePreview").textContent = buildFilename();
}

async function copyFilename() {
  const filename = buildFilename();
  await navigator.clipboard.writeText(filename);
  toast("已複製檔名");
}

function cleanFilenamePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replaceAll("_", "")
    .replace(/\s+/g, "");
}

function cleanExtension(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[^0-9A-Za-z]/g, "");
}

function normalizeCourseName(book) {
  const roman = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6" };
  return cleanFilenamePart(String(book ?? "")
    .replace(/\(\s*(VI|IV|V|III|II|I)\s*\)/gi, match => roman[match.replace(/[()\s]/g, "").toUpperCase()] || match)
    .replace(/[()（）]/g, ""));
}

function currentFilenameCourseName() {
  return $("filenameCourseAlias").value || normalizeCourseName($("filenameCourse").value);
}

function normalizeSequencedName(value) {
  return String(value ?? "").replace(/([^\d\s_]+)\s*([0-9]+)$/u, (_, label, number) => `${label}${number.padStart(2, "0")}`);
}

function chapterCode(chapter) {
  const value = String(chapter ?? "");
  const match = value.match(/第\s*([0-9一二三四五六七八九十]+)\s*[章課回]/) || value.match(/單元\s*([0-9一二三四五六七八九十]+)/) || value.match(/^([0-9]+)[-_ ]/);
  if (!match) return "";
  const number = parseChineseNumber(match[1]);
  return number ? `CH${String(number).padStart(2, "0")}` : "";
}

function unitNameFromChapter(chapter) {
  const value = String(chapter ?? "")
    .replace(/^第\s*[0-9一二三四五六七八九十]+\s*[章課回]\s*[_ ]*/, "")
    .replace(/^單元\s*[0-9一二三四五六七八九十]+\s*[_ ]*/, "")
    .trim();
  return cleanFilenamePart(value.split(/[－-]/)[0]);
}

function parseChineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (digits[tens] || 1) * 10 + (digits[ones] || 0);
  }
  return digits[value] || 0;
}

function yymmddFromIso(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll("[data-workspace-view]").forEach(panel => {
    const views = (panel.dataset.workspaceView || "").split(",");
    panel.classList.toggle("hidden-view", !views.includes(view));
  });
  document.querySelectorAll("[data-view-tab]").forEach(button => {
    const group = (button.dataset.viewGroup || button.dataset.viewTab || "").split(",");
    button.classList.toggle("active", group.includes(view));
  });
  updateProductionTaskVisibility();
  if (view === "data") renderCourseReviewCurrent();
}

function initCourseReview() {
  renderCourseReviewSubjects();
  renderCourseReviewBooks();
  renderCourseReviewCurrent();
}

function renderCourseReviewSubjects() {
  const subjects = sortSubjects(Object.keys(filenameCourseData));
  $("dataSubjectSelect").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
  if (subjects.includes($("subject").value)) {
    $("dataSubjectSelect").value = $("subject").value;
  }
}

function currentCourseReviewSubject() {
  return filenameCourseData[$("dataSubjectSelect").value] || { books: {} };
}

function renderCourseReviewBooks() {
  const books = sortCourseBooks(Object.keys(currentCourseReviewSubject().books || {}), $("dataSubjectSelect").value);
  $("dataBookSelect").innerHTML = books.map(book => `<option>${escapeHtml(book)}</option>`).join("");
}

function currentCourseReviewBook() {
  return currentCourseReviewSubject().books?.[$("dataBookSelect").value] || {};
}

function renderCourseReviewCurrent() {
  const subject = $("dataSubjectSelect").value;
  const book = $("dataBookSelect").value;
  const keyword = $("dataSearchInput").value.trim();
  $("dataCurrentPath").textContent = `${subject || "未選科目"} / ${book || "未選教材"}`;
  renderCourseReviewStats();
  renderCourseReviewIssues();
  renderCourseReviewOutline(keyword);
  renderCourseFixes();
}

function renderCourseReviewStats() {
  const bookNode = currentCourseReviewBook();
  const chapters = Object.keys(bookNode).length;
  let sections = 0;
  let topics = 0;
  Object.values(bookNode).forEach(sectionMap => {
    sections += Object.keys(sectionMap || {}).length;
    Object.values(sectionMap || {}).forEach(topicList => topics += (topicList || []).length);
  });
  $("dataStats").innerHTML = [
    ["章", chapters],
    ["節", sections],
    ["小重點", topics],
    ["教材數", Object.keys(currentCourseReviewSubject().books || {}).length]
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong>${label}</div>`).join("");
}

function findCourseReviewIssues() {
  const issues = [];
  const subject = $("dataSubjectSelect").value;
  const book = $("dataBookSelect").value;
  if (/第1冊|選修I|選修II|3B|4A|4B/.test(book)) {
    issues.push({ type: "冊名", path: [subject, book], text: `冊名格式可統一：${book}` });
  }
  Object.entries(currentCourseReviewBook()).forEach(([chapter, sections]) => {
    Object.entries(sections || {}).forEach(([section, topics]) => {
      if (chapter === section) {
        issues.push({ type: "層級", path: [subject, book, chapter, section], text: `章名與節名相同：${chapter}` });
      }
      (topics || []).forEach(topic => {
        if (section === topic) {
          issues.push({ type: "重複", path: [subject, book, chapter, section, topic], text: `節名與小重點相同：${section}` });
        }
        if (topic.length > 35) {
          issues.push({ type: "過長", path: [subject, book, chapter, section, topic], text: `小重點偏長：${topic}` });
        }
      });
    });
  });
  return issues;
}

function renderCourseReviewIssues() {
  const issues = findCourseReviewIssues();
  $("dataIssueCount").textContent = issues.length;
  if (!issues.length) {
    $("dataIssueList").innerHTML = `<div class="empty">這本教材目前沒有明顯提醒。</div>`;
    return;
  }
  $("dataIssueList").innerHTML = issues.slice(0, 80).map(issue => (
    `<div class="issue">
      <div><strong>${escapeHtml(issue.type)}</strong>：${escapeHtml(issue.text)}</div>
      <button class="secondary mini-btn" type="button" data-add-course-fix="${encodeURIComponent(JSON.stringify(issue.path))}" data-fix-type="${escapeHtml(issue.type)}" data-fix-note="${escapeHtml(issue.text)}">加入待修正</button>
    </div>`
  )).join("");
}

function qualitySubjectNames() {
  return sortSubjects(Object.keys(filenameCourseData));
}

function qualityCurrentSubject() {
  return $("dataSubjectSelect").value || qualitySubjectNames()[0] || "";
}

function suspiciousDataLabel(value, kind) {
  const text = String(value || "").trim();
  if (!text) return `${kind}空白`;
  if (/[<>:"\\|?*\x00-\x1F]/.test(text)) return `${kind}含檔名不建議符號`;
  if (text.length > (kind === "小重點" ? 35 : 48)) return `${kind}偏長`;
  if (/解答|教師手冊|備課|資源|習作|測驗卷|評量|附件|附錄|題庫|媒體|CD|DVD/i.test(text)) return `疑似非主要課程內容`;
  if (/^\d+$/.test(text)) return `${kind}只有數字`;
  return "";
}

function collectQualityIssuesForSubject(subject) {
  const issues = [];
  const subjectNode = filenameCourseData[subject] || { books: {} };
  Object.entries(subjectNode.books || {}).forEach(([book, chapters]) => {
    const bookReason = suspiciousDataLabel(book, "教材");
    if (bookReason) issues.push({ type: "教材", subject, path: [subject, book], reason: bookReason });
    const chapterEntries = Object.entries(chapters || {});
    if (!chapterEntries.length) {
      issues.push({ type: "教材", subject, path: [subject, book], reason: "教材沒有章節" });
    }
    chapterEntries.forEach(([chapter, sections]) => {
      const chapterReason = suspiciousDataLabel(chapter, "章");
      if (chapterReason) issues.push({ type: "章", subject, path: [subject, book, chapter], reason: chapterReason });
      const sectionEntries = Object.entries(sections || {});
      if (!sectionEntries.length) {
        issues.push({ type: "章", subject, path: [subject, book, chapter], reason: "章底下沒有節" });
      }
      sectionEntries.forEach(([section, topics]) => {
        const sectionReason = suspiciousDataLabel(section, "節");
        if (sectionReason) issues.push({ type: "節", subject, path: [subject, book, chapter, section], reason: sectionReason });
        if (chapter === section) {
          issues.push({ type: "層級", subject, path: [subject, book, chapter, section], reason: "章名與節名相同" });
        }
        if (!Array.isArray(topics) || !topics.length) {
          issues.push({ type: "節", subject, path: [subject, book, chapter, section], reason: "節底下沒有小重點" });
        }
        (topics || []).forEach(topic => {
          const topicReason = suspiciousDataLabel(topic, "小重點");
          if (topicReason) issues.push({ type: "小重點", subject, path: [subject, book, chapter, section, topic], reason: topicReason });
          if (section === topic) {
            issues.push({ type: "重複", subject, path: [subject, book, chapter, section, topic], reason: "節名與小重點相同" });
          }
        });
      });
    });
  });
  return issues;
}

function normalizedBookKey(book) {
  return String(book || "")
    .replace(/\(\s*\d{3}\s*學年\s*\)/g, "")
    .replace(/\(\s*(VI|IV|V|III|II|I)\s*\)/gi, match => match.replace(/[()\s]/g, "").toUpperCase())
    .replace(/[第冊（）()\s]/g, "")
    .replace(/[0-9]{3}學年/g, "")
    .toLowerCase();
}

function collectMergeReport() {
  const rows = [];
  qualitySubjectNames().forEach(subject => {
    const groups = new Map();
    Object.keys(filenameCourseData[subject]?.books || {}).forEach(book => {
      const key = normalizedBookKey(book);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(book);
    });
    groups.forEach((books, key) => {
      if (key && books.length > 1) {
        rows.push({
          type: "合併",
          subject,
          path: [subject, books[0]],
          reason: `疑似同教材不同版本：${books.slice(0, 4).join("、")}${books.length > 4 ? "..." : ""}`
        });
      }
    });
  });
  return rows;
}

function runQualityCurrent() {
  const subject = qualityCurrentSubject();
  renderQualityReport(`${subject}資料檢查`, collectQualityIssuesForSubject(subject), 1);
}

function runQualityAll() {
  const subjects = qualitySubjectNames();
  const issues = subjects.flatMap(subject => collectQualityIssuesForSubject(subject));
  renderQualityReport("全科資料檢查", issues, subjects.length);
}

function runQualityMerge() {
  const rows = collectMergeReport();
  renderQualityReport("合併摘要", rows, qualitySubjectNames().length);
}

function clearQualityResult() {
  $("qualityResult").innerHTML = "";
}

function renderQualityReport(title, issues, checkedSubjects) {
  const limited = issues.slice(0, 120);
  const hiddenCount = Math.max(0, issues.length - limited.length);
  const summary = `
    <div class="quality-summary">
      <div class="quality-stat"><strong>${checkedSubjects}</strong>科目</div>
      <div class="quality-stat"><strong>${issues.length}</strong>待確認</div>
      <div class="quality-stat"><strong>${hiddenCount}</strong>未顯示</div>
    </div>
  `;
  if (!issues.length) {
    $("qualityResult").innerHTML = `<div class="quality-item ok">${escapeHtml(title)}：沒有發現明顯問題。</div>${summary}`;
    return;
  }
  $("qualityResult").innerHTML = `
    <div class="quality-item"><strong>${escapeHtml(title)}</strong></div>
    ${summary}
    ${limited.map(item => `
      <div class="quality-item">
        <span class="quality-tag">${escapeHtml(item.type)}</span>
        <div class="quality-path">${escapeHtml(item.path.join(" / "))}</div>
        <div class="archive-meta">${escapeHtml(item.reason)}</div>
      </div>
    `).join("")}
    ${hiddenCount ? `<div class="archive-meta">另有 ${hiddenCount} 筆未顯示。</div>` : ""}
  `;
}

function courseReviewIncludesKeyword(chapter, section, topics, keyword) {
  if (!keyword) return true;
  const text = `${chapter} ${section} ${(topics || []).join(" ")}`.toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function markKeyword(value, keyword) {
  const text = escapeHtml(value);
  if (!keyword) return text;
  const escaped = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), match => `<span class="mark">${match}</span>`);
}

function renderCourseReviewOutline(keyword = "") {
  const subject = $("dataSubjectSelect").value;
  const book = $("dataBookSelect").value;
  const chapterHtml = Object.entries(currentCourseReviewBook()).map(([chapter, sections]) => {
    const matchedSections = Object.entries(sections || {}).filter(([section, topics]) => courseReviewIncludesKeyword(chapter, section, topics, keyword));
    if (!matchedSections.length) return "";
    const sectionHtml = matchedSections.map(([section, topics]) => {
      const sectionPath = [subject, book, chapter, section].filter(Boolean).join(" / ");
      return `
        <div class="section">
          <div class="section-title">
            <span>${markKeyword(section, keyword)}</span>
            <div class="section-actions">
              <button class="secondary mini-btn" type="button" data-use-progress-path="${escapeHtml(encodeURIComponent(sectionPath))}">進度</button>
              <button class="secondary mini-btn" type="button" data-add-course-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter, section]))}" data-fix-type="節" data-fix-note="檢查此節">標記</button>
            </div>
          </div>
          <div class="topics">
            ${(topics || []).map(topic => {
              const topicPath = `${sectionPath} / ${topic}`;
              return `
                <span class="topic">
                  ${markKeyword(topic, keyword)}
                  <button class="secondary" type="button" data-use-progress-path="${escapeHtml(encodeURIComponent(topicPath))}">進度</button>
                  <button class="secondary" type="button" data-add-course-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter, section, topic]))}" data-fix-type="小重點" data-fix-note="檢查此小重點">標記</button>
                </span>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
    return `
      <details class="chapter" ${courseReviewExpanded || keyword ? "open" : ""}>
        <summary>
          ${markKeyword(chapter, keyword)}　<small>${matchedSections.length} 節</small>
          <button class="secondary mini-btn" type="button" data-add-course-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter]))}" data-fix-type="章" data-fix-note="檢查此章">標記</button>
        </summary>
        ${sectionHtml}
      </details>
    `;
  }).join("");
  $("dataOutline").innerHTML = chapterHtml || `<div class="empty">沒有符合搜尋的章節。</div>`;
}

function addCourseFix(path, type, note = "") {
  const key = path.join(" / ");
  const existing = courseFixes.find(item => item.key === key);
  if (existing) {
    existing.type = type || existing.type;
    existing.note = note || existing.note;
  } else {
    courseFixes.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      path,
      type,
      note,
      createdAt: new Date().toISOString()
    });
  }
  writeJson(STORAGE.fixes, courseFixes);
  renderCourseFixes();
  toast("已加入待修正");
}

function renderCourseFixes() {
  $("dataFixCount").textContent = courseFixes.length;
  if (!courseFixes.length) {
    $("dataFixList").innerHTML = `<div class="empty">尚未標記任何項目。</div>`;
    return;
  }
  $("dataFixList").innerHTML = courseFixes.map(item => `
    <div class="fix-item">
      <div class="fix-row">
        <strong>${escapeHtml(item.type || "待修正")}</strong>
        <button class="secondary danger-text mini-btn" type="button" data-remove-course-fix="${item.id}">移除</button>
      </div>
      <div class="fix-path">${escapeHtml(item.key)}</div>
      <input class="fix-note" data-course-fix-note-id="${item.id}" value="${escapeHtml(item.note || "")}" placeholder="修正備註">
    </div>
  `).join("");
}

function removeCourseFix(id) {
  courseFixes = courseFixes.filter(item => item.id !== id);
  writeJson(STORAGE.fixes, courseFixes);
  renderCourseFixes();
}

function updateCourseFixNote(id, note) {
  courseFixes = courseFixes.map(item => item.id === id ? { ...item, note } : item);
  writeJson(STORAGE.fixes, courseFixes);
}

function clearCourseFixes() {
  if (!courseFixes.length) return;
  if (!confirm("確定清空待修正清單嗎？")) return;
  courseFixes = [];
  writeJson(STORAGE.fixes, courseFixes);
  renderCourseFixes();
}

function copyCourseReviewPath() {
  const text = `${$("dataSubjectSelect").value} / ${$("dataBookSelect").value}`;
  navigator.clipboard.writeText(text);
  toast("已複製目前路徑");
}

async function copyOfflinePath(text) {
  await navigator.clipboard.writeText(text);
  toast("已複製啟動檔路徑");
}

function openOfflineUrl(url) {
  window.open(url, "_blank", "noopener");
}

function exportCourseReviewSubjectCsv() {
  const subject = $("dataSubjectSelect").value;
  const rows = [["科目", "冊別/教材", "章", "節", "小重點"]];
  Object.entries(currentCourseReviewSubject().books || {}).forEach(([book, chapters]) => {
    Object.entries(chapters || {}).forEach(([chapter, sections]) => {
      Object.entries(sections || {}).forEach(([section, topics]) => {
        (topics || []).forEach(topic => rows.push([subject, book, chapter, section, topic]));
      });
    });
  });
  downloadCsv(`${subject}_課程資料.csv`, rows);
}

function exportCourseFixesCsv() {
  if (!courseFixes.length) {
    toast("目前沒有待修正項目");
    return;
  }
  const rows = [["類型", "科目", "冊別/教材", "章", "節", "小重點", "備註", "建立時間"]];
  courseFixes.forEach(item => {
    rows.push([
      item.type || "",
      item.path[0] || "",
      item.path[1] || "",
      item.path[2] || "",
      item.path[3] || "",
      item.path[4] || "",
      item.note || "",
      item.createdAt || ""
    ]);
  });
  downloadCsv("課程資料待修正清單.csv", rows);
}

function useCourseReviewPath(pathText) {
  lineAppend("progress", pathText);
  switchView("progress");
  toast("已加入今日進度");
}

function syncCourseReviewToTools() {
  const subject = $("dataSubjectSelect").value;
  const book = $("dataBookSelect").value;
  if (filenameCourseData[subject]) {
    $("progressSubject").value = subject;
    $("filenameSubject").value = subject;
    $("questionSubject").value = subject;
    $("handoutSubject").value = subject;
    renderProgressBooks();
    renderFilenameCourses();
    renderQuestionBooks();
    renderHandoutBooks();
  }
  if (book) {
    if ([...$("progressBook").options].some(option => option.value === book)) {
      $("progressBook").value = book;
      renderProgressChapters();
    }
    if ([...$("filenameCourse").options].some(option => option.value === book)) {
      $("filenameCourse").value = book;
      renderFilenameChapters();
      syncFilenameCourseAlias();
      updateFilenamePreview();
    }
    if ([...$("questionBook").options].some(option => option.value === book)) {
      $("questionBook").value = book;
      renderQuestionChapters();
      buildQuestionPrompt();
    }
    if ([...$("handoutBook").options].some(option => option.value === book)) {
      $("handoutBook").value = book;
      renderHandoutChapters();
      buildHandoutPrompt();
    }
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindEvents() {
  document.querySelectorAll("[data-view-tab]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.viewTab));
  });
  $("generateBtn").addEventListener("click", generate);
  $("copyBtn").addEventListener("click", copyCurrent);
  $("saveImageBtn").addEventListener("click", saveOutputImage);
  $("imageSize").addEventListener("change", updatePreviewSizeClass);
  $("saveLogBtn").addEventListener("click", saveLog);
  $("saveTemplateBtn").addEventListener("click", saveTemplate);
  $("clearTemplateBtn").addEventListener("click", clearTemplates);
  $("clearBtn").addEventListener("click", clearForm);
  $("quickYesterdayBtn").addEventListener("click", quickYesterday);
  $("quickTodayBtn").addEventListener("click", quickToday);
  $("exportBtn").addEventListener("click", exportBackup);
  $("search").addEventListener("input", renderArchives);
  $("clearArchiveSearchBtn").addEventListener("click", clearArchiveSearch);
  $("filterSubject").addEventListener("change", renderArchives);
  $("filterClass").addEventListener("change", renderArchives);
  $("archiveGroupBy").addEventListener("change", renderArchives);
  $("favoriteOnly").addEventListener("change", renderArchives);
  $("historyPicker").addEventListener("change", event => event.target.value && loadLog(event.target.value));
  $("progressSubject").addEventListener("change", () => {
    renderProgressBooks();
    searchProgressOptions();
  });
  $("progressBook").addEventListener("change", renderProgressChapters);
  $("progressChapter").addEventListener("change", renderProgressSections);
  $("progressSection").addEventListener("change", renderProgressTopics);
  $("addProgressPathBtn").addEventListener("click", addCurrentProgressPath);
  $("cacheProgressPathBtn").addEventListener("click", addCurrentProgressToCache);
  $("applyProgressCacheBtn").addEventListener("click", applyProgressCacheToProgress);
  $("clearProgressCacheBtn").addEventListener("click", () => clearProgressCache(true));
  $("progressSearch").addEventListener("input", searchProgressOptions);
  $("clearProgressSearchBtn").addEventListener("click", clearProgressSearch);
  $("addHomeworkPhraseBtn").addEventListener("click", addHomeworkPhrase);
  $("sharedGrade").addEventListener("change", renderSharedSubjects);
  $("sharedSubject").addEventListener("change", renderSharedBooks);
  $("sharedBook").addEventListener("change", renderSharedChapters);
  $("sharedChapter").addEventListener("change", renderSharedSections);
  $("sharedSection").addEventListener("change", renderSharedTopics);
  $("sharedKeyword").addEventListener("input", syncSharedScopeToTools);
  $("addProductionScopeBtn").addEventListener("click", addCurrentProductionScope);
  $("clearProductionScopeBtn").addEventListener("click", () => clearProductionScopeCache(true));
  $("buildBatchOutputBtn").addEventListener("click", buildBatchOutput);
  $("copyBatchOutputBtn").addEventListener("click", copyBatchOutput);
  $("downloadWorkCardBtn").addEventListener("click", downloadWorkCardMarkdown);
  document.querySelectorAll("[data-production-mode]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      applyProductionMode(button.dataset.productionMode);
    });
  });
  [
    "batchOutputFilename", "batchOutputQuestion", "batchOutputHandout", "batchOutputWorkCard", "batchOutputLearningAid",
    "learningAidMap", "learningAidPreview", "learningAidVisual", "learningAidParent", "learningAidReadme",
    "learningAidMapStyle", "learningAidPreviewStyle", "learningAidVisualStyle", "learningAidParentStyle",
    "learningAidMapUse", "learningAidPreviewUse", "learningAidVisualUse", "learningAidParentUse"
  ].forEach(id => {
    const outputToggle = $(id);
    if (!outputToggle) return;
    outputToggle.addEventListener("change", () => {
      updateProductionTaskVisibility();
      $("batchOutputText").value = "";
      $("batchOutputText").classList.add("collapsed");
      $("batchOutputPreview").classList.add("muted");
      $("batchOutputPreview").textContent = "尚未產生結果。";
      renderProductionFinalSummary();
    });
  });
  $("filenameType").addEventListener("change", () => {
    updateFilenameFields();
    updateFilenamePreview();
  });
  $("filenameSubject").addEventListener("change", () => {
    renderFilenameCourses();
    updateFilenamePreview();
  });
  $("filenameCourse").addEventListener("change", () => {
    renderFilenameChapters();
    syncFilenameCourseAlias();
    updateFilenamePreview();
  });
  $("filenameChapter").addEventListener("change", () => {
    syncFilenameUnit();
    updateFilenamePreview();
  });
  $("copyFilenameBtn").addEventListener("click", copyFilename);
  $("questionGrade").addEventListener("change", () => {
    renderQuestionSubjects();
    buildQuestionPrompt();
  });
  $("questionSubject").addEventListener("change", () => {
    renderQuestionBooks();
    buildQuestionPrompt();
  });
  $("questionBook").addEventListener("change", () => {
    renderQuestionChapters();
    buildQuestionPrompt();
  });
  $("questionChapter").addEventListener("change", () => {
    renderQuestionSections();
    buildQuestionPrompt();
  });
  $("questionSection").addEventListener("change", () => {
    renderQuestionTopics();
    buildQuestionPrompt();
  });
  [
    "questionOutput", "questionGenerationMode", "questionUseCase", "questionKeyword", "questionCandidateCount", "questionTotalCount", "questionType",
    "questionBasicCount", "questionMiddleCount", "questionChallengeCount",
    "questionStyle", "questionLayout", "questionTypography", "questionNotes"
  ].forEach(id => {
    $(id).addEventListener("input", buildQuestionPrompt);
    $(id).addEventListener("change", buildQuestionPrompt);
  });
  document.querySelectorAll("[data-question-mode]").forEach(button => {
    button.addEventListener("click", () => {
      $("questionGenerationMode").value = button.dataset.questionMode;
      buildQuestionPrompt();
    });
  });
  $("makeQuestionsBtn").addEventListener("click", makeQuestions);
  $("buildQuestionPromptBtn").addEventListener("click", buildQuestionPrompt);
  $("copyQuestionPromptBtn").addEventListener("click", copyQuestionPrompt);
  $("downloadQuestionSpecBtn").addEventListener("click", downloadQuestionSpec);
  $("handoutGrade").addEventListener("change", () => {
    renderHandoutSubjects();
    buildHandoutPrompt();
  });
  $("handoutSubject").addEventListener("change", () => {
    renderHandoutBooks();
    buildHandoutPrompt();
  });
  $("handoutBook").addEventListener("change", () => {
    renderHandoutChapters();
    buildHandoutPrompt();
  });
  $("handoutChapter").addEventListener("change", () => {
    renderHandoutSections();
    buildHandoutPrompt();
  });
  $("handoutSection").addEventListener("change", () => {
    renderHandoutTopics();
    buildHandoutPrompt();
  });
  [
    "handoutAudience", "handoutTitleInput", "handoutExampleCount", "handoutPracticeCount",
    "handoutCalculationCount", "handoutConceptQuestionCount", "handoutThinkingQuestionCount",
    "handoutQuestionSource", "handoutQuestionCandidateCount",
    "handoutStyle", "handoutTypography", "handoutIncludeToc", "handoutIncludeConcepts", "handoutIncludeExamples",
    "handoutIncludePractice", "handoutIncludeAnswers", "handoutIncludeTeacherNotes", "handoutNotes"
  ].forEach(id => {
    $(id).addEventListener("input", buildHandoutPrompt);
    $(id).addEventListener("change", buildHandoutPrompt);
  });
  $("buildHandoutPromptBtn").addEventListener("click", buildHandoutPrompt);
  $("copyHandoutPromptBtn").addEventListener("click", copyHandoutPrompt);
  $("downloadHandoutSpecBtn").addEventListener("click", downloadHandoutSpec);
  $("saveHandoutExampleBtn").addEventListener("click", addCurrentHandoutExample);
  $("dataSubjectSelect").addEventListener("change", () => {
    renderCourseReviewBooks();
    renderCourseReviewCurrent();
    syncCourseReviewToTools();
  });
  $("dataBookSelect").addEventListener("change", () => {
    renderCourseReviewCurrent();
    syncCourseReviewToTools();
  });
  $("dataSearchInput").addEventListener("input", renderCourseReviewCurrent);
  $("dataClearSearchBtn").addEventListener("click", clearDataSearch);
  $("dataShowAllBtn").addEventListener("click", () => {
    courseReviewExpanded = true;
    renderCourseReviewCurrent();
  });
  $("dataCollapseBtn").addEventListener("click", () => {
    courseReviewExpanded = false;
    renderCourseReviewCurrent();
  });
  $("dataCopyPathBtn").addEventListener("click", copyCourseReviewPath);
  $("dataExportSubjectBtn").addEventListener("click", exportCourseReviewSubjectCsv);
  $("dataExportFixesBtn").addEventListener("click", exportCourseFixesCsv);
  $("dataClearFixesBtn").addEventListener("click", clearCourseFixes);
  $("qualityCurrentBtn").addEventListener("click", runQualityCurrent);
  $("qualityAllBtn").addEventListener("click", runQualityAll);
  $("qualityMergeBtn").addEventListener("click", runQualityMerge);
  $("qualityClearBtn").addEventListener("click", clearQualityResult);

  document.body.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const productionModeButton = target.closest("[data-production-mode]");
    const productionPresetButton = target.closest("[data-production-preset]");
    if (target.dataset.progress) lineAppend("progress", target.dataset.progress);
    if (target.dataset.progressTopic) lineAppend("progress", decodeURIComponent(target.dataset.progressTopic));
    if (target.dataset.progressSearch) lineAppend("progress", decodeURIComponent(target.dataset.progressSearch));
    if (target.dataset.cacheProgressTopic) addProgressCacheItem(decodeURIComponent(target.dataset.cacheProgressTopic));
    if (target.dataset.cacheProgressSearch) addProgressCacheItem(decodeURIComponent(target.dataset.cacheProgressSearch));
    if (productionModeButton) applyProductionMode(productionModeButton.dataset.productionMode);
    if (productionPresetButton) applyProductionPreset(productionPresetButton.dataset.productionPreset);
    if (target.dataset.homework) phraseAppend("homework", target.dataset.homework);
    if (target.dataset.quiz) phraseAppend("quiz", target.dataset.quiz);
    if (target.dataset.sharedTopic) toggleSharedTopic(target.dataset.sharedTopic, target);
    if (target.dataset.questionTopic) toggleQuestionTopic(target.dataset.questionTopic, target);
    if (target.dataset.handoutTopic) toggleHandoutTopic(target.dataset.handoutTopic, target);
    if (target.dataset.applyHandoutExample) applyHandoutExample(target.dataset.applyHandoutExample);
    if (target.dataset.deleteHandoutExample && confirm("確定刪除這個講義範例嗎？")) deleteHandoutExample(target.dataset.deleteHandoutExample);
    if (target.dataset.template) applyTemplate(target.dataset.template);
    if (target.dataset.deleteTemplate && confirm("確定刪除這個班級模板嗎？")) deleteTemplate(target.dataset.deleteTemplate);
    if (target.dataset.removeProgressCache) removeProgressCacheItem(target.dataset.removeProgressCache);
    if (target.dataset.toggleProductionScope) toggleProductionScopeItem(target.dataset.toggleProductionScope, target.checked);
    if (target.dataset.removeProductionScope) removeProductionScopeItem(target.dataset.removeProductionScope);
    if (target.dataset.moveProductionScope) moveProductionScopeItem(target.dataset.moveProductionScope, Number(target.dataset.scopeDirection || 0));
    if (target.dataset.deleteHomeworkPhrase && confirm("確定刪除這個作業片語嗎？")) deleteHomeworkPhrase(target.dataset.deleteHomeworkPhrase);
    if (target.dataset.load) loadLog(target.dataset.load);
    if (target.dataset.copy) copyLog(target.dataset.copy);
    if (target.dataset.favoriteLog) toggleLogFavorite(target.dataset.favoriteLog);
    if (target.dataset.downloadLog) downloadLogText(target.dataset.downloadLog);
    if (target.dataset.delete && confirm("確定刪除這筆存檔嗎？")) deleteLog(target.dataset.delete);
    if (target.dataset.addCourseFix) {
      event.preventDefault();
      event.stopPropagation();
      addCourseFix(
        JSON.parse(decodeURIComponent(target.dataset.addCourseFix)),
        target.dataset.fixType || "待修正",
        target.dataset.fixNote || ""
      );
    }
    if (target.dataset.removeCourseFix) removeCourseFix(target.dataset.removeCourseFix);
    if (target.dataset.useProgressPath) useCourseReviewPath(decodeURIComponent(target.dataset.useProgressPath));
    if (target.dataset.copyOffline) copyOfflinePath(target.dataset.copyOffline);
    if (target.dataset.openOffline) openOfflineUrl(target.dataset.openOffline);
  });

  document.body.addEventListener("input", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.courseFixNoteId) updateCourseFixNote(target.dataset.courseFixNoteId, target.value);
    if (target.dataset.productionScopeCount) updateProductionScopeQuestionCount(target.dataset.productionScopeCount, target.value);
  });

  ["grade", "subject", "classType", "className", "date", "progress", "pages", "quiz", "homework", "outputMode"]
    .forEach(id => {
      $(id).addEventListener("input", saveDraft);
      $(id).addEventListener("change", saveDraft);
    });

  $("subject").addEventListener("change", () => {
    if (filenameCourseData[$("subject").value]) {
      $("progressSubject").value = $("subject").value;
      renderProgressBooks();
      $("questionSubject").value = $("subject").value;
      renderQuestionBooks();
      $("handoutSubject").value = $("subject").value;
      renderHandoutBooks();
      if ($("sharedSubject")) {
        $("sharedSubject").value = $("subject").value;
        renderSharedBooks();
      }
      $("dataSubjectSelect").value = $("subject").value;
      renderCourseReviewBooks();
      renderCourseReviewCurrent();
    }
  });

  $("grade").addEventListener("change", () => {
    renderProgressSubjects();
    $("questionGrade").value = $("grade").value;
    renderQuestionSubjects();
    $("handoutGrade").value = $("grade").value;
    renderHandoutSubjects();
    if ($("sharedGrade")) {
      $("sharedGrade").value = $("grade").value;
      renderSharedSubjects();
    }
    saveDraft();
  });

  [
    "filenameExt", "filenameDate", "filenameUnit", "filenameDocName", "filenameFormatSuffix", "filenameAudience", "filenameStatus",
    "filenameCourseAlias", "mockYear", "mockExamType", "mockName", "termSemester", "termSchool",
    "termGrade", "termExam", "otherTopic", "otherContent", "otherNote"
  ].forEach(id => {
    $(id).addEventListener("input", updateFilenamePreview);
    $(id).addEventListener("change", updateFilenamePreview);
  });
}

renderLearningAidStyleOptions();
syncProductionModeButtons(productionMode);
for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, event => {
    if (event.target.closest('[data-workspace-view="production"]') && event.target.id !== "batchOutputText") invalidateBatchOutput();
  });
}
restoreDraft();
bindEvents();
updatePreviewSizeClass();
renderTemplates();
renderProgressCache();
renderProductionScopeCache();
renderHomeworkPhrases();
renderHandoutExamples();
renderArchives();
renderHistoryPicker();
initFilenameTool();
