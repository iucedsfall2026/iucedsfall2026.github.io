/* CEDS Evidence Atlas — maps drawn from the exported Census boundaries.
   Census GeoJSON uses counter-clockwise outer rings; D3's spherical maths
   expects the opposite, so every feature is rewound before drawing. */
(function () {
  const { tooltip, NATIONS, fmt } = window.CEDS;
  const { responsive, svgIn } = window.CEDSCharts;

  function rewind(feature) {
    const f = JSON.parse(JSON.stringify(feature));
    if (d3.geoArea(f) > 2 * Math.PI) {
      const flip = (poly) => poly.map((ring) => ring.slice().reverse());
      f.geometry.coordinates = f.geometry.type === "Polygon" ? flip(f.geometry.coordinates) : f.geometry.coordinates.map(flip);
    }
    return f;
  }
  const prepared = new WeakMap();
  function prep(boundaries) {
    if (!prepared.has(boundaries)) {
      prepared.set(boundaries, {
        tribal: boundaries.tribal.features.map(rewind),
        counties: boundaries.counties.features.map(rewind),
      });
    }
    return prepared.get(boundaries);
  }

  /* One Nation: reference counties (optionally shaded) with the Census tribal area on top. */
  function nationMap(container, boundaries, nation, opts = {}) {
    const b = prep(boundaries);
    const tip = tooltip();
    const n = NATIONS[nation];
    const counties = b.counties.filter((f) => f.properties.nation === nation);
    const tribal = b.tribal.filter((f) => f.properties.nation === nation);
    return responsive(container, (node, width) => {
      const h = Math.max(300, Math.min(520, width * 0.78));
      const svg = svgIn(node, width, h, opts.label || `Map of ${n.geoShort} and reference counties`);
      const fc = { type: "FeatureCollection", features: counties.concat(tribal) };
      const proj = d3.geoConicEqualArea().parallels(nation === "Cherokee" ? [35, 37.5] : [46, 48])
        .rotate([nation === "Cherokee" ? 95.3 : 95.7, 0]).fitExtent([[10, 10], [width - 10, h - 10]], fc);
      const path = d3.geoPath(proj);
      const fill = opts.countyFill || (() => "#e9eeeb");

      svg.append("g").selectAll("path").data(counties).join("path")
        .attr("d", path).attr("fill", (d) => fill(d.properties)).attr("stroke", "#9fb0ac").attr("stroke-width", 0.8)
        .attr("tabindex", 0)
        .on("mousemove focus", (ev, d) => tip.show(opts.countyTip ? opts.countyTip(d.properties) : `${d.properties.name} County, ${d.properties.state}`,
          ev.type === "focus" ? { clientX: ev.target.getBoundingClientRect().left + 20, clientY: ev.target.getBoundingClientRect().top + 20 } : ev))
        .on("mouseleave blur", () => tip.hide());
      svg.append("g").selectAll("path").data(tribal).join("path")
        .attr("d", path).attr("fill", n.color).attr("fill-opacity", opts.countyFill ? 0 : 0.18)
        .attr("stroke", n.color).attr("stroke-width", 2.2).attr("pointer-events", "none");
      if (opts.labels !== false) {
        svg.append("g").selectAll("text").data(counties).join("text")
          .attr("class", "label").attr("text-anchor", "middle").attr("pointer-events", "none")
          .attr("transform", (d) => `translate(${path.centroid(d)})`).attr("dy", "0.35em")
          .style("font-size", width < 480 ? "9.5px" : "11px")
          .style("paint-order", "stroke").style("stroke", "#fbfcfa").style("stroke-width", 3)
          .text((d) => d.properties.name);
      }
    });
  }

  /* Both Nations side by side at one shared equal-area scale. */
  function sameScale(container, boundaries) {
    const b = prep(boundaries);
    const tip = tooltip();
    const groups = ["Cherokee", "White Earth"].map((nation) => {
      const feats = b.tribal.filter((f) => f.properties.nation === nation);
      return { nation, fc: { type: "FeatureCollection", features: feats }, km2: d3.sum(feats, (f) => f.properties.land_km2) };
    });
    return responsive(container, (node, width) => {
      const h = Math.max(260, Math.min(420, width * 0.62));
      const svg = svgIn(node, width, h, "Cherokee OTSA and White Earth Reservation drawn at the same scale");
      const cellW = width * 0.62;
      const projFor = (g) => d3.geoAzimuthalEqualArea().rotate(d3.geoCentroid(g.fc).map((v) => -v));
      const big = projFor(groups[0]).fitExtent([[0, 6], [cellW - 20, h - 52]], groups[0].fc);
      const scale = big.scale();
      const cx = [cellW / 2, cellW + (width - cellW) / 2];
      groups.forEach((g, i) => {
        const p = projFor(g).scale(scale).translate([cx[i], (h - 46) / 2]);
        const path = d3.geoPath(p);
        const n = NATIONS[g.nation];
        svg.append("g").selectAll("path").data(g.fc.features).join("path")
          .attr("d", path).attr("fill", n.color).attr("fill-opacity", 0.22).attr("stroke", n.color).attr("stroke-width", 1.6)
          .attr("tabindex", 0)
          .on("mousemove focus", (ev, d) => tip.show(`<strong>${d.properties.name}</strong><br>${fmt.int(d.properties.land_km2)} km² of land`,
            ev.type === "focus" ? { clientX: ev.target.getBoundingClientRect().left + 30, clientY: ev.target.getBoundingClientRect().top + 30 } : ev))
          .on("mouseleave blur", () => tip.hide());
        svg.append("text").attr("x", cx[i]).attr("y", h - 26).attr("text-anchor", "middle")
          .attr("fill", n.text).style("font-weight", 650).style("font-size", "13px").text(n.geoShort);
        svg.append("text").attr("x", cx[i]).attr("y", h - 9).attr("text-anchor", "middle").attr("class", "label")
          .text(`${fmt.int(g.km2)} km² land`);
      });
    });
  }

  window.CEDSMaps = { nationMap, sameScale };
})();
