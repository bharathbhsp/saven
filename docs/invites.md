# Saven — Sending invites (invite-only sign-in)

With **invite-only** sign-in, only users you create as an administrator can sign in. This document describes how to send invites by creating users in Cognito and (optionally) emailing them a temporary password. You can do these steps from any browser, including an incognito/private window if you prefer.

---

## Prerequisites

- AWS account with access to the Cognito User Pool used by Saven
- User Pool ID (from `terraform -chdir=infra output -raw cognito_user_pool_id` or AWS Console)
- App URL and Cognito Hosted UI URL for the “Sign in” link you’ll share with the invitee

---

## Option A: Invite via AWS Console

### 1. Open the User Pool

1. Open **AWS Console** → **Cognito** → **User pools**.
2. Click the Saven user pool (name like `saven-dev-api-user-pool` or the value of `cognito_user_pool_id`).

### 2. Create the user and send invite

1. Go to the **Users** tab.
2. Click **Create user**.
3. Fill in:
   - **Username (email):** the invitee’s email (this is the sign-in username).
   - **Temporary password:** either leave **Send an email to get a temporary password** checked (Cognito sends the invite email), or set a password yourself and share it securely (e.g. in a separate message).
   - **Name (optional):** invitee’s name if you use the `name` attribute.
4. Click **Create user**.

If you left “Send an email to get a temporary password” checked, Cognito sends an email with a temporary password. The user must sign in with that email and temporary password; they will be prompted to set a new password on first sign-in (if you have that flow enabled).

### 3. Share the sign-in link with the invitee

Send them your app’s sign-in URL. They will sign in via Cognito Hosted UI, then be redirected to your app.

**Example (replace placeholders):**

- **App URL:** `https://your-app-domain.com/` (or `http://localhost:5173/` for local dev).
- **Hosted UI sign-in URL** (if you want to link straight to Cognito):
  ```
  https://<cognito_domain>.auth.<region>.amazoncognito.com/login?client_id=<client_id>&response_type=token&scope=openid+email+profile&redirect_uri=<encoded_app_url>
  ```
  Get `<cognito_domain>` and `<client_id>` from Terraform:
  ```bash
  terraform -chdir=infra output -raw cognito_domain
  terraform -chdir=infra output -raw cognito_app_client_id
  ```
  For `redirect_uri`, use the full app URL (e.g. `https://your-app-domain.com/`), URL-encoded.

In practice, most teams just share the **app URL**; the user clicks “Sign in” there and is taken to the Hosted UI.

### 4. (Optional) Do this from an incognito window

- Open a **private/incognito** window.
- Log into **AWS Console** in that window.
- Follow steps 1–3 above. This keeps invite-creation separate from your normal app session.

---

## Option B: Invite via AWS CLI

Useful for scripts or automation.

### 1. Create user and send invite email

```bash
# Set your User Pool ID (from Terraform or Console)
USER_POOL_ID="ap-south-2_xxxxxxxxx"

# Create user; Cognito sends email with temporary password
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "invitee@example.com" \
  --user-attributes Name=email,Value=invitee@example.com Name=name,Value="Invitee Name" \
  --message-action SUPPRESS \
  --desired-delivery-mediums EMAIL
```

- `--message-action SUPPRESS` avoids sending a second “welcome” if the user already exists.
- To **resend** a temporary password for an existing user, use `admin-set-user-password` with temporary flag, or **Message action** `RESEND` in a create flow (see AWS docs).

### 2. (Optional) Set a specific temporary password

If you prefer to set the password yourself and share it out-of-band:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "invitee@example.com" \
  --password "YourSecureTempPassword123!" \
  --permanent false
```

Then share the sign-in URL and the temporary password with the invitee (e.g. over a secure channel). They sign in and should be prompted to change password if your pool is configured that way.

---

## After the user signs in

- Their identity in the app is the Cognito **sub** (user ID).  
- To let them see data, add them to a **group** in Saven (e.g. via your app’s “Add member” or by writing to the `group_members` table in DynamoDB with their Cognito `sub` as `userId`).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Open Cognito → your User pool → **Users** → **Create user**. |
| 2 | Enter invitee email (username), optionally name; choose “Send email with temporary password” or set password manually. |
| 3 | Share the **app URL** (or Hosted UI sign-in URL) with the invitee. |
| 4 | Add the user to Saven groups as needed so they can see data. |

You can perform the Console steps in an incognito window by logging into AWS there and following the same flow.
