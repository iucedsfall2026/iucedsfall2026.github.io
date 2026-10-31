/* Team and contact. People and contact details come from config/site.json.
   If contact.form_endpoint is set (for example a Formspree URL), the form posts there;
   otherwise it opens the visitor's email app addressed to the team. */
(function () {
  const { ROOT, loadConfig, esc, showError } = window.CEDS;

  function initials(p) {
    if (p.initials) return p.initials;
    const parts = p.name.replace(/[“”"]/g, "").replace(/,.*$/, "").split(/\s+/).filter(Boolean);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function card(p) {
    const photo = p.photo
      ? `<img class="avatar" src="${ROOT}assets/img/people/${encodeURIComponent(p.photo)}" alt="Photo of ${esc(p.name)}" width="96" height="96" loading="lazy">`
      : `<div class="avatar" role="img" aria-label="Photo placeholder for ${esc(p.name)}">${esc(initials(p))}</div>`;
    const titles = (p.titles || []).map((t) => `<li>${esc(t)}</li>`).join("");
    return `<article class="person">
      ${photo}
      <div>
        <h3>${esc(p.name)}</h3>
        <p class="role">${esc(p.role || "")}</p>
        ${titles ? `<ul class="titles">${titles}</ul>` : ""}
        ${p.organization ? `<p>${esc(p.organization)}</p>` : ""}
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
        ${p.email ? `<p><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>` : ""}
      </div>
    </article>`;
  }

  function fill(sel, list) {
    const node = document.querySelector(sel);
    const shown = list.filter((p) => p && p.show && p.name);
    node.innerHTML = shown.map(card).join("");
    return shown.length;
  }

  loadConfig().then((cfg) => {
    fill("#people-team", cfg.team || []);
    if (!fill("#people-instructors", cfg.instructors || [])) document.querySelector("#people-instructors").closest("section").hidden = true;
    if (!fill("#people-sponsor", [cfg.sponsor])) document.querySelector("#sponsor-section").hidden = true;

    const email = cfg.contact && cfg.contact.email;
    const endpoint = cfg.contact && cfg.contact.form_endpoint;
    document.querySelector("#contact-intro").innerHTML = email
      ? `Send a message below or email <a href="mailto:${esc(email)}">${esc(email)}</a>. Please do not include personal or sensitive information about community members.`
      : "Send a message below.";

    const form = document.querySelector("#contact-form");
    const status = document.querySelector("#form-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      if (endpoint) {
        status.textContent = "Sending…";
        try {
          const r = await fetch(endpoint, { method: "POST", body: f, headers: { Accept: "application/json" } });
          if (!r.ok) throw new Error();
          form.reset();
          status.textContent = "Message sent. The team will reply by email.";
        } catch {
          status.textContent = email ? `The message did not send. Please email ${email} directly.` : "The message did not send. Please try again later.";
        }
        return;
      }
      if (!email) { status.textContent = "Contact email is not set yet."; return; }
      const subject = `[CEDS Evidence Atlas] ${f.get("topic")}`;
      const bodyText = `${f.get("message")}\n\nFrom: ${f.get("name")} <${f.get("email")}>`;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      status.textContent = "Your email app should open with the message ready to send.";
    });
  }).catch((e) => showError("#people-team", e));
})();
