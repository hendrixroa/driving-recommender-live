export interface UserPreferences {
    voiceEnabled: boolean;
    autoPlayAudio: boolean;
    preferredVoice: string;
    mapTheme: 'default' | 'dark' | 'light';
    newsCategories: string[];
}

export interface LatLng {
    lat: number;
    lng: number;
}

export interface SearchHistoryRecord {
    searchId: string;
    timestamp: string;
    destination: string;
    origin?: LatLng;
    selectedRoute?: any;
}

export interface UserPreferencesFile {
    userId: string;
    email: string;
    preferences: UserPreferences;
    createdAt: string;
    updatedAt: string;
}

export interface SearchHistoryFile {
    userId: string;
    searches: SearchHistoryRecord[];
    maxRecords: number;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
    voiceEnabled: true,
    autoPlayAudio: true,
    preferredVoice: 'en-US',
    mapTheme: 'default',
    newsCategories: ['traffic', 'weather', 'incidents']
};

export const GOOGLE_DRIVE_CONFIG = {
    appFolderName: 'VoiceRoutePlanner',
    fileNames: {
        preferences: 'preferences.json',
        searchHistory: 'search-history.json'
    },
    maxSearchHistoryRecords: 50
};
