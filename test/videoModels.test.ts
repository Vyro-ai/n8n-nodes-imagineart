import {
	resolveVideoModel,
	resolveVideoResolution,
	videoModelOptions,
} from '../nodes/ImagineArt/transport/videoModels';

describe('resolveVideoModel', () => {
	it('resolves a known model with allowed aspect ratio + duration', () => {
		const r = resolveVideoModel('veo-3.1', '9:16', '8');
		expect(r.model).toBe('veo-3.1');
		expect(r.config.styleId).toBe('17001');
		expect(r.aspectRatio).toBe('9:16');
		expect(r.duration).toBe('8');
	});

	it('falls back to the default model when unknown', () => {
		const r = resolveVideoModel('nope', '16:9', '6');
		expect(r.model).toBe('ltx-2.3');
		expect(r.config.styleId).toBe('23202');
	});

	it('falls back to a model-allowed duration when the requested one is not allowed', () => {
		// ltx-2.3 allows only 6/8/10; "4" is not allowed -> preferred default "6".
		const r = resolveVideoModel('ltx-2.3', '16:9', '4');
		expect(r.duration).toBe('6');
	});

	it('forces defaults for a model with no allow-lists (wan-2.2)', () => {
		const r = resolveVideoModel('wan-2.2', '1:1', '99');
		expect(r.aspectRatio).toBe('16:9');
		expect(r.duration).toBe('6');
	});
});

describe('resolveVideoResolution', () => {
	it('keeps a valid resolution, else the model default, else empty', () => {
		const veo = resolveVideoModel('veo-3.1', '16:9', '6').config;
		expect(resolveVideoResolution(veo, '4k')).toBe('4k');
		expect(resolveVideoResolution(veo, 'bogus')).toBe('720p');
		const kling = resolveVideoModel('kling-2.6-pro', '16:9', '5').config;
		expect(resolveVideoResolution(kling, '1080p')).toBe('');
	});
});

describe('videoModelOptions', () => {
	it('lists models with the default first', () => {
		const opts = videoModelOptions();
		expect(opts[0]).toEqual({ name: 'LTX 2.3', value: 'ltx-2.3' });
		expect(opts.map((o) => o.value)).toContain('veo-3.1');
	});
});
