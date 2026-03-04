# Telegram Bot — Suggestions (Group Selection, Multi-User, Auth)

This document records suggestions for improving the Phase 6 Telegram bot: which Saven group to record to, using the bot in a Telegram group with multiple users, and how user authentication from Telegram works.

---

## 1. Controlling which Saven group the transaction is recorded to

**Implemented.** The bot resolves the group in this order: explicit group in message (Option A) → Telegram chat–linked Saven group (Option C) → default group from link (Option B) → first group.

### Option A — Optional group in the command *(implemented)*

Allow group name (or id) as an extra argument:

- `/add 50 Food` → default (e.g. first group)
- `/add 50 Food Household` or `/add 50 Food @Household` → record to the Saven group named “Household” (if the user is a member)

Apply the same idea for free-text: e.g. “50 coffee Household” or “50 coffee @Household”.

### Option B — Default group per Telegram link *(implemented)*

The `telegram_links` table has an optional `defaultGroupId`. In the app (Settings), the user can choose “Default group for Telegram” and save via PATCH /telegram/link. The bot uses that group when none is specified in the message.

### Option C — “Current group” when in a Telegram group *(implemented)*

When the bot is used inside a **Telegram group**, “Telegram chat → Saven group” is supported. In the app, generate a chat-link code (POST /telegram/chat-link-code with groupId); in the Telegram group send `/linkgroup <code>`. The `telegram_chat_links` table stores `telegramChatId` → `savenGroupId`. The bot then uses that Saven group for messages in that chat when no explicit group is given.

**One shared bucket for a Telegram group:** To have multiple people in one Telegram group all record into **one** Saven group (one “bucket”/account):

1. In the Saven app, a group admin goes to Settings → Link Telegram group, selects the Saven group, and generates a code.
2. In the Telegram group, an admin (or any member who is in that Saven group) runs `/linkgroup <code>`.
3. Everyone in the Telegram group who has linked their Telegram (via `/link`) and who is a **member** of that Saven group can then add transactions; they all go to that same Saven group. If the Telegram group is **not** linked, the bot does not record in group chats (it asks them to link the chat first), so there is no ambiguity—group chat = shared bucket only after linking.

---

## 2. Using the bot in a Telegram group with multiple users

**How it works today:** Each Telegram update has `message.from.id` (the Telegram user who sent the message). The bot already resolves `telegram_user_id` → `userId` via `telegram_links`. So:

- If **User A** and **User B** have both done **/link** in DM with the bot, then in a **Telegram group** where the bot is added:
  - A’s message → `from.id` = A’s Telegram id → link table → A’s `userId` → transaction for A (e.g. to A’s default group).
  - B’s message → same for B.

So the bot **already supports multiple users** in one Telegram group, as long as each person has linked their Telegram account once (in private chat with the bot). No change is required for “multiple users in one group” per se.

**If you want “this Telegram group = one Saven group” (shared tracking):**

- **Concept:** One Telegram group (e.g. “Household”) is linked to **one** Saven group. Any message in that Telegram group that looks like a transaction is recorded **into that Saven group**, with `createdBy` = the user who sent it (still from `from.id` → `userId`).
- **Implementation sketch:**
  - New store: e.g. `telegram_chat_links` with `telegramChatId` (the group chat id from Telegram) → `savenGroupId`, and optionally `linkedBy` / `linkedAt`.
  - Link flow: e.g. only in the **app** (authenticated): “Link this Saven group to a Telegram group” could show a one-time code; an admin adds the bot to the Telegram group and sends something like `/linkgroup <code>` in that group; the bot then writes `telegramChatId` → `savenGroupId`.
  - When handling a message, if `chat.type === "group"` (or `"supergroup"`): look up `telegramChatId` → `savenGroupId`. If found, require that the sender’s `userId` is a **member** of that Saven group; if yes, record the transaction in **that** Saven group (and still use that user as `createdBy`). If not in a linked group, fall back to current behaviour (e.g. user’s default group).

So: **multi-user in a Telegram group** works today (each user must /link once). **“Whole Telegram group → one Saven group”** is an extra feature you can add with a chat-level link and the logic above.

---

## 3. How user “authentication” from Telegram works

We are **not** authenticating the user “from Telegram” in the sense of Telegram proving identity to Saven. We are **binding** a Telegram identity to an already-authenticated Saven user:

1. User signs in to the **Saven app** (Cognito). So Saven already trusts “this browser session is user X.”
2. In the app, the user gets a **one-time code** (and only they see it after login).
3. User sends **/link &lt;code&gt;** to the bot in **Telegram**. So we know “this Telegram account received the code.”
4. We store `telegram_user_id` → `userId` in `telegram_links`.

**Guarantee:** Only someone who both (a) had access to the Saven account when the code was generated and (b) had access to that Telegram account when /link was sent could have created that link. So we treat “this Telegram user” as “this Saven user” for subsequent messages.

**What we are not doing:** We are not verifying that the Telegram account is “really” the user (e.g. no Telegram Login Widget or Telegram passphrase). So the security is: **Saven account security + Telegram account security**. If someone steals the Telegram account after linking, they can record as that user until you allow “unlink” or revoke the link.

**Making it clearer for users:**

- In the app: “Linking proves you own both this Saven account and this Telegram account.”
- Optional: add an “Unlink Telegram” in Settings that deletes the row from `telegram_links` (and optionally from `telegram_chat_links` if you add it).

---

## Summary

| Topic | Current state | Suggestions |
|-------|----------------|-------------|
| **Which group** | Always first group | Add optional group to `/add` and free-text; optionally “default group” per link in app. |
| **Bot in Telegram group, multiple users** | Works if each user has /link’d | No change needed for attribution; optionally add “Telegram group → Saven group” link so all messages in that chat go to one Saven group. |
| **“Auth” from Telegram** | Link via one-time code after Cognito login | Keep this model; document it as “link = you prove control of both accounts”; optional “Unlink” in app. |
