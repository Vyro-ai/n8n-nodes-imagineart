// Prompt builders ported verbatim from the imagine-mcp recipe generators
// (logo_generator.go, instagram_post.go, youtube_thumbnail.go,
// interior_design.go). Each turns structured user inputs into the exact prompt
// string the MCP sends, so the n8n node reuses the standard image path.

function orDefault(value: string, fallback: string): string {
	const t = (value ?? '').trim();
	return t || fallback;
}

// --- Logo (logo_generator.go) ---
const DEFAULT_LOGO_STYLE = 'modern wordmark with icon, minimal';
const DEFAULT_LOGO_INDUSTRY = 'technology';
const DEFAULT_LOGO_COLORS = 'brand blue and white';
const DEFAULT_LOGO_BACKGROUND = 'white';

export function resolveLogoAspect(style: string): string {
	const s = (style ?? '').toLowerCase();
	return s.includes('horizontal') || s.includes('wide') ? '16:9' : '1:1';
}

export function buildLogoPrompt(
	brandName: string,
	style: string,
	industry: string,
	colors: string,
	background: string,
): string {
	const s = orDefault(style, DEFAULT_LOGO_STYLE);
	const ind = orDefault(industry, DEFAULT_LOGO_INDUSTRY);
	const col = orDefault(colors, DEFAULT_LOGO_COLORS);
	const bg = orDefault(background, DEFAULT_LOGO_BACKGROUND);
	return `Professional logo for "${(brandName ?? '').trim()}" — ${s}, ${ind} brand. Color scheme: ${col}. ${bg} background. Clean, scalable, vector-quality logo design. Legible brand name text, balanced proportions. Modern 2025 logo design, no drop shadows, no gradients unless requested, isolated on ${bg} background.`;
}

// --- Instagram post (instagram_post.go) ---
const DEFAULT_INSTAGRAM_BRAND_STYLE =
	'modern, vibrant, clean typography, lifestyle photography aesthetic';
const DEFAULT_INSTAGRAM_FORMAT = '4:5';
const INSTAGRAM_FORMATS = new Set(['1:1', '4:5', '9:16']);

export function resolveInstagramFormat(format: string): string {
	const f = (format ?? '').trim();
	return INSTAGRAM_FORMATS.has(f) ? f : DEFAULT_INSTAGRAM_FORMAT;
}

export function buildInstagramPrompt(brief: string, brandStyle: string): string {
	const style = orDefault(brandStyle, DEFAULT_INSTAGRAM_BRAND_STYLE);
	return `Instagram hero image for: ${(brief ?? '').trim()}. Brand style: ${style}. Scroll-stopping, social-media-ready composition that communicates the concept within two seconds — strong focal point, clean negative space for text overlay, vibrant social-optimized color and lighting. High-quality, professional, on-brand.`;
}

// --- YouTube thumbnail (youtube_thumbnail.go) ---
const DEFAULT_YT_CHANNEL_STYLE = 'bold, high contrast, bright colors';

export function buildYouTubeThumbnailPrompt(
	title: string,
	channelStyle: string,
	subjectDescription: string,
): string {
	const style = orDefault(channelStyle, DEFAULT_YT_CHANNEL_STYLE);
	const subject = (subjectDescription ?? '').trim();
	const subjectClause = subject ? ` Featured subject: ${subject}.` : '';
	return `YouTube thumbnail for a video about: ${(title ?? '').trim()}.${subjectClause} Channel style: ${style}. High click-through-rate design — one dominant focal subject with an exaggerated emotional hook (surprise, excitement, curiosity), dramatic studio lighting, punchy saturated colors and strong contrast that pops against YouTube's grid, crisp depth of field. Rule-of-thirds composition with the subject offset and clean, uncluttered negative space on one side reserved for a text overlay. Photorealistic, eye-catching, professional. IMPORTANT: do NOT render any text, words, letters, numbers, captions, logos, or watermarks in the image — leave the negative space empty for a text overlay added afterward.`;
}

// --- Interior design (interior_design.go) ---
const DEFAULT_INTERIOR_STYLE = 'modern minimalist';
const DEFAULT_INTERIOR_PALETTE = 'neutral tones with wood accents';
const INTERIOR_SUFFIX =
	'Cinematic lighting, architectural photography style, wide angle lens, 8k resolution, photorealistic textures. High-end interior design magazine quality.';
const INTERIOR_PHOTO_ADDENDUM =
	'Maintain the structural layout and window placement of the reference room. Completely transform the furniture, decor, and wall finishes to match the new style.';

