/**
 * Caprice selection + coverage summary
 * ------------------------------------
 * Loads caprices.json, renders the technique heatmap, and lets you build a
 * practice set. Selected rows are mirrored into #coverage-sum with a teal Sum
 * row (full dark at SUM_FULL_AT; all selected → black / white text). Selection
 * persists in localStorage. Column widths and horizontal scroll stay locked
 * between the two tables.
 */
(function () {
  "use strict";

  const DATA_URL = "caprices.json";
  const STORAGE_KEY = "paganini-technique-selection";
  /** Sum-row teal ramp reaches full darkness at this value (and above). */
  const SUM_FULL_AT = 10;
  const TABLE_MIN_WIDTH = "64rem";

  // ── Color helpers ────────────────────────────────────────────────────

  /** Red → green intensity scale for individual scores (0–10). */
  function colorFor0to10(v) {
    return `hsl(${(v / 10) * 120}, 75%, 52%)`;
  }

  /** Teal ramp for sum cells; t is 0..1. Matches page accent (~#1f4f55). */
  function colorForSum(t) {
    return `hsl(186, ${28 + t * 28}%, ${90 - t * 62}%)`;
  }

  function clearPaint(cell) {
    cell.textContent = "—";
    cell.classList.add("empty");
    cell.style.backgroundColor = "";
    cell.style.color = "";
    cell.style.fontWeight = "";
  }

  function paintIntensityCell(cell, value) {
    if (value == null || !Number.isFinite(value)) {
      clearPaint(cell);
      return;
    }
    cell.classList.remove("empty");
    cell.textContent = String(value);
    cell.style.backgroundColor = colorFor0to10(value);
    cell.style.color = value >= 6 ? "#111" : "#fff";
    cell.style.fontWeight = "600";
  }

  /** Sum cell. All-selected easter egg: black fill, white numbers. */
  function paintSumCell(cell, value, allSelected) {
    if (value == null || !Number.isFinite(value)) {
      clearPaint(cell);
      return;
    }
    cell.classList.remove("empty");
    cell.textContent = String(value);
    cell.style.fontWeight = "700";

    if (allSelected) {
      cell.style.backgroundColor = "#000";
      cell.style.color = "#fff";
      return;
    }

    const t = Math.max(0, Math.min(1, value / SUM_FULL_AT));
    cell.style.backgroundColor = colorForSum(t);
    cell.style.color = t >= 0.55 ? "#fff" : "#111";
  }

  // ── DOM helpers ──────────────────────────────────────────────────────

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function appendCells(row, values, className, asHeader) {
    const tag = asHeader ? "th" : "td";
    values.forEach((value) => {
      const cell = el(tag, className, value == null || value === "" ? "\u00a0" : value);
      if (asHeader) cell.scope = "col";
      row.appendChild(cell);
    });
  }

  // ── Data load + main table render ────────────────────────────────────

  async function loadData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_URL} (${response.status})`);
    }
    return response.json();
  }

  function renderTechniqueTable(table, data) {
    const thead = table.tHead || table.createTHead();
    const capriceBody = table.querySelector("tbody.caprice-rows");
    const totalsBody = table.querySelector("tbody.totals-row");
    thead.replaceChildren();
    capriceBody.replaceChildren();
    totalsBody.replaceChildren();

    const meta = data.metaColumns;
    const techniques = data.techniques;

    const labelRow = document.createElement("tr");
    appendCells(labelRow, meta.map((c) => c.label), "org-left", true);
    appendCells(labelRow, techniques.map((t) => t.label), "org-right", true);
    thead.appendChild(labelRow);

    const subRow = document.createElement("tr");
    appendCells(subRow, meta.map(() => ""), "org-left", true);
    appendCells(subRow, techniques.map((t) => t.sublabel || ""), "org-right", true);
    thead.appendChild(subRow);

    data.caprices.forEach((caprice) => {
      const tr = document.createElement("tr");
      tr.dataset.capriceId = caprice.id;
      tr.tabIndex = 0;
      tr.setAttribute("aria-selected", "false");

      tr.appendChild(el("td", "org-left", caprice.id));
      tr.appendChild(el("td", "org-left", caprice.key));
      tr.appendChild(el("td", "org-left", caprice.time));

      caprice.scores.forEach((score) => {
        const td = el("td", "org-right");
        paintIntensityCell(td, score);
        tr.appendChild(td);
      });

      capriceBody.appendChild(tr);
    });

    const totals = document.createElement("tr");
    totals.appendChild(el("td", "org-left", "Total Time:"));
    totals.appendChild(el("td", "org-left", "\u00a0"));
    totals.appendChild(el("td", "org-left", data.totalTime));
    techniques.forEach(() => totals.appendChild(el("td", "org-right", "\u00a0")));
    totalsBody.appendChild(totals);

    return {
      metaCount: meta.length,
      techniqueCount: techniques.length,
      colCount: meta.length + techniques.length,
      capriceById: new Map(data.caprices.map((c) => [c.id, c])),
      capriceRows: Array.from(capriceBody.rows),
    };
  }

  // ── Selection + coverage UI ──────────────────────────────────────────

  function initApp(data) {
    const table = document.getElementById("technique-table");
    const coverageTable = document.getElementById("coverage-sum");
    const coverageHead = document.getElementById("coverage-head");
    const coverageBody = document.getElementById("coverage-body");
    const coverageSummary = document.getElementById("coverage-summary");
    const coverageCount = document.getElementById("coverage-count");
    const selectAllBtn = document.getElementById("select-all-caprices");
    const clearBtn = document.getElementById("clear-caprice-selection");
    const coverageScroll = document.querySelector(".coverage-scroll");
    const tableScroll = document.querySelector(".table-scroll");

    if (
      !table || !coverageTable || !coverageHead || !coverageBody ||
      !coverageSummary || !coverageCount || !selectAllBtn || !clearBtn
    ) {
      return;
    }

    const {
      metaCount,
      techniqueCount,
      colCount,
      capriceById,
      capriceRows,
    } = renderTechniqueTable(table, data);

    // Mirror headers into the coverage table
    Array.from(table.tHead.rows).forEach((srcRow) => {
      const tr = document.createElement("tr");
      Array.from(srcRow.cells).forEach((srcCell) => {
        const th = el("th", srcCell.className);
        th.scope = "col";
        th.innerHTML = srcCell.innerHTML;
        tr.appendChild(th);
      });
      coverageHead.appendChild(tr);
    });

    const summaryRow = document.createElement("tr");
    const labelCell = el("td", "label org-left", "Sum");
    labelCell.colSpan = metaCount;
    summaryRow.appendChild(labelCell);

    const sumCells = [];
    for (let i = 0; i < techniqueCount; i++) {
      const td = el("td", "org-right empty", "—");
      summaryRow.appendChild(td);
      sumCells.push(td);
    }
    coverageSummary.appendChild(summaryRow);

    // ── Persistence ────────────────────────────────────────────────────
    function loadSelection() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch (_) {
        return new Set();
      }
    }

    function saveSelection(ids) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch (_) {
        /* private mode / quota — in-memory selection still works */
      }
    }

    function selectedRows() {
      return capriceRows.filter((row) => row.classList.contains("is-selected"));
    }

    function selectedCaprices() {
      return selectedRows()
        .map((row) => capriceById.get(row.dataset.capriceId))
        .filter(Boolean);
    }

    function setSelected(row, on) {
      row.classList.toggle("is-selected", on);
      row.setAttribute("aria-selected", on ? "true" : "false");
    }

    function persistAndRefresh() {
      saveSelection(selectedRows().map((row) => row.dataset.capriceId));
      updateCoverage();
    }

    function toggleRow(row) {
      setSelected(row, !row.classList.contains("is-selected"));
      persistAndRefresh();
    }

    // ── Coverage rendering (from data model, not DOM scraping) ─────────
    function copySelectedRow(caprice) {
      const tr = document.createElement("tr");
      tr.dataset.capriceId = caprice.id;
      tr.title = "Click to deselect";

      tr.appendChild(el("td", "org-left", caprice.id));
      tr.appendChild(el("td", "org-left", caprice.key));
      tr.appendChild(el("td", "org-left", caprice.time));
      caprice.scores.forEach((score) => {
        const td = el("td", "org-right");
        paintIntensityCell(td, score);
        tr.appendChild(td);
      });
      return tr;
    }

    function updateCoverage() {
      const selected = selectedCaprices();
      const n = selected.length;
      coverageCount.textContent =
        n === 1 ? "1 caprice selected" : n + " caprices selected";

      coverageBody.replaceChildren();

      if (n === 0) {
        const empty = document.createElement("tr");
        empty.className = "coverage-empty";
        const td = el("td", null, "Select caprices above to build a coverage set.");
        td.colSpan = colCount;
        empty.appendChild(td);
        coverageBody.appendChild(empty);
        sumCells.forEach((cell) => paintSumCell(cell, null, false));
        return;
      }

      selected.forEach((caprice) => {
        coverageBody.appendChild(copySelectedRow(caprice));
      });

      const allSelected = n === capriceRows.length;
      for (let col = 0; col < techniqueCount; col++) {
        const sum = selected.reduce((acc, c) => acc + c.scores[col], 0);
        paintSumCell(sumCells[col], sum, allSelected);
      }
    }

    // ── Column / scroll alignment ──────────────────────────────────────
    function linkScroll(from, to) {
      let syncing = false;
      from.addEventListener("scroll", () => {
        if (syncing) return;
        syncing = true;
        to.scrollLeft = from.scrollLeft;
        syncing = false;
      });
    }

    if (coverageScroll && tableScroll) {
      linkScroll(coverageScroll, tableScroll);
      linkScroll(tableScroll, coverageScroll);
    }

    /** Measure main-table columns, then lock both tables to those widths. */
    function syncColumnWidths() {
      if (!coverageTable.tHead || !table.tHead) return;

      [table, coverageTable].forEach((tbl) => {
        tbl.style.tableLayout = "auto";
        tbl.style.width = "100%";
        tbl.style.minWidth = TABLE_MIN_WIDTH;
        tbl.querySelectorAll("colgroup").forEach((cg) => cg.remove());
      });

      void table.offsetWidth;

      const widths = Array.from(table.tHead.rows[0].cells).map(
        (cell) => cell.getBoundingClientRect().width
      );
      const total = widths.reduce((sum, w) => sum + w, 0);
      if (total <= 0) return;

      [table, coverageTable].forEach((tbl) => {
        const cg = document.createElement("colgroup");
        widths.forEach((w) => {
          const col = document.createElement("col");
          col.style.width = w + "px";
          cg.appendChild(col);
        });
        tbl.insertBefore(cg, tbl.firstChild);
        tbl.style.width = total + "px";
        tbl.style.minWidth = total + "px";
        tbl.style.tableLayout = "fixed";
      });
    }

    // ── Interactions ───────────────────────────────────────────────────
    const rowsBody = table.querySelector("tbody.caprice-rows");
    const saved = loadSelection();
    capriceRows.forEach((row) => {
      if (saved.has(row.dataset.capriceId)) setSelected(row, true);
    });

    rowsBody.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      if (row && rowsBody.contains(row)) toggleRow(row);
    });

    rowsBody.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      const row = e.target.closest("tr");
      if (!row || !rowsBody.contains(row)) return;
      e.preventDefault();
      toggleRow(row);
    });

    coverageBody.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      if (!row || !coverageBody.contains(row) || row.classList.contains("coverage-empty")) {
        return;
      }
      const match = capriceRows.find((r) => r.dataset.capriceId === row.dataset.capriceId);
      if (!match) return;
      setSelected(match, false);
      persistAndRefresh();
    });

    selectAllBtn.addEventListener("click", () => {
      capriceRows.forEach((row) => setSelected(row, true));
      persistAndRefresh();
    });

    clearBtn.addEventListener("click", () => {
      capriceRows.forEach((row) => setSelected(row, false));
      persistAndRefresh();
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(syncColumnWidths, 100);
    });

    updateCoverage();
    requestAnimationFrame(syncColumnWidths);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncColumnWidths);
    }
  }

  function showLoadError(err) {
    const body = document.querySelector("#technique-table tbody.caprice-rows");
    if (!body) return;
    const tr = document.createElement("tr");
    const td = el("td", null, `Could not load caprice data: ${err.message}`);
    td.colSpan = 20;
    td.style.textAlign = "left";
    td.style.padding = "1rem";
    tr.appendChild(td);
    body.replaceChildren(tr);
    console.error(err);
  }

  async function boot() {
    try {
      const data = await loadData();
      initApp(data);
    } catch (err) {
      showLoadError(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
