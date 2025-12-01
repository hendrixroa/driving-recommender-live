# Design Document

## Overview

The Voice Route Planner is a full-stack web application that combines voice interaction, AI-powered natural language processing, mapping services, and news aggregation to provide an intuitive route planning experience. The architecture leverages AWS Amplify Gen 2 for backend infrastructure, Angular (latest version) for the frontend, Amazon Location Service with MapLibre GL JS for mapping and routing, LlamaIndex Python workflows for intelligent agent processing, and Piper TTS for high-quality server-side voice synthesis.

The system follows a modern serverless architecture optimized for performance using AWS Lambda SnapStart. It features clear separation between presentation (Angular), business logic (AWS Lambda functions with LlamaIndex workflow agents), voice synthesis (Piper TTS with Lambda Response Streaming), and data persistence (Google Drive via direct browser API calls). The application uses AWS Cognito for authentication with Google OAuth integration, Lambda Function URLs with response streaming for voice synthesis, and integrates with Amazon Location Service for geocoding and routing through an intelligent LlamaIndex workflow agent that processes natural language queries. User data is managed entirely in the Angular frontend using the Google Drive API directly with OAuth tokens from Cognito.

**Key Architectural Decision**: We use Piper TTS running on AWS Lambda with SnapStart instead of browser-based Web Speech API to provide consistent, high-quality voice synthesis across all devices and browsers, with sub-500ms cold start latency through state caching.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Angular Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Voice Module │  │MapLibre Maps │  │  News Module │      │
│  │ (Web Speech  │  │              │  │              │      │
│  │  Recognition)│  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────┐      │
│  │    Amplify Client Libraries (Geo, Auth, API)     │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AWS Amplify Gen 2                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Cognito    │  │ Lambda Func  │  │   Amazon     │     │
│  │  (Google     │  │     URLs     │  │  Location    │     │
│  │   OAuth)     │  │  (Streaming) │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────┐        │
│  │          Lambda Functions (SnapStart)           │        │
│  │  ┌──────────────────────────────────────┐     │        │
│  │  │   Voice Synthesis Service (Piper)    │     │        │
│  │  │   Runtime: Python 3.12               │     │        │
│  │  │   Layer: espeak-ng + Piper + ONNX    │     │        │
│  │  │   SnapStart: Enabled                 │     │        │
│  │  │   Response: Streaming                │     │        │
│  │  └──────────────────────────────────────┘     │        │
│  │  ┌──────────────────────────────────────┐     │        │
│  │  │   Agent Service (LlamaIndex Python)  │     │        │
│  │  │   - Workflow orchestration           │     │        │
│  │  │   - AWS Location Service tools       │     │        │
│  │  │   - Natural language processing      │     │        │
│  │  └──────────────────────────────────────┘     │        │
│  │  ┌──────────────┐  ┌──────────────┐           │        │
│  │  │Route Handler │  │ News Handler │           │        │
│  │  └──────────────┘  └──────────────┘           │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Google Drive │  │  News API    │                        │
│  │     API      │  │   Service    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Angular 17+ (latest version)
- TypeScript
- RxJS for reactive programming
- Angular Material for UI components
- MapLibre GL JS (for rendering Amazon Location Service maps)
- Web Speech API (SpeechRecognition only - for voice input)
- HTML5 Audio API (for playing streamed audio from Piper)

**Backend:**
- AWS Amplify Gen 2
- AWS Lambda with SnapStart (Python 3.12 runtime)
- LlamaIndex Python Workflows (for AI agent orchestration)
- Piper TTS (neural text-to-speech engine)
- Lambda Function URLs with Response Streaming
- AWS Cognito (with Google OAuth integration)
- Amazon Location Service (maps, geocoding, routing)
- Google Drive API (for user data storage)
- AWS Secrets Manager (for API keys)

**Lambda Layers:**
- Piper Voice Layer (espeak-ng, Piper binary, ONNX runtime, en_GB voice model)
- Compiled for Amazon Linux 2023 (x86_64)

**External APIs:**
- Amazon Location Service (SearchPlaceIndexForText, CalculateRoute)
- Google Drive API (for user data persistence)
- NewsAPI.org or similar news aggregation service

### SnapStart-Optimized Serverless Architecture

**Design Rationale**: Traditional Lambda cold starts with heavy dependencies like Piper TTS and ONNX models can take 3-5 seconds. AWS Lambda SnapStart solves this by caching the initialized function state, reducing cold starts to under 200ms.

#### Architecture Shift: Container to Zip-Based Deployment

**Previous Approach (Rejected)**:
- Docker container images with Piper bundled
- Cold start: 3-5 seconds (loading model on every cold start)
- No SnapStart support (SnapStart requires zip-based deployments)

**New Approach (SnapStart-Optimized)**:
- Zip-based Lambda deployment with Python 3.12 managed runtime
- Custom Lambda Layer containing pre-compiled Piper binaries
- SnapStart enabled on published versions
- Cold start: <200ms (state restored from snapshot)

#### Component Architecture

