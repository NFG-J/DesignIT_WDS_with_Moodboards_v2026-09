# DesignIT Web Design Studio
## Mood Board and Style Agent — SDD Specification v1.0

**Status:** Implementation-ready draft  
**Target:** Codex or equivalent coding agent  
**Date:** 2 September 2026  
**Based on:** `DesignIT-arbeidspakke_3-main-main.zip`

## 1. Purpose and product outcome

Extend DesignIT Web Design Studio with a guided mood-board workflow. A user collects or uploads a logo, font preferences, colours, image references, layout examples, keywords, and accessibility preferences. An AI-supported Style Agent analyses this material and proposes a coherent visual direction. Nothing is published or overwritten until the user previews and explicitly accepts the proposal.

After acceptance, the system generates a versioned style package and a styled component catalogue for the existing Elements menu. The package includes validated JSON, permitted image assets, design tokens, provenance metadata, and a rollback snapshot. The Elements menu reloads from the newly activated package without breaking the current drag-and-drop, canvas, code tabs, history, or export functions.

### 1.1 Primary success criterion

A non-technical user can move from a small set of visual references to a coherent, accessible and reusable component style in one guided session, while retaining control over every generated change.

### 1.2 Design principles

- Human approval before activation.
- Preview before replacement.
- Versioned, atomic and reversible changes.
- Design tokens before ad hoc component styling.
- Preserve semantic HTML and component behaviour.
- Separate user assets, generated assets and application assets.
- Explain important agent choices in plain language.
- Treat uploaded and retrieved content as untrusted input.

## 2. Existing system assessment

The supplied project is a static browser application. `index.html` loads ES modules and three local catalogues:

- `data/html_components.json`
- `data/js_components.json`
- `data/api_components.json`

`ComponentManager` fetches these files, stores their arrays and renders the Elements menu. The HTML catalogue uses the fields `Title`, `HTML`, `CSS`, and `Reference`. `CanvasManager` handles dropped content; separate managers cover history, export, tabs, notifications, resizing, copying and errors. `excel_to_json2.py` converts an Excel component list to the HTML JSON format. Images currently live under `img/`.

The present static deployment cannot safely call an AI model or replace shared server files: it has no authenticated user, durable project store, write API, transaction boundary, or secure location for provider credentials. This development therefore requires a small backend while retaining the existing frontend as far as practical.

## 3. Scope

### 3.1 MVP scope (v1.0)

1. Create, save, reopen and delete a mood board within a project.
2. Add:
   - logo files (PNG, JPEG, WebP or SVG after sanitisation);
   - reference images;
   - up to eight colour swatches;
   - font choices or font descriptors;
   - layout reference cards;
   - audience, brand attributes and free-text notes;
   - optional “avoid” examples and accessibility target.
3. Reorder, label and remove mood-board items.
4. Ask the Style Agent for one primary proposal and up to two alternatives.
5. Present proposal rationale, design tokens, typography, colour roles, layout rules and representative components.
6. Preview the proposal in an isolated preview frame using representative pages/components.
7. Allow the user to request revisions or directly edit tokens before accepting.
8. On explicit acceptance, generate and validate a complete style package.
9. Activate the package atomically and refresh the Elements menu.
10. Keep prior versions and support rollback.
11. Export the mood board, accepted style guide, tokens, catalogues and assets as a ZIP.

### 3.2 Recommended v1.1 scope

- Shared projects, comments and named reviewers.
- Brand-guideline PDF ingestion.
- Approved external image search with licence metadata.
- Multiple component packs per project.
- GitHub pull-request publication mode.
- WCAG contrast remediation suggestions and automated visual regression tests.

### 3.3 Out of scope for v1.0

- Training or fine-tuning a model.
- Autonomous publication without confirmation.
- General-purpose website generation or CMS functions.
- Scraping arbitrary websites.
- Automatic acquisition of commercial font licences.
- Rewriting JavaScript/API component behaviour unless the user specifically enables a future advanced mode.

