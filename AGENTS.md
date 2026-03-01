## Multi-Agent Orchestration Policy

For non-trivial requests in this repository, use a quarterback-first workflow.

### Quarterback-first rule
- Delegate to `quarterback` before any write-capable worker starts.
- `quarterback` must run discovery fan-out first, then writer fan-out.
- Writers cannot start until first-wave explorer outputs are available.

### Complexity scoring
Compute task complexity score:
- +1 if expected touched files > 3
- +1 if expected subsystems > 1
- +1 if both investigation and edits are required
- +1 if network/authority contracts are involved

Use adaptive-medium first-wave explorer fan-out:
- score 0-1: 1 explorer
- score 2: 3 explorers
- score 3: 4 explorers
- score 4: 6 explorers

### Nested explorer policy
- Nested explorer fan-out is allowed only if unresolved critical unknowns remain.
- Only `quarterback` may grant nested explorer budget.
- Cap nested explorer additions at 3 per task, launched in +1 increments.

### Writer ownership policy
- Enforce strict file ownership for write-capable workers.
- If two workers need the same file, route that file to `worker` (integrator) only.
- Prefer handoffs over overlapping edits.

### Visibility contract
For each major cycle, include:
- `Dispatch Plan`: phase, launched roles, ownership map, gates.
- `Fanout Telemetry`: launched roles, concurrent peak, active writers, nested explorers used, ownership conflicts.
