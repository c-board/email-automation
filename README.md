# Email automation

Service that classifies recent Gmail messages with OpenAI, stores application confirmations in SQLite, and emails a daily summary. `pnpm start` stays running and runs those jobs on a schedule.

With `DRY_RUN=true`, label and archive actions are only logged. Set `DRY_RUN=false` to label a confirmation `Application Confirmations`, label a rejection `Job Rejections`, archive an unprotected rejection, and archive an unprotected confirmation after its summary is sent. Messages are never deleted. Grainger can be labeled and is never archived. The OAuth scope is `gmail.modify`. An existing read-only refresh token cannot make these changes.

Processed Gmail ids and application confirmations are stored in SQLite. A later `pnpm run process-inbox` skips those messages before calling the model. The database file survives a process restart. `pnpm run send-summary` prints one summary of unsummarized confirmations. While `DRY_RUN=true`, that command only prints and leaves the rows unsummarized. A real send needs Resend settings and `DRY_RUN=false`, and marks those rows summarized only after Resend accepts the message.

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

Start the scheduler and leave it running. It does not run a job at startup. The next inbox check follows `INBOX_PROCESSING_CRON` in `TIMEZONE` (default `America/Chicago`), which defaults to every 30 minutes (`*/30 * * * *`). That run classifies new mail, then sends one summary of confirmations that are still waiting and archives the unprotected ones. `SUMMARY_RECIPIENT` is required. `RESEND_API_KEY` and `RESEND_FROM` are required only when `DRY_RUN=false`. A job error is logged and the process stays up.

```bash
pnpm start
```

Classify new inbox messages (default 20), then send the summary and archive unprotected confirmations from that same run. Messages already stored in SQLite are skipped. A confident confirmation is labeled `Application Confirmations`. A confident rejection is labeled `Job Rejections` and, unless it is Grainger, archived. With `DRY_RUN=true` labels and the summary are only logged. With `DRY_RUN=false` they are applied. This command still runs once and exits:

```bash
pnpm run process-inbox
```

Send the summary without classifying new mail. This re-reads unsummarized confirmations. Grainger is never archived. With `DRY_RUN=true` it logs which confirmations would be archived and does not send mail. The scheduled inbox run already does this after classifying. Use this command when you want the send by itself:

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
- Grainger is protected by default (`PROTECTED_COMPANIES`). A protected company can be labeled and is never archived.
- Logs omit email bodies and redact tokens, API keys, and passwords.

## Railway

Keep one replica. Two copies would write the same SQLite file and could send two summaries. Mount a volume at `/data` so the database survives a deploy, and set `DATABASE_URL=file:/data/email-automation.sqlite`.

Copy the variables from `.env` into the Railway service. Do not put secrets in the repo. Include the Google client id, secret, and refresh token, `OPENAI_API_KEY`, `SUMMARY_RECIPIENT`, `TIMEZONE`, `DRY_RUN`, and `INBOX_PROCESSING_CRON`. `RESEND_API_KEY` and `RESEND_FROM` are required in those variables when `DRY_RUN=false`. `RESEND_FROM` must be a sender verified in Resend. The summary is delivered to `SUMMARY_RECIPIENT`.

Leave `DRY_RUN=true` until the Railway variables contain a Gmail refresh token from `pnpm run gmail-auth` (scope `gmail.modify`) and the Resend key and from address. Then:

```bash
railway login
railway up
```

Confirm the service is set to one replica. `railway.toml` starts the container with `pnpm start`.
