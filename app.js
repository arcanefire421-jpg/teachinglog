const STORAGE = {
  templates: "teachinglog.v08.templates",
  logs: "teachinglog.v08.logs",
  draft: "teachinglog.v08.draft",
  fixes: "teachinglog.courseFixes.v1",
  progressCache: "teachinglog.v09.progressCache",
  homeworkPhrases: "teachinglog.v09.homeworkPhrases"
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
let homeworkPhrases = readJson(STORAGE.homeworkPhrases, ["完成講義", "訂正錯題", "複習今日進度", "預習下次範圍"]);

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
  const progress = data.progress || "未填寫";
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

function previewItem(label, value, tone, fallback = "未填寫") {
  const hasValue = String(value || "").trim();
  return `
    <section class="preview-item ${tone}">
      <div class="preview-item-label">${escapeHtml(label)}</div>
      <div class="preview-item-body">${renderListText(hasValue ? value : fallback, fallback)}</div>
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
        ${previewItem("今日進度", data.progress, "tone-progress")}
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
  const subjects = Array.from(new Set(logs.map(item => item.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant"));
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

function quickTomorrow() {
  $("date").value = todayIso(1);
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
    initCourseReview();
  } catch {
    $("filenamePreview").textContent = "課程資料載入失敗，仍可手動輸入其他類型檔名。";
    $("topicChoices").textContent = "課程資料載入失敗，仍可手動輸入今日進度。";
    $("dataOutline").innerHTML = `<div class="empty">課程資料載入失敗，請確認 course-data.json 是否存在。</div>`;
  }
  updateFilenameFields();
  updateFilenamePreview();
}

function renderProgressSubjects() {
  const subjects = Object.keys(filenameCourseData);
  $("progressSubject").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
  if (subjects.includes($("subject").value)) {
    $("progressSubject").value = $("subject").value;
  }
  renderProgressBooks();
}

function renderProgressBooks() {
  const books = Object.keys(currentProgressSubject().books || {});
  $("progressBook").innerHTML = books.map(book => `<option>${escapeHtml(book)}</option>`).join("");
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

function renderFilenameSubjects() {
  const subjects = Object.keys(filenameCourseData);
  $("filenameSubject").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
  if (subjects.includes($("subject").value)) {
    $("filenameSubject").value = $("subject").value;
  }
  renderFilenameCourses();
}

function renderFilenameCourses() {
  const books = Object.keys(currentFilenameSubject().books || {});
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
    panel.classList.toggle("hidden-view", panel.dataset.workspaceView !== view);
  });
  document.querySelectorAll("[data-view-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.viewTab === view);
  });
  $("quickTodayBtn").style.display = view === "progress" ? "" : "none";
  if (view === "data") renderCourseReviewCurrent();
}

function initCourseReview() {
  renderCourseReviewSubjects();
  renderCourseReviewBooks();
  renderCourseReviewCurrent();
}

function renderCourseReviewSubjects() {
  const subjects = Object.keys(filenameCourseData);
  $("dataSubjectSelect").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
  if (subjects.includes($("subject").value)) {
    $("dataSubjectSelect").value = $("subject").value;
  }
}

function currentCourseReviewSubject() {
  return filenameCourseData[$("dataSubjectSelect").value] || { books: {} };
}

function renderCourseReviewBooks() {
  const books = Object.keys(currentCourseReviewSubject().books || {});
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
  return Object.keys(filenameCourseData);
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
    renderProgressBooks();
    renderFilenameCourses();
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
  $("quickTodayBtn").addEventListener("click", quickToday);
  $("quickTomorrowBtn").addEventListener("click", quickTomorrow);
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
    if (target.dataset.progress) lineAppend("progress", target.dataset.progress);
    if (target.dataset.progressTopic) lineAppend("progress", decodeURIComponent(target.dataset.progressTopic));
    if (target.dataset.progressSearch) lineAppend("progress", decodeURIComponent(target.dataset.progressSearch));
    if (target.dataset.cacheProgressTopic) addProgressCacheItem(decodeURIComponent(target.dataset.cacheProgressTopic));
    if (target.dataset.cacheProgressSearch) addProgressCacheItem(decodeURIComponent(target.dataset.cacheProgressSearch));
    if (target.dataset.homework) phraseAppend("homework", target.dataset.homework);
    if (target.dataset.quiz) phraseAppend("quiz", target.dataset.quiz);
    if (target.dataset.template) applyTemplate(target.dataset.template);
    if (target.dataset.deleteTemplate && confirm("確定刪除這個班級模板嗎？")) deleteTemplate(target.dataset.deleteTemplate);
    if (target.dataset.removeProgressCache) removeProgressCacheItem(target.dataset.removeProgressCache);
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
  });

  document.body.addEventListener("input", event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.courseFixNoteId) updateCourseFixNote(target.dataset.courseFixNoteId, target.value);
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
      $("dataSubjectSelect").value = $("subject").value;
      renderCourseReviewBooks();
      renderCourseReviewCurrent();
    }
  });

  [
    "filenameExt", "filenameDate", "filenameUnit", "filenameDocName", "filenameAudience", "filenameStatus",
    "filenameCourseAlias", "mockYear", "mockExamType", "mockName", "termSemester", "termSchool",
    "termGrade", "termExam", "otherTopic", "otherContent", "otherNote"
  ].forEach(id => {
    $(id).addEventListener("input", updateFilenamePreview);
    $(id).addEventListener("change", updateFilenamePreview);
  });
}

restoreDraft();
bindEvents();
updatePreviewSizeClass();
renderTemplates();
renderProgressCache();
renderHomeworkPhrases();
renderArchives();
renderHistoryPicker();
initFilenameTool();
