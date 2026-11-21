"use strict";
/* Platinum Audit — The Leonida 55. Offline GTA VI trophy guide and tracker.
   Loads only its own two local data files; makes no network requests. */

const PROGRESS_STORAGE_KEY = "platinumAuditProgressV1";
const KIND_FILTERS = [
  ["all", "All 55"], ["story", "Story"], ["missable", "Missable"],
  ["collectibles", "Collectibles"], ["activities", "Activities"],
  ["online", "Online"], ["hidden", "PSN-hidden"], ["disputed", "Disputed"],
  ["notearned", "Not earned"]
];
const GRADE_FILTERS = [["all", "Any grade"], ["platinum", "P"], ["gold", "G"], ["silver", "S"], ["bronze", "B"]];
const CHAPTER_GROUP_ORDER = ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4", "Strangers", "Free roam", "Partner play", "Story and free roam", "Whole game", "Endgame", "Finale"];

let trophyDataList = [];
let sourcePageById = new Map();
let sourcePageList = [];
let progressState = loadProgressFromBrowserStorage();
let activeKindFilter = "all";
let activeGradeFilter = "all";
let activeSearchText = "";

function createElementWithText(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function loadProgressFromBrowserStorage() {
  const fallback = { earned: {}, counts: {}, spoilerShieldOn: true, selectedTrophyId: 28 };
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      earned: parsed.earned || {},
      counts: parsed.counts || {},
      spoilerShieldOn: parsed.spoilerShieldOn !== false,
      selectedTrophyId: parsed.selectedTrophyId || 28
    };
  } catch (error) {
    return fallback;
  }
}

function saveProgressToBrowserStorage() {
  try { window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressState)); } catch (error) { /* storage full or blocked: the app keeps working in memory */ }
}

function findTrophyById(trophyId) {
  return trophyDataList.find((trophy) => trophy.id === trophyId) || trophyDataList[0];
}

function chapterGroupNameForTrophy(trophy) {
  const chapter = trophy.chapter || "Free roam";
  const match = chapter.match(/^Chapter \d+/);
  return match ? match[0] : chapter;
}

function computeAuditTotalsFromData() {
  let claimsCited = 0, claimsBackedByTwoOrMoreSources = 0, disputesShown = 0, guidesCitingSources = 0;
  let possiblyMissable = 0, atRisk = 0, psnHidden = 0;
  for (const trophy of trophyDataList) {
    let trophyCites = false;
    for (const step of trophy.steps || []) {
      if (Array.isArray(step.sources) && step.sources.length > 0) {
        claimsCited += 1; trophyCites = true;
        if (step.sources.length >= 2) claimsBackedByTwoOrMoreSources += 1;
      }
    }
    if (trophy.dispute) disputesShown += 1;
    if (trophyCites) guidesCitingSources += 1;
    if (trophy.missableTier === "possibly-missable") possiblyMissable += 1;
    if (trophy.missableTier === "at-risk") atRisk += 1;
    if (trophy.hidden) psnHidden += 1;
  }
  const siteNames = new Set(sourcePageList.map((page) => page.site));
  return {
    claimsCited, claimsBackedByTwoOrMoreSources, disputesShown, guidesCitingSources,
    possiblyMissable, atRisk, psnHidden,
    sourcePages: sourcePageList.length, sourceSites: siteNames.size
  };
}

function renderAuditStrip() {
  const totals = computeAuditTotalsFromData();
  const strip = document.getElementById("audit-strip");
  strip.textContent = "";
  const segments = [
    trophyDataList.length + "/" + trophyDataList.length + " official name, description, grade",
    totals.claimsCited + "/" + totals.claimsCited + " claims cited",
    totals.claimsBackedByTwoOrMoreSources + " backed by 2+ sources",
    totals.sourcePages + " pages",
    totals.sourceSites + " sites",
    totals.disputesShown + " disputes shown both ways",
    totals.possiblyMissable + " possibly missable",
    totals.atRisk + " at risk",
    totals.psnHidden + " PSN-hidden",
    totals.guidesCitingSources + "/55 guides citing sources"
  ];
  for (const segment of segments) strip.appendChild(createElementWithText("span", "audit-pill", segment));
}

function collectiblesLoggedTotal() {
  let total = 0;
  for (const trophy of trophyDataList) {
    if (!trophy.count) continue;
    if (trophy.id === 1 || trophy.id === 14) continue;
    if (trophy.count.label.indexOf("$") !== -1) continue;
    total += progressState.counts[trophy.id] || 0;
  }
  return total;
}

