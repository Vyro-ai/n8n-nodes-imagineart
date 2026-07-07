import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { BASE_URLS } from './transport/constants';
import { aspectRatioOptions, imageModelOptions, resolveImageModel } from './transport/imageModels';
import {
	resolveVideoModel,
	resolveVideoResolution,
	videoAspectRatioOptions,
	videoDurationOptions,
	videoModelOptions,
} from './transport/videoModels';
import {
	buildImageForm,
	buildMultipartBody,
	buildMultipartWithFile,
	buildMusicForm,
	buildVideoForm,
} from './transport/request';
import {
	firstGenerationUrl,
	isFailureStatus,
	parseStatusResponse,
	type StatusResponse,
} from './transport/status';
import {
	buildCookingSheetPrompt,
	buildCookingVideoPrompt,
	buildDronePrompt,
	buildGiantProductPrompt,
	buildInstagramPrompt,
	buildInteriorPrompt,
	buildJewelryImagePrompt,
	buildJewelryVideoPrompt,
	buildLogo3DImagePrompt,
	buildLogoAnimationPrompt,
	buildLogoPrompt,
	buildProductAdPrompt,
	buildUGCPrompt,
	buildYouTubeThumbnailPrompt,
	resolveInstagramFormat,
	resolveLogoAspect,
	resolveUGCAspect,
} from './transport/prompts';
import {
	adAspectRatioOptions,
	adGenderOptions,
	adOwnershipOptions,
	adResolutionOptions,
	adTemplateKindOptions,
	buildAdForm,
	collectPhotos,
	mapAvatarRows,
	mapProductRows,
	mapProjectRows,
	mapTemplateRows,
	type AdImageRef,
} from './transport/adStudio';
import { getFolders, getMarketProjects, getOrganizations } from './methods/loadOptions';

const CREDENTIAL = 'imagineArtOAuth2Api';

// --- HTTP helpers (take the execute context so the node body stays a thin dispatcher) ---

// POST a hand-built multipart body and return the raw parsed response.
async function postMultipart(
	ctx: IExecuteFunctions,
	vag: string,
	endpoint: string,
	fields: Record<string, string | string[]>,
): Promise<unknown> {
	const { body, contentType } = buildMultipartBody(fields);
	return ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
		method: 'POST',
		url: `${vag}${endpoint}`,
		body,
		headers: { 'content-type': contentType },
		timeout: 60000,
	});
}

async function submitMultipart(
	ctx: IExecuteFunctions,
	vag: string,
	endpoint: string,
	fields: Record<string, string | string[]>,
): Promise<string> {
	const res = (await postMultipart(ctx, vag, endpoint, fields)) as Array<{ id?: string }>;
	const id = res?.[0]?.id;
	if (!id) {
		throw new NodeOperationError(ctx.getNode(), 'ImagineArt did not return a generation id.');
	}
	return id;
}

// Uploads a binary file to <vag>/assets/upload and returns its processed URL.
// Unlike the generation endpoints this returns a single { url: { processed } }
// object (not an array), and the upstream validates the part's mime type — so
// the caller must pass the real filename + content-type from the binary item.
async function uploadUserFile(
	ctx: IExecuteFunctions,
	vag: string,
	orgId: string,
	file: { buffer: Buffer; filename: string; mimeType: string },
): Promise<string> {
	const fields: Record<string, string> = { ref_service: '0', title: 'User Upload' };
	if (orgId) fields.org_id = orgId;
	const { body, contentType } = buildMultipartWithFile(fields, 'file', file);
	const res = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
		method: 'POST',
		url: `${vag}/assets/upload`,
		body,
		headers: { 'content-type': contentType },
		timeout: 60000,
	})) as { url?: { processed?: string[] } };
	const url = res?.url?.processed?.[0];
	if (!url) {
		throw new NodeOperationError(ctx.getNode(), 'ImagineArt upload did not return a URL.');
	}
	return url;
}

// Ad Studio: uploads a product/avatar photo (ref_service 4 + bytedance_upload)
// and returns its processed URL plus the bytedance reference id.
async function uploadMarketImage(
	ctx: IExecuteFunctions,
	vag: string,
	orgId: string,
	file: { buffer: Buffer; filename: string; mimeType: string },
): Promise<{ url: string; bytedanceId: string | null }> {
	const fields: Record<string, string> = {
		ref_service: '4',
		title: 'Ad Studio Upload',
		bytedance_upload: 'true',
	};
	if (orgId) fields.org_id = orgId;
	const { body, contentType } = buildMultipartWithFile(fields, 'file', file);
	const res = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
		method: 'POST',
		url: `${vag}/assets/upload`,
		body,
		headers: { 'content-type': contentType },
		timeout: 60000,
	})) as { url?: { processed?: string[] }; bytedance_id?: string };
	const url = res?.url?.processed?.[0];
	if (!url) {
		throw new NodeOperationError(ctx.getNode(), 'ImagineArt upload did not return a URL.');
	}
	return { url, bytedanceId: res?.bytedance_id ?? null };
}

// Ad Studio: lists a market catalog (products/avatars). "all" merges the system
// and user sets (the endpoint has no single "all" mode); otherwise a single
// type-scoped read. The mapper normalizes each raw row for node output.
async function listMarketCatalog(
	ctx: IExecuteFunctions,
	vag: string,
	endpoint: string,
	ownership: string,
	mapper: (body: unknown) => Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
	if (ownership === 'all') {
		const [sys, usr] = await Promise.all([
			getJson(ctx, `${vag}${endpoint}?type=system`),
			getJson(ctx, `${vag}${endpoint}?type=user`),
		]);
		return [...mapper(sys), ...mapper(usr)];
	}
	const body = await getJson(ctx, `${vag}${endpoint}?type=${encodeURIComponent(ownership)}`);
	return mapper(body);
}

async function fetchAssetStatus(
	ctx: IExecuteFunctions,
	vag: string,
	id: string,
): Promise<StatusResponse> {
	return parseStatusResponse(
		await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
			method: 'GET',
			url: `${vag}/assets/${encodeURIComponent(id)}/status`,
			json: true,
		}),
	);
}

async function getJson(ctx: IExecuteFunctions, url: string): Promise<unknown> {
	return ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
		method: 'GET',
		url,
		json: true,
	});
}

async function downloadBinary(
	ctx: IExecuteFunctions,
	url: string,
	filename: string,
): Promise<IBinaryData> {
	const downloaded = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIAL, {
		method: 'GET',
		url,
		encoding: 'arraybuffer',
	})) as ArrayBuffer;
	return ctx.helpers.prepareBinaryData(Buffer.from(downloaded), filename);
}

