import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  isAuthenticated = false;
  userEmail: string | null = null;
  userName: string | null = null;
  userPicture: string | null = null;
  userId: string | null = null;
  loading = true;

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.checkAuthStatus();
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
}
