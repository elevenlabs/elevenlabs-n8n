# @elevenlabs/n8n-nodes-elevenlabs

This is the official ElevenLabs n8n community node.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)
[Compatibility](#compatibility)  
[Usage](#usage)  <!-- delete if not using this section -->  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Speech
- Text to Speech (provider: **ElevenLabs** or **60db**)
- Speech to Text
- Speech to Speech

### Voice
- Get
- Get Many
- Create Clone
- Delete

## Text to Speech providers

Text to Speech can run against two interchangeable providers, selected with the **Provider** dropdown. The rest of the workflow is unchanged — both return a single audio binary on the `data` property.

- **ElevenLabs** — uses the ElevenLabs `text-to-speech` endpoint (voice list, models, output formats, voice settings).
- **60db** — uses the [60db](https://docs.60db.ai) API with a selectable **Transport**:
  - **HTTP** — `POST /tts-synthesize` (base64 JSON, decoded to binary)
  - **Streaming** — `POST /tts-stream` (NDJSON chunks, concatenated)
  - **WebSocket** — `wss://api.60db.ai/ws/tts` (LINEAR16/MULAW frames are wrapped in a WAV container)

## Credentials

- **ElevenLabs API** — required for Voice operations, Speech to Text, Speech to Speech, and ElevenLabs Text to Speech. Generate a key from your [ElevenLabs Dashboard](https://elevenlabs.io/app/settings/api-keys).
- **60db API** — required only when Text to Speech uses the 60db provider. The key is sent as a Bearer token (HTTP/streaming) and as the `apiKey` query parameter (WebSocket).

## Compatibility

This node has been tested with n8n 1.94.0

## Usage

[To be completed]

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [ElevenLabs Documentation](https://elevenlabs.io/docs)
