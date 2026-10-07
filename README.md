# Email automation

Read-only service that loads recent Gmail messages and classifies each one with OpenAI. This version covers the first three milestones: configuration, Gmail reads, and structured classification.

It does not archive, label, delete, or send email. Gmail mutations stay disabled even when `DRY_RUN=false`. The OAuth scope is `gmail.readonly`.

Until message ids are stored in a database, each run classifies the latest inbox messages again.

## Requirements

- Node.js 22
- pnpm

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment file and fill in the required values:

```bash
cp .env.example .env
```

3. In Google Cloud, create an OAuth client ID of type **Web application** or **Desktop**. Add this authorized redirect URI:

```text
http://127.0.0.1:42813/oauth2callback
```

Enable the Gmail API for the project. Put the client id and secret in `.env`.

4. Grant read-only access and print a refresh token:

```bash
pnpm run gmail-auth
```

Open the printed URL, approve access, and paste `GOOGLE_REFRESH_TOKEN` into `.env`. The command does not write `.env`.

5. Add `OPENAI_API_KEY`. The default model is `gpt-5.4`.

## Commands

Confirm configuration and logging:

```bash
pnpm start
```

Classify the latest inbox messages (default 20) and print subject, classification, confidence, company, position, reason, and the action that would be taken later:

```bash
pnpm run process-inbox
```

Run unit tests:

```bash
pnpm test
```

## Safety

- Confidence at or above `AUTO_ACTION_CONFIDENCE` (default `0.95`) may later allow an automatic action. This version only logs that proposal.
- Confidence from `REVIEW_CONFIDENCE` (default `0.80`) up to the automatic threshold is logged, with no Gmail change.
- Confidence below the review threshold is treated as `UNKNOWN`.
- An invalid model response produces no action.
- Grainger is protected by default (`PROTECTED_COMPANIES`). A protected company is never given an archive or rejection-label proposal.
- Logs omit email bodies and redact tokens, API keys, and passwords.
