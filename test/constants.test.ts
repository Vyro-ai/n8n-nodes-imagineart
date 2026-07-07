import { BASE_URLS } from '../nodes/ImagineArt/transport/constants';

describe('BASE_URLS', () => {
	it('are the production hosts', () => {
		expect(BASE_URLS).toEqual({
			auth: 'https://auth.vyro.ai/apis/v1',
			vag: 'https://imagine.vyro.ai/v1',
			team: 'https://teams-imagine.vyro.ai/v1',
		});
	});
});
