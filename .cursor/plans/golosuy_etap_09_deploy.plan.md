---
name: "Golosuy — Этап 9: Развёртывание"
overview: Dockerfile, Cloudflare Pages, GitHub Pages — статический деплой без бэкенда.
todos:
  - id: deploy
    content: "Деплой: Dockerfile + nginx, Cloudflare Pages, инструкция в README"
    status: pending
isProject: false
---

# Этап 9. Развёртывание

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

## Вариант A — Cloudflare Pages (рекомендуется для простоты)

- `npm run build` → деплой папки `dist/`
- Автоматический HTTPS, CDN, preview-деплои из PR
- Команда: `npx wrangler pages deploy dist` или GitHub-интеграция

## Вариант B — Docker (для self-hosting)

```dockerfile
# nginx:alpine, копирует dist/, gzip, cache headers
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
```

- `docker-compose.yml` с портом 8080
- Подходит для VPS; **обязателен TLS** (Caddy/Traefik перед nginx или certbot)

## Вариант C — GitHub Pages

Бесплатно, HTTPS есть.

Все варианты — статика, без бэкенда.
