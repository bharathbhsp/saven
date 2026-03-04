# Saven — User guide

A short guide to using Saven (spend tracking) for your team. No technical knowledge required.

---

## 1. Sign in and first time

- Open the app in your browser and click **Sign in**.
- Enter your **email** and **password** (you need an invite from your admin to get access).
- If you have no groups yet, create one—e.g. “Household”—then you’ll see your **Dashboard**.

---

## 2. Dashboard

- **Pick a group** from the dropdown to see that group’s data.
- **This month** shows total spend for the selected group.
- **Recent transactions** shows the last 5 entries (date, amount, category, note, when it was added, who added it).
- Use **New group** to create another bucket (e.g. “Travel”). Use **Add transaction** or **View all & filter** to add or see more transactions.

---

## 3. Groups and members

- **Create a group:** Dashboard or **Groups** in the menu → **New group** → enter a name (e.g. “Household”).
- **See who’s in a group:** Open **Groups**, select the group. You’ll see the list of members.
- **Add someone:** Enter their **email** in “Add member” and click **Add member**. They must already have access to Saven (your admin sends them an invite first). If you see “No user found”, they need to sign in once or be added by your admin.
- **Remove someone:** In the members list, click **Remove** next to their name.

---

## 4. Adding a transaction (web)

- Open **Transactions** and click **Add transaction** (or use the link on the Dashboard).
- Choose the **group**, enter **amount** and **date** (when you spent), pick a **category** (e.g. Food, Transport), add a **note** if you like, then click **Add**.

---

## 5. Viewing and exporting transactions

- Open **Transactions**, select a **group**, then choose **Day**, **Month**, or **Date range** to filter.
- The list shows newest first. You can **Export CSV** or **Export PDF** for the same period you’re viewing.

---

## 6. Categories

- Open **Categories** and select a group to see which categories exist (e.g. Food, Transport, Other). Some are shared for all groups; some are only for that group.
- To **add a category** for that group: type a name in “New category name” and click **Add category**. It will appear when you add transactions.

---

## 7. Profile and Telegram

**Your account**  
Profile shows your email and lets you **Sign out**.

**Connect Telegram**  
- In the app: **Profile** → **Telegram settings** → **Connect Telegram** → **Generate link code**.  
- In Telegram: open a chat with the Saven bot and type: **/link** followed by a space and the 6-digit code (e.g. **/link 847291**). The bot will confirm when you’re linked.

**Default group for Telegram**  
After linking, in Profile under “Default group for Telegram” you can choose which group the bot uses when you don’t say a group name in your message. Save to apply.

**Link a Telegram group to a Saven group**  
- In the app: **Profile** → **Link Telegram group** → choose the Saven group → **Generate chat link code**.  
- Add the Saven bot to your **Telegram group**, then in that group type: **/linkgroup** followed by a space and the code (e.g. **/linkgroup 992831**).  
Only people who are in that Saven group can run this. After that, everyone in the Telegram group who has linked their account and is in the Saven group can add transactions into that group from the chat.

---

## 8. Using the Telegram bot

**First:** Link your Telegram (see section 7). Then you can record spend and see summaries in Telegram.

**Which group is used?**  
The bot uses: (1) the group you mention in the message, or (2) if you’re in a Telegram group that’s linked to a Saven group, that one, or (3) your default group from Profile, or (4) your first group.

**Recording spend in Telegram**  
- Type **start** to see help.  
- To add spend: type **add**, then amount, then category (e.g. **add 50 Food**). You can add a date or group name at the end if you want (e.g. **add 50 Food Household**).  
- You can also write in plain language, e.g. **50 coffee** or **spent 20 on groceries yesterday**. The bot figures out amount and category (and optional group).

**Summaries in Telegram**  
- **today** — today’s total.  
- **month** — this month’s total (or add a month, e.g. **month 2025-02**).  
- **range** then start and end date — total for that period.

---

## 9. Export

On **Transactions**, pick a group and set the filter (day, month, or range). Then click **Export CSV** or **Export PDF** to download the data for that period.

---

## 10. Where to find things in the app

| Where to go | What you can do |
|-------------|------------------|
| **Dashboard** | See group total, last 5 transactions, create a group, open Add transaction or full list. |
| **Transactions** | See full list, filter by day/month/range, export CSV or PDF. Use **Add transaction** at the top to add one. |
| **Groups** | See members, add members by email, remove members. |
| **Categories** | See categories for a group, add a new category. |
| **Profile** | See your account, sign out, connect Telegram, set default group, link a Telegram group. |

---

## 11. Who can do what

- **Anyone signed in** can create groups, be added to groups, add transactions, view data for their groups, export, and manage their Profile and Telegram link.
- **Group members** can add or remove other members (by email), add transactions, see who submitted each one, and add categories for that group.
- **In Telegram**, once linked, you can add spend (typed or free text), see today/month/range, and use a default or linked group. In a linked Telegram group, everyone who is in the Saven group and has linked Telegram can record into that group; each message is attributed to the person who sent it.
