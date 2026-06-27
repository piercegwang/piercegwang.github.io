(function () {
  function colorFor0to10(v) {
    const hue = (v / 10) * 120; // red -> green
    return `hsl(${hue}, 75%, 52%)`;
  }

  function applyHeatmap(table) {
    table.querySelectorAll("td, th").forEach((cell) => {
      const raw = cell.textContent.trim();
      if (raw === "") return;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > 10) return;
      cell.style.backgroundColor = colorFor0to10(v);
      cell.style.color = v >= 6 ? "#111" : "#fff";
      cell.style.fontWeight = "600";
    });
  }

  function clearHover(table) {
    table.querySelectorAll(".hm-hover").forEach((el) => el.classList.remove("hm-hover"));
  }

  function addHoverBehavior(table) {
    const rows = Array.from(table.rows);

    table.addEventListener("mouseover", (e) => {
      const cell = e.target.closest("td, th");
      if (!cell || !table.contains(cell)) return;

      clearHover(table);

      const row = cell.parentElement;
      const colIndex = cell.cellIndex;

      // highlight row
      row.querySelectorAll("td, th").forEach((c) => c.classList.add("hm-hover"));

      // highlight column
      rows.forEach((r) => {
        const c = r.cells[colIndex];
        if (c) c.classList.add("hm-hover");
      });
    });

    table.addEventListener("mouseleave", () => clearHover(table));
  }

  function init() {
    const tables = document.querySelectorAll("table.heatmap-0-10");
    tables.forEach((table) => {
      applyHeatmap(table);
      addHoverBehavior(table);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
