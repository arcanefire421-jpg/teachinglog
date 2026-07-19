const $ = (id) => document.getElementById(id);
const FIX_STORAGE = "teachinglog.courseFixes.v1";

let courseData = {};
let expanded = false;
let fixes = readFixes();

function readFixes() {
  try {
    return JSON.parse(localStorage.getItem(FIX_STORAGE)) || [];
  } catch {
    return [];
  }
}

function saveFixes() {
  localStorage.setItem(FIX_STORAGE, JSON.stringify(fixes));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

async function init() {
  courseData = await fetch("course-data.json").then(res => res.json());
  renderSubjects();
  bindEvents();
  renderBooks();
  renderCurrent();
}

function bindEvents() {
  $("subjectSelect").addEventListener("change", () => {
    renderBooks();
    renderCurrent();
  });
  $("bookSelect").addEventListener("change", renderCurrent);
  $("searchInput").addEventListener("input", renderCurrent);
  $("showAllBtn").addEventListener("click", () => {
    expanded = true;
    renderCurrent();
  });
  $("collapseBtn").addEventListener("click", () => {
    expanded = false;
    renderCurrent();
  });
  $("copyPathBtn").addEventListener("click", copyCurrentPath);
  $("exportSubjectBtn").addEventListener("click", exportSubjectCsv);
  $("exportFixesBtn").addEventListener("click", exportFixesCsv);
  $("clearFixesBtn").addEventListener("click", clearFixes);
  document.body.addEventListener("click", handleDocumentClick);
  document.body.addEventListener("input", handleDocumentInput);
}

function renderSubjects() {
  const subjects = Object.keys(courseData);
  $("subjectSelect").innerHTML = subjects.map(subject => `<option>${escapeHtml(subject)}</option>`).join("");
}

function currentSubjectNode() {
  return courseData[$("subjectSelect").value] || { books: {} };
}

function renderBooks() {
  const books = Object.keys(currentSubjectNode().books || {});
  $("bookSelect").innerHTML = books.map(book => `<option>${escapeHtml(book)}</option>`).join("");
}

function currentBookNode() {
  return currentSubjectNode().books[$("bookSelect").value] || {};
}

function renderCurrent() {
  const subject = $("subjectSelect").value;
  const book = $("bookSelect").value;
  const keyword = $("searchInput").value.trim();
  $("currentPath").textContent = `${subject} / ${book || "未選教材"}`;
  renderStats();
  renderIssues();
  renderOutline(keyword);
  renderFixes();
}

function flattenBook(bookNode = currentBookNode()) {
  const rows = [];
  Object.entries(bookNode).forEach(([chapter, sections]) => {
    Object.entries(sections || {}).forEach(([section, topics]) => {
      (topics || []).forEach(topic => rows.push({ chapter, section, topic }));
    });
  });
  return rows;
}

function renderStats() {
  const bookNode = currentBookNode();
  const chapters = Object.keys(bookNode).length;
  let sections = 0;
  let topics = 0;
  Object.values(bookNode).forEach(sectionMap => {
    sections += Object.keys(sectionMap || {}).length;
    Object.values(sectionMap || {}).forEach(topicList => topics += (topicList || []).length);
  });
  $("stats").innerHTML = [
    ["章", chapters],
    ["節", sections],
    ["小重點", topics],
    ["教材數", Object.keys(currentSubjectNode().books || {}).length]
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong>${label}</div>`).join("");
}

function findIssues() {
  const issues = [];
  const subject = $("subjectSelect").value;
  const book = $("bookSelect").value;
  if (/第1冊|選修I|選修II|3B|4A|4B/.test(book)) {
    issues.push({ type: "冊名", path: [subject, book], text: `冊名格式可統一：${book}` });
  }
  Object.entries(currentBookNode()).forEach(([chapter, sections]) => {
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

function renderIssues() {
  const issues = findIssues();
  $("issueCount").textContent = issues.length;
  if (!issues.length) {
    $("issueList").innerHTML = `<div class="empty">這本教材目前沒有明顯提醒。</div>`;
    return;
  }
  $("issueList").innerHTML = issues.slice(0, 80).map(issue => (
    `<div class="issue">
      <div><strong>${escapeHtml(issue.type)}</strong>：${escapeHtml(issue.text)}</div>
      <button class="secondary mini-btn" type="button" data-add-fix="${encodeURIComponent(JSON.stringify(issue.path))}" data-fix-type="${escapeHtml(issue.type)}" data-fix-note="${escapeHtml(issue.text)}">加入待修正</button>
    </div>`
  )).join("");
}

function includesKeyword(chapter, section, topics, keyword) {
  if (!keyword) return true;
  const text = `${chapter} ${section} ${(topics || []).join(" ")}`.toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function mark(value, keyword) {
  const text = escapeHtml(value);
  if (!keyword) return text;
  const escaped = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), match => `<span class="mark">${match}</span>`);
}

function renderOutline(keyword = "") {
  const subject = $("subjectSelect").value;
  const book = $("bookSelect").value;
  const bookNode = currentBookNode();
  const chapterHtml = Object.entries(bookNode).map(([chapter, sections]) => {
    const matchedSections = Object.entries(sections || {}).filter(([section, topics]) => includesKeyword(chapter, section, topics, keyword));
    if (!matchedSections.length) return "";
    const sectionHtml = matchedSections.map(([section, topics]) => `
      <div class="section">
        <div class="section-title">
          <span>${mark(section, keyword)}</span>
          <button class="secondary mini-btn" type="button" data-add-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter, section]))}" data-fix-type="節" data-fix-note="檢查此節">標記</button>
        </div>
        <div class="topics">
          ${(topics || []).map(topic => `
            <span class="topic">
              ${mark(topic, keyword)}
              <button class="secondary" type="button" data-add-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter, section, topic]))}" data-fix-type="小重點" data-fix-note="檢查此小重點">標記</button>
            </span>
          `).join("")}
        </div>
      </div>
    `).join("");
    return `
      <details class="chapter" ${expanded || keyword ? "open" : ""}>
        <summary>
          ${mark(chapter, keyword)}　<small>${matchedSections.length} 節</small>
          <button class="secondary mini-btn" type="button" data-add-fix="${encodeURIComponent(JSON.stringify([subject, book, chapter]))}" data-fix-type="章" data-fix-note="檢查此章">標記</button>
        </summary>
        ${sectionHtml}
      </details>
    `;
  }).join("");
  $("outline").innerHTML = chapterHtml || `<div class="empty">沒有符合搜尋的章節。</div>`;
}

function addFix(path, type, note = "") {
  const key = path.join(" / ");
  const existing = fixes.find(item => item.key === key);
  if (existing) {
    existing.type = type || existing.type;
    existing.note = note || existing.note;
  } else {
    fixes.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      path,
      type,
      note,
      createdAt: new Date().toISOString()
    });
  }
  saveFixes();
  renderFixes();
  toast("已加入待修正");
}

function renderFixes() {
  $("fixCount").textContent = fixes.length;
  if (!fixes.length) {
    $("fixList").innerHTML = `<div class="empty">尚未標記任何項目。</div>`;
    return;
  }
  $("fixList").innerHTML = fixes.map(item => `
    <div class="fix-item">
      <div class="fix-row">
        <strong>${escapeHtml(item.type || "待修正")}</strong>
        <button class="secondary danger-text mini-btn" type="button" data-remove-fix="${item.id}">移除</button>
      </div>
      <div class="fix-path">${escapeHtml(item.key)}</div>
      <input class="fix-note" data-fix-note-id="${item.id}" value="${escapeHtml(item.note || "")}" placeholder="修正備註">
    </div>
  `).join("");
}

function removeFix(id) {
  fixes = fixes.filter(item => item.id !== id);
  saveFixes();
  renderFixes();
}

function updateFixNote(id, note) {
  fixes = fixes.map(item => item.id === id ? { ...item, note } : item);
  saveFixes();
}

function clearFixes() {
  if (!fixes.length) return;
  if (!confirm("確定清空待修正清單嗎？")) return;
  fixes = [];
  saveFixes();
  renderFixes();
}

function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.addFix) {
    event.preventDefault();
    event.stopPropagation();
    const path = JSON.parse(decodeURIComponent(target.dataset.addFix));
    addFix(path, target.dataset.fixType || "待修正", target.dataset.fixNote || "");
  }
  if (target.dataset.removeFix) {
    removeFix(target.dataset.removeFix);
  }
}

function handleDocumentInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.fixNoteId) {
    updateFixNote(target.dataset.fixNoteId, target.value);
  }
}

function copyCurrentPath() {
  const text = `${$("subjectSelect").value} / ${$("bookSelect").value}`;
  navigator.clipboard.writeText(text);
  toast("已複製目前路徑");
}

function exportSubjectCsv() {
  const subject = $("subjectSelect").value;
  const node = currentSubjectNode();
  const rows = [["科目", "冊別/教材", "章", "節", "小重點"]];
  Object.entries(node.books || {}).forEach(([book, chapters]) => {
    Object.entries(chapters || {}).forEach(([chapter, sections]) => {
      Object.entries(sections || {}).forEach(([section, topics]) => {
        (topics || []).forEach(topic => rows.push([subject, book, chapter, section, topic]));
      });
    });
  });
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${subject}_課程資料.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportFixesCsv() {
  if (!fixes.length) {
    toast("目前沒有待修正項目");
    return;
  }
  const rows = [["類型", "科目", "冊別/教材", "章", "節", "小重點", "備註", "建立時間"]];
  fixes.forEach(item => {
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

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

init().catch(() => {
  $("outline").innerHTML = `<div class="empty">資料載入失敗，請確認 course-data.json 是否存在。</div>`;
});
