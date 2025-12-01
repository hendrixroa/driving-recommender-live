import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  formattedAddress: string;
  location: LatLng;
  placeId?: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface Route {
  id: string;
  summary: string;
  distance: number; // in meters
  duration: number; // in seconds
  geometry: LatLng[];
  steps: RouteStep[];
}

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  // Using Nominatim (OpenStreetMap) for geocoding as a fallback
  // TODO: Replace with Amazon Location Service after backend deployment
  private readonly NOMINATIM_API = 'https://nominatim.openstreetmap.org';
  private readonly OSRM_API = 'https://router.project-osrm.org';

  constructor(private http: HttpClient) {}

  async geocodeDestination(destination: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.NOMINATIM_API}/search?format=json&q=${encodeURIComponent(destination)}&limit=1`;
      
      const response: any = await firstValueFrom(
        this.http.get(url, {
          headers: {
            'User-Agent': 'VoiceRoutePlanner/1.0'
          }
        })
      );

      if (response && response.length > 0) {
        const result = response[0];
        return {
          formattedAddress: result.display_name,
          location: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          placeId: result.place_id
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  async getRoute(origin: LatLng, destination: LatLng): Promise<Route | null> {
    try {
      const url = `${this.OSRM_API}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
      
      const response: any = await firstValueFrom(
        this.http.get(url)
      );

      if (response && response.routes && response.routes.length > 0) {
        const osrmRoute = response.routes[0];
        
        // Convert GeoJSON coordinates to LatLng array
        const geometry: LatLng[] = osrmRoute.geometry.coordinates.map((coord: number[]) => ({
          lng: coord[0],
          lat: coord[1]
        }));

        // Extract steps
        const steps: RouteStep[] = [];
        if (osrmRoute.legs && osrmRoute.legs[0] && osrmRoute.legs[0].steps) {
          for (const step of osrmRoute.legs[0].steps) {
            steps.push({
              instruction: step.maneuver?.instruction || 'Continue',
              distance: step.distance,
              duration: step.duration
            });
          }
        }

        return {
          id: 'route-1',
          summary: `${this.formatDistance(osrmRoute.distance)}, ${this.formatDuration(osrmRoute.duration)}`,
          distance: osrmRoute.distance,
          duration: osrmRoute.duration,
          geometry,
          steps
        };
      }

      return null;
    } catch (error) {
      console.error('Routing error:', error);
      return null;
    }
  }

  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }
}
