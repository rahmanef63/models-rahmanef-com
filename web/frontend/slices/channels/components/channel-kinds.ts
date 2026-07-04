// Per-kind channel metadata (data-only) — drives the connect form fields + setup hints so the card
// stays dynamic (add a kind here, not in the component). `fields` maps 1:1 to createChannel's
// `secrets` bag; `secret:true` masks the input. `mintsSecret` kinds surface a one-time webhook token.
export type KindField = { key: string; label: string; secret?: boolean; optional?: boolean };
export type ChannelKind = {
  id: "telegram" | "slack" | "whatsapp" | "discord";
  label: string;
  fields: KindField[];
  mintsSecret?: boolean; // telegram: we mint + display a secret_token once
  hint: string;
};

export const CHANNEL_KINDS: ChannelKind[] = [
  {
    id: "telegram",
    label: "Telegram",
    mintsSecret: true,
    fields: [{ key: "botToken", label: "Bot token (123456:ABC…)", secret: true }],
    hint: "Create a bot with @BotFather and paste its token. We mint a webhook secret and can call setWebhook for you.",
  },
  {
    id: "slack",
    label: "Slack",
    fields: [
      { key: "signingSecret", label: "Signing secret", secret: true },
      { key: "botToken", label: "Bot user OAuth token (xoxb-…)", secret: true },
    ],
    hint: "Slack app → Basic Information → Signing Secret; OAuth & Permissions → Bot User OAuth Token. Set Event Subscriptions Request URL to the webhook URL below and subscribe to message.channels / message.im.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    fields: [
      { key: "appSecret", label: "App secret", secret: true },
      { key: "verifyToken", label: "Verify token (you choose)" },
      { key: "phoneNumberId", label: "Phone number ID" },
      { key: "accessToken", label: "Access token", secret: true },
    ],
    hint: "Meta app → WhatsApp → API setup: copy the Phone number ID + a permanent access token; App Settings → Basic → App Secret. Pick any verify token, then set the webhook Callback URL below + that verify token in Meta.",
  },
  {
    id: "discord",
    label: "Discord",
    fields: [
      { key: "publicKey", label: "Public key" },
      { key: "applicationId", label: "Application ID (optional)", optional: true },
      { key: "botToken", label: "Bot token (optional)", secret: true, optional: true },
    ],
    hint: "Discord Developer Portal → General Information → Public Key + Application ID. Set the Interactions Endpoint URL to the webhook URL below. Only slash commands work (see notes); register an /ask command with a text option.",
  },
];