**1. Piper Voice Layer (The Heavy Lifter)**
- Custom Lambda Layer containing:
  - `espeak-ng`: Phoneme generation (compiled for Amazon Linux 2023)
  - `piper`: Neural TTS binary (standalone, x86_64)
  - `onnxruntime`: ML inference engine
  - Voice model: `en_GB` ONNX model for British English
- Layer structure:
  ```
  /opt/
    bin/
      piper
      espeak-ng
    lib/
      libespeak-ng.so
      (other shared libraries)
    model/
      en_GB-*.onnx
  ```
- Optimized for Amazon Linux 2023 architecture

**2. Voice Synthesis Lambda Function (The Brain)**
- **Runtime**: Python 3.12 (managed runtime, required for SnapStart)
- **Code**: Lightweight `handler.py` with streaming generator
- **Deployment**: Zip archive (not container image)
- **Configuration**:
  - Memory: 2048MB (maximizes CPU allocation for TTS)
  - SnapStart: `ON_PUBLISHED_VERSIONS`
  - Timeout: 30 seconds
  - Environment: Points to `/opt/bin/piper` for binary location
- **Function URL**: Configured with `InvokeMode: RESPONSE_STREAM`

**3. SnapStart Lifecycle**

```
┌─────────────────────────────────────────────────────────────┐
│ Deployment Phase (One-time per version)                     │
│  1. Upload zip + layer                                      │
│  2. Initialize Python runtime                               │
│  3. Load LlamaIndex dependencies                            │
│  4. Load Piper model into memory                            │
│  5. AWS freezes memory state to disk (snapshot)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Runtime Phase (Every invocation)                            │
│  1. Request arrives at Function URL                         │
│  2. AWS restores memory snapshot (<200ms)                   │
│  3. Handler executes immediately (model already loaded)     │
│  4. Generate audio chunks                                   │
│  5. Stream chunks via Response Streaming                    │
└─────────────────────────────────────────────────────────────┘
```

**4. Response Streaming Architecture**

Traditional Lambda responses buffer the entire response before returning. For audio generation, this adds latency. Lambda Response Streaming solves this:

- **Function URL** with `InvokeMode: RESPONSE_STREAM` bypasses API Gateway
- Audio chunks generated and streamed immediately
- Client receives first audio chunk within milliseconds
- No buffering delays
- Supports large responses (audio files can be several MB)

**Benefits**:
- **Performance**: Sub-500ms cold starts (vs 3-5s with containers)
- **Cost**: SnapStart is free; reduces compute time
- **Consistency**: Predictable latency for all requests
- **Scalability**: Fast warm-up enables better auto-scaling

**Trade-offs**:
- Requires zip-based deployment (no Docker containers)
- SnapStart only works with published versions (not `$LATEST`)
- Requires Python 3.12+ or Java 11+ (Node.js not yet supported)
- Layer must be compiled for Amazon Linux 2023

## Components and Interfaces

### Frontend Components

#### 1. Voice Input Component
**Responsibility:** Capture and process user voice input

**Interface:**
```typescript
interface VoiceInputComponent {
  startListening(): void;
  stopListening(): void;
  interruptListening(): void;
  onSpeechRecognized: EventEmitter<string>;
  onInterrupted: EventEmitter<void>;
  onError: EventEmitter<SpeechRecognitionError>;
  isListening: boolean;
  recognizedText: string;
}
```

**Key Methods:**
- `startListening()`: Activates Web Speech API SpeechRecognition
- `stopListening()`: Deactivates speech recognition
- `interruptListening()`: Handles interruptions during speech capture
- Emits recognized text to parent components
- Emits interruption events for proper state management

#### 2. Voice Output Service
**Responsibility:** Request audio synthesis from Piper TTS backend and play streamed audio

**Interface:**
```typescript
interface VoiceOutputService {
  speak(text: string, options?: SpeechOptions): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  interrupt(): void;
  onInterrupted: EventEmitter<void>;
  onAudioChunkReceived: EventEmitter<ArrayBuffer>;
  isSpeaking: boolean;
  isLoading: boolean;
}

interface SpeechOptions {
  voice?: string;           // Voice model identifier (e.g., 'en_GB')
  speed?: number;           // Speech rate (0.5 - 2.0)
  interruptible?: boolean;
}
```

**Key Methods:**
- `speak(text, options)`: Calls Voice Synthesis Lambda via Function URL, receives streamed audio
- `stop()`: Stops audio playback and cancels streaming
- `pause()`: Pauses current audio playback
- `resume()`: Resumes paused audio
- `interrupt()`: Immediately stops playback and clears queue
- Uses HTML5 Audio API or Web Audio API for playback
- Handles streaming audio chunks as they arrive

#### 3. Maps Component
**Responsibility:** Display interactive map with routes using MapLibre GL JS and Amazon Location Service

**Interface:**
```typescript
interface MapsComponent {
  initializeMap(center: LatLng): void;
  displayRoutes(routes: Route[]): void;
  highlightRoute(routeIndex: number): void;
  clearRoutes(): void;
  map: maplibregl.Map;
  selectedRoute: Route | null;
}

interface Route {
  id: string;
  summary: string;
  distance: Distance;
  duration: Duration;
  polyline: string;
  legs: RouteLeg[];
}
```

#### 4. Route List Component
**Responsibility:** Display route options with details

