import { Component, EventEmitter, Output, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

// Extend Window interface for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

@Component({
  selector: 'app-voice-input',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule, MatButtonToggleModule],
  templateUrl: './voice-input.component.html',
  styleUrls: ['./voice-input.component.css']
})
export class VoiceInputComponent implements OnDestroy {
  @Output() speechRecognized = new EventEmitter<string>();
  @Output() interrupted = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();
  @Input() defaultLanguage: 'en' | 'es' = 'es'; // Default to Spanish

  isListening = false;
  recognizedText = '';
  permissionDenied = false;
  selectedLanguage: 'en' | 'es' = 'es';
  
  private recognition: any;
  private SpeechRecognition: any;

  // Language codes for speech recognition
  private languageCodes = {
    en: 'en-US',
    es: 'es-ES' // Can also use 'es-MX' for Mexican Spanish or 'es-US' for US Spanish
  };

  constructor() {
    // Initialize Speech Recognition with browser compatibility
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (this.SpeechRecognition) {
      this.recognition = new this.SpeechRecognition();
      this.selectedLanguage = this.defaultLanguage;
      this.setupRecognition();
    }
  }

  private setupRecognition(): void {
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    // Set language based on selection
    this.recognition.lang = this.languageCodes[this.selectedLanguage];

    this.recognition.onstart = () => {
      this.isListening = true;
      this.recognizedText = '';
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.recognizedText = finalTranscript || interimTranscript;

      if (finalTranscript) {
        this.speechRecognized.emit(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;

      switch (event.error) {
        case 'no-speech':
          this.error.emit('No speech detected, please try again');
          break;
        case 'audio-capture':
          this.error.emit('Microphone unavailable');
          break;
        case 'not-allowed':
          this.permissionDenied = true;
          this.error.emit('Microphone permission denied. Please enable microphone access.');
          break;
        case 'network':
          this.error.emit('Network error, check connection');
          break;
        default:
          this.error.emit('Speech recognition error. Please try again.');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  onLanguageChange(language: 'en' | 'es'): void {
    this.selectedLanguage = language;
    // Update recognition language
    if (this.recognition) {
      this.recognition.lang = this.languageCodes[language];
    }
  }

  async startListening(): Promise<void> {
    if (!this.SpeechRecognition) {
      this.error.emit('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      this.permissionDenied = false;
      // Update language before starting
      this.recognition.lang = this.languageCodes[this.selectedLanguage];
      this.recognition.start();
    } catch (err) {
      console.error('Microphone permission error:', err);
      this.permissionDenied = true;
      this.error.emit('Microphone permission denied. Please enable microphone access.');
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  interruptListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort();
      this.isListening = false;
      this.recognizedText = '';
      this.interrupted.emit();
    }
  }

  ngOnDestroy(): void {
    if (this.recognition) {
      this.recognition.abort();
    }
  }
}
