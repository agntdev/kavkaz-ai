# Kavkaz AI — Conversational Assistant — Bot specification

**Archetype:** community

**Voice:** warm and concise — write every user-facing message, button label, error, and empty state in this voice.

A Russian-first Telegram conversational assistant that provides chat-based AI replies, per-user conversation history with pagination and export, editable user profile and settings, and an in‑bot report form that notifies the owner/admin chat. No third‑party APIs or payments in v1; data retention configurable by the user.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Russian-speaking individuals who want a ChatGPT-like assistant inside Telegram
- Users needing quick Q&A, text drafting, and simple task help
- Students and knowledge workers who want saved conversation history and exports

## Success criteria

- User can start the bot (/start) and access the Main Menu
- User can have a chat: send a message and receive an AI reply within expected latency
- User can view, paginate, open, rename, delete, and export past conversations (10 per page)
- User can view and edit profile (display name, language RU/EN, timezone) and see monthly usage stats
- User can change history retention (30/90/365 days) and setting is applied to purging job
- User can submit a problem report and the owner/admin receives a Telegram notification with report details
- Admin receives critical error alerts to ADMIN_CHAT_ID

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and show welcome + brief instructions
  - outputs: Main Menu (buttons)
- **Chat** (button, actor: user, callback: menu:chat) — Open or continue the active conversation (start new if none)
  - outputs: Conversation view with input field, Suggested quick-reply buttons
- **History** (button, actor: user, callback: menu:history:page:1) — List recent conversations (paged, 10 per page) with actions
  - outputs: History list (10 items), Pagination buttons, Per-conversation action buttons
- **Profile** (button, actor: user, callback: menu:profile) — View and edit display name, language, timezone, and see usage stats
  - outputs: Profile view, Edit actions (buttons/ForceReply)
- **Settings** (button, actor: user, callback: menu:settings) — Toggle preferences: message language, history retention, compact/expanded replies
  - outputs: Settings toggles and confirmations
- **Help** (button, actor: user, callback: menu:help) — Show canned help text and usage tips
  - outputs: Help text message
- **Report a problem** (button, actor: user, callback: menu:report) — Open a short report form (multi-step) that notifies admin on submit
  - inputs: Problem category (buttons), Short description (ForceReply)
  - outputs: User confirmation, Admin notification message
- **/help** (command, actor: user, command: /help) — Fallback help surface explaining main features and owner contact
  - outputs: Help text

## Flows

### Start and Main Menu
_Trigger:_ /start

1. Send welcome message in user's language (default RU) with short instructions
2. Display Main Menu inline keyboard (Chat, History, Profile, Settings, Help, Report)
3. If first-time user, create User and Profile records with defaults

_Data touched:_ User, Profile

### Chat session (send message → AI reply)
_Trigger:_ menu:chat button or opening conversation

1. Open conversation view (show last N messages, quick-reply buttons)
2. User types message (free-form); bot records Message entity
3. Bot generates built-in AI reply and records Message entity
4. Bot sends reply; show quick actions (Save/Pin, Export conversation, Feedback)
5. If reply fails, send polite error and allow retry or request to submit a report

_Data touched:_ Conversation, Message, Profile

### Save / Pin message
_Trigger:_ message action button in conversation

1. User taps Save/Pin on a bot or user message
2. Mark message metadata as pinned/saved
3. Confirm action to user

_Data touched:_ Message

### History browsing and pagination
_Trigger:_ menu:history or pagination buttons

1. Query conversations for user, ordered by last activity
2. Return page of 10 items with preview, timestamp and action buttons (Open, Rename, Delete, Export)
3. Handle pagination via callback_data page controls

_Data touched:_ Conversation, Message

### Conversation export
_Trigger:_ Export button in history or conversation view

1. Generate plain text export of conversation messages (UTF-8)
2. If size <= Telegram file limits, send as .txt file to user
3. If generation fails or too large, inform user and offer partial export or email option (missing)
4. Record export attempt in audit log

_Data touched:_ Conversation, Message

### Profile edit
_Trigger:_ menu:profile

1. Show current profile fields and edit buttons
2. When user selects edit, use ForceReply for free-form fields (display name) or inline options for language/timezone
3. Validate and save changes; update profile usage stats display

_Data touched:_ Profile

### Settings update (retention etc.)
_Trigger:_ menu:settings

1. Present settings toggles and retention options (30/90/365 days) as buttons
2. On change, save user preference and confirm
3. Retention change affects scheduled purge job

_Data touched:_ Profile, Conversation, Message

### Report problem (user → admin notification)
_Trigger:_ menu:report