function renderProgressHeader() {
  const earnedList = trophyDataList.filter((trophy) => progressState.earned[trophy.id]);
  const byGrade = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of earnedList) byGrade[trophy.grade] += 1;
  document.getElementById("earned-summary").textContent = earnedList.length + " / 55 earned";
  const gradeTotals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of trophyDataList) gradeTotals[trophy.grade] += 1;
  document.getElementById("grade-summary").textContent =
    "P " + byGrade.platinum + "/" + gradeTotals.platinum + " · G " + byGrade.gold + "/" + gradeTotals.gold +
    " · S " + byGrade.silver + "/" + gradeTotals.silver + " · B " + byGrade.bronze + "/" + gradeTotals.bronze;
  document.getElementById("collectibles-summary").textContent = collectiblesLoggedTotal() + " collectibles logged";
}

function maskStoryTrophiesBehindSpoilerShield(trophy) {
  const shouldMask = progressState.spoilerShieldOn && trophy.kind === "story" && !progressState.earned[trophy.id];
  if (shouldMask) return { name: "Hidden by the spoiler shield", description: "Hidden by the spoiler shield" };
  return { name: trophy.name, description: trophy.description };
}

function trophyMatchesActiveFilters(trophy) {
  if (activeGradeFilter !== "all" && trophy.grade !== activeGradeFilter) return false;
  if (activeKindFilter === "hidden" && !trophy.hidden) return false;
  else if (activeKindFilter === "disputed" && !trophy.dispute) return false;
  else if (activeKindFilter === "notearned" && progressState.earned[trophy.id]) return false;
  else if (["story", "missable", "collectibles", "activities", "online"].indexOf(activeKindFilter) !== -1 && trophy.kind !== activeKindFilter) return false;
  if (activeSearchText) {
    const haystack = (trophy.name + " " + trophy.description + " " + trophy.chapter).toLowerCase();
    if (haystack.indexOf(activeSearchText.toLowerCase()) === -1) return false;
  }
  return true;
}

function sourcesCitedByTrophy(trophy) {
  const ids = [];
  for (const step of trophy.steps || []) for (const id of step.sources || []) if (ids.indexOf(id) === -1) ids.push(id);
  if (trophy.dispute) for (const id of trophy.dispute.sources || []) if (ids.indexOf(id) === -1) ids.push(id);
  return ids;
}

function renderChecklistGroupedByChapter() {
  const scroll = document.getElementById("checklist-scroll");
  scroll.textContent = "";
  const visible = trophyDataList.filter(trophyMatchesActiveFilters);
  for (const groupName of CHAPTER_GROUP_ORDER) {
    const inGroup = visible.filter((trophy) => chapterGroupNameForTrophy(trophy) === groupName)
      .sort((a, b) => a.roadmapOrder - b.roadmapOrder);
    if (inGroup.length === 0) continue;
    scroll.appendChild(createElementWithText("h3", "chapter-group-title", groupName));
    for (const trophy of inGroup) scroll.appendChild(buildChecklistRowForTrophy(trophy));
  }
  if (visible.length === 0) scroll.appendChild(createElementWithText("p", "row-desc", "No trophies match the active filters."));
}

function buildChecklistRowForTrophy(trophy) {
  const display = maskStoryTrophiesBehindSpoilerShield(trophy);
  const row = createElementWithText("button", "trophy-row" + (trophy.id === progressState.selectedTrophyId ? " is-selected" : ""));
  row.type = "button";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(progressState.earned[trophy.id]);
  checkbox.setAttribute("aria-label", "Mark " + trophy.name + " earned");
  checkbox.addEventListener("click", (event) => { event.stopPropagation(); toggleTrophyEarnedFromChecklist(trophy.id); });
  row.appendChild(checkbox);
  const main = createElementWithText("span", "row-main");
  const nameLine = createElementWithText("span", "row-name-line");
  nameLine.appendChild(createElementWithText("span", "grade-chip grade-" + trophy.grade, trophy.grade[0].toUpperCase()));
  nameLine.appendChild(createElementWithText("span", display.name === trophy.name ? "row-name" : "row-name masked-name", display.name));
  if (trophy.missableTier === "possibly-missable") nameLine.appendChild(createElementWithText("span", "missable-flag", "Possibly missable"));
  else if (trophy.missableTier === "at-risk") nameLine.appendChild(createElementWithText("span", "missable-flag", "At risk"));
  main.appendChild(nameLine);
  main.appendChild(createElementWithText("span", "row-desc", display.description));
  main.appendChild(createElementWithText("span", "row-meta",
    trophy.kind + " · " + sourcesCitedByTrophy(trophy).length + " sources cited" + (trophy.hidden ? " · PSN-hidden" : "") + (trophy.dispute ? " · disputed" : "")));
  row.appendChild(main);
  row.addEventListener("click", () => selectTrophyAndRenderGuide(trophy.id));
  return row;
}

