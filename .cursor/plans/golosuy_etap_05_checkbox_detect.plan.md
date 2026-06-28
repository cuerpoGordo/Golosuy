---
name: "Golosuy — Этап 5: Детекция квадратиков"
overview: Поиск чекбоксов на оригинальном фото, кластеризация, сортировка и визуализация рамок для выбора пользователем.
todos:
  - id: checkbox-detect
    content: "Детекция квадратиков: фильтрация контуров, сортировка, визуализация рамок"
    status: completed
isProject: false
---

# Этап 5. Детекция квадратиков (чекбоксов)

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

Детекция выполняется на **оригинальном** изображении (без perspective transform). Координаты bbox хранятся в пространстве исходного кадра.

## Предварительно: протокол OpenCV worker

Перед реализацией CV — postMessage-протокол в [`opencvWorkerClient.ts`](../../src/lib/cv/opencvWorkerClient.ts) и [`opencv-loader.worker.js`](../../public/opencv-loader.worker.js): передача ImageData/ArrayBuffer, выполнение операций в worker, возврат bbox.

## Пайплайн в [`src/lib/cv/checkboxDetect.ts`](../../src/lib/cv/checkboxDetect.ts)

1. Resize для скорости (max 1500px по длинной стороне), сохранить scale-фактор для обратного маппинга координат
2. Grayscale → Gaussian blur → Canny edges (или adaptive threshold)
3. `findContours` → фильтр почти-квадратов: `minAreaRect`, допуск aspect ratio ~0.65–1.35 (перспектива), площадь в заданном диапазоне
4. Кластеризация: квадратики бюллетеня образуют вертикальную колонку (близкий X, похожая площадь) — отсечь посторонние прямоугольники в кадре
5. Сортировка сверху вниз → список `Checkbox { bbox, index }` в координатах оригинала
6. Визуализация: рамки на превью + список «Вариант 1, 2, 3…»; пользователь выбирает нужный
7. **Fallback**: если найдено мало/много кандидатов — ручное добавление или уточнение тапом по превью

## Опционально (фаза 1.5)

- Tesseract.js OCR справа от квадратика для показа текста кандидата
