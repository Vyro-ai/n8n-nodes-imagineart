import { mapFoldersToOptions, mapOrgsToOptions } from '../nodes/ImagineArt/methods/loadOptions';

describe('mapOrgsToOptions', () => {
	it('maps the data[] array to name/value options', () => {
		const body = {
			data: [
				{ id: 'org_1', name: 'Personal', is_primary: true },
				{ id: 'org_2', name: 'Acme', is_primary: false },
			],
		};
		expect(mapOrgsToOptions(body)).toEqual([
			{ name: 'Personal', value: 'org_1' },
			{ name: 'Acme', value: 'org_2' },
		]);
	});

	it('returns [] for a malformed body', () => {
		expect(mapOrgsToOptions({})).toEqual([]);
		expect(mapOrgsToOptions(null)).toEqual([]);
	});
});

describe('mapFoldersToOptions', () => {
	it('keeps only folders and labels them with the workspace', () => {
		const body = {
			data: [
				{ id: 'f1', title: 'Campaigns', category: 'folder' },
				{ id: 'x1', title: 'An Image', category: 'image' },
				{ id: 'f2', name: 'Drafts', category: 'folder' },
			],
		};
		expect(mapFoldersToOptions(body, 'private')).toEqual([
			{ name: 'Campaigns (private)', value: 'f1' },
			{ name: 'Drafts (private)', value: 'f2' },
		]);
	});
	it('returns [] for a malformed body', () => {
		expect(mapFoldersToOptions(null, 'public')).toEqual([]);
	});
});
