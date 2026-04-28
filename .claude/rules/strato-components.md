---
description: Strato Design System component patterns and gotchas
globs: ui/**/*.tsx
---

# Strato Component Rules

## Imports
- ALWAYS import from subcategory path (`/layouts`, `/typography`, `/tables`, `/forms`), NEVER from package root
- ❌ `import { Flex, Heading } from "@dynatrace/strato-components";`
- ✅ `import { Flex } from "@dynatrace/strato-components/layouts";`
- ✅ `import { Heading } from "@dynatrace/strato-components/typography";`

## Select Component
- `SelectOption` MUST be wrapped in `SelectContent` — without it, options silently don't render ("No items found")
- For multi-select: use `multiple` prop; value becomes `string[]`, onChange returns `string[]`
- Empty string `""` is invalid for Select value — use a sentinel like `"all"`

## DataTable
- `accessor: "fv.name"` is treated as nested path `obj.fv.name` — use `fieldsAdd` in DQL to alias flat fields with dots to simple names
- DataTable can't nest inside DataTable ExpandableRow — use custom accordion instead
- Custom cell renderers need `display: "flex", alignItems: "center", height: "100%"`

## Charts
- Hide legend with `<CategoricalBarChart.Legend hidden />` (child component, not a prop)

## Design Tokens
- Padding tokens: only 0|2|4|6|8|12|16|20|24|32|40|48|56|64
- Color tokens: `Colors.Charts.Apdex.{Excellent|Good|Fair|Poor|Unacceptable}.Default`

## QueryInspector Pattern
Every data card has a `⟨/⟩ DQL` button from `components/QueryInspector.tsx` that opens a Strato `Sheet` overlay with raw query, copy button, and "Open in Notebook" link via `getIntentLink({ "dt.query": query }, "dynatrace.notebooks", "view-query")` from `@dynatrace-sdk/navigation`. Pattern: store the query string in a local variable, pass to both `useDql({ query })` and `<QueryInspector query={query} title="..." />`.
