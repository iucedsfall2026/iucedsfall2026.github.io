/* CEDS Evidence Atlas — guided navigator.
   A rule-based helper: it matches what people type to sections of the site
   and answers from text written here. It never generates numbers, so it
   cannot misstate the data. Edit INTENTS to change answers or add topics. */
(function () {
  const { ROOT, el, loadConfig } = window.CEDS;
  const link = (label, href) => ({ label, href: ROOT + href });

  const INTENTS = [
    { keys: ["cherokee", "oklahoma", "otsa", "tulsa", "tahlequah"],
      text: "The Cherokee Nation page covers population, income, poverty, work, housing and the regional economy for the Cherokee OTSA and its 14 reference counties.",
      links: [link("Cherokee Nation", "cherokee/"), link("Construction by county", "cherokee/#featured")] },
    { keys: ["white earth", "minnesota", "mahnomen", "becker", "clearwater", "reservation"],
      text: "The White Earth Nation page covers the reservation and off-reservation trust land, with a closer look at housing vacancy and rent burden.",
      links: [link("White Earth Nation", "white-earth/"), link("Housing question", "white-earth/#featured")] },
    { keys: ["energy", "battery", "bess", "storage", "power", "electric", "generator", "solar", "gas", "coal", "hydro", "grid", "outage", "resilience"],
      text: "Energy and infrastructure shows operating generation capacity by county and fuel, proposed generators, hazard risk, broadband coverage, land cover and roads. The battery-storage break-even calculator is on the Scenarios page.",
      links: [link("Energy & infrastructure", "energy/"), link("Battery storage calculator", "scenarios/#bess")] },
    { keys: ["housing", "vacan", "seasonal", "rent", "burden", "afford", "home", "rehab", "assistance"],
      text: "Housing indicators for both Nations are on each Nation page. White Earth's housing question and the rehabilitation versus assistance cost comparison are featured.",
      links: [link("White Earth housing", "white-earth/#housing"), link("Cherokee housing", "cherokee/#housing"), link("Housing cost calculator", "scenarios/#housing")] },
    { keys: ["job", "work", "employ", "unemploy", "labor", "labour", "commut", "workforce", "wage"],
      text: "Work and commuting indicators (labor force participation, unemployment and job flows) are in the Regional economy section of each Nation page.",
      links: [link("Cherokee economy", "cherokee/#economy"), link("White Earth economy", "white-earth/#economy")] },
    { keys: ["industry", "business", "establishment", "construction", "sector", "naics", "retail", "manufactur"],
      text: "Industry change by sector, from County Business Patterns 2018 to 2023, is in each Nation's Regional economy section. Cherokee's construction question is featured on its page.",
      links: [link("Cherokee industries", "cherokee/#economy"), link("White Earth industries", "white-earth/#economy")] },
    { keys: ["income", "poverty", "population", "education", "degree", "broadband", "internet"],
      text: "Community conditions over time, with 90% margins of error, are on each Nation page. Use the indicator buttons to switch between measures.",
      links: [link("Cherokee trends", "cherokee/#trends"), link("White Earth trends", "white-earth/#trends")] },
    { keys: ["scenario", "calculator", "what if", "simulate", "break-even", "breakeven", "discount", "cost"],
      text: "The Scenarios page has two calculators: a battery-storage break-even threshold for Cherokee and a housing cost comparison for White Earth. Both are illustrations of method, not recommendations.",
      links: [link("Scenarios", "scenarios/")] },
    { keys: ["swot", "strength", "weakness", "opportunit", "threat", "action", "kpi", "goal", "plan", "framework", "ceds", "strategy"],
      text: "The Planning framework page lays out the decision chain, SWOT, proposed actions and indicators for each Nation, all marked as proposals awaiting community review.",
      links: [link("Planning framework", "framework/")] },
    { keys: ["source", "data", "method", "census", "acs", "margin", "error", "moe", "accurate", "reliab", "limitation", "download"],
      text: "Data & methods lists every source, its vintage and geography, how margins of error are shown, and what the data cannot tell you.",
      links: [link("Data & methods", "methods/")] },
    { keys: ["fund", "grant", "federal spending", "usaspending", "money"],
      text: "Federal funding figures are not shown on this site. The records were matched by recipient name and have not been verified, so totals could mislead. Data & methods explains why.",
      links: [link("Why funding is withheld", "methods/#withheld")] },
    { keys: ["contact", "email", "reach", "question", "professor", "advisor", "sponsor", "team", "who made", "who built", "student"],
      text: "You can reach the project team through the contact form on the Team & contact page.",
      links: [link("Team & contact", "team/")], contact: true },
    { keys: ["hello", "hi", "hey", "help", "start", "what is this", "about"],
      text: "This site presents public data for Cherokee Nation and White Earth Nation planning, built by an Indiana University student team. Tell me a topic such as housing, energy, jobs or data sources and I will point you to the right section.",
      links: [link("Overview", ""), link("Data & methods", "methods/")] },
  ];

  const CHIPS = ["Energy", "Housing", "Jobs", "Data sources", "Contact the team"];

  function match(text) {
    const q = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const intent of INTENTS) {
      const score = intent.keys.reduce((s, k) => {
        const hit = k.length <= 4 ? new RegExp("\\b" + k).test(q) : q.includes(k);
        return s + (hit ? k.length : 0);
      }, 0);
      if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best;
  }

  function build(config) {
    const email = config && config.contact && config.contact.email;
    const btn = el("button", { class: "nav-assist-btn", type: "button", "aria-expanded": "false", "aria-controls": "nav-assist" }, "Find something");
    const log = el("div", { class: "nav-log", role: "log", "aria-live": "polite" });
    const input = el("input", { type: "text", placeholder: "Try housing, energy or contact", "aria-label": "What are you looking for?", maxlength: "200" });
    const chips = el("div", { class: "chips" }, CHIPS.map((c) => el("button", { type: "button", onclick: () => ask(c) }, c)));
    const panel = el("section", { class: "nav-assist", id: "nav-assist", "aria-label": "Site guide" },
      el("header", {}, el("h2", {}, "Site guide"), el("button", { type: "button", "aria-label": "Close guide", onclick: () => toggle(false) }, "×")),
      log, chips,
      el("form", { onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) { ask(input.value.trim()); input.value = ""; } } },
        input, el("button", { type: "submit" }, "Go")));

    function say(who, text, links) {
      const m = el("div", { class: `msg ${who}` }, el("p", {}, text));
      if (links && links.length) m.append(el("div", { class: "links" }, links.map((l) => el("a", { href: l.href }, l.label))));
      log.append(m);
      log.scrollTop = log.scrollHeight;
    }
    function ask(text) {
      say("user", text);
      const hit = match(text);
      if (!hit) {
        say("bot", "I could not match that to a section. Try a topic such as housing, energy, jobs, industries, scenarios or data sources, or contact the team.",
          [link("Overview", ""), link("Team & contact", "team/")]);
        return;
      }
      const links = hit.links.slice();
      let text2 = hit.text;
      if (hit.contact && email) text2 += ` You can also email ${email}.`;
      say("bot", text2, links);
    }
    function toggle(open) {
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        if (!log.childElementCount) say("bot", "I can point you to the right part of the site. What are you looking for?");
        input.focus();
      } else btn.focus();
    }
    btn.addEventListener("click", () => toggle(!panel.classList.contains("open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) toggle(false); });
    document.body.append(panel, btn);
  }

  loadConfig().then(build).catch(() => build(null));
})();
