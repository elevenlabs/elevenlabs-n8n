import {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export const VoiceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a voice',
				description: 'Returns metadata about a specific voice',
				routing: {
					request: {
						method: 'GET',
						url: '={{"/voices/"  + $parameter["voice"] }}',
					},
					output: {
						postReceive: [
							{
								type: 'setKeyValue',
								enabled: '={{$parameter["simplify"]}}',
								properties: {
									voice_id: '={{$responseItem.voice_id}}',
									name: '={{$responseItem.name}}',
									category: '={{$responseItem.category}}',
									labels: '={{$responseItem.labels}}',
									description: '={{$responseItem.description}}',
									preview_url: '={{$responseItem.preview_url}}',
								},
							},
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many voices',
				// eslint-disable-next-line n8n-nodes-base/node-param-operation-option-description-wrong-for-get-many
				description: 'Returns metadata about all voices',
				routing: {
					request: {
						method: 'GET',
						url: '/voices',
						qs: {
							page_size: '={{$parameter["limit"]}}',
						},
					},
					/*send: {
						paginate: '={{$parameter["returnAll"]}}',
					},*/
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'voices',
								},
							},
							{
								type: 'setKeyValue',
								enabled: '={{$parameter["simplify"]}}',
								properties: {
									voice_id: '={{$responseItem.voice_id}}',
									name: '={{$responseItem.name}}',
									category: '={{$responseItem.category}}',
									labels: '={{$responseItem.labels}}',
									description: '={{$responseItem.description}}',
									preview_url: '={{$responseItem.preview_url}}',
								},
							},
						],
					},
				},
			},
			{
				name: 'Create Clone',
				value: 'createClone',
				action: 'Create a voice clone',
				description: 'Create a voice clone from audio files',
				routing: {
					send: {
						preSend: [ preSendAudioFiles ],
					},
					request: {
						url: '/voices/add',
						returnFullResponse: true,
						method: 'POST',
						headers: {
							'Content-Type': 'multipart/form-data',
						},
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a voice',
				description: 'Delete a specific voice',
				routing: {
					request: {
						url: '={{"/voices/" + $parameter["voice"]}}',
						method: 'DELETE',
					},
				},
			},
		],
		default: 'get',
		displayOptions: {
			show: {
				resource: ['voice'],
			},
		},
	}
]

export const VoiceFields: INodeProperties[] = [
	{
		displayName: 'Voice',
		description: 'The voice you want to use',
		name: 'voice',
		type: 'resourceLocator',
		default: { mode: 'list', value: null },
		displayOptions: {
			show: {
				resource: ['voice'],
				operation: ['delete', 'get'],
			},
		},
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'listVoices',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: '9BWtsMINqrJLrRacOk9x',
			},
		],
		required: true,
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				operation: ['getAll'],
				resource: ['voice'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				operation: ['getAll'],
				resource: ['voice'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: false,
		description: 'Whether to simplify the response',
		displayOptions: {
			show: {
				resource: ['voice'],
				operation: ['get', 'getAll'],
			},
		},
	},
	// Create Clone
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		placeholder: 'e.g. Rachel',
		description: 'The name of the cloned voice',
		displayOptions: {
			show: {
				resource: ['voice'],
				operation: ['createClone'],
			},
		},
	},
	{
		displayName: 'Audio Files',
		name: 'audioFiles',
		type: 'string',
		default: '',
		placeholder: 'data',
		description: 'The audio files to be used for voice cloning',
		displayOptions: {
			show: {
				resource: ['voice'],
				operation: ['createClone'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Fields',
		displayOptions: {
			show: {
				resource: ['voice'],
				operation: ['createClone'],
			},
		},
		options: [
			{
				displayName: 'Description',
				description: 'A description of the voice',
				name: 'description',
				type: 'string',
				default: ``,
				placeholder: 'e.g. A warm, expressive voice with a touch of humor',
			},
			{
				displayName: 'Labels',
				description: 'Key / value pairs to tag this voice with',
				name: 'labels',
				type: 'json',
				default: `{
  "accent": "American",
  "gender": "Female",
  "age": "Middle-aged"
}`,
			},
		],
	},

];

async function preSendAudioFiles(this: IExecuteSingleFunctions, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions> {
	const formData = new FormData();
	const binaryData = this.getNodeParameter('audioFiles', '') as string;
	const audioBuffer = await this.helpers.getBinaryDataBuffer(binaryData);
	const name = this.getNodeParameter('name') as string;

	const description = this.getNodeParameter('additionalFields.description', '') as string;

	const labels = this.getNodeParameter('additionalFields.labels', '{}') as string;
	formData.append('name', name);
	formData.append('description', description);
	formData.append('labels', labels);
	formData.append('files', new Blob([audioBuffer]));

	requestOptions.body = formData;

	return requestOptions;
}
