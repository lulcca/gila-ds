# gila-ds

A Vue 3 design system whose first (and so far only) component is **`<DatePicker />`**: a headless calendar engine in vanilla TypeScript wrapped by a thin Vue layer.

> Storybook is the home of every component (no demo app, no playground page).
> Each component's `index.ts` is its public contract; the story file next to it is the showcase.

**Live demo:** <https://lulcca.github.io/gila-ds/>

## Quick start

> Requires Node ≥ 20.19 / 22.12 and [pnpm](https://pnpm.io) (any 10.x).

```sh
pnpm install
pnpm dev               # Storybook at http://localhost:6006
pnpm build             # Storybook static build → ./storybook-static

pnpm lint              # eslint
pnpm test:coverage     # vitest, ≥ 75% across lines/branches/funcs/statements
pnpm type:check        # vue-tsc --build
```

## Architecture

Vertical slicing: each component owns its template, composable, headless engine, tests and stories. Re-exports go through one barrel per component.

```
src/
├── components/
│   └── date-picker/
│       ├── date-picker.vue           ← UI: input + popover + BEM grid
│       ├── date-picker.stories.ts    ← storybook showcase
│       ├── use-calendar.ts           ← vue ↔ engine bridge
│       ├── engine/                   ← headless logic
│       └── index.ts                  ← public API
└── styles/tokens.css                 ← css tokens
```

## Component API

```vue
<DatePicker
  v-model="date"
  label="Pick a date"
  locale="en-US"
  :display-format="{ year: 'numeric', month: 'long', day: '2-digit' }"
  :max-date="{ year: 2025, month: 12, day: 31 }"
  :min-date="{ year: 2024, month: 1, day: 1 }"
/>
```

`displayFormat` accepts any `Intl.DateTimeFormatOptions`.
`locale` is any BCP 47 tag, fed straight into `Intl.DateTimeFormat`.
Free-form ISO 8601 input (`2024-07-04`) is also accepted in the text field.

---

## Technical Notes

### State management between the Engine and the Component

`CalendarEngine` is a framework-agnostic class, vanilla TypeScript. It owns the calendar state (`viewYear`, `viewMonth`, `selected`, `focused`) and exposes:

- **Pure read methods**: `getState()`, `getGrid()`, `getMonthLabel()`, `getWeekdayLabels()`.

- **Mutating commands**: `selectDate`, `nextMonth`, `moveFocus`, etc. Each one returns the next `ICalendarState` so callers can drive themselves without re-reading.

- **`subscribe(listener)`**: minimal observer protocol, the only seam any UI framework needs to hook into.

The Vue bridge (`use-calendar.ts`) is **deliberately minimal**:

```ts
const state = shallowRef<ICalendarState>(engine.getState())
const unsubscribe = engine.subscribe((next) => {
  state.value = next
})
onScopeDispose(unsubscribe)
```

A single `shallowRef` holds the latest snapshot. The engine emits a fresh object on every mutation, so assigning it into `state.value` is enough to trigger Vue's reactivity (no per-field refs, no `triggerRef`). I picked this pattern over `reactive` on purpose:

1. **The engine stays Vue-free.** A `reactive(engine)` would wrap the class with Proxies, leaking framework concerns into the domain layer and making it harder to port to React/Svelte later.

2. **No accidental fine-grained reactivity.** Each engine command is transactional, exactly one snapshot per mutation, exactly one reactive update, exactly one Vue re-render. No cascade of intermediate updates.

3. **Listeners only fire when state actually changes** (the engine diff-compares snapshots internally), so the `shallowRef` is updated only on real transitions.

The cost is one explicit `void state.value` in each `computed` that reads from the engine, a trade I'm happy to pay for the clean domain separation.

### Brief observations on using the Temporal API

The challenge asks to "leverage the Temporal API where possible". I considered it carefully and chose to **defer adoption**, while keeping the codebase ready for migration. Reasoning:

- **Runtime availability is still patchy in May 2026.** Temporal is at Stage 3 and shipping behind flags in some engines; consuming it in a zero-config library means either a polyfill (~30 KB minified) or shipping code that breaks in older runtimes the consumer hasn't opted into.

- **Adding `temporal-polyfill` for a single component is overkill.** A design system component should be lean — pulling in a polyfill just to do arithmetic on month boundaries doesn't justify itself.

**What I did instead, and how the migration looks:**

- **The public type `ICalendarDate` is Temporal-shaped:** `{ year: number; month: number; day: number }`, with **1-indexed months** — identical to what `Temporal.PlainDate.from({ year, month, day })` accepts. The day swap is `type ICalendarDate = Temporal.PlainDate`.

- **All `Date` usage is quarantined in `engine/utils/date.ts`.** Day arithmetic (`addDays`) goes through `Date.UTC(...)` + `getUTC*` to dodge `Date`'s two main footguns: timezone-dependent constructors and DST shifts. Month arithmetic (`addMonths`) and day-counts (`getDaysInMonth`) are done by hand with a `DAYS_PER_MONTH` table + leap-year check — cheaper and easier to reason about than round-tripping through `Date`.

- **The engine never sees a `Date` instance.** It only consumes the plain `ICalendarDate` shape. Swapping `addDays`, `addMonths`, `getDaysInMonth` for `Temporal.PlainDate.add(...)` / `.with(...)` is a localised change in `utils/date.ts` — the engine, the composable and the Vue component need zero edits.

In short: **Temporal-ready API, defensive `Date` implementation today, one-file migration when Temporal lands in every target runtime.**

### How to run the project

See [Quick start](#quick-start) above for the full command list. The shortest path to seeing the component is:

```sh
pnpm install && pnpm dev
```

---

## Engineering practices

- **TypeScript** with `strict: true` and `noUncheckedIndexedAccess` for safer array/object access.

- **Vitest + @vue/test-utils + jsdom**, 80 tests, ≥ 75% coverage gate enforced in CI.

- **WAI-ARIA combobox + grid** patterns: `aria-haspopup="dialog"`, `aria-expanded`, roving `tabindex`, verbose per-cell `aria-label`  (`"Saturday, May 18, 2024"`). Full keyboard support: arrows, `Home`/`End`, `PageUp`/`PageDown` (year jump with `Shift`), `Enter`/`Space`, `Esc`.

- **Themable via CSS custom properties.** Two layers: `--ds-*` (system-wide primitives) and `--date-picker-*` (component-specific knobs). Override either in any ancestor scope, see the `CustomTheme` and `DarkTheme` stories.

- **Injectable clock.** `ICalendarEngineOptions.now` lets tests stub "today" deterministically without monkey-patching `Date`.

## CI / Deploy

- **`.github/workflows/ci.yml`**: lint, type-check, and tests with coverage on every push / PR to `main`.

- **`.github/workflows/deploy-storybook.yml`**: builds the Storybook static site and publishes it to GitHub Pages on every push to `main`.

## License

MIT — see [LICENSE](./LICENSE).
