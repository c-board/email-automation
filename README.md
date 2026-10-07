# Email automation

Service that classifies recent Gmail messages with OpenAI, stores application confirmations in SQLite, and emails a daily summary. `pnpm start` stays running and runs those jobs on a schedule.

With `DRY_RUN=true`, label and archive actions are only logged. Set `DRY_RUN=false` to label an unprotected rejection `Job Rejections` and archive it, and to archive a confirmation after its summary is sent. Messages are never deleted. Grainger stays blocked. The OAuth scope is `gmail.modify`. An existing read-only refresh token cannot make these changes.

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

4. Grant Gmail access and print a refresh token. If you already authorized the read-only scope, run this again and replace `GOOGLE_REFRESH_TOKEN` before setting `DRY_RUN=false`:

```bash
pnpm run gmail-auth
```

Open the printed URL, approve access, and paste `GOOGLE_REFRESH_TOKEN` into `.env`. The command does not write `.env`.

5. Add `OPENAI_API_KEY`. The default model is `gpt-5.4`.

## Commands

Start the scheduler and leave it running. It does not run a job at startup. The next inbox check and the next daily summary follow `INBOX_PROCESSING_CRON` and `SUMMARY_CRON` in `TIMEZONE` (default `America/Chicago`). Those default to every 30 minutes (`*/30 * * * *`) and 6:00 p.m. (`0 18 * * *`). `SUMMARY_RECIPIENT` is required. Fastmail username and password are required only when `DRY_RUN=false`. If one job is still running, the other waits. A job error is logged and the process stays up.

```bash
pnpm start
```

Classify new inbox messages (default 20) and print subject, classification, confidence, company, position, reason, and the action that would be taken later. Messages already stored in SQLite are skipped. With `DRY_RUN=true`, an unprotected rejection is logged as a future `Job Rejections` label and archive. With `DRY_RUN=false`, that label is applied and the message is archived. This command still runs once and exits:

```bash
pnpm run process-inbox
```

Print the daily summary of confirmations that have not been summarized yet. This re-reads those Gmail messages. Grainger stays blocked. With `DRY_RUN=true` it logs which confirmations would be archived and does not send mail. Set `SUMMARY_RECIPIENT`, `FASTMAIL_USERNAME`, `FASTMAIL_PASSWORD`, and `DRY_RUN=false` to send through Fastmail and archive the unprotected confirmations after the send succeeds. OpenAI is not required for this command:

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

- Confidence at or above `AUTO_ACTION_CONFIDENCE` (default `0.95`) is required before a label or archive. `DRY_RUN=true` only logs that action.
- Confidence from `REVIEW_CONFIDENCE` (default `0.80`) up to the automatic threshold is logged, with no Gmail change.
- Confidence below the review threshold is treated as `UNKNOWN`.
- An invalid model response produces no action.
- Grainger is protected by default (`PROTECTED_COMPANIES`). A protected company is never given an archive or rejection-label proposal.
- Logs omit email bodies and redact tokens, API keys, and passwords.

## Railway

Keep one replica. Two copies would write the same SQLite file and could send two summaries. Mount a volume at `/data` so the database survives a deploy, and set `DATABASE_URL=file:/data/email-automation.sqlite`.

Copy the variables from `.env` into the Railway service. Do not put secrets in the repo. Include the Google client id, secret, and refresh token, `OPENAI_API_KEY`, `SUMMARY_RECIPIENT`, `TIMEZONE`, `DRY_RUN`, and the two cron expressions. Fastmail host, port, username, and app password are required in those variables when `DRY_RUN=false`.

Leave `DRY_RUN=true` until the Railway variables contain a Gmail refresh token from `pnpm run gmail-auth` (scope `gmail.modify`) and a Fastmail app password. Then:

```bash
railway login
railway up
```

Confirm the service is set to one replica. `railway.toml` starts the container with `pnpm start`.
