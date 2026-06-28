---
name: "Golosuy — Этап 2: Захват изображения"
overview: Компонент захвата фото с камеры или из галереи, сохранение исходного файла для EXIF.
todos:
  - id: camera
    content: "Компонент захвата: камера (getUserMedia) + fallback выбор файла"
    status: completed
isProject: false
---

# Этап 2. Захват изображения

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

**Статус: выполнен.**

## Выполнено

- [`useCamera.ts`](../../src/hooks/useCamera.ts), [`CameraCapture.tsx`](../../src/components/CameraCapture.tsx)
- Image Capture API для полного разрешения, fallback галерея / native capture
- [`createCapturedImage.ts`](../../src/lib/capture/createCapturedImage.ts) — `CapturedImage` с `exifBytes`

## Задачи

- Компонент `CameraCapture`: доступ к задней камере через `navigator.mediaDevices.getUserMedia` (`facingMode: environment`)
- Fallback: выбор файла из галереи (`<input type="file" accept="image/*">`)
- Сохранение исходного `File` / `ArrayBuffer` для последующей работы с EXIF
- Обработка ошибок: нет HTTPS, нет разрешения камеры, неподдерживаемый браузер
- Mobile-first layout: полноэкранный превью, крупные кнопки
