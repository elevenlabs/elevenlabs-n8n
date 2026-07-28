import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { VoiceOperations, VoiceFields } from './Descriptions/voice';
import { listSearch } from './Descriptions/utils';
import { SpeechFields, SpeechOperations } from './Descriptions/speech';
import {
	getTtsProvider,
	SixtyDbTransport,
	TtsProviderId,
	TtsRequest,
} from './providers/tts';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * This node is executed programmatically (see `execute()` below) rather than via
 * n8n's declarative `routing`. The move to `execute()` is what lets Text to Speech
 * pick between ElevenLabs and 60db — and 60db's HTTP, streaming and WebSocket
 * transports — behind a single {@link TtsProvider} abstraction. The `routing`
 * metadata still present in the Descriptions files documents the underlying API
 * calls but is not used at runtime.
 */
export class ElevenLabs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ElevenLabs',
		name: 'elevenLabs',
		icon: 'file:elevenlabs.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with ElevenLabs API',
		defaults: {
			name: 'ElevenLabs',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'elevenLabsApi',
				required: true,
				// Required for everything except 60db Text to Speech.
				displayOptions: {
					hide: {
						provider: ['60db'],
					},
				},
			},
			{
				name: 'sixtyDbApi',
				required: true,
				// Only required when Text to Speech uses the 60db provider.
				displayOptions: {
					show: {
						provider: ['60db'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Voice',
						value: 'voice',
					},
					{
						name: 'Speech',
						value: 'speech',
					},
				],
				default: 'voice',
			},
			...VoiceOperations,
			...VoiceFields,
			...SpeechOperations,
			...SpeechFields,
		],
	};

	methods = {
		listSearch,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				let itemResults: INodeExecutionData[];
				if (resource === 'voice') {
					itemResults = await handleVoice(this, operation, i);
				} else if (resource === 'speech') {
					itemResults = await handleSpeech(this, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex: i,
					});
				}
				returnData.push(...itemResults);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// --- Voice resource ----------------------------------------------------------

const VOICE_SIMPLE_FIELDS = [
	'voice_id',
	'name',
	'category',
	'labels',
	'description',
	'preview_url',
] as const;

function simplifyVoice(voice: IDataObject): IDataObject {
	const simplified: IDataObject = {};
	for (const field of VOICE_SIMPLE_FIELDS) {
		simplified[field] = voice[field];
	}
	return simplified;
}

async function handleVoice(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'get': {
			const voiceId = ctx.getNodeParameter('voice', i, '', { extractValue: true }) as string;
			const simplify = ctx.getNodeParameter('simplify', i, false) as boolean;
			const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'elevenLabsApi', {
				method: 'GET',
				url: `${ELEVENLABS_BASE_URL}/voices/${voiceId}`,
				json: true,
			})) as IDataObject;
			return [{ json: simplify ? simplifyVoice(response) : response, pairedItem: { item: i } }];
		}

		case 'getAll': {
			const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
			const simplify = ctx.getNodeParameter('simplify', i, false) as boolean;
			const qs: IDataObject = {};
			if (!returnAll) {
				qs.page_size = ctx.getNodeParameter('limit', i, 50) as number;
			}
			const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'elevenLabsApi', {
				method: 'GET',
				url: `${ELEVENLABS_BASE_URL}/voices`,
				qs,
				json: true,
			})) as IDataObject;
			const voices = (response.voices as IDataObject[]) ?? [];
			return voices.map((voice) => ({
				json: simplify ? simplifyVoice(voice) : voice,
				pairedItem: { item: i },
			}));
		}

		case 'createClone': {
			const name = ctx.getNodeParameter('name', i) as string;
			const binaryProperty = ctx.getNodeParameter('audioFiles', i, '') as string;
			const description = ctx.getNodeParameter('additionalFields.description', i, '') as string;
			const labels = ctx.getNodeParameter('additionalFields.labels', i, '{}') as string;
			const fileBuffer = await ctx.helpers.getBinaryDataBuffer(i, binaryProperty);

			const formData = new FormData();
			formData.append('name', name);
			formData.append('description', description);
			formData.append('labels', labels);
			formData.append('files', new Blob([fileBuffer]));

			const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'elevenLabsApi', {
				method: 'POST',
				url: `${ELEVENLABS_BASE_URL}/voices/add`,
				body: formData,
			})) as IDataObject;
			return [{ json: response, pairedItem: { item: i } }];
		}

		case 'delete': {
			const voiceId = ctx.getNodeParameter('voice', i, '', { extractValue: true }) as string;
			const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'elevenLabsApi', {
				method: 'DELETE',
				url: `${ELEVENLABS_BASE_URL}/voices/${voiceId}`,
				json: true,
			})) as IDataObject;
			return [{ json: response, pairedItem: { item: i } }];
		}

		default:
			throw new NodeOperationError(ctx.getNode(), `Unsupported voice operation: ${operation}`, {
				itemIndex: i,
			});
	}
}

// --- Speech resource ---------------------------------------------------------

async function handleSpeech(
	ctx: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'textToSpeech':
			return handleTextToSpeech(ctx, i);
		case 'speechToText':
			return handleSpeechToText(ctx, i);
		case 'speechToSpeech':
			return handleSpeechToSpeech(ctx, i);
		default:
			throw new NodeOperationError(ctx.getNode(), `Unsupported speech operation: ${operation}`, {
				itemIndex: i,
			});
	}
}

