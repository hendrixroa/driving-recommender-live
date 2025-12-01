import { LLMProvider } from './llm-provider.js';
import { Intent, AgentResponse, ConversationContext, LocationResult, RoutePreferences, RouteAlternative } from './types.js';
import { LocationClient, SearchPlaceIndexForTextCommand, CalculateRouteCommand } from '@aws-sdk/client-location';

export class AgentWorkflow {
  private llm: LLMProvider;
  private locationClient: LocationClient;
  private placeIndexName: string;
  private routeCalculatorName: string;

  constructor(llm: LLMProvider) {
    this.llm = llm;
    this.locationClient = new LocationClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.placeIndexName = process.env.PLACE_INDEX_NAME || 'voiceRoutePlannerSearchIndex';
    this.routeCalculatorName = process.env.ROUTE_CALCULATOR_NAME || 'voiceRoutePlannerRouteCalculator';
  }

  async processVoiceInput(
    text: string, 
    context: ConversationContext
  ): Promise<AgentResponse> {
    try {
      const intent = await this.parseIntent(text, context);

      if (intent.confidence < 0.7) {
        return this.generateClarificationResponse(text, intent);
      }

      switch (intent.type) {
        case 'find_location':
          return await this.handleLocationSearch(intent);
        case 'get_directions':
          return await this.handleDirectionsRequest(intent, context);
        default:
          return this.generateErrorResponse('No entiendo tu solicitud. ¿Puedes reformularla?');
      }
    } catch (error) {
      console.error('Error in agent workflow:', error);
      return this.generateErrorResponse('Ocurrió un error al procesar tu solicitud.');
    }
  }

