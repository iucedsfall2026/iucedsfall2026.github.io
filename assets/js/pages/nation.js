/* Nation pages (Cherokee and White Earth share this file).
   Every number is read from data/ceds-data.json at load time. */
(function () {
  const { NATIONS, fmt, acs, loadData, loadBoundaries, esc, showError } = window.CEDS;
  const C = window.CEDSCharts;
  const nation = document.body.dataset.nation;
  const N = NATIONS[nation];
  const other = nation === "Cherokee" ? "White Earth" : "Cherokee";
  const GREY = "#9aa8a6";

  const TREND_IDS = [
    ["poverty", "Poverty"], ["labor_participation", "Labor force participation"], ["employment_population", "Employed share"],
    ["income", "Median household income"], ["bachelors", "Bachelor's degree or higher"], ["broadband", "Broadband subscription"],
    ["vacancy", "Housing vacancy"], ["renter_burden", "Renter cost burden"], ["owner_burden", "Owner cost burden"], ["population", "Population"],
  ];

  loadData().then((data) => {
    const Y = d3.max(data.acs, (r) => r.year);
    const latest = (id) => acs(data, nation, id, Y);
    const period = latest("population").period;
    renderFigures(data, latest, period);
    renderTrends(data);
    renderHousing(data, Y, latest, period);
    renderEconomy(data);
    if (nation === "Cherokee") renderCherokeeFeature(data);
    else renderWhiteEarthFeature(data, latest, period);
    document.querySelectorAll("[data-period]").forEach((n) => (n.textContent = period.replace("-", "–")));
  }).catch((e) => showError("#main", e));

  loadBoundaries().then((b) => {
    window.CEDSMaps.nationMap("#map-chart", b, nation);
  }).catch((e) => showError("#map-chart", e));

  /* ---------- key figures ---------- */
  function renderFigures(data, latest, period) {
    const items = [
      ["population", "Residents"], ["income", "Median household income"], ["poverty", "Below poverty line"],
      ["labor_participation", "Labor force participation"], ["renter_burden", "Renters paying 30%+ of income"], ["broadband", "Households with broadband"],
    ];
    document.querySelector("#figures").innerHTML = items.map(([id, label]) => {
      const r = latest(id);
      return `<div><div class="value">${fmt.acsValue(r)}</div><div class="label">${label}</div><div class="moe">${fmt.acsMoe(r)} (90% MOE), ${period.replace("-", "–")}</div></div>`;
    }).join("");
  }

  /* ---------- trends ---------- */
  function renderTrends(data) {
    const seg = document.querySelector("#trend-seg");
    const compare = document.querySelector("#trend-compare");
    let current = "poverty";
    seg.innerHTML = TREND_IDS.map(([id, l]) => `<button type="button" data-id="${id}" aria-pressed="${id === current}">${l}</button>`).join("");
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      current = b.dataset.id;
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    });
    compare.addEventListener("change", draw);

    function draw() {
      const rows = acs(data, nation, current);
      const unit = rows[0].unit;
      const isShare = unit === "share";
      const yFormat = isShare ? (v) => (v * 100).toFixed(0) + "%" : unit.includes("USD") ? (v) => "$" + d3.format("~s")(v) : d3.format("~s");
      const toVals = (rs) => rs.map((r) => ({ x: r.year, y: r.value, lo: r.lo, hi: r.hi, row: r }));
      const series = [{ name: N.name, color: N.color, values: toVals(rows) }];
      const canCompare = current !== "population";
      compare.disabled = !canCompare;
      if (canCompare && compare.checked) series.push({ name: NATIONS[other].name, color: NATIONS[other].color, dash: "5 4", values: toVals(acs(data, other, current)) });
      const label = TREND_IDS.find((t) => t[0] === current)[1];
      document.querySelector("#trend-title").textContent = label;
      const def = data.indicators.find((i) => i.indicator_id === current);
      document.querySelector("#trend-def").textContent = def ? `${def.definition}. ${def.universe}.` : "";
      const node = document.querySelector("#trend-chart");
      node.innerHTML = "";
      const fresh = node.cloneNode(false); node.replaceWith(fresh);
      C.line(fresh, {
        series, yFormat, height: 300, label: `${label} over time, ${N.name}`,
        xFormat: (yr) => { const r = rows.find((x) => x.year === yr); return r ? r.period.replace("-20", "–") : yr; },
        xFormatNarrow: (yr) => "’" + String(yr).slice(2),
        marginLeft: unit.includes("USD") || unit === "people" ? 60 : 48,
        tip: (d, s) => `<strong>${s.name}</strong><br>${d.row.period.replace("-", "–")}: ${fmt.acsValue(d.row)}<br>90% range ${isShare ? fmt.pct(d.lo) + " to " + fmt.pct(d.hi) : unit.includes("USD") ? fmt.usd(d.lo) + " to " + fmt.usd(d.hi) : fmt.int(d.lo) + " to " + fmt.int(d.hi)}`,
      });
      C.legend("#trend-legend", series.map((s) => ({ label: s.name + (s.dash ? " (comparison)" : ""), color: s.color })));
    }
    draw();
  }

  /* ---------- housing ---------- */
  function renderHousing(data, Y, latest, period) {
    const vac = data.vacancy.filter((r) => r.nation === nation && r.year === Y).sort((a, b) => b.units - a.units);
    const total = d3.sum(vac, (r) => r.units);
    C.barH("#vacancy-chart", {
      label: `Vacant housing units by reason, ${N.name}`, labelWidth: 160, format: fmt.int,
      data: vac.map((r) => ({
        label: r.category, value: r.units, lo: Math.max(0, r.units - r.moe), hi: r.units + r.moe,
        color: r.category.startsWith("Seasonal") ? N.color : GREY,
        tip: `<strong>${esc(r.category)}</strong><br>${fmt.int(r.units)} units ±${fmt.int(r.moe)}<br>${fmt.pct(r.units / total)} of vacant units`,
      })),
    });
    document.querySelector("#vacancy-sub").textContent = `${fmt.int(total)} vacant units in ${period.replace("-", "–")}; housing vacancy rate ${fmt.pct(latest("vacancy").value)} ${fmt.acsMoe(latest("vacancy"))}.`;

    const age = data.housing_age.filter((r) => r.nation === nation);
    const ageTotal = d3.sum(age, (r) => r.units);
    C.barH("#age-chart", {
      label: `Housing units by year built, ${N.name}`, labelWidth: 150, format: fmt.int, rowHeight: 24,
      data: age.map((r) => ({ label: r.label.replace("Built ", ""), value: r.units, color: N.color,
        tip: `<strong>${esc(r.label)}</strong><br>${fmt.int(r.units)} units ±${fmt.int(r.moe)}<br>${fmt.pct(r.units / ageTotal)} of all units` })),
    });
    const pre1980 = d3.sum(age.filter((r) => /19[0-7]\d|1939/.test(r.label) && !/1980|1990/.test(r.label)), (r) => r.units);
    document.querySelector("#age-sub").textContent = `${fmt.pct(pre1980 / ageTotal)} of ${fmt.int(ageTotal)} housing units were built before 1980.`;

    const burden = [["renter_burden", "Renters paying 30%+"], ["renter_severe", "Renters paying 50%+"], ["owner_burden", "Owners paying 30%+"]];
    C.barH("#burden-chart", {
      label: `Housing cost burden, ${N.name}`, labelWidth: 150, format: (v) => fmt.pct(v), axisFormat: (v) => (v * 100).toFixed(0) + "%",
      data: burden.map(([id, l]) => { const r = latest(id); return { label: l, value: r.value, lo: r.lo, hi: r.hi, color: N.color,
        tip: `<strong>${l}</strong><br>${fmt.pct(r.value)} ${fmt.pp(r.moe)}<br>${fmt.int(r.numerator)} of ${fmt.int(r.denominator)} households with a computable ratio` }; }),
    });
  }

  /* ---------- regional economy ---------- */
  function renderEconomy(data) {
    const ind = data.industry.filter((r) => r.nation === nation && r.source === "CBP").sort((a, b) => b.pct - a.pct);
    const y0 = ind[0].start_year, y1 = ind[0].end_year;
    document.querySelector("#industry-sub").textContent = `Percent change in business establishments, ${y0} to ${y1}, across the ${N.counties} reference counties.`;
    C.barH("#industry-chart", {
      label: `Change in establishments by industry, ${N.name} region`, labelWidth: 190, format: (v) => fmt.signedPct(v), axisFormat: (v) => v + "%",
      data: ind.map((r) => ({ label: r.industry, value: r.pct, color: r.pct >= 0 ? N.color : GREY,
        tip: `<strong>${esc(r.industry)}</strong> (NAICS ${r.naics})<br>${fmt.int(r.start)} establishments in ${r.start_year}, ${fmt.int(r.end)} in ${r.end_year}<br>${fmt.signedInt(r.change)} (${fmt.signedPct(r.pct)})` })),
    });

    const reg = data.regional.filter((r) => r.nation === nation);
    C.line("#jobs-chart", {
      label: `Covered jobs in the ${N.name} reference counties`, height: 240, band: false, marginLeft: 52,
      yFormat: d3.format("~s"),
      series: [{ name: "Jobs (QCEW, all ownerships)", color: N.color, values: reg.map((r) => ({ x: r.year, y: r.qcew_jobs })) }],
      tip: (d) => `${d.x}: ${fmt.int(d.y)} jobs`,
    });
    const lab = data.labor.filter((r) => r.nation === nation);
    C.line("#unemp-chart", {
      label: `Unemployment rate in the ${N.name} reference counties`, height: 240, band: false, zero: true, marginLeft: 44,
      yFormat: (v) => v + "%",
      series: [{ name: "Unemployment rate (LAUS)", color: N.color, values: lab.map((r) => ({ x: r.year, y: r.unemployment_rate })) }],
      tip: (d) => `${d.x}: ${d.y.toFixed(1)}% unemployed`,
    });
    const lastLodes = lab.filter((r) => r.resident_jobs != null).pop();
    document.querySelector("#commute-year").textContent = lastLodes.year;
    document.querySelector("#commute-table tbody").innerHTML = [
      ["Jobs held by people living in the counties", lastLodes.resident_jobs],
      ["Jobs located in the counties", lastLodes.workplace_jobs],
      ["Jobs where home and work are in the same county", lastLodes.same_county_jobs],
      [`Jobs held by residents but located elsewhere in ${N.state}`, lastLodes.outbound_jobs],
      [`Jobs located here but held by residents of elsewhere in ${N.state}`, lastLodes.inbound_jobs],
    ].map(([l, v]) => `<tr><td>${l}</td><td class="num">${fmt.int(v)}</td></tr>`).join("");
  }

  /* ---------- featured: Cherokee construction ---------- */
  function renderCherokeeFeature(data) {
    const cs = data.construction.counties.slice().sort((a, b) => b.change - a.change);
    const all = data.construction.scale.find((s) => s.area.startsWith("All"));
    const tulsa = cs.find((c) => c.county === "Tulsa");
    const grew = cs.filter((c) => c.change > 0).length, fell = cs.filter((c) => c.change < 0).length;
    document.querySelector("#feature-summary").innerHTML =
      `Construction establishments across the 14 counties rose from <strong>${fmt.int(all.start)}</strong> to <strong>${fmt.int(all.end)}</strong> (${fmt.signedInt(all.change)}, ${fmt.signedPct(all.growth * 100)}). ` +
      `Tulsa County alone added ${fmt.int(tulsa.change)}, which is ${fmt.pct(tulsa.share_of_net)} of the net gain, in line with its ${fmt.pct(all.start ? tulsa.start / all.start : 0)} share of establishments at the start. ${grew} counties grew and ${fell} declined.`;
    C.barH("#feature-chart", {
      label: "Change in construction establishments by county, 2018 to 2023", labelWidth: 110, format: fmt.signedInt, axisFormat: d3.format("d"), rowHeight: 24,
      data: cs.map((c) => ({ label: c.county, value: c.change, emphasis: c.county === "Tulsa", color: c.change >= 0 ? N.color : GREY,
        tip: `<strong>${c.county} County</strong><br>${fmt.int(c.start)} in 2018, ${fmt.int(c.end)} in 2023<br>${fmt.signedInt(c.change)}; ${fmt.pct(c.share_of_net)} of the 14-county net change` })),
    });
    const theta = data.scenarios.cases["Cherokee"].threshold;
    document.querySelector("#feature-link").innerHTML =
      `The energy side of this question asks what a battery storage system would need to deliver. Under reference assumptions, a project must return about ${fmt.pct(theta)} of its capital cost every year just to break even. <a href="../scenarios/#bess">Try the battery storage calculator</a> or <a href="../energy/">see the regional energy picture</a>.`;
  }

  /* ---------- featured: White Earth housing ---------- */
  function renderWhiteEarthFeature(data, latest, period) {
    const c = data.scenarios.cases["White Earth"];
    const seasonalShare = latest("seasonal");
    document.querySelector("#feature-summary").innerHTML =
      `About one in three White Earth housing units is vacant (${fmt.pct(latest("vacancy").value)}), but <strong>${fmt.int(c.seasonal)} of the ${fmt.int(c.vacant)}</strong> vacant units (${fmt.pct(seasonalShare.value)} ${fmt.pp(seasonalShare.moe)}) are held for seasonal or occasional use. ` +
      `Only about <strong>${fmt.int(c.nonseasonal)}</strong> (±${fmt.int(c.nonseasonal_moe)}) are vacant for other reasons, and the data cannot say whether any of them are habitable or available. ` +
      `Meanwhile ${fmt.int(c.renter_burden_count)} of ${fmt.int(c.computable_renters)} renter households with a computable ratio pay at least 30% of income on rent.`;
    C.stackedH("#feature-chart", {
      label: "Vacant units: seasonal versus other reasons", rowHeight: 46, labelWidth: 120, format: fmt.int,
      keys: [{ key: "seasonal", label: "Seasonal or occasional use", color: N.color }, { key: "other", label: "Other reasons", color: GREY }],
      rows: [{ label: "Vacant units", values: { seasonal: c.seasonal, other: c.nonseasonal } }],
    });
    C.legend("#feature-legend", [{ label: "Seasonal or occasional use", color: N.color }, { label: "For rent, for sale, sold or rented but unoccupied, other", color: GREY }]);
    document.querySelector("#feature-link").innerHTML =
      `How much could rehabilitating a home cost before ongoing rental assistance becomes the cheaper option for the same household? <a href="../scenarios/#housing">Try the housing cost calculator</a>, which uses clearly labeled illustrative costs.`;
  }
})();
