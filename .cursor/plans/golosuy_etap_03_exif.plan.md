---
name: "Golosuy — Этап 3: Сохранение EXIF"
overview: Извлечение и вставка оригинального EXIF-блока без изменений при экспорте JPEG.
todos:
  - id: exif
    content: "Модуль EXIF: извлечение оригинального блока и вставка в итоговый JPEG + unit-тесты"
    status: completed
isProject: false
---

# Этап 3. Сохранение EXIF (критический путь)

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

**Статус: библиотека и unit-тесты готовы.** Подключение экспорта в UI — на [этапе 7](golosuy_etap_07_ui_flow.plan.md).

## Выполнено

- [`src/lib/exif/preserveExif.ts`](../../src/lib/exif/preserveExif.ts) — извлечение, вставка, экспорт canvas → JPEG с EXIF
- [`src/lib/exif/preserveExif.test.ts`](../../src/lib/exif/preserveExif.test.ts) — 5 unit-тестов (теги идентичны до/после)
- EXIF извлекается при захвате в `CapturedImage.exifBytes` ([`createCapturedImage.ts`](../../src/lib/capture/createCapturedImage.ts))

## Задачи (исходный план)

- При загрузке фото: извлечь EXIF-сегмент из исходного JPEG через `piexif.load(arrayBuffer)` — сохранить **как есть**, без парсинга/пересборки полей
- Для HEIC/PNG с камеры: конвертировать в JPEG для обработки, но EXIF из исходника сохранить только если он есть (iPhone HEIC — отдельный кейс, документировать ограничение)
- При экспорте: `canvas.toBlob('image/jpeg', quality)` → `piexif.insert(originalExifBytes, newJpegBytes)` → скачивание
- Unit-тест: сравнить EXIF до и после — все теги идентичны
