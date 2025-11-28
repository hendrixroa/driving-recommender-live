import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*
 * Voice Route Planner uses Google Drive for data storage.
 * This data resource is kept minimal as DynamoDB is not used for user data.
 * All user preferences, search history, and route data are stored in the user's Google Drive.
 * 
 * The placeholder model below is required for Amplify Data to initialize properly,
 * but it will not be used in the application.
 */
const schema = a.schema({
  Placeholder: a
    .model({
      id: a.id().required(),
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
