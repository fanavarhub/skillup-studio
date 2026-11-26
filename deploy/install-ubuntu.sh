#!/usr/bin/env bash
# Run from the checked-out Skill Up release as the DevOps operator.
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
log() { printf '\n==> %s\n' "$*"; }
ask() {
  local label=$1 default=${2:-} value
  read -r -p "$label${default:+ [$default]}: " value || return 1
  printf '%s' "${value:-$default}"
}
password() {
  local first second
  while :; do
    read -rs -p 'Application admin password (16+ characters): ' first || return 1
    printf '\n' >&2
    if (( ${#first} < 16 )) || [[ $first == *"'"* || $first == *\\* || $first =~ [[:cntrl:]] ]]; then
      printf 'Use at least 16 characters without single quotes, backslashes or control characters.\n' >&2
      continue
    fi
    read -rs -p 'Repeat the admin password: ' second || return 1
    printf '\n' >&2
    if [[ $first == "$second" ]]; then printf '%s' "$first"; return; fi
    printf 'Passwords did not match.\n' >&2
  done
}

case ${1:-} in
  --help|-h) printf 'Usage: sudo bash deploy/install-ubuntu.sh [--update]\n'; exit 0 ;;
  --update) mode=update ;;
  '') mode=install ;;
  *) die 'Unknown argument. Use --help.' ;;
