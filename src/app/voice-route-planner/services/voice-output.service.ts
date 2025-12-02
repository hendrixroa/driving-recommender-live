import { Injectable, EventEmitter } from '@angular/core';
import amplifyOutputs from '../../../../amplify_outputs.json';

export interface SpeechOptions {
  voice?: string;
  speed?: number;
  interruptible?: boolean;
  lang?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceOutputService {
  onInterrupted = new EventEmitter<void>();
  onAudioChunkReceived = new EventEmitter<ArrayBuffer>();
  
  isSpeaking = false;
  isLoading = false;

  private audioElement: HTMLAudioElement | null = null;
  private piperFunctionUrl: string;

  constructor() {
    this.piperFunctionUrl = (amplifyOutputs.custom as any)?.voiceSynthesis?.functionUrl || '';
    if (typeof Audio !== 'undefined') {
      this.audioElement = new Audio();
    }
  }

  async speak(text: string, options?: SpeechOptions): Promise<void> {
    if (!this.piperFunctionUrl) {
      console.error('Piper TTS not configured');
      throw new Error('Voice synthesis not available');
    }

    if (!this.audioElement) {
      console.error('Audio element not supported');
      throw new Error('Audio playback not available');
    }

    this.stop();
    this.isLoading = true;

    try {
      const response = await fetch(this.piperFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          speed: options?.speed || 1.0,
          lang: options?.lang || 'es-MX',
        }),
      });

      if (!response.ok) {
        throw new Error(`Piper TTS failed: ${response.statusText}`);
      }

      const responseData = await response.json();
      
      // Check for error response
      if (responseData.error) {
        console.error('Lambda returned error:', responseData.error);
        throw new Error(`Lambda error: ${responseData.error}`);
      }

      // Decode base64 audio data
      const base64Audio = responseData.audioData;
      if (!base64Audio) {
        throw new Error('No audio data in response');
      }

      console.log('✅ Received audio data:', responseData.size, 'bytes');
      
      // Convert base64 to binary
      const binaryString = atob(base64Audio);
      const audioData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioData[i] = binaryString.charCodeAt(i);
      }
      
      const riffHeader = String.fromCharCode(...audioData.slice(0, 4));
      const waveHeader = String.fromCharCode(...audioData.slice(8, 12));
      
      if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
        throw new Error('Invalid WAV file format received from server');
      }
      
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      this.isLoading = false;
      await this.playAudio(url);

    } catch (error) {
      console.error('Piper TTS error:', error);
      this.isLoading = false;
      this.isSpeaking = false;
      throw error;
    }
  }

  private async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioElement) {
        reject(new Error('Audio element not available'));
        return;
      }

      const onEnded = () => {
        this.isSpeaking = false;
        if (this.audioElement) {
          this.audioElement.removeEventListener('ended', onEnded);
          this.audioElement.removeEventListener('error', onError);
        }
        URL.revokeObjectURL(url);
        resolve();
      };

      const onError = (e: Event) => {
        console.error('Audio playback error:', e);
        if (this.audioElement?.error) {
          console.error('Error details:', this.audioElement.error);
        }
        this.isSpeaking = false;
        if (this.audioElement) {
          this.audioElement.removeEventListener('ended', onEnded);
          this.audioElement.removeEventListener('error', onError);
        }
        URL.revokeObjectURL(url);
        reject(new Error(`Audio playback error: ${this.audioElement?.error?.message || 'Unknown'}`));
      };

      this.audioElement.addEventListener('ended', onEnded);
      this.audioElement.addEventListener('error', onError);

      this.audioElement.src = url;
      this.isSpeaking = true;
      
      this.audioElement.play().catch((error) => {
        console.error('Play error:', error);
        this.audioElement?.removeEventListener('ended', onEnded);
        this.audioElement?.removeEventListener('error', onError);
        URL.revokeObjectURL(url);
        reject(error);
      });
    });
  }

  stop(): void {
    if (this.audioElement) {
      // Remove all event listeners before stopping
      const oldElement = this.audioElement;
      this.audioElement = new Audio();
      
      // Clean up old element
      oldElement.pause();
      oldElement.src = '';
    }
    this.isSpeaking = false;
    this.isLoading = false;
  }

  pause(): void {
    if (this.audioElement && this.isSpeaking) {
      this.audioElement.pause();
    }
  }

  resume(): void {
    if (this.audioElement && this.isSpeaking) {
      this.audioElement.play();
    }
  }

  interrupt(): void {
    this.stop();
    this.onInterrupted.emit();
  }
}
