# Implementation Plan

- [x] 1. Set up Voice Route Planner infrastructure in existing project, and adapt the current setup to meet requirements
  - Eliminate dynamodb integration since all data will be managed in google drive
  - Create new Angular feature module for Voice Route Planner in src/app/voice-route-planner
  - Add AWS Amplify Gen 2 Geo resource using defineGeo() in amplify/geo/resource.ts
  - Configure Amazon Location Service map with Esri navigation style
  - Configure Amazon Location Service place index for geocoding and search
  - Update amplify/auth/resource.ts to add Google OAuth 2.0 as external provider
  - Configure Google Drive API scopes in OAuth settings (drive.appdata, drive.file)
  - Create amplify/stacks/voiceRoutePlannerStack for Lambda functions and Secrets Manager
  - Add News API key to AWS Secrets Manager via CDK stack
  - Add Google OAuth credentials to AWS Secrets Manager via CDK stack
  - Update amplify/backend.ts to include geo resource and voice route planner stack
  - Configure geo permissions in IAM for authenticated users
  - _Requirements: 6.1, 6.5_

- [x] 2. Implement Google Drive storage service (Frontend Implementation)
- [x] 2.1 Google Drive integration implemented in Angular frontend
  - Google Drive integration implemented directly in Angular frontend service (google-drive.service.ts)
  - Uses Google OAuth access token from Cognito for authentication
  - Implements read/write methods for preferences.json and search-history.json
  - Creates and manages VoiceRoutePlanner folder in user's Google Drive
  - No Lambda backend needed - all operations handled client-side
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 2.2 Property test for Google Drive round-trip (Implemented in frontend service)
  - **Property 23: User data persistence round-trip via Google Drive**
  - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 2.3 User preferences management (Implemented in frontend service)
  - Implements preferences.json file structure (voiceEnabled, autoPlayAudio, mapTheme, newsCategories)
  - getUserPreferences method retrieves preferences from Google Drive
  - updateUserPreferences method saves preferences to Google Drive
  - Default preferences initialization on first access
  - _Requirements: 6.2, 9.4_

- [x] 2.4 Search history management (Implemented in frontend service)
  - Implements search-history.json file structure with searchId, timestamp, destination, selectedRoute
  - getRecentSearches method retrieves search history from Google Drive
  - saveSearchHistory method saves searches to Google Drive
  - Max records limit (keep last 50 searches) enforced
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 2.5 Unit tests for Google Drive service (To be implemented with frontend testing)
  - Test file read/write operations with mocked Google Drive API
  - Test error handling and retry logic
  - Test access token retrieval from Cognito
  - _Requirements: 6.2, 6.3, 6.4_

- [-] 3. Implement authentication with Google OAuth
- [x] 3.1 Configure Cognito with Google OAuth provider
  - Update amplify/auth/resource.ts with Google external provider configuration
  - Configure OAuth scopes: openid, profile, email, drive.appdata, drive.file
  - Set up redirect URLs for OAuth callback
  - Configure token exchange and validation
  - _Requirements: 6.1_

- [ ] 3.2 Write property test for authentication
  - **Property 17: Authentication precedes data access**
  - **Validates: Requirements 6.1**

- [x] 3.3 Create Angular auth service for Voice Route Planner
  - Implement signInWithGoogle() method using Amplify Auth
  - Implement getGoogleAccessToken() to retrieve OAuth token for Google Drive API
  - Implement token refresh logic
  - Handle authentication state changes
  - _Requirements: 6.1_

- [x] 3.4 Write unit tests for auth service
  - Test Google OAuth sign-in flow
  - Test token retrieval and refresh
  - Test authentication state management
  - _Requirements: 7.1_

- [ ] 4. Implement LlamaIndex workflow agent service
- [x] 4.1 Set up LlamaIndex TypeScript workflow infrastructure
  - Create amplify/stacks/voiceRoutePlannerStack/agent-lambda directory
  - Install LlamaIndex TypeScript SDK (@llamaindex/core, @llamaindex/workflows)
  - Create workflow configuration and initialization
  - Set up workflow context management for conversation history
  - _Requirements: 2.1_

