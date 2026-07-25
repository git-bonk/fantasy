# Deploy to a VPS (DigitalOcean + Cloudflare Tunnel)

This guide deploys the full stack — the Next.js dashboard (`web`) and the Python
pipeline/cron (`pipeline`) — to a single DigitalOcean droplet using the existing
`docker-compose.yml`, with HTTPS via a Cloudflare Tunnel. No ports are exposed to the
internet except SSH; the tunnel dials *out* to Cloudflare.

**Target:** Ubuntu 24.04, 1 GB RAM (+ swap), ~20 users.

---

## Prerequisites

- A DigitalOcean account.
- A domain whose DNS is managed by **Cloudflare** (free plan). Add the site in Cloudflare
  and point your registrar's nameservers to Cloudflare before you start.
- An SSH key on your own computer (see step 2 if you need to create one).

---

## 1. Create the droplet

1. Log in at **cloud.digitalocean.com** → **Create** → **Droplets**.
2. **Choose an image:** *Marketplace* tab → search **"Docker"** → pick
   **"Docker on Ubuntu 24.04"** (Docker comes pre-installed).
   *(Alternative: OS Images → Ubuntu 24.04 LTS, then install Docker manually in step 3.)*
3. **Choose a size:** *Basic → Regular (SSD)* → the **$6/mo** tier
   (**1 vCPU · 1 GB RAM · 25 GB SSD**).
4. **Region:** pick the datacenter closest to you.
5. **Authentication:** select **SSH key** and paste your *public* key (see step 2).
6. **Options:** leave **Monitoring** on; **Backups** optional; skip the rest.
7. **Finalize:** `1` droplet, hostname e.g. `fantasynfl` → **Create Droplet**.

Wait ~30–60 s for the IP to appear on the Droplets page.

## 2. (If needed) create an SSH key on your computer

```bash
ssh-keygen -t ed25519 -C "you@example.com"   # accept the prompts
cat ~/.ssh/id_ed25519.pub                     # copy this output → paste into DO (step 1.5)
```

## 3. Connect & prepare the droplet

```bash
ssh root@<droplet-ip>        # type "yes" at the fingerprint prompt the first time
```

If you used the plain Ubuntu image (not the Docker marketplace one), install Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Add swap so the in-Docker build doesn't run out of memory on a 1 GB droplet:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile \
  && mkswap /swapfile && swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Get the app running

```bash
apt install -y git                      # if not already present
git clone <your-repo> && cd fantasynfl

cp .env.example .env                    # fill ESPN creds, or leave blank for sample data
```

**Security tweak (one line):** bind the dashboard to localhost only, so *only* the tunnel
can reach it. Edit `docker-compose.yml` and change the `web` port:

```diff
     ports:
-      - "3000:3000"
+      - "127.0.0.1:3000:3000"
```

Then build and start:

```bash
docker compose up --build -d
curl http://localhost:3000              # should return HTML (run this on the droplet)
```

> The `pipeline` container seeds a sample season on first boot if there's no DB, so the
> dashboard has data immediately. With ESPN creds in `.env`, it ingests your real league.

## 5. Firewall

No inbound ports are needed except SSH (the tunnel is outbound-only):

```bash
ufw allow 22/tcp
ufw enable
```

Port 3000 is bound to `127.0.0.1` (step 4), so it isn't reachable from the internet anyway.

## 6. Cloudflare Tunnel (HTTPS)

Install `cloudflared`:

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb
```

Create the tunnel in the **Zero Trust dashboard** (no config files needed):

1. Go to <https://one.dash.cloudflare.com> → **Networks → Tunnels → Create a tunnel**.
2. Connector: **Cloudflared** → name it (e.g. `fantasynfl`) → **Save tunnel**.
   It displays an install **token**.
3. On the droplet, install it as a service with that token:

   ```bash
   cloudflared service install <TOKEN>
   systemctl enable --now cloudflared
   ```

4. Back in the dashboard the connector shows **Connected**. Open the **Public Hostname**
   tab → **Add a public hostname**:
   - **Subdomain:** `fantasy` (or leave blank for the root domain)
   - **Domain:** `yourdomain.com`
   - **Type:** `HTTP` · **URL:** `localhost:3000`
   - **Save.** Cloudflare creates the DNS record automatically.

Visit **https://fantasy.yourdomain.com** — the dashboard loads over HTTPS.

> **Quick smoke test (optional, no account):** `cloudflared tunnel --url http://localhost:3000`
> prints a temporary `https://<random>.trycloudflare.com` URL to verify the app before
> wiring up the permanent tunnel.

## 7. Verify the weekly refresh

```bash
docker compose logs -f pipeline
```

The container seeds/ingests on boot and re-runs `fantasynfl ingest` every **Monday 06:00**.
Each refresh shows up on the next page load — no redeploy needed.

---

## Updating the app

```bash
cd ~/fantasynfl
git pull
docker compose up --build -d
```

## Manual data refresh

```bash
docker compose exec pipeline fantasynfl ingest     # real league (needs .env creds)
docker compose exec pipeline fantasynfl sample     # regenerate sample data
```

## Backups

The only persistent state is the SQLite DB on the `league-data` Docker volume. Copy it out:

```bash
docker compose exec pipeline cp /data/fantasynfl.db /data/backup-$(date +%F).db
docker compose cp pipeline:/data/backup-$(date +%F).db ./   # then scp it off-box
```

Or enable DigitalOcean **Backups** (droplet snapshots) when creating the droplet.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build killed / OOM | Add swap (step 3) or use a 2 GB droplet. |
| `gyp ERR! find Python` during `docker compose up --build` | The web image needs `python3`, `make`, and `g++` to compile `better-sqlite3`. These are installed in the `deps` stage of `web/Dockerfile` — pull the latest code (`git pull`) and rebuild. |
| `curl localhost:3000` fails on droplet | `docker compose ps` / `docker compose logs web` — is the container up? |
| Tunnel shows **Disconnected** | `systemctl status cloudflared`; re-run `cloudflared service install <TOKEN>`. |
| Domain doesn't resolve | Confirm the domain's nameservers point to Cloudflare; check the auto-created CNAME in Cloudflare DNS. |
| Dashboard says "League data unavailable" | The DB is missing — check `pipeline` logs; ensure the `league-data` volume is mounted. |
| Can reach `:3000` publicly (you skipped step 4) | Apply the `127.0.0.1:3000:3000` bind and `docker compose up -d` again. |