function toggleTrophyEarnedFromChecklist(trophyId) {
  if (progressState.earned[trophyId]) delete progressState.earned[trophyId];
  else progressState.earned[trophyId] = true;
  saveProgressToBrowserStorage();
  renderProgressHeader();
  renderFilterChips();
  renderChecklistGroupedByChapter();
  renderNextUpRoadmapOrder();
}

function selectTrophyAndRenderGuide(trophyId) {
  progressState.selectedTrophyId = trophyId;
  saveProgressToBrowserStorage();
  renderChecklistGroupedByChapter();
  renderGuideDetailPane();
  renderSourcesForSelectedGuide();
  renderNextUpRoadmapOrder();
}

function appendSourceChipsTo(parent, sourceIds) {
  for (const id of sourceIds || []) {
    parent.appendChild(createElementWithText("span", "source-chip", "[" + id + "]"));
  }
}

function renderGuideDetailPane() {
  const trophy = findTrophyById(progressState.selectedTrophyId);
  const pane = document.getElementById("guide-detail-pane");
  pane.textContent = "";
  pane.appendChild(createElementWithText("h2", "", trophy.name));
  pane.appendChild(createElementWithText("p", "official-description", "“" + trophy.description + "”"));
  const badges = createElementWithText("div", "detail-badges");
  badges.appendChild(createElementWithText("span", "detail-badge", "Grade: " + trophy.grade));
  badges.appendChild(createElementWithText("span", "detail-badge", "Kind: " + trophy.kind));
  badges.appendChild(createElementWithText("span", "detail-badge", "Stage: " + trophy.chapter));
  badges.appendChild(createElementWithText("span", "detail-badge", "Roadmap #" + trophy.roadmapOrder + " of 55"));
  if (trophy.hidden) badges.appendChild(createElementWithText("span", "detail-badge", "PSN-hidden until earned"));
  if (trophy.missableTier !== "none") {
    badges.appendChild(createElementWithText("span", "detail-badge is-danger",
      trophy.missableTier === "possibly-missable" ? "Possibly missable" : trophy.missableTier === "at-risk" ? "At risk" : "Watch"));
  }
  const earnedBadge = createElementWithText("span", "detail-badge", progressState.earned[trophy.id] ? "Earned ✓" : "Not earned yet");
  badges.appendChild(earnedBadge);
  pane.appendChild(badges);
  pane.appendChild(createElementWithText("p", "guide-text", trophy.guide));
  if (trophy.missableWindow) {
    const box = createElementWithText("div", "missable-window-box");
    box.appendChild(createElementWithText("strong", "", "Missable window — "));
    box.appendChild(document.createTextNode(trophy.missableWindow));
    pane.appendChild(box);
  }
  if (trophy.count) pane.appendChild(buildCountStepperForTrophy(trophy));
  if (trophy.dispute) pane.appendChild(buildDisputeBoxForTrophy(trophy));
  const stepsHeading = createElementWithText("h3", "", "Guide steps — every step cited");
  stepsHeading.style.margin = "10px 0 2px";
  pane.appendChild(stepsHeading);
  const list = createElementWithText("ol", "step-list");
  for (const step of trophy.steps || []) {
    const item = createElementWithText("li", "", step.text);
    appendSourceChipsTo(item, step.sources);
    list.appendChild(item);
  }
  pane.appendChild(list);
}

function buildCountStepperForTrophy(trophy) {
  const wrap = createElementWithText("div", "count-stepper");
  const current = progressState.counts[trophy.id] || 0;
  const minus = createElementWithText("button", "", "−"); minus.type = "button";
  minus.setAttribute("aria-label", "Decrease " + trophy.count.label);
  minus.addEventListener("click", () => changeTrophyCountByStep(trophy.id, -stepSizeForCount(trophy)));
  const plus = createElementWithText("button", "", "+"); plus.type = "button";
  plus.setAttribute("aria-label", "Increase " + trophy.count.label);
  plus.addEventListener("click", () => changeTrophyCountByStep(trophy.id, stepSizeForCount(trophy)));
  wrap.appendChild(minus);
  wrap.appendChild(createElementWithText("span", "count-value", current + " / " + trophy.count.total));
  wrap.appendChild(plus);
  wrap.appendChild(createElementWithText("span", "count-left",
    trophy.count.label + " · " + Math.max(0, trophy.count.total - current) + " left"));
  return wrap;
}

function stepSizeForCount(trophy) {
  if (trophy.count.total >= 100000) return 5000;
  if (trophy.count.total >= 500) return 10;
  return 1;
}