- [x] 4.2 Implement intent parsing workflow step
  - Create parseIntent workflow step to analyze user input
  - Extract entities (destination, origin, preferences) from natural language
  - Classify intent type (find_location, get_directions, clarify, unknown)
  - Calculate confidence score for intent classification
  - _Requirements: 2.1, 2.4_

- [x] 4.3 Implement AWS Location Service tools for workflow
  - Create searchLocation tool that calls Amazon Location Service SearchPlaceIndexForText
  - Create calculateRoute tool that calls Amazon Location Service CalculateRoute
  - Create disambiguateLocation tool for presenting multiple options
  - Register tools with LlamaIndex workflow
  - _Requirements: 2.2_

- [ ] 4.4 Write property test for agent workflow processing
  - **Property 4: Agent processes voice text through workflow**
  - **Validates: Requirements 2.1**

- [ ] 4.5 Write property test for AWS Location Service tool usage
  - **Property 5: Agent uses AWS Location Service tools**
  - **Validates: Requirements 2.2**

- [ ] 4.6 Implement natural language response generation
  - Create generateResponse workflow step
  - Format location and route data into natural language
  - Generate user-friendly explanations suitable for voice output
  - Handle different response types (success, error, clarification)
  - _Requirements: 2.3_

- [ ] 4.7 Write property test for natural language responses
  - **Property 6: Agent response includes natural language explanation**
  - **Validates: Requirements 2.3**

- [ ] 4.8 Implement ambiguity detection and clarification
  - Detect low-confidence intents (confidence < 0.7)
  - Generate clarification questions in natural language
  - Handle multiple location matches with disambiguation
  - Return clarification options to user
  - _Requirements: 2.4_

- [ ] 4.9 Write property test for clarification requests
  - **Property 7: Agent requests clarification for ambiguous input**
  - **Validates: Requirements 2.4**

- [ ] 4.10 Create agent service Lambda handler and API endpoint
  - Implement POST /agent/process endpoint
  - Implement POST /agent/clarify endpoint
  - Wire workflow execution to Lambda handler
  - Handle workflow errors and timeouts
  - Return structured AgentResponse with natural language
  - _Requirements: 2.1, 2.3_

- [ ] 4.11 Optimize agent response time
  - Implement workflow caching for repeated queries
  - Optimize tool execution with parallel calls where possible
  - Set workflow timeout to 5 seconds
  - Monitor and log workflow execution times
  - _Requirements: 2.5_

- [ ] 4.12 Write property test for agent response time
  - **Property 8: Agent response time under threshold**
  - **Validates: Requirements 2.5**

- [ ] 4.13 Write unit tests for agent service
  - Test intent parsing with various natural language inputs
  - Test tool execution with mocked AWS Location Service
  - Test response generation for different scenarios
  - Test clarification flow with ambiguous inputs
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Implement route service with Amazon Location Service
- [ ] 5.1 Create route service Lambda function
  - Create amplify/stacks/voiceRoutePlannerStack/route-lambda directory
  - Implement geocoding endpoint (POST /routes/geocode) using Amazon Location Service SearchPlaceIndexForText
  - Implement directions endpoint (POST /routes/directions) using Amazon Location Service CalculateRoute
  - Parse Amazon Location Service responses for coordinates and route data
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 5.2 Implement geocoding logic with disambiguation
  - Parse SearchPlaceIndexForText results from Amazon Location Service
  - Handle multiple location matches (return all results with relevance scores)
  - Return alternatives for user selection with formatted addresses
  - Handle ZERO_RESULTS case
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 5.3 Write property test for geocoding
  - **Property 10: Valid API response returns parsed location data**
  - **Validates: Requirements 3.2**

- [ ] 5.4 Write property test for disambiguation
  - **Property 11: Multiple location matches trigger disambiguation**
  - **Validates: Requirements 3.3**

- [ ] 5.5 Implement route retrieval logic
  - Use Amazon Location Service CalculateRoute API
  - Parse route response for distance, duration, and geometry
  - Extract route legs and steps
  - Handle multiple route options (if available)
  - Convert route geometry to GeoJSON for MapLibre rendering
  - _Requirements: 3.5, 4.3_

