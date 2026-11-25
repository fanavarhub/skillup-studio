#!/usr/bin/env python3
"""Locate an active Nginx vhost and render the survey route without editing it."""

import argparse
from pathlib import Path
import re

MANAGED = '# Managed by heyat-survey'
BEGIN = '# BEGIN HEYAT SURVEY'
END = '# END HEYAT SURVEY'
TOKENS = re.compile(
    r'\s+|\#[^\n]*|[{};]|'
    r"""(?:\\[\s\S]|\$\{[^{}\s]+\}|"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[^\s{};#"'\\])+"""
)


def nginx_servers(source):
    """Yield server bodies and their direct directives, with source offsets."""
    stack = []
    statement = []
    for match in TOKENS.finditer(source):
        token = match.group()
        if token[0].isspace() or token.startswith('#'):
            continue
        if token == '{':
            if stack and statement and stack[-1][0] == ['server']:
                stack[-1][2].append(statement)
            stack.append((statement, match.end(), []))
            statement = []
        elif token == ';':
            if stack and statement and stack[-1][0] == ['server']:
                stack[-1][2].append(statement)
            statement = []
        elif token == '}':
            if not stack:
                raise ValueError('Unexpected closing brace in Nginx configuration.')
            header, start, directives = stack.pop()
            if header == ['server']:
                yield start, match.start(), directives
            statement = []
        else:
            statement.append(token[1:-1] if token[:1] in {"'", '"'} else token)
    if stack:
        raise ValueError('Unclosed block in Nginx configuration.')


def names(directives):
    return {name.lower().rstrip('.') for key, *args in directives if key == 'server_name' for name in args}


def uses_tls(directives):
    return any(key == 'listen' and 'ssl' in args or key == 'ssl' and args == ['on'] for key, *args in directives)


def active_sites(dump):
    files = set()
    for name in re.findall(r'^# configuration file (/.*):$', dump.read_text(encoding='utf-8'), re.M):
        files.add(Path(name).resolve(strict=True))
    if not files:
        raise ValueError('No configuration files found in nginx -T output.')
    return sorted(files)


def survey_proxy(port, prefix):
    location = f'^~ {prefix}/' if prefix else '/'
    redirect = f'    location = {prefix} {{ return 308 {prefix}/$is_args$args; }}\n' if prefix else ''
    return redirect + f"""    location {location} {{
        proxy_pass http://127.0.0.1:{port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_cache off;
        client_max_body_size 32k;
        proxy_read_timeout 60s;
    }}
"""


def find_shared_site(dump, domain, specific):
    matches = []
    for path in active_sites(dump):
        if specific and path != specific:
            continue
        content = path.read_text(encoding='utf-8')
        for start, end, directives in nginx_servers(content):
            if domain in names(directives) and uses_tls(directives):
                matches.append((path, content, start, end, directives))
    if len(matches) != 1:
        paths = ', '.join(sorted({str(match[0]) for match in matches}))
        raise ValueError(f'Expected one active HTTPS server block for {domain}. Found {len(matches)} {paths}.')
    return matches[0]


def shared_site(dump, domain, specific, port):
    path, content, start, end, directives = find_shared_site(dump, domain, specific)
    marked = f'    {BEGIN}\n{survey_proxy(port, "/heyat")}    {END}\n'
    body = content[start:end]
    if BEGIN in body or END in body:
        existing = re.compile(rf'(?m)^[ \t]*{re.escape(BEGIN)}[ \t]*\n.*?^[ \t]*{re.escape(END)}[ \t]*\n', re.S)
        if body.count(BEGIN) != 1 or body.count(END) != 1 or not existing.search(body):
            raise ValueError(f'Invalid survey markers in {path}.')
        body = existing.sub(lambda _: marked, body, count=1)
    else:
        for key, *args in directives:
            if key == 'location' and any(part == '/heyat' or part.startswith('/heyat/') for part in args):
                raise ValueError(f'The /heyat route is already configured in {path}. Review it before installing.')
        insert_at = len(body.rstrip(' \t'))
        before, closing_indent = body[:insert_at], body[insert_at:]
        body = before + ('' if before.endswith('\n') else '\n') + marked + closing_indent
    return path, content[:start] + body + content[end:]


def dedicated_site(dump, domain, target, port, acme_root=None, certificate=None, key=None):
    for path in active_sites(dump):
        content = path.read_text(encoding='utf-8')
        if path == target and content.startswith(MANAGED + '\n'):
            continue
        if any(domain in names(directives) for _, _, directives in nginx_servers(content)):
            raise ValueError(f'{domain} already has an active Nginx server block in {path}. Use a new subdomain or shared mode.')

    challenge = ''
    if acme_root:
        challenge = f"""    location ^~ /.well-known/acme-challenge/ {{
        root {acme_root};
        try_files $uri =404;
    }}
"""
    redirect = 'return 308 https://$host$request_uri;' if certificate else 'return 404;'
    result = f"""{MANAGED}
server {{
    listen 80;
    listen [::]:80;
    server_name {domain};
{challenge}    location / {{ {redirect} }}
}}
"""
    if certificate and key:
        result += f"""
server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {domain};
    ssl_certificate {certificate};
    ssl_certificate_key {key};
    ssl_protocols TLSv1.2 TLSv1.3;
{survey_proxy(port, '')}}}
"""
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['shared', 'dedicated'])
    parser.add_argument('--dump', type=Path, required=True)
    parser.add_argument('--domain', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--site', type=Path)
    parser.add_argument('--acme-root', type=Path)
    parser.add_argument('--certificate', type=Path)
    parser.add_argument('--key', type=Path)
    args = parser.parse_args()
    try:
        if args.mode == 'shared':
            specific = args.site.resolve(strict=True) if args.site else None
            path, content = shared_site(args.dump, args.domain, specific, args.port)
        else:
            path = args.site.resolve()
            content = dedicated_site(args.dump, args.domain, path, args.port, args.acme_root, args.certificate, args.key)
        args.output.write_text(content, encoding='utf-8')
        print(path)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