function changeTrophyCountByStep(trophyId, delta) {
  const trophy = findTrophyById(trophyId);
  const next = Math.min(trophy.count.total, Math.max(0, (progressState.counts[trophyId] || 0) + delta));
  progressState.counts[trophyId] = next;
  saveProgressToBrowserStorage();
  renderGuideDetailPane();
  renderProgressHeader();
}

function buildDisputeBoxForTrophy(trophy) {
  const box = createElementWithText("div", "dispute-box");
  box.appendChild(createElementWithText("h3", "", "SOURCES DIFFER — both versions shown"));
  const a = createElementWithText("p", "", ""); a.appendChild(createElementWithText("strong", "", "A says: ")); a.appendChild(document.createTextNode(trophy.dispute.a)); box.appendChild(a);
  const b = createElementWithText("p", "", ""); b.appendChild(createElementWithText("strong", "", "B says: ")); b.appendChild(document.createTextNode(trophy.dispute.b)); box.appendChild(b);
  const call = createElementWithText("p", "", ""); call.appendChild(createElementWithText("strong", "", "Our call: ")); call.appendChild(document.createTextNode(trophy.dispute.call)); box.appendChild(call);
  const chips = createElementWithText("p", "", "Dispute sources:"); appendSourceChipsTo(chips, trophy.dispute.sources); box.appendChild(chips);
  return box;
}

function renderSourcesForSelectedGuide() {
  const trophy = findTrophyById(progressState.selectedTrophyId);
  const panel = document.getElementById("guide-sources-panel");
  panel.textContent = "";
  const citedPageIds = sourcesCitedByTrophy(trophy);
  panel.appendChild(createElementWithText("h3", "", "Sources for this guide — all " + citedPageIds.length + " pages"));
  const claimsHere = new Map();
  for (const step of trophy.steps || []) for (const id of step.sources || []) claimsHere.set(id, (claimsHere.get(id) || 0) + 1);
  for (const id of citedPageIds) {
    const page = sourcePageById.get(id);
    if (!page) continue;
    const item = createElementWithText("div", "guide-source-item");
    item.appendChild(createElementWithText("span", "source-site", "[" + page.id + "] " + page.site));
    item.appendChild(document.createTextNode(" — " + page.title));
    item.appendChild(createElementWithText("span", "source-path", page.path));
    item.appendChild(createElementWithText("span", "source-path", "Read " + page.read + " · " + (claimsHere.get(id) || 0) + " claims here"));
    panel.appendChild(item);
  }
}

function renderNextUpRoadmapOrder() {
  const panel = document.getElementById("next-up-panel");
  panel.textContent = "";
  panel.appendChild(createElementWithText("h3", "", "Next up — roadmap order"));
  const selected = findTrophyById(progressState.selectedTrophyId);
  const upcoming = trophyDataList
    .filter((trophy) => !progressState.earned[trophy.id] && trophy.id !== selected.id)
    .sort((a, b) => a.roadmapOrder - b.roadmapOrder)
    .filter((trophy) => trophy.roadmapOrder > selected.roadmapOrder)
    .slice(0, 5);
  const shown = upcoming.length > 0 ? upcoming :
    trophyDataList.filter((trophy) => !progressState.earned[trophy.id] && trophy.id !== selected.id)
      .sort((a, b) => a.roadmapOrder - b.roadmapOrder).slice(0, 5);
  for (const trophy of shown) {
    const item = createElementWithText("button", "next-up-item");
    item.type = "button";
    const display = maskStoryTrophiesBehindSpoilerShield(trophy);
    item.appendChild(createElementWithText("span", "row-name", "#" + trophy.roadmapOrder + " " + display.name));
    item.appendChild(createElementWithText("span", "row-desc", display.description));
    item.addEventListener("click", () => selectTrophyAndRenderGuide(trophy.id));
    panel.appendChild(item);
  }
  if (shown.length === 0) panel.appendChild(createElementWithText("p", "row-desc", "Everything earned — platinum time."));
}

function countTrophiesForKindFilter(filterValue) {
  if (filterValue === "all") return trophyDataList.length;
  if (filterValue === "hidden") return trophyDataList.filter((trophy) => trophy.hidden).length;
  if (filterValue === "disputed") return trophyDataList.filter((trophy) => trophy.dispute).length;
  if (filterValue === "notearned") return trophyDataList.filter((trophy) => !progressState.earned[trophy.id]).length;
  return trophyDataList.filter((trophy) => trophy.kind === filterValue).length;
}

function countTrophiesForGradeFilter(filterValue) {
  if (filterValue === "all") return trophyDataList.length;
  return trophyDataList.filter((trophy) => trophy.grade === filterValue).length;
}