- [ ] 5.6 Write property test for route retrieval
  - **Property 12: Successfully identified location retrieves routes**
  - **Validates: Requirements 3.5**

- [ ] 5.7 Implement error handling for route service
  - Handle ZERO_RESULTS from Amazon Location Service
  - Handle throttling and quota limits
  - Implement retry logic with exponential backoff
  - Return user-friendly error messages
  - _Requirements: 8.1, 8.4_

- [ ] 5.8 Write property test for API retry logic
  - **Property 25: Failed API calls trigger retry with exponential backoff**
  - **Validates: Requirements 8.1**

- [ ] 5.9 Write unit tests for route service
  - Test geocoding with valid destinations
  - Test error handling for invalid destinations
  - Test route parsing and GeoJSON conversion
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 6. Implement news service
- [ ] 6.1 Create news service Lambda function
  - Create amplify/stacks/voiceRoutePlannerStack/news-lambda directory
  - Implement news endpoint (POST /news/route)
  - Integrate with News API using API key from Secrets Manager
  - Extract location names from route legs for news queries
  - _Requirements: 5.1_

- [ ] 6.2 Implement news filtering and ranking
  - Filter for traffic, weather, and incident-related keywords
  - Rank news by relevance to route locations
  - Sort by timestamp (most recent first)
  - Limit results to top 10 most relevant articles
  - _Requirements: 5.2, 5.4_

- [ ] 6.3 Write property test for news filtering
  - **Property 17: News filtering returns only relevant articles**
  - **Validates: Requirements 5.2**

- [ ] 6.4 Write property test for news sorting
  - **Property 19: News items display in chronological order**
  - **Validates: Requirements 5.4**

- [ ] 6.5 Write unit tests for news service
  - Test news retrieval for routes
  - Test filtering logic with various keywords
  - Test ranking algorithm
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 6.6 Implement Piper TTS voice synthesis service with Lambda streaming
- [x] 6.6.1 Set up Piper TTS Lambda infrastructure
  - Create amplify/stacks/voiceRoutePlannerStack/piper-lambda directory for Python Lambda
  - Configure Lambda function with Python 3.12 runtime for SnapStart compatibility
  - Set up Lambda Function URL with InvokeMode: RESPONSE_STREAM
  - Configure Lambda memory to 2048MB for optimal TTS performance
  - Set Lambda timeout to 30 seconds
  - Enable SnapStart on published versions
  - _Requirements: 11.1, 11.2, 11.3, 11.6_

- [ ] 6.6.2 Build Piper Lambda Layer for Amazon Linux 2023
  - Create build script for compiling espeak-ng on Amazon Linux 2023
  - Download and package Piper standalone binary (x86_64)
  - Download en_GB ONNX voice model for British English
  - Package onnxruntime dependencies
  - Create Lambda Layer with structure: /opt/bin/, /opt/lib/, /opt/model/
  - Test layer compatibility with Amazon Linux 2023
  - _Requirements: 11.4_

- [x] 6.6.3 Implement Piper TTS Lambda handler with streaming
  - Create handler.py with Lambda Response Streaming support
  - Implement synthesize_speech() function using Piper from /opt/bin/piper
  - Load ONNX model from /opt/model/ during initialization (before SnapStart snapshot)
  - Generate audio chunks (4KB) and stream via awslambdaric
  - Set audio format to WAV or raw PCM, 22050 Hz, 16-bit
  - Handle text input, voice selection, and speed parameters
  - _Requirements: 6.1, 11.5_

- [x] 6.6.4 Configure Lambda Function URL and CORS
  - Set up Function URL endpoint for Piper Lambda
  - Configure CORS to allow Angular frontend origin
  - Set up IAM authentication using Cognito identity pool
  - Test streaming response from Function URL
  - _Requirements: 11.5_

- [x] 6.6.5 Update Angular voice output service for Piper integration
  - Modify voice-output.service.ts to call Piper Lambda Function URL
  - Implement streaming audio playback using HTML5 Audio API or Web Audio API
  - Handle audio chunk reception and buffering
  - Replace Web Speech API synthesis with Piper TTS
  - Maintain backward compatibility with pause/resume/interrupt methods
  - _Requirements: 6.1, 6.6_