esac
[[ $# -le 1 ]] || die 'Supply at most one option.'
[[ $EUID == 0 ]] || die 'Run this script with sudo on the Ubuntu server.'
[[ -f docker-compose.yml && -f Dockerfile ]] || die 'Run the script from the cloned Skill Up project.'
[[ -r /etc/os-release ]] || die 'Cannot identify the operating system.'
# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || die 'Ubuntu is required.'

canonical=skill-up.ir
container=skillup-studio
compose=(docker compose --env-file .env)
site=/etc/nginx/sites-available/skillup-managed.conf
enabled=/etc/nginx/sites-enabled/skillup-managed.conf
webroot=/var/www/skillup-acme
root_dir=$(pwd -P)
exec 9>/run/lock/skillup-deploy.lock
flock -n 9 || die 'Another Skill Up deployment is running.'
pending_site=0
env_tmp=
probe_path=
snapshot_path=
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n $env_tmp ]]; then rm -f -- "$env_tmp"; fi
  if [[ -n $probe_path ]]; then rm -f -- "$probe_path"; fi
  if [[ -n $snapshot_path ]]; then docker exec "$container" rm -f -- "$snapshot_path" >/dev/null 2>&1 || true; fi
  if (( status != 0 && pending_site )); then
    rm -f -- "$enabled" "$site"
    if nginx -t; then systemctl reload nginx || true; fi
  fi
  if (( status != 0 )); then
    printf '\nSetup stopped. Review the error above and the Docker/Nginx logs.\n' >&2
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ $mode == install ]]; then
  [[ -t 0 ]] || die 'First install requires an interactive terminal.'
  domain=$(ask 'Public domain (the current source uses skill-up.ir)' "$canonical")
  [[ $domain == "$canonical" ]] || die 'Configure the application canonical URLs before deploying to a different domain.'
  www=$(ask 'Include www.skill-up.ir and redirect it to the primary domain? (y/n)' n)
  [[ $www =~ ^[yn]$ ]] || die 'Answer y or n.'
  email=$(ask 'Email for Let’s Encrypt renewal notices')
  [[ $email =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die 'Enter a valid email address.'
  [[ $(ask 'Accept Let’s Encrypt subscriber agreement at https://letsencrypt.org/repository/ and install? (y/n)' n) == y ]] || die 'Installation cancelled.'
  if [[ ! -e .env ]]; then
    admin=$(ask 'Application admin username' admin)
    [[ $admin =~ ^[A-Za-z0-9_.-]{3,40}$ ]] || die 'Use 3–40 letters, digits, dots, underscores or hyphens.'
    admin_password=$(password)
    course=$(ask 'Free Scratch course ID' course-1)
    [[ $course =~ ^[A-Za-z0-9_-]+$ ]] || die 'Invalid course ID.'
    ga=$(ask 'Optional GA4 measurement ID (Enter to skip)')
    verification=$(ask 'Optional Search Console verification token (Enter to skip)')
    [[ -z $ga || $ga =~ ^G-[A-Z0-9]{5,20}$ ]] || die 'Invalid GA4 measurement ID.'
    [[ -z $verification || $verification =~ ^[A-Za-z0-9_-]{20,100}$ ]] || die 'Invalid Search Console token.'
  fi
  if command -v docker >/dev/null && ! docker compose version >/dev/null 2>&1; then
    die 'Existing Docker needs the Compose v2 plugin installed by its package manager. Install it, then re-run.'
  fi
  [[ ! -e $site && ! -L $enabled && ! -e $enabled ]] || die 'An installer-managed Nginx site already exists. Use --update.'
  if command -v nginx >/dev/null; then
    active_config=$(nginx -T 2>/dev/null) || die 'Fix the existing Nginx configuration first.'
    if awk -v domain="$canonical" -v www="$www" '
      $1 == "server_name" { for (i=2; i<=NF; i++) {
        name=$i; sub(/;$/, "", name)
        if (name==domain || (www=="y" && name=="www." domain)) found=1
      }}
      END { exit !found }' <<<"$active_config"; then
      die 'This hostname already has an Nginx configuration. Use --update from the existing deployment checkout.'
    fi
  fi
  log 'Installing Ubuntu prerequisites'
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl nginx certbot openssl
  if ! command -v docker >/dev/null; then
    log 'Installing Docker Engine and Compose from Docker’s APT repository'
    install -d -m 0755 /etc/apt/keyrings
    if [[ ! -e /etc/apt/keyrings/docker.asc ]]; then
      curl -fsSL --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      chmod 0644 /etc/apt/keyrings/docker.asc
    fi
    if [[ ! -e /etc/apt/sources.list.d/docker.sources && ! -e /etc/apt/sources.list.d/docker.list ]]; then
      cat >/etc/apt/sources.list.d/docker.sources <<APT
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
APT
      chmod 0644 /etc/apt/sources.list.d/docker.sources
    fi
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
  systemctl enable --now docker nginx
else
  log 'Checking the existing deployment'
  [[ -f .env ]] || die 'The existing .env is missing. Run from the active deployment checkout.'
fi

docker info >/dev/null
docker compose version >/dev/null
if docker inspect "$container" >/dev/null 2>&1; then
  active_dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$container")
  [[ $active_dir == "$root_dir" ]] || die "The active container belongs to $active_dir. Use that checkout to preserve its data."
elif [[ $mode == update ]]; then
  die 'The existing Skill Up container was not found.'
fi

if [[ ! -e .env ]]; then
  log 'Creating private application settings'
  env_tmp=$(mktemp .env.install.XXXXXXXX)
  {
    printf "APP_URL='https://%s'\nPUBLIC_BASE_URL='https://%s'\n" "$canonical" "$canonical"
    printf "SKILLUP_ADMIN_USERNAME='%s'\nSKILLUP_ADMIN_PASSWORD='%s'\n" "$admin" "$admin_password"
    printf "SKILLUP_SESSION_SECRET='%s'\nSCRATCH_LESSON_ADMIN_TOKEN='%s'\n" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)"
    printf "FREE_SCRATCH_COURSE_ID='%s'\nGA_MEASUREMENT_ID='%s'\nGOOGLE_SITE_VERIFICATION='%s'\n" "$course" "$ga" "$verification"
    printf "SCRATCH_LESSON_TRUST_PROXY='1'\n"
  } >"$env_tmp"
  if [[ -n ${SUDO_UID:-} && -n ${SUDO_GID:-} ]]; then chown "$SUDO_UID:$SUDO_GID" "$env_tmp"; fi
  ln -- "$env_tmp" .env || die '.env appeared during setup. Re-run to use it.'
  rm -f -- "$env_tmp"
  env_tmp=
  unset admin_password
else
  [[ -f .env && ! -L .env ]] || die '.env must be a regular local file.'
  chmod 0600 .env
  log 'Keeping the existing .env and credentials'
fi
unset APP_URL PUBLIC_BASE_URL SKILLUP_ADMIN_USERNAME SKILLUP_ADMIN_PASSWORD SKILLUP_SESSION_SECRET \
  SCRATCH_LESSON_ADMIN_TOKEN SCRATCH_LESSON_TRUST_PROXY FREE_SCRATCH_COURSE_ID \
  FREE_SCRATCH_REPLACED_COURSE_ID GA_MEASUREMENT_ID GOOGLE_SITE_VERIFICATION
"${compose[@]}" config --quiet
if [[ ! -e data ]]; then install -d -m 0750 -o 1000 -g 1000 data; fi
[[ -d data && ! -L data ]] || die 'data must be a real directory.'

if [[ $mode == update ]]; then
  [[ $(docker inspect --format '{{.State.Running}}' "$container") == true ]] || die 'Start the existing container before taking its SQLite backup.'
  log 'Backing up the existing SQLite databases'
  backup_dir=$(mktemp -d /var/backups/skillup.XXXXXXXX)
  docker inspect --format '{{.Image}}' "$container" >"$backup_dir/previous-image.txt"
  for db in skillup-studio.sqlite scratch-comments.sqlite; do
    if docker exec "$container" test -f "/app/data/$db"; then
      snapshot_path="/tmp/$(basename "$backup_dir")-$db"
      docker exec "$container" node --input-type=module -e '
        import { DatabaseSync, backup } from "node:sqlite";
        const db = new DatabaseSync(process.argv[1], { readOnly: true });
        await backup(db, process.argv[2]);
        db.close();
      ' "/app/data/$db" "$snapshot_path"
      docker cp "$container:$snapshot_path" "$backup_dir/$db"
      docker exec "$container" rm -f -- "$snapshot_path"
      snapshot_path=
    fi
  done
  printf 'Backup directory: %s\n' "$backup_dir"
fi

log 'Building and starting Skill Up'
"${compose[@]}" build skillup
"${compose[@]}" up -d --no-deps skillup
curl --noproxy '*' --retry 20 --retry-all-errors --retry-delay 2 --max-time 5 -fsS http://127.0.0.1:4050/api/health
printf '\n'
curl --noproxy '*' --max-time 10 -fsS -o /dev/null http://127.0.0.1:4050/magazine/scratch-costume-animation

if [[ $mode == install ]]; then
  domains=("$canonical")
  cert_args=(-d "$canonical")
  if [[ $www == y ]]; then
    domains+=("www.$canonical")
    cert_args+=(-d "www.$canonical")
  fi
  install -d -m 0755 "$webroot" "$webroot/.well-known" "$webroot/.well-known/acme-challenge"
  pending_site=1
  cat >"$site" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${domains[*]};
    location ^~ /.well-known/acme-challenge/ { root $webroot; }
    location / { return 404; }
}
NGINX
  ln -s -- "$site" "$enabled"
  nginx -t
  systemctl reload nginx

  log 'Verifying DNS and HTTP reachability for certificate issuance'
  probe=$(openssl rand -hex 16)
  probe_path="$webroot/.well-known/acme-challenge/$probe"
  printf '%s' "$probe" >"$probe_path"
  chmod 0644 "$probe_path"
  for host in "${domains[@]}"; do
    [[ $(curl --noproxy '*' --max-time 15 -fsS "http://$host/.well-known/acme-challenge/$probe") == "$probe" ]] ||
      die "The ACME challenge did not reach this server for $host. Check DNS and inbound port 80."
  done

  log 'Issuing and installing the HTTPS certificate'
  certbot certonly --non-interactive --agree-tos --email "$email" --webroot -w "$webroot" \
    --cert-name "$canonical" --keep-until-expiring "${cert_args[@]}"
  cert_dir="/etc/letsencrypt/live/$canonical"
  cat >"$site" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${domains[*]};
    location ^~ /.well-known/acme-challenge/ { root $webroot; }
    location / { return 301 https://$canonical\$request_uri; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $canonical;
    ssl_certificate $cert_dir/fullchain.pem;
    ssl_certificate_key $cert_dir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 500m;
    location / {
        proxy_pass http://127.0.0.1:4050;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
NGINX
  if [[ $www == y ]]; then
    cat >>"$site" <<NGINX
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.$canonical;
    ssl_certificate $cert_dir/fullchain.pem;
    ssl_certificate_key $cert_dir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    return 301 https://$canonical\$request_uri;
}
NGINX
  fi
  nginx -t
  systemctl reload nginx
  install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
  hook=/etc/letsencrypt/renewal-hooks/deploy/skillup-reload-nginx
  if [[ ! -e $hook ]]; then
    printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' >"$hook"
    chmod 0755 "$hook"
  fi
  systemctl enable --now certbot.timer
  if [[ $www == y ]]; then
    curl --noproxy '*' --max-time 20 -fsSL -o /dev/null "https://www.$canonical/api/health"
  fi
fi

log 'Checking the public domain and magazine'
curl --noproxy '*' --max-time 20 -fsS "https://$canonical/api/health"
printf '\n'
curl --noproxy '*' --max-time 20 -fsS -o /dev/null "https://$canonical/magazine/scratch-costume-animation"
pending_site=0
"${compose[@]}" ps
printf '\nSite: https://%s\nArticle: https://%s/magazine/scratch-costume-animation\nAdmin: https://%s/admin\n' "$canonical" "$canonical" "$canonical"
