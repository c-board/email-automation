import { google } from "googleapis";
import { gmailOauthRedirectUri } from "../config/constants.js";

export type GoogleAuthClient = InstanceType<typeof google.auth.OAuth2>;

export function createOAuthClient(config: {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}): GoogleAuthClient {
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret, gmailOauthRedirectUri());
  if (config.refreshToken) {
    client.setCredentials({ refresh_token: config.refreshToken });
  }
  return client;
}
