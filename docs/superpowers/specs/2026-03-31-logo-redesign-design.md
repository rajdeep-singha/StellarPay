# Logo Redesign & Landing Page UX Refresh

**Issue:** #1 — Redesigning and implementing the logo
**Date:** 2026-03-31
**Status:** Approved

## Summary

Replace the hamburger menu icon with a branded Orbital S logo and refresh the landing page UX (hero section, features grid, stats section). Dashboard functionality remains untouched.

## Logo Design — Orbital S

- Stylized "S" letterform with an orbital ring (Stellar/space theme)
- Pink dot accent at top-right
- Container: 38x38px rounded-lg with pink-to-purple gradient background
- SVG mark: white S + orbital ring on gradient
- Applied in: HomePage header, EmployerDashboard header, favicon

## Changes by Section

### 1. Header
- Replace hamburger SVG with Orbital S logo in gradient container
- Update both `HomePage.jsx` and `EmployerDashboard.jsx` headers

### 2. Hero Section
- Add "Built on Stellar Network" badge above headline (pink accent pill)
- Change "Secure" from `bg-gradient px-3 py-1` box to gradient text (`bg-clip-text text-transparent`)
- Replace abstract gray bars graphic with orbital S hero illustration (larger version with orbital paths, orbiting dots, payment flow lines)

### 3. Features Grid
- Expand from 2-column to 3-column layout
- Add third card: "Instant Remittances" — "Send money globally in seconds via Stellar."
- Icon: layers/stack SVG

### 4. Stats Section
- Replace emoji icons (📊 ⚡ 🔒) with proper SVG icons
- Keep same data: 1.25% fee, ~5 sec processing, Verified contract

### 5. Favicon & Page Title
- Update `index.html` title from "Vite + React" to "StellarPay"
- Replace vite.svg favicon with Orbital S favicon

## Design Constraints
- Preserve dark #0a0a0a theme
- Preserve pink-to-purple gradient palette
- Preserve all existing copy and CTAs
- Dashboard section untouched
- Tailwind CSS inline utilities (no new CSS files)

## Files to Modify
1. `client/src/components/HomePage.jsx` — logo, hero, features, stats
2. `client/src/components/EmployerDashboard.jsx` — logo in header
3. `client/index.html` — title and favicon
4. `client/public/` — new favicon SVG
