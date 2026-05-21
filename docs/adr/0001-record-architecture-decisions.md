# ADR 0001: Record Project Decisions In ADRs

## Status

Accepted

## Context

The project has grown beyond a simple POS screen. It now has admin and manager routes, inventory workflows, analytics precomputation, charting decisions, auth boundaries, and date-handling rules. These decisions are easy to rediscover incorrectly if they only live in code or chat history.

## Decision

Use `CONTEXT.md` for living project/domain context and `docs/adr/*.md` for architecture decisions.

ADRs should use this shape:

- Status
- Context
- Decision
- Consequences

ADRs should be short enough to read during implementation and specific enough to prevent repeating old debates.

## Consequences

- Future implementation work has a shared map of project vocabulary and constraints.
- Decisions can be changed by adding a new ADR instead of rewriting history silently.
- Agents and humans can orient faster before touching sensitive areas like analytics or auth.
