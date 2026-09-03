# DesignIT Web Design Studio

This project can be deployed on DigitalOcean App Platform as a `Static Site`.

## Mood Board and Style Agent

The studio now includes the local MVP from `DesignIT_Moodboard_Style_Agent_SDD_v1.0.md`:

- collect a mood board with images, logo, colours, fonts, layout references, keywords, notes and avoid examples;
- generate schema-shaped mock Style Agent proposals without storing AI credentials in browser code;
- preview and edit tokens in a sandboxed iframe before activation;
- accept a validated style package explicitly, refresh the Elements menu and roll back through version history;
- export mood board data, style guide, tokens, manifest and the legacy-compatible HTML catalogue as a ZIP.

See `docs/moodboard-style-agent.md` for compatibility rules and backend boundaries.

## Why this works

The app is a static frontend:

- `index.html` is the entry point
- CSS, JS, images, and JSON assets are served directly from the repo
- there is no backend service or database required for the current build

## Files added for DigitalOcean

- `.do/app.yaml` for `doctl apps create --spec`
- `.do/deploy.template.yaml` for DigitalOcean's repo-based deploy flow

Before deploying, replace this placeholder in both files:

- `https://github.com/REPLACE_WITH_OWNER/REPLACE_WITH_REPO.git`

## Deploy from the DigitalOcean control panel

1. Push this project to GitHub.
2. In DigitalOcean, go to `Create -> Apps`.
3. Choose your GitHub repository.
4. Select the `main` branch.
5. Set the resource type to `Static Site`.
6. Keep the source directory as `/`.
7. Confirm that the index document is `index.html`.
8. Review and deploy.

Because this app loads local JSON files with `fetch()`, it must be served over HTTP from App Platform and not opened directly from disk in the browser.

## Deploy with doctl

After replacing the GitHub URL in `.do/app.yaml`:

```bash
doctl auth init
doctl apps create --spec .do/app.yaml
```

## Notes

- Auto-deploy on push can be enabled when you connect the repository in App Platform.
- No environment variables are required for the current version of the app.
- If you later add client-side routing, set a fallback document such as `catchall_document: index.html`.