export function buildInteriorPrompt(
	roomType: string,
	style: string,
	colorPalette: string,
	specificElements: string,
	hasPhoto: boolean,
): string {
	const room = (roomType ?? '').trim();
	const s = orDefault(style, DEFAULT_INTERIOR_STYLE);
	const pal = orDefault(colorPalette, DEFAULT_INTERIOR_PALETTE);
	const parts = [
		`Professional interior design visualization of a ${room}.`,
		`Style: ${s}.`,
		`Color palette: ${pal}.`,
	];
	const el = (specificElements ?? '').trim();
	if (el) parts.push(`${el}.`);
	parts.push(INTERIOR_SUFFIX);
	if (hasPhoto) parts.push(INTERIOR_PHOTO_ADDENDUM);
	return parts.join(' ');
}

// --- Giant product showcase (giant_product.go) ---
const DEFAULT_GIANT_PERSON = 'a stylishly dressed man';
const GIANT_SUFFIX =
	'Professional studio lighting, dramatic low-angle perspective emphasizing the enormous scale, clean background, hyper-realistic product detail, high-end commercial advertising photography, high resolution, photorealistic';

export function buildGiantProductPrompt(personDescription: string): string {
	const person = orDefault(personDescription, DEFAULT_GIANT_PERSON);
	return `Surreal advertising visual: the product is enlarged to a massive, building-sized scale, towering over ${person} who stands beside it for scale comparison. ${GIANT_SUFFIX}.`;
}

// --- UGC lifestyle try-on (ugc_tryon.go) ---
const DEFAULT_UGC_MODEL_DESC = 'woman, 25-30 years old, natural look, diverse';
const DEFAULT_UGC_SETTING = 'casual lifestyle, natural lighting';
const DEFAULT_UGC_VERB = 'wearing or using';
const UGC_SUFFIX =
	'candid and relatable, social-media-ready, natural lighting, subtle film grain, shot on a phone, slightly unpolished and accidental composition — avoid overly polished or symmetrical framing, photorealistic, real-world environment, authentic atmosphere';
const UGC_PLATFORM_RATIOS: Record<string, string> = {
	instagram: '4:5',
	tiktok: '9:16',
	pinterest: '2:3',
	amazon: '1:1',
};
const UGC_PRODUCT_VERBS: Record<string, string> = { wearable: 'wearing', accessory: 'using' };

export function resolveUGCAspect(platform: string): string {
	const p = (platform ?? '').toLowerCase().trim();
	return UGC_PLATFORM_RATIOS[p] ?? UGC_PLATFORM_RATIOS.instagram;
}

export function buildUGCPrompt(
	productName: string,
	productType: string,
	modelDescription: string,
	setting: string,
): string {
	const verb = UGC_PRODUCT_VERBS[(productType ?? '').toLowerCase().trim()] ?? DEFAULT_UGC_VERB;
	const modelDesc = orDefault(modelDescription, DEFAULT_UGC_MODEL_DESC);
	const set = orDefault(setting, DEFAULT_UGC_SETTING);
	const product = (productName ?? '').trim();
	return `Authentic user-generated content lifestyle photo of a ${modelDesc} ${verb} ${product}, with the ${product} naturally featured and clearly visible, in a ${set} setting, ${UGC_SUFFIX}`;
}

// --- Drone video (drone_video.go) ---
const DEFAULT_DRONE_SHOT = 'reveal';
const DEFAULT_DRONE_STYLE = 'golden hour, cinematic, 4K, ultra-detailed';
const DRONE_SUFFIX =
	'DJI-quality drone footage, stabilized gimbal, no shake, cinematic color grade, photorealistic';
const DRONE_SHOTS: Record<string, (subject: string, style: string) => string> = {
	reveal: (s, st) =>
		`Drone camera starts low, slowly ascends and reveals ${s}, sweeping wide aerial perspective, ${st}`,
	orbit: (s, st) =>
		`Drone camera orbits ${s} in a smooth circular arc, 360-degree aerial rotation, ${st}`,
	flyover: (s, st) =>
		`Drone camera flies low and fast over ${s}, tracking forward momentum, depth of field, ${st}`,
	'top-down': (s, st) =>
		`Perfect overhead bird's eye view of ${s}, drone looking straight down, minimal distortion, ${st}`,
};