async function handleTextToSpeech(
	ctx: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const provider = ctx.getNodeParameter('provider', i, 'elevenLabs') as TtsProviderId;
	const text = ctx.getNodeParameter('text', i) as string;

	let request: TtsRequest;

	if (provider === '60db') {
		const transport = ctx.getNodeParameter('transport', i, 'http') as SixtyDbTransport;
		const voiceId = ctx.getNodeParameter('sixtyDbVoiceId', i, '') as string;
		const options = ctx.getNodeParameter('sixtyDbOptions', i, {}) as IDataObject;
		request = {
			text,
			voiceId: voiceId || undefined,
			transport,
			enhance: options.enhance as boolean | undefined,
			speed: options.speed as number | undefined,
			stability: options.stability as number | undefined,
			similarity: options.similarity as number | undefined,
			outputFormat: options.outputFormat as string | undefined,
			audioEncoding: options.audioEncoding as string | undefined,
			sampleRate: options.sampleRate as number | undefined,
		};
	} else {
		const voiceId = ctx.getNodeParameter('voice', i, '', { extractValue: true }) as string;
		const modelId = ctx.getNodeParameter('additionalOptions.model', i, 'eleven_multilingual_v2', {
			extractValue: true,
		}) as string;
		const options = ctx.getNodeParameter('additionalOptions', i, {}) as IDataObject;

		let voiceSettings: IDataObject | undefined;
		const rawVoiceSettings = options.voiceSettings as string | IDataObject | undefined;
		if (rawVoiceSettings) {
			voiceSettings =
				typeof rawVoiceSettings === 'string'
					? (JSON.parse(rawVoiceSettings) as IDataObject)
					: rawVoiceSettings;
		}

		request = {
			text,
			voiceId,
			modelId,
			languageCode: options.languageCode as string | undefined,
			outputFormat: options.outputFormat as string | undefined,
			voiceSettings,
		};
	}

	const result = await getTtsProvider(provider).textToSpeech(ctx, i, request);
	const binaryData = await ctx.helpers.prepareBinaryData(
		result.buffer,
		`audio.textToSpeech.${result.fileExtension}`,
		result.mimeType,
	);

	return [
		{
			json: result.metadata,
			binary: { data: binaryData },
			pairedItem: { item: i },
		},
	];
}

async function handleSpeechToText(
	ctx: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const binaryProperty = ctx.getNodeParameter('file', i, 'data') as string;
	const fileBuffer = await ctx.helpers.getBinaryDataBuffer(i, binaryProperty);

	const modelId =
		(ctx.getNodeParameter('additionalOptions.model', i, '', { extractValue: true }) as string) ||
		'scribe_v1';
	const languageCode = ctx.getNodeParameter('additionalOptions.languageCode', i, '') as string;
	const numberOfSpeakers = ctx.getNodeParameter('additionalOptions.numberOfSpeakers', i, 0) as number;
	const diarize = ctx.getNodeParameter('additionalOptions.diarize', i, undefined) as
		| boolean
		| undefined;

	const formData = new FormData();
	formData.append('file', new Blob([fileBuffer]));
	formData.append('model_id', modelId);
	if (languageCode) formData.append('language_code', languageCode);
	if (numberOfSpeakers) formData.append('num_speakers', String(numberOfSpeakers));
	if (diarize !== undefined) formData.append('diarize', String(diarize));

	const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'elevenLabsApi', {
		method: 'POST',
		url: `${ELEVENLABS_BASE_URL}/speech-to-text`,
		body: formData,
	})) as IDataObject;

	return [{ json: response, pairedItem: { item: i } }];
}

async function handleSpeechToSpeech(
	ctx: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const voiceId = ctx.getNodeParameter('voice', i, '', { extractValue: true }) as string;
	const binaryProperty = ctx.getNodeParameter('file', i, 'data') as string;
	const fileBuffer = await ctx.helpers.getBinaryDataBuffer(i, binaryProperty);

	const modelId =
		(ctx.getNodeParameter('additionalOptions.model', i, '', { extractValue: true }) as string) ||
		'eleven_english_sts_v2';
	const outputFormat = ctx.getNodeParameter('additionalOptions.outputFormat', i, '') as string;
	const rawVoiceSettings = ctx.getNodeParameter('additionalOptions.voiceSettings', i, '{}') as
		| string
		| IDataObject;
	const voiceSettings =
		typeof rawVoiceSettings === 'string' ? rawVoiceSettings : JSON.stringify(rawVoiceSettings);

	const formData = new FormData();
	formData.append('audio', new Blob([fileBuffer]));
	formData.append('model_id', modelId);
	formData.append('voice_settings', voiceSettings);

	const qs: IDataObject = {};
	if (outputFormat) qs.output_format = outputFormat;

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${ELEVENLABS_BASE_URL}/speech-to-speech/${voiceId}`,
		body: formData,
		qs,
		encoding: 'arraybuffer',
		returnFullResponse: true,
	};

	const response = (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'elevenLabsApi',
		options,
	)) as IN8nHttpFullResponse;

	const binaryData = await ctx.helpers.prepareBinaryData(
		Buffer.from(response.body as ArrayBuffer),
		'audio.speechToSpeech.mp3',
		'audio/mpeg',
	);

	return [
		{
			json: response.headers as IDataObject,
			binary: { data: binaryData },
			pairedItem: { item: i },
		},
	];
}