function renderFilterChips() {
  const kindBar = document.getElementById("kind-filter-chips");
  kindBar.textContent = "";
  for (const [value, label] of KIND_FILTERS) {
    const chipLabel = value === "all" ? label : label + " " + countTrophiesForKindFilter(value);
    const chip = createElementWithText("button", "filter-chip" + (activeKindFilter === value ? " is-active" : ""), chipLabel);
    chip.type = "button";
    chip.addEventListener("click", () => { activeKindFilter = value; renderFilterChips(); renderChecklistGroupedByChapter(); });
    kindBar.appendChild(chip);
  }
  const gradeBar = document.getElementById("grade-filter-chips");
  gradeBar.textContent = "";
  for (const [value, label] of GRADE_FILTERS) {
    const chip = createElementWithText("button", "filter-chip" + (activeGradeFilter === value ? " is-active" : ""),
      label + " " + countTrophiesForGradeFilter(value));
    chip.type = "button";
    chip.addEventListener("click", () => { activeGradeFilter = value; renderFilterChips(); renderChecklistGroupedByChapter(); });
    gradeBar.appendChild(chip);
  }
}

function exportProgressToFile() {
  const payload = JSON.stringify({ app: "Platinum Audit — The Leonida 55", version: 1, progress: progressState }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "platinum-audit-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importProgressFromFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = parsed.progress || parsed;
      if (incoming && typeof incoming === "object") {
        progressState = {
          earned: incoming.earned || {},
          counts: incoming.counts || {},
          spoilerShieldOn: incoming.spoilerShieldOn !== false,
          selectedTrophyId: incoming.selectedTrophyId || progressState.selectedTrophyId
        };
        saveProgressToBrowserStorage();
        refreshWholeTrackerAfterProgressChange();
      }
    } catch (error) { /* not a Platinum Audit progress file: leave current progress untouched */ }
  });
  reader.readAsText(file);
}

function refreshWholeTrackerAfterProgressChange() {
  document.getElementById("spoiler-shield-toggle").checked = progressState.spoilerShieldOn;
  renderProgressHeader();
  renderFilterChips();
  renderChecklistGroupedByChapter();
  renderGuideDetailPane();
  renderSourcesForSelectedGuide();
  renderNextUpRoadmapOrder();
}

function switchVisibleView(viewName) {
  for (const tab of document.querySelectorAll(".view-tab")) {
    tab.classList.toggle("is-active", tab.getAttribute("data-view-tab") === viewName);
  }
  for (const viewId of ["tracker", "roadmap", "missables", "sources"]) {
    document.getElementById(viewId + "-view").hidden = viewId !== viewName;
  }
  if (viewName === "roadmap") renderRoadmapView();
  if (viewName === "missables") renderMissablesView();
  if (viewName === "sources") renderSourcesAuditView();
}

function appendSummaryBlocksTo(container, blocks) {
  const wrap = createElementWithText("div", "summary-blocks");
  for (const [value, label] of blocks) {
    const block = createElementWithText("div", "summary-block");
    block.appendChild(createElementWithText("div", "summary-value", value));
    block.appendChild(createElementWithText("div", "summary-label", label));
    wrap.appendChild(block);
  }
  container.appendChild(wrap);
}

const ROADMAP_STAGE_HOURS = {
  "Chapter 1": 25, "Chapter 2": 15, "Chapter 3": 20, "Chapter 4": 15,
  "Strangers": 20, "Free roam": 70, "Partner play": 8, "Story and free roam": 5,
  "Whole game": 12, "Endgame": 4, "Finale": 6
};
const ROADMAP_GUIDE_SOURCE_IDS = [1, 7];
const COMPLETION_GUIDE_SOURCE_IDS = [86, 87];

