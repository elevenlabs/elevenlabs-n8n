import {INodeType, INodeTypeDescription, NodeConnectionType} from 'n8n-workflow';
import {N8NPropertiesBuilder, N8NPropertiesBuilderConfig} from '@devlikeapro/n8n-openapi-node';
import * as doc from './openapi.json';

const config: N8NPropertiesBuilderConfig = {}
const parser = new N8NPropertiesBuilder(doc, config);
const properties = parser.build()

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
                name: 'ElevenLabsApi',
                required: true,
            },
        ],
        requestDefaults: {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            baseURL: '={{$credentials.url}}',
        },
        properties: properties,
    };
}