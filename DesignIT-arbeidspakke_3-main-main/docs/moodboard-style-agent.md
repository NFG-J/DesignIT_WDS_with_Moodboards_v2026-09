# Mood Board and Style Agent Implementation

This project now includes a local MVP of the SDD workflow while preserving the existing static Web Design Studio.

## Implemented

- Four-step workspace: Collect, Suggest, Preview and Apply.
- Mood-board lifecycle in local storage with revisioning, autosave, reopen and delete.
- Local upload checks for PNG, JPEG, WebP and sanitised SVG preview derivatives.
- Colour, typography, layout, keyword, note and avoid items.
- Mock Style Agent that returns schema-shaped proposals with evidence linked to mood-board items.
- Responsive sandboxed preview iframe for candidate packages.
- Token editing before activation.
- Candidate package validation, change summary, explicit acceptance, local active pointer and rollback.
- Export ZIP for the active candidate with moodboard, tokens, style guide, manifest, licences and legacy HTML catalogue.
- Versioned JSON Schemas for mood boards, proposals, tokens, component catalogues and package manifests.
- Read-only `classic` package seeded from the existing HTML catalogue.
- `CatalogAdapter` support for mapping v2 component catalogues into the legacy `Title`/`HTML`/`CSS`/`Reference` fields.

## Compatibility Rules

- The existing JavaScript and Web API catalogues continue to load from `data/js_components.json` and `data/api_components.json`.
- The HTML Elements group loads the active style package. With no accepted local package, it falls back to the immutable `classic` package.
- Accepted packages are stored in browser local storage for the static MVP; source JSON files are not overwritten during activation.
- Generated components are HTML/CSS only. Inline scripts, event handlers, remote scripts, unsafe URLs and unsafe CSS constructs are rejected before activation.
- Package CSS is scoped by a generated package class to reduce collisions with the studio shell and existing canvas behaviour.

## Backend Boundary

The SDD recommends FastAPI, SQLite, durable assets and a provider-neutral Style Agent service for production. This local MVP deliberately avoids production AI calls and credentials. The frontend is ready to swap the mock proposal flow for the API endpoints described in the SDD once a backend is added.

## Validation

Run:

```bash
npm test
```

The test script uses only Node built-ins. It validates schema files, current catalogues, the classic package mirror, v2-to-legacy catalogue mapping and unsafe HTML rejection.