**Interface:**
```typescript
interface RouteListComponent {
  routes: Route[];
  selectedRouteId: string | null;
  onRouteSelected: EventEmitter<string>;
  displayRouteDetails(route: Route): void;
}
```

#### 5. News Component
**Responsibility:** Display news related to selected route

**Interface:**
```typescript
interface NewsComponent {
  newsItems: NewsItem[];
  loading: boolean;
  loadNews(route: Route): Promise<void>;
  displayNewsItem(item: NewsItem): void;
}

interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: Date;
  source: string;
  relevanceScore: number;
}
```

### Backend Services

#### 0. Voice Synthesis Service (Lambda Function with Piper TTS and SnapStart)
**Responsibility:** Generate high-quality speech audio from text using Piper TTS with streaming delivery

**Interface:**
```python
from typing import Iterator
from dataclasses import dataclass

@dataclass
class SynthesisRequest:
    text: str
    voice: str = "en_GB"
    speed: float = 1.0

class VoiceSynthesisHandler:
    def synthesize_speech(self, request: SynthesisRequest) -> Iterator[bytes]:
        """
        Generate audio from text and yield chunks for streaming.
        Uses Piper TTS from Lambda Layer at /opt/bin/piper.
        """
        pass
    
    def stream_handler(self, event: dict, response_stream) -> None:
        """
        Lambda Response Streaming handler.
        Receives request, generates audio chunks, writes to response_stream.
        """
        pass
```

**Implementation Details:**
- **Runtime**: Python 3.12 with SnapStart enabled
- **Dependencies**: Piper binaries from Lambda Layer (`/opt/bin/piper`)
- **Model**: Pre-loaded en_GB ONNX model from `/opt/model/`
- **Streaming**: Uses `awslambdaric` response streaming
- **Audio Format**: WAV or raw PCM, 22050 Hz, 16-bit
- **Chunk Size**: 4KB chunks for optimal streaming

**Function URL Configuration:**
- Endpoint: `https://<function-url>.lambda-url.<region>.on.aws/synthesize`
- Invoke Mode: `RESPONSE_STREAM`
- Auth: IAM (Cognito identity pool for authenticated users)
- CORS: Enabled for Angular frontend origin

**SnapStart Optimization:**
- Model loaded during initialization phase (before snapshot)
- Snapshot includes loaded ONNX model in memory
- Cold start: <200ms (model already loaded from snapshot)
- Warm start: <50ms

**API Endpoint:**
- `POST /synthesize` - Generate and stream audio from text

**Request Format:**
```json
{
  "text": "Turn left in 500 meters",
  "voice": "en_GB",
  "speed": 1.0
}
```

**Response Format:**
- Content-Type: `audio/wav` or `audio/pcm`
- Transfer-Encoding: `chunked`
- Streams audio bytes as they're generated

#### 1. Agent Service (Lambda Function with LlamaIndex Workflow)
**Responsibility:** Process natural language voice input and orchestrate AWS Location Service queries using LlamaIndex Python workflows

**Interface:**
```python
from typing import Dict, List, Optional
from dataclasses import dataclass
from llama_index.core.workflow import Workflow, Event

@dataclass
class ConversationContext:
    user_id: str
    session_id: str
    previous_queries: List[str]
    current_location: Optional[Dict[str, float]] = None

@dataclass
class AgentResponse:
    type: str  # 'location' | 'route' | 'clarification' | 'error'
    data: Dict
    natural_language_response: str
    confidence: float
    requires_clarification: bool
    clarification_options: Optional[List[str]] = None

@dataclass
class Intent:
    type: str  # 'find_location' | 'get_directions' | 'clarify' | 'unknown'
    entities: Dict
    confidence: float

@dataclass
class RoutePreferences:
    avoid_tolls: bool = False
    avoid_highways: bool = False
    mode: str = 'driving'  # 'driving' | 'walking' | 'cycling'

class AgentServiceHandler:
    def process_voice_input(
        self, 
        text: str, 
        context: ConversationContext
    ) -> AgentResponse:
        """Process voice text through LlamaIndex workflow"""
        pass
    
    def clarify_ambiguity(
        self, 
        text: str, 
        options: List[str]
    ) -> str:
        """Handle clarification requests"""
        pass

class LlamaIndexWorkflow(Workflow):
    """LlamaIndex Python Workflow for agent orchestration"""
    
    async def parse_intent(self, input_text: str) -> Intent:
        """Parse user intent from natural language"""
        pass
    
    async def execute_location_search(self, query: str) -> List[Dict]:
        """Call Amazon Location Service SearchPlaceIndexForText"""
        pass
    
    async def execute_route_calculation(
        self, 
        origin: Dict[str, float], 
        destination: Dict[str, float]
    ) -> List[Dict]:
        """Call Amazon Location Service CalculateRoute"""
        pass
    
    async def generate_response(self, data: Dict, intent: Intent) -> str:
        """Generate natural language response"""
        pass
```

**API Endpoints:**
- `POST /agent/process` - Process voice text through LlamaIndex workflow
- `POST /agent/clarify` - Handle clarification requests

