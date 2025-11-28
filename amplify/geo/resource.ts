/**
 * Geo resources for Amazon Location Service
 * These will be created via CDK in the backend stack
 * This file serves as a placeholder for geo configuration
 */

// Geo resources are configured in the backend.ts file using CDK constructs
// Map name: voiceRoutePlannerMap
// Search index name: voiceRoutePlannerSearchIndex
// Style: VectorEsriNavigation

export const geoConfig = {
  mapName: 'voiceRoutePlannerMap',
  searchIndexName: 'voiceRoutePlannerSearchIndex',
  mapStyle: 'VectorEsriNavigation'
};
