import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { VoiceInputComponent } from '../voice-input/voice-input.component';
import { MapComponent } from '../map/map.component';
import { VoiceOutputService } from '../../services/voice-output.service';
import { RouteService } from '../../services/route.service';
import { AgentService } from '../../services/agent.service';
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

      // Step 1: Process with AI agent
      const agentResponse = await this.agentService.processVoiceInput(
        destination,
        currentLocation || undefined,
        this.userId || undefined
      );

      // Announce agent's natural language response
      await this.voiceOutput.speak(
        agentResponse.naturalLanguageResponse,
        { lang: 'es-ES' }
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

      // Step 3: If agent found location, get the route
      if (agentResponse.type === 'location' && agentResponse.data) {
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

        // Get route using the route service
        const route = await this.routeService.getRoute(
          currentLocation, 
          locationData.location
        );
        
        if (!route) {
          this.snackBar.open('No se pudo calcular la ruta', 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.isProcessingRoute = false;
          return;
        }

        // Display route on map
        this.mapComponent.displayRoute(route.geometry, locationData.location);
        
        // Update route info
        this.routeInfo = route.summary;

        // Announce route via voice
        await this.voiceOutput.speak(
          `Ruta encontrada. ${route.summary}`,
          { lang: 'es-ES' }
        );

        this.snackBar.open('¡Ruta calculada!', 'Cerrar', {
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
}
