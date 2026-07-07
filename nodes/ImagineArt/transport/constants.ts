export interface BaseUrls {
	auth: string;
	vag: string;
	team: string;
}

// ImagineArt production API hosts.
export const BASE_URLS: BaseUrls = {
	auth: 'https://auth.vyro.ai/apis/v1',
	vag: 'https://imagine.vyro.ai/v1',
	team: 'https://teams-imagine.vyro.ai/v1',
};
