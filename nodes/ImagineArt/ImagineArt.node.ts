import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	executeImagineArt,
	LOAD_OPTIONS,
	OPERATION_DROPDOWNS,
	RESOURCE_DROPDOWN,
	SHARED_FIELDS,
} from './shared';

const CREDENTIAL = 'imagineArtOAuth2Api';

// The unified "do-everything" node: the Resource + Operation dropdowns plus
// every shared field. The focused per-app nodes (ImagineArtImage, …) reuse the
// same shared engine but fix the resource so they each carry their own icon.
export class ImagineArt implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ImagineArt',
		name: 'imagineArt',
		icon: { light: 'file:logo-lg.svg', dark: 'file:logo-lg.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Generate images, video and music, enhance images, remove backgrounds, and manage assets with ImagineArt',
		defaults: { name: 'ImagineArt' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: CREDENTIAL, required: true }],
		properties: [RESOURCE_DROPDOWN, ...OPERATION_DROPDOWNS, ...SHARED_FIELDS],
	};

	methods = { loadOptions: LOAD_OPTIONS };

	// continueOnFail() is handled inside the shared executeImagineArt dispatcher.
	// eslint-disable-next-line @n8n/community-nodes/require-continue-on-fail
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return executeImagineArt.call(this);
	}
}
