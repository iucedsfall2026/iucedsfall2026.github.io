/* Home page: same-scale map and one summary block per Nation. */
(function () {
  const { NATIONS, fmt, acs, loadData, loadBoundaries, showError } = window.CEDS;

  loadBoundaries().then((b) => {
    window.CEDSMaps.sameScale("#scale-map", b);
    const km = (n) => d3.sum(b.tribal.features.filter((f) => f.properties.nation === n), (f) => f.properties.land_km2);
    const ratio = km("Cherokee") / km("White Earth");
    document.querySelector("#scale-caption").textContent =
      `Drawn at the same scale. The Cherokee OTSA covers about ${ratio.toFixed(1)} times the land area of the White Earth Reservation and trust land.`;
  }).catch((e) => showError("#scale-map", e));

  const FOCUS = {
    "Cherokee": "Featured question: where regional construction growth happened, and what a battery storage system would need to deliver for critical services.",
    "White Earth": "Featured question: what sits behind a high housing vacancy rate, and how housing options compare on cost for the same service.",
  };

  loadData().then((data) => {
    const Y = d3.max(data.acs, (r) => r.year);
    const period = acs(data, "Cherokee", "population", Y).period;
    document.querySelectorAll("[data-period]").forEach((n) => (n.textContent = period.replace("-", "–")));
    document.querySelector("#nation-entries").innerHTML = ["Cherokee", "White Earth"].map((n) => {
      const N = NATIONS[n];
      const get = (id) => acs(data, n, id, Y);
      const stats = [
        [fmt.int(get("population").value), "residents in the Census area"],
        [fmt.usd(get("income").value), "median household income"],
        [fmt.pct(get("poverty").value), "below the poverty line"],
        [fmt.pct(get("vacancy").value), "of homes vacant"],
      ];
      return `<article class="nation-entry" style="--c:${N.color};--ct:${N.text}">
        <h2><a href="${N.slug}/">${N.name}</a></h2>
        <p class="geo-note" style="margin:0">${N.geography}</p>
        <div class="stats">${stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <p>${FOCUS[n]}</p>
        <p><a href="${N.slug}/">Open the ${N.name} dashboard</a></p>
      </article>`;
    }).join("");
  }).catch((e) => showError("#nation-entries", e));
})();