## 4. Users and roles

### 4.1 Designer/learner

Builds the mood board, requests proposals, edits suggestions, previews results and accepts a style for their own project.

### 4.2 Teacher/reviewer

Opens a project, reviews the rationale and accessibility report, and may comment in a later release. In v1.0 this can be a read-only project link or local demo role.

### 4.3 Administrator

Configures the AI provider, storage limits, accepted file types, system component templates and retention policy. Can inspect failed jobs but cannot silently accept a proposal on behalf of a user.

## 5. Core user journey

1. User opens a project and chooses **Mood board**.
2. User adds references, brand inputs and constraints.
3. The application validates files and shows a board summary.
4. User selects **Suggest style**.
5. The server creates an immutable analysis job from the current board revision.
6. The Style Agent returns structured proposals, never direct file writes.
7. User compares proposals and opens a live preview.
8. User edits tokens or asks for a bounded revision.
9. User selects **Accept and apply** and confirms the affected files.
10. The server generates a candidate package in staging, validates it and displays a change summary.
11. After final confirmation, the server creates a snapshot and atomically changes the active package pointer.
12. The frontend reloads the Elements menu and reports the new style version. User can roll back at any time.

## 6. Functional requirements

### FR-01 Project and mood-board lifecycle

- Every board belongs to a project and has an ID, title, owner/session, revision number, timestamps and status.
- Status values: `draft`, `ready`, `analysing`, `proposed`, `accepted`, `archived`.
- Editing a board after an analysis increments its revision and marks older proposals as based on a previous revision.
- Autosave uses a short debounce and gives visible saved/error status.

### FR-02 Mood-board item model

Each item has a stable ID, type, source, optional asset ID, label, notes, sort order, creation timestamp and extracted metadata. Supported types are `logo`, `image`, `colour`, `font`, `layout`, `keyword`, `note`, and `avoid`.

### FR-03 Upload and asset handling

- Validate content by detected MIME type, not filename alone.
- Default maximum: 10 MB per raster image, 2 MB per SVG, 30 items per board.
- Strip metadata from raster images and create a preview derivative.
- Sanitise SVG; reject scripts, event handlers, foreign objects and external resource references.
- Use content hashes and generated storage names; never use a user-supplied path.
- Store the original only when policy allows; otherwise retain a cleaned derivative.
- Show provenance and require the user to confirm that they may use uploaded assets.

### FR-04 Colour and typography input

- Colour picker supports HEX entry and role labels.
- Show duplicate/near-duplicate swatches and basic contrast indicators.
- Font input supports system fonts and an allowlist of open-licence web fonts.
- If a font cannot legally or technically be bundled, propose fallback stacks instead of downloading it.

### FR-05 Agent analysis

The agent receives a normalised board manifest, thumbnails or model-compatible image inputs, project purpose, target audience, constraints and the component schema. It returns schema-constrained JSON with:

- concise style name and summary;
- evidence linked to board item IDs;
- brand attributes and tone;
- colour tokens with semantic roles;
- typography scale and fallback stacks;
- spacing, radius, border, shadow and motion tokens;
- grid, density, responsive and imagery rules;
- component treatment rules;
- accessibility observations and known risks;
- one primary direction and optionally two materially distinct alternatives;
- confidence/uncertainty notes.

The agent must not claim factual brand provenance, licences or accessibility compliance that has not been verified.

### FR-06 Proposal review and refinement

- The user can compare proposals by summary, tokens and preview.
- Rationale must cite board items by label/thumbnail rather than vague claims.
- User can lock chosen tokens before asking for a revision.
- Revision requests have a maximum length and operate on a stored proposal version.
- The system retains the proposal history.

### FR-07 Preview

- Render in a sandboxed `iframe` from candidate package data, not by injecting generated code into the studio document.
- Preview at desktop, tablet and mobile widths.
- Include at least: header/navigation, hero, buttons, cards, form controls, content section and footer.
- Show colour contrast findings and overflow/errors alongside the preview.
- Preview must not mutate the active package.

