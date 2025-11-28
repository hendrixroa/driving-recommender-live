# Design Document

## Overview

The Voice Route Planner is a full-stack web application that combines voice interaction, AI-powered natural language processing, mapping services, and news aggregation to provide an intuitive route planning experience. The architecture leverages AWS Amplify Gen 2 for backend infrastructure, Angular (latest version) for the frontend, Amazon Location Service with MapLibre GL JS for mapping and routing, LlamaIndex TypeScript workflows for intelligent agent processing, and Web Speech API for voice capabilities.

The system follows a modern serverless architecture with clear separation between presentation (Angular), business logic (AWS Lambda functions with LlamaIndex workflow agents), and data persistence (Google Drive via Google OAuth). The application uses AWS Cognito for authentication with Google OAuth integration, API Gateway for RESTful endpoints, and integrates with Amazon Location Service for geocoding and routing through an intelligent LlamaIndex workflow agent that processes natural language queries, plus external news APIs through secure backend proxies.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Angular Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Voice Module │  │MapLibre Maps │  │  News Module │      │
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
│  │   Cognito    │  │ API Gateway  │  │   Amazon     │     │
│  │  (Google     │  │              │  │  Location    │     │
│  │   OAuth)     │  │              │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────┐        │
│  │          Lambda Functions                       │        │
│  │  ┌──────────────────────────────────────┐     │        │
│  │  │   Agent Service (LlamaIndex)         │     │        │
│  │  │   - Workflow orchestration           │     │        │
│  │  │   - AWS Location Service tools       │     │        │
│  │  │   - Natural language processing      │     │        │
│  │  └──────────────────────────────────────┘     │        │
│  │  ┌──────────────┐  ┌──────────────┐           │        │
│  │  │Route Handler │  │ News Handler │           │        │
│  │  │              │  │              │           │        │
│  │  │User Service  │  │(Google Drive)│           │        │
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
- Web Speech API (SpeechRecognition and SpeechSynthesis)

**Backend:**
- AWS Amplify Gen 2
- AWS Lambda (Node.js runtime)
- LlamaIndex TypeScript Workflows (for AI agent orchestration)
- Amazon API Gateway (REST API)
- AWS Cognito (with Google OAuth integration)
- Amazon Location Service (maps, geocoding, routing)
- Google Drive API (for user data storage)
- AWS Secrets Manager (for API keys)

**External APIs:**
- Amazon Location Service (SearchPlaceIndexForText, CalculateRoute)
- Google Drive API (for user data persistence)
- NewsAPI.org or similar news aggregation service

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
**Responsibility:** Convert text to speech for user feedback

**Interface:**
```typescript
interface VoiceOutputService {
  speak(text: string, options?: SpeechOptions): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  interrupt(): void;
  onInterrupted: EventEmitter<void>;
  isSpeaking: boolean;
}

interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
  interruptible?: boolean;
}
```

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

#### 1. Agent Service (Lambda Function with LlamaIndex Workflow)
**Responsibility:** Process natural language voice input and orchestrate AWS Location Service queries using LlamaIndex workflows

