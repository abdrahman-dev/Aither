# Aither — UI/UX & Design Guidelines

> **Design System & Styling Rules**
> This document defines the visual identity of the Aither project. The AI Agent MUST strictly follow these guidelines, color codes, and component structures when building the frontend. 
> **Important:** While the initial prototype used inline styles, ALL production code MUST use **Tailwind CSS**. Map these hex codes to standard Tailwind utilities or extend the `tailwind.config.js`.

## 1. Core Theme & Typography
- **Vibe:** Light, refreshing, breathable, and safe.
- **Typography:** `Nunito` (Primary font for all text, headings, and numbers).
- **Font Weights:** `500` (Medium), `600` (SemiBold), `700` (Bold), `800` (ExtraBold), `900` (Black).

## 2. Color Palette

### 2.1 Backgrounds & Surfaces
- **App Background (Map Base):** `#EEF4F8` (Light grayish-blue).
- **Solid Cards/Inputs:** `#F8FAFC` (Slate 50).
- **Glassmorphism Panels:** `rgba(255, 255, 255, 0.96)` or `rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(12px to 20px)`.
- **Success/Cool Highlights:** `#F0FDF9` (Emerald 50).

### 2.2 Text Colors
- **Primary Text:** `#1E293B` (Slate 800) — Used for headings and main values.
- **Secondary Text:** `#64748B` (Slate 500) — Used for labels and descriptions.
- **Tertiary/Icons:** `#94A3B8` (Slate 400).
- **Disabled Text:** `#CBD5E1` (Slate 300).

### 2.3 Brand & Action Colors
- **Primary Brand (Cool Route):** `#38BDF8` (Sky 400).
- **Secondary Accent:** `#34D399` (Emerald 400).
- **Primary Gradient (Buttons):** `linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #34D399 100%)`.

### 2.4 Semantic / Heat Risk Colors
- **High Heat / Risk:** Background `#FCA5A5` (Red 300), Text `#DC2626` (Red 600).
- **Moderate Heat / Risk:** Background `#FDBA74` (Orange 300), Text `#C2410C` (Orange 700), Toggle `#F97316` (Orange 500).
- **Low Heat / Cool:** Background `#FDE68A` (Amber 200), Text `#059669` (Emerald 600).

## 3. Component Architecture

### 3.1 Layout & Borders
- **Border Radius:** 
  - Main Panels & Cards: `20px` (`rounded-[20px]`).
  - Inputs & Standard Buttons: `12px` to `14px` (`rounded-xl`).
  - Badges/Pills: `20px` (`rounded-full`).
- **Borders:** Subtle borders using `#E2EAF3` (width: 1.5px to 2px).

### 3.2 Shadows
- **Cards & Floating Panels:** `0 8px 32px rgba(30, 41, 59, 0.10), 0 2px 8px rgba(30, 41, 59, 0.06)`.
- **Active Primary Buttons:** `0 6px 20px rgba(56, 189, 248, 0.35)`.
- **Top Bar / Chips:** `0 4px 20px rgba(30, 41, 59, 0.08)`.

## 4. UI Elements Behavior
- **Inputs:** Default border `#E2EAF3`, on focus changes to `#38BDF8` (Start) or `#34D399` (Destination).
- **Disabled States:** Buttons should use `#E2EAF3` background with `#94A3B8` text and `cursor-not-allowed`.