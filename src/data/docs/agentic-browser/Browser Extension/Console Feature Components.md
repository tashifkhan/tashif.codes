# Console feature components

The console pages under `clients/debug-web/src/features` are thin containers around shared query hooks and local UI. Overview composes stat cards and charts. Runs filters a table and opens a detail view with tabs. Memory switches between a claim list and a force directed graph. Diagnostics lists maintenance runs. Each page owns its own layout; shared behaviour stays in `shared/query` and `shared/ui`.

Key capabilities:
- Overview reads one stats query and one timeseries query.
- Runs filters client side after a 100 row request.
- Run detail splits trace, subagents and tool calls into tabs.
- Memory graph supports search, tier filter, history edges and selection.
- Diagnostics reflects the backend maintenance schedule.

## Repository layout

```mermaid
graph TB
  subgraph Overview
    OV["overview/OverviewPage.tsx"]
    KN["KeyNumbers.tsx"]
    AC["ActivityCharts.tsx"]
    RR["RecentRuns.tsx"]
    BO["BreakdownCards.tsx"]
    SK["OverviewSkeleton.tsx"]
  end
  subgraph Runs
    RP["runs/RunsPage.tsx"]
    RT["runs/RunsTable.tsx"]
    RDP["runs/RunDetailPage.tsx"]
    RH["RunHeader, RunResult"]
    RTR["RunTrace, RunSubagents, RunToolCalls"]
  end
  subgraph Memory
    MP["memory/MemoryPage.tsx"]
    MT["MemoryToolbar.tsx"]
    CL["ClaimList.tsx"]
    GV["memory/graph/GraphView.tsx"]
    BG["graph/buildGraph.ts"]
  end
  subgraph Diagnostics
    DP["diagnostics/DiagnosticsPage.tsx"]
    SB["ScheduleBar.tsx"]
    MAT["MaintenanceTable.tsx"]
  end
  OV --> KN
  OV --> AC
  OV --> RR
  OV --> BO
  OV --> SK
  RP --> RT
  RDP --> RH
  RDP --> RTR
  MP --> MT
  MP --> CL
  MP --> GV
  GV --> BG
  DP --> SB
  DP --> MAT
```

## Building blocks

- `overview/OverviewPage.tsx`: `DashboardPanel`, the dashboard entry.
- `runs/RunsPage.tsx`: `RunsPanel`, the list with status and text filters.
- `runs/RunDetailPage.tsx`: `RunDetailPanel`, which reads `runId` from the route and renders `RunDetailView`.
- `memory/MemoryPage.tsx`: `MemoryPage`, exported as `MemoryPanel`.
- `memory/graph/GraphView.tsx`: the default export loaded lazily by `MemoryPage`. It renders the force graph and selection panel.
- `diagnostics/DiagnosticsPage.tsx`: `MaintenancePanel`, the maintenance list.

## How it fits together

Every page follows the same pattern: call a query hook, branch on its state, then render a body. `QueryView` centralises the loading, error and empty branches, so a page supplies a skeleton and an empty node and gets consistent behaviour.

```mermaid
sequenceDiagram
  participant Router as "TanStack Router"
  participant Page as "RunDetailPanel"
  participant Hook as "useRun"
  participant QV as "QueryView"
  participant API as "/api/debug/runs/id"

  Router->>Page: /runs/abc
  Page->>Hook: useRun abc
  Hook->>API: GET run detail
  API-->>Hook: run, tool_calls, subagents
  Hook-->>Page: data
  Page->>QV: query and skeleton
  QV-->>Page: RunDetailView
  Page->>Page: tab trace by default
```

## Overview

`DashboardPanel` checks for the one case `QueryView` cannot cover: an error with no cached data. In that case it renders `PageFrame` with a `QueryView` that has no skeleton, which shows the error state at page level. Otherwise it renders `KeyNumbers` with the last 14 timeseries buckets, `ActivityCharts`, then a three column grid.

