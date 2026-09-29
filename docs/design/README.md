# The colour system

Graphite and athletic lime, dark as the signature and light as a complete
equal. The device setting decides unless somebody says otherwise in
**Profile → Settings → Appearance**.

## Roles, not hues

Nothing in the app names a colour. `src/theme/tokens.ts` defines what a colour
is *for* — `surface`, `border`, `primary`, `onPrimary`, `warning` — and both
themes answer the same questions with different values. That is what makes a
second theme possible rather than a second stylesheet.

| Role | Dark | Light |
| --- | --- | --- |
| background | `#10151C` | `#F7F8F4` |
| surface | `#1B242E` | `#FFFFFF` |
| primary text | `#EAF0E4` | `#172018` |
| secondary text | `#AAB5AA` | `#526052` |
| primary action | `#B9EF35` | `#397400` |
| on primary | `#10151C` | `#FFFFFF` |
| mind | `#78B9FF` | `#1764A5` |
| spirit | `#C3A5FF` | `#7045A0` |

Body borrows the primary, because the body is what the app is mostly about.

**Lime is the action colour and almost nothing else.** A page where every card
glows lime says nothing about what to press. One lime button on graphite says
everything. The three accents exist only where body, mind and spirit have to be
told apart at a glance — not as decoration.

## How a component reads it

`StyleSheet.create` resolves its colours once, when the module loads, so a
stylesheet written at the top of a file can never change theme. Components
export a factory instead:

```tsx
export function Thing() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  ...
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: { backgroundColor: theme.surface, borderColor: theme.border },
});
```

`useStyles` builds one sheet per theme and caches it, so each component's two
sheets are created once for the life of the app rather than on every render.

## Contrast is measured, not eyeballed

`npm run test:contrast` checks forty pairs against WCAG 2.1 in both themes:
4.5:1 for text, 3:1 for controls and meaningful icons. Translucent colours are
composited over the surface behind them first, because that is what the eye
actually receives.

It has already earned its place. `borderStrong` — the border that says
"selected" or "focused" — looked right at 1.93:1 and is a control boundary, so
it needed 3:1. It is now 3.88:1 dark and 3.79:1 light.

`textFaint` is deliberately *not* held to 4.5:1. It is not allowed to carry text
anybody has to read: dividers, decorative glyphs and disabled states only. The
test asserts the 3:1 floor it does have, so that stays honest.

## Screenshots

`npm run shots` drives the same script twice, changing only the emulated colour
scheme, so anything that differs between a pair is the theme and not the route
taken. Both sets are in this folder as `<screen>-dark.jpg` and
`<screen>-light.jpg`.

## The one screen that does not follow the theme

`ErrorBoundary` is fixed dark. It is a class component so it cannot call a
hook — but the better reason is that it renders when something has already
thrown, and the theme provider is as capable of throwing as anything else. A
crash screen that depends on the thing that crashed is not a crash screen.
