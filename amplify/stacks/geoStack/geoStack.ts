import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as location from 'aws-cdk-lib/aws-location';

export function geoStack(backend: any) {
  const stack = backend.createStack('GeoStack');

  const geoConfig = {
    mapName: 'voiceRoutePlannerMap',
    mapStyle: 'VectorEsriNavigation',
    searchIndexName: 'voiceRoutePlannerSearchIndex'
  };

  const map = new location.CfnMap(stack, 'VoiceRoutePlannerMap', {
    mapName: geoConfig.mapName,
    configuration: {
      style: geoConfig.mapStyle
    },
    description: 'Map for Voice Route Planner with Esri navigation style'
  });

  const placeIndex = new location.CfnPlaceIndex(stack, 'VoiceRoutePlannerSearchIndex', {
    indexName: geoConfig.searchIndexName,
    dataSource: 'Esri',
    description: 'Place index for Voice Route Planner geocoding and search'
  });

  const routeCalculator = new location.CfnRouteCalculator(stack, 'VoiceRoutePlannerRouteCalculator', {
    calculatorName: 'voiceRoutePlannerRouteCalculator',
    dataSource: 'Esri',
    description: 'Route calculator for Voice Route Planner'
  });

  const geoPolicy = new Policy(stack, 'GeoPolicy', {
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

  backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(geoPolicy);

  stack.exportValue(map.mapName, { name: 'VoiceRoutePlannerMapName' });
  stack.exportValue(placeIndex.indexName, { name: 'VoiceRoutePlannerSearchIndexName' });
  stack.exportValue(routeCalculator.calculatorName, { name: 'VoiceRoutePlannerRouteCalculatorName' });

  return {
    map,
    placeIndex,
    routeCalculator,
    geoPolicy
  };
}
