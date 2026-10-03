(() => {
  "use strict";
  const keys = { drafts: "teachinglog.productionDrafts.v2", presets: "teachinglog.productionPresets.v2" };
  let drafts = readJson(keys.drafts, []);
  let presets = readJson(keys.presets, []);
  if (!Array.isArray(drafts)) drafts = [];
  if (!Array.isArray(presets)) presets = [];
  let sections = [];
  let activeResult = 0;
  let preflight = null;
  let revision = 0;
  const icons = () => window.lucide?.createIcons();
  const editableFields = () => [...document.querySelectorAll('[data-workspace-view="production"] input[id], [data-workspace-view="production"] select[id], [data-workspace-view="production"] textarea[id]')]
    .filter(el => !el.readOnly && !["file", "radio"].includes(el.type) && !/^(shared|production|import|bank)/.test(el.id))
    .filter(el => !/^(question|handout)(Grade|Subject|Book|Chapter|Section|Keyword)$/.test(el.id))
    .filter(el => !["filenameSubject", "filenameCourse", "filenameChapter"].includes(el.id));

  const capture = (withScope) => ({
    version: 2,
    scopeSource: productionScopeSource,
    fields: Object.fromEntries(editableFields().map(el => [el.id, el.type === "checkbox" ? el.checked : el.value])),
    ...(withScope ? {
      scope: currentProductionScopeItem(),
      scopeCache: structuredClone(productionScopeCache),
      allocationMode: $("productionAllocationMode").value
    } : {})
  });

  function validateSnapshot(snapshot, withScope) {
    if (!snapshot || snapshot.version !== 2 || !["current", "saved"].includes(snapshot.scopeSource) || !snapshot.fields || typeof snapshot.fields !== "object" || Array.isArray(snapshot.fields)) throw Error("草稿格式或版本不符。");
    const allowed = new Map(editableFields().map(el => [el.id, el]));
    if (withScope) {
      productionScopeSource = snapshot.scopeSource;
      writeJson("teachinglog.scopeSource.v2", productionScopeSource);
    }
    syncSharedScopeToTools();
    for (const [id, value] of Object.entries(snapshot.fields)) {
      if (!allowed.has(id)) throw Error(`無法辨識的設定：${id}`);
      const el = allowed.get(id);
      if (el.type === "checkbox" ? typeof value !== "boolean" : typeof value !== "string" || value.length > 20000) throw Error(`設定格式錯誤：${id}`);
      if (el.tagName === "SELECT" && ![...el.options].some(option => option.value === value)) throw Error(`選項已變更：${id}`);
    }
    if (withScope) {
      if (!Array.isArray(snapshot.scopeCache) || snapshot.scopeCache.length > 100) throw Error("暫存範圍格式不符。 ");
      for (const item of [snapshot.scope, ...snapshot.scopeCache]) {
        if (!item || ["grade", "subject", "book", "chapter", "section"].some(key => typeof item[key] !== "string" || item[key].length > 500) || !Array.isArray(item.topics) || item.topics.some(topic => typeof topic !== "string" || topic.length > 500)) throw Error("範圍資料格式不符。");
        if (item.keyword != null && (typeof item.keyword !== "string" || item.keyword.length > 20000)) throw Error("關鍵字格式不符。");
        if (item.id != null && typeof item.id !== "string") throw Error("範圍識別碼格式不符。");
        if (item.questionCount != null && !["string", "number"].includes(typeof item.questionCount)) throw Error("題數格式不符。");
        if (item.weight != null && (!Number.isFinite(Number(item.weight)) || Number(item.weight) <= 0)) throw Error("權重格式不符。");
      }
    }
  }

  function restore(snapshot, withScope) {
    validateSnapshot(snapshot, withScope);
    if (withScope) {
      const item = snapshot.scope;
      const steps = [["sharedGrade", item.grade, renderSharedSubjects], ["sharedSubject", item.subject, renderSharedBooks], ["sharedBook", item.book, renderSharedChapters], ["sharedChapter", item.chapter, renderSharedSections], ["sharedSection", item.section, renderSharedTopics]];
      for (const [id, value, refresh] of steps) {
        if (![...$(id).options].some(option => option.value === value)) throw Error(`目前課程資料找不到：${value}`);
        $(id).value = value;
        refresh();
      }
      $("sharedKeyword").value = item.keyword || "";
      sharedSelectedTopics = new Set(item.topics);
      document.querySelectorAll("[data-shared-topic]").forEach(button => button.classList.toggle("selected", sharedSelectedTopics.has(button.dataset.sharedTopic)));
      $("sharedTopicCount").textContent = sharedSelectedTopics.size;
      productionScopeCache = structuredClone(snapshot.scopeCache).map(normalizeProductionScopeItem);
      writeJson(STORAGE.productionScopeCache, productionScopeCache);
      $("productionAllocationMode").value = ["equal", "weighted", "manual"].includes(snapshot.allocationMode) ? snapshot.allocationMode : "equal";
    }
    for (const [id, value] of Object.entries(snapshot.fields)) {
      if ($(id).type === "checkbox") $(id).checked = value;
      else $(id).value = value;
    }
    updateFilenameFields();
    updateFilenamePreview();
    buildQuestionPrompt();
    buildHandoutPrompt();
    syncQuestionModeButtons();
    renderProductionScopeCache();
    updateProductionTaskVisibility();
    invalidateBatchOutput();
    refresh();
  }

  function safeRestore(snapshot, withScope) {
    const backup = capture(true);
    writeJson("teachinglog.productionLastRestoreBackup.v2", backup);
    try { restore(snapshot, withScope); }
    catch (error) { restore(backup, true); throw error; }
  }

  function persist() {
    const previous = Object.fromEntries(Object.values(keys).map(key => [key, localStorage.getItem(key)]));
    try {
      writeJson(keys.drafts, drafts);
      writeJson(keys.presets, presets);
    } catch {
      for (const [key, value] of Object.entries(previous)) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Keep the recoverable in-memory list if browser storage is full. */ }
      }
      drafts = JSON.parse(previous[keys.drafts] || "[]");
      presets = JSON.parse(previous[keys.presets] || "[]");
      renderSaved();
      toast("儲存失敗，瀏覽器空間不足；既有資料保留，請先匯出備份。");
      return false;
    }
    renderSaved();
    return true;
  }
  function renderSaved() {
    for (const [kind, items, target] of [["draft", drafts, "productionDraftList"], ["preset", presets, "customProductionPresets"]]) {
      $(target).innerHTML = items.length ? items.map(item => `<div class="saved-item"><button type="button" class="saved-item-name" data-saved-kind="${kind}" data-saved-id="${escapeHtml(item.id)}" data-saved-action="load">${escapeHtml(item.name)}</button><span>${escapeHtml(item.updated.slice(0, 10))}</span><button class="icon-button" type="button" title="以目前設定更新" aria-label="更新 ${escapeHtml(item.name)}" data-saved-kind="${kind}" data-saved-id="${escapeHtml(item.id)}" data-saved-action="update"><i data-lucide="save"></i></button><button class="icon-button danger-text" type="button" title="刪除" aria-label="刪除 ${escapeHtml(item.name)}" data-saved-kind="${kind}" data-saved-id="${escapeHtml(item.id)}" data-saved-action="delete"><i data-lucide="trash-2"></i></button></div>`).join("") : `<p class="saved-empty">尚無${kind === "draft" ? "製作草稿" : "自訂組合"}</p>`;
    }
    icons();
  }
  function save(kind) {
    const input = $(kind === "draft" ? "productionDraftName" : "productionPresetName");
    const name = input.value.trim();
    if (!name) { toast("請輸入名稱"); input.focus(); return; }
    const items = kind === "draft" ? drafts : presets;
    if (items.length >= 50) { toast("最多保留 50 份，請先匯出備份或刪除舊項目。"); return; }
    items.unshift({ id: crypto.randomUUID(), name, updated: new Date().toISOString(), snapshot: capture(kind === "draft") });
    if (!persist()) return;
    $("productionSaveStatus").textContent = `已另存：${name}`;
  }
  function allocationItems() { return productionScopeCache.filter(item => item.enabled !== false); }
  function renderAllocation() {
    const items = allocationItems();
    const total = Number($("questionTotalCount").value);
    const assigned = items.reduce((sum, item) => sum + (Number(item.questionCount) || 0), 0);
    const auto = items.filter(item => String(item.questionCount ?? "").trim() === "").length;
    $("productionAllocationStatus").textContent = `已分配 ${assigned} / ${total} 題 · 剩餘 ${total - assigned} 題${auto ? ` · ${auto} 範圍自動` : ""}`;
    $("productionWeights").hidden = $("productionAllocationMode").value !== "weighted";
    const signature = JSON.stringify(items.map(item => [item.id, item.weight, item.subject, item.section]));
    if ($("productionWeights").dataset.signature !== signature) {
      $("productionWeights").dataset.signature = signature;
      $("productionWeights").innerHTML = items.map(item => `<label><span>${escapeHtml(item.subject)} / ${escapeHtml(item.section)}</span><input type="number" min="0.1" max="100" step="0.1" value="${escapeHtml(item.weight || 1)}" data-production-weight="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.section)} 權重"></label>`).join("");
    }
    $("applyProductionAllocationBtn").disabled = productionScopeSource !== "saved" || !items.length || $("productionAllocationMode").value === "manual";
  }
  function allocate() {
    const items = allocationItems();
    const total = Number($("questionTotalCount").value);
    if (!items.length || !Number.isInteger(total) || total < items.length || total > 60) { toast("總題數須至少涵蓋每個已勾選範圍一題，且不可超過 60 題。"); return; }
    const weighted = $("productionAllocationMode").value === "weighted";
    const weights = items.map(item => weighted ? Number(item.weight || 1) : 1);
    if (weights.some(value => !Number.isFinite(value) || value <= 0 || value > 100)) { toast("權重須大於 0 且不超過 100。"); return; }
    const sum = weights.reduce((a, b) => a + b, 0);
    const quotas = weights.map(weight => total * weight / sum);
    const counts = quotas.map(value => Math.floor(value));
    const order = quotas.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    const remainder = total - counts.reduce((a, b) => a + b, 0);
    for (let index = 0; index < remainder; index++) counts[order[index].index]++;
    // Preserve proportional quotas; only redistribute when a selected scope would receive zero.
    for (let index = 0; index < counts.length; index++) {
      if (counts[index] > 0) continue;
      const donor = counts.map((count, i) => ({ i, count, excess: count - quotas[i] }))
        .filter(item => item.count > 1).sort((a, b) => b.excess - a.excess || b.count - a.count || a.i - b.i)[0];
      counts[donor.i]--;
      counts[index] = 1;
    }
    const map = new Map(items.map((item, index) => [item.id, String(counts[index])]));
    productionScopeCache = productionScopeCache.map(item => map.has(item.id) ? { ...item, questionCount: map.get(item.id) } : item);
    saveProductionScopeCache();
    toast("已套用題數分配");
  }
  function refresh() {
    document.querySelectorAll('[name="scopeSource"]').forEach(input => { input.checked = input.value === productionScopeSource; });
    document.body.classList.toggle("production-active", activeView === "production");
    const items = productionScopeItemsForPrompt();
    const text = `${productionScopeSource === "saved" ? `已暫存 ${allocationItems().length} 個範圍` : "目前單元"} · ${selectedOutputLabels().join("、") || "尚未選擇輸出"}`;
    $("productionStickyTitle").textContent = text;
    $("productionStickyDetails").innerHTML = `<p>${escapeHtml(items.map(item => `${item.grade} ${item.subject} / ${item.section}`).join("；"))}</p><p>${$("batchOutputQuestion").checked ? `題目 ${escapeHtml($("questionTotalCount").value)} 題 · ${escapeHtml(QUESTION_TYPOGRAPHY_LABELS[$("questionTypography").value])}` : ""}</p><p>${$("batchOutputHandout").checked ? `${escapeHtml(handoutAudienceLabel($("handoutAudience").value))} · ${escapeHtml(TYPOGRAPHY_LABELS[$("handoutTypography").value])}` : ""}</p><p class="validation-status">${escapeHtml(productionValidationError())}</p>`;
    renderAllocation();
  }
  function showResult(index) {
    if (!sections[index]) return;
    activeResult = index;
    $("productionResultPanel").hidden = false;
    $("productionResultTitle").textContent = sections[index].title;
    $("productionResultPanel").setAttribute("aria-labelledby", `productionResultTab${index}`);
    $("productionResultText").value = sections[index].text;
    $("productionResultText").scrollTop = 0;
    document.querySelectorAll("[data-result-index]").forEach(button => {
      const selected = Number(button.dataset.resultIndex) === index;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }
  function resetResults() {
    sections = [];
    $("productionResultTabs").replaceChildren();
    $("productionResultPanel").hidden = true;
    $("productionResultText").value = "";
    revision++;
    preflight = null;
    $("bankPreflightResults").replaceChildren();
    $("bankPreflightStatus").textContent = "設定已變更，尚未檢查";
  }

  async function readApi(path) {
    const response = await fetch(`http://127.0.0.1:8787${path}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw Error(`API HTTP ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== "object") throw Error("API 回傳格式不符");
    return data;
  }
  async function checkBank() {
    const error = productionValidationError();
    if (error) { toast(error); return; }
    invalidateBatchOutput();
    const token = revision;
    const items = structuredClone(productionScopeItemsForPrompt());
    const total = $("batchOutputQuestion").checked ? Number($("questionTotalCount").value) : null;
    $("bankPreflightBtn").disabled = true;
    $("bankPreflightStatus").textContent = "檢查中…";
    const rows = [];
    try {
      await readApi("/api/stats");
      if (token !== revision) return;
      const assigned = items.filter(item => String(item.questionCount ?? "").trim() !== "");
      const auto = items.filter(item => String(item.questionCount ?? "").trim() === "");
      const remaining = total === null ? null : total - assigned.reduce((sum, item) => sum + Number(item.questionCount), 0);
      let autoIndex = 0;
      for (const item of items) {
        const keyword = item.keyword || item.topics?.join(" ") || item.section || item.chapter;
        const params = new URLSearchParams({ subject: questionBankSubjectName(item.grade, item.subject), level: inferQuestionLevelKey(item.grade), keyword, page: "1", pageSize: "1" });
        const data = await readApi(`/api/questions?${params}`);
        if (token !== revision) return;
        if (data.total === null || data.total === undefined || !Number.isSafeInteger(Number(data.total)) || Number(data.total) < 0) throw Error("候選題總數格式不符，不可視為零題。");
        const requested = item.questionCount ? Number(item.questionCount) : total === null ? null : Math.floor(remaining / auto.length) + (autoIndex++ < remaining % auto.length ? 1 : 0);
        rows.push({ subject: item.subject, section: item.section, keyword, total: Number(data.total), requested });
      }
      if (token !== revision) return;
      preflight = { version: PRODUCTION_RULE_VERSION, checkedAt: new Date().toISOString(), rows };
      $("bankPreflightStatus").textContent = "API 已連線；檢索結果不等於已完成選題";
      $("bankPreflightResults").innerHTML = `<table><thead><tr><th>範圍</th><th>搜尋詞</th><th>候選數</th><th>需求</th><th>結果</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.subject)} / ${escapeHtml(row.section)}</td><td>${escapeHtml(row.keyword)}</td><td>${row.total}</td><td>${row.requested ?? "未指定"}</td><td>${row.requested === null ? "待選題" : row.total < row.requested ? `不足 ${row.requested - row.total} 題` : "數量足夠，待去重及審題"}</td></tr>`).join("")}</tbody></table>`;
    } catch (error) {
      if (token !== revision) return;
      preflight = null;
      $("bankPreflightStatus").textContent = "未能完成預檢；候選題數未知";
      $("bankPreflightResults").textContent = `請確認本機題庫已啟動於 http://127.0.0.1:8787，並允許此網站連線。瀏覽器若阻擋本機網路或 CORS，請改從本機網站檢查。${error.message}`;
    } finally {
      $("bankPreflightBtn").disabled = false;
    }
  }

  window.productionWorkspacePreflightSummary = () => preflight ? `題庫預檢（${preflight.checkedAt}）：${JSON.stringify(preflight.rows)}；不同範圍可能重複，仍須去重與審題。` : "題庫預檢：未完成或已過期，候選題數未知；不得假設足夠。";
  const sticky = document.createElement("aside");
  sticky.id = "productionStickySummary";
  sticky.dataset.workspaceView = "production";
  sticky.className = "production-sticky-summary hidden-view";
  sticky.innerHTML = `<details open><summary id="productionStickyTitle">目前設定</summary><div id="productionStickyDetails"></div></details><button id="productionStickyGenerateBtn" class="primary-action" type="button"><i data-lucide="file-check-2"></i>產生結果</button>`;
  document.querySelector(".app-shell").append(sticky);
  const compact = window.matchMedia("(max-width: 1000px)");
  const resizeSummary = () => { sticky.querySelector("details").open = !compact.matches; };
  compact.addEventListener("change", resizeSummary);
  resizeSummary();
  const scopePanel = document.querySelector(".production-scope-panel");
  const outputPanel = document.querySelector(".production-output-section");
  scopePanel.insertBefore(outputPanel, document.querySelector(".production-preset-section"));
  document.querySelectorAll('[data-production-task] .generated-prompt-field').forEach(el => { el.hidden = true; });
  $("batchOutputText").hidden = true;
  const filenameFields = document.querySelector('[data-filename-fields="handout"]');
  filenameFields.prepend($("filenameCourseAlias").closest("label"));
  $("productionFinalSummary").hidden = true;
  document.querySelector(".question-current-card").hidden = true;

  window.addEventListener("production:updated", refresh);
  window.addEventListener("production:invalidated", resetResults);
  window.addEventListener("production:generated", event => {
    sections = [...event.detail, { title: "全部結果", text: $("batchOutputText").value }];
    $("productionResultTabs").innerHTML = sections.map((item, index) => `<button id="productionResultTab${index}" type="button" role="tab" aria-controls="productionResultPanel" aria-selected="false" data-result-index="${index}">${escapeHtml(item.title)}</button>`).join("");
    showResult(0);
  });
  document.addEventListener("change", event => {
    if (event.target.name === "scopeSource") {
      productionScopeSource = event.target.value;
      writeJson("teachinglog.scopeSource.v2", productionScopeSource);
      syncSharedScopeToTools();
      invalidateBatchOutput();
    }
    if (event.target.dataset.productionWeight) {
      const value = Number(event.target.value);
      if (!Number.isFinite(value) || value <= 0 || value > 100) { toast("權重須大於 0 且不超過 100。"); event.target.value = "1"; }
      productionScopeCache = productionScopeCache.map(item => item.id === event.target.dataset.productionWeight ? { ...item, weight: Number(event.target.value) } : item);
      writeJson(STORAGE.productionScopeCache, productionScopeCache);
    }
    if (event.target.closest('[data-workspace-view="production"]')) refresh();
  });
  document.addEventListener("click", event => {
    if (event.target.closest("[data-view-tab]")) refresh();
    const tab = event.target.closest("[data-result-index]");
    if (tab) showResult(Number(tab.dataset.resultIndex));
    const button = event.target.closest("[data-saved-action]");
    if (!button) return;
    const items = button.dataset.savedKind === "draft" ? drafts : presets;
    const index = items.findIndex(item => item.id === button.dataset.savedId);
    if (index < 0) return;
    const item = items[index];
    try {
      if (button.dataset.savedAction === "load" && confirm(`載入「${item.name}」並取代目前設定？`)) {
        safeRestore(item.snapshot, button.dataset.savedKind === "draft");
        $(button.dataset.savedKind === "draft" ? "productionDraftName" : "productionPresetName").value = item.name;
        $("productionSaveStatus").textContent = `已載入：${item.name}`;
      }
      if (button.dataset.savedAction === "update" && confirm(`以目前設定更新「${item.name}」？`)) {
        const input = $(button.dataset.savedKind === "draft" ? "productionDraftName" : "productionPresetName");
        item.name = input.value.trim() || item.name;
        item.snapshot = capture(button.dataset.savedKind === "draft"); item.updated = new Date().toISOString(); persist();
      }
      if (button.dataset.savedAction === "delete" && confirm(`刪除「${item.name}」？`)) { items.splice(index, 1); persist(); }
    } catch (error) { toast(error.message); }
  });
  $("productionResultTabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !sections.length) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : (activeResult + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
    showResult(index);
    $(`productionResultTab${index}`).focus();
  });
  $("copyProductionResultBtn").addEventListener("click", async () => {
    if (!sections[activeResult]) return;
    try { await navigator.clipboard.writeText(sections[activeResult].text); toast("已複製此項"); } catch { toast("無法存取剪貼簿，請選取內容複製。"); }
  });
  $("productionStickyGenerateBtn").addEventListener("click", () => {
    if (buildBatchOutput()) $("batchOutputTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  for (const id of ["buildQuestionPromptBtn", "buildHandoutPromptBtn"]) {
    $(id).addEventListener("click", () => {
      if (buildBatchOutput()) $("batchOutputTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  $("saveProductionDraftBtn").addEventListener("click", () => save("draft"));
  $("saveProductionPresetBtn").addEventListener("click", () => save("preset"));
  $("applyProductionAllocationBtn").addEventListener("click", allocate);
  $("bankPreflightBtn").addEventListener("click", checkBank);
  $("exportProductionDraftsBtn").addEventListener("click", () => downloadTextFile(`製作草稿與組合_${todayIso()}.json`, JSON.stringify({ kind: "teachinglog-production-backup", version: 2, drafts, presets }, null, 2)));
  $("importProductionDraftsBtn").addEventListener("click", () => $("importProductionDraftsFile").click());
  $("importProductionDraftsFile").addEventListener("change", async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2000000) throw Error("備份檔不可超過 2 MB。");
      const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      if (data.kind !== "teachinglog-production-backup" || data.version !== 2 || !Array.isArray(data.drafts) || !Array.isArray(data.presets)) throw Error("不是本站的製作備份檔。");
      for (const [items, withScope] of [[data.drafts, true], [data.presets, false]]) {
        if (items.length > 50) throw Error("備份項目過多。");
        for (const item of items) {
          if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 || typeof item.updated !== "string" || !Number.isFinite(Date.parse(item.updated))) throw Error("備份名稱或日期格式不符。");
          validateSnapshot(item.snapshot, withScope);
        }
      }
      if (drafts.length + data.drafts.length > 50 || presets.length + data.presets.length > 50) throw Error("匯入後超過 50 份，請先整理舊項目。");
      if (!confirm(`合併匯入 ${data.drafts.length} 份草稿、${data.presets.length} 個組合？既有資料將保留。`)) return;
      drafts.push(...data.drafts.map(item => ({ ...item, id: crypto.randomUUID() })));
      presets.push(...data.presets.map(item => ({ ...item, id: crypto.randomUUID() })));
      if (!persist()) return;
      $("productionSaveStatus").textContent = "已合併匯入，既有草稿與組合保留。";
    } catch (error) { toast(error.message); }
    finally { event.target.value = ""; }
  });
  renderSaved();
  refresh();
})();
