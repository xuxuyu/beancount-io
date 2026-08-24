# Beancount.io on Dokploy

Dokploy-specific deployment for the self-hosted Beancount.io stack.

## Domains

| Service | Hostname | Container port | Cloudflare |
| --- | --- | ---: | --- |
| Dashboard | `beancount.4ree.com` | 3000 | Proxied |
| Backend API | `beancount-api.4ree.com` | 4104 | Proxied |
| Gitea HTTP | `beancount-git.4ree.com` | 3000 | DNS only |
| Git SSH (phase 2) | `beancount-git.4ree.com:2222` | 2222 | DNS only |

## Create the Dokploy Compose service

1. Create a new Dokploy project named `beancount-io`.
2. Add a Compose service sourced from GitHub.
3. Repository: `https://github.com/xuxuyu/beancount-io`
4. Branch: `main`
5. Compose path: `deploy/dokploy/docker-compose.yml`
6. Copy `.env.example` into Dokploy's Environment panel.
7. Replace every `change-me` value before deployment.

Generate independent secrets on the server:

```bash
for name in AUTH_SECRET COOKIE_SECRET ADMIN_TOKEN METRICS_API_TOKEN \
  FAVA_API_ADMIN_PASSWORD GITEA_DB_PASSWORD BACKEND_DB_PASSWORD \
  GITEA_SECRET_KEY GITEA_INTERNAL_TOKEN GITEA_LFS_JWT_SECRET \
  GITEA_OAUTH2_JWT_SECRET
do
  printf '%s=' "$name"
  openssl rand -hex 32
done
```

For `COOKIE_SECRETS`, preserve the JSON array syntax:

```dotenv
COOKIE_SECRETS=["generated-cookie-secret"]
```

Use a real administrator email for `GITEA_ADMIN_EMAIL`.

## First deployment

Deploy with:

```dotenv
SSH_PROXY_ENABLED=false
SSH_PROXY_HOST_KEY=
```

The first build can take a while. Two one-shot services are expected to exit
successfully:

- `gitea-init`
- `backend-migrate`

All long-running services should become healthy.

## Add domains in Dokploy

After containers are created, add these domains:

- `dashboard` → `beancount.4ree.com`, port `3000`, HTTPS
- `backend-v2` → `beancount-api.4ree.com`, port `4104`, HTTPS
- `gitea` → `beancount-git.4ree.com`, port `3000`, HTTPS

Cloudflare SSL/TLS mode should be `Full (strict)`. If certificate issuance for
an orange-cloud hostname fails, temporarily switch that DNS record to DNS only,
issue the origin certificate through Dokploy, and then restore the proxy.

## Phase-one checks

```bash
curl -fsS https://beancount-api.4ree.com/healthz
curl -fsS https://beancount-git.4ree.com/api/healthz
curl -I https://beancount.4ree.com/
```

Do not enable SSH yet. Phase 2 extracts Gitea's existing host key, adds the
2222 port mapping, and then enables the backend SSH policy proxy.
