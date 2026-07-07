import {
	buildAdForm,
	collectPhotos,
	mapAvatarRows,
	mapProductRows,
	mapProjectRows,
	mapProjectsToOptions,
	mapTemplateRows,
} from '../nodes/ImagineArt/transport/adStudio';
import { buildMultipartBody } from '../nodes/ImagineArt/transport/request';

describe('buildAdForm', () => {
	it('builds the fixed ad-studio form with defaults and repeated image_url refs', () => {
		const form = buildAdForm({
			prompt: 'a punchy 5s ad',
			marketProjectId: 'proj_1',
			orgId: 'org_1',
			images: [
				{ url: 'https://cdn/a.png', id: 'bd_a' },
				{ url: 'https://cdn/b.png' },
			],
		});
		expect(form.style_id).toBe('40006');
		expect(form.variation).toBe('reference_to_video');
		expect(form.aspect_ratio).toBe('9:16');
		expect(form.duration).toBe('4');
		expect(form.resolution).toBe('480p');
		expect(form.is_enhance).toBe('0');
		expect(form.enhancer_id).toBe('kling_t2v_prompt_enhancer');
		expect(form.market_project_id).toBe('proj_1');
		expect(form.org_id).toBe('org_1');
		// image_url is a repeated field: one JSON {url,id} per reference (id defaults to '').
		expect(form.image_url).toEqual([
			JSON.stringify({ url: 'https://cdn/a.png', id: 'bd_a' }),
			JSON.stringify({ url: 'https://cdn/b.png', id: '' }),
		]);
		expect(form.parent_id).toBeUndefined();
	});

	it('honors overrides and folderId (parent_id), and drops empty image refs', () => {
		const form = buildAdForm({
			prompt: 'x',
			marketProjectId: 'p',
			orgId: 'o',
			folderId: 'fld_9',
			images: [{ url: '' }, { url: '  ' }],
			aspectRatio: '16:9',
			duration: '8',
			resolution: '720p',
		});
		expect(form.aspect_ratio).toBe('16:9');
		expect(form.duration).toBe('8');
		expect(form.resolution).toBe('720p');
		expect(form.parent_id).toBe('fld_9');
		expect(form.image_url).toBeUndefined();
	});

	it('serializes a repeated field into multiple parts via buildMultipartBody', () => {
		const form = buildAdForm({
			prompt: 'x',
			marketProjectId: 'p',
			orgId: 'o',
			images: [{ url: 'https://cdn/a.png', id: '1' }, { url: 'https://cdn/b.png', id: '2' }],
		});
		const { body } = buildMultipartBody(form);
		const count = body.split('name="image_url"').length - 1;
		expect(count).toBe(2);
	});
});

describe('market list mappers', () => {
	it('maps products, avatars, templates, and projects', () => {
		expect(
			mapProductRows([{ id: 'pr1', name: 'Shoe', category: 'footwear', type: 'user', status: 'finished' }]),
		).toEqual([
			{
				id: 'pr1',
				name: 'Shoe',
				category: 'footwear',
				type: 'user',
				description: null,
				status: 'finished',
				photos: null,
			},
		]);
		expect(mapAvatarRows([{ id: 7, name: 'Ava', gender: 'female' }])[0]).toMatchObject({
			id: 7,
			name: 'Ava',
			gender: 'female',
		});
		expect(mapTemplateRows([{ id: 3, name: 'Bold', video_url: 'v', thumbnail: 't' }])[0]).toMatchObject({
			id: 3,
			name: 'Bold',
			videoUrl: 'v',
			thumbnail: 't',
		});
		expect(mapProjectRows([{ uuid: 'u1', name: 'Launch', thumbnail: 'th' }])).toEqual([
			{ marketProjectId: 'u1', name: 'Launch', thumbnail: 'th' },
		]);
	});

	it('mapProjectsToOptions keeps projects with a uuid', () => {
		expect(
			mapProjectsToOptions([{ uuid: 'u1', name: 'Launch' }, { name: 'no id' }]),
		).toEqual([{ name: 'Launch', value: 'u1' }]);
	});

	it('returns [] for non-array bodies', () => {
		expect(mapProductRows(null)).toEqual([]);
		expect(mapProjectRows({})).toEqual([]);
	});
});

describe('collectPhotos', () => {
	it('keeps requested keys, drops empties, and requires a url', () => {
		expect(
			collectPhotos(
				[
					{ url: 'https://cdn/a.png', bytedanceId: 'bd_a' },
					{ url: '', bytedanceId: 'x' },
					{ url: 'https://cdn/b.png', bytedanceId: '' },
				],
				['url', 'bytedanceId'],
			),
		).toEqual([
			{ url: 'https://cdn/a.png', bytedanceId: 'bd_a' },
			{ url: 'https://cdn/b.png' },
		]);
	});

	it('supports url-only photos (avatars)', () => {
		expect(collectPhotos([{ url: 'https://cdn/a.png', bytedanceId: 'ignored' }], ['url'])).toEqual([
			{ url: 'https://cdn/a.png' },
		]);
	});
});