export const SHARED_FIELDS: INodeProperties[] = [
			{
				displayName: 'Organization Name or ID',
				name: 'organization',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getOrganizations' },
				default: '',
				required: true,
				displayOptions: { hide: { operation: ['getResult'] } },
			},
			{
				displayName: 'Input Binary Field',
				name: 'uploadBinaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				hint: 'The name of the input binary field holding the file to upload',
				displayOptions: { show: { resource: ['asset', 'adStudio'], operation: ['upload', 'uploadImage'] } },
			},
			{
				displayName: 'Folder Name or ID',
				name: 'folderId',
				type: 'options',
				description:
					'The workspace folder to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getFolders',
					loadOptionsDependsOn: ['organization'],
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['image', 'video', 'audio', 'adStudio'],
						operation: ['generate', 'listProjects', 'createProject', 'generateAd'],
					},
				},
			},
			{
				displayName: 'Ownership',
				name: 'adOwnership',
				type: 'options',
				options: adOwnershipOptions(),
				default: 'all',
				description: 'Which catalog to list: system defaults, your saved items, or both',
				displayOptions: { show: { resource: ['adStudio'], operation: ['listProducts', 'listAvatars'] } },
			},
			{
				displayName: 'Template Kind',
				name: 'adTemplateKind',
				type: 'options',
				options: adTemplateKindOptions(),
				default: 'format',
				displayOptions: { show: { resource: ['adStudio'], operation: ['listTemplates'] } },
			},
			{
				displayName: 'Project Name',
				name: 'adProjectName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Spring Campaign',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProject'] } },
			},
			{
				displayName: 'Create From',
				name: 'adProductSource',
				type: 'options',
				options: [
					{ name: 'Product URL (Scrape)', value: 'url' },
					{ name: 'Uploaded Photos (Manual)', value: 'manual' },
				],
				default: 'url',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProduct'] } },
			},
			{
				displayName: 'Product URL',
				name: 'adProductUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://store.example.com/product/123',
				description:
					'A product page to scrape. Creation is async — poll Get Product Status until it is finished.',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProduct'], adProductSource: ['url'] } },
			},
			{
				displayName: 'Product Name',
				name: 'adProductName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProduct'], adProductSource: ['manual'] } },
			},
			{
				displayName: 'Product Description',
				name: 'adProductDescription',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 2 },
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProduct'], adProductSource: ['manual'] } },
			},
			{
				displayName: 'Photos',
				name: 'adProductPhotos',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Photo',
				default: {},
				description: 'Photos from Upload Image (URL + reference ID)',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createProduct'], adProductSource: ['manual'] } },
				options: [
					{
						name: 'photo',
						displayName: 'Photo',
						values: [
							{ displayName: 'URL', name: 'url', type: 'string', default: '' },
							{ displayName: 'Reference ID', name: 'bytedanceId', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Product ID',
				name: 'adProductId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['adStudio'], operation: ['productStatus'] } },
			},
			{
				displayName: 'Avatar Name',
				name: 'adAvatarName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['adStudio'], operation: ['createAvatar'] } },
			},
			{
				displayName: 'Gender',
				name: 'adAvatarGender',
				type: 'options',
				options: adGenderOptions(),
				default: 'neutral',
				required: true,
				displayOptions: { show: { resource: ['adStudio'], operation: ['createAvatar'] } },
			},
			{
				displayName: 'Avatar Description',
				name: 'adAvatarDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createAvatar'] } },
			},
			{
				displayName: 'Photos',
				name: 'adAvatarPhotos',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Photo',
				default: {},
				description: 'Photos from Upload Image (URL)',
				displayOptions: { show: { resource: ['adStudio'], operation: ['createAvatar'] } },
				options: [
					{
						name: 'photo',
						displayName: 'Photo',
						values: [{ displayName: 'URL', name: 'url', type: 'string', default: '' }],
					},
				],
			},
			{
				displayName: 'Project Name or ID',
				name: 'marketProjectId',
				type: 'options',
				description:
					'The marketing project to attach this ad to (loads after a folder is picked). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getMarketProjects', loadOptionsDependsOn: ['folderId'] },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['adStudio'], operation: ['generateAd'] } },
			},
			{
				displayName: 'Reference Images',
				name: 'adImages',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Image',
				default: {},
				description: 'Product/avatar reference images (URL + reference ID) that drive the ad',
				displayOptions: { show: { resource: ['adStudio'], operation: ['generateAd'] } },
				options: [
					{
						name: 'image',
						displayName: 'Image',
						values: [
							{ displayName: 'URL', name: 'url', type: 'string', default: '' },
							{ displayName: 'Reference ID', name: 'id', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Aspect Ratio',
				name: 'adAspectRatio',
				type: 'options',
				options: adAspectRatioOptions(),
				default: '9:16',
				displayOptions: { show: { resource: ['adStudio'], operation: ['generateAd'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'adDuration',
				type: 'string',
				default: '4',
				displayOptions: { show: { resource: ['adStudio'], operation: ['generateAd'] } },
			},
			{
				displayName: 'Resolution',
				name: 'adResolution',
				type: 'options',
				options: adResolutionOptions(),
				default: '480p',
				displayOptions: { show: { resource: ['adStudio'], operation: ['generateAd'] } },
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 3 },
				placeholder: 'A red fox in falling snow, cinematic lighting',
				displayOptions: {
					show: {
						resource: ['image', 'video', 'audio', 'adStudio'],
						operation: ['generate', 'generateAd'],
					},
				},
			},
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/photo.jpg',
				description: 'Public URL of the image to process',
				displayOptions: { show: { resource: ['image'], operation: ['enhance', 'removeBackground'] } },
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: imageModelOptions(),
				default: 'nano-banana-pro',
				displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
			},
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				options: aspectRatioOptions(),
				default: '1:1',
				displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
			},
			{
				displayName: 'Brand Name',
				name: 'logoBrandName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['image'], operation: ['logo'] } },
			},
			{
				displayName: 'Logo Style',
				name: 'logoStyle',
				type: 'string',
				default: '',
				placeholder: 'modern wordmark with icon, minimal',
				description: 'Include "horizontal" or "wide" for a 16:9 layout; otherwise 1:1',
				displayOptions: { show: { resource: ['image'], operation: ['logo'] } },
			},
			{
				displayName: 'Industry',
				name: 'logoIndustry',
				type: 'string',
				default: '',
				placeholder: 'technology',
				displayOptions: { show: { resource: ['image'], operation: ['logo'] } },
			},
			{
				displayName: 'Color Scheme',
				name: 'logoPalette',
				type: 'string',
				default: '',
				placeholder: 'brand blue and white',
				displayOptions: { show: { resource: ['image'], operation: ['logo'] } },
			},
			{
				displayName: 'Background',
				name: 'logoBackground',
				type: 'options',
				options: [
					{ name: 'Black', value: 'black' },
					{ name: 'Transparent', value: 'transparent' },
					{ name: 'White', value: 'white' },
				],
				default: 'white',
				displayOptions: { show: { resource: ['image'], operation: ['logo'] } },
			},
			{
				displayName: 'Brief',
				name: 'igBrief',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 2 },
				displayOptions: { show: { resource: ['image'], operation: ['instagramPost'] } },
			},
			{
				displayName: 'Brand Style',
				name: 'igBrandStyle',
				type: 'string',
				default: '',
				placeholder: 'modern, vibrant, clean typography, lifestyle photography aesthetic',
				displayOptions: { show: { resource: ['image'], operation: ['instagramPost'] } },
			},
			{
				displayName: 'Format',
				name: 'igFormat',
				type: 'options',
				options: [
					{ name: '1:1 (Square)', value: '1:1' },
					{ name: '4:5 (Portrait)', value: '4:5' },
					{ name: '9:16 (Story)', value: '9:16' },
				],
				default: '4:5',
				displayOptions: { show: { resource: ['image'], operation: ['instagramPost'] } },
			},
			{
				displayName: 'Room Type',
				name: 'interiorRoomType',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'living room',
				displayOptions: { show: { resource: ['image'], operation: ['interiorDesign'] } },
			},
			{
				displayName: 'Design Style',
				name: 'interiorStyle',
				type: 'string',
				default: '',
				placeholder: 'modern minimalist',
				displayOptions: { show: { resource: ['image'], operation: ['interiorDesign'] } },
			},
			{
				displayName: 'Color Palette',
				name: 'interiorPalette',
				type: 'string',
				default: '',
				placeholder: 'neutral tones with wood accents',
				displayOptions: { show: { resource: ['image'], operation: ['interiorDesign'] } },
			},
			{
				displayName: 'Specific Elements',
				name: 'interiorElements',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['image'], operation: ['interiorDesign'] } },
			},
			{
				displayName: 'Room Photo URL',
				name: 'interiorRoomPhoto',
				type: 'string',
				default: '',
				description: 'Optional reference photo — redesigns the existing room (img2img)',
				displayOptions: { show: { resource: ['image'], operation: ['interiorDesign'] } },
			},
			{
				displayName: 'Title',
				name: 'ytTitle',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['image'], operation: ['youtubeThumbnail'] } },
			},
			{
				displayName: 'Channel Style',
				name: 'ytChannelStyle',
				type: 'string',
				default: '',
				placeholder: 'bold, high contrast, bright colors',
				displayOptions: { show: { resource: ['image'], operation: ['youtubeThumbnail'] } },
			},
			{
				displayName: 'Subject Description',
				name: 'ytSubject',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['image'], operation: ['youtubeThumbnail'] } },
			},
			{
				displayName: 'Product Image URL',
				name: 'giantProductImage',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/product.jpg',
				displayOptions: { show: { resource: ['image'], operation: ['giantProduct'] } },
			},
			{
				displayName: 'Person Description',
				name: 'giantPerson',
				type: 'string',
				default: '',
				placeholder: 'a stylishly dressed man',
				displayOptions: { show: { resource: ['image'], operation: ['giantProduct'] } },
			},
			{
				displayName: 'Product Name',
				name: 'ugcProductName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Product Image URL',
				name: 'ugcProductImageUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/product.jpg',
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Product Type',
				name: 'ugcProductType',
				type: 'string',
				default: '',
				placeholder: 'wearable / accessory',
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Model Description',
				name: 'ugcModelDescription',
				type: 'string',
				default: '',
				placeholder: 'woman, 25-30 years old, natural look, diverse',
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Setting',
				name: 'ugcSetting',
				type: 'string',
				default: '',
				placeholder: 'casual lifestyle, natural lighting',
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Platform',
				name: 'ugcPlatform',
				type: 'options',
				options: [
					{ name: 'Amazon', value: 'amazon' },
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'Pinterest', value: 'pinterest' },
					{ name: 'TikTok', value: 'tiktok' },
				],
				default: 'instagram',
				displayOptions: { show: { resource: ['image'], operation: ['ugcTryon'] } },
			},
			{
				displayName: 'Location or Subject',
				name: 'droneSubject',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['video'], operation: ['droneVideo'] } },
			},
			{
				displayName: 'Shot Type',
				name: 'droneShotType',
				type: 'options',
				options: [
					{ name: 'Flyover', value: 'flyover' },
					{ name: 'Orbit', value: 'orbit' },
					{ name: 'Reveal', value: 'reveal' },
					{ name: 'Top Down', value: 'top-down' },
				],
				default: 'reveal',
				displayOptions: { show: { resource: ['video'], operation: ['droneVideo'] } },
			},
			{
				displayName: 'Style',
				name: 'droneStyle',
				type: 'string',
				default: '',
				placeholder: 'golden hour, cinematic, 4K, ultra-detailed',
				displayOptions: { show: { resource: ['video'], operation: ['droneVideo'] } },
			},
			{
				displayName: 'Reference Image URL',
				name: 'droneReferenceImage',
				type: 'string',
				default: '',
				description: 'Optional first frame — runs image-to-video when set',
				displayOptions: { show: { resource: ['video'], operation: ['droneVideo'] } },
			},
			{
				displayName: 'Model',
				name: 'droneModel',
				type: 'options',
				options: videoModelOptions(),
				default: 'veo-3.1',
				displayOptions: { show: { resource: ['video'], operation: ['droneVideo'] } },
			},
			{
				displayName: 'Product Image URL',
				name: 'paProductImageUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/product.jpg',
				displayOptions: { show: { resource: ['video'], operation: ['productAd'] } },
			},
			{
				displayName: 'Brand Brief',
				name: 'paBrandBrief',
				type: 'string',
				default: '',
				required: true,
				typeOptions: { rows: 2 },
				displayOptions: { show: { resource: ['video'], operation: ['productAd'] } },
			},
			{
				displayName: 'Mood',
				name: 'paMood',
				type: 'string',
				default: '',
				placeholder: 'luxury / playful / minimal / tech',
				displayOptions: { show: { resource: ['video'], operation: ['productAd'] } },
			},
			{
				displayName: 'Resolution',
				name: 'paResolution',
				type: 'options',
				options: [
					{ name: '1080p', value: '1080p' },
					{ name: '4k', value: '4k' },
					{ name: '720p', value: '720p' },
				],
				default: '1080p',
				displayOptions: { show: { resource: ['video'], operation: ['productAd'] } },
			},
			{
				displayName: 'Model',
				name: 'paModel',
				type: 'options',
				options: videoModelOptions(),
				default: 'veo-3.1',
				displayOptions: { show: { resource: ['video'], operation: ['productAd'] } },
			},
			{
				displayName: 'Person Image URL',
				name: 'cookingPersonImage',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/person.jpg',
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Dish',
				name: 'cookingDish',
				type: 'string',
				default: '',
				placeholder: 'fresh pasta',
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Kitchen Style',
				name: 'cookingKitchenStyle',
				type: 'string',
				default: '',
				placeholder: 'Italian rustic-modern',
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Outfit',
				name: 'cookingOutfit',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'cookingDurationSeconds',
				type: 'number',
				default: 15,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Resolution',
				name: 'cookingResolution',
				type: 'options',
				options: [
					{ name: '1080p', value: '1080p' },
					{ name: '480p', value: '480p' },
					{ name: '720p', value: '720p' },
				],
				default: '720p',
				displayOptions: { show: { resource: ['video'], operation: ['cookingVideo'] } },
			},
			{
				displayName: 'Jewelry Description',
				name: 'jewelryDescription',
				type: 'string',
				default: '',
				placeholder: 'a delicate rose gold ring with a lotus design and a sparkling diamond',
				displayOptions: { show: { resource: ['video'], operation: ['jewelryVideo'] } },
			},
			{
				displayName: 'Surface Description',
				name: 'jewelrySurface',
				type: 'string',
				default: '',
				placeholder: 'a beige surface',
				displayOptions: { show: { resource: ['video'], operation: ['jewelryVideo'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'jewelryDuration',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['video'], operation: ['jewelryVideo'] } },
			},
			{
				displayName: 'Resolution',
				name: 'jewelryResolution',
				type: 'options',
				options: [
					{ name: '1080p', value: '1080p' },
					{ name: '4k', value: '4k' },
					{ name: '720p', value: '720p' },
				],
				default: '1080p',
				displayOptions: { show: { resource: ['video'], operation: ['jewelryVideo'] } },
			},
			{
				displayName: 'Model',
				name: 'jewelryModel',
				type: 'options',
				options: videoModelOptions(),
				default: 'kling-2.6-pro',
				displayOptions: { show: { resource: ['video'], operation: ['jewelryVideo'] } },
			},
			{
				displayName: 'Logo Image URL',
				name: 'logo3dImageUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/logo.png',
				description: 'A flat 2D logo to convert to 3D and animate',
				displayOptions: { show: { resource: ['video'], operation: ['logo3d'] } },
			},
			{
				displayName: 'Material Style',
				name: 'logo3dMaterial',
				type: 'string',
				default: '',
				placeholder: 'glossy glass and chrome',
				displayOptions: { show: { resource: ['video'], operation: ['logo3d'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'logo3dDuration',
				type: 'number',
				default: 6,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['video'], operation: ['logo3d'] } },
			},
			{
				displayName: 'Resolution',
				name: 'logo3dResolution',
				type: 'options',
				options: [
					{ name: '1080p', value: '1080p' },
					{ name: '4k', value: '4k' },
					{ name: '720p', value: '720p' },
				],
				default: '1080p',
				displayOptions: { show: { resource: ['video'], operation: ['logo3d'] } },
			},
			{
				displayName: 'Model',
				name: 'logo3dModel',
				type: 'options',
				options: videoModelOptions(),
				default: 'veo-3.1-fast',
				displayOptions: { show: { resource: ['video'], operation: ['logo3d'] } },
			},
			{
				displayName: 'Model',
				name: 'videoModel',
				type: 'options',
				options: videoModelOptions(),
				default: 'ltx-2.3',
				displayOptions: { show: { resource: ['video'], operation: ['generate'] } },
			},
			{
				displayName: 'Aspect Ratio',
				name: 'videoAspectRatio',
				type: 'options',
				options: videoAspectRatioOptions(),
				default: '16:9',
				displayOptions: { show: { resource: ['video'], operation: ['generate'] } },
			},
			{
				displayName: 'Duration',
				name: 'duration',
				type: 'options',
				options: videoDurationOptions(),
				default: '6',
				displayOptions: { show: { resource: ['video'], operation: ['generate'] } },
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'musicDuration',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['audio'], operation: ['generate'] } },
			},
			{
				displayName: 'Variation',
				name: 'musicVariation',
				type: 'string',
				default: 'music',
				description: 'Music variation preset',
				displayOptions: { show: { resource: ['audio'], operation: ['generate'] } },
			},
			{
				displayName: 'Asset ID',
				name: 'assetId',
				type: 'string',
				default: '',
				required: true,
				description: 'The asset ID returned by a Generate action (`assetId`)',
				displayOptions: { show: { operation: ['getResult'] } },
			},
];