- [ ] 6.6.6 Write property test for Piper audio generation
  - **Property 46: Piper generates high-quality audio**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 6.6.7 Write property test for audio streaming
  - **Property 45: Audio streaming delivers chunks immediately**
  - **Validates: Requirements 6.6, 11.5**

- [ ] 6.6.8 Write property test for SnapStart cold start performance
  - **Property 42: Voice Synthesis cold start under threshold**
  - **Validates: Requirements 11.1**

- [ ] 6.6.9 Write unit tests for Piper Lambda
  - Test audio generation with various text inputs
  - Test streaming chunk delivery
  - Test error handling for invalid inputs
  - Test SnapStart initialization
  - _Requirements: 6.1, 11.1, 11.5_

- [ ] 7. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Set up Angular frontend structure for Voice Route Planner
  - Create voice-route-planner feature module with routing
  - Create shared services directory (voice-input, voice-output, agent, route, news, user-preferences)
  - Create components directory (map, route-list, news, voice-controls, settings, search-history)
  - Set up lazy loading for voice-route-planner module
  - Configure Amplify in Angular app (Amplify.configure with geo, auth, API)
  - Install Angular Material for UI components
  - Set up RxJS for reactive state management
  - _Requirements: 1.1, 4.1_

- [ ] 9. Implement voice input component
- [x] 9.1 Create voice input component with Web Speech API
  - Create voice-input.component.ts in voice-route-planner/components
  - Implement SpeechRecognition integration (webkitSpeechRecognition for browser compatibility)
  - Create startListening() method to activate microphone
  - Create stopListening() method to deactivate microphone
  - Create interruptListening() method for user interruptions
  - Display recognized text in real-time using Angular template binding
  - Emit recognized text via EventEmitter for parent component
  - _Requirements: 1.2, 1.4_

- [x] 9.2 Add visual feedback for voice input
  - Display animated listening indicator (pulsing microphone icon) when active
  - Show recognized text in confirmation box
  - Add manual stop button with clear styling
  - Add microphone permission request UI
  - _Requirements: 1.1, 1.3, 10.1_

- [ ] 9.3 Write property test for voice recognition
  - **Property 1: Voice recognition produces displayable text**
  - **Validates: Requirements 1.2, 1.4**

- [ ] 9.4 Write property test for listening feedback
  - **Property 2: Active listening shows visual feedback**
  - **Validates: Requirements 1.3**

- [ ] 9.5 Implement error handling for voice input
  - Handle no-speech error (display "No speech detected, please try again")
  - Handle audio-capture error (display "Microphone unavailable")
  - Handle permission denied (prompt user to enable microphone)
  - Handle network error (display "Network error, check connection")
  - Prompt user to repeat on any failure
  - _Requirements: 1.5_

- [ ] 9.6 Write property test for voice error handling
  - **Property 3: Speech recognition failure triggers retry prompt**
  - **Validates: Requirements 1.5**

- [ ] 9.7 Implement voice interruption handling
  - Handle user interruptions during listening (stop button click)
  - Emit interruption events via EventEmitter
  - Clean up SpeechRecognition resources properly
  - Reset UI state on interruption
  - _Requirements: 10.1_

- [ ] 9.8 Write property test for voice input interruption
  - **Property 3a: Voice input handles interruptions gracefully**
  - **Validates: Requirements 10.1**

- [ ] 9.9 Write unit tests for voice input component
  - Test microphone activation and deactivation
  - Test speech recognition event handling
  - Test error scenarios with mocked SpeechRecognition
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 10. Implement voice output service
- [ ] 10.1 Create voice output service with Web Speech API
  - Create voice-output.service.ts in voice-route-planner/services
  - Implement SpeechSynthesis integration
  - Create speak(text: string, options?: SpeechOptions) method
  - Create stop(), pause(), resume() methods
  - Create interrupt() method for user interruptions
  - Manage speech queue for multiple announcements
  - _Requirements: 6.1_