### FR-08 Component generation

- Prefer transformation of approved base components over unconstrained generation.
- Preserve semantic HTML, labels, keyboard behaviour and existing JS/API behaviour.
- Prefix generated CSS selectors with a package namespace or scope them beneath a project root to minimise collisions.
- Generate stable component IDs. Keep the existing legacy fields during migration.
- No inline scripts in HTML components.
- No remote scripts, tracking pixels, `javascript:` URLs or unapproved external assets.
- Images referenced by catalogue entries must resolve through the package manifest.

### FR-09 Validation and change set

Before acceptance can be activated, the backend must:

- validate every JSON document against its schema;
- parse generated HTML and CSS;
- reject unsafe tags, attributes, URLs and CSS constructs;
- confirm asset existence and allowed MIME types;
- check unique IDs/titles and required fields;
- run accessibility checks on representative previews;
- run component rendering smoke tests;
- calculate a manifest with hashes;
- produce a human-readable diff: added, modified, removed and unchanged items.

A failed validation leaves the active package untouched and gives actionable error messages.

### FR-10 Explicit acceptance and atomic activation

- Button label: **Accept and apply style**.
- First confirmation shows proposal/version and change counts.
- Destructive removals require a second, clearly worded confirmation.
- Generate into a staging version; never overwrite active files individually.
- Create a backup snapshot before activation.
- Activate by changing one server-side `active_version` pointer or equivalent atomic rename.
- Reload catalogues through a versioned API/URL to avoid browser-cache staleness.

### FR-11 Rollback and audit

- Retain at least the latest 10 accepted style-package versions per project in development; make this configurable.
- Version history shows creator, time, board revision, proposal version, validation status and change summary.
- Rollback creates a new activation event; it does not erase history.
- Audit log records proposal generation, acceptance, activation, rollback and validation failures without storing secrets.

### FR-12 Export

Export ZIP contains:

- `moodboard.json` and contact sheet/HTML view;
- `style-guide.html`;
- `tokens.json` and `tokens.css`;
- `components/html_components.json`;
- unchanged or explicitly generated JS/API catalogues;
- `assets/` with used assets only;
- `manifest.json`, `LICENSES.md` and `README.md`.

## 7. Proposed information architecture and interface

Keep the existing three-column studio. Add a top-level workspace switch or modal/drawer with four steps:

1. **Collect** — mood-board grid and brand brief.
2. **Suggest** — proposal cards and rationale.
3. **Preview** — responsive preview plus token inspector.
4. **Apply** — validation report, file diff, confirmation and version history.

Add a compact active-style indicator to the existing top bar. The Elements panel should gain a **Styled Components** group, or display the active styled catalogue through the current HTML group. For the MVP, preserve the original JavaScript and Web API groups unless a generated package explicitly declares replacements.

### Empty and error states

- Explain the minimum useful board: for example, one logo/reference, three colours or descriptive keywords, audience and two style attributes.
- Permit analysis with fewer inputs but flag low confidence.
- Provide retry for network/model failure without duplicating jobs.
- If catalogue reload fails after activation, automatically restore the prior active pointer and report the rollback.

## 8. Target architecture

### 8.1 Recommended stack

- **Frontend:** existing HTML/CSS/ES modules, incrementally extended; no framework migration required for v1.0.
- **Backend:** Python FastAPI with Pydantic models and OpenAPI.
- **Database:** SQLite for local development; PostgreSQL for shared deployment.
- **Assets:** local filesystem in development; S3-compatible object storage in production.
- **Jobs:** synchronous development adapter plus a background worker interface; use Redis/RQ or equivalent only when deployment needs it.
- **AI integration:** provider-neutral `StyleAgentProvider` interface; credentials server-side only.
- **Testing:** Pytest for backend, Vitest for frontend modules, Playwright for critical end-to-end flows, axe-core for automated accessibility checks.