export const LOAD_OPTIONS = { getOrganizations, getFolders, getMarketProjects };

// Operation option sets per resource — the single source for both the unified
// node (all dropdowns) and the focused per-app nodes (one resource's dropdown).
const OPERATIONS: Record<string, { default: string; options: INodePropertyOptions[] }> = {
	image: {
		default: 'generate',
		options: [
			{
				name: 'Enhance',
				value: 'enhance',
				action: 'Enhance an image',
				description: 'Upscale and enhance an existing image',
			},
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate an image',
				description: 'Generate an image from a text prompt',
			},
			{
				name: 'Generate Giant Product Showcase',
				value: 'giantProduct',
				action: 'Generate a giant product showcase',
				description: 'Enlarge a product to building scale beside a person (needs a product image)',
			},
			{
				name: 'Generate Instagram Post',
				value: 'instagramPost',
				action: 'Generate an instagram post image',
				description: 'Generate a scroll-stopping Instagram hero image from a brief',
			},
			{
				name: 'Generate Interior Design',
				value: 'interiorDesign',
				action: 'Generate an interior design render',
				description: 'Render a room design, optionally from a reference photo',
			},
			{
				name: 'Generate Logo',
				value: 'logo',
				action: 'Generate a logo',
				description: 'Generate a clean vector-style brand logo',
			},
			{
				name: 'Generate UGC Try-On',
				value: 'ugcTryon',
				action: 'Generate a ugc try on image',
				description: 'Create a UGC lifestyle try-on photo (needs a product image)',
			},
			{
				name: 'Generate YouTube Thumbnail',
				value: 'youtubeThumbnail',
				action: 'Generate a you tube thumbnail',
				description: 'Generate a high click-through 16:9 thumbnail image',
			},
			{
				name: 'Get Result',
				value: 'getResult',
				action: 'Get an image result',
				description: 'Fetch a submitted image generation and download it once ready',
			},
			{
				name: 'Remove Background',
				value: 'removeBackground',
				action: 'Remove an image background',
				description: 'Remove the background from an existing image',
			},
		],
	},
	video: {
		default: 'generate',
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate a video',
				description: 'Submit a text-to-video generation (returns an asset ID to poll)',
			},
			{
				name: 'Generate 3D Logo Animation',
				value: 'logo3d',
				action: 'Generate a 3d logo animation',
				description: 'Turn a flat 2D logo into an animated 3D reveal (returns an asset ID to poll)',
			},
			{
				name: 'Generate Cooking Video',
				value: 'cookingVideo',
				action: 'Generate a cooking video',
				description: 'Turn a person photo into a cooking tutorial video (returns an asset ID to poll)',
			},
			{
				name: 'Generate Drone Video',
				value: 'droneVideo',
				action: 'Generate a drone video',
				description: 'Submit a cinematic aerial drone video (returns an asset ID to poll)',
			},
			{
				name: 'Generate Jewelry Video',
				value: 'jewelryVideo',
				action: 'Generate a jewelry video',
				description: 'Generate a luxury jewelry ad video from a text description (returns an asset ID to poll)',
			},
			{
				name: 'Generate Product Ad',
				value: 'productAd',
				action: 'Generate a product ad video',
				description: 'Submit a cinematic product ad from a product image (returns an asset ID to poll)',
			},
			{
				name: 'Get Result',
				value: 'getResult',
				action: 'Get a video result',
				description: 'Check a submitted video and return it once it is ready',
			},
		],
	},
	audio: {
		default: 'generate',
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate music',
				description: 'Generate music from a text prompt',
			},
			{
				name: 'Get Result',
				value: 'getResult',
				action: 'Get a music result',
				description: 'Fetch a submitted music generation and download it once ready',
			},
		],
	},
	asset: {
		default: 'listGenerations',
		options: [
			{
				name: 'List Generations',
				value: 'listGenerations',
				action: 'List generated assets',
				description: 'List finished image and video generations',
			},
			{
				name: 'List Uploaded Assets',
				value: 'listUploadedAssets',
				action: 'List uploaded assets',
				description: 'List assets you have uploaded',
			},
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a file',
				description: 'Upload a binary file and get its asset URL',
			},
		],
	},
	account: {
		default: 'getBalance',
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				action: 'Get the credit balance',
				description: 'Get the credit balance for the organization',
			},
		],
	},
	adStudio: {
		default: 'generateAd',
		options: [
			{
				name: 'Create Avatar',
				value: 'createAvatar',
				action: 'Create an ad avatar',
				description: 'Create a marketing avatar from uploaded photos',
			},
			{
				name: 'Create Product',
				value: 'createProduct',
				action: 'Create an ad product',
				description: 'Create a marketing product from a URL or uploaded photos',
			},
			{
				name: 'Create Project',
				value: 'createProject',
				action: 'Create a marketing project',
				description: 'Create a marketing project (campaign) in a folder',
			},
			{
				name: 'Generate Ad',
				value: 'generateAd',
				action: 'Generate an ad video',
				description: 'Generate an ad video from a prompt and product/avatar references',
			},
			{
				name: 'Get Product Status',
				value: 'productStatus',
				action: 'Get product status',
				description: 'Poll a from-URL product until it finishes scraping',
			},
			{
				name: 'Get Result',
				value: 'getResult',
				action: 'Get an ad result',
				description: 'Fetch a submitted ad generation and download it once ready',
			},
			{
				name: 'List Avatars',
				value: 'listAvatars',
				action: 'List ad avatars',
				description: 'List marketing avatars (system and/or saved)',
			},
			{
				name: 'List Products',
				value: 'listProducts',
				action: 'List ad products',
				description: 'List marketing products (system and/or saved)',
			},
			{
				name: 'List Projects',
				value: 'listProjects',
				action: 'List marketing projects',
				description: 'List marketing projects in a folder',
			},
			{
				name: 'List Templates',
				value: 'listTemplates',
				action: 'List ad templates',
				description: 'List ad templates (formats, backgrounds, or hooks)',
			},
			{
				name: 'Upload Image',
				value: 'uploadImage',
				action: 'Upload an ad image',
				description: 'Upload a product/avatar photo and get its URL and reference ID',
			},
		],
	},
};

