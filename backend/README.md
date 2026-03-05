# Saven API (Lambda backend)

Lambda runtime for the Saven API: HTTP routes (groups, members, categories, transactions, export), JWT auth, and Telegram webhook.

- **Deploy:** Terraform in `infra/` packages this directory into a zip and deploys it to Lambda. Run `npm install` here before `terraform apply` so the zip includes dependencies (e.g. `pdfkit` for PDF export).
- **Local run:** From repo root, `cd backend`, set env vars (`GROUPS_TABLE`, etc.), then run the handler with Node or use `infra/modules/api/test-events/` for test payloads. See [docs/local-testing.md](../docs/local-testing.md).
