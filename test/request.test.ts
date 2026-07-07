import {
	buildImageForm,
	buildMultipartBody,
	buildMultipartWithFile,
	buildMusicForm,
	buildVideoForm,
} from '../nodes/ImagineArt/transport/request';

describe('buildImageForm', () => {
	it('builds the multipart field map with fixed resolution/count', () => {
		expect(
			buildImageForm({
				prompt: 'a cat',
				styleId: '40602',
				variation: 'txt2img',
				aspectRatio: '1:1',
				orgId: 'org_1',
			}),
		).toEqual({
			prompt: 'a cat',
			style_id: '40602',
			variation: 'txt2img',
			aspect_ratio: '1:1',
			resolution: '1K',
			count: '1',
			org_id: 'org_1',
		});
	});
});

describe('buildVideoForm', () => {
	it('includes resolution + image_url when provided (image-to-video)', () => {
		expect(
			buildVideoForm({
				prompt: 'a wave',
				styleId: '17001',
				variation: 'image_to_video',
				aspectRatio: '16:9',
				duration: '6',
				orgId: 'org_1',
				resolution: '1080p',
				imageUrl: 'https://cdn/p.png',
			}),
		).toEqual({
			prompt: 'a wave',
			style_id: '17001',
			variation: 'image_to_video',
			aspect_ratio: '16:9',
			count: '1',
			duration: '6',
			org_id: 'org_1',
			resolution: '1080p',
			image_url: 'https://cdn/p.png',
		});
	});

	it('omits resolution and image_url when not provided', () => {
		const f = buildVideoForm({
			prompt: 'x',
			styleId: '1',
			variation: 'text_to_video',
			aspectRatio: '16:9',
			duration: '6',
			orgId: 'o',
		});
		expect(f.resolution).toBeUndefined();
		expect(f.image_url).toBeUndefined();
	});
});

describe('buildMusicForm', () => {
	it('maps prompt/duration/variation with the "var" field name', () => {
		expect(
			buildMusicForm({ prompt: 'lofi beat', duration: '15', variation: 'music', orgId: 'org_1' }),
		).toEqual({ prompt: 'lofi beat', duration: '15', var: 'music', org_id: 'org_1' });
	});
});

describe('parent_id (folder) threading', () => {
	it('adds parent_id when folderId is set, omits it otherwise', () => {
		expect(
			buildImageForm({
				prompt: 'x',
				styleId: '1',
				variation: 'txt2img',
				aspectRatio: '1:1',
				orgId: 'o',
				folderId: 'fld_1',
			}).parent_id,
		).toBe('fld_1');
		expect(
			buildVideoForm({
				prompt: 'x',
				styleId: '1',
				variation: 'text_to_video',
				aspectRatio: '16:9',
				duration: '6',
				orgId: 'o',
			}).parent_id,
		).toBeUndefined();
		expect(
			buildMusicForm({ prompt: 'x', duration: '5', variation: 'music', orgId: 'o', folderId: 'fld_2' })
				.parent_id,
		).toBe('fld_2');
	});
});

describe('buildMultipartWithFile', () => {
	it('serializes text fields plus a binary file part with the boundary content type', () => {
		const { body, contentType } = buildMultipartWithFile(
			{ ref_service: '0', title: 'User Upload' },
			'file',
			{ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), filename: 'upload.png', mimeType: 'image/png' },
		);
		expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
		const boundary = contentType.split('boundary=')[1];
		const text = body.toString('latin1');
		expect(text).toContain(`name="ref_service"\r\n\r\n0\r\n`);
		expect(text).toContain(
			`name="file"; filename="upload.png"\r\nContent-Type: image/png\r\n\r\n`,
		);
		expect(text.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true);
		// The raw PNG magic bytes survive intact in the body.
		expect(body.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
	});
});

describe('buildMultipartBody', () => {
	it('serializes fields as multipart with a boundary content type', () => {
		const { body, contentType } = buildMultipartBody({ prompt: 'a cat', count: '1' });
		expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
		const boundary = contentType.split('boundary=')[1];
		expect(body).toContain(
			`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\na cat\r\n`,
		);
		expect(body).toContain(`name="count"\r\n\r\n1\r\n`);
		expect(body.endsWith(`--${boundary}--\r\n`)).toBe(true);
	});
});
