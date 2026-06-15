import { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions, IN8nHttpFullResponse, INodeExecutionData, INodeProperties } from "n8n-workflow";

export const SpeechOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Text to Speech',
				value: 'textToSpeech',
				description: 'Converts text into speech and returns audio',
				action: 'Convert text to speech',
				routing: {
					request: {
						url: '={{"/text-to-speech/"+$parameter["voice"]}}',
						returnFullResponse: true,
						encoding: 'arraybuffer',
					},
					output: {
						postReceive: [ returnBinaryData ],
					}
				},
			},
			{
				name: 'Speech to Text',
				value: 'speechToText',
				description: 'Transcribe an audio or video file',
				action: 'Transcribe audio or video',
				routing: {
					request: {
						url: '/speech-to-text',
						method: 'POST',
						headers: {
							'Content-Type': 'multipart/form-data',
						},
					},
					send: {
						preSend: [ preSendSpeechToText ],
					},
				},
			},
			{
				name: 'Speech to Speech',
				value: 'speechToSpeech',
				description: 'Transform audio from one voice to another',
				action: 'Change a voice',
				routing: {
					send: {
						preSend: [ preSendSpeechToSpeech ],
					},
					request: {
						url: '={{"/speech-to-speech/"+$parameter["voice"]}}',
						returnFullResponse: true,
						encoding: 'arraybuffer',
						headers: {
							'Content-Type': 'multipart/form-data',
						},
					},
					output: {
						postReceive: [ returnBinaryData ],
					},
				},
			},
		],
		default: 'textToSpeech',
		displayOptions: {
			show: {
				resource: ['speech'],
			},
		},
	}
];