- [ ] 10.2 Add visual feedback for voice output
  - Display speaking indicator (animated speaker icon) when active
  - Show current text being spoken in UI
  - Add pause/skip controls with Material Design buttons
  - Update UI state based on speech synthesis events
  - _Requirements: 6.5, 10.3_

- [ ] 10.3 Write property test for text-to-speech
  - **Property 20: Text-to-speech synthesizes all content types**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 10.4 Write property test for audio feedback
  - **Property 21: Active audio playback shows visual indicators**
  - **Validates: Requirements 6.5**

- [ ] 10.5 Implement voice output interruption handling
  - Handle user interruptions during speech (skip button)
  - Emit interruption events via Observable
  - Clean up SpeechSynthesis resources
  - Clear speech queue on interruption
  - _Requirements: 10.3_

- [ ] 10.6 Write property test for voice output interruption
  - **Property 3b: Voice output handles interruptions gracefully**
  - **Validates: Requirements 10.3**

- [ ] 10.7 Write unit tests for voice output service
  - Test speech synthesis with various text inputs
  - Test pause/resume functionality
  - Test interruption handling
  - _Requirements: 6.1, 6.5, 10.3_

- [ ] 11. Implement text input fallback
- [ ] 11.1 Create text input component
  - Create text-input.component.ts with Material Design input field
  - Add text input field for destination entry
  - Wire to same agent service as voice input
  - Provide toggle button between voice and text modes
  - Sync input state between voice and text
  - _Requirements: 10.2_

- [ ] 11.2 Write property test for text fallback
  - **Property 33: Text input available as fallback**
  - **Validates: Requirements 10.2**

- [ ] 11.3 Write unit tests for text input
  - Test text input submission
  - Test toggle between voice and text modes
  - _Requirements: 10.2_

- [ ] 12. Implement map component with Amazon Location Service
- [x] 12.1 Create map component with MapLibre GL JS
  - Create map.component.ts in voice-route-planner/components
  - Initialize MapLibre GL JS map using Amplify Geo
  - Use amplifyMapLibreRequest for authenticated map tile requests
  - Set up map container with responsive sizing
  - Configure map options (zoom, center, navigation controls)
  - Load Esri navigation map style from Amazon Location Service
  - _Requirements: 4.1_

- [ ] 12.2 Implement route display on map
  - Render routes as GeoJSON LineString layers with distinct colors
  - Display all route options simultaneously with different colors
  - Add markers for origin and destination using MapLibre markers
  - Add route labels showing distance and duration
  - _Requirements: 4.2_

- [ ] 12.3 Write property test for route rendering
  - **Property 13: Routes render as colored polylines on map**
  - **Validates: Requirements 4.2**

- [ ] 12.4 Implement route selection and highlighting
  - Handle route click events on map
  - Highlight selected route with increased line width and brighter color
  - Dim non-selected routes
  - Emit route selection events to parent component
  - _Requirements: 4.4_

- [ ] 12.5 Write property test for route highlighting
  - **Property 15: Route selection highlights on map**
  - **Validates: Requirements 4.4**

- [ ] 12.6 Enable map interactions
  - Enable zoom controls (MapLibre NavigationControl)
  - Enable pan/drag functionality (default MapLibre behavior)
  - Enable marker interactions (click to show info)
  - Add geolocation control for current location
  - _Requirements: 4.5_

- [ ] 12.7 Write unit tests for map component
  - Test map initialization with Amplify Geo
  - Test route rendering as GeoJSON layers
  - Test selection handling
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ] 13. Implement route list component
- [ ] 13.1 Create route list component
  - Create route-list.component.ts with Material Design list
  - Display all route options in a scrollable list
  - Show distance, duration, and description for each route
  - Handle route selection events (click on list item)
  - Sync selection with map component via shared service
  - Highlight selected route in list
  - _Requirements: 4.3_

- [ ] 13.2 Write property test for route details display
  - **Property 14: Route display includes all required details**
  - **Validates: Requirements 4.3**

- [ ] 13.3 Write unit tests for route list
  - Test route display with various route data
  - Test selection events and synchronization
  - _Requirements: 4.3_

