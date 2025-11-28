/**
 * Voice Route Planner Configuration
 * 
 * This file contains configuration constants for the Voice Route Planner feature.
 */

export const VoiceRoutePlannerConfig = {
  // Google Drive configuration
  googleDrive: {
    appFolderName: 'VoiceRoutePlanner',
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/drive.file'
    ],
    fileTypes: {
      preferences: 'preferences.json',
      searchHistory: 'search-history.json'
    }
  },

  // Search history configuration
  searchHistory: {
    maxRecords: 50
  },

  // Performance thresholds
  performance: {
    voiceProcessingLatency: 500, // milliseconds
    routeServiceResponseTime: 3000, // milliseconds
    viewTransitionTime: 300, // milliseconds
    agentResponseTime: 5000 // milliseconds
  },

  // Map configuration
  map: {
    defaultZoom: 12,
    defaultCenter: { lat: 37.7749, lng: -122.4194 } // San Francisco
  }
};
