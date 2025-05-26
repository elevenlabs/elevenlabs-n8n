import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ElevenLabsApi implements ICredentialType {
	name = 'elevenLabsApi';
	displayName = 'ElevenLabs API';
	documentationUrl = 'https://docs.elevenlabs.io/api-reference';
	properties: INodeProperties[] = [
		{
			displayName: 'ElevenLabs API Key',
			name: 'xiApiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'xi-api-key': '={{$credentials.xiApiKey}}',
			},
		},
	};

	test?: ICredentialTestRequest | undefined = {
		request: {
			baseURL: 'https://api.elevenlabs.io/v1',
			url: '/voices',
		},
	};
}
