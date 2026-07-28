import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
} from 'n8n-workflow';
import WebSocket from 'ws';

/**
 * Provider-agnostic Text-to-Speech abstraction.
 *
 * Both ElevenLabs and 60db are exposed through the same {@link TtsProvider}
 * interface so the node's `execute()` does not care which one is selected — it
 * builds a normalized {@link TtsRequest} and gets back a normalized
 * {@link TtsResult} (an audio buffer + how to attach it as binary data).
 */

export type TtsProviderId = 'elevenLabs' | '60db';
export type SixtyDbTransport = 'http' | 'stream' | 'websocket';

export interface TtsRequest {
	text: string;
	voiceId?: string;

	// ElevenLabs-specific
	modelId?: string;
	languageCode?: string;
	voiceSettings?: IDataObject;

	// Shared / 60db-specific
	outputFormat?: string;
	transport?: SixtyDbTransport;
	speed?: number;
	stability?: number;
	similarity?: number;
	enhance?: boolean;

	// 60db WebSocket-specific
	audioEncoding?: string;
	sampleRate?: number;
}

export interface TtsResult {
	buffer: Buffer;
	mimeType: string;
	fileExtension: string;
	metadata: IDataObject;
}

export interface TtsProvider {
	textToSpeech(ctx: IExecuteFunctions, itemIndex: number, req: TtsRequest): Promise<TtsResult>;
}

/** Maps an ElevenLabs `output_format` value to a MIME type + file extension. */
function mapElevenLabsFormat(fmt?: string): { mimeType: string; fileExtension: string } {
	const f = fmt ?? 'mp3_44100_128';
	if (f.startsWith('opus')) return { mimeType: 'audio/ogg', fileExtension: 'opus' };
	if (f.startsWith('pcm')) return { mimeType: 'audio/basic', fileExtension: 'pcm' };
	if (f.startsWith('ulaw')) return { mimeType: 'audio/basic', fileExtension: 'ulaw' };
	if (f.startsWith('alaw')) return { mimeType: 'audio/basic', fileExtension: 'alaw' };
	return { mimeType: 'audio/mpeg', fileExtension: 'mp3' };
}

/** Maps a 60db HTTP/stream `output_format` value to a MIME type + file extension. */
function mapSixtyDbFormat(fmt?: string): { mimeType: string; fileExtension: string } {
	switch ((fmt ?? 'mp3').toLowerCase()) {
		case 'wav':
			return { mimeType: 'audio/wav', fileExtension: 'wav' };
		case 'ogg':
			return { mimeType: 'audio/ogg', fileExtension: 'ogg' };
		case 'flac':
			return { mimeType: 'audio/flac', fileExtension: 'flac' };
		default:
			return { mimeType: 'audio/mpeg', fileExtension: 'mp3' };
	}
}

