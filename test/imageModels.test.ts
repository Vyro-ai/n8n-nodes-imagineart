import { resolveImageModel, imageModelOptions } from '../nodes/ImagineArt/transport/imageModels';

describe('resolveImageModel', () => {
	it('resolves a known model + allowed aspect ratio', () => {
		const r = resolveImageModel('nano-banana-pro', '16:9');
		expect(r.model).toBe('nano-banana-pro');
		expect(r.aspectRatio).toBe('16:9');
		expect(r.config.styleId).toBe('40602');
		expect(r.config.variation).toBe('txt2img');
	});

	it('falls back to the default model when unknown', () => {
		const r = resolveImageModel('does-not-exist', '1:1');
		expect(r.model).toBe('nano-banana-pro');
		expect(r.config.styleId).toBe('40602');
	});

	it('falls back to the default aspect ratio when not allowed for the model', () => {
		const r = resolveImageModel('recraft-v4.1', '21:9'); // not in recraft list
		expect(r.aspectRatio).toBe('1:1');
	});

	it('keeps an allowed non-default aspect ratio', () => {
		const r = resolveImageModel('recraft-v4.1', '16:9');
		expect(r.aspectRatio).toBe('16:9');
	});
});

describe('imageModelOptions', () => {
	it('lists models with the default first', () => {
		const opts = imageModelOptions();
		expect(opts[0]).toEqual({ name: 'Nano Banana Pro', value: 'nano-banana-pro' });
		expect(opts.map((o) => o.value)).toContain('gpt-image-2');
	});
});
