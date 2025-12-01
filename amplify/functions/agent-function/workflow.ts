import { createWorkflow, workflowEvent } from '@llamaindex/workflow-core';
import { LLMProvider } from './llm-provider';
import { Intent, AgentResponse, ConversationContext, LocationResult, RouteAlternative } from './types';
import { createLocationServiceTools } from './tools';

const StartEvent = workflowEvent<{ text: string; context: ConversationContext }>();
const IntentParsedEvent = workflowEvent<{ intent: Intent; context: ConversationContext }>();
const LocationFoundEvent = workflowEvent<{ location: LocationResult; intent: Intent; context: ConversationContext }>();
const RoutesCalculatedEvent = workflowEvent<{ alternatives: RouteAlternative[]; destination: string }>();
const StopEvent = workflowEvent<AgentResponse>();

export function createVoiceRoutePlanningWorkflow(llm: LLMProvider) {
  const tools = createLocationServiceTools();
  const workflow = createWorkflow();

  workflow.handle([StartEvent], async (context, ev) => {
    if (!StartEvent.include(ev)) return;
    
    const { text, context: conversationContext } = ev.data;
    
    console.log('Step 1: Parsing intent for:', text);

    const prompt = `Eres un asistente de navegación en español. Analiza la siguiente solicitud del usuario y extrae:
1. El tipo de intención:
   - "find_location": El usuario quiere encontrar un lugar específico
   - "get_directions": El usuario quiere direcciones/ruta de un lugar a otro
   - "clarify": El usuario está respondiendo a una pregunta de aclaración
   - "unknown": No está claro qué quiere el usuario

2. Entidades mencionadas:
   - destination: El lugar de destino (obligatorio para find_location y get_directions)
   - origin: El lugar de origen (opcional, solo para get_directions)
   - preferences: Preferencias de ruta como evitar peajes, autopistas, modo de transporte

3. Nivel de confianza (0.0-1.0):
   - 0.9-1.0: Muy claro, sin ambigüedad
   - 0.7-0.89: Claro, pero podría tener pequeñas ambigüedades
   - 0.5-0.69: Algo ambiguo, puede necesitar aclaración
   - 0.0-0.49: Muy ambiguo o no claro

Solicitud del usuario: "${text}"

Contexto: ${conversationContext.previousQueries.length > 0 ? 'Consultas previas: ' + conversationContext.previousQueries.join(', ') : 'Primera consulta'}
${conversationContext.currentLocation ? `Ubicación actual: lat ${conversationContext.currentLocation.lat}, lng ${conversationContext.currentLocation.lng}` : 'Ubicación actual desconocida'}

Responde SOLO con un JSON válido en este formato:
{
  "type": "find_location" | "get_directions" | "clarify" | "unknown",
  "entities": {
    "destination": "nombre del lugar destino" | null,
    "origin": "nombre del lugar origen" | null,
    "preferences": {
      "avoidTolls": true | false | null,
      "avoidHighways": true | false | null,
      "mode": "driving" | "walking" | "cycling" | null
    }
  },
  "confidence": 0.0-1.0
}`;

    const response = await llm.generateResponse(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const intent: Intent = {
        type: parsed.type || 'unknown',
        entities: {
          destination: parsed.entities?.destination || undefined,
          origin: parsed.entities?.origin || undefined,
          preferences: parsed.entities?.preferences
        },
        confidence: parsed.confidence || 0.5
      };

      console.log('Intent parsed:', intent);

      if (intent.confidence < 0.7) {
        return StopEvent.with({
          type: 'clarification',
          data: { intent },
          naturalLanguageResponse: '¿Puedes ser más específico sobre tu destino?',
          confidence: intent.confidence,
          requiresClarification: true,
          clarificationOptions: ['Reformular la solicitud', 'Proporcionar más detalles']
        } as AgentResponse);
      }

      return IntentParsedEvent.with({ intent, context: conversationContext });
    } catch (error) {
      console.error('Error parsing intent:', error);
      return StopEvent.with({
        type: 'error',
        data: {},
        naturalLanguageResponse: 'No pude entender tu solicitud. ¿Puedes reformularla?',
        confidence: 0,
        requiresClarification: false
      } as AgentResponse);
    }
  });

  workflow.handle([IntentParsedEvent], async (context, ev) => {
    if (!IntentParsedEvent.include(ev)) return;
    
    const { intent, context: conversationContext } = ev.data;
    
    console.log('Step 2: Searching location using searchLocation tool');

    const destination = intent.entities.destination;
    
    if (!destination) {
      return StopEvent.with({
        type: 'error',
        data: {},
        naturalLanguageResponse: 'No pude identificar el destino. ¿Puedes especificarlo?',
        confidence: 0,
        requiresClarification: false
      } as AgentResponse);
    }

    try {
      const locations = await tools.searchLocation(destination, 5);

      if (locations.length === 0) {
        return StopEvent.with({
          type: 'error',
          data: {},
          naturalLanguageResponse: `No encontré resultados para "${destination}". ¿Puedes ser más específico?`,
          confidence: 0,
          requiresClarification: false
        } as AgentResponse);
      }

      const disambiguation = tools.disambiguateLocation(locations);

      if (disambiguation.needsDisambiguation) {
        return StopEvent.with({
          type: 'clarification',
          data: { locations },
          naturalLanguageResponse: `Encontré varios lugares llamados "${destination}". ¿Cuál de estos te refieres?`,
          confidence: intent.confidence,
          requiresClarification: true,
          clarificationOptions: disambiguation.options
        } as AgentResponse);
      }

      return LocationFoundEvent.with({ 
        location: disambiguation.primary!, 
        intent, 
        context: conversationContext 
      });
    } catch (error) {
      console.error('Error searching location:', error);
      return StopEvent.with({
        type: 'error',
        data: {},
        naturalLanguageResponse: 'Error al buscar la ubicación. Intenta de nuevo.',
        confidence: 0,
        requiresClarification: false
      } as AgentResponse);
    }
  });

  workflow.handle([LocationFoundEvent], async (context, ev) => {
    if (!LocationFoundEvent.include(ev)) return;
    
    const { location, intent, context: conversationContext } = ev.data;
    
    console.log('Step 3: Calculating route alternatives using calculateRouteAlternatives tool');

    if (!conversationContext.currentLocation) {
      return StopEvent.with({
        type: 'error',
        data: {},
        naturalLanguageResponse: 'No pude obtener tu ubicación actual.',
        confidence: 0,
        requiresClarification: false
      } as AgentResponse);
    }

    try {
      const alternatives = await tools.calculateRouteAlternatives(
        conversationContext.currentLocation,
        location.location,
        intent.entities.preferences
      );

      if (alternatives.length === 0) {
        return StopEvent.with({
          type: 'error',
          data: {},
          naturalLanguageResponse: 'No se encontraron rutas disponibles.',
          confidence: 0,
          requiresClarification: false
        } as AgentResponse);
      }

      console.log(`Calculated ${alternatives.length} route alternatives`);
      return RoutesCalculatedEvent.with({ alternatives, destination: location.formattedAddress });
    } catch (error) {
      console.error('Error calculating routes:', error);
      return StopEvent.with({
        type: 'error',
        data: {},
        naturalLanguageResponse: 'Error al calcular las rutas. Intenta de nuevo.',
        confidence: 0,
        requiresClarification: false
      } as AgentResponse);
    }
  });

  workflow.handle([RoutesCalculatedEvent], async (context, ev) => {
    if (!RoutesCalculatedEvent.include(ev)) return;
    
    const { alternatives, destination } = ev.data;
    
    console.log('Step 4: Generating natural language response');

    const top3 = alternatives.slice(0, 3);
    
    const descriptions = top3.map((alt, index) => {
      const distanceKm = (alt.distance / 1000).toFixed(1);
      const durationMin = Math.round(alt.duration / 60);
      const issues = alt.potentialIssues.length > 0 ? `. ${alt.potentialIssues.join(', ')}` : '';
      return `Opción ${index + 1}: ${alt.label}. ${distanceKm} kilómetros, aproximadamente ${durationMin} minutos${issues}`;
    }).join('. ');

    const prompt = `Genera una respuesta natural en español para anunciar estas rutas:

${descriptions}

La respuesta debe:
- Ser breve y clara
- Mencionar las 3 opciones
- Terminar diciendo "Por favor, elige una opción cuando estés listo"
- Ser adecuada para voz

Responde SOLO con el texto, sin comillas.`;

    const naturalResponse = await llm.generateResponse(prompt);

    return StopEvent.with({
      type: 'route',
      data: { 
        destination,
        alternatives: top3,
        requiresUserSelection: true
      },
      naturalLanguageResponse: naturalResponse,
      confidence: 1.0,
      requiresClarification: false
    } as AgentResponse);
  });

  return workflow;
}

export async function runVoiceRoutePlanningWorkflow(
  llm: LLMProvider,
  text: string,
  conversationContext: ConversationContext
): Promise<AgentResponse> {
  const workflow = createVoiceRoutePlanningWorkflow(llm);
  const { stream, sendEvent } = workflow.createContext();
  
  sendEvent(StartEvent.with({ text, context: conversationContext }));
  
  const events = await stream.until(StopEvent).toArray();
  const stopEventData = events.find(ev => StopEvent.include(ev));
  
  if (stopEventData && StopEvent.include(stopEventData)) {
    return stopEventData.data;
  }
  
  throw new Error('Workflow did not produce a stop event');
}
