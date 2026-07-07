import type { INodePropertyOptions } from 'n8n-workflow';
import { ImagineArt } from '../nodes/ImagineArt/ImagineArt.node';

describe('ImagineArt node description', () => {
	const node = new ImagineArt();

	it('declares the credential and the Image/Generate resource+operation', () => {
		expect(node.description.name).toBe('imagineArt');
		expect(node.description.credentials?.[0]).toMatchObject({
			name: 'imagineArtOAuth2Api',
			required: true,
		});

		const resource = node.description.properties.find((p) => p.name === 'resource');
		const resourceValues = ((resource?.options ?? []) as INodePropertyOptions[]).map((o) => o.value);
		expect(resourceValues).toContain('image');

		const operation = node.description.properties.find((p) => p.name === 'operation');
		const operationValues = ((operation?.options ?? []) as INodePropertyOptions[]).map(
			(o) => o.value,
		);
		expect(operationValues).toContain('generate');
	});

	it('exposes the getOrganizations loadOptions method', () => {
		expect(typeof node.methods?.loadOptions?.getOrganizations).toBe('function');
	});
});
