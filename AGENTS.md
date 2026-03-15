# AGENTS.md

## Cursor Cloud specific instructions

This is a **Hexo 6.x** static blog site ("Victor 的自留地") using the `new-yilia` theme.

### Key commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Clean | `npx hexo clean` |
| Build (generate) | `npx hexo generate` |
| Dev server | `npx hexo server` (port 4000) |

- There is no separate lint or test framework configured. Validation is done by building (`hexo generate`) and visually inspecting via the dev server.
- The theme lives under `themes/new-yilia/` and has its own `_config.yml`.
- Blog posts are Markdown files in `source/_posts/`.
- The `ImageProcess/` directory is an optional standalone Python utility for photo processing (not part of the Hexo build pipeline).