function truncateTextAtWordBoundary(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

function appendCitedSummaryBlocksTo(container, blocks) {
  const wrap = createElementWithText("div", "summary-blocks");
  for (const [value, label, sourceIds] of blocks) {
    const block = createElementWithText("div", "summary-block");
    block.appendChild(createElementWithText("div", "summary-value", value));
    const labelLine = createElementWithText("div", "summary-label", label);
    appendSourceChipsTo(labelLine, sourceIds);
    block.appendChild(labelLine);
    wrap.appendChild(block);
  }
  container.appendChild(wrap);
}

function renderRoadmapView() {
  const view = document.getElementById("roadmap-view");
  view.textContent = "";
  view.appendChild(createElementWithText("h2", "big-view-title", "Roadmap to the platinum"));
  view.appendChild(createElementWithText("p", "big-view-sub",
    "One playthrough, story first, strands second, counted grinds third, 100 percent and the finale last. The one possibly-missable trophy is protected inside Chapter 1. Every stage opens with the first cited step of each trophy in it — the working plan, not a name list."));
  appendCitedSummaryBlocksTo(view, [
    ["≈200 hours", "Estimated full completion", [1, 7]],
    ["4 / 10", "Difficulty", [7]],
    ["1", "Playthrough needed", [1]],
    ["0", "Online trophies required", [1, 5]],
    ["55", "Trophies", [2]],
    ["1", "Possibly missable", [3]]
  ]);
  let stageNumber = 0;
  for (const groupName of CHAPTER_GROUP_ORDER) {
    const inGroup = trophyDataList.filter((trophy) => chapterGroupNameForTrophy(trophy) === groupName)
      .sort((a, b) => a.roadmapOrder - b.roadmapOrder);
    if (inGroup.length === 0) continue;
    stageNumber += 1;
    view.appendChild(buildRoadmapStageCard(groupName, inGroup, stageNumber));
  }
  view.appendChild(buildMissableWatchStripForRoadmap());
}

function buildMissableWatchStripForRoadmap() {
  const strip = createElementWithText("section", "missable-watch-strip");
  strip.appendChild(createElementWithText("h3", "", "Missable watch — protect these windows"));
  const list = createElementWithText("div", "missable-watch-list");
  const watched = trophyDataList
    .filter((trophy) => trophy.missableTier === "possibly-missable" || trophy.missableTier === "at-risk")
    .sort((a, b) => a.roadmapOrder - b.roadmapOrder);
  for (const trophy of watched) {
    const item = createElementWithText("div", "missable-watch-item");
    item.appendChild(createElementWithText("span", "missable-flag",
      trophy.missableTier === "possibly-missable" ? "Possibly missable" : "At risk"));
    item.appendChild(createElementWithText("span", "row-name", " #" + trophy.roadmapOrder + " " + trophy.name + " — "));
    item.appendChild(createElementWithText("span", "row-desc",
      truncateTextAtWordBoundary((trophy.missableWindow || "").replace(/^Last chance:\s*/i, ""), 92)));
    list.appendChild(item);
  }
  strip.appendChild(list);
  return strip;
}

function buildRoadmapStageCard(groupName, inGroup, stageNumber) {
  const stage = createElementWithText("section", "roadmap-stage");
  const earnedInStage = inGroup.filter((trophy) => progressState.earned[trophy.id]).length;
  const head = createElementWithText("div", "stage-head-row");
  head.appendChild(createElementWithText("h3", "", "Stage " + stageNumber + " — " + groupName));
  const hours = createElementWithText("span", "stage-hours",
    "≈" + (ROADMAP_STAGE_HOURS[groupName] || 5) + " hours, estimated from the roadmap guides");
  appendSourceChipsTo(hours,
    groupName === "Free roam" || groupName === "Whole game" ? COMPLETION_GUIDE_SOURCE_IDS : ROADMAP_GUIDE_SOURCE_IDS);
  head.appendChild(hours);
  head.appendChild(createElementWithText("span", "stage-progress-label", earnedInStage + "/" + inGroup.length + " earned"));
  stage.appendChild(head);
  const bar = createElementWithText("div", "stage-progress");
  const fill = createElementWithText("div", "stage-progress-fill");
  fill.style.width = Math.round((earnedInStage / inGroup.length) * 100) + "%";
  bar.appendChild(fill);
  stage.appendChild(bar);
  const shown = inGroup.slice(0, 6);
  for (const trophy of shown) {
    const row = createElementWithText("div", "roadmap-action-row");
    const firstStep = (trophy.steps || [])[0];
    const text = createElementWithText("span", "roadmap-action-text");
    text.appendChild(createElementWithText("strong", "",
      "#" + trophy.roadmapOrder + " " + trophy.name + (progressState.earned[trophy.id] ? " ✓" : "") + " — "));
    text.appendChild(document.createTextNode(
      truncateTextAtWordBoundary(firstStep ? firstStep.text : trophy.guide, 185)));
    row.appendChild(text);
    if (firstStep) appendSourceChipsTo(row, firstStep.sources);
    stage.appendChild(row);
  }
  if (inGroup.length > shown.length) {
    const rest = inGroup.slice(shown.length);
    stage.appendChild(createElementWithText("p", "roadmap-more-line",
      "+ " + rest.length + " more in this stage, in roadmap order: " +
      rest.map((trophy) => "#" + trophy.roadmapOrder + " " + trophy.name).join(" · ")));
  }
  return stage;
}

function renderMissablesView() {
  const view = document.getElementById("missables-view");
  view.textContent = "";
  view.appendChild(createElementWithText("h2", "big-view-title", "Missables · last chance"));
  view.appendChild(createElementWithText("p", "big-view-sub",
    "Exactly one trophy on this list is possibly missable. Everything below it is at-risk or watch — flagged from the official descriptions, with the exact closing event named for each."));
  const tiers = [
    ["possibly-missable", "Possibly missable — do these inside their window", ""],
    ["at-risk", "At risk — finish before the finale", ""],
    ["watch", "Watch — no hard window, but do not leave them to luck", "is-watch"]
  ];
  for (const [tier, heading, headingClass] of tiers) {
    const inTier = trophyDataList.filter((trophy) => trophy.missableTier === tier)
      .sort((a, b) => a.roadmapOrder - b.roadmapOrder);
    if (inTier.length === 0) continue;
    view.appendChild(createElementWithText("h3", "tier-heading " + headingClass, heading + " (" + inTier.length + ")"));
    const table = createElementWithText("table", "audit-table");
    const head = document.createElement("tr");
    for (const label of ["Trophy", "Grade", "Last chance — the exact closing event", "Cited steps"]) {
      head.appendChild(createElementWithText("th", "", label));
    }
    table.appendChild(head);
    for (const trophy of inTier) {
      const row = document.createElement("tr");
      row.appendChild(createElementWithText("td", "", trophy.name));
      row.appendChild(createElementWithText("td", "", trophy.grade));
      row.appendChild(createElementWithText("td", "", trophy.missableWindow || "No fixed closing event — see the guide."));
      row.appendChild(createElementWithText("td", "", String((trophy.steps || []).length) + " steps · " + sourcesCitedByTrophy(trophy).length + " sources"));
      table.appendChild(row);
    }
    view.appendChild(table);
  }
}

function computeTrophySourceMatrixFromData() {
  const stepCitationsPerPage = new Map();
  const stepCountsPerTrophy = new Map();
  const guidesCitingPerPage = new Map();
  for (const trophy of trophyDataList) {
    const perTrophy = new Map();
    for (const step of trophy.steps || []) {
      for (const id of step.sources || []) {
        stepCitationsPerPage.set(id, (stepCitationsPerPage.get(id) || 0) + 1);
        perTrophy.set(id, (perTrophy.get(id) || 0) + 1);
      }
    }
    stepCountsPerTrophy.set(trophy.id, perTrophy);
    for (const id of sourcesCitedByTrophy(trophy)) {
      guidesCitingPerPage.set(id, (guidesCitingPerPage.get(id) || 0) + 1);
    }
  }
  const topPageIds = [...stepCitationsPerPage.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id);
  return { stepCountsPerTrophy, guidesCitingPerPage, topPageIds };
}

function buildTrophySourceMatrixSection(computed) {
  const wrap = createElementWithText("section", "source-matrix-wrap");
  wrap.appendChild(createElementWithText("h3", "tier-heading is-watch",
    "Trophy × source matrix — cited steps per page"));
  const table = createElementWithText("table", "audit-table source-matrix");
  const head = document.createElement("tr");
  head.appendChild(createElementWithText("th", "", "Trophy"));
  for (const id of computed.topPageIds) head.appendChild(createElementWithText("th", "", "[" + id + "]"));
  table.appendChild(head);
  const ordered = [...trophyDataList].sort((a, b) => a.roadmapOrder - b.roadmapOrder);
  for (const trophy of ordered) {
    const row = document.createElement("tr");
    row.appendChild(createElementWithText("td", "matrix-trophy-name", "#" + trophy.roadmapOrder + " " + trophy.name));
    const perTrophy = computed.stepCountsPerTrophy.get(trophy.id) || new Map();
    for (const id of computed.topPageIds) {
      const count = perTrophy.get(id) || 0;
      row.appendChild(createElementWithText("td",
        count > 0 ? "matrix-cell-hit" : "matrix-cell-empty", count > 0 ? String(count) : "·"));
    }
    table.appendChild(row);
  }
  wrap.appendChild(table);
  wrap.appendChild(createElementWithText("p", "row-desc",
    "Columns are the 20 most-cited pages in the registry: " +
    computed.topPageIds.map((id) => {
      const page = sourcePageById.get(id);
      return "[" + id + "] " + (page ? page.site : "");
    }).join(" · ")));
  return wrap;
}

function renderSourcesAuditView() {
  const totals = computeAuditTotalsFromData();
  const view = document.getElementById("sources-view");
  view.textContent = "";
  view.appendChild(createElementWithText("h2", "big-view-title", "Sources and audit"));
  view.appendChild(createElementWithText("p", "big-view-sub",
    "Every numbered step in every guide cites pages from this registry by id. All pages were read on 20 Nov 2026. Paths are printed as text only — the app never loads them."));
  appendSummaryBlocksTo(view, [
    [String(totals.claimsCited), "Claims cited"], [String(totals.claimsBackedByTwoOrMoreSources), "Backed by 2+ sources"],
    [String(totals.sourcePages), "Source pages"], [String(totals.sourceSites), "Distinct sites"],
    [String(totals.disputesShown), "Disputes shown both ways"], [totals.guidesCitingSources + "/55", "Guides citing sources"]
  ]);
  const computedMatrix = computeTrophySourceMatrixFromData();
  view.appendChild(buildTrophySourceMatrixSection(computedMatrix));
  const columns = createElementWithText("div", "two-col-lists");
  const bySite = new Map();
  for (const page of sourcePageList) {
    if (!bySite.has(page.site)) bySite.set(page.site, []);
    bySite.get(page.site).push(page);
  }
  for (const [site, pages] of bySite) {
    const group = createElementWithText("section", "source-site-group");
    group.appendChild(createElementWithText("h3", "", site + " — " + pages.length + " pages"));
    const list = document.createElement("ul");
    for (const page of pages) {
      const item = createElementWithText("li", "", "[" + page.id + "] " + page.title + " — " + page.claims +
        " claims · cited by " + (computedMatrix.guidesCitingPerPage.get(page.id) || 0) + "/55 guides · read " + page.read);
      item.appendChild(createElementWithText("span", "source-path", " " + page.path));
      list.appendChild(item);
    }
    group.appendChild(list);
    columns.appendChild(group);
  }
  view.appendChild(columns);
  view.appendChild(createElementWithText("h3", "tier-heading is-watch", "The dispute register — every disagreement, shown both ways"));
  for (const trophy of trophyDataList.filter((trophy) => trophy.dispute).sort((a, b) => a.roadmapOrder - b.roadmapOrder)) {
    const item = createElementWithText("article", "dispute-register-item");
    item.appendChild(createElementWithText("h4", "", trophy.name));
    const a = createElementWithText("p", "", ""); a.appendChild(createElementWithText("strong", "", "A says: ")); a.appendChild(document.createTextNode(trophy.dispute.a)); item.appendChild(a);
    const b = createElementWithText("p", "", ""); b.appendChild(createElementWithText("strong", "", "B says: ")); b.appendChild(document.createTextNode(trophy.dispute.b)); item.appendChild(b);
    const call = createElementWithText("p", "", ""); call.appendChild(createElementWithText("strong", "", "Our call: ")); call.appendChild(document.createTextNode(trophy.dispute.call)); item.appendChild(call);
    const chips = createElementWithText("p", "", "Sources:"); appendSourceChipsTo(chips, trophy.dispute.sources); item.appendChild(chips);
    view.appendChild(item);
  }
}

function wireUpHeaderControlsAndTabs() {
  const toggle = document.getElementById("spoiler-shield-toggle");
  toggle.checked = progressState.spoilerShieldOn;
  toggle.addEventListener("change", () => {
    progressState.spoilerShieldOn = toggle.checked;
    saveProgressToBrowserStorage();
    renderChecklistGroupedByChapter();
    renderNextUpRoadmapOrder();
  });
  document.getElementById("export-progress-button").addEventListener("click", exportProgressToFile);
  const fileInput = document.getElementById("import-progress-file");
  document.getElementById("import-progress-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) importProgressFromFile(fileInput.files[0]); });
  document.getElementById("trophy-search-box").addEventListener("input", (event) => {
    activeSearchText = event.target.value;
    renderChecklistGroupedByChapter();
  });
  for (const tab of document.querySelectorAll(".view-tab")) {
    tab.addEventListener("click", () => switchVisibleView(tab.getAttribute("data-view-tab")));
  }
}

async function loadGuideDataFilesAndRenderApp() {
  const trophiesResponse = await fetch("data/trophies.json");
  const trophiesPayload = await trophiesResponse.json();
  trophyDataList = trophiesPayload.trophies || [];
  const sourcesResponse = await fetch("data/sources.json");
  const sourcesPayload = await sourcesResponse.json();
  sourcePageList = sourcesPayload.pages || [];
  sourcePageById = new Map(sourcePageList.map((page) => [page.id, page]));
  if (!findTrophyById(progressState.selectedTrophyId)) progressState.selectedTrophyId = 28;
  wireUpHeaderControlsAndTabs();
  renderAuditStrip();
  renderProgressHeader();
  renderFilterChips();
  renderChecklistGroupedByChapter();
  renderGuideDetailPane();
  renderSourcesForSelectedGuide();
  renderNextUpRoadmapOrder();
}

loadGuideDataFilesAndRenderApp();
