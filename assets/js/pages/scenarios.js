/* Scenario calculators. Formulas match ceds_web/server.py in the pipeline:
   annuity(n, r) = n if r == 0 else (1 - (1 + r)^-n) / r
   BESS:    threshold = 1 / annuity(life, rate) + fom; incremental = premium * threshold
   Housing: parity = assist_capex + (assist_annual - rehab_annual) * annuity(years, rate)
            annual_gap = (rehab - assist_capex) / annuity + rehab_annual - assist_annual */
(function () {
  const { NATIONS, fmt, loadData, showError } = window.CEDS;
  const C = window.CEDSCharts;

  const annuity = (n, r) => (r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r);
  window.CEDSScenario = { annuity };

  loadData().then((data) => {
    const P = Object.fromEntries(data.scenarios.parameters.map((p) => [p.id, p.value]));
    const premium = data.scenarios.assumptions.distributed_capital_premium;
    setupBess({ life: P.life, rate: P.discount, fom: P.fom, prem: premium });
    setupHousing({ years: 20, rate: P.discount, assist: P.assist_annual, upkeep: P.rehab_annual, rehab: P.rehab_capex, assistCapex: P.assist_capex });
  }).catch((e) => showError("#main", e));

  function bind(ids, fmtMap, onChange) {
    const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
    const update = () => {
      for (const id of ids) document.getElementById(id + "-o").textContent = fmtMap[id](+inputs[id].value);
      onChange(Object.fromEntries(ids.map((id) => [id, +inputs[id].value])));
    };
    ids.forEach((id) => inputs[id].addEventListener("input", update));
    return { inputs, update };
  }

  function freshChart(sel) {
    const old = document.querySelector(sel);
    const n = old.cloneNode(false);
    old.replaceWith(n);
    return n;
  }

  /* ---------- battery storage ---------- */
  function setupBess(def) {
    const N = NATIONS["Cherokee"];
    const pct1 = (v) => (v * 100).toFixed(1) + "%";
    const { inputs, update } = bind(["b-life", "b-rate", "b-fom", "b-prem"], {
      "b-life": (v) => v + " years", "b-rate": pct1, "b-fom": pct1, "b-prem": (v) => (v * 100).toFixed(0) + "%",
    }, (v) => {
      const life = v["b-life"], rate = v["b-rate"], fom = v["b-fom"], prem = v["b-prem"];
      const base = 1 / annuity(life, rate) + fom;
      const incr = prem * base;
      document.getElementById("bess-out").textContent = fmt.pct(base, 2) + " of capital per year";
      document.getElementById("bess-text").innerHTML =
        `A central battery system lasting ${life} years, with a ${pct1(rate)} discount rate and fixed operating costs of ${pct1(fom)} of capital each year, must deliver benefits worth <strong>${fmt.pct(base, 2)}</strong> of its upfront cost every year just to break even. ` +
        `For a $1 million system, that is about ${fmt.usd(base * 1e6)} per year. ` +
        `A distributed design costing ${(prem * 100).toFixed(0)}% more must deliver an extra <strong>${fmt.pct(incr, 2)}</strong> of the central system's cost each year (${fmt.usd(incr * 1e6)} per $1 million) to justify the difference, before charging, replacement and other omitted costs.`;
      const lives = d3.range(5, 16);
      C.line(freshChart("#bess-chart"), {
        height: 260, band: false, zero: true, marginLeft: 46, yFormat: (y) => (y * 100).toFixed(0) + "%", xFormat: (x) => x + " yr",
        label: "Annual break-even share of capital by project life",
        series: [
          { name: "Central", color: N.color, values: lives.map((n) => ({ x: n, y: 1 / annuity(n, rate) + fom })) },
          { name: "Distributed", color: "#4b5b5e", dash: "5 4", values: lives.map((n) => ({ x: n, y: (1 + prem) * (1 / annuity(n, rate) + fom) })) },
        ],
        endLabels: true,
        tip: (d, s) => `<strong>${s.name}</strong>, ${d.x}-year life<br>${fmt.pct(d.y, 2)} of central capital per year`,
      });
    });
    const reset = () => {
      inputs["b-life"].value = def.life; inputs["b-rate"].value = def.rate; inputs["b-fom"].value = def.fom; inputs["b-prem"].value = def.prem;
      update();
    };
    document.getElementById("bess-reset").addEventListener("click", reset);
    reset();
  }

  /* ---------- housing ---------- */
  function setupHousing(def) {
    const N = NATIONS["White Earth"];
    const pct1 = (v) => (v * 100).toFixed(1) + "%";
    const { inputs, update } = bind(["h-years", "h-rate", "h-assist", "h-upkeep", "h-rehab"], {
      "h-years": (v) => v + " years", "h-rate": pct1, "h-assist": (v) => fmt.usd(v), "h-upkeep": (v) => fmt.usd(v), "h-rehab": (v) => fmt.usd(v),
    }, (v) => {
      const years = v["h-years"], rate = v["h-rate"], assist = v["h-assist"], upkeep = v["h-upkeep"], rehab = v["h-rehab"];
      const af = annuity(years, rate);
      const parity = def.assistCapex + (assist - upkeep) * af;
      const annualGap = (rehab - def.assistCapex) / af + upkeep - assist;
      document.getElementById("house-out").textContent = parity > 0 ? fmt.usd(parity) : "No break-even";
      let verdict;
      if (parity <= 0) verdict = `Because upkeep (${fmt.usd(upkeep)}) is at least as high as assistance (${fmt.usd(assist)}) each year, rehabilitation cannot break even at any upfront cost under these inputs.`;
      else if (Math.abs(rehab - parity) < 1) verdict = `The tested cost of ${fmt.usd(rehab)} sits right at the break-even point.`;
      else if (rehab > parity) verdict = `The tested cost of ${fmt.usd(rehab)} is ${fmt.usd(rehab - parity)} above that, which works out to ${fmt.usd(Math.abs(annualGap))} more per year than assistance.`;
      else verdict = `The tested cost of ${fmt.usd(rehab)} is ${fmt.usd(parity - rehab)} below that, which works out to ${fmt.usd(Math.abs(annualGap))} less per year than assistance.`;
      document.getElementById("house-text").innerHTML =
        (parity > 0 ? `Over ${years} years at a ${pct1(rate)} discount rate, rehabilitation costs the same as paying ${fmt.usd(assist)} a year in assistance when its upfront cost is <strong>${fmt.usd(parity)}</strong>, given ${fmt.usd(upkeep)} a year in upkeep. ` : "") +
        verdict + ` All inputs are illustrative.`;
      const span = d3.range(5, 41);
      C.line(freshChart("#house-chart"), {
        height: 260, band: false, zero: true, marginLeft: 56, yFormat: (y) => "$" + d3.format("~s")(y), xFormat: (x) => (x % 5 === 0 ? x + " yr" : ""),
        label: "Break-even rehabilitation cost by comparison period",
        series: [
          { name: "Break-even cost", color: N.color, values: span.map((n) => ({ x: n, y: def.assistCapex + (assist - upkeep) * annuity(n, rate) })) },
          { name: "Tested cost", color: "#4b5b5e", dash: "5 4", values: span.map((n) => ({ x: n, y: rehab })) },
        ],
        endLabels: true,
        tip: (d, s) => `<strong>${s.name}</strong>, ${d.x} years<br>${fmt.usd(d.y)}`,
      });
    });
    const reset = () => {
      inputs["h-years"].value = def.years; inputs["h-rate"].value = def.rate; inputs["h-assist"].value = def.assist;
      inputs["h-upkeep"].value = def.upkeep; inputs["h-rehab"].value = def.rehab;
      update();
    };
    document.getElementById("house-reset").addEventListener("click", reset);
    reset();
  }
})();
