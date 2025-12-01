import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { GoogleDriveService } from './google-drive.service';
import * as fc from 'fast-check';
import * as auth from 'aws-amplify/auth';

describe('AuthService', () => {
  let service: AuthService;
  let googleDriveService: GoogleDriveService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, GoogleDriveService]
    });
    service = TestBed.inject(AuthService);
    googleDriveService = TestBed.inject(GoogleDriveService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Feature: driver-recommender, Property 22: Authentication precedes data access
   * Validates: Requirements 6.1
   * 
   * Property: For any request to access user-specific data, the system should verify 
   * authentication before processing.
   */
  describe('Property 22: Authentication precedes data access', () => {
    it('should verify authentication before allowing Google Drive access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            userEmail: fc.emailAddress(),
            isAuthenticated: fc.boolean()
          }),
          async (testData) => {
            // Setup: Mock authentication state
            if (testData.isAuthenticated) {
              // Mock authenticated user
              spyOn(auth, 'getCurrentUser').and.returnValue(
                Promise.resolve({
                  userId: testData.userId,
                  username: testData.userEmail
                } as any)
              );

              spyOn(auth, 'fetchAuthSession').and.returnValue(
                Promise.resolve({
                  tokens: {
                    idToken: {
                      payload: {
                        identities: [{
                          providerName: 'Google',
                          accessToken: 'mock-google-token'
                        }]
                      }
                    }
                  }
                } as any)
              );
            } else {
              // Mock unauthenticated user
              spyOn(auth, 'getCurrentUser').and.returnValue(
                Promise.reject(new Error('User not authenticated'))
              );

              spyOn(auth, 'fetchAuthSession').and.returnValue(
                Promise.reject(new Error('No session found'))
              );
            }

            // Test: Attempt to access user data
            if (testData.isAuthenticated) {
              // Should succeed for authenticated users
              const token = await service.getGoogleAccessToken();
              expect(token).toBe('mock-google-token');
              
              // Verify authentication was checked
              expect(auth.fetchAuthSession).toHaveBeenCalled();
            } else {
              // Should fail for unauthenticated users
              try {
                await service.getGoogleAccessToken();
                fail('Expected getGoogleAccessToken to throw an error');
              } catch (error) {
                expect(error).toBeDefined();
              }
              
              // Verify authentication was checked
              expect(auth.fetchAuthSession).toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent Google Drive operations without authentication', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            userEmail: fc.emailAddress()
          }),
          async (testData) => {
            // Setup: Mock unauthenticated state
            spyOn(auth, 'getCurrentUser').and.returnValue(
              Promise.reject(new Error('User not authenticated'))
            );

            spyOn(auth, 'fetchAuthSession').and.returnValue(
              Promise.reject(new Error('No session found'))
            );

            // Test: Attempt to access Google Drive data should fail
            // The GoogleDriveService internally calls getAccessToken which checks auth
            try {
              await googleDriveService.getUserPreferences(testData.userId, testData.userEmail);
              fail('Expected getUserPreferences to throw an error');
            } catch (error) {
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
