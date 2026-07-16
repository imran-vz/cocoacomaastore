# Production dependency upgrade evidence

## Baseline

- Plan start: `423660e70f6be21907b9f546182240558e27d776`
- Captured: 2026-07-16
- Production audit summary: **19 total / 10 high**
- Severity breakdown: 0 critical, 10 high, 6 moderate, 3 low, 0 info

The table records every advisory reported at the plan checkpoint. Paths are the
shortest production paths reported by the audit and confirmed against
`pnpm why --prod`. A disposition of "re-audit" means the advisory is expected
to be evaluated after the named cohort upgrade; it does not assert that the
upgrade removes an upstream transitive advisory.

| Checkpoint | Total / high | Advisory | Severity | Package | Installed | Affected / patched | Shortest production path | Disposition |
| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- |
| Baseline | 19 / 10 | 1102341 | Moderate | `esbuild` | 0.18.20 | `<=0.24.2` / `>=0.24.3` | `better-auth > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` | Re-audit after Better Auth/Drizzle; otherwise retain as an upstream optional-transitive residual. |
| Baseline | 19 / 10 | 1103907 | Low | `cookie` | 0.4.2 | `<0.7.0` / `>=0.7.0` | `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > cookie` | Re-audit after Trigger.dev; retain any remaining upstream residual. |
| Baseline | 19 / 10 | 1111529 | High | `systeminformation` | 5.23.8 | `<5.27.14` / `>=5.27.14` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Baseline | 19 / 10 | 1113329 | High | `systeminformation` | 5.23.8 | `<=5.30.7` / `>=5.30.8` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Baseline | 19 / 10 | 1113330 | High | `systeminformation` | 5.23.8 | `<5.30.8` / `>=5.30.8` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Baseline | 19 / 10 | 1116251 | High | `drizzle-orm` | 0.41.0 | `<0.45.2` / `>=0.45.2` | `drizzle-orm` | Upgrade the direct Better Auth/Drizzle cohort to Drizzle ORM 0.45.2. |
| Baseline | 19 / 10 | 1117015 | Moderate | `postcss` | 8.4.31 | `<8.5.10` / `>=8.5.10` | `next > postcss` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |
| Baseline | 19 / 10 | 1119108 | Moderate | `ws` | 8.17.1 | `>=8.0.0 <8.20.1` / `>=8.20.1` | `@trigger.dev/sdk > @trigger.dev/core > socket.io-client > engine.io-client > ws` | Re-audit after Trigger.dev; retain any engine.io-owned residual. |
| Baseline | 19 / 10 | 1120162 | High | `systeminformation` | 5.23.8 | `>=4.17.0 <=5.31.5` / `>=5.31.6` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Baseline | 19 / 10 | 1120680 | Low | `esbuild` | 0.28.0 | `>=0.27.3 <0.28.1` / `>=0.28.1` | `better-auth > drizzle-kit > tsx > esbuild` | Re-audit after Better Auth/Drizzle; otherwise retain as an upstream optional-transitive residual. |
| Baseline | 19 / 10 | 1120786 | Moderate | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Re-audit after Better Auth; do not upgrade Vite directly for an optional Better Auth path. |
| Baseline | 19 / 10 | 1120821 | Moderate | `@opentelemetry/core` | 2.0.1 | `<2.8.0` / `>=2.8.0` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/core` | Re-audit after Trigger.dev; an upstream-pinned residual is expected and must remain documented. |
| Baseline | 19 / 10 | 1122764 | High | `better-auth` | 1.6.11 | `<1.6.13` / `>=1.6.13` | `better-auth` | Upgrade the direct Better Auth/Drizzle cohort to Better Auth 1.6.23. |
| Baseline | 19 / 10 | 1123259 | High | `ws` | 8.17.1, 8.20.1 | `>=8.0.0 <8.21.0` / `>=8.21.0` | `@trigger.dev/sdk > ws` | Re-audit after Trigger.dev; retain any SDK- or engine.io-owned residual. |
| Baseline | 19 / 10 | 1123488 | High | `protobufjs` | 7.6.0 | `<=7.6.0` / `>=7.6.1` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/exporter-logs-otlp-http > @opentelemetry/otlp-transformer > protobufjs` | Re-audit after Trigger.dev; retain any OpenTelemetry-owned residual. |
| Baseline | 19 / 10 | 1123492 | Moderate | `protobufjs` | 7.6.0 | `<=7.6.2` / `>=7.6.3` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/exporter-logs-otlp-http > @opentelemetry/otlp-transformer > protobufjs` | Re-audit after Trigger.dev; retain any OpenTelemetry-owned residual. |
| Baseline | 19 / 10 | 1123527 | High | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Re-audit after Better Auth; do not upgrade Vite directly for an optional Better Auth path. |
| Baseline | 19 / 10 | 1123528 | Low | `@babel/core` | 7.29.0 | `<=7.29.0` / `>=7.29.1` | `next > styled-jsx > @babel/core` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |
| Baseline | 19 / 10 | 1123570 | High | `systeminformation` | 5.23.8 | `<=5.31.6` / `>=5.31.7` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |

## Important baseline paths

The dependency graph confirms all paths called out by the upgrade plan:

- Direct vulnerable packages: `better-auth@1.6.11` and
  `drizzle-orm@0.41.0`.
- Host metrics: `@trigger.dev/sdk > @trigger.dev/core >
  @opentelemetry/host-metrics > systeminformation@5.23.8`.
- OTLP conversion: `@trigger.dev/sdk > @trigger.dev/core >
  @opentelemetry/otlp-transformer > protobufjs@7.6.0` (the resolved graph
  reaches the transformer through an OTLP exporter).
- OpenTelemetry core: `@trigger.dev/sdk > @trigger.dev/core >
  @opentelemetry/core@2.0.1`.
- WebSockets: `@trigger.dev/sdk > ws@8.20.1` and
  `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > ws@8.17.1`.
- Better Auth's optional test cohort: `better-auth > vitest > vite@8.0.13`.

## Cohort A: Better Auth and Drizzle

- Captured: 2026-07-16
- Installed direct versions: `better-auth@1.6.23` and
  `drizzle-orm@0.45.2`
- Production audit summary: **17 total / 8 high**
- Severity breakdown: 0 critical, 8 high, 6 moderate, 3 low, 0 info
- Direct advisory result: Better Auth advisory `1122764` and Drizzle ORM
  advisory `1116251` are absent.

The following table records every residual advisory after Cohort A. Paths are
the shortest production paths reported by the audit and confirmed against
`pnpm why --prod`.

| Checkpoint | Total / high | Advisory | Severity | Package | Installed | Affected / patched | Shortest production path | Disposition |
| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- |
| Cohort A | 17 / 8 | 1102341 | Moderate | `esbuild` | 0.18.20 | `<=0.24.2` / `>=0.24.3` | `better-auth > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Drizzle Kit or force an override. |
| Cohort A | 17 / 8 | 1103907 | Low | `cookie` | 0.4.2 | `<0.7.0` / `>=0.7.0` | `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > cookie` | Re-audit after Trigger.dev; retain any remaining engine.io-owned residual. |
| Cohort A | 17 / 8 | 1111529 | High | `systeminformation` | 5.23.8 | `<5.27.14` / `>=5.27.14` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Cohort A | 17 / 8 | 1113329 | High | `systeminformation` | 5.23.8 | `<=5.30.7` / `>=5.30.8` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Cohort A | 17 / 8 | 1113330 | High | `systeminformation` | 5.23.8 | `<5.30.8` / `>=5.30.8` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Cohort A | 17 / 8 | 1117015 | Moderate | `postcss` | 8.4.31 | `<8.5.10` / `>=8.5.10` | `next > postcss` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |
| Cohort A | 17 / 8 | 1119108 | Moderate | `ws` | 8.17.1 | `>=8.0.0 <8.20.1` / `>=8.20.1` | `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > ws` | Re-audit after Trigger.dev; retain any remaining engine.io-owned residual. |
| Cohort A | 17 / 8 | 1120162 | High | `systeminformation` | 5.23.8 | `>=4.17.0 <=5.31.5` / `>=5.31.6` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |
| Cohort A | 17 / 8 | 1120680 | Low | `esbuild` | 0.28.0 | `>=0.27.3 <0.28.1` / `>=0.28.1` | `better-auth > vitest > vite > esbuild` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Vite directly or force an override. |
| Cohort A | 17 / 8 | 1120786 | Moderate | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Vite directly. |
| Cohort A | 17 / 8 | 1120821 | Moderate | `@opentelemetry/core` | 2.0.1 | `<2.8.0` / `>=2.8.0` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/core` | Re-audit after Trigger.dev; document any upstream-pinned residual. |
| Cohort A | 17 / 8 | 1123259 | High | `ws` | 8.17.1, 8.20.1 | `>=8.0.0 <8.21.0` / `>=8.21.0` | `@trigger.dev/sdk > ws` | Re-audit after Trigger.dev; retain any SDK- or engine.io-owned residual. |
| Cohort A | 17 / 8 | 1123488 | High | `protobufjs` | 7.6.0 | `<=7.6.0` / `>=7.6.1` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/exporter-logs-otlp-http > @opentelemetry/otlp-transformer > protobufjs` | Re-audit after Trigger.dev; retain any OpenTelemetry-owned residual. |
| Cohort A | 17 / 8 | 1123492 | Moderate | `protobufjs` | 7.6.0 | `<=7.6.2` / `>=7.6.3` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/exporter-logs-otlp-http > @opentelemetry/otlp-transformer > protobufjs` | Re-audit after Trigger.dev; retain any OpenTelemetry-owned residual. |
| Cohort A | 17 / 8 | 1123527 | High | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Vite directly. |
| Cohort A | 17 / 8 | 1123528 | Low | `@babel/core` | 7.29.0 | `<=7.29.0` / `>=7.29.1` | `next > styled-jsx > @babel/core` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |
| Cohort A | 17 / 8 | 1123570 | High | `systeminformation` | 5.23.8 | `<=5.31.6` / `>=5.31.7` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/host-metrics > systeminformation` | Re-audit after Trigger.dev; do not force a transitive override. |

