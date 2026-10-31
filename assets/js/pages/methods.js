/* Data and methods: crosswalk table and data stamp. */
(function () {
  const { NATIONS, loadData, esc, showError } = window.CEDS;
  loadData().then((data) => {
    const rows = data.crosswalk.slice().sort((a, b) => a.nation.localeCompare(b.nation) || b.type.localeCompare(a.type) || a.name.localeCompare(b.name));
    document.querySelector("#xwalk tbody").innerHTML = rows.map((r) =>
      `<tr><td>${esc(NATIONS[r.nation] ? NATIONS[r.nation].name : r.nation)}</td><td>${esc(r.name)}${r.type === "Reference county" ? " County" : ""}</td><td>${esc(r.type)}</td><td>${esc(r.relationship)}</td></tr>`).join("");
    document.querySelector("#data-stamp").textContent =
      `Current data: ${data.meta.pipeline_release}, exported ${data.meta.generated_utc.replace("T", " ").replace("Z", " UTC")}. Fingerprint ${data.meta.sha256}.`;
  }).catch((e) => showError("#xwalk", e));
})();
