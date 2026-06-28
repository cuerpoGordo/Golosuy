---
name: "Golosuy — Этап 8: Тестирование"
overview: Unit-тесты CV и EXIF, e2e Playwright, ручная проверка на мобильных браузерах.
todos:
  - id: tests
    content: "Тесты: CV-фикстуры, EXIF-побайтовое сравнение, Playwright e2e"
    status: pending
isProject: false
---

# Этап 8. Тестирование

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

## Выполнено

- **Unit**: `preserveExif` — сравнение EXIF-тегов до/после ([`preserveExif.test.ts`](../../src/lib/exif/preserveExif.test.ts))

## Осталось

- **Unit**: `checkboxDetect` на наборе тестовых изображений (положить в `src/lib/cv/__fixtures__/`)
- **E2E (Playwright)**: загрузка файла-фикстуры → выбор варианта → скачивание (без реальной камеры в CI)
- Ручное тестирование на iOS Safari и Android Chrome (основные целевые браузеры)

**Примечание:** тесты `documentDetect` не нужны для MVP (этап 4 отложен).
