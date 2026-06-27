(function () {
  function colorFor0to10(v) {
    // 0=red, 10=green
    const hue = (v / 10) * 120;
    return `hsl(${hue}, 75%, 55%)`;
  }

  function applyHeatmap() {
    const tables = document.querySelectorAll("table.heatmap-0-10");
    tables.forEach((table) => {
      table.querySelectorAll("td, th").forEach((cell) => {
        const raw = cell.textContent.trim();
        if (!raw) return;
        const v = Number(raw);
        if (!Number.isFinite(v) || v < 0 || v > 10) return;

        cell.style.backgroundColor = colorFor0to10(v);
        cell.style.color = v >= 6 ? "#111" : "#fff";
        cell.style.fontWeight = "600";
      });
    });
  }

  // robust for normal load + dynamic toggles
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyHeatmap);
  } else {
    applyHeatmap();
  }
})();
