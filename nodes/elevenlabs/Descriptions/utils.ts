import { ILoadOptionsFunctions, INodeListSearchItems, INodeListSearchResult } from "n8n-workflow";

interface IElevenLabsVoiceResponse {
  voices: {
    name: string;
    voice_id: string;
  }[];
}

interface IElevenLabsModel {
  name: string;
  model_id: string;
}

export const listSearch = {
	async listVoices(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
		const voicesResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'elevenLabsApi', {
			method: 'GET',
			url: 'https://api.elevenlabs.io/v2/voices',
		}) as IElevenLabsVoiceResponse;

		const returnData: INodeListSearchItems[] = voicesResponse.voices.map(
			(voice) => ({
				name: voice.name,
				value: voice.voice_id,
			})
		);

		return {
			results: returnData,
		};
	},

	async listModels(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
		const modelsResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'elevenLabsApi', {
			method: 'GET',
			url: 'https://api.elevenlabs.io/v1/models',
		}) as IElevenLabsModel[];

		const returnData: INodeListSearchItems[] = modelsResponse.map((model) => ({
			name: model.name,
			value: model.model_id,
		}));

		return {
			results: returnData,
		}
	},
};