```mermaid
graph LR
  ST["useStats"] --> OV["DashboardPanel"]
  TS["useTimeseries 30"] --> OV
  OV --> KN["KeyNumbers<br/>series slice -14"]
  OV --> AC["ActivityCharts"]
  OV --> GRID["pn-grid-3"]
  GRID --> RR["RecentRuns"]
  GRID --> RO["RunOutcomes"]
  GRID --> MT["MemoryTiers"]
```

`KeyNumbers` receives `stats` and `series`, which may be `undefined` while the timeseries loads. `RunOutcomes` and `MemoryTiers` receive only `stats`, so they render as soon as the stats query resolves.

## Runs list and detail

`RunsPanel` keeps `status` and `text` in local state and asks for 100 runs. The status filter is sent to the server; the text filter runs on the returned rows over `run_id`, `entrypoint`, `final_answer`, `error` and `conversation_id`. The `Segmented` control labels each status with its count from `useStats`.

`RunDetailPanel` reads `runId` with `useParams({ from: "/runs/$runId" })` and calls `useRun(runId)`. When the query failed and there is no cached run, it renders the error at page level. On success, `RunDetailView` opens the trace tab.

```mermaid
graph TB
  RD["RunDetailView"]
  RD --> H["RunHeader<br/>status, ids, timing"]
  RD --> R["RunResult<br/>answer or error"]
  RD --> T["Segmented tabs"]
  T --> TR["RunTrace<br/>runId, live"]
  T --> SA["RunSubagents<br/>count"]
  T --> TC["RunToolCalls<br/>count"]
  TR --> EV["useRunEvents live"]
  EV --> WL["WorkLog"]
```

A run is live when `run.status === "running"`, and that same flag drives `RunTrace` polling at 1.5s. The subagent and tool call tabs read arrays already present on the run detail response, so switching tabs does not refetch.

## Memory list

`MemoryPage` requests claims with a tier and a limit. The tier select resets the limit to 100, and `onMore` appends another 100 up to 200, the endpoint cap. Search is client side over `claim_text`, `segment` and `memory_class`.

```mermaid
flowchart TD
  MP["MemoryPage"] --> T{"view"}
  T -->|list| Q["useClaims tier and limit"]
  Q --> CL["ClaimList"]
  CL --> MORE{"limit below 200 and full page?"}
  MORE -->|yes| B["onMore, limit + 100"]
  MORE -->|no| CAP["no more control"]
  T -->|graph| GV["lazy GraphView"]
  GV --> GQ["useMemoryGraph history"]
  GQ --> FG["buildGraph + force layout"]
```

## Memory graph

`GraphView` loads `useMemoryGraph(history)` and draws only when `data.claims` is non-empty. `buildGraph(data, { tier, segment })` produces nodes for entities and claims and links for subject, object, supersedes and contradicts relations.

```mermaid
flowchart TD
  Q["useMemoryGraph history"] --> B["buildGraph tier and segment"]
  B --> F["ForceGraph2D"]
  F --> H["hover node"]
  F --> C["click node"]
  F --> S["search match"]
  H --> E["emphasis strong, normal or dim"]
  C --> P["GraphSelection panel"]
  S --> E
  P --> L["history and related lists"]
  K["key f"] --> Z["zoomToFit 600, 70"]
  K2["key Escape"] --> R["clear selection and segment"]
```

The canvas keeps `segment`, `hovered` and `selectedId` in state. `focus` is the hovered node or the selected node. `neighbours` is built once per graph from the link list, and `focusSet` combines the focus with its neighbours. Search builds a set of matching node ids. `emphasis` returns `strong` for links touching the focus, `normal` for search matches and `dim` for everything else.

Force tuning happens in an effect after each graph change. Entity nodes repel with `-140 - size * 6` and a max distance of 260; claim nodes use `-18`. Link distance is 16 for `supersedes` and `contradicts`, 70 for `object`, and `30 + source.size` otherwise. Strength is 0.18 for object, 0.8 for subject and 0.5 for the rest.

