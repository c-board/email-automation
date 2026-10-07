import http from "node:http";
import { GMAIL_OAUTH_HOST, GMAIL_OAUTH_PORT, GMAIL_OAUTH_REDIRECT_PATH, GMAIL_OAUTH_TIMEOUT_MS, GMAIL_READONLY_SCOPE } from "../src/config/constants.js";
import { formatConfigError, loadGoogleAuthEnv } from "../src/config/env.js";
import { createOAuthClient } from "../src/gmail/gmail.auth.js";
import { errorText } from "../src/logging/sanitize.js";

function waitForAuthCode(): Promise<string> {
  return new Promise(function (resolve, reject) {
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    function settle(onSettled: () => void): void {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      server.close();
      onSettled();
    }

    const server = http.createServer(function (request, response) {
      const url = new URL(request.url ?? "/", `http://${GMAIL_OAUTH_HOST}:${GMAIL_OAUTH_PORT}`);
      if (url.pathname !== GMAIL_OAUTH_REDIRECT_PATH) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      const oauthError = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      if (oauthError) {
        response.statusCode = 400;
        response.end("Authorization failed. You can close this window.");
        settle(function () {
          reject(new Error(`Google authorization failed: ${oauthError}`));
        });
        return;
      }
      if (!code) {
        response.statusCode = 400;
        response.end("Missing authorization code.");
        return;
      }

      response.end("Authorization complete. You can close this window.");
      settle(function () {
        resolve(code);
      });
    });

    timeout = setTimeout(function () {
      settle(function () {
        reject(new Error("Timed out waiting for the Google authorization redirect."));
      });
    }, GMAIL_OAUTH_TIMEOUT_MS);

    server.on("error", function (error: Error) {
      settle(function () {
        reject(error);
      });
    });

    server.listen(GMAIL_OAUTH_PORT, GMAIL_OAUTH_HOST);
  });
}

async function main(): Promise<void> {
  const env = loadGoogleAuthEnv();
  const client = createOAuthClient({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
  });
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_READONLY_SCOPE],
  });

  console.log("Open this URL in a browser and approve read-only Gmail access:\n");
  console.log(url);
  console.log("\nWaiting for the redirect...");

  const code = await waitForAuthCode();
  const tokenResponse = await client.getToken(code);
  const refreshToken = tokenResponse.tokens.refresh_token;
  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Remove this app's access in the Google Account permissions page, then run pnpm run gmail-auth again.",
    );
  }

  console.log("\nAdd this to .env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
}

main().catch(function (error: unknown) {
  console.error(formatConfigError(error));
  if (!(error instanceof Error)) {
    console.error(errorText(error));
  }
  process.exitCode = 1;
});