- [ ] 14. Implement news component
- [ ] 14.1 Create news component
  - Create news.component.ts with Material Design cards
  - Display news items with headlines, summaries, and timestamps
  - Show loading spinner while fetching news
  - Handle empty news state with friendly message
  - Add "Read more" links to full articles
  - _Requirements: 5.3, 5.5_

- [ ] 14.2 Integrate news component with route selection
  - Subscribe to route selection events from shared service
  - Trigger news fetch when route is selected
  - Pass route location data to news service API
  - Display news relevant to selected route
  - Handle news fetch errors gracefully
  - _Requirements: 5.1_

- [ ] 14.3 Write property test for news query trigger
  - **Property 16: Selected route triggers news query**
  - **Validates: Requirements 5.1**

- [ ] 14.4 Write property test for news display
  - **Property 18: News items display with required information**
  - **Validates: Requirements 5.3**

- [ ] 14.5 Write unit tests for news component
  - Test news loading state
  - Test display formatting
  - Test empty state handling
  - _Requirements: 5.1, 5.3, 5.5_

- [ ] 15. Implement main application flow with agent integration
- [ ] 15.1 Create main voice route planner component and orchestration
  - Create voice-route-planner.component.ts as main container
  - Wire voice input component to agent service (process voice text)
  - Handle agent responses (locations, routes, clarifications)
  - Display agent natural language responses via voice output
  - Link route selection to news service
  - Coordinate voice announcements for route and news updates
  - Manage application state with RxJS BehaviorSubjects
  - _Requirements: 1.2, 2.1, 2.3, 5.1, 6.2_

- [ ] 15.2 Write property test for agent query trigger
  - **Property 9: Confirmed destination triggers API query**
  - **Validates: Requirements 3.1**

- [ ] 15.3 Implement error handling and user notifications
  - Display user-friendly error messages using Material Snackbar
  - Handle network connectivity loss with retry mechanism
  - Queue requests for retry when offline
  - Show connection status indicator
  - _Requirements: 8.2, 8.3_

- [ ] 15.4 Write property test for network loss handling
  - **Property 26: Network loss queues requests for retry**
  - **Validates: Requirements 8.3**

- [ ] 15.5 Implement graceful degradation
  - Fall back to text input if voice recognition fails
  - Continue with route display if news service fails
  - Show partial results when some services are unavailable
  - _Requirements: 10.2, 10.5_

- [ ] 15.6 Write property test for invalid data handling
  - **Property 27: Invalid API data returns safe default**
  - **Validates: Requirements 8.4**

- [ ] 15.7 Write integration tests for main flow
  - Test complete user journey (voice → agent → routes → news)
  - Test agent clarification flow
  - Test error scenarios with mocked services
  - _Requirements: 1.2, 2.1, 2.4, 3.5, 5.1_

- [ ] 16. Implement user preferences and settings
- [ ] 16.1 Create settings component
  - Create settings.component.ts with Material Design form
  - Display user preferences form (voice enabled, auto-play audio, map theme)
  - Add toggle switches for voice and audio preferences
  - Add dropdown for map theme selection (light/dark)
  - Add save button to persist preferences
  - _Requirements: 10.4_

- [ ] 16.2 Integrate preferences with backend
  - Load preferences from Google Drive on app initialization
  - Save preferences to Google Drive via user service API
  - Apply preferences to voice input/output components
  - Apply map theme to MapLibre map
  - Cache preferences locally for offline access
  - _Requirements: 7.2, 10.4_

- [ ] 16.3 Write property test for preference persistence
  - **Property 34: Voice preferences persist across sessions**
  - **Validates: Requirements 10.4**

- [ ] 16.4 Write unit tests for settings
  - Test preference loading from API
  - Test preference saving to API
  - Test preference application to components
  - _Requirements: 7.2, 10.4_

- [ ] 17. Implement search history feature
- [ ] 17.1 Create search history component
  - Create search-history.component.ts with Material Design list
  - Display recent searches with destination and timestamp
  - Allow selection of previous search to reload route
  - Show formatted timestamps (e.g., "2 hours ago")
  - Add clear history button
  - _Requirements: 7.4_

