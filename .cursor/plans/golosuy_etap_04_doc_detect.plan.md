---
name: "Golosuy — Этап 4: Детекция бюллетеня"
overview: "Опциональная фаза 2: OpenCV-пайплайн поиска бюллетеня на фото, perspective transform. Не входит в MVP."
todos:
  - id: doc-detect
    content: "Детекция бюллетеня: контуры, perspective transform, fallback ручных углов"
    status: cancelled
isProject: false
---

# Этап 4. Детекция бюллетеня (OpenCV.js) — отложен

Обзор проекта: [golosuy_web_service_f33e701e.plan.md](golosuy_web_service_f33e701e.plan.md)

**Статус: не входит в MVP.** Для первой версии достаточно [этапа 5](golosuy_etap_05_checkbox_detect.plan.md): детекция квадратиков на оригинальном фото и выбор варианта пользователем.

## Когда имеет смысл вернуться к этапу

- На реальных фото `checkboxDetect` часто промахивается из-за сильного наклона (квадратики выглядят как трапеции).
- В кадре много посторонних прямоугольников, и кластеризация не отсекает шум.
- Пользователи систематически снимают бюллетень издалека, а не крупным планом.

## Пайплайн (если понадобится)

Файлы: [`src/lib/cv/documentDetect.ts`](../../src/lib/cv/documentDetect.ts), [`src/lib/cv/perspective.ts`](../../src/lib/cv/perspective.ts)

1. Resize для скорости (max 1500px по длинной стороне), сохранить scale-фактор для обратного маппинга координат
2. Grayscale → Gaussian blur → Canny edges
3. `findContours` → аппроксимация полигонов → фильтр четырёхугольников по площади и aspect ratio
4. Выбор наибольшего прямоугольника как бюллетень (или топ-3 кандидата на выбор пользователем)
5. Perspective transform (`warpPerspective`) для выравнивания — упрощает поиск квадратиков
6. Координаты квадратиков маппить обратно в пространство оригинала для `drawMark`