**LlamaIndex Workflow Tools:**
- `searchLocation(query: string)`: Calls Amazon Location Service SearchPlaceIndexForText
- `calculateRoute(origin: LatLng, destination: LatLng, preferences: RoutePreferences)`: Calls Amazon Location Service CalculateRoute
- `disambiguateLocation(options: GeocodingResult[])`: Presents options to user for selection

#### 2. Route Service (Lambda Function)
**Responsibility:** Handle route requests and Amazon Location Service integration

**Interface:**
```typescript
interface RouteServiceHandler {
  geocodeDestination(destination: string): Promise<GeocodingResult>;
  getRoutes(origin: LatLng, destination: LatLng): Promise<Route[]>;
}

interface GeocodingResult {
  formattedAddress: string;
  location: LatLng;
  placeId: string;
  alternatives?: GeocodingResult[];
}

interface SearchRecord {
  destination: string;
  timestamp: Date;
  routes: Route[];
  selectedRoute?: Route;
}
```

**API Endpoints:**
- `POST /routes/geocode` - Convert destination text to coordinates (called by Agent Service)
- `POST /routes/directions` - Get route options between two points (called by Agent Service)

#### 3. News Service (Lambda Function)
**Responsibility:** Fetch and filter news related to route locations

**Interface:**
```typescript
interface NewsServiceHandler {
  fetchRouteNews(route: Route): Promise<NewsItem[]>;
  filterRelevantNews(articles: NewsArticle[], route: Route): NewsItem[];
  rankNewsByRelevance(news: NewsItem[]): NewsItem[];
}
```

**API Endpoints:**
- `POST /news/route` - Get news for a specific route
- `GET /news/location` - Get news for a specific location

#### 4. Google Drive Service (Angular Frontend Service)
**Responsibility:** Manage user preferences and session data via Google Drive API directly from the browser

**Interface:**
```typescript
interface GoogleDriveService {
  getUserPreferences(userId: string, userEmail: string): Promise<UserPreferences>;
  updateUserPreferences(userId: string, userEmail: string, prefs: UserPreferences): Promise<void>;
  getRecentSearches(userId: string): Promise<SearchHistoryRecord[]>;
  saveSearchHistory(userId: string, search: SearchHistoryRecord): Promise<void>;
}

interface UserPreferences {
  voiceEnabled: boolean;
  autoPlayAudio: boolean;
  preferredVoice: string;
  mapTheme: 'default' | 'dark' | 'light';
  newsCategories: string[];
}
```

**Implementation Details:**
- Runs entirely in the Angular frontend (no Lambda backend)
- Uses Google Drive REST API v3 directly via HttpClient
- Retrieves Google OAuth access token from Cognito session
- Creates and manages VoiceRoutePlanner folder in user's Google Drive
- Stores preferences.json and search-history.json files
- Implements exponential backoff retry logic for API errors
- Handles token refresh automatically through Cognito

## Data Models

### Google Drive Storage Structure

All user data is stored in the user's Google Drive in an application-specific folder with appropriate permissions requested during OAuth flow.

#### 1. User Preferences File (preferences.json)
```typescript
interface UserPreferencesFile {
  userId: string;              // Cognito User ID
  email: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}
```

#### 2. Search History File (search-history.json)
```typescript
interface SearchHistoryFile {
  userId: string;
  searches: SearchHistoryRecord[];
  maxRecords: number;          // Keep last 50 searches
}

interface SearchHistoryRecord {
  searchId: string;            // Unique identifier
  timestamp: string;           // ISO 8601
  destination: string;
  origin?: LatLng;
  selectedRoute?: Route;
}
```

#### 3. Google Drive Integration
```typescript
interface GoogleDriveConfig {
  appFolderName: string;       // "VoiceRoutePlanner"
  scopes: string[];            // ['drive.appdata', 'drive.file']
  fileTypes: {
    preferences: 'preferences.json',
    searchHistory: 'search-history.json'
  };
}
```