`ForceGraph2D` uses `cooldownTicks={160}` and `d3VelocityDecay={0.35}`. Object links are dashed `[2, 3]`, contradiction links `[4, 3]`, and arrows appear for `supersedes` and `object`. Clicking centers the node over 500ms. The engine fits the view on stop only while nothing is selected.

Keyboard handling ignores events from inputs and textareas. `f` fits the graph and Escape clears the selection and segment, then fits. The legend lists segments and filters to one when clicked. A hovered claim shows a small tooltip unless it is already selected.

## Diagnostics

`MaintenancePanel` calls `useMaintenance()` and renders `ScheduleBar` above a table. The empty state explains the schedule: consolidates hourly, nightly at 03:00 and weekly on Sundays, with the first run after the backend has been up for an hour.

```mermaid
graph LR
  M["useMaintenance"] --> DP["MaintenancePanel"]
  DP --> SB["ScheduleBar"]
  DP --> QV["QueryView"]
  QV --> SK["MaintenanceTableSkeleton"]
  QV --> EM["PageEmpty with schedule copy"]
  QV --> TB["MaintenanceTable"]
```

## Dependencies

```mermaid
graph TB
  OV["OverviewPage"] --> Q["shared/query"]
  RP["RunsPage"] --> Q
  RDP["RunDetailPage"] --> Q
  MP["MemoryPage"] --> Q
  DP["DiagnosticsPage"] --> Q
  OV --> UI["shared/ui"]
  RP --> UI
  RDP --> UI
  MP --> UI
  DP --> UI
  GV["GraphView"] --> FG["react-force-graph-2d 1.29.2"]
  GV --> Q
  OV --> SORT["features/common PageState"]
  RP --> SORT
```

The features import the router only for `Link` and `useParams`. Every network call goes through `@agentic-browser/shared/query` with the console's empty base URL. `react-force-graph-2d` is imported only by the lazy graph route.

## Performance

- `useStats` and `useRuns` poll at 4s, `useRun` at 1.5s only while running, `useMaintenance` at 30s.
- `useTimeseries(30)` polls at 30s, so the dashboard charts do not churn.
- `RunsPage` fetches at most 100 rows and filters them in memory; `MemoryPage` fetches at most 200 claims.
- `GraphView` builds neighbours in a single pass per graph and memoises `byId`, `segments` and `matches`.

## Troubleshooting

- Symptom: dashboard is blank with a backend error. Cause: `stats.isError` and no cached data, so the page deliberately drops the skeleton. Fix: start the backend and retry.
- Symptom: run detail stops updating. Cause: the run status is no longer `running`, so `refetchInterval` returns false. Fix: reload the run or open the trace once the backend marks it complete.
- Symptom: graph is a hairball. Cause: too many claims with no tier filter. Fix: pick a tier, search for a name, or click a node to focus its neighbours.
- Symptom: diagnostics list is empty. Cause: no maintenance run has completed yet. Fix: wait for the hourly job or trigger maintenance from the backend.

## Appendix

### Implementation examples
- Error-first dashboard branch, `DashboardPanel`.
- Text filtering, `filtered` in `RunsPanel`.
- Route param read, `useParams` in `RunDetailPanel`.
- Claim cap and more control, `PAGE` and `MAX` in `MemoryPage`.
- Force tuning and selection, `Canvas` in `GraphView`.

### Source files
- `clients/debug-web/src/features/overview/OverviewPage.tsx`
- `clients/debug-web/src/features/runs/RunsPage.tsx`
- `clients/debug-web/src/features/runs/RunDetailPage.tsx`
- `clients/debug-web/src/features/memory/MemoryPage.tsx`
- `clients/debug-web/src/features/memory/graph/GraphView.tsx`
- `clients/debug-web/src/features/diagnostics/DiagnosticsPage.tsx`