function resolveDroneShot(shotType: string): string {
	const s = (shotType ?? '').toLowerCase().trim().replace(/_/g, '-').replace(/ /g, '-');
	return DRONE_SHOTS[s] ? s : DEFAULT_DRONE_SHOT;
}

export function buildDronePrompt(
	locationOrSubject: string,
	shotType: string,
	style: string,
): string {
	const shot = resolveDroneShot(shotType);
	const st = orDefault(style, DEFAULT_DRONE_STYLE);
	const body = DRONE_SHOTS[shot]((locationOrSubject ?? '').trim(), st);
	return `${body}, ${DRONE_SUFFIX}`;
}

// --- Product ad video (product_ad.go) ---
const PRODUCT_AD_SUFFIX =
	'slow cinematic push-in, soft volumetric light, subtle product micro-rotation, shallow depth of field, premium commercial cinematography, smooth gimbal motion, professional colour grade, photorealistic, 4K, advertising quality';
const PRODUCT_AD_MOODS: Record<string, string> = {
	luxury: 'elegant gold and black palette, opulent and premium atmosphere, dramatic key lighting',
	playful: 'bright, saturated, vibrant colours, energetic and fun atmosphere, lively lighting',
	minimal: 'clean minimalist palette, soft neutral tones, uncluttered studio backdrop',
	tech: 'sleek modern palette, cool tones, crisp futuristic lighting',
};

export function buildProductAdPrompt(brandBrief: string, mood: string): string {
	const clause = PRODUCT_AD_MOODS[(mood ?? '').toLowerCase().trim()] ?? '';
	let body = `Cinematic product advertisement video. ${(brandBrief ?? '').trim()}`;
	if (clause) body += `, ${clause}`;
	return `${body}, ${PRODUCT_AD_SUFFIX}`;
}

// --- Cooking video (cooking_video.go) — two stages ---
const DEFAULT_COOKING_DISH = 'fresh pasta';
const DEFAULT_COOKING_KITCHEN = 'Italian rustic-modern';
const DEFAULT_COOKING_OUTFIT = 'a clean apron over smart-casual clothing, sleeves rolled up';
const DEFAULT_COOKING_DURATION = '15';

export function buildCookingSheetPrompt(
	dish: string,
	kitchenStyle: string,
	outfit: string,
	durationSeconds: string,
): string {
	const d = orDefault(dish, DEFAULT_COOKING_DISH);
	const k = orDefault(kitchenStyle, DEFAULT_COOKING_KITCHEN);
	const o = orDefault(outfit, DEFAULT_COOKING_OUTFIT);
	const dur = orDefault(durationSeconds, DEFAULT_COOKING_DURATION);
	return `Create one single composite reference sheet for a ${dur}-second realistic ${d}-making tutorial video. The image should be a clean, high-end production reference board, not a poster with heavy text. Format: wide reference sheet, elegant white margins, clean grid layout, realistic cinematic photography style. Concept: ${d} tutorial in a ${k} kitchen. Top row: motion / choreography guide with 9 numbered cinematic action panels showing the ${d} process step-by-step from raw ingredients to final plated dish. Middle-left: realistic character reference sheet of the uploaded person — preserve their exact face, hair color, hair texture, eye color, skin tone, and all facial features with 100% accuracy. Show the same person in: face close-up, full-body front view, side/action working pose, and back view. Dress them in ${o}. Keep them grounded, approachable, skilled, and cinematic. Middle-right / background: location reference sheet of an elegant ${k} kitchen with tactile surfaces, natural daylight from a large window, hanging cookware, herbs, and premium cooking atmosphere appropriate to the cuisine. Style: realistic, cinematic, warm natural light, shallow depth of field, tactile food photography, premium cooking show aesthetic, rich surface textures. Bottom strip: simple visual icons only. Minimal text, no dense paragraphs. Let the visuals do the heavy lifting.`;
}

