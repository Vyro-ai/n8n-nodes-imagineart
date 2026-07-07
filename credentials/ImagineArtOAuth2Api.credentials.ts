import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

// OAuth2 + PKCE against ImagineArt's MCP auth endpoints, reusing the same flow
// as the Figma/Premiere plugins. Public client (no secret): the Client ID is
// baked in and the Client Secret is a hidden placeholder — the user only clicks
// Connect.
const AUTHORIZE_URL = 'https://imagine.art/plugins/authorize';
const TOKEN_URL = 'https://auth.vyro.ai/apis/v1/mcp/token';

// Public OAuth client (token_endpoint_auth_method: "none") — the client_id is
// not secret. Registered via POST <auth>/apis/v1/mcp/register.
const CLIENT_ID = 'mcp_R3Ll1yO9oPU57n7R45f-lT1_kwu9jPfMfjmG9TI4l6A';

export class ImagineArtOAuth2Api implements ICredentialType {
	name = 'imagineArtOAuth2Api';

	displayName = 'ImagineArt OAuth2 API';

	icon: Icon = { light: 'file:logo-lg.svg', dark: 'file:logo-lg.dark.svg' };

	extends = ['oAuth2Api'];

	documentationUrl = 'https://docs.imagine.art';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'hidden',
			default: CLIENT_ID,
		},
		{
			// PKCE needs no secret; n8n still requires the field, so ship a hidden
			// placeholder. It is not sent in the PKCE token exchange.
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'hidden',
			typeOptions: { password: true },
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: AUTHORIZE_URL,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: TOKEN_URL,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'mcp:tools',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: 'app=n8n',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
	];
}