**Interface:**
```typescript
interface AgentServiceHandler {
  processVoiceInput(text: string, context: ConversationContext): Promise<AgentResponse>;
  clarifyAmbiguity(text: string, options: string[]): Promise<string>;
}

interface ConversationContext {
  userId: string;
  sessionId: string;
  previousQueries: string[];
  currentLocation?: LatLng;
}

interface AgentResponse {
  type: 'location' | 'route' | 'clarification' | 'error';
  data: any;
  naturalLanguageResponse: string;
  confidence: number;
  requiresClarification: boolean;
  clarificationOptions?: string[];
}

interface LlamaIndexWorkflow {
  // Workflow steps
  parseIntent(input: string): Promise<Intent>;
  executeLocationSearch(query: string): Promise<GeocodingResult[]>;
  executeRouteCalculation(origin: LatLng, destination: LatLng): Promise<Route[]>;
  generateResponse(data: any, intent: Intent): Promise<string>;
}

interface Intent {
  type: 'find_location' | 'get_directions' | 'clarify' | 'unknown';
  entities: {
    destination?: string;
    origin?: string;
    preferences?: RoutePreferences;
  };
  confidence: number;
}

interface RoutePreferences {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  mode?: 'driving' | 'walking' | 'cycling';
}
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

#### 4. User Service (Lambda Function)
**Responsibility:** Manage user preferences and session data via Google Drive

**Interface:**
```typescript
interface UserServiceHandler {
  getUserPreferences(userId: string, googleAccessToken: string): Promise<UserPreferences>;
  updateUserPreferences(userId: string, googleAccessToken: string, prefs: UserPreferences): Promise<void>;
  getRecentSearches(userId: string, googleAccessToken: string, limit: number): Promise<SearchRecord[]>;
  saveSearchHistory(userId: string, googleAccessToken: string, search: SearchRecord): Promise<void>;
}

interface UserPreferences {
  voiceEnabled: boolean;
  autoPlayAudio: boolean;
  preferredVoice: string;
  mapTheme: 'default' | 'dark' | 'light';
  newsCategories: string[];
}

