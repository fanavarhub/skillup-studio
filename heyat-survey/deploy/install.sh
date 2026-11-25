#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ ${1:-} == --help ]]; then
    printf '%s\n' 'Usage: bash deploy/install.sh [--reset-admin]' \
        'Installs the survey on Ubuntu with Docker, Nginx, and HTTPS.' \
        'Choose a dedicated domain or /heyat/ on an active HTTPS Nginx site.'
    exit 0
fi

reset_account=()
if [[ ${1:-} == --reset-admin && $# == 1 ]]; then
    reset_account=(--reset-admin)
elif (( $# != 0 )); then
    printf '%s\n' 'Usage: bash deploy/install.sh [--reset-admin]' >&2
    exit 2
fi

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
as_root() { "${elevation[@]}" "$@"; }
host_docker() { as_root docker --host unix:///var/run/docker.sock "$@"; }

[[ -t 0 && -t 1 ]] || fail 'Run this installer in an interactive SSH terminal.'
[[ -r /etc/os-release && -d /run/systemd/system ]] || fail 'This installer needs an Ubuntu server with systemd.'
# shellcheck source=/dev/null
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || fail 'This installer is for Ubuntu.'

elevation=()
if (( EUID != 0 )); then
    command -v sudo >/dev/null || fail 'This operator needs sudo.'
    elevation=(sudo)
    sudo -v
fi

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd -- "$project_dir"
[[ -f compose.yaml && -f Dockerfile && -f tools/setup.mjs ]] || fail 'Run this from the survey checkout.'
[[ "$project_dir" != *:* ]] || fail 'The checkout path cannot contain a colon.'
[[ ! -L .env ]] || fail 'Use a regular .env file in the checkout.'

unset ADMIN_USERNAME ADMIN_PASSWORD_HASH SESSION_SECRET BASE_PATH PUBLIC_BASE_URL COOKIE_SECURE TRUST_PROXY SURVEY_PORT BIND_ADDRESS

setting() {
    if [[ -f .env ]]; then
        awk -v name="$1" 'index($0, name "=") == 1 {sub(/\r$/, ""); value = substr($0, length(name) + 2)} END {print value}' .env
    fi
}
ask() {
    printf '%s ' "$1" >&2
    IFS= read -r answer || fail 'Installation cancelled.'
    printf '%s' "$answer"
}

current_origin=$(setting PUBLIC_BASE_URL)
current_prefix=$(setting BASE_PATH)
default_mode=1
[[ "$current_prefix" != /heyat ]] || default_mode=2
printf '%s\n' '1) Dedicated domain or subdomain' '2) /heyat/ on an existing HTTPS Nginx domain'
mode=$(ask "Deployment mode [$default_mode]:")
mode=${mode:-$default_mode}
prefix=''
specified_site=''
certificate=''
certificate_key=''
cert_mode=''
cert_email=''

case "$mode" in
    1) ;;
    2) prefix=/heyat ;;
    *) fail 'Choose 1 or 2.' ;;
esac

default_domain=${current_origin#https://}
if [[ -z "$default_domain" && "$mode" == 2 ]]; then default_domain=skill-up.ir; fi
domain=$(ask "Domain name [${default_domain:-your fully qualified domain}]:")
domain=${domain:-$default_domain}
domain=${domain,,}
domain=${domain%.}
[[ ${#domain} -le 253 && "$domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] ||
    fail 'Enter a DNS hostname without a protocol, path, wildcard, or port.'
origin="https://$domain"
getent ahosts "$domain" >/dev/null || fail "DNS does not resolve $domain. Set its A or AAAA record first."

if [[ "$mode" == 2 ]]; then
    specified_site=$(ask 'Active HTTPS Nginx configuration path [automatic detection]:')
    [[ -z "$specified_site" || "$specified_site" == /etc/nginx/* ]] ||
        fail 'Enter an absolute path under /etc/nginx, or leave it empty.'
else
    printf '%s\n' "1) Let's Encrypt via HTTP-01" '2) Existing certificate and private key files'
    cert_mode=$(ask 'Certificate mode [1]:')
    cert_mode=${cert_mode:-1}
    case "$cert_mode" in
        1)
            cert_email=$(ask 'Email address for Let’s Encrypt:')
            [[ "$cert_email" =~ ^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail 'Enter a valid email address.'
            terms=$(ask 'Accept the Let’s Encrypt Subscriber Agreement (https://letsencrypt.org/repository/) [y/N]?')
            [[ "$terms" == [yY] || "$terms" == [yY][eE][sS] ]] || fail 'Certificate request cancelled.'
            ;;
        2)
            certificate=$(ask 'Absolute path to the full certificate chain:')
            certificate_key=$(ask 'Absolute path to the private key:')
            for cert_file in "$certificate" "$certificate_key"; do
                [[ "$cert_file" =~ ^/[A-Za-z0-9_./-]+$ ]] && as_root test -f "$cert_file" ||
                    fail 'Enter readable absolute certificate paths without spaces.'
            done
            ;;
        *) fail 'Choose 1 or 2.' ;;
    esac
fi

printf '%s\n' 'Checking and installing Ubuntu packages.'
packages=()
apt_refreshed=0
add_package_if_missing() {
    if ! command -v "$1" >/dev/null; then packages+=("$2"); fi
}
install_packages() {
    if (( apt_refreshed == 0 )); then
        as_root apt-get update
        apt_refreshed=1
    fi
    as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-remove "$@"
}

add_package_if_missing curl curl
add_package_if_missing python3 python3
add_package_if_missing ss iproute2
add_package_if_missing nginx nginx
if ! dpkg-query -W -f='${Status}\n' ca-certificates 2>/dev/null | grep -qx 'install ok installed'; then
    packages+=(ca-certificates)
fi
if [[ "$cert_mode" == 1 ]]; then add_package_if_missing certbot certbot; fi

if ! command -v docker >/dev/null; then
    packages+=(docker.io docker-compose-v2 docker-buildx)
else
    if dpkg-query -W -f='${Status}\n' docker-ce-cli 2>/dev/null | grep -qx 'install ok installed'; then
        compose_pkg=docker-compose-plugin
        buildx_pkg=docker-buildx-plugin
    else
        compose_pkg=docker-compose-v2
        buildx_pkg=docker-buildx
    fi
    if ! host_docker compose version >/dev/null 2>&1; then packages+=("$compose_pkg"); fi
    if ! host_docker buildx version >/dev/null 2>&1; then packages+=("$buildx_pkg"); fi
fi
if (( ${#packages[@]} > 0 )); then install_packages "${packages[@]}"; fi

as_root systemctl enable --now docker
as_root systemctl enable --now nginx
host_docker info --format '{{.ServerVersion}}' >/dev/null
host_docker compose version >/dev/null

running_binding=''
existing_container=$(host_docker ps -aq --filter 'label=com.docker.compose.project=heyat-survey' \
    --filter 'label=com.docker.compose.service=survey')
if [[ -n "$existing_container" ]]; then
    [[ "$existing_container" != *$'\n'* ]] || fail 'Expected a single survey container. Check docker compose ps.'
    existing_checkout=$(host_docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$existing_container")
    [[ "$existing_checkout" == "$project_dir" ]] || fail "The survey is already installed in $existing_checkout. Run the installer from that checkout."
    running_binding=$(host_docker inspect -f '{{with index .NetworkSettings.Ports "3000/tcp"}}{{range .}}{{.HostIp}}:{{.HostPort}}{{end}}{{end}}' "$existing_container")
fi

port_available() {
    if [[ "$running_binding" == "127.0.0.1:$1" ]]; then return 0; fi
    local listening
    listening=$(ss -Hltn "sport = :$1") || fail "Could not check port $1."
    [[ -z "$listening" ]]
}

default_port=$(setting SURVEY_PORT)
if ! [[ "$default_port" =~ ^(748[0-9]|7490)$ ]] || ! port_available "$default_port"; then
    default_port=''
    for candidate in {7480..7490}; do
        if port_available "$candidate"; then default_port=$candidate; break; fi
    done
fi
[[ -n "$default_port" ]] || fail 'No free port in 7480–7490.'
while true; do
    port=$(ask "Local survey port (7480–7490) [$default_port]:")
    port=${port:-$default_port}
    if [[ "$port" =~ ^(748[0-9]|7490)$ ]] && port_available "$port"; then break; fi
    printf '%s\n' 'Choose an available port from 7480 to 7490.' >&2
done

work_dir=$(mktemp -d)
pending_target=''
config_backup=''
challenge_file=''
config_temp=''
cleanup() {
    local status=$?
    trap - EXIT
    if [[ -n "$challenge_file" ]]; then as_root rm -f -- "$challenge_file" || true; fi
    if [[ -n "$config_temp" ]]; then as_root rm -f -- "$config_temp" || true; fi
    if (( status != 0 )) && [[ -n "$pending_target" ]]; then
        printf '%s\n' 'Restoring the previous Nginx configuration.' >&2
        if {
            if [[ -n "$config_backup" ]]; then as_root cp -p -- "$config_backup" "$pending_target"
            else as_root rm -f -- "$pending_target"
            fi
        } && as_root nginx -t && as_root systemctl reload nginx; then
            printf '%s\n' 'Nginx configuration restored.' >&2
        else
            printf 'Restore Nginx manually. Target: %s. Backup: %s\n' "$pending_target" "${config_backup:-none}" >&2
        fi
    fi
    rm -f -- "$work_dir/nginx.dump" "$work_dir/site.conf" "$work_dir/challenge"
    rmdir -- "$work_dir"
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

webroot=/var/www/heyat-survey-acme
managed_site=/etc/nginx/conf.d/heyat-survey-"$domain".conf
renewal_name=heyat-survey-"$domain"
challenge_args=()
render_args=()
if [[ "$mode" == 2 ]]; then
    render_args=(shared)
    if [[ -n "$specified_site" ]]; then render_args+=(--site "$specified_site"); fi
else
    [[ ! -L "$managed_site" ]] || fail "Review the existing symlink at $managed_site."
    if as_root test -e "$managed_site" &&
        ! as_root grep -Fxq '# Managed by heyat-survey' "$managed_site"; then
        fail "The file $managed_site is already in use."
    fi
    render_args=(dedicated --site "$managed_site")
    if [[ "$cert_mode" == 1 ]]; then
        certificate="/etc/letsencrypt/live/$renewal_name/fullchain.pem"
        certificate_key="/etc/letsencrypt/live/$renewal_name/privkey.pem"
        challenge_args=(--acme-root "$webroot")
    fi
fi

render_site() {
    as_root nginx -T > "$work_dir/nginx.dump"
    as_root python3 "$project_dir/deploy/nginx-config.py" "${render_args[@]}" \
        --dump "$work_dir/nginx.dump" --domain "$domain" --port "$port" --output "$work_dir/site.conf" \
        "${challenge_args[@]}" "$@"
}

tls_args=()
if [[ -n "$certificate" ]] && as_root test -r "$certificate" && as_root test -r "$certificate_key"; then
    tls_args=(--certificate "$certificate" --key "$certificate_key")
elif [[ "$cert_mode" == 2 ]]; then
    fail 'The certificate and its private key must be readable by root.'
fi
target=$(render_site "${tls_args[@]}")
[[ "$target" == /etc/nginx/* ]] || fail 'The detected Nginx file is outside /etc/nginx.'

http() { curl -q --noproxy '*' --silent --show-error --connect-timeout 5 --max-time 15 "$@"; }
if [[ "$mode" == 2 ]]; then
    http --output /dev/null "$origin/" || fail "The existing HTTPS certificate for $domain could not be verified."
fi

node_image=$(awk '$1 == "FROM" { print $2; exit }' Dockerfile)
[[ "$node_image" == node:* ]] || fail 'Expected an official Node.js Docker image in Dockerfile.'
printf '%s\n' 'Configuring the survey administrator and application.'
host_docker run --rm -it --network none --cap-drop ALL --security-opt no-new-privileges \
    --user "$(id -u):$(id -g)" --volume "$project_dir:/app" --workdir /app \
    --env "HEYAT_DEPLOY_ORIGIN=$origin" --env "HEYAT_DEPLOY_BASE_PATH=$prefix" --env "HEYAT_DEPLOY_PORT=$port" \
    "$node_image" node tools/setup.mjs --configure-deployment "${reset_account[@]}"

compose() {
    host_docker compose --project-name heyat-survey --project-directory "$project_dir" \
        --env-file "$project_dir/.env" --file "$project_dir/compose.yaml" "$@"
}

health='{"status":"ok","storage":"sqlite"}'
wait_for_body() {
    local url=$1 expected=$2 reply attempt
    for attempt in {1..6}; do
        if reply=$(http --fail "$url" 2>/dev/null) && [[ "$reply" == "$expected" ]]; then return 0; fi
        sleep 2
    done
    return 1
}

printf '%s\n' 'Building and starting the survey container.'
compose config --quiet
compose up -d --build survey
if ! wait_for_body "http://127.0.0.1:$port$prefix/healthz" "$health"; then
    compose ps
    compose logs --tail 30 survey
    fail 'The survey container did not become healthy.'
fi

apply_nginx() {
    if [[ -z "$pending_target" ]]; then
        if as_root test -f "$target"; then
            as_root install -d -m 0700 /var/backups/heyat-survey/nginx
            config_backup=$(as_root mktemp /var/backups/heyat-survey/nginx/site.XXXXXXXX.conf)
            as_root cp -p -- "$target" "$config_backup"
        elif as_root test -e "$target"; then
            fail "The Nginx target is not a regular file: $target"
        fi
        pending_target=$target
    fi
    config_temp=$(as_root mktemp "$(dirname -- "$target")/.heyat-config.XXXXXXXX")
    as_root cp -- "$work_dir/site.conf" "$config_temp"
    if [[ -n "$config_backup" ]]; then
        as_root chown --reference="$config_backup" "$config_temp"
        as_root chmod --reference="$config_backup" "$config_temp"
    else
        as_root chmod 0644 "$config_temp"
    fi
    as_root mv -fT -- "$config_temp" "$target"
    config_temp=''
    as_root nginx -t
    as_root systemctl reload nginx
}

if [[ "$cert_mode" == 1 ]]; then
    printf '%s\n' 'Preparing certificate validation.'
    as_root install -d -m 0755 "$webroot/.well-known/acme-challenge"
    apply_nginx
    challenge_token="heyat-check-$(cat /proc/sys/kernel/random/uuid)"
    challenge_file="$webroot/.well-known/acme-challenge/$challenge_token"
    printf '%s' "$challenge_token" > "$work_dir/challenge"
    as_root install -m 0644 "$work_dir/challenge" "$challenge_file"
    wait_for_body "http://$domain/.well-known/acme-challenge/$challenge_token" "$challenge_token" ||
        fail "HTTP-01 could not reach $domain. Check DNS, IPv4/IPv6 routing, and public port 80."
    as_root certbot certonly --webroot --webroot-path "$webroot" --cert-name "$renewal_name" \
        --domain "$domain" --email "$cert_email" --agree-tos --non-interactive --keep-until-expiring \
        --deploy-hook '/usr/bin/systemctl reload nginx'
    as_root test -r "$certificate" && as_root test -r "$certificate_key" ||
        fail 'Certbot did not produce the expected certificate files.'
    confirmed_target=$(render_site --certificate "$certificate" --key "$certificate_key")
    [[ "$confirmed_target" == "$target" ]] || fail 'The Nginx target changed during certificate setup.'
    if command -v snap >/dev/null && snap list certbot >/dev/null 2>&1; then
        as_root systemctl is-active --quiet snap.certbot.renew.timer || fail 'The Certbot snap renewal timer is inactive.'
    else
        as_root systemctl enable --now certbot.timer
    fi
fi

printf '%s\n' 'Applying and verifying HTTPS.'
apply_nginx
wait_for_body "$origin$prefix/healthz" "$health" ||
    fail "HTTPS could not reach the survey at $origin$prefix/healthz."
admin_page=$(http --fail "$origin$prefix/admin")
[[ "$admin_page" == *'id="admin-username"'* && "$admin_page" == *'id="export-link"'* ]] ||
    fail 'HTTPS did not serve the expected admin page.'
export_status=$(http --output /dev/null --write-out '%{http_code}' "$origin$prefix/api/admin/export.xlsx")
[[ "$export_status" == 401 ]] || fail 'The Excel endpoint must require an administrator login.'
pending_target=''

printf '\nSurvey:  %s%s/\nAdmin:   %s%s/admin\nHealth:  %s%s/healthz\n' \
    "$origin" "$prefix" "$origin" "$prefix" "$origin" "$prefix"
printf 'Local backend: 127.0.0.1:%s\nSQLite volume: heyat-survey_survey_data (/app/data/survey.sqlite)\n' "$port"
if [[ -n "$config_backup" ]]; then printf 'Nginx backup: %s\n' "$config_backup"; fi
compose ps
