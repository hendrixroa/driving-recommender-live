import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { agentFunction } from './functions/agent-function/resource';
import { VoiceRoutePlannerStack } from './stacks/voiceRoutePlannerStack';
import { geoStack } from './stacks/geoStack/geoStack';
import { agentStack } from './stacks/agentStack/agentStack';
import { voiceSynthesisStack } from './stacks/voiceSynthesisStack/voiceSynthesisStack';

const backend = defineBackend({
  auth,
  data,
  agentFunction
});

const voiceRoutePlannerStack = new VoiceRoutePlannerStack(
  backend.stack,
  'VoiceRoutePlannerStack'
);

const geoResources = geoStack(backend);
agentStack(backend, geoResources);
voiceSynthesisStack(backend);