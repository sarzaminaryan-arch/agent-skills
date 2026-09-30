# Router decision tree (v1)

This is a lightweight routing guide. It assumes you can run `wp-project-triage` first.

## Step 1: classify repo kind (from triage)

Use `triage.project.kind` and the strongest signals:

- `wp-core` → treat as WordPress core checkout work (core patches, PHPUnit, build tools).
- `wp-site` → treat as a full site repo (wp-content present; changes might be theme + plugins).
- `wp-block-theme` → theme.json/templates/patterns workflows.
- `wp-theme` → classic theme workflows (templates PHP, `functions.php`, `style.css`).
- `wp-block-plugin` → Gutenberg block development in a plugin (block.json, build pipeline).
- `wp-plugin` / `wp-mu-plugin` → plugin workflows (hooks, admin, settings, cron, REST, security).
- `gutenberg` → Gutenberg monorepo workflows (packages, tooling, docs).

If multiple kinds match, prefer the most specific:
`gutenberg` > `wp-core` > `wp-site` > `wp-block-theme` > `wp-block-plugin` > `wp-theme` > `wp-plugin`.

## Step 2: route by user intent (keywords)

Route by intent even if repo kind is broad (like `wp-site`):

- **Interactivity API / data-wp-* directives / @wordpress/interactivity / viewScriptModule**
  - Route → `wp-interactivity-api`.
- **Abilities API / wp_register_ability / wp-abilities/v1 / @wordpress/abilities**
  - Route → `wp-abilities-api`.
- **Ambiguous WordPress Playground requests**
  - Route → `wp-playground`, then follow its routing wrapper.
- **Blueprint JSON / Blueprint schema / Blueprint steps / Blueprint bundles**
  - Route → `blueprint`.
- **@wp-playground/cli / server / run-blueprint / build-snapshot / auto-mount / Xdebug**
  - Route → `wp-playground`, then read `references/cli.md` or `references/debugging.md`.
- **playground.wordpress.net / Blueprint Editor / share links / browser-only Playground**
  - Route → `wp-playground`, then read `references/website.md`.
- **Blocks / block.json / registerBlockType / attributes / save serialization**
  - Route → `wp-block-development`.
- **theme.json / Global Styles / templates/*.html / patterns/**
  - Route → `wp-block-themes`.
- **Plugins / hooks / activation hook / uninstall / Settings API / admin pages**
  - Route → `wp-plugin-development`.
- **REST endpoint / register_rest_route / permission_callback**
  - Route → `wp-rest-api`.
- **WP-CLI / wp-cli.yml / commands**
  - Route → `wp-wpcli-and-ops`.
- **Build tooling / @wordpress/scripts / webpack / Vite / npm scripts**
  - Route → `wp-build-tooling` (planned).
- **Testing / PHPUnit / wp-env / Playwright**
  - Route → `wp-testing` (planned).
- **PHPStan / static analysis / phpstan.neon / phpstan-baseline.neon**
  - Route → `wp-phpstan`.
- **Performance / caching / query profiling / editor slowness**
  - Route → `wp-performance`.
- **Security / nonces / capabilities / sanitization/escaping / uploads**
  - Route → `wp-security` (planned).

### Persian / RTL sites

Route here when the site language is Persian (`fa_IR`), the request is written in Persian, or the work is explicitly about an RTL WordPress site. These skills assume `dir="rtl"`, Persian typography (ZWNJ, Persian vs Arabic characters), and Iranian hosting realities.

- **Persian SEO / permalinks / slugs / hreflang / schema / not indexed / Jalali dates in schema**
  - Route → `wp-persian-seo`.
- **Slow Persian site / Persian webfonts / Core Web Vitals / caching layers / Iranian host or CDN choice**
  - Route → `wp-persian-speed`. For generic profiling internals, also read `wp-performance`.
- **White screen / 500 / 508 / garbled Persian text (mojibake) / broken ZWNJ / RTL layout breakage / plugin conflict / admin lockout / ModSecurity**
  - Route → `wp-persian-debug`.
- **Building or redesigning the front page of a Persian site / hero and section composition / Persian homepage copy**
  - Route → `wp-persian-homepage`. For block markup rules, also read `wp-patterns`; for `theme.json`, `wp-block-themes`.

### Content and visuals

- **Writing or rewriting articles, blog posts, landing copy that must read human (Persian or English)**
  - Route → `content-humanizer`.
- **Featured images, hero images, OG/social cards, in-article illustrations, image generation prompts**
  - Route → `featured-image-art-direction`.
- **Many pages that differ mainly by a place name (city/province/region guides, directories, programmatic SEO sets) / "we wrote hundreds of pages and nothing ranks" / deciding whether a content project is worth continuing**
  - Route → `geo-content-strategy`. For prose quality, also read `content-humanizer`; for Persian on-page, `wp-persian-seo`.

## Step 3: guardrails checklist (always)

- Verify detected tooling before suggesting commands (Composer vs npm/yarn/pnpm).
- Prefer existing lint/test scripts if present.
- If version constraints aren’t detectable, ask for target WP core and PHP versions.