- [ ] 17.2 Integrate search history with backend
  - Load recent searches from Google Drive on app initialization
  - Save searches after route selection via user service API
  - Limit to last 50 searches (enforce in Lambda)
  - Handle search selection to trigger route reload
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 17.3 Write unit tests for search history
  - Test history display with various search data
  - Test search selection and route reload
  - Test history saving after route selection
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 18. Implement performance optimizations
- [ ] 18.1 Optimize voice processing latency
  - Minimize processing delay after speech recognition
  - Implement debouncing for voice input (300ms)
  - Use Web Workers for heavy processing if needed
  - Target <500ms processing time
  - _Requirements: 9.1_

- [ ] 18.2 Write property test for voice latency
  - **Property 29: Voice processing latency under threshold**
  - **Validates: Requirements 9.1**

- [ ] 18.3 Optimize route service response time
  - Implement Lambda response caching with TTL (5 minutes)
  - Optimize Amazon Location Service API calls
  - Use Lambda provisioned concurrency for route Lambda
  - Target <3s response time
  - _Requirements: 9.2_

- [ ] 18.4 Write property test for route response time
  - **Property 30: Route service response time under threshold**
  - **Validates: Requirements 9.2**

- [ ] 18.5 Optimize frontend rendering
  - Implement lazy loading for voice-route-planner module
  - Use OnPush change detection strategy in all components
  - Optimize bundle size with tree shaking
  - Preload map tiles for common areas
  - Target <300ms view transitions
  - _Requirements: 9.4_

- [ ] 18.6 Write property test for view transitions
  - **Property 31: View transitions render within threshold**
  - **Validates: Requirements 9.4**

- [ ] 18.7 Optimize concurrent request handling
  - Test Lambda functions with concurrent requests (load testing)
  - Configure Lambda reserved concurrency
  - Ensure no performance degradation under load
  - _Requirements: 9.5_

- [ ] 18.8 Write property test for concurrent requests
  - **Property 32: Concurrent requests handled without degradation**
  - **Validates: Requirements 9.5**

- [ ] 19. Implement security measures
- [ ] 19.1 Implement input sanitization
  - Sanitize all user inputs in Lambda functions
  - Prevent injection attacks (SQL, NoSQL, command injection)
  - Validate data types and formats
  - Use input validation libraries (e.g., validator.js)
  - _Requirements: 8.4_

- [ ] 19.2 Implement rate limiting
  - Add rate limiting to API Gateway (100 requests per minute per user)
  - Configure throttling for Lambda functions
  - Prevent abuse of voice and route services
  - Return 429 status code when rate limit exceeded
  - _Requirements: 8.1_

- [ ] 19.3 Secure API key management
  - Verify News API key stored in AWS Secrets Manager
  - Verify Google OAuth credentials stored in AWS Secrets Manager
  - Implement automatic secret rotation schedule (90 days)
  - Restrict News API key by domain/IP if possible
  - Use IAM roles for Lambda to access Secrets Manager and Amazon Location Service
  - _Requirements: 7.5_

- [ ] 19.4 Implement error logging with privacy protection
  - Log errors to CloudWatch Logs from all Lambda functions
  - Redact sensitive information (tokens, passwords, PII) from logs
  - Never log Google access tokens or OAuth credentials
  - Implement structured logging with correlation IDs
  - _Requirements: 8.5_

- [ ] 19.5 Write property test for error logging
  - **Property 28: Error logging protects sensitive information**
  - **Validates: Requirements 8.5**

- [ ] 19.6 Write unit tests for security measures
  - Test input sanitization with malicious inputs
  - Test rate limiting behavior
  - Test error logging with sensitive data
  - _Requirements: 8.4, 8.5_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Create deployment configuration
  - Configure CI/CD pipeline in amplify.yml for voice-route-planner
  - Set up dev, staging, and prod environments in Amplify Console
  - Configure CloudWatch monitoring and alarms for Lambda functions
  - Set up CloudWatch dashboard for voice-route-planner metrics
  - Document deployment process in README
  - _Requirements: All_
