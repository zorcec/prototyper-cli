---
description: "Rules for generating HTML prototypes compatible with Prototype Studio"
applyTo: "**/*.html"
---

# Prototype Studio Rules

When generating HTML prototypes:

1. Add `data-proto-id` (kebab-case, unique, stable) to every meaningful element
2. Keep files self-contained — inline styles and scripts, no external dependencies
3. Include `<meta charset="UTF-8">` and viewport meta tag
4. Process annotation comments: implement `@TODO`/`@FEATURE` and remove them,
   never modify `@KEEP` elements, answer `@QUESTION` with `@CONTEXT`
5. Never rename or remove existing `data-proto-id` attributes
