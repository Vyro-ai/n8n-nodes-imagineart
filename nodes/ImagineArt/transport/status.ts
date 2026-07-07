export interface StatusAsset {
	status: string;
	url?: { generation?: string[]; thumbnail?: string[]; processed?: string[] };
	asset_metadata?: Record<string, unknown>;
}

export interface StatusResponse {
	status: string;
	assets: StatusAsset[];
}

// Statuses ImagineArt treats as still-running (ported from imagine-mcp).
const NON_TERMINAL = new Set([
	'queued',
	'generating',
	'running',
	'pending',
	'processing',
	'in_progress',
]);

export function isTerminal(status: string): boolean {
	return !NON_TERMINAL.has((status ?? '').toLowerCase());
}

export function isSuccess(status: string): boolean {
	return (status ?? '').toLowerCase() === 'finished';
}

// Explicit failure states. Success is detected by the presence of a generation
// URL (status strings vary: the API has returned both "finished" and "success"),
// so we only need to recognise hard failures to stop polling early.
const FAILURE = new Set(['error', 'failed', 'cancelled', 'canceled', 'rejected']);

export function isFailureStatus(status: string): boolean {
	return FAILURE.has((status ?? '').toLowerCase());
}

export function parseStatusResponse(body: unknown): StatusResponse {
	const b = (body ?? {}) as { status?: string; assets?: StatusAsset[] };
	return { status: b.status ?? '', assets: Array.isArray(b.assets) ? b.assets : [] };
}

export function firstGenerationUrl(res: StatusResponse): string | null {
	for (const a of res.assets) {
		const url = a.url?.generation?.[0];
		if (url) return url;
	}
	return null;
}
