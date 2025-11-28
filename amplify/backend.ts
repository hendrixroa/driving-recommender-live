import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { geoConfig } from './geo/resource';
import { VoiceRoutePlannerStack } from './stacks/voiceRoutePlannerStack';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as location from 'aws-cdk-lib/aws-location';
import { Stack } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data
});

// Create Amazon Location Service resources using CDK
const geoStack = backend.createStack('GeoStack');

// Create map resource with Esri navigation style
const map = new location.CfnMap(geoStack, 'VoiceRoutePlannerMap', {
  mapName: geoConfig.mapName,
  configuration: {
    style: geoConfig.mapStyle
  },
  description: 'Map for Voice Route Planner with Esri navigation style'
});

// Create place index for geocoding and search
const placeIndex = new location.CfnPlaceIndex(geoStack, 'VoiceRoutePlannerSearchIndex', {
  indexName: geoConfig.searchIndexName,
  dataSource: 'Esri',
  description: 'Place index for Voice Route Planner geocoding and search'
});

// Create route calculator
const routeCalculator = new location.CfnRouteCalculator(geoStack, 'VoiceRoutePlannerRouteCalculator', {
  calculatorName: 'voiceRoutePlannerRouteCalculator',
  dataSource: 'Esri',
  description: 'Route calculator for Voice Route Planner'
});

// Add Voice Route Planner stack
const voiceRoutePlannerStack = new VoiceRoutePlannerStack(
  backend.stack,
  'VoiceRoutePlannerStack'
);

// Configure geo permissions for authenticated users
const geoPolicy = new Policy(geoStack, 'GeoPolicy', {
  statements: [
    new PolicyStatement({
      actions: [
        'geo:SearchPlaceIndexForText',
        'geo:SearchPlaceIndexForPosition',
        'geo:GetPlace',
        'geo:CalculateRoute',
        'geo:GetMapStyleDescriptor',
        'geo:GetMapGlyphs',
        'geo:GetMapSprites',
        'geo:GetMapTile'
      ],
      resources: [
        map.attrArn,
        placeIndex.attrArn,
        routeCalculator.attrArn
      ]
    })
  ]
});

// Attach geo policy to authenticated user role
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(geoPolicy);

// Export geo resource names for frontend configuration
geoStack.exportValue(map.mapName, { name: 'VoiceRoutePlannerMapName' });
geoStack.exportValue(placeIndex.indexName, { name: 'VoiceRoutePlannerSearchIndexName' });
geoStack.exportValue(routeCalculator.calculatorName, { name: 'VoiceRoutePlannerRouteCalculatorName' });
