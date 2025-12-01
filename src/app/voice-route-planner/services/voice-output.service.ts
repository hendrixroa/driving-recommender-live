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
      throw new Error('Piper TTS function URL not configured');
    }

    if (!this.audioElement) {
      throw new Error('Audio element not supported');
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
          lang: options?.lang || 'es-ES',
        }),
      });

      if (!response.ok) {
        throw new Error(`Piper TTS request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (value) {
          chunks.push(value);
          this.onAudioChunkReceived.emit(value.buffer);
        }
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      console.log('Total audio data length:', totalLength);
      
      const audioData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      console.log('First 44 bytes (WAV header):', Array.from(audioData.slice(0, 44)));
      console.log('WAV header string:', String.fromCharCode(...audioData.slice(0, 4)));
      
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      this.isLoading = false;
      await this.playAudio(url);

    } catch (error) {
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

      this.audioElement.src = url;
      
      const onEnded = () => {
        this.isSpeaking = false;
        URL.revokeObjectURL(url);
        this.audioElement?.removeEventListener('ended', onEnded);
        this.audioElement?.removeEventListener('error', onError);
        resolve();
      };

      const onError = (e: ErrorEvent) => {
        console.error('Audio element error:', e);
        console.error('Audio element error details:', this.audioElement?.error);
        this.isSpeaking = false;
        URL.revokeObjectURL(url);
        this.audioElement?.removeEventListener('ended', onEnded);
        this.audioElement?.removeEventListener('error', onError);
        reject(new Error(`Audio playback error: ${this.audioElement?.error?.message || 'Unknown'}`));
      };

      this.audioElement.addEventListener('ended', onEnded);
      this.audioElement.addEventListener('error', onError);

      this.isSpeaking = true;
      this.audioElement.play().catch(reject);
    });
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.src = '';
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
