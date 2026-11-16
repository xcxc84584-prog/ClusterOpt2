# PR3 Patch(+2) — accessibility and integration acceptance

## Motivation
PR3 Patch(+1) added zh-Hant/en and passed its first automated run,
but some menu/dialog accessibility labels remained in Chinese when
English mode was selected.

## Changes
- Language catalogue adds fileMenu, toolsGroup and closeDialog keys.
- Language UI adapter localizes aria-label on File menu, Tools group
  and Palette close button with no extra Object or Property.
- Chromium assertion verifies accessible labels change with locale.
- LinkCore centrally publishes version 0.0.3-pr3.patch2.

## Relation / EHU
UI → HubUnit → LanguageManager.set(en) → EDPMU(Language)
→ translated menu and ARIA text. Invalid locale 400/EHU and
unauthorized Agent mutation 403/EHU remain in force.

## Scope and capacity
Same shared Language Property and existing FIFO scheduling;
no new network calls or storage. UI repaint O(visible text nodes).
The original ClusterOpt UI styles and geometry are preserved.

## Verification
Final Node and browser CI jobs must pass at latest head.
Native Windows Chrome visual comparison remains for manual acceptance.

## Automated verification — source commit c1e2a98b
- GitHub Actions verify: SUCCESS; 43 / 43 Node tests passed;
  conventions scan passed on 30 source files.
- GitHub Actions browser: SUCCESS; 9 / 9 Chromium tests passed.
- Manual native Windows UI/permissions acceptance remains a separate review.
- PR3 is implemented, CI-green, and stays a Draft PR until merger requested.