export function buildCookingVideoPrompt(
	dish: string,
	kitchenStyle: string,
	outfit: string,
	durationSeconds: string,
): string {
	const d = orDefault(dish, DEFAULT_COOKING_DISH);
	const k = orDefault(kitchenStyle, DEFAULT_COOKING_KITCHEN);
	const o = orDefault(outfit, DEFAULT_COOKING_OUTFIT);
	const dur = orDefault(durationSeconds, DEFAULT_COOKING_DURATION);
	return `Use the supplied reference sheet as the visual and narrative guide — preserve the exact face, hair, eye color, skin tone, and all facial features of the person shown in its character reference with 100% accuracy throughout the entire video, and follow the cooking steps, kitchen setting, outfit, and atmosphere it shows exactly. A single continuous cinematic video of that person making ${d} in the ${k} kitchen from the reference sheet. They wear ${o} throughout.

VIDEO STRUCTURE
Follow the exact 9-step sequence shown in the reference sheet, beat by beat, from raw ingredients through preparation to a final plated close-up.

MOTION STYLE
- Slow, deliberate, satisfying transitions between each step
- Natural hand and body movement with clear culinary intent
- Continuous flow with no jump cuts
- Warm and immersive pacing

CAMERA & CINEMATOGRAPHY
- Close-up shots for hands during mixing, kneading, cutting, plating
- Medium shots showing the person working at the counter
- Pull back slightly for the final plating to reveal the full kitchen
- Shallow depth of field — focus on hands and food, soft background blur
- No abrupt cuts — smooth match cuts and fluid transitions

VISUAL STYLE
- Warm natural daylight from a large kitchen window
- Rich tactile textures matching the reference sheet's environment
- Full color, warm cinematic color grading

CONSISTENCY RULES
- Same character throughout — the face from the reference sheet in every frame
- Same outfit across the entire video
- Same kitchen environment as shown in the reference sheet

AUDIO
- Soft kitchen ambience, gentle culinary SFX (chopping, sizzling, pouring), light cinematic underscore
- No dialogue, no narration

OUTPUT STYLE
- Duration: approximately ${dur} seconds
- Polished, cinematic, premium cooking show quality
- Ends with a beautiful close-up of the finished plated ${d}`;
}

// --- Jewelry video (jewelry_video.go) — two phases ---
const DEFAULT_JEWELRY_DESC = 'a delicate rose gold ring with a lotus design and a sparkling diamond';
const DEFAULT_JEWELRY_SURFACE = 'a beige surface';

export function buildJewelryImagePrompt(jewelryDescription: string, surfaceDescription: string): string {
	const j = orDefault(jewelryDescription, DEFAULT_JEWELRY_DESC);
	const s = orDefault(surfaceDescription, DEFAULT_JEWELRY_SURFACE);
	return `Style: Luxury product ad, high-end commercial feel. Scene: ${j} resting on ${s}. A soft, warm light highlights the diamond, creating subtle highlights on the metal. 100mm macro lens photography, shallow DOF, incredible detail, elegant and minimal composition.`;
}

export function buildJewelryVideoPrompt(jewelryDescription: string, surfaceDescription: string): string {
	const j = orDefault(jewelryDescription, DEFAULT_JEWELRY_DESC);
	const s = orDefault(surfaceDescription, DEFAULT_JEWELRY_SURFACE);
	return `Luxury jewelry advertisement, high-end commercial cinematography. Animate the supplied product still of ${j} resting on ${s}. Open with a close-up macro shot, 100mm lens, shallow depth of field — a soft, warm light highlights the diamond, creating subtle highlights on the metal, with a slow, elegant camera rotation around the piece. Then push into an extreme close-up on the diamond, 200mm macro lens, razor-thin depth of field, a focused LED light catching every facet as the camera glides slowly over the stone, showcasing its brilliance with ethereal, sparkling highlights. Smooth, refined movement throughout, premium macro product cinematography, photorealistic, advertising quality.`;
}

// --- 3D logo animation (logo_animation.go) — two phases ---
const DEFAULT_LOGO_MATERIAL = 'glossy glass and chrome';

export function buildLogo3DImagePrompt(materialStyle: string): string {
	const m = orDefault(materialStyle, DEFAULT_LOGO_MATERIAL);
	return `Transform the supplied flat 2D logo into a premium, high-quality 3D version. Render it as a ${m} material with realistic reflections, studio lighting, soft shadows, and subtle depth and bevels. Preserve the original logo's exact shapes, proportions, lettering, and composition. Clean neutral studio background, sharp focus, high detail, professional product-render quality.`;
}

export function buildLogoAnimationPrompt(materialStyle: string): string {
	const m = orDefault(materialStyle, DEFAULT_LOGO_MATERIAL);
	return `Cinematic 3D logo animation. Animate the supplied 3D logo (a ${m} material) with a smooth, elegant rotation that shows off its depth and bevels, dynamic studio lighting sweeps and lens flares catching the reflective surface, and polished motion-graphics flourishes. Build to a clean hero hold of the logo facing the camera. Premium brand-reveal aesthetic, soft volumetric light, shallow depth of field, smooth refined camera motion, photorealistic, advertising quality.`;
}
