import {
	isTerminal,
	isSuccess,
	isFailureStatus,
	parseStatusResponse,
	firstGenerationUrl,
} from '../nodes/ImagineArt/transport/status';

describe('status classification', () => {
	it('treats in-progress statuses as non-terminal', () => {
		for (const s of ['queued', 'generating', 'running', 'pending', 'processing', 'in_progress']) {
			expect(isTerminal(s)).toBe(false);
		}
	});

	it('treats finished and unknown error states as terminal', () => {
		expect(isTerminal('finished')).toBe(true);
		expect(isTerminal('error')).toBe(true);
		expect(isTerminal('failed')).toBe(true);
	});

	it('only finished is success', () => {
		expect(isSuccess('finished')).toBe(true);
		expect(isSuccess('error')).toBe(false);
	});

	it('is case-insensitive', () => {
		expect(isTerminal('FINISHED')).toBe(true);
		expect(isTerminal('Queued')).toBe(false);
	});

	it('flags explicit failure statuses', () => {
		expect(isFailureStatus('error')).toBe(true);
		expect(isFailureStatus('FAILED')).toBe(true);
		expect(isFailureStatus('finished')).toBe(false);
		expect(isFailureStatus('generating')).toBe(false);
	});
});

describe('parseStatusResponse + firstGenerationUrl', () => {
	it('parses assets and extracts the first generation url', () => {
		const body = {
			status: 'finished',
			assets: [{ status: 'finished', url: { generation: ['https://cdn/x.png'], thumbnail: [] } }],
		};
		const res = parseStatusResponse(body);
		expect(res.status).toBe('finished');
		expect(firstGenerationUrl(res)).toBe('https://cdn/x.png');
	});

	it('returns null when there is no generation url', () => {
		expect(firstGenerationUrl(parseStatusResponse({ status: 'finished', assets: [] }))).toBeNull();
	});

	it('tolerates a missing assets array', () => {
		expect(parseStatusResponse({ status: 'queued' }).assets).toEqual([]);
	});
});
