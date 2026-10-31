/* CEDS Evidence Atlas — reusable D3 charts.
   Each chart redraws on resize and exposes values through tooltips and
   an aria-label summary so the charts are readable without a mouse. */
(function () {
  const { tooltip } = window.CEDS;

  function responsive(container, draw) {
    const node = typeof container === "string" ? document.querySelector(container) : container;
    if (!node) return;
    let last = 0;
    const run = () => {
      const w = Math.floor(node.clientWidth);
      if (w && w !== last) { last = w; node.innerHTML = ""; draw(node, w); }
    };
    new ResizeObserver(run).observe(node);
    run();
    return node;
  }

  function svgIn(node, width, height, label) {
    return d3.select(node).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width).attr("height", height)
      .attr("role", "img").attr("aria-label", label || "Chart");
  }

  /* Line chart with optional 90% interval band. */
  function line(container, opts) {
    const o = Object.assign({ height: 280, yFormat: (v) => v, xFormat: (v) => v, band: true, label: "Line chart" }, opts);
    const tip = tooltip();
    return responsive(container, (node, width) => {
      const m = { top: 14, right: o.endLabels ? 96 : 18, bottom: 30, left: o.marginLeft || 56 };
      const h = o.height, w = width;
      const all = o.series.flatMap((s) => s.values);
      const xs = [...new Set(all.map((d) => d.x))].sort((a, b) => a - b);
      const x = d3.scalePoint().domain(xs).range([m.left, w - m.right]).padding(0.3);
      const lo = d3.min(all, (d) => (o.band && d.lo != null ? d.lo : d.y));
      const hi = d3.max(all, (d) => (o.band && d.hi != null ? d.hi : d.y));
      const pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.1 || 1;
      const y = d3.scaleLinear().domain(o.yDomain || [o.zero ? 0 : lo - pad, hi + pad]).nice().range([h - m.bottom, m.top]);
      const svg = svgIn(node, w, h, o.label);

      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.left - m.right)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).tickFormat(w < 520 && o.xFormatNarrow ? o.xFormatNarrow : o.xFormat).tickSizeOuter(0));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(o.yFormat).tickSizeOuter(0));

      for (const s of o.series) {
        const vals = s.values.filter((d) => d.y != null);
        if (o.band && vals.some((d) => d.lo != null)) {
          svg.append("path").datum(vals)
            .attr("fill", s.color).attr("opacity", 0.16)
            .attr("d", d3.area().x((d) => x(d.x)).y0((d) => y(d.lo)).y1((d) => y(d.hi)));
        }
        svg.append("path").datum(vals).attr("fill", "none").attr("stroke", s.color)
          .attr("stroke-width", 2.25).attr("stroke-dasharray", s.dash || null)
          .attr("d", d3.line().x((d) => x(d.x)).y((d) => y(d.y)));
        svg.append("g").selectAll("circle").data(vals).join("circle")
          .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", vals.length > 15 ? 2.5 : 4)
          .attr("fill", "#fbfcfa").attr("stroke", s.color).attr("stroke-width", 2)
          .attr("tabindex", 0)
          .on("mousemove focus", (ev, d) => tip.show(o.tip ? o.tip(d, s) : `${s.name}: ${o.yFormat(d.y)}`, ev.type === "focus" ? focusEvent(ev) : ev))
          .on("mouseleave blur", () => tip.hide());
        if (o.endLabels) {
          const last = vals[vals.length - 1];
          svg.append("text").attr("class", "value-label").attr("x", x(last.x) + 8).attr("y", y(last.y) + 4)
            .attr("fill", s.color).text(s.name);
        }
      }
    });
  }

  /* Horizontal bars; supports negative values, interval whiskers and per-bar colour. */
  function barH(container, opts) {
    const o = Object.assign({ format: (v) => v, rowHeight: 28, label: "Bar chart", labelWidth: 150 }, opts);
    const tip = tooltip();
    return responsive(container, (node, width) => {
      const data = o.data;
      const lw = Math.min(o.labelWidth, width * 0.38);
      const m = { top: 8, right: 64, bottom: 26, left: lw };
      const h = m.top + m.bottom + data.length * o.rowHeight;
      const minV = Math.min(0, d3.min(data, (d) => (d.lo ?? d.value)));
      const maxV = Math.max(0, d3.max(data, (d) => (d.hi ?? d.value)));
      const x = d3.scaleLinear().domain(o.domain || [minV, maxV]).nice().range([m.left, width - m.right]);
      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([m.top, h - m.bottom]).padding(0.28);
      const svg = svgIn(node, width, h, o.label);

      svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - lw) / 90))).tickSize(-(h - m.top - m.bottom)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - lw) / 90))).tickFormat(o.axisFormat || o.format).tickSizeOuter(0));

      const g = svg.append("g").selectAll("g").data(data).join("g");
      g.append("text").attr("class", "label").attr("x", m.left - 8).attr("y", (d) => y(d.label) + y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.label)
        .style("font-weight", (d) => (d.emphasis ? 650 : null));
      g.append("rect")
        .attr("x", (d) => x(Math.min(0, d.value))).attr("y", (d) => y(d.label))
        .attr("width", (d) => Math.abs(x(d.value) - x(0))).attr("height", y.bandwidth())
        .attr("fill", (d) => d.color || "#8a9a9c").attr("rx", 1.5)
        .attr("tabindex", 0)
        .on("mousemove focus", (ev, d) => tip.show(d.tip || `${d.label}: ${o.format(d.value)}`, ev.type === "focus" ? focusEvent(ev) : ev))
        .on("mouseleave blur", () => tip.hide());
      g.filter((d) => d.lo != null && d.hi != null).append("line")
        .attr("x1", (d) => x(d.lo)).attr("x2", (d) => x(d.hi))
        .attr("y1", (d) => y(d.label) + y.bandwidth() / 2).attr("y2", (d) => y(d.label) + y.bandwidth() / 2)
        .attr("stroke", "#1d2b2f").attr("stroke-width", 1.25);
      g.append("text").attr("class", "value-label")
        .attr("x", (d) => (d.value >= 0 ? x(Math.max(d.value, d.hi ?? d.value)) + 6 : x(0) + 6))
        .attr("text-anchor", "start")
        .attr("y", (d) => y(d.label) + y.bandwidth() / 2).attr("dy", "0.35em")
        .text((d) => o.format(d.value));
      if (minV < 0) svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.top).attr("y2", h - m.bottom).attr("stroke", "#4b5b5e");
    });
  }

  /* Horizontal stacked bars (absolute or normalized to 100%). */
  function stackedH(container, opts) {
    const o = Object.assign({ format: (v) => v, rowHeight: 34, normalize: false, label: "Stacked bar chart", labelWidth: 170 }, opts);
    const tip = tooltip();
    return responsive(container, (node, width) => {
      const keys = o.keys.map((k) => k.key);
      const rows = o.rows.map((r) => {
        const total = d3.sum(keys, (k) => r.values[k] || 0);
        const out = { label: r.label, total };
        for (const k of keys) out[k] = o.normalize ? (r.values[k] || 0) / (total || 1) : (r.values[k] || 0);
        return out;
      });
      const lw = Math.min(o.labelWidth, width * 0.38);
      const m = { top: 6, right: 16, bottom: 26, left: lw };
      const h = m.top + m.bottom + rows.length * o.rowHeight;
      const x = d3.scaleLinear().domain([0, o.normalize ? 1 : d3.max(rows, (r) => r.total) || 1]).nice().range([m.left, width - m.right]);
      const y = d3.scaleBand().domain(rows.map((r) => r.label)).range([m.top, h - m.bottom]).padding(0.25);
      const svg = svgIn(node, width, h, o.label);
      const stack = d3.stack().keys(keys)(rows);
      const colour = Object.fromEntries(o.keys.map((k) => [k.key, k.color]));
      const name = Object.fromEntries(o.keys.map((k) => [k.key, k.label]));

      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - lw) / 90))).tickFormat(o.normalize ? d3.format(".0%") : o.axisFormat || o.format).tickSizeOuter(0));
      svg.append("g").selectAll("text").data(rows).join("text").attr("class", "label")
        .attr("x", m.left - 8).attr("y", (d) => y(d.label) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.label);
      svg.append("g").selectAll("g").data(stack).join("g").attr("fill", (s) => colour[s.key])
        .selectAll("rect").data((s) => s.map((v) => Object.assign(v, { key: s.key }))).join("rect")
        .attr("x", (d) => x(d[0])).attr("y", (d) => y(d.data.label))
        .attr("width", (d) => Math.max(0, x(d[1]) - x(d[0]))).attr("height", y.bandwidth())
        .attr("stroke", "#fbfcfa").attr("stroke-width", 1)
        .attr("tabindex", 0)
        .on("mousemove focus", (ev, d) => {
          const raw = o.rows.find((r) => r.label === d.data.label).values[d.key] || 0;
          const share = raw / (d.data.total || 1);
          tip.show(`<strong>${d.data.label}</strong><br>${name[d.key]}: ${o.format(raw)} (${(share * 100).toFixed(1)}%)`, ev.type === "focus" ? focusEvent(ev) : ev);
        })
        .on("mouseleave blur", () => tip.hide());
    });
  }

  /* Start → end comparison per row. */
  function dumbbell(container, opts) {
    const o = Object.assign({ format: (v) => v, rowHeight: 26, label: "Change chart", labelWidth: 120 }, opts);
    const tip = tooltip();
    return responsive(container, (node, width) => {
      const data = o.data;
      const lw = Math.min(o.labelWidth, width * 0.3);
      const m = { top: 8, right: 70, bottom: 26, left: lw };
      const h = m.top + m.bottom + data.length * o.rowHeight;
      const vals = data.flatMap((d) => [d.start, d.end]);
      const x = (o.log ? d3.scaleLog().domain([d3.min(vals) * 0.8, d3.max(vals) * 1.15]) : d3.scaleLinear().domain([0, d3.max(vals)]).nice())
        .range([m.left, width - m.right]);
      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([m.top, h - m.bottom]).padding(0.4);
      const svg = svgIn(node, width, h, o.label);
      svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).ticks(5, o.log ? "~s" : undefined).tickSize(-(h - m.top - m.bottom)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`)
        .call(d3.axisBottom(x).ticks(5, o.log ? "~s" : undefined).tickSizeOuter(0));
      const g = svg.append("g").selectAll("g").data(data).join("g")
        .attr("transform", (d) => `translate(0,${y(d.label) + y.bandwidth() / 2})`)
        .attr("tabindex", 0)
        .on("mousemove focus", (ev, d) => tip.show(d.tip, ev.type === "focus" ? focusEvent(ev) : ev))
        .on("mouseleave blur", () => tip.hide());
      g.append("text").attr("class", "label").attr("x", m.left - 8).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.label)
        .style("font-weight", (d) => (d.emphasis ? 650 : null));
      g.append("line").attr("x1", (d) => x(d.start)).attr("x2", (d) => x(d.end)).attr("stroke", (d) => d.color).attr("stroke-width", 2.5).attr("opacity", 0.6);
      g.append("circle").attr("cx", (d) => x(d.start)).attr("r", 4).attr("fill", "#fbfcfa").attr("stroke", (d) => d.color).attr("stroke-width", 2);
      g.append("circle").attr("cx", (d) => x(d.end)).attr("r", 4.5).attr("fill", (d) => d.color);
      g.append("text").attr("class", "value-label").attr("x", (d) => x(Math.max(d.start, d.end)) + 8).attr("dy", "0.35em").text((d) => o.format(d.end - d.start));
    });
  }

  function focusEvent(ev) {
    const r = ev.target.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top };
  }

  function legend(container, items) {
    const node = typeof container === "string" ? document.querySelector(container) : container;
    node.innerHTML = items.map((i) => `<li><span class="sw" style="background:${i.color}"></span>${i.label}</li>`).join("");
  }

  window.CEDSCharts = { responsive, line, barH, stackedH, dumbbell, legend, svgIn };
})();
