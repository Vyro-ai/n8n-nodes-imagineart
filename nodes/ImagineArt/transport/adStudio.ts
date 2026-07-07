import type { INodePropertyOptions } from 'n8n-workflow';

// Ad Studio (marketing-mode) transport: form builders, list mappers, and the
// option lists for the Ad Studio resource. Ported from imagine-mcp's market_*
// tools (src/services/api/api.go). The upstream endpoints live on the same VAG
// `/v1` base as the other generators (/market/*, /marketing-mode/*).

export const AD_STUDIO_STYLE_ID = '40006';
export const AD_STUDIO_ENHANCER_ID = 'kling_t2v_prompt_enhancer';

// One reference image for ad generation, forwarded upstream as a repeated
// `image_url` form value whose value is the JSON object {"url","id"}.
export interface AdImageRef {
	url: string;
	id?: string;
}

// Builds the /video/upload form for an ad-studio (reference-to-video)
// generation. style_id / variation / enhancer are fixed; image_url is repeated
// (one JSON {url,id} per reference); scope via org_id / parent_id.
export function buildAdForm(p: {
	prompt: string;
	marketProjectId: string;
	orgId: string;
	folderId?: string;
	images: AdImageRef[];
	aspectRatio?: string;
	duration?: string;
	resolution?: string;
}): Record<string, string | string[]> {
	const fields: Record<string, string | string[]> = {
		style_id: AD_STUDIO_STYLE_ID,
		variation: 'reference_to_video',
		count: '1',
		prompt: p.prompt,
		aspect_ratio: p.aspectRatio && p.aspectRatio.trim() !== '' ? p.aspectRatio : '9:16',
		duration: p.duration && p.duration.trim() !== '' ? p.duration : '4',
		resolution: p.resolution && p.resolution.trim() !== '' ? p.resolution : '480p',
		is_enhance: '0',
		enhancer_id: AD_STUDIO_ENHANCER_ID,
		market_project_id: p.marketProjectId,
		org_id: p.orgId,
	};
	// Each ref is the full {url, id} object (id defaults to '' to match the Go
	// AdImageRef marshaling, which always includes both keys).
	const refs = p.images
		.filter((im) => im.url && im.url.trim() !== '')
		.map((im) => JSON.stringify({ url: im.url, id: im.id ?? '' }));
	if (refs.length > 0) fields.image_url = refs;
	if (p.folderId) fields.parent_id = p.folderId;
	return fields;
}

// --- List response mappers (raw array -> clean JSON rows for node output) ---

type AnyRecord = Record<string, unknown>;

function asArray(body: unknown): AnyRecord[] {
	return Array.isArray(body) ? (body as AnyRecord[]) : [];
}

export function mapProductRows(body: unknown): AnyRecord[] {
	return asArray(body).map((p) => ({
		id: p.id ?? null,
		name: p.name ?? null,
		category: p.category ?? null,
		type: p.type ?? null,
		description: p.description ?? null,
		status: p.status ?? null,
		photos: p.photos ?? null,
	}));
}

export function mapAvatarRows(body: unknown): AnyRecord[] {
	return asArray(body).map((a) => ({
		id: a.id ?? null,
		name: a.name ?? null,
		gender: a.gender ?? null,
		category: a.category ?? null,
		type: a.type ?? null,
		description: a.description ?? null,
		photos: a.photos ?? null,
	}));
}

export function mapTemplateRows(body: unknown): AnyRecord[] {
	return asArray(body).map((t) => ({
		id: t.id ?? null,
		name: t.name ?? null,
		category: t.category ?? null,
		thumbnail: t.thumbnail ?? null,
		videoUrl: t.video_url ?? null,
		template: t.template ?? null,
	}));
}

export function mapProjectRows(body: unknown): AnyRecord[] {
	return asArray(body).map((p) => ({
		marketProjectId: p.uuid ?? null,
		name: p.name ?? null,
		thumbnail: p.thumbnail ?? null,
	}));
}

// Marketing projects -> loadOptions ({name, value: uuid}) for the Generate Ad
// "Project Name or ID" dropdown.
export function mapProjectsToOptions(body: unknown): Array<{ name: string; value: string }> {
	return asArray(body)
		.filter((p) => typeof p.uuid === 'string' && p.uuid)
		.map((p) => ({ name: (p.name as string) || (p.uuid as string), value: p.uuid as string }));
}

// Normalizes fixedCollection photo rows into the `[{url, ...}]` objects the
// market product/avatar endpoints store verbatim. Keeps only the given keys,
// drops empty values, and requires a url.
export function collectPhotos(
	entries: Array<Record<string, string | undefined>>,
	keys: string[],
): Array<Record<string, string>> {
	return entries
		.map((e) => {
			const o: Record<string, string> = {};
			for (const k of keys) {
				const v = (e[k] ?? '').trim();
				if (v) o[k] = v;
			}
			return o;
		})
		.filter((o) => typeof o.url === 'string' && o.url !== '');
}

// --- Option lists for the resource's static dropdowns ---

export function adOwnershipOptions(): INodePropertyOptions[] {
	return [
		{ name: 'All', value: 'all' },
		{ name: 'System', value: 'system' },
		{ name: 'User (Saved)', value: 'user' },
	];
}

export function adTemplateKindOptions(): INodePropertyOptions[] {
	return [
		{ name: 'Background', value: 'background' },
		{ name: 'Format', value: 'format' },
		{ name: 'Hook', value: 'hook' },
	];
}

export function adGenderOptions(): INodePropertyOptions[] {
	return [
		{ name: 'Female', value: 'female' },
		{ name: 'Male', value: 'male' },
		{ name: 'Neutral', value: 'neutral' },
	];
}

export function adAspectRatioOptions(): INodePropertyOptions[] {
	return [
		{ name: '1:1 (Square)', value: '1:1' },
		{ name: '16:9 (Landscape)', value: '16:9' },
		{ name: '4:5 (Portrait)', value: '4:5' },
		{ name: '9:16 (Vertical)', value: '9:16' },
	];
}

export function adResolutionOptions(): INodePropertyOptions[] {
	return [
		{ name: '1080p', value: '1080p' },
		{ name: '480p', value: '480p' },
		{ name: '720p', value: '720p' },
	];
}
