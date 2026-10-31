/* CEDS Evidence Atlas — shared layout, data loading and formatting.
   Every page sets <body data-root="../"> (or "./" on the home page) and
   data-page="..." so links and data paths work under any repo name. */
(function () {
  const body = document.body;
  const ROOT = body.dataset.root || "./";
  const PAGE = body.dataset.page || "home";

  const NAV = [
    { id: "home", href: "", label: "Overview" },
    { id: "cherokee", href: "cherokee/", label: "Cherokee Nation" },
    { id: "white-earth", href: "white-earth/", label: "White Earth Nation" },
    { id: "energy", href: "energy/", label: "Energy" },
    { id: "scenarios", href: "scenarios/", label: "Scenarios" },
    { id: "framework", href: "framework/", label: "Framework" },
    { id: "methods", href: "methods/", label: "Methods" },
    { id: "team", href: "team/", label: "Contact" },
  ];

  const NATIONS = {
    "Cherokee": {
      name: "Cherokee Nation", slug: "cherokee", color: "#a86b12", text: "#7c4e08", wash: "#f3e6cf",
      geography: "Cherokee OTSA, Oklahoma", geoShort: "Cherokee OTSA",
      counties: 14, state: "Oklahoma",
    },
    "White Earth": {
      name: "White Earth Nation", slug: "white-earth", color: "#1e6e74", text: "#165358", wash: "#d7eae9",
      geography: "White Earth Reservation and Off-Reservation Trust Land, Minnesota", geoShort: "White Earth Reservation",
      counties: 3, state: "Minnesota",
    },
  };

  /* ---------- formatting ---------- */
  const fmt = {
    int: (v) => v == null ? "n/a" : Math.round(v).toLocaleString("en-US"),
    num: (v, d = 1) => v == null ? "n/a" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }),
    pct: (share, d = 1) => share == null ? "n/a" : (share * 100).toFixed(d) + "%",
    pp: (share, d = 1) => share == null ? "" : "±" + (share * 100).toFixed(d) + " pp",
    pctRaw: (p, d = 1) => p == null ? "n/a" : p.toFixed(d) + "%",
    signedPct: (p, d = 1) => p == null ? "n/a" : (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(d) + "%",
    signedInt: (v) => v == null ? "n/a" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)).toLocaleString("en-US"),
    usd: (v, d = 0) => v == null ? "n/a" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }),
    usdShort: (v) => {
      if (v == null) return "n/a";
      const a = Math.abs(v);
      if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
      if (a >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
      if (a >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
      return "$" + v.toFixed(0);
    },
    mw: (v) => v == null ? "n/a" : v.toLocaleString("en-US", { maximumFractionDigits: 1 }) + " MW",
    acsValue(row, d = 1) {
      if (!row) return "n/a";
      if (row.unit === "share") return fmt.pct(row.value, d);
      if (row.unit === "people") return fmt.int(row.value);
      if (row.unit.includes("USD")) return fmt.usd(row.value);
      return fmt.num(row.value, d);
    },
    acsMoe(row, d = 1) {
      if (!row || row.moe == null) return "";
      if (row.unit === "share") return fmt.pp(row.moe, d);
      if (row.unit.includes("USD")) return "±" + fmt.usd(row.moe);
      return "±" + fmt.int(row.moe);
    },
  };

  /* ---------- data ---------- */
  const cache = {};
  function getJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(ROOT + path, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status}).`);
        return r.json();
      });
    }
    return cache[path];
  }
  const loadData = () => getJSON("data/ceds-data.json");
  const loadBoundaries = () => getJSON("data/boundaries.json");
  const loadConfig = () => getJSON("config/site.json");

  function acs(data, nation, id, year) {
    const rows = data.acs.filter((r) => r.nation === nation && r.id === id);
    if (year == null) return rows.sort((a, b) => a.year - b.year);
    return rows.find((r) => r.year === year);
  }
  function latestAcsYear(data) { return d3.max(data.acs, (r) => r.year); }

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- tooltip ---------- */
  let tip;
  function tooltip() {
    if (!tip) { tip = el("div", { class: "tooltip", role: "status", "aria-live": "polite" }); document.body.append(tip); }
    return {
      show(html, event) {
        tip.innerHTML = html;
        tip.classList.add("show");
        const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
        let x = event.clientX + pad, y = event.clientY + pad;
        if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
        if (y + h > window.innerHeight - 8) y = event.clientY - h - pad;
        tip.style.left = x + "px"; tip.style.top = y + "px";
      },
      hide() { tip.classList.remove("show"); },
    };
  }

  /* ---------- layout ---------- */
  function buildHeader() {
    const header = document.querySelector("[data-site-header]");
    if (!header) return;
    const links = NAV.map((n) => `<li><a href="${ROOT}${n.href}"${n.id === PAGE ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("");
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap header-row">
        <a class="brand" href="${ROOT}">
          <strong>CEDS Evidence Atlas</strong>
          <span>Cherokee Nation and White Earth Nation</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <nav class="site-nav" id="site-nav" aria-label="Main"><ul>${links}</ul></nav>
      </div>`;
    const btn = header.querySelector(".nav-toggle");
    const nav = header.querySelector(".site-nav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  function buildFooter(config) {
    const footer = document.querySelector("[data-site-footer]");
    if (!footer) return;
    const p = (config && config.project) || {};
    const email = config && config.contact && config.contact.email;
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="wrap">
        <p><strong>Student research prototype.</strong> ${esc(p.disclaimer || "")}</p>
        <p>${esc(p.course || "")}${p.term ? ", " + esc(p.term) : ""}.${email ? ` Contact: <a href="mailto:${esc(email)}">${esc(email)}</a>.` : ""}</p>
        <p>Data release: <span data-release>loading</span>. <a href="${ROOT}methods/">How the data was prepared</a>.</p>
      </div>`;
    loadData().then((d) => {
      const s = footer.querySelector("[data-release]");
      if (s) s.textContent = `${d.meta.pipeline_release}, exported ${d.meta.generated_utc.slice(0, 10)}`;
    }).catch(() => {});
  }

  function showError(container, err) {
    const target = typeof container === "string" ? document.querySelector(container) : container;
    if (!target) return;
    target.innerHTML = `<p class="error">${esc(err.message)} If you opened this file directly from your computer, run a local server instead (see the README).</p>`;
  }

  buildHeader();
  loadConfig().then(buildFooter).catch(() => buildFooter(null));

  window.CEDS = { ROOT, PAGE, NATIONS, fmt, loadData, loadBoundaries, loadConfig, acs, latestAcsYear, el, esc, tooltip, showError };
})();
