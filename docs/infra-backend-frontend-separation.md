# Segregating infra, backend, and frontend

Suggestions for separating **infrastructure** (Terraform) from **backend** (Lambda app code) and **frontend** (React app) in the Saven repo.

**Status:** The recommended layout is in place: `backend/` at repo root, `frontend/` unchanged, `infra/` Terraform-only with `backend_source_path` pointing at `../backend`.

## Previous layout (before move)

```
saven/
├── frontend/           # React app (already at root)
├── infra/              # Terraform root + modules
│   ├── main.tf
│   ├── variables.tf
│   └── modules/
│       ├── api/        # Lambda + API Gateway + backend SOURCE CODE (mixed)
│       │   ├── main.tf, variables.tf, ...
│       │   └── src/   # ← Backend (handlers, db, router, telegram, …)
│       ├── auth/
│       ├── data/
│       └── frontend/  # S3, CloudFront only (no app source)
├── docs/
└── scripts/
```

**Issue:** Backend application code lives inside the Terraform API module (`infra/modules/api/src/`). Infra and backend are coupled; changing one often means touching the same module.

---

## Recommended: move backend to repo root

**Target layout:**

```
saven/
├── backend/            # Lambda runtime code only (new)
│   ├── package.json
│   ├── package-lock.json
│   ├── index.js
│   ├── router.js
│   ├── db.js
│   ├── responses.js
│   ├── telegram.js
│   ├── telegramNlp.js
│   └── handlers/
│       ├── groups.js
│       ├── categories.js
│       ├── transactions.js
│       ├── ...
├── frontend/
├── infra/              # Terraform only
│   ├── main.tf
│   └── modules/
│       ├── api/        # Only .tf files; no src/
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── (build references ../backend or ../../backend)
│       ├── auth/
│       ├── data/
│       └── frontend/
├── docs/
└── scripts/
```

**Benefits**

- **Infra** = only Terraform (resources, IAM, packaging of artifacts).
- **Backend** = single place for Lambda code, tests, and dependencies (`npm install` in `backend/`).
- **Frontend** = unchanged at `frontend/`.
- Clear ownership: backend devs work in `backend/`, infra in `infra/`.

**Steps**

1. Create `backend/` at repo root.
2. Move everything under `infra/modules/api/src/` into `backend/` (keep structure: `handlers/`, `index.js`, `router.js`, etc.).
3. In `infra/modules/api/main.tf`, point the Lambda zip at the new path:
   - From root: `source_dir = "${path.root}/../backend"` won’t work when Terraform runs from `infra/` because `path.root` is `infra/`. So either:
   - **Option 3a:** Run Terraform from repo root and set `source = "./infra/modules/api"` and `source_dir = "${path.root}/backend"`, or
   - **Option 3b (simplest):** Pass the backend path from the root module into the api module, e.g. `backend_source_path = "${path.root}/../backend"` (when root module is in `infra/`, `path.root` is `infra`, so `../backend` is repo-root `backend`). So in `infra/main.tf` add:
     ```hcl
     module "api" {
       source = "./modules/api"
       ...
       backend_source_path = "${path.cwd}/../backend"   # or abspath if you prefer
     }
     ```
   - In `infra/modules/api/main.tf` use `source_dir = var.backend_source_path` and `output_path = "${path.module}/build/api.zip"` (or a path under `build/`). Ensure `archive_file` runs so the zip is created from `backend/`.
4. Add `backend/` to `.gitignore` only for build artifacts (e.g. `backend/node_modules` is usually not committed; `backend/` itself is committed).
5. Update **scripts and docs**: e.g. “run `npm install` in `backend/`” instead of “in `modules/api/src/`”. Update `infra/README.md` and `docs/dev-phases.md` / `docs/local-testing.md` to reference `backend/`.
6. Remove the empty `infra/modules/api/src/` after the move and a successful `terraform plan` / `apply`.

**Caveat:** If you run `terraform` only from `infra/`, `path.root` is `infra` and `path.cwd` can be `infra` or the repo root depending on where you run from. Prefer a variable, e.g. `backend_source_path`, set in the root module to something like `"${dirname(path.root)}/backend"` so it always points to repo-root `backend` regardless of cwd.

---

## Alternative: keep backend in infra but in a dedicated sibling folder

If you prefer not to add a repo-root `backend/`:

- Create `infra/backend/` (sibling to `infra/modules/`) and move `infra/modules/api/src/*` there.
- In `infra/modules/api/main.tf` set `source_dir = "${path.root}/../backend"` (when root is `infra`, that’s `infra/backend`).

Then infra still “owns” the backend path, but Terraform files and Lambda source are in different directories under `infra/`. Less separation than repo-root `backend/`, but no need to pass paths from root.

---

## Frontend

Frontend is already segregated at `frontend/`. No change needed. Deploy script (`scripts/deploy-frontend.sh`) already builds from `frontend/` and syncs to S3; keep that.

---

## Optional: separate repos (infra / backend / frontend)

For larger teams or strict ownership:

- **infra repo:** Terraform only; references backend and frontend via build artifacts (e.g. Lambda zip from S3 or from a CI upload; frontend from S3/CloudFront).
- **backend repo:** Lambda code; CI builds zip and publishes to S3 (or container image); infra deploys that artifact.
- **frontend repo:** React app; CI builds and deploys to S3/CloudFront (or infra pulls from a known artifact).

This adds CI/CD and possibly versioning/artifact promotion. Only worth it if you need separate release cycles or access control per repo.

---

## Summary

| Approach | Effort | Result |
|----------|--------|--------|
| **Move backend to repo root `backend/`** | Medium (move files + Terraform path variable) | Clear split: infra = Terraform, backend = Lambda code, frontend = React. |
| **Move backend to `infra/backend/`** | Low (move under infra, fix path in api module) | Infra and backend code in different dirs but under same `infra/` tree. |
| **Separate repos** | High (CI, artifacts, possibly new infra) | Full segregation and independent release cycles. |

Recommendation: **move backend to repo root `backend/`** and point the API module’s Lambda zip at it via a variable. That gives a clean separation with minimal ongoing cost.
