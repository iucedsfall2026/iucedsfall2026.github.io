/* Energy and infrastructure page. */
(function () {
  const { NATIONS, fmt, acs, loadData, esc, showError } = window.CEDS;
  const C = window.CEDSCharts;

  const FUELS = {
    NG: { short: "natural gas", label: "Natural gas", color: "#6f88a3" },
    SUB: { short: "coal", label: "Coal (subbituminous)", color: "#3f4a4c" },
    WAT: { short: "hydroelectric", label: "Hydroelectric", color: "#3d93b8" },
    DFO: { short: "fuel oil", label: "Fuel oil", color: "#b0703c" },
    MSW: { short: "municipal solid waste", label: "Municipal solid waste", color: "#8d7d5a" },
    SUN: { short: "solar", label: "Solar", color: "#d9a92b" },
  };
  const STATUS = {
    P: "Planned; regulatory approvals not yet started",
    L: "Regulatory approvals pending",
    T: "Approvals received; construction not started",
    U: "Under construction, 50% or less complete",
    V: "Under construction, more than 50% complete",
    TS: "Construction complete; not yet operating",
  };
  const nationOf = (state) => (state === "MN" ? "White Earth" : "Cherokee");

  loadData().then((data) => {
    capacity(data);
    proposed(data);
    hazard(data);
    broadband(data);
    land(data);
  }).catch((e) => showError("#main", e));

  function capacity(data) {
    const E = data.energy.capacity;
    const Y = d3.max(E, (r) => r.year);
    document.querySelectorAll(".ey").forEach((n) => (n.textContent = Y));
    const latest = E.filter((r) => r.year === Y);
    const byCounty = d3.rollups(latest, (rs) => Object.fromEntries(rs.map((r) => [r.fuel, r.mw])), (r) => `${r.county}, ${r.state}`);
    const totals = (state) => d3.sum(latest.filter((r) => (state === "MN") === (r.state === "MN")), (r) => r.mw);
    const fuelsUsed = [...new Set(latest.map((r) => r.fuel))];
    const keys = Object.keys(FUELS).filter((k) => fuelsUsed.includes(k)).map((k) => ({ key: k, ...FUELS[k] }));
    const rows = byCounty.map(([label, values]) => ({ label, values })).sort((a, b) => d3.sum(Object.values(b.values)) - d3.sum(Object.values(a.values)));
    const withCap = new Set(latest.map((r) => r.county));
    const okByFuel = d3.rollups(latest.filter((r) => r.state === "OK"), (rs) => d3.sum(rs, (r) => r.mw), (r) => r.fuel).sort((a, b) => b[1] - a[1]);
    const topFuels = okByFuel.slice(0, 3).map(([f, mw]) => `${FUELS[f] ? FUELS[f].short : f} (${fmt.pct(mw / totals("OK"), 0)})`).join(", ");
    const okNone = 14 - [...withCap].filter((c) => latest.some((r) => r.county === c && r.state === "OK")).length;
    const mnNone = 3 - [...withCap].filter((c) => latest.some((r) => r.county === c && r.state === "MN")).length;

    document.querySelector("#capacity-intro").textContent =
      `In ${Y}, operable generators in the 14 Cherokee reference counties had ${fmt.mw(totals("OK"))} of nameplate capacity. The largest sources were ${topFuels}. ` +
      `The 3 White Earth reference counties had ${fmt.mw(totals("MN"))}. ${okNone} Oklahoma and ${mnNone} Minnesota reference counties reported no operable generators.`;
    C.legend("#fuel-legend", keys);
    C.stackedH("#capacity-chart", { keys, rows, format: fmt.mw, axisFormat: d3.format("~s"), labelWidth: 130, rowHeight: 30, label: `Operable capacity by county and fuel, ${Y}` });

    const ok = E.filter((r) => r.state === "OK");
    const years = [...new Set(ok.map((r) => r.year))].sort();
    const series = keys.filter((k) => ok.some((r) => r.fuel === k.key)).map((k) => ({
      name: k.label, color: k.color,
      values: years.map((y) => ({ x: y, y: d3.sum(ok.filter((r) => r.year === y && r.fuel === k.key), (r) => r.mw) })),
    }));
    C.legend("#fuel-trend-legend", series.map((s) => ({ label: s.name, color: s.color })));
    C.line("#capacity-trend", {
      series, band: false, zero: true, height: 300, yFormat: (v) => d3.format("~s")(v) + " MW", marginLeft: 62,
      label: "Operable capacity by fuel in the Cherokee reference counties, 2018 to 2025",
      tip: (d, s) => `<strong>${s.name}</strong><br>${d.x}: ${fmt.mw(d.y)}`,
    });
  }

  function proposed(data) {
    const P = data.energy.proposed.slice().sort((a, b) => b.mw - a.mw);
    document.querySelectorAll(".py").forEach((n) => (n.textContent = data.energy.proposed_year));
    const solar = P.filter((p) => p.fuel === "SUN");
    const inside = P.filter((p) => p.tribal_geography);
    const mn = P.filter((p) => p.state === "MN");
    document.querySelector("#proposed-intro").textContent =
      `The ${data.energy.proposed_year} filing lists ${P.length} proposed generators in the reference counties totaling ${fmt.mw(d3.sum(P, (p) => p.mw))}. ` +
      `${solar.length} are solar (${fmt.mw(d3.sum(solar, (p) => p.mw))}), and ${inside.length} sit inside the Cherokee OTSA. ${mn.length ? mn.length + " are" : "None are"} in the White Earth reference counties.`;
    document.querySelector("#proposed-table tbody").innerHTML = P.map((p) => `<tr>
      <td>${esc(p.plant)}</td><td>${esc(p.county)}, ${esc(p.state)}</td><td>${FUELS[p.fuel] ? FUELS[p.fuel].label : esc(p.fuel)}</td>
      <td class="num">${fmt.mw(p.mw)}</td><td>${STATUS[p.status] || esc(p.status)}</td><td>${p.tribal_geography ? "Yes" : "No"}</td></tr>`).join("");
  }

  function hazard(data) {
    const H = data.hazard.slice().sort((a, b) => b.risk_score - a.risk_score);
    document.querySelectorAll(".nri").forEach((n) => (n.textContent = H[0].version + " release"));
    C.barH("#hazard-chart", {
      label: "FEMA National Risk Index score by county", labelWidth: 120, rowHeight: 22, domain: [0, 100],
      format: (v) => v.toFixed(1), axisFormat: d3.format("d"),
      data: H.map((h) => ({ label: `${h.county}, ${h.state}`, value: h.risk_score, color: NATIONS[h.nation].color,
        tip: `<strong>${h.county} County, ${h.state}</strong><br>Risk score ${h.risk_score.toFixed(1)} (${h.risk_rating})<br>Expected annual loss ${fmt.usdShort(h.eal_usd)}` })),
    });
    document.querySelector("#hazard-table tbody").innerHTML = H.map((h) =>
      `<tr><td>${h.county}, ${h.state}</td><td class="num">${fmt.usdShort(h.eal_usd)}</td><td>${h.sovi_rating}</td><td>${h.resilience_rating}</td></tr>`).join("");
  }

  function broadband(data) {
    const T = data.broadband.tribal;
    const Y = d3.max(data.acs, (r) => r.year);
    document.querySelectorAll(".fcc").forEach((n) => (n.textContent = new Date(T[0].as_of + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })));
    const ch = T.find((t) => t.id === "5550R"), we = T.find((t) => t.id === "4595R"), wt = T.find((t) => t.id === "4595T");
    const sub = (n) => acs(data, n, "broadband", Y);
    const fig = (v, label, note, n) => `<div><div class="value" style="color:${NATIONS[n].text}">${v}</div><div class="label">${label}</div><div class="moe">${note}</div></div>`;
    document.querySelector("#bb-figures").innerHTML =
      fig(fmt.pct(ch.coverage), "Cherokee OTSA locations with 100/20 available", `${fmt.int(ch.units)} residential locations`, "Cherokee") +
      fig(fmt.pct(sub("Cherokee").value), "Cherokee households subscribing", fmt.pp(sub("Cherokee").moe) + " (90% MOE)", "Cherokee") +
      fig(fmt.pct(we.coverage), "White Earth Reservation locations with 100/20 available", `${fmt.int(we.units)} locations; trust land ${fmt.pct(wt.coverage, 0)} of ${wt.units}`, "White Earth") +
      fig(fmt.pct(sub("White Earth").value), "White Earth households subscribing", fmt.pp(sub("White Earth").moe) + " (90% MOE)", "White Earth");
    const Cn = data.broadband.county.slice().sort((a, b) => a.coverage - b.coverage);
    C.barH("#bb-chart", {
      label: "Share of residential locations with 100/20 Mbps available, by county", labelWidth: 120, rowHeight: 22,
      domain: [0, 1], format: (v) => fmt.pct(v), axisFormat: (v) => (v * 100).toFixed(0) + "%",
      data: Cn.map((c) => ({ label: `${c.name.replace(/ County.*$/, "")}, ${c.state}`, value: c.coverage, color: NATIONS[c.nation].color,
        tip: `<strong>${c.name}</strong><br>${fmt.pct(c.coverage)} of ${fmt.int(c.units)} residential locations` })),
    });
  }

  function land(data) {
    const L = data.landcover;
    const Y = d3.max(L, (r) => r.year);
    document.querySelectorAll(".ly").forEach((n) => (n.textContent = Y));
    const keys = [
      { key: "forest", label: "Forest", color: "#3f6b45" },
      { key: "agriculture", label: "Agriculture", color: "#cdb76a" },
      { key: "wetlands", label: "Wetlands", color: "#6fa59a" },
      { key: "water", label: "Open water", color: "#4f8fb8" },
      { key: "developed", label: "Developed", color: "#8f6f73" },
      { key: "other_land", label: "Other", color: "#b9bbaa" },
    ];
    C.legend("#land-legend", keys);
    C.stackedH("#land-chart", {
      keys, normalize: true, labelWidth: 150, rowHeight: 40, format: (v) => fmt.num(v, 0) + " km²",
      label: `Land cover share by Census tribal area, ${Y}`,
      rows: L.filter((r) => r.year === Y).map((r) => ({ label: r.geography.replace("White Earth ", "WE ").replace("Off-Reservation", "off-reservation"), values: Object.fromEntries(keys.map((k) => [k.key, r[k.key]])) })),
    });
    document.querySelector("#roads-table tbody").innerHTML = data.roads.map((r) =>
      `<tr><td>${esc(r.area)}</td><td class="num">${fmt.int(r.area_km2)} km²</td><td class="num">${fmt.int(r.road_km)} km</td><td class="num">${r.road_density.toFixed(2)} km per km²</td></tr>`).join("");
  }
})();
