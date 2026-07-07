export interface VideoModelConfig {
	styleId: string;
	variation: string;
	aspectRatios: string[];
	durations: string[];
	resolutions: string[];
}

export const DEFAULT_VIDEO_MODEL = 'ltx-2.3';
export const DEFAULT_VIDEO_ASPECT = '16:9';
export const DEFAULT_VIDEO_DURATION = '6';

const DISPLAY: Record<string, string> = {
	'veo-3.1': 'Veo 3.1',
	'veo-3.1-fast': 'Veo 3.1 Fast',
	'seedance-2.0': 'Seedance 2.0',
	'seedance-2.0-fast': 'Seedance 2.0 Fast',
	'seedance-1.5-pro': 'Seedance 1.5 Pro',
	'seedance-pro-fast': 'Seedance Pro Fast',
	'kling-3.0-pro': 'Kling 3.0 Pro',
	'kling-2.6-pro': 'Kling 2.6 Pro',
	'kling-o3': 'Kling O3',
	'ltx-2.3': 'LTX 2.3',
	'wan-2.6': 'Wan 2.6',
	'wan-2.2': 'Wan 2.2',
	'pixverse-v6': 'Pixverse v6',
	happy_horse: 'Happy Horse',
};

// Ported from imagine-mcp/src/services/api/video_models.go — keep in sync.
// resolutions: first entry is the default; empty = the model takes no resolution field.
const MODELS: Record<string, VideoModelConfig> = {
	'veo-3.1-fast': { styleId: '17002', variation: 'text_to_video', aspectRatios: ['16:9', '9:16'], durations: ['4', '6', '8'], resolutions: ['720p', '1080p', '4k'] },
	'seedance-2.0-fast': { styleId: '21906', variation: 'text_to_video', aspectRatios: ['21:9', '16:9', '9:16', '3:4', '4:3', '1:1', 'auto'], durations: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: ['480p', '720p'] },
	happy_horse: { styleId: '23401', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: ['720p', '1080p'] },
	'seedance-2.0': { styleId: '21905', variation: 'text_to_video', aspectRatios: ['21:9', '16:9', '9:16', '3:4', '4:3', '1:1', 'auto'], durations: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: ['480p', '720p', '1080p'] },
	'ltx-2.3': { styleId: '23202', variation: 'text_to_video', aspectRatios: ['16:9', '9:16'], durations: ['6', '8', '10'], resolutions: ['1080p', '1440p', '2160p'] },
	'wan-2.6': { styleId: '22309', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'], durations: ['5', '10', '15'], resolutions: ['720p', '1080p'] },
	'seedance-1.5-pro': { styleId: '40005', variation: 'text_to_video', aspectRatios: ['21:9', '16:9', '9:16', '3:4', '4:3', '1:1'], durations: ['4', '5', '6', '7', '8', '9', '10', '11', '12'], resolutions: ['480p', '720p'] },
	'seedance-pro-fast': { styleId: '40004', variation: 'text_to_video', aspectRatios: ['16:9', '4:3', '1:1', '9:16', '21:9', '3:4'], durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], resolutions: ['480p', '720p', '1080p'] },
	'kling-2.6-pro': { styleId: '11017', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '1:1'], durations: ['5', '10'], resolutions: [] },
	'kling-o3': { styleId: '11021', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '1:1'], durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: [] },
	'kling-3.0-pro': { styleId: '11020', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '1:1'], durations: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: [] },
	'pixverse-v6': { styleId: '14010', variation: 'text_to_video', aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1', '2:3', '3:2', '21:9'], durations: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], resolutions: ['360p', '540p', '720p', '1080p'] },
	'veo-3.1': { styleId: '17001', variation: 'text_to_video', aspectRatios: ['16:9', '9:16'], durations: ['4', '6', '8'], resolutions: ['720p', '1080p', '4k'] },
	'wan-2.2': { styleId: '22701', variation: 'text_to_video', aspectRatios: [], durations: [], resolutions: [] },
};

function resolveOption(value: string, allowed: string[], preferred: string): string {
	if (value && allowed.includes(value)) return value;
	if (allowed.includes(preferred)) return preferred;
	if (allowed.length > 0) return allowed[0];
	return preferred;
}

export function resolveVideoModel(
	model: string,
	aspectRatio: string,
	duration: string,
): { model: string; aspectRatio: string; duration: string; config: VideoModelConfig } {
	const resolvedModel = MODELS[model] ? model : DEFAULT_VIDEO_MODEL;
	const config = MODELS[resolvedModel];
	return {
		model: resolvedModel,
		aspectRatio: resolveOption(aspectRatio, config.aspectRatios, DEFAULT_VIDEO_ASPECT),
		duration: resolveOption(duration, config.durations, DEFAULT_VIDEO_DURATION),
		config,
	};
}

// Mirrors the MCP: keep the requested resolution when the model allows it,
// else the model's first (default), else '' (the model takes no resolution).
export function resolveVideoResolution(config: VideoModelConfig, requested: string): string {
	const r = (requested ?? '').toLowerCase().trim();
	if (r && config.resolutions.includes(r)) return r;
	return config.resolutions[0] ?? '';
}

export function videoModelOptions(): Array<{ name: string; value: string }> {
	const keys = [DEFAULT_VIDEO_MODEL, ...Object.keys(MODELS).filter((k) => k !== DEFAULT_VIDEO_MODEL)];
	return keys.map((k) => ({ name: DISPLAY[k] ?? k, value: k }));
}

export function videoAspectRatioOptions(): Array<{ name: string; value: string }> {
	const all = new Set<string>();
	for (const m of Object.values(MODELS)) for (const a of m.aspectRatios) all.add(a);
	return [...all].map((a) => ({ name: a, value: a }));
}

export function videoDurationOptions(): Array<{ name: string; value: string }> {
	const all = new Set<string>();
	for (const m of Object.values(MODELS)) for (const d of m.durations) all.add(d);
	const sorted = [...all].sort((a, b) => {
		if (a === 'auto') return -1;
		if (b === 'auto') return 1;
		return Number(a) - Number(b);
	});
	return sorted.map((d) => ({ name: d === 'auto' ? 'Auto' : `${d}s`, value: d }));
}