**Storage Benefits:**
- Zero database costs
- User owns their data
- Privacy-focused (data stays in user's Google Drive)
- Automatic backup via Google Drive
- Easy data portability

### Frontend Models

#### Location Models
```typescript
interface LatLng {
  lat: number;
  lng: number;
}

interface Distance {
  value: number;               // meters
  text: string;                // "5.2 km"
}

interface Duration {
  value: number;               // seconds
  text: string;                // "15 mins"
}
```

#### Route Models
```typescript
interface RouteLeg {
  startLocation: LatLng;
  endLocation: LatLng;
  startAddress: string;
  endAddress: string;
  distance: Distance;
  duration: Duration;
  steps: RouteStep[];
}

interface RouteStep {
  instruction: string;
  distance: Distance;
  duration: Duration;
  polyline: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Voice recognition produces displayable text
*For any* valid audio input containing speech, the voice recognition system should produce a non-empty string that is displayed to the user for confirmation.
**Validates: Requirements 1.2, 1.4**

### Property 2: Active listening shows visual feedback
*For any* active speech capture session, the interface should display real-time visual indicators showing the listening state.
**Validates: Requirements 1.3**

### Property 3: Speech recognition failure triggers retry prompt
*For any* speech recognition attempt that fails or produces unclear results, the system should prompt the user to repeat their input.
**Validates: Requirements 1.5**

### Property 3a: Voice input handles interruptions gracefully
*For any* active voice input session, if interrupted by the user or system, the voice interface should stop listening and emit an interruption event.
**Validates: Requirements 9.1**

### Property 3b: Voice output handles interruptions gracefully
*For any* active speech synthesis session, if interrupted by the user, the voice output should stop speaking immediately and emit an interruption event.
**Validates: Requirements 10.3**

### Property 4: Agent processes voice text through workflow
*For any* voice text input, the Agent Service should process it through the LlamaIndex workflow and return a structured response.
**Validates: Requirements 2.1**

### Property 5: Agent uses AWS Location Service tools
*For any* location or route query processed by the agent, the Agent Service should invoke AWS Location Service tools (searchLocation or calculateRoute) to retrieve data.
**Validates: Requirements 2.2**

### Property 6: Agent response includes natural language explanation
*For any* agent response containing location or route data, the response should include a natural language explanation suitable for voice output.
**Validates: Requirements 2.3**

### Property 7: Agent requests clarification for ambiguous input
*For any* ambiguous voice input that the agent cannot process with high confidence, the Agent Service should request clarification from the user through natural language.
**Validates: Requirements 2.4**

### Property 8: Agent response time under threshold
*For any* voice text processed by the agent, the Agent Service should return results within 5 seconds.
**Validates: Requirements 2.5**

### Property 9: Confirmed destination triggers API query
*For any* confirmed destination string, the system should query Amazon Location Service with that destination text.
**Validates: Requirements 3.1**

### Property 10: Valid API response returns parsed location data
*For any* valid Amazon Location Service API response, the geocoding service should parse and return at least one GeocodingResult with coordinates.
**Validates: Requirements 3.2**

### Property 11: Multiple location matches trigger disambiguation
*For any* destination query that returns more than one location result, the system should present all alternatives to the user for selection.
**Validates: Requirements 3.3**

### Property 12: Successfully identified location retrieves routes
*For any* successfully identified location, the system should retrieve available routes from the current location to that destination.
**Validates: Requirements 3.5**

### Property 13: Routes render as colored polylines on map
*For any* collection of routes, the map component should render all route paths as colored polylines on the MapLibre interface.
**Validates: Requirements 4.2**

### Property 14: Route display includes all required details
*For any* route displayed to the user, the interface should show distance, estimated travel time, and route description alongside the map.
**Validates: Requirements 4.3**

### Property 15: Route selection highlights on map
*For any* route selected by the user, the map component should highlight that route with a distinct color and increased line weight.
**Validates: Requirements 4.4**

### Property 16: Selected route triggers news query
*For any* route selected by the user, the news service should query news sources for articles related to locations along that route.
**Validates: Requirements 5.1**

### Property 17: News filtering returns only relevant articles
*For any* collection of retrieved news articles, the news service should filter to include only relevant traffic, weather, and incident reports.
**Validates: Requirements 5.2**

### Property 18: News items display with required information
*For any* news item displayed to the user, the interface should show the headline and summary.
**Validates: Requirements 5.3**

### Property 19: News items display in chronological order
*For any* collection of news items, they should be sorted by timestamp with most recent first.
**Validates: Requirements 5.4**

### Property 20: Text-to-speech synthesizes all content types
*For any* system text (route announcements, news headlines, route details), the voice output service should be capable of synthesizing it to speech.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 21: Active audio playback shows visual indicators
*For any* active speech synthesis session, the interface should display visual indicators showing audio output is playing.
**Validates: Requirements 6.5**

### Property 22: Authentication precedes data access
*For any* request to access user-specific data, the system should verify authentication before processing.
**Validates: Requirements 7.1**

### Property 23: User data persistence round-trip via Google Drive
*For any* user data (search history, route preferences, settings), if stored to Google Drive by an authenticated user, then retrieving that user's data from Google Drive should return the same information.
**Validates: Requirements 7.2, 7.3, 7.4**

### Property 24: Google Drive storage uses user's own account
*For any* user data storage operation, the system should store data in the user's own Google Drive account using their authenticated access token.
**Validates: Requirements 7.5**

### Property 25: User data encryption at rest and in transit
*For any* user data stored or transmitted, the system should encrypt it using industry-standard encryption protocols.
**Validates: Requirements 7.5**

### Property 26: Failed API calls trigger retry with exponential backoff
*For any* failed external API call, the system should retry with exponential backoff timing (1s, 2s, 4s, etc.) up to a maximum number of attempts.
**Validates: Requirements 8.1**

### Property 27: Maximum retry attempts respected
*For any* API call that fails repeatedly, the system should stop retrying after reaching the maximum retry attempts and display an error message.
**Validates: Requirements 8.2**

### Property 28: Network loss queues requests for retry
*For any* request made while network connectivity is unavailable, the system should queue it and retry when connectivity is restored.
**Validates: Requirements 8.3**

### Property 29: Invalid API data returns safe default
*For any* invalid data received from external APIs, the system should log the error and return a safe default response without crashing.
**Validates: Requirements 8.4**

### Property 30: Error logging protects sensitive information
*For any* error that occurs, the system should log error details for debugging while redacting or excluding sensitive user information.
**Validates: Requirements 8.5**

### Property 31: Voice processing latency under threshold
*For any* voice input, the system should begin processing within 500 milliseconds of speech completion.
**Validates: Requirements 9.1**

### Property 32: Route service response time under threshold
*For any* route request under normal conditions, the service should return results within 3 seconds.
**Validates: Requirements 9.2**

### Property 33: Initial interface load time under threshold
*For any* application load, the Angular frontend should display the initial interface within 2 seconds.
**Validates: Requirements 9.3**

### Property 34: View transitions render within threshold
*For any* view transition, the interface should complete rendering within 300 milliseconds.
**Validates: Requirements 9.4**

### Property 35: Concurrent requests handled without degradation
*For any* set of concurrent requests, the backend should process them while maintaining response times within specified thresholds.
**Validates: Requirements 9.5**

### Property 36: Manual stop button available during voice input
*For any* active voice input session, the system should provide a visible manual stop button.
**Validates: Requirements 10.1**

### Property 37: Text input available as fallback
*For any* user interaction requiring input, the system should provide text input as an alternative to voice input.
**Validates: Requirements 10.2**

### Property 38: Audio output can be paused or skipped
*For any* active audio output, the system should allow the user to pause or skip announcements.
**Validates: Requirements 10.3**

### Property 39: Voice preferences persist across sessions
*For any* voice preference setting changed by the user, the system should save it and restore the same setting in future sessions.
**Validates: Requirements 10.4**

### Property 40: Graceful degradation when voice unavailable
*For any* scenario where voice features are unavailable, the system should gracefully degrade to text-only interaction without losing core functionality.
**Validates: Requirements 10.5**

### Property 41: Voice Synthesis Service uses SnapStart
*For any* deployment of the Voice Synthesis Service, the Lambda function should be configured with SnapStart enabled on published versions.
**Validates: Requirements 11.1, 11.6**

### Property 42: Voice Synthesis cold start under threshold
*For any* cold start of the Voice Synthesis Service, the initialization latency should be consistently under 500 milliseconds.
**Validates: Requirements 11.1**

### Property 43: Voice Synthesis uses Python 3.12 runtime
*For any* Voice Synthesis Service deployment, the Lambda function should use Python 3.12 managed runtime (not container images).
**Validates: Requirements 11.2, 11.3**

### Property 44: Voice dependencies packaged as Lambda Layer
*For any* Voice Synthesis Service deployment, espeak-ng, Piper, and onnxruntime should be packaged as a Lambda Layer compatible with Amazon Linux 2023.
**Validates: Requirements 11.4**

### Property 45: Audio streaming delivers chunks immediately
*For any* audio generation request, the Voice Synthesis Service should stream audio chunks to the client immediately upon generation using Lambda Response Streaming.
**Validates: Requirements 6.6, 11.5**

### Property 46: Piper generates high-quality audio
*For any* text input to the Voice Synthesis Service, Piper should generate clear, natural-sounding speech audio.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Frontend Error Handling

**Voice Recognition Errors:**
- `no-speech`: Display "No speech detected, please try again"
- `audio-capture`: Display "Microphone access denied or unavailable"
- `not-allowed`: Request microphone permissions
- `network`: Display "Network error, check connection"

**API Errors:**
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Display "Access denied"
- 404 Not Found: Display "Resource not found"
- 429 Too Many Requests: Display "Please wait and try again"
- 500 Server Error: Display "Service temporarily unavailable"
- Network timeout: Retry with exponential backoff (1s, 2s, 4s)

**Amazon Location Service Errors:**
- Empty results: Display "No routes found for this destination"
- Throttling errors: Queue request and retry with exponential backoff
- Access denied: Log error and notify user of service issue
- Invalid request: Validate input and display specific error
- Service errors: Retry once, then display generic error

### Backend Error Handling

**Lambda Function Errors:**
- Wrap all external API calls in try-catch blocks
- Log errors to CloudWatch with context
- Return structured error responses with error codes
- Implement circuit breaker pattern for external services

**Google Drive API Errors:**
- `401 Unauthorized`: Refresh access token and retry
- `403 Forbidden`: Check permissions and scopes
- `404 Not Found`: Create file/folder if appropriate
- `429 Too Many Requests`: Implement exponential backoff
- `500 Server Error`: Retry with backoff

**External API Errors:**
- Implement retry logic with exponential backoff
- Set reasonable timeouts (5s for geocoding, 10s for directions)
- Cache successful responses to reduce API calls
- Provide fallback responses when possible

### Error Recovery Strategies

1. **Graceful Degradation:**
   - If voice recognition fails, automatically fall back to text input
   - If speech synthesis fails, display text responses only
   - If news service fails, continue with route display
   - If route caching fails, fetch directly from API
   - If Google Drive is unavailable, use local storage temporarily
   - Core functionality (route planning) remains available even when auxiliary features fail

2. **User Feedback:**
   - Display loading states during async operations
   - Show progress indicators for multi-step processes
   - Provide clear error messages with actionable steps
   - Notify users when falling back to alternative input methods
   - Display connection status indicators

3. **Logging and Monitoring:**
   - Log all errors to CloudWatch
   - Track error rates and patterns
   - Set up alarms for critical failures
   - Monitor API quota usage
   - Track graceful degradation events to identify systemic issues

## Testing Strategy

### Unit Testing

**Frontend Unit Tests (Jasmine/Karma):**
- Voice input component: Test microphone activation, speech recognition events
- Voice output service: Test speech synthesis, pause/resume functionality
- Maps component: Test map initialization, route rendering, selection handling
- Route list component: Test route display, selection events
- News component: Test news loading, display formatting
- Services: Test API calls with mocked HTTP responses

**Backend Unit Tests (pytest for Python services):**
- Voice Synthesis handler: Test Piper TTS invocation, audio streaming, error handling
- Agent handler: Test LlamaIndex workflow execution, intent parsing
- Route handler: Test geocoding logic, directions parsing
- News handler: Test news filtering, relevance ranking
- User handler: Test preference management, history retrieval
- Test with mocked AWS SDK calls and external API responses
- Test SnapStart initialization hooks

### Property-Based Testing

The application will use:
- **fast-check** for JavaScript/TypeScript property-based testing (frontend)
- **Hypothesis** for Python property-based testing (backend Lambda functions)

Each property test will run a minimum of 100 iterations.

**Property Test Examples:**

1. **Voice Recognition Property (fast-check):**
   - Generate random valid speech input strings
   - Verify all produce non-empty text output
   - Validates Property 1

2. **Voice Synthesis Property (Hypothesis):**
   - Generate random text strings (various lengths, characters)
   - Verify Piper generates valid audio output for all inputs
   - Verify audio chunks stream immediately
   - Validates Property 46, Property 45

3. **Geocoding Property (Hypothesis):**
   - Generate random valid location names
   - Verify all return at least one coordinate result
   - Validates Property 10

4. **Route Display Property (fast-check):**
   - Generate random route objects
   - Verify all display with required fields (distance, duration, description)
   - Validates Property 14

5. **News Sorting Property (fast-check):**
   - Generate random collections of news items with timestamps
   - Verify all are sorted chronologically
   - Validates Property 19

6. **Authentication Property (Hypothesis):**
   - Generate random authenticated and unauthenticated requests
   - Verify only authenticated requests access user data
   - Validates Property 22

7. **Retry Backoff Property (Hypothesis):**
   - Generate random API failure scenarios
   - Verify exponential backoff timing is correct
   - Validates Property 26

8. **SnapStart Cold Start Property (Hypothesis):**
   - Simulate cold starts with SnapStart enabled
   - Verify initialization latency is consistently under 500ms
   - Validates Property 42

### Integration Testing

**Frontend Integration Tests:**
- Test complete user flow: voice input → geocoding → route display → news
- Test authentication flow with Amplify
- Test Amazon Location Service integration via Amplify Geo
- Test MapLibre GL JS map rendering
- Test voice input/output coordination

**Backend Integration Tests:**
- Test Voice Synthesis Lambda with real Piper TTS (verify audio quality)
- Test SnapStart cold start performance (measure actual latency)
- Test Lambda Response Streaming (verify chunks arrive progressively)
- Test Agent Service Lambda with LlamaIndex Python workflows
- Test Amazon Location Service operations (geocoding, routing)
- Test Google Drive API integration from Angular frontend with test accounts
- Test authentication with Cognito and Google OAuth

### End-to-End Testing

**E2E Tests (Playwright or Cypress):**
- Complete user journey: login → voice destination → view routes → select route → view news
- Test error scenarios: invalid destination, network failure, API errors
- Test accessibility features
- Test responsive design on different screen sizes

**Manual Testing:**
- Voice recognition accuracy with different accents
- Speech synthesis quality and clarity
- Map interaction smoothness
- Overall user experience

### Test Configuration

- Unit tests: Run on every commit
- Integration tests: Run on pull requests
- E2E tests: Run nightly and before releases
- Property-based tests: Run with CI/CD pipeline
- Minimum code coverage target: 80%

## Security Considerations

### Authentication and Authorization
- Use AWS Cognito with Google OAuth 2.0 integration
- Request Google Drive API scopes during authentication (drive.appdata, drive.file)
- Implement JWT token validation on all API endpoints
- Store Google access tokens securely and refresh as needed
- Use IAM roles for Lambda function permissions
- Apply principle of least privilege

### API Key Management
- Store News API key and Google OAuth credentials in AWS Secrets Manager
- Amazon Location Service uses IAM-based authentication (no API keys needed)
- Rotate secrets periodically
- Monitor API usage for anomalies
- Handle Google access token refresh automatically

### Data Protection
- User data stored in their own Google Drive (user-controlled privacy)
- Use HTTPS/TLS 1.2+ for all communications (encryption in transit)
- Google Drive provides encryption at rest for all stored files
- Implement CORS policies on API Gateway
- Sanitize user inputs to prevent injection attacks
- Implement rate limiting to prevent abuse
- Never store Google access tokens in logs
- Use secure token storage in browser (httpOnly cookies or secure storage APIs)
- Encrypt sensitive data in Lambda memory when processing

### Privacy
- Store minimal user data
- All user data stored in user's own Google Drive
- User has full control over their data
- Implement data retention policies (keep last 50 searches)
- User can delete their data directly from Google Drive
- Comply with privacy regulations (GDPR, CCPA)
- Request only necessary Google Drive permissions

## Performance Optimization

### Performance Targets
The system must meet the following performance requirements:
- **Voice processing latency**: < 500ms from speech completion to processing start
- **Route service response**: < 3 seconds under normal conditions
- **Initial load time**: < 2 seconds to display initial interface
- **View transitions**: < 300ms for all view transitions
- **Concurrent request handling**: Maintain response times within thresholds under concurrent load

**Design Rationale**: These targets ensure a responsive user experience, particularly important for voice-driven interactions where delays are more noticeable and frustrating than in traditional UI interactions.

### Frontend Optimization
- Lazy load Angular modules to reduce initial bundle size
- Implement virtual scrolling for long lists (news, search history)
- Cache Amazon Location Service responses (5-minute TTL)
- Debounce voice input processing (300ms) to avoid excessive API calls
- Use Angular OnPush change detection strategy to minimize change detection cycles
- Optimize bundle size with tree shaking and code splitting
- Preload map tiles for common areas to reduce perceived latency
- Use service workers for offline capability and faster subsequent loads

### Backend Optimization
- **SnapStart for Voice Synthesis**: Enable SnapStart on Voice Synthesis Lambda to cache initialized state (Piper model loaded) for <200ms cold starts
- **SnapStart for Agent Service**: Enable SnapStart on Agent Service Lambda to cache LlamaIndex initialization
- **Lambda Response Streaming**: Use Function URLs with `RESPONSE_STREAM` for Voice Synthesis to deliver audio chunks immediately without buffering
- Implement in-memory route caching in Lambda (5-minute TTL) to reduce Amazon Location Service calls
- Use Lambda provisioned concurrency for route services if needed (agent and voice use SnapStart instead)
- Cache Amazon Location Service responses when appropriate
- Cache Google Drive file reads in Angular service memory during session
- Minimize Google Drive API calls by caching preferences and search history locally
- Set appropriate Lambda memory allocation:
  - Voice Synthesis: 2048MB (maximizes CPU for TTS)
  - Agent Service: 1024MB
  - Other services: 512MB
- Use Lambda layers for shared dependencies (Piper binaries, shared libraries)
- Publish new Lambda versions on every deploy to enable SnapStart (SnapStart doesn't work with `$LATEST`)

### Network Optimization
- Use CDN (CloudFront) for static assets
- Enable gzip/brotli compression for API responses
- Implement request batching where possible
- Use WebSocket for real-time updates (if needed in future)
- Minimize API calls with intelligent caching
- Use HTTP/2 for multiplexing requests
- Implement connection pooling for external API calls

## Deployment Strategy

### Piper Lambda Layer Build Process

**Critical Requirement**: Piper binaries must be compiled for Amazon Linux 2023 to ensure compatibility with Lambda runtime.

**Build Steps:**
1. **Launch Build Environment**:
   - Use EC2 instance or Docker container running `amazonlinux:2023`
   - Ensures binary compatibility with Lambda execution environment

2. **Compile espeak-ng**:
   - Build from source on AL2023
   - Ensures shared library compatibility
   - Install to `/opt/bin` and `/opt/lib`

3. **Package Piper**:
   - Download standalone Piper binary (x86_64)
   - Download en_GB ONNX voice model
   - Place in `/opt/bin/piper` and `/opt/model/`

4. **Create Layer Artifact**:
   - Bundle into `piper-layer.zip` with structure:
     ```
     /opt/
       bin/
         piper
         espeak-ng
       lib/
         libespeak-ng.so
         (other shared libraries)
       model/
         en_GB-*.onnx
     ```
   - Upload as Lambda Layer

5. **Version Management**:
   - Tag layer versions for reproducibility
   - Update Lambda function to reference latest layer version

### Infrastructure as Code
- Use AWS Amplify Gen 2 configuration files with AWS CDK
- Define all resources in TypeScript (infrastructure) and Python (Lambda handlers)
- Version control all infrastructure code
- Use separate environments (dev, staging, prod)
- **SnapStart Configuration**:
  - Set `snapStart: lambda.SnapStartConf.ON_PUBLISHED_VERSIONS` in CDK
  - Ensure new Lambda version published on every deploy
  - SnapStart requires versioned functions (not `$LATEST`)

### CI/CD Pipeline
- Automated testing on every commit (unit, property-based, integration)
- **Piper Layer Build**: Automated build of Lambda Layer in AL2023 container
- Automated deployment to dev environment
- **Lambda Versioning**: Publish new version on every deploy to enable SnapStart
- Manual approval for staging/prod deployments
- Rollback capability for failed deployments
- Blue-green deployment strategy for Lambda aliases
- **SnapStart Validation**: Automated tests to verify cold start latency <500ms

### Monitoring and Observability
- CloudWatch logs for all Lambda functions
- CloudWatch metrics for API Gateway
- X-Ray tracing for distributed requests
- Custom metrics for business KPIs
- Alerting for critical errors and performance degradation
