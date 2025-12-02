import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { VoiceInputComponent } from '../voice-input/voice-input.component';
import { MapComponent } from '../map/map.component';
import { VoiceOutputService } from '../../services/voice-output.service';
import { RouteService } from '../../services/route.service';
import { AgentService, RouteAlternative } from '../../services/agent.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    VoiceInputComponent, 
    MapComponent,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  @ViewChild(MapComponent) mapComponent!: MapComponent;

  isAuthenticated = false;
  userEmail: string | null = null;
  userName: string | null = null;
  userPicture: string | null = null;
  userId: string | null = null;
  loading = true;
  destination: string = '';
  isProcessingRoute = false;
  routeInfo: string = '';
  showEnableAudioButton = false;
  audioEnabled = false;
  routeAlternatives: RouteAlternative[] = [];
  selectedRouteIndex: number | null = null;
  showingAlternatives = false;
  isNavigating = false;

  constructor(
    private router: Router,
    private voiceOutput: VoiceOutputService,
    private routeService: RouteService,
    private agentService: AgentService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.checkAuthStatus();
    
    // If authenticated, try to play welcome message
    if (this.isAuthenticated) {
      setTimeout(async () => {
        await this.tryPlayWelcomeMessage();
      }, 1000);
    }
  }

  async tryPlayWelcomeMessage() {
    try {
      await this.voiceOutput.speak('¿A dónde vas?', { lang: 'es-ES' });
      this.audioEnabled = true;
    } catch (error: any) {
      console.log('Speech synthesis blocked, showing enable button');
      // If speech is blocked, show button to enable it
      this.showEnableAudioButton = true;
    }
  }

  async enableAudio() {
    try {
      // Play a short sound to enable audio context
      await this.voiceOutput.speak('Audio habilitado', { lang: 'es-ES' });
      this.audioEnabled = true;
      this.showEnableAudioButton = false;
      
      // Now play the welcome message
      setTimeout(async () => {
        await this.playWelcomeMessage();
      }, 500);
    } catch (error) {
      console.error('Error enabling audio:', error);
      this.snackBar.open('No se pudo habilitar el audio', 'Cerrar', {
        duration: 3000
      });
    }
  }

  async checkAuthStatus() {
    try {
      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      
      this.isAuthenticated = true;
      this.userId = user.userId;
      this.userEmail = attributes.email || user.signInDetails?.loginId || 'No email';
      this.userName = attributes.name || attributes.given_name || 'User';
      this.userPicture = attributes.picture || null;
      this.loading = false;
    } catch (error) {
      this.isAuthenticated = false;
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  }

  async handleSignOut() {
    try {
      await signOut();
      this.isAuthenticated = false;
      this.userEmail = null;
      this.userName = null;
      this.userPicture = null;
      this.userId = null;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async playWelcomeMessage() {
    try {
      // Play welcome message in Spanish
      await this.voiceOutput.speak('¿A dónde vas?', { lang: 'es-ES' });
    } catch (error) {
      console.error('Error playing welcome message:', error);
    }
  }

  async onSpeechRecognized(text: string) {
    this.destination = text;
    this.snackBar.open(`Destino: ${text}`, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    
    // Process destination and display route
    await this.processDestination(text);
  }

  private async processDestination(destination: string): Promise<void> {
    this.isProcessingRoute = true;
    this.routeInfo = '';

    try {
      // Get current location from map
      const currentLocation = this.mapComponent.getCurrentLocation();

      // Check if this is a route selection command
      if (this.showingAlternatives && this.handleRouteSelectionCommand(destination)) {
        this.isProcessingRoute = false;
        return;
      }

      // Step 1: Process with AI agent
      const agentResponse = await this.agentService.processVoiceInput(
        destination,
        currentLocation || undefined,
        this.userId || undefined
      );

      console.log('Agent response received:', agentResponse);
      console.log('Agent response type:', agentResponse.type);
      console.log('Agent response data:', agentResponse.data);

      // Announce agent's natural language response
      await this.voiceOutput.speak(
        agentResponse.naturalLanguageResponse,
        { lang: 'es-MX' }
      );

      // Step 2: Handle different response types
      if (agentResponse.type === 'error') {
        this.snackBar.open(agentResponse.naturalLanguageResponse, 'Cerrar', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.isProcessingRoute = false;
        return;
      }

      if (agentResponse.requiresClarification) {
        // TODO: Handle clarification UI
        this.snackBar.open(agentResponse.naturalLanguageResponse, 'Cerrar', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.isProcessingRoute = false;
        return;
      }

      // Step 3: Handle route alternatives from agent
      if (agentResponse.type === 'route' && agentResponse.data?.alternatives) {
        const alternatives = agentResponse.data.alternatives;
        
        console.log('Received route alternatives:', alternatives);
        console.log('Alternative distances:', alternatives.map((a: any) => ({
          label: a.label,
          distance: a.distance,
          distanceKm: (a.distance / 1000).toFixed(2),
          duration: a.duration,
          durationMin: (a.duration / 60).toFixed(1)
        })));
        
        // Store alternatives and show them
        this.routeAlternatives = alternatives;
        this.showingAlternatives = true;

        // Display first route on map as preview
        if (alternatives.length > 0 && alternatives[0].geometry) {
          const firstRoute = alternatives[0];
          const destination = firstRoute.geometry[firstRoute.geometry.length - 1];
          this.mapComponent.displayRoute(firstRoute.geometry, destination);
        }

        this.snackBar.open('¡Rutas calculadas!', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
      
      // Fallback: If agent found location but no routes, calculate them ourselves
      else if (agentResponse.type === 'location' && agentResponse.data) {
        const locationData = agentResponse.data;
        
        if (!currentLocation) {
          this.snackBar.open('No se pudo obtener tu ubicación actual', 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.isProcessingRoute = false;
          return;
        }

        // Get route alternatives using the route service
        const alternatives = await this.routeService.getRouteAlternatives(
          currentLocation, 
          locationData.location
        );
        
        if (!alternatives || alternatives.length === 0) {
          this.snackBar.open('No se pudo calcular la ruta', 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.isProcessingRoute = false;
          return;
        }

        // Store alternatives and show them
        this.routeAlternatives = alternatives;
        this.showingAlternatives = true;

        // Announce alternatives via voice
        await this.announceRouteAlternatives(alternatives);

        this.snackBar.open('¡Rutas calculadas!', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }

    } catch (error) {
      console.error('Error processing destination:', error);
      this.snackBar.open('Error al procesar el destino', 'Cerrar', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.isProcessingRoute = false;
    }
  }

  onVoiceError(error: string) {
    this.snackBar.open(error, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  onVoiceInterrupted() {
    console.log('Voice input interrupted');
  }

  private async announceRouteAlternatives(alternatives: RouteAlternative[]): Promise<void> {
    let announcement = `Encontré ${alternatives.length} rutas alternativas. `;
    
    alternatives.forEach((alt, index) => {
      const trafficLevel = this.getTrafficLevel(alt.trafficFactor);
      const distance = this.formatDistance(alt.distance);
      const duration = this.formatDuration(alt.duration);
      
      announcement += `Opción ${index + 1}: ${alt.label}. `;
      announcement += `Distancia: ${distance}. `;
      announcement += `Tiempo estimado: ${duration}. `;
      announcement += `Tráfico: ${trafficLevel}. `;
    });
    
    announcement += 'Selecciona una opción para comenzar.';
    
    await this.voiceOutput.speak(announcement, { lang: 'es-MX' });
  }

  getTrafficLevel(trafficFactor: number): string {
    if (trafficFactor < 1.2) return 'bajo';
    if (trafficFactor < 1.5) return 'moderado';
    return 'alto';
  }

  getTrafficColor(trafficFactor: number): string {
    if (trafficFactor < 1.2) return 'green';
    if (trafficFactor < 1.5) return 'orange';
    return 'red';
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    const km = meters / 1000;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }

  formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }

  async selectRoute(index: number): Promise<void> {
    this.selectedRouteIndex = index;
    const selectedRoute = this.routeAlternatives[index];
    
    // Display selected route on map
    const locationData = { lat: selectedRoute.geometry[selectedRoute.geometry.length - 1].lat, lng: selectedRoute.geometry[selectedRoute.geometry.length - 1].lng };
    this.mapComponent.displayRoute(selectedRoute.geometry, locationData);
    
    // Announce selection
    const distance = this.formatDistance(selectedRoute.distance);
    const duration = this.formatDuration(selectedRoute.duration);
    await this.voiceOutput.speak(
      `Has seleccionado ${selectedRoute.label}. ${distance}, ${duration}. ¿Listo para comenzar?`,
      { lang: 'es-MX' }
    );
  }

  async startNavigation(): Promise<void> {
    if (this.selectedRouteIndex === null) {
      this.snackBar.open('Por favor selecciona una ruta primero', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.isNavigating = true;
    const selectedRoute = this.routeAlternatives[this.selectedRouteIndex];
    
    await this.voiceOutput.speak(
      '¡Comenzando navegación! Te guiaré paso a paso.',
      { lang: 'es-MX' }
    );

    // TODO: Implement turn-by-turn navigation
    this.snackBar.open('Navegación iniciada', 'Cerrar', {
      duration: 3000
    });
  }

  cancelRouteSelection(): void {
    this.routeAlternatives = [];
    this.selectedRouteIndex = null;
    this.showingAlternatives = false;
    this.isNavigating = false;
    this.destination = '';
    this.routeInfo = '';
  }

  private handleRouteSelectionCommand(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Check for route selection commands
    const optionMatch = lowerText.match(/opci[oó]n\s*(\d+)|ruta\s*(\d+)|n[uú]mero\s*(\d+)/);
    if (optionMatch) {
      const optionNumber = parseInt(optionMatch[1] || optionMatch[2] || optionMatch[3]) - 1;
      if (optionNumber >= 0 && optionNumber < this.routeAlternatives.length) {
        this.selectRoute(optionNumber);
        return true;
      }
    }

    // Check for "primera", "segunda", "tercera"
    if (lowerText.includes('primera') || lowerText.includes('uno')) {
      this.selectRoute(0);
      return true;
    }
    if (lowerText.includes('segunda') || lowerText.includes('dos')) {
      this.selectRoute(1);
      return true;
    }
    if (lowerText.includes('tercera') || lowerText.includes('tres')) {
      this.selectRoute(2);
      return true;
    }

    // Check for "comenzar", "empezar", "iniciar"
    if (lowerText.includes('comenzar') || lowerText.includes('empezar') || 
        lowerText.includes('iniciar') || lowerText.includes('vamos')) {
      if (this.selectedRouteIndex !== null) {
        this.startNavigation();
        return true;
      }
    }

    return false;
  }
}
