# Kavkaz AI

Kavkaz AI — Telegram-бот: чат с AI, история диалогов, удобное меню и профиль.

Spec: [`docs/blueprint.md`](docs/blueprint.md).

Built on [agnt-gm.ai](https://agnt-gm.ai). The whole bot is built and refined here as pull requests across successive build passes.

## AI forwarding deployment note

Free text is sent to the platform-configured OpenAI-compatible endpoint from
`AI_API_URL` (with `AI_ENDPOINT`, `OPENAI_API_URL`, and `OPENROUTER_API_URL`
accepted for platform compatibility). The credential is read from the Worker
binding `AI_API_KEY` (or the corresponding OpenAI/OpenRouter binding), never
shown to users. Each request includes the assistant persona, profile settings,
and the retention-filtered recent conversation as `system`/`user`/`assistant`
messages. The model reply is persisted and returned verbatim.

To reproduce: configure the endpoint and key, open **Новый чат**, and send any
text. The expected result is the configured model's reply, not the old
`«Я готов помочь»` canned response. If the endpoint fails or times out, the
user sees `Сервис временно недоступен, попробуйте позже.`, while the owner
receives a request id and diagnostic when `ADMIN_CHAT_ID` is configured.
