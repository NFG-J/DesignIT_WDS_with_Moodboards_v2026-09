# DesignIT Web Design Studio with Moodboards

A static browser-based web design studio for exploring, styling, dragging, previewing and exporting reusable HTML components. This version adds a local Mood Board and Style Agent workflow based on the included SDD.

## What This Project Does

- Browse HTML, JavaScript and Web API component catalogues
- Drag components onto a design canvas
- View generated HTML, CSS, JS and references
- Export designs as ZIP files
- Build a mood board with colours, fonts, images, notes and style constraints
- Generate mock style proposals locally
- Preview style packages before applying them
- Activate, roll back and export style packages

## Project Status

This is a local/static MVP. The Style Agent currently uses deterministic mock proposals and browser local storage. No AI credentials are stored in frontend code.

## Run Locally

```bash
cd DesignIT-arbeidspakke_3-main-main
python3 -m http.server 8765
Then open:
http://127.0.0.1:8765/
Important Files
- DesignIT-arbeidspakke_3-main-main/index.html - main app
- DesignIT-arbeidspakke_3-main-main/js/modules/ - app modules
- DesignIT-arbeidspakke_3-main-main/schemas/ - mood-board/style-package schemas
- DesignIT-arbeidspakke_3-main-main/data/style-packages/ - active and classic style packages
- DesignIT_Moodboard_Style_Agent_SDD_v1.0.md - full specification
Validation
The repo includes contract tests for schemas, catalogues and package validation:
cd DesignIT-arbeidspakke_3-main-main
npm test
Roadmap
- FastAPI backend
- Durable project and asset storage
- Real provider-neutral Style Agent service
- Server-side validation and atomic package activation
- Shared projects, comments and reviewer roles