### Better Auth 1.6.23 compatibility decisions

Better Auth 1.6.23 requires `user:set-role` for an authenticated HTTP
`/admin/create-user` request whenever that request supplies a role. Granting
that permission would also expose the deliberately forbidden direct
`/admin/set-role` endpoint. The approved policy remodel therefore keeps the
application-owned `createManager` action as the public boundary: it calls
`requireAdmin` first and only then invokes the trusted server-side
`auth.api.createUser` API without forwarding request headers. Both supported
roles remain provisionable through that guarded action, while direct remove
and set-role requests remain forbidden with HTTP 403. Integration coverage
also confirms that public signup is disabled and seeded credentials can sign
in and resolve a session through the upgraded Drizzle adapter.

The independent `@better-auth/cli@1.4.21` schema generator completed
successfully in a temporary directory. Comparing its PostgreSQL output with
`src/db/schema.ts` found the same four auth tables, fields, column types, and
Admin plugin fields. The only differences were the pre-existing
application-owned `role` default and index names. Those differences predate
this upgrade and do not require a database schema change; no generated schema
artifact was retained.

No credentials, environment values, or raw audit payloads are stored in this
document.

## Cohort B and final audit: Trigger.dev

- Captured: 2026-07-16
- Installed direct versions: `@trigger.dev/sdk@4.5.4`,
  `@trigger.dev/build@4.5.4`, and `trigger.dev@4.5.4`