FastAPI is recommended because the repository already uses Python for catalogue conversion, while the product requires a small, schema-heavy API rather than a full CMS. A Django implementation is acceptable if user accounts, admin workflows or institutional multi-project management are immediate requirements; the API and data contracts below should remain unchanged.

### 8.2 Component boundaries

- `MoodboardManager`: client-side board interactions and autosave.
- `AssetManager`: upload, validation, thumbnails and provenance.
- `ProposalManager`: start/poll analysis jobs, compare and revise proposals.
- `PreviewManager`: isolated responsive preview.
- `StylePackageManager`: candidate generation, validation, activation and rollback.
- `CatalogAdapter`: translates package schema to the current `ComponentManager` arrays.
- `StyleAgentService`: orchestration and provider abstraction.
- `PackageValidator`: schema, security, reference, render and accessibility checks.
- `VersionRepository`: immutable versions, active pointer and audit events.

## 9. Data contracts

### 9.1 Mood board (abbreviated)

```json
{
  "schemaVersion": "1.0",
  "id": "mb_...",
  "projectId": "prj_...",
  "revision": 4,
  "title": "Warm modular commerce",
  "brief": {
    "purpose": "Product knowledge website",
    "audience": ["SME buyers"],
    "attributes": ["warm", "credible", "modular"],
    "avoid": ["generic corporate blue"],
    "accessibilityTarget": "WCAG_2_2_AA"
  },
  "items": [
    {
      "id": "item_...",
      "type": "colour",
      "label": "Primary cyan",
      "value": "#00D8E8",
      "sortOrder": 10
    }
  ]
}
```

### 9.2 Style tokens (abbreviated)

```json
{
  "schemaVersion": "1.0",
  "packageId": "style_...",
  "name": "Warm Modular",
  "tokens": {
    "color": {
      "brandPrimary": {"value": "#006B73", "role": "actions"},
      "surface": {"value": "#FFFDF7", "role": "page background"},
      "text": {"value": "#172124", "role": "body text"}
    },
    "font": {
      "heading": {"value": "Tinos, Georgia, serif"},
      "body": {"value": "Inter, Arial, sans-serif"}
    },
    "space": {"2": "0.5rem", "4": "1rem", "8": "2rem"},
    "radius": {"sm": "0.375rem", "md": "0.75rem"}
  }
}
```

### 9.3 Component catalogue v2

Use a new internal schema, then expose legacy aliases during transition:

```json
{
  "schemaVersion": "2.0",
  "components": [
    {
      "id": "cmp_button_primary",
      "title": "Primary button",
      "category": "Actions",
      "html": "<button class=\"ds-btn ds-btn--primary\" type=\"button\">Continue</button>",
      "css": ".ds-btn { ... }",
      "javascript": "",
      "reference": "https://developer.mozilla.org/docs/Web/HTML/Element/button",
      "assets": [],
      "tags": ["button", "action"],
      "stylePackageId": "style_..."
    }
  ]
}
```

`CatalogAdapter` maps `title/html/css/reference` to current `Title/HTML/CSS/Reference` until `ComponentManager` natively supports v2.

### 9.4 Manifest

`manifest.json` records schema version, package ID/version, source board revision, source proposal ID/version, creation time, generator/model metadata, component and asset paths, SHA-256 hashes, licences/provenance and validation result.

## 10. API specification

