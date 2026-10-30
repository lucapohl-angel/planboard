# Software architecture, data and APIs

Use for apps, services, integrations and software. Research checked 2026-10-25.

Inspect existing systems, contracts and decisions first. Establish users, boundaries, ownership and quality needs before choosing products. Start with a system-context view; add runtime/container or component detail only when it answers a real question. C4 is a way to communicate different abstraction levels, not a mandatory development process or a reason to introduce microservices. [C4 diagrams](https://c4model.com/diagrams), [C4 FAQ](https://c4model.com/faq).

Use separate views for static responsibilities, request/event sequences, data relationships and lifecycle transitions. Label arrows with the operation or data and explain direction. Identify the source of truth, external dependencies and trust boundaries. Do not depict a proposed integration as verified. A state node does not turn this renderer into a formal UML state-machine validator.

For an API operation, describe consumer need, method/path or protocol, input/output shapes, authentication versus authorization, error behavior and compatibility. Where relevant, add idempotency, pagination, timeouts, retry limits and webhook replay handling. Use the existing contract; OpenAPI describes HTTP interfaces, not every possible protocol. Check the version supported by project tooling before authoring a spec. [OpenAPI specification](https://spec.openapis.org/oas/latest.html).

Record significant decisions as context, alternatives, decision, consequences and status. Preserve superseded reasoning rather than rewriting history. [AWS ADR process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html).

Deliver acceptance scenarios, including dependency failure and recovery, tied to stated needs. Avoid speculative infrastructure and vendor choices unsupported by constraints.

## Make the proposed stack reviewable

Use the plan’s technologies list for explicit choices. For each technology name the role, status, reason, tradeoffs, real alternatives, prerequisites, affected features and checks. Separate library/runtime dependencies from delivery prerequisites and external service dependencies. Inspect package manifests and lockfiles in existing projects; do not invent pinned versions.

For authentication show the provider/approach, login and recovery paths, session/token verification, expiry/logout and the difference between identity and permission checks. Name which service enforces access and how cross-account/tenant access will be tested. Do not add accounts to a site whose user tasks do not require them. State when there is no custom backend or database.

Technical annotations are change requests for review, not merely a renamed box: replacing a provider or framework requires checking dependent code, storage, session flows, deployment assumptions and tests.
