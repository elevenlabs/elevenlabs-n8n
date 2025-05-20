# ElevenLabs n8n Node

This repo is the ElevenLabs n8n official node.
It is generated from our latest openapi spec weekly, via this [project](https://github.com/devlikeapro/n8n-openapi-node).

To update the node, update the openapi spec in `nodes/elevenlabs/openapi.json`/

1. Run `npm i` to install dependencies.
2. Run `npm lint` to check for errors or `npm lintfix` to automatically fix errors when possible.
3. Refer to [Run your node locally](https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/) for guidance.