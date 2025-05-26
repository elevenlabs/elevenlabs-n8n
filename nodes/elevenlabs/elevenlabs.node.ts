import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';
import { VoiceOperations, VoiceFields } from './Descriptions/voice';
import { listSearch } from './Descriptions/utils';
import { SpeechFields, SpeechOperations } from './Descriptions/speech';

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
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'elevenLabsApi',
				required: true,
			},
		],
		requestDefaults: {
			method: 'POST',
			baseURL: 'https://api.elevenlabs.io/v1',
			headers: {
				'Content-Type': 'application/json',
			},
		},
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
		]
	};

	methods = {
		listSearch,
	};
}