export const SpeechFields: INodeProperties[] = [
	// Text to Speech
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'options',
		noDataExpression: true,
		description: 'Which text-to-speech provider to use. Both providers are interchangeable; the rest of the workflow does not change.',
		options: [
			{
				name: 'ElevenLabs',
				value: 'elevenLabs',
				description: 'Use the ElevenLabs API (requires ElevenLabs API credentials)',
			},
			{
				name: '60db',
				value: '60db',
				description: 'Use the 60db API (requires 60db API credentials)',
			},
		],
		default: 'elevenLabs',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
			},
		},
	},
	{
		displayName: 'Transport',
		name: 'transport',
		type: 'options',
		noDataExpression: true,
		description: 'How to call the 60db API. All transports return a single audio binary; streaming and WebSocket assemble chunks before returning.',
		options: [
			{
				name: 'HTTP',
				value: 'http',
				description: 'Simple request/response — POST /tts-synthesize',
			},
			{
				name: 'Streaming (NDJSON)',
				value: 'stream',
				description: 'Chunked NDJSON audio — POST /tts-stream',
			},
			{
				name: 'WebSocket',
				value: 'websocket',
				description: 'Real-time WebSocket synthesis — wss://api.60db.ai/ws/tts',
			},
		],
		default: 'http',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
				provider: ['60db'],
			},
		},
	},
	{
		displayName: 'Voice ID',
		name: 'sixtyDbVoiceId',
		type: 'string',
		default: '',
		placeholder: 'fbb75ed2-975a-40c7-9e06-38e30524a9a1',
		description: 'The 60db voice ID to use for the conversion',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
				provider: ['60db'],
			},
		},
	},
	{
		displayName: 'Voice',
		description: 'Select the voice to use for the conversion',
		name: 'voice',
		type: 'resourceLocator',
		default: { mode: 'list', value: null },
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
				provider: ['elevenLabs'],
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
		displayName: 'Text',
		description: 'The text that will get converted into speech',
		placeholder: 'e.g. The first move is what sets everything in motion.',
		name: 'text',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
			},
		},
		required: true,
		routing: {
			send: {
				type: 'body',
				property: 'text',
			},
		},
	},
	// 60db Additional Options
	{
		displayName: 'Additional Options',
		name: 'sixtyDbOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
				provider: ['60db'],
			},
		},
		options: [
			{
				displayName: 'Audio Encoding',
				name: 'audioEncoding',
				type: 'options',
				default: 'LINEAR16',
				description: 'WebSocket audio encoding. LINEAR16 and MULAW are wrapped in a WAV container.',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{ name: 'LINEAR16 (PCM)', value: 'LINEAR16' },
					{ name: 'MULAW', value: 'MULAW' },
					{ name: 'OGG_OPUS', value: 'OGG_OPUS' },
				],
				displayOptions: {
					show: {
						'/transport': ['websocket'],
					},
				},
			},
			{
				displayName: 'Enhance',
				name: 'enhance',
				type: 'boolean',
				default: true,
				description: 'Whether to apply audio quality enhancement',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				default: 'mp3',
				description: 'Audio container for the HTTP and streaming transports',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{ name: 'MP3', value: 'mp3' },
					{ name: 'WAV', value: 'wav' },
					{ name: 'OGG', value: 'ogg' },
					{ name: 'FLAC', value: 'flac' },
				],
				displayOptions: {
					show: {
						'/transport': ['http', 'stream'],
					},
				},
			},
			{
				displayName: 'Sample Rate',
				name: 'sampleRate',
				type: 'options',
				default: 16000,
				description: 'WebSocket output sample rate in Hz',
				options: [
					{ name: '8000 Hz', value: 8000 },
					{ name: '16000 Hz', value: 16000 },
					{ name: '24000 Hz', value: 24000 },
					{ name: '48000 Hz', value: 48000 },
				],
				displayOptions: {
					show: {
						'/transport': ['websocket'],
					},
				},
			},
			{
				displayName: 'Similarity',
				name: 'similarity',
				type: 'number',
				default: 75,
				typeOptions: { minValue: 0, maxValue: 100 },
				description: 'How closely to match the source voice (0–100)',
			},
			{
				displayName: 'Speed',
				name: 'speed',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 0.5, maxValue: 2, numberPrecision: 2 },
				description: 'Playback rate multiplier (0.5–2.0)',
			},
			{
				displayName: 'Stability',
				name: 'stability',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 0, maxValue: 100 },
				description: 'Voice consistency (0–100; lower is more expressive)',
			},
		],
	},
	// ElevenLabs Additional Options
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['textToSpeech'],
				provider: ['elevenLabs'],
			},
		},
		options: [
			{
		displayName: 'Model',
		description: 'Select the model to use for the conversion',
		name: 'model',
		type: 'resourceLocator',
		default: { mode: 'list', value: 'eleven_multilingual_v2' },
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'listModels',
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
		routing: {
			send: {
				type: 'body',
				property: 'model_id',
			},
		},
		},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				description: 'Output format of the generated audio',
				type: 'options',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{
						name: 'MP3 22050 32',
						value: 'mp3_22050_32',
						description: 'MP3 format, 22050 Hz, 32 kbps',
					},
					{
						name: 'MP3 44100 32',
						value: 'mp3_44100_32',
						description: 'MP3 format, 44100 Hz, 32 kbps',
					},
					{
						name: 'MP3 44100 64',
						value: 'mp3_44100_64',
						description: 'MP3 format, 44100 Hz, 64 kbps',
					},
					{
						name: 'MP3 44100 96',
						value: 'mp3_44100_96',
						description: 'MP3 format, 44100 Hz, 96 kbps',
					},
					{
						name: 'MP3 44100 128',
						value: 'mp3_44100_128',
						description: 'MP3 format, 44100 Hz, 128 kbps',
					},
					{
						name: 'MP3 44100 192',
						value: 'mp3_44100_192',
						description: 'MP3 format, 44100 Hz, 192 kbps',
					},
					{
						name: 'PCM 8000',
						value: 'pcm_8000',
						description: 'PCM format, 8000 Hz, 16-bit',
					},
					{
						name: 'PCM 16000',
						value: 'pcm_16000',
						description: 'PCM format, 16000 Hz, 16-bit',
					},
					{
						name: 'PCM 22050',
						value: 'pcm_22050',
						description: 'PCM format, 22050 Hz, 16-bit',
					},
					{
						name: 'PCM 24000',
						value: 'pcm_24000',
						description: 'PCM format, 24000 Hz, 16-bit',
					},
					{
						name: 'PCM 44100',
						value: 'pcm_44100',
						description: 'PCM format, 44100 Hz, 16-bit',
					},
					{
						name: 'PCM 48000',
						value: 'pcm_48000',
						description: 'PCM format, 48000 Hz, 16-bit',
					},
					{
						name: 'ULAW 8000',
						value: 'ulaw_8000',
						description: 'ULAW format, 8000 Hz, 16-bit',
					},
					{
						name: 'ALAW 8000',
						value: 'alaw_8000',
						description: 'ALAW format, 8000 Hz, 16-bit',
					},
					{
						name: 'OPUS 48000 32',
						value: 'opus_48000_32',
						description: 'OPUS format, 48000 Hz, 32 kbps',
					},
					{
						name: 'OPUS 48000 64',
						value: 'opus_48000_64',
						description: 'OPUS format, 48000 Hz, 64 kbps',
					},
					{
						name: 'OPUS 48000 96',
						value: 'opus_48000_96',
						description: 'OPUS format, 48000 Hz, 96 kbps',
					},
					{
						name: 'OPUS 48000 128',
						value: 'opus_48000_128',
						description: 'OPUS format, 48000 Hz, 128 kbps',
					},
					{
						name: 'OPUS 48000 192',
						value: 'opus_48000_192',
						description: 'OPUS format, 48000 Hz, 192 kbps',
					},
				],
				default: 'mp3_44100_128',
				routing: {
			send: {
				type: 'query',
				property: 'output_format',
			},
		},
			},
			{
				displayName: 'Language Code',
				name: 'languageCode',
				description: 'Language code (ISO 639-1) used to enforce a language for the model',
				type: 'string',
				default: 'en',
				routing: {
					send: {
						type: 'body',
						property: 'language_code',
						value: '={{ $parameter["model"].includes("turbo_v2") || $parameter["model"].includes("flash_v2") ? $value : undefined }}',
					},
				},
			},
			{
				displayName: 'Voice Settings',
				name: 'voiceSettings',
				type: 'json',
				default: `{
  "stability": 1,
  "similarity_boost": 1,
  "style": 0,
  "use_speaker_boost": true,
  "speed": 1
}`,
				description: 'Voice settings overriding stored settings for the given voice',
				routing: {
				send: {
					type: 'body',
					property: 'voice_settings',
					value: '={{ JSON.parse($value) }}',
				},
			},
			}
		],
	},
	// Speech to Text
	{
		displayName: 'File',
		description: 'The audio or video file to transcribe',
		name: 'file',
		type: 'string',
		default: 'data',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['speechToText'],
			},
		},
		required: true,
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['speechToText'],
			},
		},
		options: [
			{
		displayName: 'Model',
		description: 'Select the model to use for the conversion',
		name: 'model',
		type: 'resourceLocator',
		default: { mode: 'list', value: null },
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'listModels',
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
		},
			{
				displayName: 'Language Code',
				name: 'languageCode',
				description: 'Language code (ISO 639-1) used to enforce a language for the model',
				type: 'string',
				default: 'en',
			},
			{
				displayName: 'Number of Speakers',
				name: 'numberOfSpeakers',
				description: 'Maximum number of speakers in the file',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 1,
				},
			},
			{
				displayName: 'Diarize',
				name: 'diarize',
				description: 'Whether to annotate which speaker is currently talking in the uploaded file',
				type: 'boolean',
				default: false,
			},
		],
	},
	// Speech to Speech
	{
		displayName: 'File',
		description: 'The audio file to convert. All major audio formats are supported.',
		name: 'file',
		type: 'string',
		default: 'data',
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['speechToSpeech'],
			},
		},
		required: true,
	},
	{
		displayName: 'Voice',
		description: 'Select the voice to use for the conversion',
		name: 'voice',
		type: 'resourceLocator',
		default: { mode: 'list', value: null },
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['speechToSpeech'],
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
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['speech'],
				operation: ['speechToSpeech'],
			},
		},
		options: [
			{
		displayName: 'Model',
		description: 'Select the model to use for the conversion',
		name: 'model',
		type: 'resourceLocator',
		default: { mode: 'list', value: null },
		modes: [
			{
				displayName: 'From list',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'listModels',
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
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				description: 'Output format of the generated audio',
				type: 'options',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{
						name: 'MP3 22050 32',
						value: 'mp3_22050_32',
						description: 'MP3 format, 22050 Hz, 32 kbps',
					},
					{
						name: 'MP3 44100 32',
						value: 'mp3_44100_32',
						description: 'MP3 format, 44100 Hz, 32 kbps',
					},
					{
						name: 'MP3 44100 64',
						value: 'mp3_44100_64',
						description: 'MP3 format, 44100 Hz, 64 kbps',
					},
					{
						name: 'MP3 44100 96',
						value: 'mp3_44100_96',
						description: 'MP3 format, 44100 Hz, 96 kbps',
					},
					{
						name: 'MP3 44100 128',
						value: 'mp3_44100_128',
						description: 'MP3 format, 44100 Hz, 128 kbps',
					},
					{
						name: 'MP3 44100 192',
						value: 'mp3_44100_192',
						description: 'MP3 format, 44100 Hz, 192 kbps',
					},
					{
						name: 'PCM 8000',
						value: 'pcm_8000',
						description: 'PCM format, 8000 Hz, 16-bit',
					},
					{
						name: 'PCM 16000',
						value: 'pcm_16000',
						description: 'PCM format, 16000 Hz, 16-bit',
					},
					{
						name: 'PCM 22050',
						value: 'pcm_22050',
						description: 'PCM format, 22050 Hz, 16-bit',
					},
					{
						name: 'PCM 24000',
						value: 'pcm_24000',
						description: 'PCM format, 24000 Hz, 16-bit',
					},
					{
						name: 'PCM 44100',
						value: 'pcm_44100',
						description: 'PCM format, 44100 Hz, 16-bit',
					},
					{
						name: 'PCM 48000',
						value: 'pcm_48000',
						description: 'PCM format, 48000 Hz, 16-bit',
					},
					{
						name: 'ULAW 8000',
						value: 'ulaw_8000',
						description: 'ULAW format, 8000 Hz, 16-bit',
					},
					{
						name: 'ALAW 8000',
						value: 'alaw_8000',
						description: 'ALAW format, 8000 Hz, 16-bit',
					},
					{
						name: 'OPUS 48000 32',
						value: 'opus_48000_32',
						description: 'OPUS format, 48000 Hz, 32 kbps',
					},
					{
						name: 'OPUS 48000 64',
						value: 'opus_48000_64',
						description: 'OPUS format, 48000 Hz, 64 kbps',
					},
					{
						name: 'OPUS 48000 96',
						value: 'opus_48000_96',
						description: 'OPUS format, 48000 Hz, 96 kbps',
					},
					{
						name: 'OPUS 48000 128',
						value: 'opus_48000_128',
						description: 'OPUS format, 48000 Hz, 128 kbps',
					},
					{
						name: 'OPUS 48000 192',
						value: 'opus_48000_192',
						description: 'OPUS format, 48000 Hz, 192 kbps',
					},
				],
				default: 'mp3_44100_128',
				routing: {
					send: {
						type: 'query',
						property: 'output_format',
					},
				},
			},
			{
				displayName: 'Voice Settings',
				name: 'voiceSettings',
				type: 'json',
				default: `{
	"stability": 1,
	"similarity_boost": 1,
	"style": 0,
	"use_speaker_boost": true,
	"speed": 1
}`,
				description: 'Voice settings overriding stored settings for the given voice',
			}
		],
	},
];

