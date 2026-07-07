# n8n-nodes-imagineart

An [n8n](https://n8n.io/) community node for **[ImagineArt](https://www.imagine.art/)**.
Generate images, video and music, enhance images, remove backgrounds, build
marketing ads, and manage assets — all from your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Usage](#usage) · [Compatibility](#compatibility) · [Resources](#resources) · [Version history](#version-history)

## Installation

Self-hosted n8n: **Settings → Community Nodes → Install**, then enter
`@teamimagine/n8n-nodes-imagineart`. See the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

Authentication uses the **ImagineArt OAuth2 API** credential (OAuth 2.0 + PKCE) —
no API key required.

1. You need an ImagineArt account — sign up at <https://www.imagine.art/>.
2. Add an **ImagineArt OAuth2 API** credential and click **Connect** to approve
   access in the ImagineArt consent screen.
3. The Client ID is baked in; the **Client Secret** field is an unused
   placeholder (this is a public PKCE client — leave it as-is).

The token authorizes generations against the **Organization** you select on the
node (loaded from your account).

## Operations

A single **ImagineArt** node exposes every action, grouped by resource:

- **Image** — Generate, Enhance, Remove Background, Generate Logo, Instagram
  Post, Interior Design, YouTube Thumbnail, Giant Product Showcase, UGC Try-On
- **Video** — Generate, Get Result, Drone, Product Ad, Cooking, Jewelry, 3D Logo
  Animation
- **Audio** — Generate Music
- **Ad Studio** — List/Create Products, Avatars, Templates and Projects; Upload
  Image; Get Product Status; Generate Ad
- **Asset** — List Generations, List Uploaded Assets, Upload
- **Account** — Get Balance

The node is also usable as an **AI Agent tool**.

Which model each operation uses (and the valid aspect ratios / durations /
resolutions per model) is documented in
[docs/TESTING.md](docs/TESTING.md#models).

## Usage

- **Every generation is asynchronous (Submit + Get Result).** Generate/enhance/
  ad/music/video actions return a queued `assetId`; poll the matching **Get
  Result** action (Image / Video / Music / Ad Studio) — typically behind a
  **Wait** node with an **If** loop — to download the finished media as a binary.
- **Chained recipes** (cooking, jewelry, 3D logo) submit their first image stage
  and **auto-advance** to the video on the next poll, so one Get Result loop
  carries the whole recipe to the final clip.
- Image-input operations (Enhance, Remove Background, Product Ad, 3D Logo, …)
  accept a public image URL — chain the `url` a previous generation returns, so
  whole pipelines can run from a single prompt without uploading files.

Ready-to-paste prompts and configs for every operation, plus two end-to-end
example workflows with Mermaid diagrams, are in
[docs/TESTING.md](docs/TESTING.md).

## Compatibility

Developed and tested against n8n 2.28.x on Node.js 22. Installable on
**self-hosted** n8n today.

> **n8n Cloud eligible.** The node uses no in-process timers or runtime
> dependencies and passes the verified-node lint (`npx n8n-node cloud-support`
> reports *eligible*). Listing on n8n Cloud still requires submitting it through
> the [n8n Creator Portal](https://creators.n8n.io/nodes).

## Resources

- [ImagineArt](https://www.imagine.art/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

See [CHANGELOG.md](CHANGELOG.md).
