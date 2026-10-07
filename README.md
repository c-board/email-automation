# Email automation

Read-only service that loads recent Gmail messages and classifies each one with OpenAI. This version covers configuration, Gmail reads, structured classification, and a regression fixture set.

It does not archive, label, or delete Gmail. Gmail mutations stay disabled even when `DRY_RUN=false`. The OAuth scope is `gmail.readonly`.

Processed Gmail ids and application confirmations are stored in SQLite. A later `pnpm run process-inbox` skips those messages before calling the model. The database file survives a process restart. `pnpm run send-summary` prints one summary of unsummarized confirmations. While `DRY_RUN=true`, that command only prints and leaves the rows unsummarized. A real send needs Fastmail settings and `DRY_RUN=false`, and marks those rows summarized only after Fastmail accepts the message.

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

Classify new inbox messages (default 20) and print subject, classification, confidence, company, position, reason, and the action that would be taken later. Messages already stored in SQLite are skipped:

```bash
pnpm run process-inbox
```

Print the daily summary of confirmations that have not been summarized yet. With `DRY_RUN=true` this does not send mail. Set `SUMMARY_RECIPIENT`, `FASTMAIL_USERNAME`, `FASTMAIL_PASSWORD`, and `DRY_RUN=false` to send through Fastmail:

```bash
pnpm run send-summary
```

Run unit tests. These check the permitted action for each saved fixture and do not call OpenAI:

```bash
pnpm test
```

Check the classifier against the sanitized fixtures in `tests/fixtures/emails.ts`. This calls the model and fails when a label does not match:

```bash
pnpm run eval-fixtures
```

## Safety

- Confidence at or above `AUTO_ACTION_CONFIDENCE` (default `0.95`) may later allow an automatic action. This version only logs that proposal.
- Confidence from `REVIEW_CONFIDENCE` (default `0.80`) up to the automatic threshold is logged, with no Gmail change.
- Confidence below the review threshold is treated as `UNKNOWN`.
- An invalid model response produces no action.
- Grainger is protected by default (`PROTECTED_COMPANIES`). A protected company is never given an archive or rejection-label proposal.
- Logs omit email bodies and redact tokens, API keys, and passwords.
