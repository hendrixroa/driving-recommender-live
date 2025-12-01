import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../../../amplify_outputs.json';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AgentRequest {
  text: string;
  context?: {
    userId?: string;
    sessionId?: string;
    previousQueries?: string[];
    currentLocation?: LatLng;
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

export interface AgentResponse {
  type: 'location' | 'route' | 'clarification' | 'error';
  data: any;
  naturalLanguageResponse: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationOptions?: string[];
  processingTime?: number;
  provider?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private agentEndpoint: string = '';
  private sessionId: string;
  private previousQueries: string[] = [];

  constructor(private http: HttpClient) {
    this.sessionId = this.generateSessionId();
    this.initializeEndpoint();
  }

  private initializeEndpoint(): void {
    // Read directly from amplify_outputs.json
    const agentFunctionUrl = (outputs as any).custom?.agentFunctionUrl;
    
    if (agentFunctionUrl) {
      this.agentEndpoint = agentFunctionUrl;
      console.log('✅ Agent endpoint configured:', this.agentEndpoint);
    } else {
      this.agentEndpoint = 'http://localhost:3000/agent';
      console.warn('⚠️ Agent function URL not found in amplify_outputs.json');
      console.warn('Expected: outputs.custom.agentFunctionUrl');
      console.warn('Actual outputs:', outputs);
    }
  }

  async processVoiceInput(
    text: string, 
    currentLocation?: LatLng,
    userId?: string
  ): Promise<AgentResponse> {
    try {
      console.log('Calling agent service with:', { text, currentLocation });
      
      const request: AgentRequest = {
        text,
        context: {
          userId: userId || 'anonymous',
          sessionId: this.sessionId,
          previousQueries: this.previousQueries,
          currentLocation
        }
      };

      // Get auth session for IAM authentication
      const session = await fetchAuthSession();
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.tokens?.idToken?.toString() || ''}`
      });

      console.log('Sending request to:', this.agentEndpoint);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });

      const requestPromise = firstValueFrom(
        this.http.post<AgentResponse>(this.agentEndpoint, request, { headers })
      );

      const response = await Promise.race([requestPromise, timeoutPromise]);

      console.log('Agent response received:', response);

      // Add to query history
      this.previousQueries.push(text);
      if (this.previousQueries.length > 5) {
        this.previousQueries = this.previousQueries.slice(-5);
      }

      return response;
    } catch (error: any) {
      console.error('Error calling agent service:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      
      // Return error response with more details
      let errorMessage = 'No pude procesar tu solicitud. ';
      
      if (error.message?.includes('timeout')) {
        errorMessage += 'El servicio tardó demasiado en responder.';
      } else if (error.status === 0) {
        errorMessage += 'No se pudo conectar al servicio.';
      } else if (error.status >= 500) {
        errorMessage += 'Error del servidor.';
      } else {
        errorMessage += 'Por favor, intenta de nuevo.';
      }
      
      return {
        type: 'error',
        data: {},
        naturalLanguageResponse: errorMessage,
        confidence: 0,
        requiresClarification: false
      };
    }
  }

  clearHistory(): void {
    this.previousQueries = [];
  }

  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.previousQueries = [];
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
