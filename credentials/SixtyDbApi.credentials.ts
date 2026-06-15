import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SixtyDbApi implements ICredentialType {
	name = 'sixtyDbApi';
	displayName = '60db API';
	documentationUrl = 'https://docs.60db.ai/api-reference';
	properties: INodeProperties[] = [
		{
			displayName: '60db API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'sk_live_...',
			description: 'Your 60db API key. Sent as a Bearer token for HTTP/streaming and as the apiKey query parameter for the WebSocket transport.',
		},
	];

	// HTTP and streaming transports authenticate with a Bearer token.
	// The WebSocket transport reads `apiKey` directly (passed as a query param) since
	// n8n's generic authenticator only injects HTTP headers.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{ "Bearer " + $credentials.apiKey }}',
			},
		},
	};
}