interface GoogleDriveStorage {
  readUserData(accessToken: string, fileName: string): Promise<any>;
  writeUserData(accessToken: string, fileName: string, data: any): Promise<void>;
  ensureAppFolder(accessToken: string): Promise<string>;
}
```

**API Endpoints:**
- `GET /user/preferences` - Get user preferences from Google Drive
- `PUT /user/preferences` - Update user preferences in Google Drive
- `GET /user/searches` - Get recent searches from Google Drive
- `POST /user/searches` - Save search to Google Drive

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

### Property 25: Failed API calls trigger retry with exponential backoff
*For any* failed external API call, the system should retry with exponential backoff timing (1s, 2s, 4s, etc.) up to a maximum number of attempts.
**Validates: Requirements 8.1**

### Property 26: Network loss queues requests for retry
*For any* request made while network connectivity is unavailable, the system should queue it and retry when connectivity is restored.
**Validates: Requirements 8.3**

### Property 27: Invalid API data returns safe default
*For any* invalid data received from external APIs, the system should log the error and return a safe default response without crashing.
**Validates: Requirements 8.4**

### Property 28: Error logging protects sensitive information
*For any* error that occurs, the system should log error details for debugging while redacting or excluding sensitive user information.
**Validates: Requirements 8.5**

### Property 29: Voice processing latency under threshold
*For any* voice input, the system should begin processing within 500 milliseconds of speech completion.
**Validates: Requirements 9.1**

### Property 30: Route service response time under threshold
*For any* route request under normal conditions, the service should return results within 3 seconds.
**Validates: Requirements 9.2**

### Property 31: View transitions render within threshold
*For any* view transition, the interface should complete rendering within 300 milliseconds.
**Validates: Requirements 9.4**

### Property 32: Concurrent requests handled without degradation
*For any* set of concurrent requests, the backend should process them without performance degradation.
**Validates: Requirements 9.5**

### Property 33: Text input available as fallback
*For any* user interaction requiring input, the system should provide text input as an alternative to voice input.
**Validates: Requirements 10.2**

### Property 34: Voice preferences persist across sessions
*For any* voice preference setting changed by the user, the system should save it and restore the same setting in future sessions.
**Validates: Requirements 10.4**

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
   - If voice fails, fall back to text input
   - If news service fails, continue with route display
   - If route caching fails, fetch directly from API

2. **User Feedback:**
   - Display loading states during async operations
   - Show progress indicators for multi-step processes
   - Provide clear error messages with actionable steps

3. **Logging and Monitoring:**
   - Log all errors to CloudWatch
   - Track error rates and patterns
   - Set up alarms for critical failures
   - Monitor API quota usage

## Testing Strategy

### Unit Testing

**Frontend Unit Tests (Jasmine/Karma):**
- Voice input component: Test microphone activation, speech recognition events
- Voice output service: Test speech synthesis, pause/resume functionality
- Maps component: Test map initialization, route rendering, selection handling
- Route list component: Test route display, selection events
- News component: Test news loading, display formatting
- Services: Test API calls with mocked HTTP responses

**Backend Unit Tests (Jest):**
- Route handler: Test geocoding logic, directions parsing
- News handler: Test news filtering, relevance ranking
- User handler: Test preference management, history retrieval
- Test with mocked AWS SDK calls and external API responses

### Property-Based Testing

The application will use **fast-check** for JavaScript/TypeScript property-based testing. Each property test will run a minimum of 100 iterations.

**Property Test Examples:**

1. **Voice Recognition Property:**
   - Generate random valid speech input strings
   - Verify all produce non-empty text output
   - Validates Property 1

2. **Geocoding Property:**
   - Generate random valid location names
   - Verify all return at least one coordinate result
   - Validates Property 3

3. **Route Display Property:**
   - Generate random route objects
   - Verify all display with required fields (distance, duration, description)
   - Validates Property 7

4. **News Sorting Property:**
   - Generate random collections of news items with timestamps
   - Verify all are sorted chronologically
   - Validates Property 11

5. **Authentication Property:**
   - Generate random authenticated and unauthenticated requests
   - Verify only authenticated requests access user data
   - Validates Property 13

6. **Retry Backoff Property:**
   - Generate random API failure scenarios
   - Verify exponential backoff timing is correct
   - Validates Property 16

### Integration Testing

**Frontend Integration Tests:**
- Test complete user flow: voice input → geocoding → route display → news
- Test authentication flow with Amplify
- Test Amazon Location Service integration via Amplify Geo
- Test MapLibre GL JS map rendering
- Test voice input/output coordination

**Backend Integration Tests:**
- Test Lambda functions with real AWS services (using test environment)
- Test Amazon Location Service operations (geocoding, routing)
- Test Google Drive API integration with test accounts
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
- Use HTTPS for all communications
- Implement CORS policies on API Gateway
- Sanitize user inputs to prevent injection attacks
- Implement rate limiting to prevent abuse
- Never store Google access tokens in logs

### Privacy
- Store minimal user data
- All user data stored in user's own Google Drive
- User has full control over their data
- Implement data retention policies (keep last 50 searches)
- User can delete their data directly from Google Drive
- Comply with privacy regulations (GDPR, CCPA)
- Request only necessary Google Drive permissions

## Performance Optimization

### Frontend Optimization
- Lazy load Angular modules
- Implement virtual scrolling for long lists
- Cache Amazon Location Service responses
- Debounce voice input processing
- Use Angular OnPush change detection strategy
- Optimize bundle size with tree shaking
- Preload map tiles for common areas

### Backend Optimization
- Implement in-memory route caching in Lambda (with TTL)
- Use Lambda provisioned concurrency for critical functions
- Cache Amazon Location Service responses when appropriate
- Cache Google Drive file reads when appropriate
- Batch Google Drive operations where possible
- Implement API response caching

### Network Optimization
- Use CDN for static assets
- Compress API responses
- Implement request batching
- Use WebSocket for real-time updates (if needed)
- Minimize API calls with intelligent caching

## Deployment Strategy

### Infrastructure as Code
- Use AWS Amplify Gen 2 configuration files
- Define all resources in TypeScript
- Version control all infrastructure code
- Use separate environments (dev, staging, prod)

### CI/CD Pipeline
- Automated testing on every commit
- Automated deployment to dev environment
- Manual approval for staging/prod deployments
- Rollback capability for failed deployments
- Blue-green deployment strategy

### Monitoring and Observability
- CloudWatch logs for all Lambda functions
- CloudWatch metrics for API Gateway
- X-Ray tracing for distributed requests
- Custom metrics for business KPIs
- Alerting for critical errors and performance degradation
