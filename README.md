# CEDS Evidence Atlas

Public dashboards for the Indiana University DSIP Fall 2026 capstone on Comprehensive Economic Development Strategy (CEDS) evidence for Cherokee Nation and White Earth Nation.

Live site: https://iucedsfall2026.github.io

This is a student research prototype. It is not an official publication of either Nation, and nothing on it is an adopted plan.

## What lives where

| Path | What it is | Edit by hand? |
|---|---|---|
| `index.html`, `cherokee/`, `white-earth/`, `energy/`, `scenarios/`, `framework/`, `methods/`, `team/` | The pages | Text only |
| `assets/css/style.css` | All styling | Yes |
| `assets/js/core.js` | Header, footer, navigation, number formatting | Yes |
| `assets/js/charts.js`, `assets/js/maps.js` | Reusable D3 charts and maps | Yes |
| `assets/js/navigator.js` | The "Find something" site guide | Yes, to add topics |
| `assets/js/pages/` | One script per page | Yes |
| `assets/vendor/` | D3 v7.9.0, pinned | No |
| `config/site.json` | Team, advisor, sponsor, contact email | **Yes, this is where names go** |
| `data/ceds-data.json`, `data/boundaries.json` | Data exported from the pipeline | **No, regenerate instead** |

## Adding names and contacts

Open `config/site.json`:

- Replace each `"Team member name"` and role.
- To list the professor or sponsor, fill in their details and set `"show": true`. Only do this once they have agreed.
- Leave an `email` blank to hide it.

## Updating the data

Never edit the JSON in `data/` by hand. From the `ceds-pipeline` folder, run:

```bash
python3 scripts/export_site_data.py --out ../iucedsfall2026.github.io/data
```

Then commit and push this repo. Every number on the site updates automatically.

The export deliberately leaves out federal funding totals and recipient lists. Those are unverified name matches and stay in the private repo.

## Previewing on your computer

Pages load their data with `fetch`, which browsers block for files opened directly. Run a local server from this folder instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Contact form

The form opens the visitor's email app, addressed to the team Gmail. To receive messages without that step, create a free form at formspree.io using the team Gmail and paste its URL into `contact.form_endpoint` in `config/site.json`.

## Privacy

Every page includes `noindex, nofollow`, and `robots.txt` blocks crawlers, so search engines should not list the site. Anyone with the link can still open it.
