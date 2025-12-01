import { defineFunction, secret } from '@aws-amplify/backend';

export const agentFunction = defineFunction({
  name: 'agent-function',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024,
  environment: {
    NODE_ENV: 'production',
    LLM_PROVIDER: 'gemini',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
    GEMINI_MODEL: 'gemini-2.5-flash',
    PLACE_INDEX_NAME: 'voiceRoutePlannerSearchIndex',
    GEMINI_API_KEY: secret('GEMINI_API_KEY')
  }
});