1. Open short multi-step form: category (buttons) → description (ForceReply) → optional screenshot note (no file upload support in v1)
2. Save Report entity and send structured message to ADMIN_CHAT_ID with user id, display name, category, timestamp and text
3. Acknowledge receipt to user

_Data touched:_ Report, User

### Retention purge job
_Trigger:_ daily scheduled job

1. Find messages/conversations older than user's retention setting and delete content according to retention policy
2. Log deletions and report critical failures to ADMIN_CHAT_ID
3. Update usage stats as needed

_Data touched:_ Message, Conversation, Profile, SystemEvent

### Admin critical alert
_Trigger:_ system error event or failed scheduled job

1. Create SystemEvent record with error details and stack/context
2. Send formatted notification to ADMIN_CHAT_ID with minimal PII
3. Mark event as acknowledged when owner replies or uses admin control

_Data touched:_ SystemEvent

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where user reports and critical alerts are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User** _(retention: persistent)_ — Telegram user identifier and derived metadata
  - fields: telegram_id, username, first_name, last_name, created_at
- **Profile** _(retention: persistent)_ — Editable user profile and preferences
  - fields: user_id, display_name, language, timezone, history_retention_days, compact_replies, messages_this_month
- **Conversation** _(retention: persistent)_ — Conversation/session metadata and pointers to messages
  - fields: conversation_id, user_id, title, created_at, last_activity_at, pinned_message_ids
- **Message** _(retention: persistent)_ — Single chat message authored by user or bot (text only in v1)
  - fields: message_id, conversation_id, author, text, timestamp, pinned, saved
- **Report** _(retention: persistent)_ — User-submitted problem reports sent to admin
  - fields: report_id, user_id, category, description, submitted_at, notified_admin_at
- **SystemEvent** _(retention: persistent)_ — Internal error or scheduled-job events for admin alerts
  - fields: event_id, level, message, context, created_at, acknowledged_by_admin

## Integrations

- **Telegram** (required) — Bot API messaging, inline buttons, file send (exports), and admin notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set/Update ADMIN_CHAT_ID for receiving reports and alerts
- View system error logs and acknowledge critical events
- Configure default language and default retention for new users
- Manually export or request export of a conversation for a user
- Purge or restore a user's data (GDPR-style request handling)
- Enable/disable admin notifications

## Notifications

- Notify admin (ADMIN_CHAT_ID) when a user submits a problem report with structured details
- Notify admin on critical system errors and retention purge failures
- Acknowledge user after report submission with a confirmation message
- Notify user when a conversation export is ready or if export fails

## Permissions & privacy

- All conversation text and profile data are stored and subject to user-configurable retention (30/90/365 days). Default 90 days.
- No third-party APIs or external NLP providers are used in v1 (built-in AI mode).
- Users can request data export and deletion; owner can perform manual purge on request.
- Admin notifications include minimal identifying info (telegram id and display name) and the report text.

## Edge cases

- ADMIN_CHAT_ID not set: reports and critical alerts must be queued and user informed that owner is not configured
- User switches language mid-conversation: UI and subsequent bot messages should respect latest language preference
- Very long conversation exports exceeding Telegram file limits: provide partial export and clear error to user
- DB outage or write failures: send error to admin, backoff retries, and inform affected users with non-technical message
- Concurrent pagination or rename/delete operations may race; apply optimistic locking or last-write-wins with clear UX
- User requests retention shorter than existing legal requirements for stored admin reports (owner must handle)
- Large numbers of messages per user may impact performance: enforce practical per-message size limits and paginate history queries

## Required tests

- Dialog-level acceptance: user sends message → bot replies with AI content and both messages are persisted
- History CRUD: create multiple conversations, paginate through history, open, rename, delete a conversation
- Export flow: request export and receive a UTF-8 .txt file containing messages in correct order
- Profile edit: update display name, language, timezone and verify changes reflected in subsequent interactions
- Settings/Retention: change retention to 30/365 and verify scheduled purge deletes messages older than threshold
- Report flow: submit report and assert ADMIN_CHAT_ID receives a well-formed notification; user receives confirmation
- Failure modes: simulate AI reply failure, DB write failure, and missing ADMIN_CHAT_ID and verify appropriate user/admin notifications

## Assumptions

- Built-in AI engine behavior and safety rules will be supplied or implemented by the platform (no external AI key required)
- Owner will provide exactly one ADMIN_CHAT_ID for v1 to receive reports and alerts
- Default language is Russian; users can switch to English
- Pagination size is 10 conversations per page
- No file uploads or voice transcription support in v1
- Exports are provided as plain text (.txt) UTF-8 files