/** Wraps raw PCM / G.711 samples in a minimal WAV container so the audio is playable. */
function wrapInWav(
	data: Buffer,
	sampleRate: number,
	opts: { audioFormat: number; bitsPerSample: number },
): Buffer {
	const channels = 1;
	const { audioFormat, bitsPerSample } = opts;
	const blockAlign = (channels * bitsPerSample) / 8;
	const byteRate = sampleRate * blockAlign;

	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write('WAVE', 8);
	header.write('fmt ', 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(audioFormat, 20);
	header.writeUInt16LE(channels, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(byteRate, 28);
	header.writeUInt16LE(blockAlign, 32);
	header.writeUInt16LE(bitsPerSample, 34);
	header.write('data', 36);
	header.writeUInt32LE(data.length, 40);

	return Buffer.concat([header, data]);
}

export class ElevenLabsTtsProvider implements TtsProvider {
	async textToSpeech(
		ctx: IExecuteFunctions,
		_itemIndex: number,
		req: TtsRequest,
	): Promise<TtsResult> {
		const body: IDataObject = { text: req.text };
		if (req.modelId) body.model_id = req.modelId;
		// language_code is only honoured by the turbo_v2 / flash_v2 model families.
		if (
			req.languageCode &&
			req.modelId &&
			(req.modelId.includes('turbo_v2') || req.modelId.includes('flash_v2'))
		) {
			body.language_code = req.languageCode;
		}
		if (req.voiceSettings) body.voice_settings = req.voiceSettings;

		const qs: IDataObject = {};
		if (req.outputFormat) qs.output_format = req.outputFormat;

		const options: IHttpRequestOptions = {
			method: 'POST',
			url: `https://api.elevenlabs.io/v1/text-to-speech/${req.voiceId}`,
			body,
			qs,
			json: true,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		};

		const response = (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			'elevenLabsApi',
			options,
		)) as IN8nHttpFullResponse;

		const buffer = Buffer.from(response.body as ArrayBuffer);
		const { mimeType, fileExtension } = mapElevenLabsFormat(req.outputFormat);

		return {
			buffer,
			mimeType,
			fileExtension,
			metadata: {
				provider: 'elevenLabs',
				voice_id: req.voiceId,
				model_id: req.modelId,
				output_format: req.outputFormat,
			},
		};
	}
}

export class SixtyDbTtsProvider implements TtsProvider {
	async textToSpeech(
		ctx: IExecuteFunctions,
		itemIndex: number,
		req: TtsRequest,
	): Promise<TtsResult> {
		switch (req.transport ?? 'http') {
			case 'stream':
				return this.synthesizeStream(ctx, req);
			case 'websocket':
				return this.synthesizeWebSocket(ctx, itemIndex, req);
			case 'http':
			default:
				return this.synthesizeHttp(ctx, req);
		}
	}

	/** Builds the JSON body shared by the HTTP and streaming endpoints. */
	private buildBody(req: TtsRequest): IDataObject {
		const body: IDataObject = { text: req.text };
		if (req.voiceId) body.voice_id = req.voiceId;
		if (req.enhance !== undefined) body.enhance = req.enhance;
		if (req.speed !== undefined) body.speed = req.speed;
		if (req.stability !== undefined) body.stability = req.stability;
		if (req.similarity !== undefined) body.similarity = req.similarity;
		if (req.outputFormat) body.output_format = req.outputFormat;
		return body;
	}

	/** POST /tts-synthesize — returns a JSON envelope with base64 audio. */
	private async synthesizeHttp(ctx: IExecuteFunctions, req: TtsRequest): Promise<TtsResult> {
		const options: IHttpRequestOptions = {
			method: 'POST',
			url: 'https://api.60db.ai/tts-synthesize',
			body: this.buildBody(req),
			json: true,
		};

		const response = (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			'sixtyDbApi',
			options,
		)) as IDataObject;

		if (response.success === false) {
			throw new Error(`60db TTS failed: ${response.message ?? 'unknown error'}`);
		}

		const audioBase64 = response.audio_base64 as string;
		if (!audioBase64) {
			throw new Error('60db TTS response did not contain audio_base64');
		}

		const buffer = Buffer.from(audioBase64, 'base64');
		const { mimeType, fileExtension } = mapSixtyDbFormat(
			(response.output_format as string) ?? req.outputFormat,
		);

		return {
			buffer,
			mimeType,
			fileExtension,
			metadata: {
				provider: '60db',
				transport: 'http',
				voice_id: req.voiceId,
				sample_rate: response.sample_rate,
				duration_seconds: response.duration_seconds,
				encoding: response.encoding,
				output_format: response.output_format ?? req.outputFormat,
			},
		};
	}

	/** POST /tts-stream — NDJSON chunks; concatenated into a single buffer. */
	private async synthesizeStream(ctx: IExecuteFunctions, req: TtsRequest): Promise<TtsResult> {
		const options: IHttpRequestOptions = {
			method: 'POST',
			url: 'https://api.60db.ai/tts-stream',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(this.buildBody(req)),
			json: false,
			returnFullResponse: true,
		};

		const response = (await ctx.helpers.httpRequestWithAuthentication.call(
			ctx,
			'sixtyDbApi',
			options,
		)) as IN8nHttpFullResponse;

		const raw =
			typeof response.body === 'string'
				? response.body
				: Buffer.from(response.body as ArrayBuffer).toString('utf8');

		const chunks: Buffer[] = [];
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			let message: IDataObject;
			try {
				message = JSON.parse(trimmed) as IDataObject;
			} catch {
				continue;
			}
			if (message.type === 'error') {
				throw new Error(`60db streaming error: ${message.message ?? 'unknown error'}`);
			}
			if (message.type === 'chunk') {
				const result = message.result as IDataObject | undefined;
				const audioContent = result?.audioContent as string | undefined;
				if (audioContent) chunks.push(Buffer.from(audioContent, 'base64'));
			}
		}

		const { mimeType, fileExtension } = mapSixtyDbFormat(req.outputFormat);

		return {
			buffer: Buffer.concat(chunks),
			mimeType,
			fileExtension,
			metadata: {
				provider: '60db',
				transport: 'stream',
				voice_id: req.voiceId,
				output_format: req.outputFormat,
				chunks: chunks.length,
			},
		};
	}

	/**
	 * WebSocket synthesis (wss://api.60db.ai/ws/tts).
	 *
	 * Protocol: create_context -> send_text -> flush_context, collect audio_chunk
	 * frames until flush_completed, then close_context and wait for context_closed.
	 * Audio frames are raw samples (PCM / G.711), so LINEAR16 and MULAW are wrapped
	 * in a WAV container to make the result directly playable.
	 */
	private async synthesizeWebSocket(
		ctx: IExecuteFunctions,
		itemIndex: number,
		req: TtsRequest,
	): Promise<TtsResult> {
		const credentials = await ctx.getCredentials('sixtyDbApi');
		const apiKey = credentials.apiKey as string;

		const encoding = (req.audioEncoding ?? 'LINEAR16').toUpperCase();
		const sampleRate = req.sampleRate ?? (encoding === 'MULAW' ? 8000 : 16000);
		const contextId = `n8n-${itemIndex}-${Date.now()}`;
		const url = `wss://api.60db.ai/ws/tts?apiKey=${encodeURIComponent(apiKey)}`;

		const chunks: Buffer[] = [];

		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(url);
			let flushed = false;
			const timeout = setTimeout(() => {
				ws.terminate();
				reject(new Error('60db WebSocket synthesis timed out after 60s'));
			}, 60_000);

			const finish = (err?: Error) => {
				clearTimeout(timeout);
				try {
					ws.close();
				} catch {
					// ignore
				}
				if (err) reject(err);
				else resolve();
			};

			ws.on('open', () => {
				ws.send(
					JSON.stringify({
						create_context: {
							context_id: contextId,
							voice_id: req.voiceId,
							audio_config: {
								audio_encoding: encoding,
								sample_rate_hertz: sampleRate,
							},
							speed: req.speed ?? 1,
							stability: req.stability ?? 50,
							similarity: req.similarity ?? 75,
						},
					}),
				);
				ws.send(JSON.stringify({ send_text: { context_id: contextId, text: req.text } }));
				ws.send(JSON.stringify({ flush_context: { context_id: contextId } }));
			});

			ws.on('message', (data: WebSocket.RawData) => {
				let message: IDataObject;
				try {
					message = JSON.parse(data.toString()) as IDataObject;
				} catch {
					return;
				}

				const audioChunk = message.audio_chunk as IDataObject | undefined;
				if (audioChunk?.audioContent) {
					chunks.push(Buffer.from(audioChunk.audioContent as string, 'base64'));
					return;
				}
				if (message.flush_completed && !flushed) {
					flushed = true;
					ws.send(JSON.stringify({ close_context: { context_id: contextId } }));
					return;
				}
				if (message.context_closed) {
					finish();
					return;
				}
				if (message.error || message.type === 'error') {
					const detail =
						(typeof message.error === 'string' ? message.error : undefined) ??
						(message.message as string) ??
						'unknown error';
					finish(new Error(`60db WebSocket error: ${detail}`));
				}
			});

			ws.on('error', (err: Error) => finish(err));
		});

		const raw = Buffer.concat(chunks);

		if (encoding === 'LINEAR16') {
			return {
				buffer: wrapInWav(raw, sampleRate, { audioFormat: 1, bitsPerSample: 16 }),
				mimeType: 'audio/wav',
				fileExtension: 'wav',
				metadata: { provider: '60db', transport: 'websocket', encoding, sampleRate },
			};
		}
		if (encoding === 'MULAW') {
			return {
				buffer: wrapInWav(raw, sampleRate, { audioFormat: 7, bitsPerSample: 8 }),
				mimeType: 'audio/wav',
				fileExtension: 'wav',
				metadata: { provider: '60db', transport: 'websocket', encoding, sampleRate },
			};
		}
		// OGG_OPUS frames are self-contained; passed through unwrapped.
		return {
			buffer: raw,
			mimeType: 'audio/ogg',
			fileExtension: 'ogg',
			metadata: { provider: '60db', transport: 'websocket', encoding, sampleRate },
		};
	}
}

/** Returns the TTS provider implementation for the given provider id. */
export function getTtsProvider(providerId: TtsProviderId): TtsProvider {
	return providerId === '60db' ? new SixtyDbTtsProvider() : new ElevenLabsTtsProvider();
}
