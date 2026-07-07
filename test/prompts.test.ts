import {
	buildCookingSheetPrompt,
	buildCookingVideoPrompt,
	buildDronePrompt,
	buildGiantProductPrompt,
	buildInstagramPrompt,
	buildInteriorPrompt,
	buildJewelryImagePrompt,
	buildLogo3DImagePrompt,
	buildLogoAnimationPrompt,
	buildLogoPrompt,
	buildProductAdPrompt,
	buildUGCPrompt,
	buildYouTubeThumbnailPrompt,
	resolveInstagramFormat,
	resolveLogoAspect,
	resolveUGCAspect,
} from '../nodes/ImagineArt/transport/prompts';

describe('logo', () => {
	it('builds the logo prompt with defaults and quoted brand', () => {
		const p = buildLogoPrompt('Acme', '', '', '', '');
		expect(p).toContain('Professional logo for "Acme" — modern wordmark with icon, minimal, technology brand.');
		expect(p).toContain('Color scheme: brand blue and white. white background.');
	});
	it('resolves aspect from style keywords', () => {
		expect(resolveLogoAspect('wide horizontal lockup')).toBe('16:9');
		expect(resolveLogoAspect('minimal')).toBe('1:1');
	});
});

describe('instagram', () => {
	it('falls back to default brand style', () => {
		expect(buildInstagramPrompt('summer sale', '')).toContain(
			'Brand style: modern, vibrant, clean typography, lifestyle photography aesthetic.',
		);
	});
	it('resolves format to allowed values', () => {
		expect(resolveInstagramFormat('9:16')).toBe('9:16');
		expect(resolveInstagramFormat('bogus')).toBe('4:5');
	});
});

describe('youtube thumbnail', () => {
	it('omits the subject clause when empty and forbids text', () => {
		const p = buildYouTubeThumbnailPrompt('My Video', '', '');
		expect(p).toContain('YouTube thumbnail for a video about: My Video. Channel style: bold, high contrast, bright colors.');
		expect(p).not.toContain('Featured subject');
		expect(p).toContain('do NOT render any text');
	});
	it('includes the subject clause when present', () => {
		expect(buildYouTubeThumbnailPrompt('T', 'x', 'a red car')).toContain('Featured subject: a red car.');
	});
});

describe('interior', () => {
	it('appends the photo addendum only when a photo is present', () => {
		const withPhoto = buildInteriorPrompt('living room', '', '', '', true);
		const noPhoto = buildInteriorPrompt('living room', '', '', '', false);
		expect(withPhoto).toContain('Maintain the structural layout');
		expect(noPhoto).not.toContain('Maintain the structural layout');
		expect(noPhoto).toContain('Professional interior design visualization of a living room.');
	});
});

describe('giant product', () => {
	it('uses the default person and the scale suffix', () => {
		const p = buildGiantProductPrompt('');
		expect(p).toContain('towering over a stylishly dressed man who stands beside it');
		expect(p).toContain('building-sized scale');
	});
});

describe('ugc', () => {
	it('maps platform to aspect and product type to verb', () => {
		expect(resolveUGCAspect('tiktok')).toBe('9:16');
		expect(resolveUGCAspect('unknown')).toBe('4:5');
		expect(buildUGCPrompt('Nova Sneakers', 'wearable', '', '')).toContain(
			'woman, 25-30 years old, natural look, diverse wearing Nova Sneakers',
		);
	});
});

describe('drone', () => {
	it('normalizes shot type and applies the template', () => {
		const p = buildDronePrompt('a coastline', 'Top Down', '');
		expect(p).toContain("Perfect overhead bird's eye view of a coastline");
		expect(p).toContain('DJI-quality drone footage');
	});
	it('falls back to reveal for unknown shots', () => {
		expect(buildDronePrompt('x', 'zoom', '')).toContain('starts low, slowly ascends and reveals x');
	});
});

describe('product ad', () => {
	it('adds a mood clause and the motion suffix', () => {
		const p = buildProductAdPrompt('New watch launch', 'luxury');
		expect(p).toContain(
			'Cinematic product advertisement video. New watch launch, elegant gold and black palette',
		);
		expect(p).toContain('slow cinematic push-in');
	});
	it('omits the clause for an unknown mood', () => {
		expect(buildProductAdPrompt('brief', 'weird')).toContain(
			'Cinematic product advertisement video. brief, slow cinematic push-in',
		);
	});
});

describe('cooking (chained)', () => {
	it('uses defaults + duration in the sheet prompt', () => {
		expect(buildCookingSheetPrompt('', '', '', '')).toContain(
			'for a 15-second realistic fresh pasta-making tutorial video',
		);
	});
	it('references the dish + kitchen in the video prompt', () => {
		expect(buildCookingVideoPrompt('tacos', '', '', '10')).toContain(
			'making tacos in the Italian rustic-modern kitchen',
		);
	});
});

describe('jewelry (chained)', () => {
	it('uses the default ring + surface', () => {
		expect(buildJewelryImagePrompt('', '')).toContain(
			'a delicate rose gold ring with a lotus design and a sparkling diamond resting on a beige surface',
		);
	});
});

describe('3d logo (chained)', () => {
	it('uses the material style in both phases', () => {
		expect(buildLogo3DImagePrompt('')).toContain('Render it as a glossy glass and chrome material');
		expect(buildLogoAnimationPrompt('matte gold')).toContain('a matte gold material');
	});
});
