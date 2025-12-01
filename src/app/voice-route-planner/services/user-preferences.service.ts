import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GoogleDriveService } from './google-drive.service';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../models/types';

@Injectable({
    providedIn: 'root'
})
export class UserPreferencesService {
    private preferencesSubject = new BehaviorSubject<UserPreferences>(DEFAULT_USER_PREFERENCES);
    public preferences$: Observable<UserPreferences> = this.preferencesSubject.asObservable();

    private loaded = false;

    constructor(private googleDriveService: GoogleDriveService) { }

    async loadPreferences(userId: string, userEmail: string): Promise<UserPreferences> {
        try {
            const preferences = await this.googleDriveService.getUserPreferences(userId, userEmail);
            this.preferencesSubject.next(preferences);
            this.loaded = true;
            return preferences;
        } catch (error) {
            console.error('Error loading preferences:', error);
            return DEFAULT_USER_PREFERENCES;
        }
    }

    async updatePreferences(
        userId: string,
        userEmail: string,
        preferences: Partial<UserPreferences>
    ): Promise<void> {
        const current = this.preferencesSubject.value;
        const updated = { ...current, ...preferences };

        this.preferencesSubject.next(updated);

        try {
            await this.googleDriveService.updateUserPreferences(userId, userEmail, updated);
        } catch (error) {
            console.error('Error updating preferences:', error);
            this.preferencesSubject.next(current);
            throw error;
        }
    }

    getCurrentPreferences(): UserPreferences {
        return this.preferencesSubject.value;
    }

    isLoaded(): boolean {
        return this.loaded;
    }
}
