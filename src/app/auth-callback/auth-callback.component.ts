import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Hub } from 'aws-amplify/utils';
import { getCurrentUser } from 'aws-amplify/auth';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <p>Completing sign in...</p>
      <p *ngIf="error" class="error">{{ error }}</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    p {
      font-size: 1.1rem;
    }
    
    .error {
      color: #ff6b6b;
      margin-top: 10px;
    }
  `]
})
export class AuthCallbackComponent implements OnInit {
  error: string | null = null;

  constructor(private router: Router) { }

  async ngOnInit() {
    // Listen for auth events
    Hub.listen('auth', ({ payload }: any) => {
      switch (payload.event) {
        case 'signInWithRedirect':
          this.handleSignInSuccess();
          break;
        case 'signInWithRedirect_failure':
          this.error = 'Sign in failed. Please try again.';
          console.error('Sign in failure', payload.data);
          break;
      }
    });

    // Also check if we are already authenticated (in case event was missed)
    try {
      await getCurrentUser();
      this.handleSignInSuccess();
    } catch (err) {
      // Not authenticated yet, wait for Hub event or timeout
      console.log('Not authenticated yet, waiting for Hub event...');
    }
  }

  private handleSignInSuccess() {
    // Small delay to ensure session is fully established
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 500);
  }
}

