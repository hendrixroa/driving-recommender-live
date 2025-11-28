import { Stack, SecretValue } from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class VoiceRoutePlannerStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create secret for News API key
    const newsApiSecret = new secretsmanager.Secret(this, 'NewsApiKey', {
      secretName: 'voice-route-planner/news-api-key',
      description: 'API key for News API service',
      secretStringValue: SecretValue.unsafePlainText(JSON.stringify({
        apiKey: process.env.NEWS_API_KEY || 'placeholder-news-api-key'
      }))
    });

    // Create secret for Google OAuth credentials
    const googleOAuthSecret = new secretsmanager.Secret(this, 'GoogleOAuthCredentials', {
      secretName: process.env.GOOGLE_OAUTH_SECRET_NAME || 'voice-route-planner/google-oauth',
      description: 'Google OAuth 2.0 credentials for Google Drive API access',
      secretStringValue: SecretValue.unsafePlainText(JSON.stringify({
        clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder-client-id',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder-client-secret'
      }))
    });

    // Export secret ARNs for Lambda functions to access
    this.exportValue(newsApiSecret.secretArn, {
      name: 'NewsApiSecretArn'
    });

    this.exportValue(googleOAuthSecret.secretArn, {
      name: 'GoogleOAuthSecretArn'
    });
  }
}
