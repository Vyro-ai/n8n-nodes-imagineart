import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { BASE_URLS } from '../transport/constants';
import { mapProjectsToOptions } from '../transport/adStudio';

// Pure mapper: the team API returns { data: [{ id, name, ... }] }.
export function mapOrgsToOptions(body: unknown): Array<{ name: string; value: string }> {
	const data = (body as { data?: Array<{ id?: string; name?: string }> })?.data;
	if (!Array.isArray(data)) return [];
	return data
		.filter((o) => o?.id)
		.map((o) => ({ name: o.name ?? (o.id as string), value: o.id as string }));
}

export async function getOrganizations(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const { team } = BASE_URLS;
	const body = await this.helpers.httpRequestWithAuthentication.call(this, 'imagineArtOAuth2Api', {
		method: 'GET',
		url: `${team}/org`,
		json: true,
	});
	return mapOrgsToOptions(body);
}

// Pure mapper: the teams API returns { data: [{ id, title|name, category, ... }] };
// keep the folders and label each with its workspace (private/public).
export function mapFoldersToOptions(
	body: unknown,
	workspace: string,
): Array<{ name: string; value: string }> {
	const data = (body as {
		data?: Array<{ id?: string; title?: string; name?: string; category?: string }>;
	})?.data;
	if (!Array.isArray(data)) return [];
	return data
		.filter((f) => f?.id && f.category === 'folder')
		.map((f) => ({ name: `${f.title ?? f.name ?? (f.id as string)} (${workspace})`, value: f.id as string }));
}

export async function getFolders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { team } = BASE_URLS;
	const orgId = (this.getCurrentNodeParameter('organization') as string) ?? '';
	if (!orgId) return [];
	const url = (isPersonal: boolean) =>
		`${team}/org/asset/?org_id=${encodeURIComponent(orgId)}&is_personal=${isPersonal}`;
	const [priv, pub] = await Promise.all([
		this.helpers.httpRequestWithAuthentication.call(this, 'imagineArtOAuth2Api', {
			method: 'GET',
			url: url(true),
			json: true,
		}),
		this.helpers.httpRequestWithAuthentication.call(this, 'imagineArtOAuth2Api', {
			method: 'GET',
			url: url(false),
			json: true,
		}),
	]);
	return [...mapFoldersToOptions(priv, 'private'), ...mapFoldersToOptions(pub, 'public')];
}

// Marketing projects in the selected folder (Ad Studio). Depends on the
// folderId param — the marketing-mode endpoint is folder-scoped.
export async function getMarketProjects(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const { vag } = BASE_URLS;
	const folderId = (this.getCurrentNodeParameter('folderId') as string) ?? '';
	if (!folderId) return [];
	const body = await this.helpers.httpRequestWithAuthentication.call(this, 'imagineArtOAuth2Api', {
		method: 'GET',
		url: `${vag}/marketing-mode/projects?folder_id=${encodeURIComponent(folderId)}`,
		json: true,
	});
	return mapProjectsToOptions(body);
}
