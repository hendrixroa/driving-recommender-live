import { LocationClient, SearchPlaceIndexForTextCommand, CalculateRouteCommand } from '@aws-sdk/client-location';
import { LocationResult, RouteAlternative, RoutePreferences, LatLng } from './types';

export class LocationServiceTools {
  private locationClient: LocationClient;
  private placeIndexName: string;
  private routeCalculatorName: string;

  constructor() {
    this.locationClient = new LocationClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.placeIndexName = process.env.PLACE_INDEX_NAME || 'voiceRoutePlannerSearchIndex';
    this.routeCalculatorName = process.env.ROUTE_CALCULATOR_NAME || 'voiceRoutePlannerRouteCalculator';
  }

  async searchLocation(query: string, maxResults: number = 5): Promise<LocationResult[]> {
    console.log(`[Tool: searchLocation] Searching for: "${query}"`);
    
    const command = new SearchPlaceIndexForTextCommand({
      IndexName: this.placeIndexName,
      Text: query,
      MaxResults: maxResults
    });

    const response = await this.locationClient.send(command);

    if (!response.Results || response.Results.length === 0) {
      console.log(`[Tool: searchLocation] No results found for: "${query}"`);
      return [];
    }

    const locations: LocationResult[] = response.Results.map(r => ({
      formattedAddress: r.Place?.Label || query,
      location: {
        lat: r.Place?.Geometry?.Point?.[1] || 0,
        lng: r.Place?.Geometry?.Point?.[0] || 0
      },
      placeId: r.PlaceId
    }));

    console.log(`[Tool: searchLocation] Found ${locations.length} location(s)`);
    return locations;
  }

  async calculateRoute(
    origin: LatLng,
    destination: LatLng,
    preferences?: RoutePreferences
  ): Promise<RouteAlternative | null> {
    console.log(`[Tool: calculateRoute] Calculating route from [${origin.lat}, ${origin.lng}] to [${destination.lat}, ${destination.lng}]`);
    
    const command = new CalculateRouteCommand({
      CalculatorName: this.routeCalculatorName,
      DeparturePosition: [origin.lng, origin.lat],
      DestinationPosition: [destination.lng, destination.lat],
      TravelMode: preferences?.mode === 'walking' ? 'Walking' : 
                  preferences?.mode === 'cycling' ? 'Bicycle' : 'Car',
      IncludeLegGeometry: true,
      CarModeOptions: preferences?.mode === 'driving' || !preferences?.mode ? {
        AvoidTolls: preferences?.avoidTolls || false,
        AvoidFerries: preferences?.avoidHighways || false
      } : undefined
    });

    const response = await this.locationClient.send(command);

    if (!response.Legs || response.Legs.length === 0) {
      console.log(`[Tool: calculateRoute] No route found`);
      return null;
    }

    const leg = response.Legs[0];
    const geometry: any[] = leg.Geometry?.LineString || [];
    
    const avgSpeedKmh = (leg.Distance || 0) / 1000 / ((leg.DurationSeconds || 1) / 3600);
    const trafficFactor = avgSpeedKmh < 20 ? 0.8 : avgSpeedKmh < 40 ? 0.6 : avgSpeedKmh < 60 ? 0.4 : 0.2;
    
    const potentialIssues: string[] = [];
    if (trafficFactor > 0.6) {
      potentialIssues.push('Tráfico denso esperado');
    } else if (trafficFactor > 0.4) {
      potentialIssues.push('Tráfico moderado');
    }

    const route: RouteAlternative = {
      label: this.getRouteLabel(preferences),
      distance: leg.Distance || 0,
      duration: leg.DurationSeconds || 0,
      trafficFactor,
      potentialIssues,
      geometry: geometry.map(coord => ({
        lng: coord[0],
        lat: coord[1]
      })),
      avoidTolls: preferences?.avoidTolls || false,
      avoidHighways: preferences?.avoidHighways || false
    };

    console.log(`[Tool: calculateRoute] Route calculated: ${route.distance}m, ${route.duration}s`);
    return route;
  }

  async calculateRouteAlternatives(
    origin: LatLng,
    destination: LatLng,
    basePreferences?: RoutePreferences
  ): Promise<RouteAlternative[]> {
    console.log(`[Tool: calculateRouteAlternatives] Calculating 3 route alternatives`);
    
    const alternatives: RouteAlternative[] = [];

    const routeConfigs = [
      { avoidTolls: false, avoidHighways: false, label: 'Ruta más rápida' },
      { avoidTolls: true, avoidHighways: false, label: 'Sin peajes' },
      { avoidTolls: false, avoidHighways: true, label: 'Sin autopistas' }
    ];

    for (const config of routeConfigs) {
      try {
        const preferences: RoutePreferences = {
          ...basePreferences,
          avoidTolls: config.avoidTolls,
          avoidHighways: config.avoidHighways
        };

        const route = await this.calculateRoute(origin, destination, preferences);
        
        if (route) {
          route.label = config.label;
          
          if (config.avoidTolls) {
            route.potentialIssues.push('Ruta sin peajes puede ser más lenta');
          }
          if (config.avoidHighways) {
            route.potentialIssues.push('Evita autopistas, puede tomar más tiempo');
          }
          
          alternatives.push(route);
        }
      } catch (error) {
        console.error(`[Tool: calculateRouteAlternatives] Error calculating route with config ${config.label}:`, error);
      }
    }

    alternatives.sort((a, b) => {
      const scoreA = a.duration * (1 + a.trafficFactor);
      const scoreB = b.duration * (1 + b.trafficFactor);
      return scoreA - scoreB;
    });

    console.log(`[Tool: calculateRouteAlternatives] Calculated ${alternatives.length} alternatives`);
    return alternatives;
  }

  disambiguateLocation(locations: LocationResult[]): { 
    needsDisambiguation: boolean; 
    options: string[];
    primary?: LocationResult;
  } {
    console.log(`[Tool: disambiguateLocation] Processing ${locations.length} location(s)`);
    
    if (locations.length === 0) {
      return {
        needsDisambiguation: false,
        options: []
      };
    }

    if (locations.length === 1) {
      return {
        needsDisambiguation: false,
        options: [],
        primary: locations[0]
      };
    }

    return {
      needsDisambiguation: true,
      options: locations.map(l => l.formattedAddress),
      primary: locations[0]
    };
  }

  private getRouteLabel(preferences?: RoutePreferences): string {
    if (preferences?.avoidTolls && preferences?.avoidHighways) {
      return 'Sin peajes ni autopistas';
    }
    if (preferences?.avoidTolls) {
      return 'Sin peajes';
    }
    if (preferences?.avoidHighways) {
      return 'Sin autopistas';
    }
    if (preferences?.mode === 'walking') {
      return 'Caminando';
    }
    if (preferences?.mode === 'cycling') {
      return 'En bicicleta';
    }
    return 'Ruta más rápida';
  }
}

export function createLocationServiceTools(): LocationServiceTools {
  return new LocationServiceTools();
}