- Production audit summary: **10 total / 2 high**
- Severity breakdown: 0 critical, 2 high, 5 moderate, 3 low, 0 info
- Trigger transitive result: `systeminformation` is now 5.31.17, and every
  `systeminformation` and `protobufjs` advisory present at the baseline is
  absent from the final audit.

The final table records every residual advisory exactly once. Installed
versions and shortest production paths come from the final audit and were
confirmed with `pnpm why --prod`.

| Checkpoint | Total / high | Advisory | Severity | Package | Installed | Affected / patched | Shortest production path | Disposition |
| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- |
| Final | 10 / 2 | 1102341 | Moderate | `esbuild` | 0.18.20 | `<=0.24.2` / `>=0.24.3` | `better-auth > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Drizzle Kit or force an override. |
| Final | 10 / 2 | 1103907 | Low | `cookie` | 0.4.2 | `<0.7.0` / `>=0.7.0` | `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > cookie` | Retain as an upstream engine.io-owned Trigger residual. |
| Final | 10 / 2 | 1117015 | Moderate | `postcss` | 8.4.31 | `<8.5.10` / `>=8.5.10` | `next > postcss` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |
| Final | 10 / 2 | 1119108 | Moderate | `ws` | 8.17.1 | `>=8.0.0 <8.20.1` / `>=8.20.1` | `@trigger.dev/sdk > @trigger.dev/core > socket.io > engine.io > ws` | Retain as an upstream engine.io-owned Trigger residual. |
| Final | 10 / 2 | 1120680 | Low | `esbuild` | 0.28.0 | `>=0.27.3 <0.28.1` / `>=0.28.1` | `better-auth > drizzle-kit > tsx > esbuild` | Retain as an upstream optional-transitive Better Auth residual; do not upgrade Vite or force an override. |
| Final | 10 / 2 | 1120786 | Moderate | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Retain as an upstream optional test dependency of Better Auth; do not upgrade Vite directly. |
| Final | 10 / 2 | 1120821 | Moderate | `@opentelemetry/core` | 2.7.1 | `<2.8.0` / `>=2.8.0` | `@trigger.dev/sdk > @trigger.dev/core > @opentelemetry/core` | Retain as an upstream-pinned Trigger/OpenTelemetry residual; Trigger.dev 4.5.4 still resolves 2.7.1. |
| Final | 10 / 2 | 1123259 | High | `ws` | 8.17.1, 8.20.1 | `>=8.0.0 <8.21.0` / `>=8.21.0` | `@trigger.dev/sdk > ws` | Retain as an upstream Trigger residual: the SDK direct path uses 8.20.1 and the engine/socket paths use 8.17.1. |
| Final | 10 / 2 | 1123527 | High | `vite` | 8.0.13 | `>=8.0.0 <=8.0.15` / `>=8.0.16` | `better-auth > vitest > vite` | Retain as an upstream optional test dependency of Better Auth; it is not an application runtime Vite dependency. |
| Final | 10 / 2 | 1123528 | Low | `@babel/core` | 7.29.0 | `<=7.29.0` / `>=7.29.1` | `next > styled-jsx > @babel/core` | Outside the five-package upgrade scope; retain as an upstream Next.js residual. |

### Trigger.dev 4.5.4 verification

The SDK, build package, and CLI resolve in lockstep at 4.5.4. The first
authenticated `deploy --env staging --dry-run` attempt found that the project
has no staging environment and stopped during initialization, before task
packaging or any remote change. After explicit operator approval, the same
safety-constrained smoke was run against the production environment with
`--dry-run`, `--skip-sync-env-vars`, `--skip-telemetry`, and
`--skip-update-check`. It successfully compiled and packaged both scheduled
tasks without creating a deployment, synchronizing environment variables, or
executing a task. Temporary dry-run output was removed after verification.
The optional interactive `trigger dev` smoke was not run because this project
has no approved non-production/test environment; no development process was
started and no task was invoked.
