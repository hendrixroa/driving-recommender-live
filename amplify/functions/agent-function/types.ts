/**
 * Type definitions for the Agent Service
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ConversationContext {
  userId: string;
  sessionId: string;
  previousQueries: string[];
  currentLocation?: LatLng;
}

export interface Intent {
  type: 'find_location' | 'get_directions' | 'clarify' | 'unknown';
  entities: {
    destination?: string;
    origin?: string;
    preferences?: RoutePreferences;
  };
  confidence: number;
}

export interface RoutePreferences {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  mode?: 'driving' | 'walking' | 'cycling';
}

export interface AgentResponse {
  type: 'location' | 'route' | 'clarification' | 'error';
  data: any;
  naturalLanguageResponse: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationOptions?: string[];
}

export interface LocationResult {
  formattedAddress: string;
  location: LatLng;
  placeId?: string;
}

export interface RouteResult {
  distance: number;
  duration: number;
  summary: string;
  geometry: LatLng[];
  trafficInfo?: {
    congestionLevel?: 'low' | 'medium' | 'high';
    incidents?: string[];
  };
}

export interface RouteAlternative {
  label: string;
  distance: number;
  duration: number;
  trafficFactor: number;
  potentialIssues: string[];
  geometry: LatLng[];
  avoidTolls: boolean;
  avoidHighways: boolean;
}
