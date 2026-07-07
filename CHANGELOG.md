# Changelog

All notable changes to this project are documented here.

## 0.1.0 — 2026-07-06

Initial release.

- Single **ImagineArt** node authenticated with the **ImagineArt OAuth2 API**
  credential (OAuth 2.0 + PKCE public client, environment-switched Client ID —
  no API key).
- Actions grouped by resource:
  - **Image**: Generate, Enhance, Remove Background, Logo, Instagram Post,
    Interior Design, YouTube Thumbnail, Giant Product Showcase, UGC Try-On,
    Get Result.
  - **Video**: Generate, Drone, Product Ad, Cooking, Jewelry, 3D Logo
    Animation, Get Result.
  - **Audio**: Generate Music, Get Result.
  - **Ad Studio**: List/Create Products, Avatars, Templates, Projects; Upload
    Image; Get Product Status; Generate Ad; Get Result.
  - **Asset**: List Generations, List Uploaded Assets, Upload.
  - **Account**: Get Balance.
- **Asynchronous by design (Submit + Get Result).** Every generation action
  returns a queued `assetId`; a matching **Get Result** action downloads the
  finished media (poll behind a Wait/If loop). Chained recipes (cooking,
  jewelry, 3D logo) submit their first image stage and auto-advance to the video
  inside the same Get Result loop. No in-process timers are used.
- Organization and workspace-folder pickers (dynamic dropdowns).
- Node usable as an AI Agent tool.
- **n8n Cloud eligible**: no runtime dependencies, no restricted globals,
  default cloud ESLint config, `strict: true` — `npx n8n-node cloud-support`
  reports *eligible*. Cloud listing still requires Creator Portal submission.
- Documentation: per-operation prompts/configs, model reference, and two
  end-to-end example workflows in `docs/TESTING.md`.