  private async parseIntent(text: string, context: ConversationContext): Promise<Intent> {
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

Contexto: ${context.previousQueries.length > 0 ? 'Consultas previas: ' + context.previousQueries.join(', ') : 'Primera consulta'}
${context.currentLocation ? `Ubicación actual: lat ${context.currentLocation.lat}, lng ${context.currentLocation.lng}` : 'Ubicación actual desconocida'}

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
  "confidence": 0.0-1.0,
  "reasoning": "breve explicación de por qué elegiste este tipo y confianza"
}`;

    const response = await this.llm.generateResponse(prompt);
    
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the parsed intent
      const intent: Intent = {
        type: this.validateIntentType(parsed.type),
        entities: {
          destination: parsed.entities?.destination || undefined,
          origin: parsed.entities?.origin || undefined,
          preferences: this.normalizePreferences(parsed.entities?.preferences)
        },
        confidence: this.calculateConfidence(parsed, text)
      };

      // Log reasoning for debugging
      if (parsed.reasoning) {
        console.log(`Intent reasoning: ${parsed.reasoning}`);
      }

      return intent;
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      console.error('Raw LLM response:', response);
      
      // Fallback: Try to extract basic information using simple heuristics
      return this.fallbackIntentParsing(text, context);
    }
  }

  private validateIntentType(type: string): Intent['type'] {
    const validTypes: Intent['type'][] = ['find_location', 'get_directions', 'clarify', 'unknown'];
    return validTypes.includes(type as Intent['type']) ? type as Intent['type'] : 'unknown';
  }

  private normalizePreferences(prefs: any): RoutePreferences | undefined {
    if (!prefs || typeof prefs !== 'object') {
      return undefined;
    }

    const normalized: RoutePreferences = {};
    
    if (typeof prefs.avoidTolls === 'boolean') {
      normalized.avoidTolls = prefs.avoidTolls;
    }
    
    if (typeof prefs.avoidHighways === 'boolean') {
      normalized.avoidHighways = prefs.avoidHighways;
    }
    
    if (['driving', 'walking', 'cycling'].includes(prefs.mode)) {
      normalized.mode = prefs.mode;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private calculateConfidence(parsed: any, text: string): number {
    let confidence = parsed.confidence || 0.5;

    // Adjust confidence based on entity extraction
    if (parsed.type === 'find_location' || parsed.type === 'get_directions') {
      if (!parsed.entities?.destination) {
        // No destination found, reduce confidence
        confidence = Math.min(confidence, 0.4);
      }
    }

    // Adjust confidence based on text length and clarity
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 3) {
      // Very short input, likely ambiguous
      confidence = Math.min(confidence, 0.6);
    }

    // Ensure confidence is in valid range
    return Math.max(0, Math.min(1, confidence));
  }

  private fallbackIntentParsing(text: string, _context: ConversationContext): Intent {
    const lowerText = text.toLowerCase();
    
    // Check for direction keywords
    const directionKeywords = ['cómo llegar', 'cómo ir', 'ruta', 'direcciones', 'camino', 'ir a', 'llegar a'];
    const hasDirectionKeyword = directionKeywords.some(keyword => lowerText.includes(keyword));

    // Check for location keywords
    const locationKeywords = ['dónde está', 'dónde queda', 'ubicación', 'encontrar', 'buscar'];
    const hasLocationKeyword = locationKeywords.some(keyword => lowerText.includes(keyword));

    // Check for preference keywords
    const avoidTollsKeywords = ['sin peajes', 'evitar peajes', 'sin casetas'];
    const avoidHighwaysKeywords = ['sin autopistas', 'evitar autopistas', 'carreteras locales'];
    const walkingKeywords = ['caminando', 'a pie', 'caminar'];
    const cyclingKeywords = ['bicicleta', 'ciclismo', 'en bici'];

    const preferences: RoutePreferences = {};
    if (avoidTollsKeywords.some(k => lowerText.includes(k))) {
      preferences.avoidTolls = true;
    }
    if (avoidHighwaysKeywords.some(k => lowerText.includes(k))) {
      preferences.avoidHighways = true;
    }
    if (walkingKeywords.some(k => lowerText.includes(k))) {
      preferences.mode = 'walking';
    } else if (cyclingKeywords.some(k => lowerText.includes(k))) {
      preferences.mode = 'cycling';
    }

    // Determine intent type
    let type: Intent['type'] = 'unknown';
    let confidence = 0.3;

    if (hasDirectionKeyword) {
      type = 'get_directions';
      confidence = 0.6;
    } else if (hasLocationKeyword) {
      type = 'find_location';
      confidence = 0.6;
    } else if (text.trim().length > 0) {
      // Assume it's a location search if there's any text
      type = 'find_location';
      confidence = 0.5;
    }

    // Try to extract destination (simple approach: take the text after common prepositions)
    let destination: string | undefined;
    const prepositions = ['a ', 'al ', 'a la ', 'hacia ', 'para '];
    for (const prep of prepositions) {
      const index = lowerText.indexOf(prep);
      if (index !== -1) {
        destination = text.substring(index + prep.length).trim();
        break;
      }
    }
    
    // If no preposition found, use the whole text as destination
    if (!destination && type !== 'unknown') {
      destination = text.trim();
    }

    return {
      type,
      entities: {
        destination,
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined
      },
      confidence
    };
  }

  private async handleLocationSearch(intent: Intent): Promise<AgentResponse> {
    const destination = intent.entities.destination;
    
    if (!destination) {
      return this.generateErrorResponse('No pude identificar el destino. ¿Puedes especificarlo?');
    }

    try {
      const command = new SearchPlaceIndexForTextCommand({
        IndexName: this.placeIndexName,
        Text: destination,
        MaxResults: 5
      });

      const response = await this.locationClient.send(command);

      if (!response.Results || response.Results.length === 0) {
        return this.generateErrorResponse(`No encontré resultados para "${destination}". ¿Puedes ser más específico?`);
      }

      // If multiple results, ask for clarification
      if (response.Results.length > 1) {
        const options = response.Results.map(r => r.Place?.Label || 'Ubicación desconocida');
        return {
          type: 'clarification',
          data: { results: response.Results },
          naturalLanguageResponse: `Encontré varios lugares llamados "${destination}". ¿Cuál de estos te refieres?`,
          confidence: intent.confidence,
          requiresClarification: true,
          clarificationOptions: options
        };
      }

      // Single result found
      const result = response.Results[0];
      const location: LocationResult = {
        formattedAddress: result.Place?.Label || destination,
        location: {
          lat: result.Place?.Geometry?.Point?.[1] || 0,
          lng: result.Place?.Geometry?.Point?.[0] || 0
        }
      };

      const naturalResponse = await this.generateNaturalResponse(
        `Encontré la ubicación: ${location.formattedAddress}`,
        'location'
      );

      return {
        type: 'location',
        data: location,
        naturalLanguageResponse: naturalResponse,
        confidence: intent.confidence,
        requiresClarification: false
      };
    } catch (error) {
      console.error('Error searching location:', error);
      return this.generateErrorResponse('Error al buscar la ubicación. Intenta de nuevo.');
    }
  }

  private async handleDirectionsRequest(
    intent: Intent, 
    context: ConversationContext
  ): Promise<AgentResponse> {
    const destination = intent.entities.destination;
    
    if (!destination) {
      return this.generateErrorResponse('No pude identificar el destino. ¿Puedes especificarlo?');
    }

    if (!context.currentLocation) {
      return this.generateErrorResponse('No pude obtener tu ubicación actual.');
    }

    try {
      const locationCommand = new SearchPlaceIndexForTextCommand({
        IndexName: this.placeIndexName,
        Text: destination,
        MaxResults: 1
      });

      const locationResponse = await this.locationClient.send(locationCommand);

      if (!locationResponse.Results || locationResponse.Results.length === 0) {
        return this.generateErrorResponse(`No encontré resultados para "${destination}".`);
      }

      const destPlace = locationResponse.Results[0].Place;
      const destCoords = destPlace?.Geometry?.Point;

      if (!destCoords) {
        return this.generateErrorResponse('No pude obtener las coordenadas del destino.');
      }

      const alternatives = await this.calculateRouteAlternatives(
        context.currentLocation,
        { lat: destCoords[1], lng: destCoords[0] },
        intent.entities.preferences
      );

      if (alternatives.length === 0) {
        return this.generateErrorResponse('No se encontraron rutas disponibles.');
      }

      const sortedAlternatives = this.sortRoutesByOptimality(alternatives);

      const naturalResponse = await this.generateRouteAnnouncementWithWait(sortedAlternatives);

      return {
        type: 'route',
        data: { 
          destination: destPlace?.Label || destination,
          alternatives: sortedAlternatives,
          requiresUserSelection: true
        },
        naturalLanguageResponse: naturalResponse,
        confidence: intent.confidence,
        requiresClarification: false
      };
    } catch (error) {
      console.error('Error calculating routes:', error);
      return this.generateErrorResponse('Error al calcular las rutas. Intenta de nuevo.');
    }
  }

  private async calculateRouteAlternatives(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    preferences?: RoutePreferences
  ): Promise<RouteAlternative[]> {
    const alternatives: RouteAlternative[] = [];

    const routeConfigs = [
      { avoidTolls: false, avoidHighways: false, label: 'Ruta más rápida' },
      { avoidTolls: true, avoidHighways: false, label: 'Sin peajes' },
      { avoidTolls: false, avoidHighways: true, label: 'Sin autopistas' }
    ];

    for (const config of routeConfigs) {
      try {
        const command = new CalculateRouteCommand({
          CalculatorName: this.routeCalculatorName,
          DeparturePosition: [origin.lng, origin.lat],
          DestinationPosition: [destination.lng, destination.lat],
          TravelMode: preferences?.mode === 'walking' ? 'Walking' : 
                      preferences?.mode === 'cycling' ? 'Bicycle' : 'Car',
          IncludeLegGeometry: true,
          CarModeOptions: {
            AvoidTolls: config.avoidTolls,
            AvoidFerries: config.avoidHighways
          }
        });

        const response = await this.locationClient.send(command);

        if (response.Legs && response.Legs.length > 0) {
          const leg = response.Legs[0];
          const geometry: any[] = leg.Geometry?.LineString || [];
          
          const trafficFactor = this.estimateTrafficImpact(leg.Distance || 0, leg.DurationSeconds || 0);
          const potentialIssues = this.identifyPotentialIssues(config, trafficFactor);

          alternatives.push({
            label: config.label,
            distance: leg.Distance || 0,
            duration: leg.DurationSeconds || 0,
            trafficFactor,
            potentialIssues,
            geometry: geometry.map(coord => ({
              lng: coord[0],
              lat: coord[1]
            })),
            avoidTolls: config.avoidTolls,
            avoidHighways: config.avoidHighways
          });
        }
      } catch (error) {
        console.error(`Error calculating route with config ${config.label}:`, error);
      }
    }

    return alternatives;
  }

  private estimateTrafficImpact(distance: number, duration: number): number {
    const avgSpeedKmh = (distance / 1000) / (duration / 3600);
    
    if (avgSpeedKmh < 20) return 0.8;
    if (avgSpeedKmh < 40) return 0.6;
    if (avgSpeedKmh < 60) return 0.4;
    return 0.2;
  }

  private identifyPotentialIssues(config: { avoidTolls: boolean; avoidHighways: boolean }, trafficFactor: number): string[] {
    const issues: string[] = [];

    if (trafficFactor > 0.6) {
      issues.push('Tráfico denso esperado');
    } else if (trafficFactor > 0.4) {
      issues.push('Tráfico moderado');
    }

    if (config.avoidTolls) {
      issues.push('Ruta sin peajes puede ser más lenta');
    }

    if (config.avoidHighways) {
      issues.push('Evita autopistas, puede tomar más tiempo');
    }

    return issues;
  }

  private sortRoutesByOptimality(alternatives: RouteAlternative[]): RouteAlternative[] {
    return alternatives.sort((a, b) => {
      const scoreA = a.duration * (1 + a.trafficFactor);
      const scoreB = b.duration * (1 + b.trafficFactor);
      return scoreA - scoreB;
    });
  }

  private async generateRouteAnnouncementWithWait(alternatives: RouteAlternative[]): Promise<string> {
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

    return await this.llm.generateResponse(prompt);
  }

  private async generateNaturalResponse(
    data: string, 
    responseType: string
  ): Promise<string> {
    const prompt = `Genera una respuesta natural y amigable en español para un asistente de voz de navegación.

Tipo de respuesta: ${responseType}
Datos: ${data}

La respuesta debe ser:
- Breve (máximo 2 oraciones)
- Natural y conversacional
- En español
- Adecuada para ser leída en voz alta

Responde SOLO con el texto de la respuesta, sin comillas ni formato adicional.`;

    return await this.llm.generateResponse(prompt);
  }

  private generateClarificationResponse(text: string, intent: Intent): AgentResponse {
    return {
      type: 'clarification',
      data: { originalText: text, intent },
      naturalLanguageResponse: '¿Puedes ser más específico sobre tu destino?',
      confidence: intent.confidence,
      requiresClarification: true,
      clarificationOptions: ['Reformular la solicitud', 'Proporcionar más detalles']
    };
  }

  private generateErrorResponse(message: string): AgentResponse {
    return {
      type: 'error',
      data: {},
      naturalLanguageResponse: message,
      confidence: 0,
      requiresClarification: false
    };
  }
}
