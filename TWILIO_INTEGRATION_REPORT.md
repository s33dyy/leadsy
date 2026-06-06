# TWILIO INTEGRATION REPORT

Generated for the Twilio CRM transformation on 2026-06-06.

## Status

Twilio is now implemented as Leadsy's primary WhatsApp conversation transport.

Implemented routes:

- `/api/twilio/webhook`
- `/api/twilio/status`
- `/api/twilio/messages`

The required webhook URLs for production are:

- Inbound webhook: `https://leadsy.up.railway.app/api/twilio/webhook`
- Delivery status callback: `https://leadsy.up.railway.app/api/twilio/status`

## Environment Configuration

Configured environment keys:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_CONTENT_SID`
- `TWILIO_CONTENT_VARIABLES`
- `TWILIO_TEST_TO`
- `TWILIO_WEBHOOK_URL`
- `TWILIO_STATUS_CALLBACK_URL`

Secrets are not displayed in the application UI. The settings page masks the Account SID and never prints the auth token.

## Inbound Flow

Twilio WhatsApp inbound messages now follow this path:

Lead Source
→ Twilio Webhook
→ Next.js `/api/twilio/webhook`
→ Leadsy lead knowledge store
→ Lead record
→ Conversation
→ Inbox and qualification inputs

Stored fields:

- Message SID via `providerMessageSid`
- Direction: `inbound`
- Channel: `whatsapp`
- Delivery status
- Timestamp
- Lead ID
- Conversation ID
- Raw Twilio form payload

## Outbound Flow

Leadsy outbound WhatsApp messages now follow this path:

Leadsy
→ Next.js `/api/twilio/messages`
→ Twilio Message Resource API
→ WhatsApp
→ `/api/twilio/status`
→ delivery status stored on the message

Stored fields:

- Message SID via `providerMessageSid`
- Direction: `outbound`
- Channel: `whatsapp`
- Delivery status
- Timestamp
- Lead ID
- Conversation ID
- Template SID and variables when a content template is used

## Delivery Callback Flow

Twilio delivery callbacks are handled by `/api/twilio/status`.

The handler:

- validates the Twilio signature when `TWILIO_AUTH_TOKEN` is configured
- accepts evolving callback parameters
- updates matching Twilio messages by Message SID
- records the latest delivery callback timestamp and status in `twilio-integration.json`

## Conversation Contract

Twilio messages are stored as customer conversation messages only when direction is:

- `inbound`
- `outbound`

Worker events, task events, and system events are not stored as Twilio messages.

## Settings Surface

Settings → Integrations → Twilio now displays:

- Connection Status
- Account SID
- WhatsApp Number
- Last Webhook
- Last Delivery Callback
- Inbound webhook route
- Status callback route

## Tests

Added:

- `npm run test:twilio-integration`
- `npm run test:twilio-settings`

Covered behavior:

- inbound Twilio message storage
- outbound Twilio message send and storage
- delivery callback updates
- Twilio signature validation
- conversation linking
- settings display without secret exposure
