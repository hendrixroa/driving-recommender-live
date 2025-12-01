import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl from 'maplibre-gl';

interface LatLng {
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, OnDestroy {
  @Input() center: LatLng = { lat: 37.7749, lng: -122.4194 };
  @Input() zoom: number = 12;

  map: maplibregl.Map | null = null;
  currentLocationMarker: maplibregl.Marker | null = null;
  destinationMarker: maplibregl.Marker | null = null;
  isLoadingLocation = false;
  locationError: string | null = null;
  currentLocation: LatLng | null = null;

  async ngOnInit() {
    await this.initializeMap();
    await this.getCurrentLocationInternal();
  }

  private async initializeMap(): Promise<void> {
    try {
      this.initializeBasicMap();
    } catch (error) {
      console.error('Error initializing map:', error);
      this.locationError = 'Failed to initialize map';
    }
  }

  private initializeBasicMap(): void {
    this.map = new maplibregl.Map({
      container: 'map-container',
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [this.center.lng, this.center.lat],
      zoom: this.zoom
    });

    this.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true
      }),
      'top-right'
    );

    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true
    });

    this.map.addControl(geolocateControl, 'top-right');
  }

  private async getCurrentLocationInternal(): Promise<void> {
    if (!navigator.geolocation) {
      this.locationError = 'Geolocation is not supported by your browser';
      return;
    }

    this.isLoadingLocation = true;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      this.currentLocation = { lat: latitude, lng: longitude };
      
      if (this.map) {
        this.map.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          essential: true
        });

        this.addCurrentLocationMarker(this.currentLocation);
      }

      this.isLoadingLocation = false;
    } catch (error: any) {
      console.error('Error getting current location:', error);
      this.isLoadingLocation = false;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          this.locationError = 'Location permission denied. Please enable location access.';
          break;
        case error.POSITION_UNAVAILABLE:
          this.locationError = 'Location information unavailable';
          break;
        case error.TIMEOUT:
          this.locationError = 'Location request timed out';
          break;
        default:
          this.locationError = 'An error occurred while getting your location';
      }
    }
  }

  private addCurrentLocationMarker(location: LatLng): void {
    if (!this.map) return;

    if (this.currentLocationMarker) {
      this.currentLocationMarker.remove();
    }

    const el = document.createElement('div');
    el.className = 'current-location-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#4285F4';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

    this.currentLocationMarker = new maplibregl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(this.map);
  }

  displayRoute(routeGeometry: LatLng[], destination: LatLng): void {
    if (!this.map) return;

    this.addDestinationMarker(destination);

    if (!this.map.loaded()) {
      this.map.once('load', () => {
        this.addRouteToMap(routeGeometry);
      });
    } else {
      this.addRouteToMap(routeGeometry);
    }
  }

  private addRouteToMap(routeGeometry: LatLng[]): void {
    if (!this.map) return;

    if (this.map.getSource('route')) {
      this.map.removeLayer('route');
      this.map.removeSource('route');
    }

    const geojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeGeometry.map(point => [point.lng, point.lat])
      }
    };

    this.map.addSource('route', {
      type: 'geojson',
      data: geojson
    });

    this.map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 5,
        'line-opacity': 0.8
      }
    });

    const bounds = new maplibregl.LngLatBounds();
    routeGeometry.forEach(point => {
      bounds.extend([point.lng, point.lat]);
    });

    this.map.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15
    });
  }

  private addDestinationMarker(location: LatLng): void {
    if (!this.map) return;

    if (this.destinationMarker) {
      this.destinationMarker.remove();
    }

    const el = document.createElement('div');
    el.className = 'destination-marker';
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.borderRadius = '50% 50% 50% 0';
    el.style.backgroundColor = '#ef4444';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    el.style.transform = 'rotate(-45deg)';

    this.destinationMarker = new maplibregl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(this.map);
  }

  getCurrentLocation(): LatLng | null {
    return this.currentLocation;
  }

  ngOnDestroy(): void {
    if (this.currentLocationMarker) {
      this.currentLocationMarker.remove();
    }
    if (this.destinationMarker) {
      this.destinationMarker.remove();
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
