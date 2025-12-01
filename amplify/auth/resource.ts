import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 * 
 * Google OAuth is used for user login via Cognito.
 * Email is enabled but users will primarily use Google OAuth.
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Welcome to Voice Route Planner!',
      verificationEmailBody: (createCode) =>
        `Use this code to confirm your account: ${createCode()}`
    },
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        attributeMapping: {
          email: 'email',
          givenName: 'given_name',
          familyName: 'family_name',
          profilePicture: 'picture',
          fullname: 'name'
        },
        scopes: ['email', 'profile', 'openid', 'https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/drive.file']
      },
      callbackUrls: ['http://localhost:4200/auth/callback'],
      logoutUrls: ['http://localhost:4200']
    }
  }
});