// The Resource dropdown (unified node only).
export const RESOURCE_DROPDOWN: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account' },
		{ name: 'Ad Studio', value: 'adStudio' },
		{ name: 'Asset', value: 'asset' },
		{ name: 'Audio', value: 'audio' },
		{ name: 'Image', value: 'image' },
		{ name: 'Video', value: 'video' },
	],
	default: 'image',
};

// The Operation dropdown for one resource (shown when that resource is active).
export function operationDropdownFor(resource: string): INodeProperties {
	const spec = OPERATIONS[resource];
	// eslint-disable-next-line n8n-nodes-base/node-param-default-missing
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: spec.options,
		default: spec.default,
	};
}

// All operation dropdowns (unified node) — one per resource, each shown only
// when its resource is selected.
export const OPERATION_DROPDOWNS: INodeProperties[] = Object.keys(OPERATIONS).map(operationDropdownFor);

export async function executeImagineArt(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const { vag } = BASE_URLS;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'image' && operation === 'generate') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const prompt = this.getNodeParameter('prompt', i) as string;
					const { config, aspectRatio, model } = resolveImageModel(
						this.getNodeParameter('model', i) as string,
						this.getNodeParameter('aspectRatio', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt,
							styleId: config.styleId,
							variation: config.variation,
							aspectRatio,
							orgId,
							folderId: this.getNodeParameter('folderId', i, '') as string,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							model,
							aspectRatio,
							filename: 'imagineart.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'enhance') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const imageUrl = this.getNodeParameter('imageUrl', i) as string;
					const id = await submitMultipart(this, vag, '/image/enhance/upload', {
						image_url: imageUrl,
						style_id: '40201',
						org_id: orgId,
					});
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-enhanced.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'removeBackground') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const imageUrl = this.getNodeParameter('imageUrl', i) as string;
					const id = await submitMultipart(this, vag, '/image/background/remover/upload', {
						image_url: imageUrl,
						org_id: orgId,
					});
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-no-bg.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'logo') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const style = this.getNodeParameter('logoStyle', i) as string;
					const { config, aspectRatio } = resolveImageModel(
						'ideogram-v4',
						resolveLogoAspect(style),
					);
					const prompt = buildLogoPrompt(
						this.getNodeParameter('logoBrandName', i) as string,
						style,
						this.getNodeParameter('logoIndustry', i) as string,
						this.getNodeParameter('logoPalette', i) as string,
						this.getNodeParameter('logoBackground', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({ prompt, styleId: config.styleId, variation: 'txt2img', aspectRatio, orgId }),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-logo.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'instagramPost') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const { config, aspectRatio } = resolveImageModel(
						'nano-banana-pro',
						resolveInstagramFormat(this.getNodeParameter('igFormat', i) as string),
					);
					const prompt = buildInstagramPrompt(
						this.getNodeParameter('igBrief', i) as string,
						this.getNodeParameter('igBrandStyle', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({ prompt, styleId: config.styleId, variation: 'txt2img', aspectRatio, orgId }),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-instagram.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'interiorDesign') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const roomPhoto = (this.getNodeParameter('interiorRoomPhoto', i) as string).trim();
					const hasPhoto = roomPhoto !== '';
					const { config, aspectRatio } = resolveImageModel('nano-banana-pro', '16:9');
					const prompt = buildInteriorPrompt(
						this.getNodeParameter('interiorRoomType', i) as string,
						this.getNodeParameter('interiorStyle', i) as string,
						this.getNodeParameter('interiorPalette', i) as string,
						this.getNodeParameter('interiorElements', i) as string,
						hasPhoto,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt,
							styleId: config.styleId,
							variation: hasPhoto ? 'img2img' : 'txt2img',
							aspectRatio,
							orgId,
							imageUrl: hasPhoto ? roomPhoto : undefined,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-interior.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'youtubeThumbnail') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const { config, aspectRatio } = resolveImageModel('nano-banana-pro', '16:9');
					const prompt = buildYouTubeThumbnailPrompt(
						this.getNodeParameter('ytTitle', i) as string,
						this.getNodeParameter('ytChannelStyle', i) as string,
						this.getNodeParameter('ytSubject', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({ prompt, styleId: config.styleId, variation: 'txt2img', aspectRatio, orgId }),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-thumbnail.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'giantProduct') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const productImage = (this.getNodeParameter('giantProductImage', i) as string).trim();
					const { config, aspectRatio } = resolveImageModel('nano-banana-pro', '3:4');
					const prompt = buildGiantProductPrompt(this.getNodeParameter('giantPerson', i) as string);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt,
							styleId: config.styleId,
							variation: 'img2img',
							aspectRatio,
							orgId,
							imageUrl: productImage,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-showcase.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'image' && operation === 'ugcTryon') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const productImageUrl = (this.getNodeParameter('ugcProductImageUrl', i) as string).trim();
					const { config, aspectRatio } = resolveImageModel(
						'nano-banana-pro',
						resolveUGCAspect(this.getNodeParameter('ugcPlatform', i) as string),
					);
					const prompt = buildUGCPrompt(
						this.getNodeParameter('ugcProductName', i) as string,
						this.getNodeParameter('ugcProductType', i) as string,
						this.getNodeParameter('ugcModelDescription', i) as string,
						this.getNodeParameter('ugcSetting', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt,
							styleId: config.styleId,
							variation: 'img2img',
							aspectRatio,
							orgId,
							imageUrl: productImageUrl,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'image',
							filename: 'imagineart-ugc.png',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'droneVideo') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const referenceImage = (this.getNodeParameter('droneReferenceImage', i) as string).trim();
					const { config, aspectRatio, duration, model } = resolveVideoModel(
						this.getNodeParameter('droneModel', i) as string,
						'16:9',
						'6',
					);
					const prompt = buildDronePrompt(
						this.getNodeParameter('droneSubject', i) as string,
						this.getNodeParameter('droneShotType', i) as string,
						this.getNodeParameter('droneStyle', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/video/upload',
						buildVideoForm({
							prompt,
							styleId: config.styleId,
							variation: referenceImage ? 'image_to_video' : 'text_to_video',
							aspectRatio,
							duration,
							orgId,
							resolution: resolveVideoResolution(config, ''),
							imageUrl: referenceImage || undefined,
						}),
					);
					returnData.push({
						json: { assetId: id, status: 'queued', done: false, resource: 'video', model, aspectRatio, duration, filename: 'imagineart.mp4' },
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'productAd') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const productImageUrl = (this.getNodeParameter('paProductImageUrl', i) as string).trim();
					const { config, aspectRatio, duration, model } = resolveVideoModel(
						this.getNodeParameter('paModel', i) as string,
						'16:9',
						'6',
					);
					const prompt = buildProductAdPrompt(
						this.getNodeParameter('paBrandBrief', i) as string,
						this.getNodeParameter('paMood', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/video/upload',
						buildVideoForm({
							prompt,
							styleId: config.styleId,
							variation: 'image_to_video',
							aspectRatio,
							duration,
							orgId,
							resolution: resolveVideoResolution(config, this.getNodeParameter('paResolution', i) as string),
							imageUrl: productImageUrl,
						}),
					);
					returnData.push({
						json: { assetId: id, status: 'queued', done: false, resource: 'video', model, aspectRatio, duration, filename: 'imagineart.mp4' },
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'cookingVideo') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const personImage = (this.getNodeParameter('cookingPersonImage', i) as string).trim();
					const dish = this.getNodeParameter('cookingDish', i) as string;
					const kitchen = this.getNodeParameter('cookingKitchenStyle', i) as string;
					const outfit = this.getNodeParameter('cookingOutfit', i) as string;
					const durationSeconds = String(this.getNodeParameter('cookingDurationSeconds', i) as number);
					const sheetImg = resolveImageModel('gpt-image-2', '16:9');
					const sheetId = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt: buildCookingSheetPrompt(dish, kitchen, outfit, durationSeconds),
							styleId: sheetImg.config.styleId,
							variation: 'img2img',
							aspectRatio: sheetImg.aspectRatio,
							orgId,
							imageUrl: personImage,
						}),
					);
					const vid = resolveVideoModel('seedance-2.0-fast', '16:9', durationSeconds);
					const videoFields = buildVideoForm({
						prompt: buildCookingVideoPrompt(dish, kitchen, outfit, durationSeconds),
						styleId: vid.config.styleId,
						variation: 'image_to_video',
						aspectRatio: vid.aspectRatio,
						duration: vid.duration,
						orgId,
						resolution: resolveVideoResolution(vid.config, this.getNodeParameter('cookingResolution', i) as string),
					});
					returnData.push({
						json: {
							assetId: sheetId,
							status: 'queued',
							done: false,
							resource: 'video',
							stage: 'image',
							pendingVideo: { endpoint: '/video/upload', fields: videoFields, filename: 'imagineart-cooking.mp4' },
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'jewelryVideo') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const desc = this.getNodeParameter('jewelryDescription', i) as string;
					const surface = this.getNodeParameter('jewelrySurface', i) as string;
					const stillImg = resolveImageModel('nano-banana-2', '1:1');
					const stillId = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt: buildJewelryImagePrompt(desc, surface),
							styleId: stillImg.config.styleId,
							variation: 'txt2img',
							aspectRatio: stillImg.aspectRatio,
							orgId,
						}),
					);
					const vid = resolveVideoModel(
						this.getNodeParameter('jewelryModel', i) as string,
						'1:1',
						String(this.getNodeParameter('jewelryDuration', i) as number),
					)
					const videoFields = buildVideoForm({
						prompt: buildJewelryVideoPrompt(desc, surface),
						styleId: vid.config.styleId,
						variation: 'image_to_video',
						aspectRatio: vid.aspectRatio,
						duration: vid.duration,
						orgId,
						resolution: resolveVideoResolution(vid.config, this.getNodeParameter('jewelryResolution', i) as string),
					});
					returnData.push({
						json: {
							assetId: stillId,
							status: 'queued',
							done: false,
							resource: 'video',
							stage: 'image',
							pendingVideo: { endpoint: '/video/upload', fields: videoFields, filename: 'imagineart-jewelry.mp4' },
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'logo3d') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const logoUrl = (this.getNodeParameter('logo3dImageUrl', i) as string).trim();
					const material = this.getNodeParameter('logo3dMaterial', i) as string;
					const stillImg = resolveImageModel('nano-banana-2', '1:1');
					const stillId = await submitMultipart(
						this,
						vag,
						'/image/generations/upload',
						buildImageForm({
							prompt: buildLogo3DImagePrompt(material),
							styleId: stillImg.config.styleId,
							variation: 'img2img',
							aspectRatio: stillImg.aspectRatio,
							orgId,
							imageUrl: logoUrl,
						}),
					);
					const vid = resolveVideoModel(
						this.getNodeParameter('logo3dModel', i) as string,
						'16:9',
						String(this.getNodeParameter('logo3dDuration', i) as number),
					)
					const videoFields = buildVideoForm({
						prompt: buildLogoAnimationPrompt(material),
						styleId: vid.config.styleId,
						variation: 'image_to_video',
						aspectRatio: vid.aspectRatio,
						duration: vid.duration,
						orgId,
						resolution: resolveVideoResolution(vid.config, this.getNodeParameter('logo3dResolution', i) as string),
					});
					returnData.push({
						json: {
							assetId: stillId,
							status: 'queued',
							done: false,
							resource: 'video',
							stage: 'image',
							pendingVideo: { endpoint: '/video/upload', fields: videoFields, filename: 'imagineart-logo3d.mp4' },
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'video' && operation === 'generate') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const prompt = this.getNodeParameter('prompt', i) as string;
					const { config, aspectRatio, duration, model } = resolveVideoModel(
						this.getNodeParameter('videoModel', i) as string,
						this.getNodeParameter('videoAspectRatio', i) as string,
						this.getNodeParameter('duration', i) as string,
					);
					const id = await submitMultipart(
						this,
						vag,
						'/video/upload',
						buildVideoForm({
							prompt,
							styleId: config.styleId,
							variation: config.variation,
							aspectRatio,
							duration,
							orgId,
							resolution: resolveVideoResolution(config, ''),
							folderId: this.getNodeParameter('folderId', i, '') as string,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'video',
							model,
							aspectRatio,
							duration,
							filename: 'imagineart.mp4',
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'getResult') {
					const assetId = this.getNodeParameter('assetId', i) as string;
					const inputJson = (items[i]?.json ?? {}) as IDataObject;
					const status = await fetchAssetStatus(this, vag, assetId);
					const url = firstGenerationUrl(status);
					if (!url) {
						// Still running (or failed) — carry pending markers so a Wait -> loop can resume.
						const carry: IDataObject = {};
						if (inputJson.filename) carry.filename = inputJson.filename;
						if (inputJson.pendingVideo) carry.pendingVideo = inputJson.pendingVideo;
						returnData.push({
							json: {
								assetId,
								status: status.assets[0]?.status ?? status.status,
								done: false,
								failed: status.assets.some((a) => isFailureStatus(a.status)),
								...carry,
							},
							pairedItem: { item: i },
						});
					} else if (inputJson.pendingVideo) {
						// Chained recipe: the stage-1 image is ready — submit the video using it.
						const pending = inputJson.pendingVideo as {
							endpoint: string;
							fields: Record<string, string | string[]>;
							filename?: string;
						};
						const videoId = await submitMultipart(this, vag, pending.endpoint, {
							...pending.fields,
							image_url: url,
						});
						returnData.push({
							json: { assetId: videoId, status: 'queued', done: false, filename: pending.filename ?? 'imagineart.mp4' },
							pairedItem: { item: i },
						});
					} else {
						const filename = (inputJson.filename as string) || 'imagineart-result';
						const binary = await downloadBinary(this, url, filename);
						returnData.push({
							json: { assetId, url, done: true },
							binary: { data: binary },
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'audio' && operation === 'generate') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const prompt = this.getNodeParameter('prompt', i) as string;
					const duration = this.getNodeParameter('musicDuration', i) as number;
					const variation = this.getNodeParameter('musicVariation', i) as string;
					const id = await submitMultipart(
						this,
						vag,
						'/audio/music/upload',
						buildMusicForm({
							prompt,
							duration: String(duration),
							variation,
							orgId,
							folderId: this.getNodeParameter('folderId', i, '') as string,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'audio',
							filename: 'imagineart.mp3',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'asset' && operation === 'listGenerations') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const query = `status=finished&service=image&service=video&limit=50&offset=0&org_id=${encodeURIComponent(orgId)}`;
					const res = parseStatusResponse(await getJson(this, `${vag}/assets/status?${query}`));
					for (const a of res.assets) {
						returnData.push({
							json: {
								status: a.status,
								url: a.url?.generation?.[0] ?? null,
								thumbnailUrl: a.url?.thumbnail?.[0] ?? null,
								metadata: a.asset_metadata ?? {},
							},
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'asset' && operation === 'listUploadedAssets') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const query = `service=user&refService=image,video&limit=50&offset=0&org_id=${encodeURIComponent(orgId)}`;
					const res = parseStatusResponse(await getJson(this, `${vag}/assets/status?${query}`));
					for (const a of res.assets) {
						returnData.push({
							json: {
								status: a.status,
								url: a.url?.processed?.[0] ?? a.url?.generation?.[0] ?? null,
								thumbnailUrl: a.url?.thumbnail?.[0] ?? null,
								metadata: a.asset_metadata ?? {},
							},
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'asset' && operation === 'upload') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const prop = this.getNodeParameter('uploadBinaryProperty', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, prop);
					const buffer = await this.helpers.getBinaryDataBuffer(i, prop);
					const url = await uploadUserFile(this, vag, orgId, {
						buffer,
						filename: binaryData.fileName ?? 'upload',
						mimeType: binaryData.mimeType ?? 'application/octet-stream',
					});
					returnData.push({
						json: {
							url,
							fileName: binaryData.fileName ?? null,
							mimeType: binaryData.mimeType ?? null,
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'adStudio' && operation === 'listProducts') {
					const ownership = this.getNodeParameter('adOwnership', i) as string;
					const rows = await listMarketCatalog(this, vag, '/market/product', ownership, mapProductRows);
					for (const row of rows) {
						returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
					}
				} else if (resource === 'adStudio' && operation === 'listAvatars') {
					const ownership = this.getNodeParameter('adOwnership', i) as string;
					const rows = await listMarketCatalog(this, vag, '/market/avatar', ownership, mapAvatarRows);
					for (const row of rows) {
						returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
					}
				} else if (resource === 'adStudio' && operation === 'listTemplates') {
					const kind = this.getNodeParameter('adTemplateKind', i) as string;
					const body = await getJson(this, `${vag}/market/template?type=${encodeURIComponent(kind)}`);
					for (const row of mapTemplateRows(body)) {
						returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
					}
				} else if (resource === 'adStudio' && operation === 'listProjects') {
					const folderId = (this.getNodeParameter('folderId', i, '') as string).trim();
					if (!folderId) {
						throw new NodeOperationError(
							this.getNode(),
							'A folder is required to list marketing projects.',
							{ itemIndex: i },
						);
					}
					const body = await getJson(
						this,
						`${vag}/marketing-mode/projects?folder_id=${encodeURIComponent(folderId)}`,
					);
					for (const row of mapProjectRows(body)) {
						returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
					}
				} else if (resource === 'adStudio' && operation === 'createProject') {
					const name = (this.getNodeParameter('adProjectName', i) as string).trim();
					const folderId = (this.getNodeParameter('folderId', i, '') as string).trim();
					if (!folderId) {
						throw new NodeOperationError(
							this.getNode(),
							'A folder is required to create a marketing project.',
							{ itemIndex: i },
						);
					}
					const body = (await postMultipart(this, vag, '/marketing-mode/projects', {
						name,
						folder_id: folderId,
					})) as { uuid?: string; name?: string };
					if (!body?.uuid) {
						throw new NodeOperationError(this.getNode(), 'ImagineArt did not return a project id.', {
							itemIndex: i,
						});
					}
					returnData.push({
						json: { marketProjectId: body.uuid, name: body.name ?? name },
						pairedItem: { item: i },
					});
				} else if (resource === 'adStudio' && operation === 'uploadImage') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const prop = this.getNodeParameter('uploadBinaryProperty', i) as string;
					const binaryData = this.helpers.assertBinaryData(i, prop);
					const buffer = await this.helpers.getBinaryDataBuffer(i, prop);
					const uploaded = await uploadMarketImage(this, vag, orgId, {
						buffer,
						filename: binaryData.fileName ?? 'upload',
						mimeType: binaryData.mimeType ?? 'application/octet-stream',
					});
					returnData.push({ json: uploaded, pairedItem: { item: i } });
				} else if (resource === 'adStudio' && operation === 'createProduct') {
					const source = this.getNodeParameter('adProductSource', i) as string;
					let body: { id?: string; status?: string };
					if (source === 'url') {
						const productUrl = (this.getNodeParameter('adProductUrl', i) as string).trim();
						body = (await postMultipart(this, vag, '/market/product/from-url', {
							url: productUrl,
						})) as { id?: string; status?: string };
					} else {
						const name = (this.getNodeParameter('adProductName', i) as string).trim();
						const description = (this.getNodeParameter('adProductDescription', i) as string).trim();
						const photos = collectPhotos(
							this.getNodeParameter('adProductPhotos.photo', i, []) as Array<
								Record<string, string | undefined>
							>,
							['url', 'bytedanceId'],
						);
						if (photos.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'At least one uploaded photo is required for a manual product.',
								{ itemIndex: i },
							);
						}
						body = (await postMultipart(this, vag, '/market/product/manual', {
							name,
							description,
							photos: JSON.stringify(photos),
						})) as { id?: string; status?: string };
					}
					returnData.push({
						json: { id: body?.id ?? null, status: body?.status ?? null },
						pairedItem: { item: i },
					});
				} else if (resource === 'adStudio' && operation === 'productStatus') {
					const id = (this.getNodeParameter('adProductId', i) as string).trim();
					const body = (await getJson(this, `${vag}/market/product/${encodeURIComponent(id)}`)) as {
						id?: string;
						status?: string;
					};
					returnData.push({
						json: { id: body?.id ?? id, status: body?.status ?? null },
						pairedItem: { item: i },
					});
				} else if (resource === 'adStudio' && operation === 'createAvatar') {
					const name = (this.getNodeParameter('adAvatarName', i) as string).trim();
					const gender = this.getNodeParameter('adAvatarGender', i) as string;
					const description = (this.getNodeParameter('adAvatarDescription', i, '') as string).trim();
					const photos = collectPhotos(
						this.getNodeParameter('adAvatarPhotos.photo', i, []) as Array<Record<string, string | undefined>>,
						['url'],
					);
					if (photos.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'At least one uploaded photo is required for an avatar.',
							{ itemIndex: i },
						);
					}
					const fields: Record<string, string> = { name, gender, photos: JSON.stringify(photos) };
					if (description) fields.description = description;
					const body = (await postMultipart(this, vag, '/market/avatar', fields)) as {
						id?: number | string;
					};
					returnData.push({ json: { id: body?.id ?? null }, pairedItem: { item: i } });
				} else if (resource === 'adStudio' && operation === 'generateAd') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const marketProjectId = (this.getNodeParameter('marketProjectId', i) as string).trim();
					const prompt = this.getNodeParameter('prompt', i) as string;
					const folderId = (this.getNodeParameter('folderId', i, '') as string).trim();
					const images: AdImageRef[] = (
						this.getNodeParameter('adImages.image', i, []) as Array<{ url?: string; id?: string }>
					)
						.map((im) => ({ url: (im.url ?? '').trim(), id: (im.id ?? '').trim() }))
						.filter((im) => im.url !== '');
					const id = await submitMultipart(
						this,
						vag,
						'/video/upload',
						buildAdForm({
							prompt,
							marketProjectId,
							orgId,
							folderId: folderId || undefined,
							images,
							aspectRatio: this.getNodeParameter('adAspectRatio', i) as string,
							duration: this.getNodeParameter('adDuration', i) as string,
							resolution: this.getNodeParameter('adResolution', i) as string,
						}),
					);
					returnData.push({
						json: {
							assetId: id,
							status: 'queued',
							done: false,
							resource: 'adStudio',
							filename: 'imagineart-ad.mp4',
						},
						pairedItem: { item: i },
					});
				} else if (resource === 'account' && operation === 'getBalance') {
					const orgId = this.getNodeParameter('organization', i) as string;
					const body = (await getJson(
						this,
						`${vag}/credit?org_id=${encodeURIComponent(orgId)}`,
					)) as { total?: number; tokens?: unknown };
					returnData.push({
						json: { total: body.total ?? 0, tokens: body.tokens ?? [] },
						pairedItem: { item: i },
					});
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation: ${resource} → ${operation}`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
}
