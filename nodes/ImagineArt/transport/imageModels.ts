export interface ImageModelConfig {
	styleId: string;
	variation: string;
	aspectRatios: string[];
}

export const DEFAULT_IMAGE_MODEL = 'nano-banana-pro';
export const DEFAULT_IMAGE_ASPECT = '1:1';

// Display names for the dropdown.
const DISPLAY: Record<string, string> = {
	'nano-banana-pro': 'Nano Banana Pro',
	'imagine-art-2.0': 'ImagineArt 2.0',
	'nano-banana-2': 'Nano Banana 2',
	'gpt-image-2': 'GPT Image 2',
	'imagine-art-1.5': 'ImagineArt 1.5',
	'imagine-art-1.5-pro': 'ImagineArt 1.5 Pro',
	'recraft-v4.1': 'Recraft v4.1',
	'ideogram-v4': 'Ideogram v4',
	'seedream-v5-lite': 'Seedream v5 Lite',
	'xAI-grok-imagine': 'xAI Grok Imagine',
};

// Ported from imagine-mcp/src/services/api/image_models.go — keep in sync.
const MODELS: Record<string, ImageModelConfig> = {
	'nano-banana-pro': {
		styleId: '40602',
		variation: 'txt2img',
		aspectRatios: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'],
	},
	'imagine-art-2.0': {
		styleId: '41601',
		variation: 'txt2img',
		aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4', '2:3', '3:2', '21:9', '4:5', '5:4'],
	},
	'nano-banana-2': {
		styleId: '40603',
		variation: 'txt2img',
		aspectRatios: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'],
	},
	'gpt-image-2': {
		styleId: '41701',
		variation: 'txt2img',
		aspectRatios: ['1:1', '4:3', '3:4', '3:2', '16:9', '9:16', '21:9', '2:3'],
	},
	'imagine-art-1.5': {
		styleId: '41001',
		variation: 'txt2img',
		aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4', '1:3', '3:1', '2:3', '3:2'],
	},
	'imagine-art-1.5-pro': {
		styleId: '41001',
		variation: 'txt2img',
		aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4', '1:3', '3:1', '2:3', '3:2'],
	},
	'recraft-v4.1': {
		styleId: '40906',
		variation: 'txt2img',
		aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
	},
	'ideogram-v4': {
		styleId: '40205',
		variation: 'txt2img',
		aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
	},
	'seedream-v5-lite': {
		styleId: '60003',
		variation: 'txt2img',
		aspectRatios: ['1:1', '2:3', '3:2', '4:3', '3:4', '16:9', '9:16'],
	},
	'xAI-grok-imagine': {
		styleId: '41401',
		variation: 'txt2img',
		aspectRatios: ['2:1', '20:9', '19.5:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:19.5', '9:20', '1:2'],
	},
};

// Maps caller input to a validated config. Unknown model -> default model;
// an aspect ratio not allowed for the resolved model -> default aspect ratio.
export function resolveImageModel(
	model: string,
	aspectRatio: string,
): { model: string; aspectRatio: string; config: ImageModelConfig } {
	const resolvedModel = MODELS[model] ? model : DEFAULT_IMAGE_MODEL;
	const config = MODELS[resolvedModel];
	const resolvedAspect =
		aspectRatio && config.aspectRatios.includes(aspectRatio) ? aspectRatio : DEFAULT_IMAGE_ASPECT;
	return { model: resolvedModel, aspectRatio: resolvedAspect, config };
}

export function imageModelOptions(): Array<{ name: string; value: string }> {
	const keys = [DEFAULT_IMAGE_MODEL, ...Object.keys(MODELS).filter((k) => k !== DEFAULT_IMAGE_MODEL)];
	return keys.map((k) => ({ name: DISPLAY[k] ?? k, value: k }));
}

export function aspectRatioOptions(): Array<{ name: string; value: string }> {
	const all = new Set<string>();
	for (const m of Object.values(MODELS)) {
		for (const a of m.aspectRatios) all.add(a);
	}
	return [...all].map((a) => ({ name: a, value: a }));
}
