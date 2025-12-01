import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
    UserPreferencesFile,
    SearchHistoryFile,
    UserPreferences,
    SearchHistoryRecord,
    DEFAULT_USER_PREFERENCES,
    GOOGLE_DRIVE_CONFIG
} from '../models/types';

@Injectable({
    providedIn: 'root'
})
export class GoogleDriveService {
    private readonly DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
    private readonly DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    private appFolderId: string | null = null;

    constructor(private http: HttpClient) { }

    private async getAccessToken(): Promise<string> {
        try {
            const session = await fetchAuthSession();
            const identities = session.tokens?.idToken?.payload['identities'] as any[];
            const googleToken = identities?.[0]?.accessToken;

            if (!googleToken || typeof googleToken !== 'string') {
                throw new Error('Google access token not found in Cognito session');
            }

            return googleToken;
        } catch (error) {
            console.error('Error fetching Google access token:', error);
            throw new Error('Failed to retrieve Google access token');
        }
    }

    private async getHeaders(): Promise<HttpHeaders> {
        const token = await this.getAccessToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
    }

    private async ensureAppFolder(): Promise<string> {
        if (this.appFolderId !== null) {
            return this.appFolderId;
        }

        const headers = await this.getHeaders();
        const folderName = GOOGLE_DRIVE_CONFIG.appFolderName;

        const searchUrl = `${this.DRIVE_API_BASE}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        try {
            const searchResponse: any = await firstValueFrom(
                this.http.get(searchUrl, { headers })
            );

            if (searchResponse.files && searchResponse.files.length > 0) {
                this.appFolderId = searchResponse.files[0].id;
                return this.appFolderId!;
            }

            const createUrl = `${this.DRIVE_API_BASE}/files`;
            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            const createResponse: any = await firstValueFrom(
                this.http.post(createUrl, folderMetadata, { headers })
            );

            this.appFolderId = createResponse.id;
            return this.appFolderId!;
        } catch (error) {
            console.error('Error ensuring app folder:', error);
            throw new Error('Failed to create or find Google Drive folder');
        }
    }

    private async readFile(fileName: string): Promise<any | null> {
        const folderId = await this.ensureAppFolder();
        const headers = await this.getHeaders();

        const searchUrl = `${this.DRIVE_API_BASE}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`;

        try {
            const searchResponse: any = await firstValueFrom(
                this.http.get(searchUrl, { headers })
            );

            if (!searchResponse.files || searchResponse.files.length === 0) {
                return null;
            }

            const fileId = searchResponse.files[0].id;
            const fileUrl = `${this.DRIVE_API_BASE}/files/${fileId}?alt=media`;

            const fileContent = await firstValueFrom(
                this.http.get(fileUrl, { headers })
            );

            return fileContent;
        } catch (error) {
            console.error(`Error reading file ${fileName}:`, error);
            return null;
        }
    }

    private async writeFile(fileName: string, data: any): Promise<void> {
        const folderId = await this.ensureAppFolder();
        const headers = await this.getHeaders();

        const searchUrl = `${this.DRIVE_API_BASE}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`;

        try {
            const searchResponse: any = await firstValueFrom(
                this.http.get(searchUrl, { headers })
            );

            const jsonData = JSON.stringify(data, null, 2);

            if (searchResponse.files && searchResponse.files.length > 0) {
                const fileId = searchResponse.files[0].id;
                const updateUrl = `${this.DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`;

                await firstValueFrom(
                    this.http.patch(updateUrl, jsonData, {
                        headers: headers.set('Content-Type', 'application/json')
                    })
                );
            } else {
                const metadata = {
                    name: fileName,
                    parents: [folderId],
                    mimeType: 'application/json'
                };

                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const closeDelimiter = "\r\n--" + boundary + "--";

                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    jsonData +
                    closeDelimiter;

                const createUrl = `${this.DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

                await firstValueFrom(
                    this.http.post(createUrl, multipartRequestBody, {
                        headers: headers.set('Content-Type', `multipart/related; boundary="${boundary}"`)
                    })
                );
            }
        } catch (error) {
            console.error(`Error writing file ${fileName}:`, error);
            throw new Error(`Failed to write file to Google Drive: ${fileName}`);
        }
    }

    async getUserPreferences(userId: string, userEmail: string): Promise<UserPreferences> {
        try {
            const file = await this.readFile(GOOGLE_DRIVE_CONFIG.fileNames.preferences);

            if (!file) {
                const defaultFile: UserPreferencesFile = {
                    userId,
                    email: userEmail,
                    preferences: DEFAULT_USER_PREFERENCES,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await this.writeFile(GOOGLE_DRIVE_CONFIG.fileNames.preferences, defaultFile);
                return DEFAULT_USER_PREFERENCES;
            }

            return (file as UserPreferencesFile).preferences;
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return DEFAULT_USER_PREFERENCES;
        }
    }

    async updateUserPreferences(
        userId: string,
        userEmail: string,
        preferences: UserPreferences
    ): Promise<void> {
        const file: UserPreferencesFile = {
            userId,
            email: userEmail,
            preferences,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(GOOGLE_DRIVE_CONFIG.fileNames.preferences, file);
    }

    async getRecentSearches(userId: string): Promise<SearchHistoryRecord[]> {
        try {
            const file = await this.readFile(GOOGLE_DRIVE_CONFIG.fileNames.searchHistory);

            if (!file) {
                return [];
            }

            return (file as SearchHistoryFile).searches || [];
        } catch (error) {
            console.error('Error getting recent searches:', error);
            return [];
        }
    }

    async saveSearchHistory(userId: string, search: SearchHistoryRecord): Promise<void> {
        try {
            let file = await this.readFile(GOOGLE_DRIVE_CONFIG.fileNames.searchHistory) as SearchHistoryFile | null;

            if (!file) {
                file = {
                    userId,
                    searches: [],
                    maxRecords: GOOGLE_DRIVE_CONFIG.maxSearchHistoryRecords
                };
            }

            file.searches.unshift(search);

            if (file.searches.length > file.maxRecords) {
                file.searches = file.searches.slice(0, file.maxRecords);
            }

            await this.writeFile(GOOGLE_DRIVE_CONFIG.fileNames.searchHistory, file);
        } catch (error) {
            console.error('Error saving search history:', error);
            throw error;
        }
    }
}