All mutation endpoints require same-origin authentication/session protection and CSRF protection where cookie authentication is used.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/{projectId}` | Load project and active style |
| `PUT` | `/api/projects/{projectId}/moodboard` | Save a board revision |
| `POST` | `/api/projects/{projectId}/assets` | Upload and clean an asset |
| `DELETE` | `/api/projects/{projectId}/assets/{assetId}` | Remove unused asset |
| `POST` | `/api/projects/{projectId}/style-jobs` | Start analysis from a fixed board revision |
| `GET` | `/api/style-jobs/{jobId}` | Poll job status/result |
| `POST` | `/api/proposals/{proposalId}/revisions` | Request bounded refinement |
| `POST` | `/api/proposals/{proposalId}/candidate-package` | Generate staged package |
| `GET` | `/api/candidate-packages/{candidateId}` | Get preview, validation and diff |
| `POST` | `/api/candidate-packages/{candidateId}/activate` | Confirm and atomically activate |
| `GET` | `/api/projects/{projectId}/style-versions` | List version history |
| `POST` | `/api/projects/{projectId}/style-versions/{version}/rollback` | Activate an earlier package as a new event |
| `GET` | `/api/projects/{projectId}/catalogs/html` | Get active, cache-versioned catalogue |
| `GET` | `/api/projects/{projectId}/export` | Download project style export |

Long-running operations return `202 Accepted` with job ID. Use idempotency keys for analysis, candidate generation and activation.

## 11. Agent contract and prompting rules

The Style Agent is a constrained design assistant, not a repository-writing agent.

### Inputs

- normalised mood-board JSON and board revision;
- safe asset descriptors and model inputs;
- approved base-component inventory;
- output JSON Schema;
- accessibility and content-security rules;
- requested number of directions;
- locked tokens from any prior revision.

### Required behaviour

- Return JSON that validates against the proposal schema.
- Base rationale on supplied items and reference their IDs.
- Distinguish observation from inference.
- Keep alternatives meaningfully different.
- Prefer a small token system and reusable classes.
- Do not embed secrets, executable scripts, data URLs, tracking or arbitrary remote resources.
- If evidence conflicts, report the conflict and make a conservative recommendation.
- Never activate, overwrite or delete files.

### Generation strategy

Use two stages:

1. **Analyse:** produce style directions and tokens.
2. **Compile:** deterministic application code transforms approved templates using accepted tokens. Model-generated component markup may be allowed only for gaps and must pass the same validation pipeline.

This separation reduces stylistic drift and makes output testable.

## 12. Security, privacy and governance

- Store AI API keys only in backend environment variables or a secret manager.
- Enforce project-level authorisation on every asset, proposal and package request.
- Prevent path traversal; never allow model output to choose filesystem paths.
- Apply rate, size and item limits.
- Sanitize SVG and HTML and validate CSS; use a strict Content Security Policy.
- Preview generated content with sandbox restrictions and no same-origin privilege unless strictly required.
- Block remote network requests from validation/render workers by default.
- Do not send unnecessary originals or personal metadata to the model provider.
- Present a data-use notice before the first AI request.
- Provide deletion for project uploads and derived model inputs according to retention policy.
- Record model/provider/version in the manifest, but never prompts containing confidential user material in ordinary logs.
- Maintain asset provenance and licence declarations; “unknown” is an allowed and visible state.

## 13. Accessibility and quality requirements

- Target WCAG 2.2 AA for the application and generated representative components.
- All mood-board actions must be keyboard accessible; drag-and-drop must have button/menu alternatives.
- Provide labels, focus visibility, status announcements and reduced-motion support.
- Do not rely on colour alone to communicate roles.
- Validate normal-text and large-text contrast; flag rather than silently alter locked brand colours.
- Generated forms require labels and meaningful error states.
- Representative layouts must work at 320, 768 and 1440 CSS pixels without horizontal overflow.

## 14. Non-functional requirements

- Initial studio load under 2.5 seconds on a typical broadband connection, excluding uncached large user assets.
- Mood-board save response under 500 ms at p95 in the target deployment.
- Progress feedback within one second for agent operations; analysis may complete asynchronously.
- No loss of the active style if generation, validation or activation is interrupted.
- Catalogue activation and rollback are atomic.
- JSON schemas are versioned and migration-tested.
- App works in the latest two major versions of Chrome, Edge, Firefox and Safari.
- Structured logs include correlation/job IDs and exclude secrets and raw uploaded content.

## 15. Repository structure

```text
designit-web-studio/
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── img/
│   ├── js/
│   │   ├── app.js
│   │   └── modules/
│   │       ├── component_manager.js
│   │       ├── moodboard_manager.js
│   │       ├── asset_manager.js
│   │       ├── proposal_manager.js
│   │       ├── preview_manager.js
│   │       └── style_package_manager.js
│   └── data/base-components/
├── backend/
│   ├── app/main.py
│   ├── app/api/
│   ├── app/models/
│   ├── app/schemas/
│   ├── app/services/
│   │   ├── style_agent.py
│   │   ├── package_compiler.py
│   │   ├── package_validator.py
│   │   └── asset_service.py
│   ├── app/repositories/
│   ├── migrations/
│   └── tests/
├── schemas/
│   ├── moodboard.schema.json
│   ├── style-proposal.schema.json
│   ├── style-tokens.schema.json
│   ├── component-catalog.schema.json
│   └── package-manifest.schema.json
├── packages/                 # ignored runtime data in local development
│   └── {projectId}/{version}/
├── tests/e2e/
├── scripts/
│   ├── migrate_legacy_catalog.py
│   └── validate_style_package.py
├── docs/
│   ├── architecture.md
│   ├── agent-contract.md
│   └── threat-model.md
├── docker-compose.yml
├── .env.example
└── README.md
```

Retain the existing root layout during the first refactor if desired, but establish explicit frontend/backend boundaries before adding AI calls.

## 16. Migration and compatibility

1. Add JSON Schemas for existing catalogues and baseline tests before refactoring.
2. Move current static files under `frontend/` without changing behaviour.
3. Add `CatalogAdapter` and make catalogue URLs configurable.
4. Seed a `classic` immutable style package from the current JSON and `img/` files.
5. Add backend and project/session storage.
6. Add mood board and proposal flow.
7. Add candidate-package compiler and validator.
8. Enable atomic activation and rollback.
9. Deprecate direct Excel-to-production conversion; retain it as an import command that creates a validated candidate package.

The current `Title/HTML/CSS/Reference` schema remains supported throughout v1.0. Existing JS and API catalogues are copied unchanged unless a package manifest explicitly replaces them.

## 17. Testing strategy

### Unit tests

- Mood-board schemas and revision rules.
- MIME detection, image cleaning and SVG sanitisation.
- Token compilation and CSS scoping.
- Legacy catalogue adapter.
- Manifest/hash generation.
- Unsafe HTML/CSS/URL rejection.
- Contrast calculations.
- Activation transaction and rollback.

### Contract tests

- Agent response against JSON Schema, including malformed and partial responses.
- Provider adapter with recorded synthetic fixtures, never real user assets.
- Every API response against OpenAPI/Pydantic models.

### Integration tests

- Upload → board save → proposal → candidate → validation → activation.
- Failed generation leaves active package unchanged.
- Cache-versioned catalogue reload after activation.
- Rollback restores prior catalogue/assets.
- Export contains only manifest-listed files.

### End-to-end tests

- Keyboard-only mood-board creation.
- User rejects a proposal; no active files change.
- User accepts a proposal and sees styled elements.
- Validation failure prevents activation.
- Browser refresh preserves project and active style.

### Visual/accessibility tests

- Screenshots at 320/768/1440 widths for representative preview.
- Stable fixtures for classic and generated style packages.
- axe-core checks with documented exceptions; manual screen-reader and keyboard review before release.

## 18. Acceptance criteria for v1.0

The increment is accepted only when all statements below are true:

1. A user can build and reopen a mixed-item mood board.
2. The agent returns schema-valid, evidence-linked style proposals.
3. Proposals can be previewed without modifying the active catalogue.
4. User rejection or closing the dialog causes no active file change.
5. User acceptance produces a visible file/component change summary.
6. Invalid or unsafe generated content cannot be activated.
7. Activation changes the complete package atomically.
8. The Elements menu reloads the accepted HTML component catalogue and remains draggable.
9. Existing canvas, code tabs, undo/redo, clear and export functions still pass regression tests.
10. The user can restore the previous package through version history.
11. AI credentials are absent from browser code, generated exports and logs.
12. Uploaded SVG/HTML cannot execute scripts in the studio or preview origin.
13. Representative generated components meet the agreed accessibility checks or show explicit blocking failures.
14. A complete project/style export can be downloaded and revalidated.

## 19. Implementation backlog

### Epic A — Baseline and contracts (P0)

- Add schema validation tests for the three current JSON files.
- Define v1 mood-board, proposal, token, component and manifest schemas.
- Create the immutable `classic` package and a legacy adapter.
- Add regression tests for current drag/drop and export behaviour.

### Epic B — Backend foundation (P0)

- Scaffold FastAPI, database migrations and project endpoints.
- Add local/S3-compatible asset abstraction.
- Add secure configuration, CSP and audit event model.
- Serve frontend and cache-versioned catalogues in development.

### Epic C — Mood board (P0)

- Implement workspace UI, board grid and brief form.
- Implement uploads, sanitisation, thumbnails and provenance.
- Implement autosave, revision and error/empty states.
- Add keyboard alternatives to item ordering and removal.

### Epic D — Style Agent (P0)

- Define provider interface and mock provider.
- Implement structured output and validation/repair retry.
- Implement evidence-linked proposal UI and revisions with locked tokens.
- Add asynchronous job state and idempotency.

### Epic E — Preview and compiler (P0)

- Create deterministic token-to-CSS compiler.
- Transform representative/base components.
- Build sandboxed responsive preview and accessibility report.
- Generate candidate package, manifest and diff.

### Epic F — Activation and rollback (P0)

- Add confirmation flow and destructive-change warning.
- Implement snapshot, atomic pointer update and cache busting.
- Reload Elements catalogue without full app corruption.
- Implement version history, rollback and recovery test.

### Epic G — Export and hardening (P1)

- Generate complete ZIP with licences/provenance.
- Add rate/size limits, security tests and structured logs.
- Complete cross-browser, accessibility and visual regression testing.
- Write operator and user documentation.

## 20. Suggested delivery plan

For a small team or supervised student group, plan six two-week increments:

1. Baseline tests, schemas, architecture and classic package.
2. Backend, projects, secure uploads and board persistence.
3. Mood-board interface and accessible interactions.
4. Agent proposals, structured output and refinement.
5. Compiler, preview, validation and file diff.
6. Activation, rollback, export, security and release QA.

Do not connect a production AI provider until the mock-provider path, schemas and non-AI acceptance flow work end to end.

## 21. Codex execution instructions

When giving this specification to Codex, use the following operating constraints:

1. Inspect the repository and report any mismatch with this assessment before editing.
2. Create a short implementation plan and complete one epic or vertical slice at a time.
3. Preserve unrelated user changes and existing behaviour.
4. Establish baseline tests before structural refactoring.
5. Never place an AI credential in frontend code or commit generated secrets.
6. Use mock agent outputs for automated tests.
7. Treat model output as untrusted data; validate before preview and again before activation.
8. Never overwrite the active catalogue directly. Generate, validate, diff, snapshot and atomically activate.
9. Run unit, integration and relevant end-to-end tests after each slice.
10. At handoff, list changed files, tests run, known limitations and the next recommended slice.

### Recommended first Codex task

> Implement Epic A only. Add versioned JSON Schemas for the existing and proposed data contracts, validate the current catalogues, introduce a read-only `classic` style-package manifest, add a legacy catalogue adapter with tests, and document the compatibility rules. Do not add an AI provider or modify the user interface in this first task.

## 22. Definition of done

A story is done when code and schemas are reviewed; tests pass; security and accessibility implications are addressed; documentation is updated; error and empty states exist; no secrets or untracked generated assets are committed; and the feature can be demonstrated using synthetic or openly licensed assets. For activation-related work, rollback must also be demonstrated.