async function returnBinaryData<PostReceiveAction>( this: IExecuteSingleFunctions, items: INodeExecutionData[], responseData: IN8nHttpFullResponse ): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation') as string;

	const binaryData = await this.helpers.prepareBinaryData(
		responseData.body as Buffer,
		`audio.${operation}.mp3`,
		'audio/mp3',
	);

	return items.map(() => ({ json: responseData.headers, binary: { ['data']: binaryData } }));
}

async function preSendSpeechToText( this: IExecuteSingleFunctions, requestOptions: IHttpRequestOptions ): Promise<IHttpRequestOptions> {
	const binaryInputField = this.getNodeParameter('file', 'data') as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', {}) as IDataObject;

	const fileBuffer = await this.helpers.getBinaryDataBuffer(binaryInputField);

	const model_id = additionalOptions.model as string || 'scribe_v1';
	const language_code = additionalOptions.languageCode as string;
	const num_speakers = additionalOptions.numberOfSpeakers as number;
	const diarize = additionalOptions.diarize as boolean;

	const formData = new FormData();
	formData.append('file', new Blob([fileBuffer]));
	formData.append('model_id', model_id);

	if (language_code) {
		formData.append('language_code', language_code);
	}

	if (num_speakers) {
		formData.append('num_speakers', String(num_speakers));
	}

	if (diarize !== undefined) {
		formData.append('diarize', String(diarize));
	}

	requestOptions.body = formData;
	return requestOptions;
}

async function preSendSpeechToSpeech( this: IExecuteSingleFunctions, requestOptions: IHttpRequestOptions ): Promise<IHttpRequestOptions> {
	const binaryInputField = this.getNodeParameter('file', 'data') as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', {}) as IDataObject;

	const fileBuffer = await this.helpers.getBinaryDataBuffer(binaryInputField);

	const formData = new FormData();
	formData.append('audio', new Blob([fileBuffer]));
	formData.append('model_id', (additionalOptions.model as string) || 'eleven_english_sts_v2');

	const voiceSettings = additionalOptions.voiceSettings as IDataObject || '{}';

	formData.append('voice_settings', voiceSettings);

	requestOptions.body = formData;
	return requestOptions;
}
