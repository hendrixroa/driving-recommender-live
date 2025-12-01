import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { 
  signInWithRedirect, 
  signOut, 
  getCurrentUser, 
  fetchAuthSession,
  AuthUser
} from 'aws-amplify/auth';

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  public authState$: Observable<AuthState> = this.authStateSubject.asObservable();

  constructor() {
    this.checkAuthState();
  }

  /**
   * Check current authentication state
   */
  private async checkAuthState(): Promise<void> {
    try {
      const user = await getCurrentUser();
      this.authStateSubject.next({
        isAuthenticated: true,
        user,
        loading: false
      });
    } catch (error) {
      this.authStateSubject.next({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  }

  /**
   * Sign in with Google OAuth
   */
  signInWithGoogle(): Observable<void> {
    return from(
      signInWithRedirect({
        provider: 'Google'
      })
    );
  }

  /**
   * Sign out the current user
   */
  signOutUser(): Observable<void> {
    return from(
      signOut().then(() => {
        this.authStateSubject.next({
          isAuthenticated: false,
          user: null,
          loading: false
        });
      })
    );
  }

  /**
   * Get Google OAuth access token from Cognito session
   * This token is used for Google Drive API calls
   */
  async getGoogleAccessToken(): Promise<string> {
    try {
      const session = await fetchAuthSession();
      
      // Extract Google access token from Cognito identity token
      const identities = session.tokens?.idToken?.payload['identities'] as any[];
      
      if (!identities || identities.length === 0) {
        throw new Error('No identity providers found in session');
      }

      const googleIdentity = identities.find((identity: any) => 
        identity.providerName === 'Google'
      );

      if (!googleIdentity || !googleIdentity.accessToken) {
        throw new Error('Google access token not found in session');
      }

      return googleIdentity.accessToken;
    } catch (error) {
      console.error('Error fetching Google access token:', error);
      throw new Error('Failed to retrieve Google access token');
    }
  }

  /**
   * Refresh the authentication state
   * Useful after OAuth callback
   */
  async refreshAuthState(): Promise<void> {
    this.authStateSubject.next({
      ...this.authStateSubject.value,
      loading: true
    });
    await this.checkAuthState();
  }

  /**
   * Get current authentication state synchronously
   */
  getCurrentAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }
}
