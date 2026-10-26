# Themes for Sitecore

## Register

product

## Users and purpose

Sitecore authors, marketers and developers who spend whole days in the Sitecore 10.0-10.5 Content Management UIs: the Content Editor, Desktop, Sheer UI dialogs, SPE (ISE, Read-Variable dialogs, Show-ListView), Launchpad, SPEAK apps and the Experience Editor. Sitecore 10.5's white and purple look is too bright for that kind of use. The extension lets each user pick a theme per Sitecore host, so the tool they already know is comfortable to look at all day.

The primary task on every screen stays Sitecore's own: find an item, edit fields, save, publish. A theme succeeds when that work feels calmer or more fun and nothing about how Sitecore behaves changes.

## Themes and their personalities

The README lists every theme. Each picker group has its own register:

- **Sitecore's own** (Native, Debrightify, Sitecore 10.4 and 10.5, Copenhagen for 6 and 7): Sitecore's layout, restored or recoloured, today's or an older version's. Fidelity over invention.
- **Everyday**: practical looks for long days and specific needs (high contrast, knowing which environment you're on). Quiet and legible first.
- **Modern**: today's desktop platforms, light or dark following the OS. Restrained, rounded, native-feeling.
- **Retro**: recreations of past platforms. Playful, but exact about each period's rules: bevel direction, title-bar construction, typography.
- **Creative**: a strong idea (a blueprint, a notebook, a terminal) carried through every screen, still readable for a full working day.

## Anti-references

- Anything that breaks or hides Sitecore functionality, including its controls and state-bearing markup.
- Restyling the website shown inside the Experience Editor.
- Sitecore, Microsoft or Apple logos and proprietary fonts bundled in the extension.
- Half-applied themes: some parts of a screen in the theme and others in stock 10.5 colours, mismatched control styles side by side, or icons that vanish on a dark background.

## Design principles

1. Consistency inside a theme beats cleverness: every ribbon tab, button and window control on a screen speaks the same visual language.
2. Recreations follow their source's rules (bevel direction, title-bar construction, typography) rather than a loose impression.
3. Contrast is never sacrificed: text meets WCAG AA, and glyphs stay visible on whatever background the theme gives them.

## Accessibility

WCAG AA (4.5:1) for text on every token pair, which the unit tests check. No motion beyond what Sitecore already does.
