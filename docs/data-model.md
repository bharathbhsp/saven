# Saven — Core Data Model (Phase 1)

Defines the persistent data model, primary/sort keys, GSIs, access patterns, and audit fields. Implemented in Terraform in `infra/modules/data/`. Users are **Cognito** (source of truth); no Users table.

---

## Entity Summary

| Entity         | Table name (Terraform) | PK        | SK / Range key | Notes                          |
|----------------|------------------------|-----------|----------------|--------------------------------|
| Groups         | `*-groups`             | `id`      | —              | One partition per group        |
| GroupMembers   | `*-group-members`      | `groupId` | `userId`       | GSI: by-user (userId, groupId) |
| Categories     | `*-categories`         | `groupId` | `categoryId`   | groupId = "GLOBAL" for shared  |
| Transactions   | `*-transactions`       | `groupId` | `sk`           | sk = `date#transactionId`      |

Transactions GSI: **by-user-date** (hash: `userId`, range: `sk`) for list-by-user and by date.

---

## 1. Groups

- **PK:** `id` (string, UUID or generated ID).
- **Attributes:** `name`, `createdAt`, `updatedAt`, `createdBy` (userId from Cognito).
- **Access:** Get by id (GetItem). List groups for a user → use **GroupMembers** GSI by-user.

---

## 2. GroupMembers

- **PK:** `groupId`, **SK:** `userId`.
- **Attributes:** `role` (optional, e.g. "admin", "member"), `joinedAt`.
- **GSI:** `by-user` — hash `userId`, range `groupId` → list all groups for a user.

**Access patterns:**
- List members of a group: Query PK = groupId.
- List groups for a user: Query GSI by-user, PK = userId.
- Add/remove member: PutItem / DeleteItem on (groupId, userId).

---

## 3. Categories

- **PK:** `groupId`, **SK:** `categoryId`.
- Use **groupId = "GLOBAL"** for default/shared categories; per-group categories use the group’s id.
- **Attributes:** `name`, `archived` (boolean), `createdAt`, `updatedAt`, `createdBy`.

**Access patterns:**
- List categories for a group: Query PK = groupId.
- Get one category: GetItem (groupId, categoryId).
- Create/update/archive: PutItem (include audit fields).

---

## 4. Transactions

- **PK:** `groupId`, **SK:** `sk` where `sk = date#transactionId` (e.g. `2025-03-03#uuid`).
- **Attributes:**
  - `transactionId` (UUID, also embedded in sk),
  - `date` (YYYY-MM-DD),
  - `amount` (number),
  - `categoryId`,
  - `groupId`,
  - `userId` (owner/creator from Cognito sub),
  - `createdBy` (Cognito sub),
  - `createdAt`, `updatedAt`,
  - `note` (optional).
- **GSI:** `by-user-date` — hash `userId`, range `sk` → list transactions by user across groups, ordered by date.

**Access patterns:**
- List by group and date: Query table PK = groupId, SK between `date#` and `date#` (prefix) or `dateBegin#` and `dateEnd#` for range.
- List by group for a day: Query PK = groupId, SK begins_with `2025-03-03#`.
- List by group for a month: Query PK = groupId, SK between `2025-03-01#` and `2025-03-31#`.
- List by group for date range: Query PK = groupId, SK between `startDate#` and `endDate#`.
- List by user and date: Query GSI by-user-date, PK = userId, SK between `startDate#` and `endDate#`.
- Get one: GetItem (groupId, sk = `date#transactionId`).
- Create: PutItem with sk = `date#transactionId`; set createdAt, updatedAt, createdBy, userId.

---

## Example Queries (DynamoDB API)

### Transactions: list by group for a date range

```text
Table: transactions
Operation: Query
KeyConditionExpression: groupId = :gid AND sk BETWEEN :start AND :end
ExpressionAttributeValues: :gid = "<groupId>", :start = "2025-03-01#", :end = "2025-03-31#"
```

### Transactions: list by user for a month

```text
Index: by-user-date
Operation: Query
KeyConditionExpression: userId = :uid AND sk BETWEEN :start AND :end
ExpressionAttributeValues: :uid = "<cognito-sub>", :start = "2025-03-01#", :end = "2025-03-31#"
```

### Group members: list groups for a user

```text
Index: by-user
Operation: Query
KeyConditionExpression: userId = :uid
ExpressionAttributeValues: :uid = "<cognito-sub>"
```

### Categories: list for a group

```text
Table: categories
Operation: Query
KeyConditionExpression: groupId = :gid
ExpressionAttributeValues: :gid = "<groupId>" or "GLOBAL"
```

---

## Audit Fields

All mutable entities must set:

| Field      | Type   | When to set      |
|-----------|--------|-------------------|
| `createdAt` | ISO8601 | On create         |
| `updatedAt` | ISO8601 | On create and update |
| `createdBy` | string (Cognito sub) | On create |

Transactions also have `userId` (owner). Optionally add `lastModifiedBy` on update (Phase 8).

---

## Default Categories (Seed Approach)

- **Option A (recommended):** When creating a new group (Phase 3 API), the API creates default category items in `categories` with `groupId` = that group’s id (or use `groupId = "GLOBAL"` and reference them from all groups).
- **Option B:** One-off script or Lambda (e.g. Terraform `null_resource` + `aws dynamodb batch_write_item`) to seed `GLOBAL` categories once.

Suggested default category names (configurable in API or config):

- Food & Dining  
- Transport  
- Utilities  
- Shopping  
- Entertainment  
- Health  
- Other  

Store in app config or as constants in the API; create category items with `groupId = "GLOBAL"` (or per-group) when a group is created or on first use.

---

## Done When (Phase 1)

- [x] Entity design and PK/SK locked in DynamoDB (see `infra/modules/data/main.tf`).
- [x] GSIs support list by user, by group, by date/day/month/range.
- [x] Audit fields documented and required for Transactions (and optionally Groups, Categories).
- [x] Access patterns and example queries documented for API implementation (Phase 3).
