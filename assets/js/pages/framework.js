/* Planning framework: decision chain, SWOT, actions and KPIs per Nation. */
(function () {
  const { NATIONS, fmt, loadData, esc, showError } = window.CEDS;

  const STAGES = [
    ["question", "Decision question"], ["interpretation", "What the evidence shows"], ["constraint", "What limits the evidence"],
    ["alternatives", "Options to compare"], ["evaluation", "How to judge the options"], ["action", "Proposed next step"],
    ["validation", "What must be confirmed first"],
  ];
  const SWOT_ORDER = ["Strength", "Weakness", "Opportunity", "Threat"];

  loadData().then((data) => {
    const F = data.framework;
    const pick = () => (decodeURIComponent(location.hash.slice(1)).replace("-", " ") === "White Earth" ? "White Earth" : "Cherokee");

    function render() {
      const n = pick();
      const N = NATIONS[n];
      document.body.dataset.nation = n;
      document.querySelectorAll("#fw-switch a").forEach((a) => (a.dataset.n === n ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));

      const chain = F.chain.filter((c) => c.nation === n);
      document.querySelector("#chain-id").textContent = `${N.name}, case ${chain[0] ? chain[0].case_id : ""}. ${chain[0] ? chain[0].status : ""}.`;
      document.querySelector("#chain").innerHTML = STAGES.map(([id, label]) => {
        const c = chain.find((x) => x.stage === id);
        return c ? `<li><h3>${label}</h3><p>${esc(c.statement)}</p></li>` : "";
      }).join("");

      const sw = F.swot.filter((s) => s.nation === n);
      document.querySelector("#swot").innerHTML = SWOT_ORDER.map((cat) => {
        const items = sw.filter((s) => s.category.startsWith(cat));
        return `<div><h3>${cat}</h3>${items.length ? items.map((s) => `
          <p>${esc(s.statement)} ${(() => { const q = s.category.replace(cat, "").replace(/[()]/g, "").trim(); return q ? `<span class="tag">${esc(q)}</span>` : ""; })()}</p>
          <p class="evidence">${esc(s.evidence)}</p>
          <p class="limit">Limit: ${esc(s.limit)}. Next: ${esc(s.next)}</p>`).join("") : '<p class="limit">None recorded.</p>'}</div>`;
      }).join("");

      document.querySelector("#actions tbody").innerHTML = F.actions.filter((a) => a.nation === n).map((a) => `
        <tr><td><strong>${esc(a.objective)}</strong><br><span class="tag">${esc(a.id)}</span></td><td>${esc(a.evidence)}</td>
        <td>${esc(a.action)}</td><td>${esc(a.validation)}</td><td>${esc(a.approval)}</td></tr>`).join("");

      document.querySelector("#kpis tbody").innerHTML = F.kpis.filter((k) => k.nation === n).map((k) => {
        const base = k.baseline == null ? "Not yet available" : k.unit === "share" ? fmt.pct(k.baseline) : `${fmt.int(k.baseline)} ${esc(k.unit)}`;
        return `<tr><td>${esc(k.kpi)}<br><span class="tag">${esc(k.action_id)}</span></td><td class="num">${base}</td>
          <td>${esc(k.method)}</td><td>${esc(k.frequency)}</td><td>${esc(k.target)}</td></tr>`;
      }).join("");
    }

    document.querySelectorAll("#fw-switch a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      history.replaceState(null, "", "#" + a.dataset.n.replace(" ", "-"));
      render();
    }));
    window.addEventListener("hashchange", render);
    render();
  }).catch((e) => showError("#main", e));
})();
