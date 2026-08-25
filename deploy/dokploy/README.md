# Beancount.io on Dokploy

Dokploy-specific deployment for the self-hosted Beancount.io stack.

## Domains

| Service           | Hostname                      | Container port | Cloudflare |
| ----------------- | ----------------------------- | -------------: | ---------- |
| Dashboard         | `beancount.4ree.com`          |           3000 | Proxied    |
| Backend API       | `beancount-api.4ree.com`      |           4104 | Proxied    |
| Gitea HTTP        | `beancount-git.4ree.com`      |           3000 | DNS only   |
| Git SSH (phase 2) | `beancount-git.4ree.com:2222` |           2222 | DNS only   |

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

The dashboard and API use sibling hostnames, so the authentication cookie must
be shared on their parent domain:

```dotenv
AUTH_COOKIE_DOMAIN=.4ree.com
```

Do not enter a URL or either service hostname here.

Use a real administrator email for `GITEA_ADMIN_EMAIL`.

## OAuth signing key for sandbox agents

The default `AGENT_MODE=self-hosted` runs the Agent and its tools in the same
backend process, so it does not need `OAUTH_JWKS`. If you switch to
`AGENT_MODE=sandbox`, the external Agent authenticates its MCP request with a
short-lived OAuth token and production needs a persistent private P-256/ES256
JWKS. Run this command on a trusted machine with Node.js installed:

```bash
node -e 'const {generateKeyPairSync,randomUUID}=require("node:crypto"); const {privateKey}=generateKeyPairSync("ec",{namedCurve:"P-256"}); const key=privateKey.export({format:"jwk"}); process.stdout.write(JSON.stringify({keys:[{...key,kid:randomUUID(),alg:"ES256",use:"sig"}]})+"\n")'
```

Copy the complete one-line JSON output into Dokploy as the value of
`OAUTH_JWKS`, without committing it to Git. Keep this value stable and include
it in encrypted deployment-secret backups. Rotating it invalidates OAuth access
tokens issued with the previous key.

## Self-hosted subscription tier

Dokploy defaults all accounts in this installation to the Enterprise tier,
without contacting Stripe:

```dotenv
SELF_HOSTED_TIER=ENTERPRISE
```

Supported values are `FREE`, `PREMIUM`, `GROWTH`, `ORGANIZATION`, and
`ENTERPRISE`. The override is deployment-wide; omit it only when this instance
is configured to use real Stripe subscriptions.

## OpenAI-compatible AI provider

To use a third-party endpoint that implements the OpenAI Responses API, set:

```dotenv
OPENAI_API_KEY=configure-this-secret-in-dokploy
OPENAI_BASE_URL=https://gateway.example.com/v1
OPENAI_MODEL=provider-model-id
OPENAI_API_MODE=responses
```

`OPENAI_BASE_URL` must include the provider's API version path, normally `/v1`.
Use `OPENAI_API_MODE=chat` only when the endpoint implements Chat Completions
but not Responses. Chat mode cannot send PDF URL file parts, so PDF imports
require Responses mode. The API key is read only by `backend-v2`; never commit
it.

`local-dev-placeholder` is only a boot sentinel for installations without AI
credentials. When `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is configured, the
backend skips that placeholder and calls the direct provider without first
making a failing BlockEden request.

Text exports are decoded as strict UTF-8 first, with UTF-16 BOM and GB18030
fallbacks for Chinese bank CSV files. Large text statements are divided into
bounded batches before structured extraction; the dashboard allows up to 90
seconds for the complete import request.

For statement imports, text-based PDFs are first converted to text locally with
Poppler and then use the same bounded-batch path. This avoids sending every PDF
page image through an OpenAI-compatible gateway. Scanned PDFs without a usable
text layer still fall back to Responses file input.

Excel `.xlsx` and legacy `.xls` statements are read locally. Each non-empty
worksheet is labelled and converted to CSV text before using the same bounded
LLM batches; formulas and macros are not executed.

## Bootstrap the first personal account

Before deploying, restrict registration to your own login email:

```dotenv
SIGNUP_ENABLED=true
SIGNUP_ALLOWED_EMAIL=your-login-email@example.com
SIGNUP_OTP_DELIVERY=log
```

Open the dashboard, choose **Sign Up**, and submit that exact email address.
Then open the `backend-v2` logs in Dokploy and search for:

```text
Self-hosted signup OTP generated
```

Enter the four-digit `otp` value within ten minutes. Treat this log entry as a
temporary authentication secret and do not share it.

After the account is created, change the deployment environment and redeploy:

```dotenv
SIGNUP_ENABLED=false
SIGNUP_ALLOWED_EMAIL=
```

The backend then rejects every new registration, and the rebuilt dashboard
hides the Sign Up link. Log delivery intentionally disables Forgot Password;
keep the account password in a password manager.

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

The dashboard's HTTP clone URL uses backend-v2's authenticated Git proxy:

```text
https://beancount-api.4ree.com/git/<username>/<repository>.git
```

At Git's credential prompt, use the Beancount account's complete email address
and normal Beancount password. Do not use the internal Gitea username here.

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

Do not enable SSH yet. Phase 2 extracts Gitea's existing host key and then
enables the backend SSH policy proxy. Compose already publishes TCP 2222 from
`backend-v2`; the process intentionally has no listener until both SSH settings
are present.

## Enable Git over SSH

The proxy must reuse Gitea's existing Ed25519 host key. From the server, resolve
the running Gitea container and write the key to a root-only temporary file:

```bash
GITEA_CONTAINER_ID="$(docker ps \
  --filter label=com.docker.compose.project=beancount-io-dokploy \
  --filter label=com.docker.compose.service=gitea \
  --format '{{.ID}}' | head -n 1)"
test -n "$GITEA_CONTAINER_ID"
umask 077
docker exec "$GITEA_CONTAINER_ID" \
  cat /data/ssh/ssh_host_ed25519_key > /tmp/beancount-gitea-host-key
```

Copy the complete private key into Dokploy as a quoted multiline value, then
enable the proxy:

```dotenv
SSH_PROXY_ENABLED=true
SSH_PROXY_HOST_KEY='-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----'
```

Redeploy, confirm the backend log contains `ssh proxy listening`, then delete
the temporary file:

```bash
rm -f /tmp/beancount-gitea-host-key
```

Keep `beancount-git.4ree.com` DNS-only in Cloudflare and allow inbound TCP 2222
in the server/provider firewall. Users add their public key in **Settings → SSH
Keys** before cloning with the SSH URL shown by the dashboard.
