---
name: planboard
description: Explicitly invoked human review of an existing plan with /planboard. Save a conversation draft as Markdown when necessary, then show it in the annotated browser viewer. Never activate automatically for planning or plan mode.
disable-model-invocation: true
---

# Development planning

Use the current harness agent and `plan_board` to present and revise a development plan. The user's chosen workflow owns the planning method, task boundaries, required checks and section order; this skill controls readability and review interaction. Do not replace Superpowers, BDD, TDD or another selected method with a viewer-specific planning process. Works in Pi (including Orca), Codex, Claude Code and other compatible MCP tool hosts. No additional model service or always-on planning hook is needed.

## Explicit entry point

Run only when the user invokes `/planboard` (or the host's explicit `$planboard` / `/prompts:planboard` equivalent), or continues an already requested board review. Entering plan mode, generating a plan, completing a task, or mentioning a Markdown file does not activate this skill. Do not install a planning-completion hook.

Interpret an optional argument as the requested plan file or saved board ID. With no argument, use the most recent clearly identified plan in the current conversation. Reuse a matching saved review when appropriate; do not silently open an unrelated old active board.

If the plan is already a Markdown file, use it unchanged. If it exists only as an agent's public response, a harness plan artifact, or visible structured steps, save that draft faithfully as Markdown first, using a non-conflicting path such as `plans/<topic>.md`. Preserve phase identifiers, decisions, task order, dependencies, checks, assumptions and unresolved questions. Do not expand scope, resolve unknowns, invent missing steps, or claim the draft was approved. Do not copy private reasoning or unrelated conversation. For a small structured checklist, preserve its actual level of detail and label it as a draft.

If there is no identifiable plan, several plausible plans, or the harness has not exposed its plan text, ask which plan to use. Do not manufacture a plan merely to open the viewer. If the harness's plan mode currently forbids writing files or starting a server, explain that the draft is ready but review must wait until those operations are allowed; do not switch modes or bypass permissions yourself.

Only after the Markdown file exists, save the readable presentation and open the localhost viewer. Review edits and approval remain part of this explicit review session.

## Markdown first

This viewer requires a plan Markdown file. Read an existing plan, or write the agreed draft to a `.md` file using the selected workflow before opening the viewer. Do not ask the user to create it for you. Do not overwrite an unrelated existing plan. New `save` calls require `markdownPath`; the tool reads the file and preserves its exact text as the original document. Do not fabricate `sourceDocument`. On revisions, keep its original archive and stable IDs; the detailed reviewed Markdown is saved as `.pi/plans/<id>.reviewed.md`. The original archive remains immutable. `.pi/plans/plan.md` is a review export containing historical material, not the implementation handoff.

Phase codes and unique heading names in presentation text link to matching headings in the archived source. Use the source’s actual identifiers and names; never invent a reference or link an ambiguous code to an arbitrary section.

## Harness connection

Pi supplies the native `plan_board` tool and `/planboard`; browser requests become follow-up messages in the same Pi session. In an MCP host, use the planning-kit `plan_board` tool and pass the absolute project `cwd` on project actions. After `open`, keep calling `wait` (45 seconds by default) while the user reviews. Process the returned request, use `answer` for a discussion, or `complete` with its `requestId` after handling a submitted batch, then wait again. Stop on approval or when the user asks to stop. An idle wait is not feedback. Report only public progress using `progress`; do not send private reasoning or credentials.

MCP does not universally wake an idle host: the agent must keep this review loop active. A disconnected session leaves unfinished requests queued. Reopen the same project and plan to resume, reconciling any saved partial changes first. Architecture and research use the owning session model and login. When fast routing is enabled, the Codex adapter runs an isolated `gpt-6-luna` request through the installed Codex login; Pi selects an available fast model through its own registry. Never substitute a different provider or a larger model silently. See [harness setup](references/harnesses.md) only when installing or troubleshooting a connection.

## Understand before proposing

Read the request, existing project, manifests, previous plans and feedback first. Reuse established architecture, components and terminology. List existing plans before creating another plan for the same work. Do not restart a partially implemented project.

Infer the kind when clear: `website`, `webapp`, `software`, or `other` for other development work. Landing pages and business sites are websites; APIs, libraries and CLI tools usually fit software. These are labels, not fixed workflows or a required selection menu. Ask one or two consequential questions when needed, explain why, and use provisional assumptions for nonblocking unknowns.

Read only the relevant guide:

- [Websites](references/websites.md): sitemaps, page/section purpose, content and visitor journeys.
- [UI behavior](references/ui-ux.md): forms, interaction states, accessibility and recovery.
- [Architecture and APIs](references/architecture-api.md): responsibilities, contracts, data, authentication and technical choices.

Keep this tool focused on development planning. It does not draw logos, thumbnails or wireframes, generate images, choose visual styles, or plan motion production. Sitemaps and section breakdowns explain structure and behavior.

## Present the selected workflow

Read [document-composition.md](references/document-composition.md) when creating or adapting a plan. Use schemaVersion 2 with author-defined `sections` and optional `workflow` metadata. The renderer does not prescribe five sections or select a template based on project type. Choose the useful content blocks; omit irrelevant material. Preserve selected workflow requirements and any original source document.

## Make decisions reviewable

Lead with a plain-language outcome and observable user results. Keep technical terms in named components, but explain their jobs in familiar language. Technology roles, reasons and main tradeoffs should each be a short sentence; put implementation evidence in deeper details. State shared caveats once and reference them instead of repeating audit history in every card. Use the existing system map for relationships rather than restating it across cards. Write decisions as questions the reviewer can answer, with concrete consequences; give a recommendation only when justified.

- Where relevant to the selected plan, explain the goal and observable success conditions. Separate current scope, later work and exclusions.
- Distinguish sourced facts, assumptions and unknowns. Do not invent user research, budgets, dates or precise effort estimates.
- When the plan makes technology choices, make them explicit in `technologies`: name, role, proposed/confirmed/deferred status, reason, tradeoffs, alternatives, dependencies, affected parts, source and checks. Cover frontend/backend, database, auth, hosting and integrations when relevant. Inspect existing versions and lockfiles; do not fabricate pinned versions or add infrastructure without a concrete need. State when accounts, a backend or a database are unnecessary.
- Explain how technology choices relate: set `fit` to `complement` (different responsibilities that work together), `choice` (competing approaches), or `optional` (a separately justified capability), and write a plain-language `fitDetail`. Use `unspecified` when evidence is missing. Use the same `choiceGroup` for mutually exclusive cards, and distinguish alternatives from temporary rollout fallbacks. Do not present a framework, its UI library and its database as three competing stacks.
- When authentication is in scope, distinguish it from authorization. Explain login, recovery, session expiry/logout, who enforces permissions, and checks for unauthorized access.
- Preserve the selected workflow's task boundaries and ordering. Explain each task's purpose, result, checks and prerequisites where supplied or needed for review. Dependencies describe ordering, not calendar dates or guaranteed parallel capacity.
- Ask about real unresolved decisions with meaningful alternatives. Scale detail to the request; do not add sections or maps just to fill the tool's available fields.

## Make the explanation understandable

Write for someone unfamiliar with the subject. Start with what a person is trying to do. Use short sentences with a named actor, an action and a result; explain unfamiliar terms on first use. Preserve precise technical names as secondary context. Never label the reader by intelligence or use patronizing language.

Every diagram must have authored `walkthroughs` shown above it: usually 3–7 numbered steps explaining the concrete story, with stable IDs and links to its actual nodes and directed edges. Each step answers what happens and why; finish with the outcome, and explain relevant failure/recovery separately. The renderer checks references, not semantic truth: verify that the prose and arrows describe the same behavior.

Split mixed processes into named walkthroughs so a reader follows one journey at a time. Use `kind:reading-guide` for a sitemap, static architecture or dependency overview; do not imply it is an execution sequence. Never infer a workflow from node placement. Keep advanced layers and the full map as supporting views. Follow the composition contract for the schema. New agent saves require walkthroughs; older maps have a clearly labeled reading guide until an agent authors the missing explanation.

Apply the same clarity to the rest of the plan: explain why a decision matters, whether tools work together or compete, and what a task produces. Keep commands and implementation evidence in expandable detail without hiding required gates. When revising a component or connection, update affected explanations too.

## Explain using maps

Use `plan_board action=catalog` for the compact node index; filter by category or query for details, e.g. `category:"software", query:"queue"`. Categories cover general planning, websites, software/APIs, data, security, delivery/operations and commerce. Choose types by responsibility, not color. A custom type may reuse an existing non-custom `baseType` with a clear label and description when needed.

Separate how the system works from the order of implementation. Use focused maps for a sitemap, section breakdown, user journey, API/data flow, authentication, state changes or failure recovery as needed. Explain unfamiliar terms alongside their roles. Diagrams are proposals, not proof of a working integration.

Author stable node IDs and compact consecutive `column`/`row` positions. Optional dashed `groups` mark responsibilities; do not enclose unrelated nodes. Layers explain selected parts without moving nodes or changing type colors. Each layer names its participating nodes and explains every connection endpoint. Arrows describe the operation or data; solid is the main path and dashed an alternate/conditional path. System flows can contain cycles; delivery dependencies cannot. Limits are 8 maps, 24 nodes per map and 7 layers, not targets.

The viewer provides pan/zoom, keyboard navigation, layer/topic focus and Mermaid export. Inspect readability, labels and routes before presenting a complex map. Do not execute arbitrary Mermaid or scripts from plan content.

## Save and review

Save structured content through `plan_board action=save`. Inspect returned structural findings; they detect missing fields and invalid dependencies, not the quality of reasoning. Use `action=open` with the saved ID and `openBrowser:true` when presenting review. `/planboard [file.md|id]` reviews the selected plan; without arguments it uses the current conversation draft; this package does not register `/plan` or a fixed project-type picker.

Keep one scrolling chalkboard document with the author's section order, one Annotate tool, anchored contextual conversations, and floating review actions. Use readable prose for explanations, tables for comparisons, sequences for ordering, and diagrams for relationships. Put long implementation details behind named disclosures. Preserve exact file paths, commands, test steps, gates and other workflow requirements in the appropriate blocks. Do not turn every sentence into a card or add sections to fill a template. Node explanations float beside their selected node. The viewer validates structure and references, not compliance with a development methodology or whether a test passed.

The agent tools are `catalog`, `save`, `patch`, `read`, `list`, `inbox`, `open`, `answer`; list is for recovery/discovery, not a browser history interface. Existing legacy documents remain readable. For imported Markdown, retain its literal content in `sourceDocument` alongside the concise authored review view.

Read feedback with `read` or `inbox`, retain stable IDs and save updates with the current `expectedRevision`. Resolve conflicts by rereading. A note changing a technology requires revisiting dependencies, contracts, session behavior, storage, deployment, tests and delivery steps. Explanation requests do not automatically change decisions. Historical notes retain their original quote, target and revision; never attach them silently to different wording.

Saving a note only stores it. The user clicks **Send annotations to agent** to submit the accumulated review. Process the submitted batch IDs and feedback IDs from `read` or `inbox`; do not treat unsubmitted notes as a request to revise. Keep the board open, revise with `save` and the current `expectedRevision`, and let the page refresh automatically. Preserve earlier feedback and stable anchors. Standalone submissions queue on disk and deliver when this project is reopened with `/planboard` in Pi. Retry batches retain their IDs; reconcile previously handled submissions before applying a change twice. State lives under `.pi/plans/`; the current plan and feedback are mirrored to `plan.md`. JSON and Markdown exports support handoff. Preserve recovery copies and user feedback.

**Annotate** is the single selection tool for saved annotations and direct agent interaction. The same bubble offers Ask, Request change, Save for review, and a one-click Suggest alternatives action. Ask/change requests send immediately; Save for review keeps the same written change as an annotation for batch submission. Suggest alternatives sends the selected context directly, with no alternatives text box for the user. Read the `discussions` thread, its original context/revision and any validated `selection`. Return replies with `plan_board action=answer`, `id`, `questionId` and `answer`; a chat-only reply will not appear in the browser. Keep answers concise and plain-language, explaining unfamiliar terms and concrete consequences.

- `ask`: explain without revising the plan.
- `alternatives`: generate and compare 2–4 viable approaches with tradeoffs from the selected context; the agent supplies the alternatives, not the user. Return structured `options:[{id,label,description,tradeoff}]` alongside `answer` so the user can select one. Request clarification instead of inventing options when needed. Do not change the plan yet.
- `change`: the user has explicitly requested a plan revision, either in text or by submitting a selected alternative. Reconcile the current plan with the original context, save with the current `expectedRevision`, then answer with what changed. Preserve unrelated work and stable IDs. This authorizes changing the plan, not implementing the project.

The bubble shows only the latest request and answer; previous/next paging is removed. Earlier exchanges remain saved for context and export. A single activity indicator appears above the request, or at the top of the page when the bubble is closed. The standalone viewer keeps drafts but requires a connected, listening agent session for live actions.

**Approve plan** requires reconciled detailed Markdown and no pending requests or unresolved submitted changes. Confirming saves an immutable `.pi/plans/<id>-r<revision>.approved.md` with a SHA-256 receipt and returns approval to the owning agent. Show that exact file path and review URL, then ask “Would you like me to implement this approved plan?” Wait for the answer. Do not revise or implement as part of accepting approval. MCP still needs an active listener; offline approvals queue until reconnection. When implementation is already explicitly authorized, do not ask again.

For a focused review request, use the supplied selected context before fetching the entire plan. For text-only changes, use `plan_board action=patch` with `id`, `expectedRevision`, and `changes:[{path,value}]`; stable paths use IDs (for example `technologies/database/role`). Patch preserves the source document and unrelated fields. Read and save the full plan for structural changes or when supplied context is insufficient.


## Fast requests and visible progress

Use the focused request context first. Ask and alternatives normally need one answer call; do not read the entire plan or catalog unless the supplied context is insufficient. For a small change, patch the affected stable text paths. For a structural change, read `paths:["plan"]`, revise once, save with the current revision and answer; successful saves already validate structure. Only reread after a conflict, missing evidence or an actual verification need. Use `read` with `paths:["technologies/sessions","diagrams/access"]` to inspect specific components. The source archive remains preserved by save. Omitting paths still returns the complete record.

For research or edits taking more than a few seconds, call `progress` immediately with the plan `id` and a short public `message`. Update at meaningful milestones, roughly every 15–20 seconds during active work. State what you are checking, what you learned or what remains. Never invent activity or stream private reasoning, credentials or raw tool arguments/results. Simple answers should go directly to `answer`; unnecessary status calls add latency.

Native Pi supplies tool start/end events and public response text. MCP only sees Planboard calls plus explicit progress; it cannot observe arbitrary Codex/Claude host tool calls or private thinking. An integrating MCP host can supply optional `toolName`, `toolCallId` and `toolStatus` on progress for a paired public tool event. Do not claim automatic cross-host telemetry. Changes to the MCP server need a connection restart; frontend assets update on page reload.

Measure persisted request acknowledgement, time to first public activity and final answer separately. Compare context bytes using the same plan and request. Byte reductions are not exact token counts, nor do they guarantee proportional model-latency improvements. Preserve constraints, dependencies, original source and submitted feedback when reducing context.


## Deterministic actions and model routing

The separate floating **Changes** rectangle below the tools starts collapsed. Revisions, changed parts and previous text unfold on demand; earlier history is folded away. Soft green highlights persist from a saved review baseline. Legacy reviews initialize that baseline just before the latest revision, avoiding presentation migration noise; new plans start at revision 1. Clear highlights advances only the review baseline, retains history, and does not approve the plan. Manual edits and agent changes share the same history. Users can revert any one eligible revision directly, without asking an agent or reverting later unrelated revisions. A revert saves a new revision, and can itself be reverted. The server checks the current revision, plan-field conflicts, resulting structure and detailed Markdown before saving. Conflicts or unavailable older Markdown snapshots are shown explicitly; never replace the whole current plan with an old snapshot to force an out-of-order revert.

Prefer built-in operations to model work. The browser Quick actions menu reads saved explanations and dependency links, or undoes the last plan revision without a model. Exact `Replace "old" with "new"` requests on a selected text field use a unique literal match. `Undo revision N` reverses that revision's recorded changes while retaining unrelated later edits; conflicts stop the operation. Never interpret “replace it with something else” as a blind string replacement. Repeated exact questions reuse a saved answer only while the plan fingerprint and selected context still match.

For alternatives, prepare `options[].prepared={revision,operations,sourceEdits}` when the scope is clear. Each operation has a stable `path`, the exact `before` JSON value and the replacement `value`; structural removal uses `remove:true`. The server validates the resulting plan and rejects stale or conflicting selections. Preparing an option does not apply it. Options without prepared operations still need an agent after selection.

Include `questionId` and a concise `answer` with `save` or `patch` to commit a requested change and its reply together. Do not call answer again. `undo` takes `id`, `expectedRevision` and optional `undoRevision` (the revision whose changes should be reversed). It also supports questionId/answer. No model is needed to compute the inverse.

The router is deterministic code, not another LLM. Short explanations and narrowly requested wording edits use a fast model. Architecture, provider changes, research, security judgements, comparisons and ambiguous changes use the owning session model; an available Astra session is suitable but never required. A fast responder must return `needsOwner` when the supplied facts are insufficient. In MCP hosts without an executable adapter, honor the returned fast route using a host-supported Luna/Flash worker. If unavailable, clearly report that limitation; do not quietly perform quick work with a larger model. This routing authorizes a narrowly scoped fast worker for a submitted review request, not unrelated delegation. Do not change the user's global model settings.

## Detailed Markdown and handoff

Read `paths:["document"]` to obtain the current detailed Markdown and reconciliation status. The source archive is historical evidence; keep it untouched. Save/patch accept `sourceEdits:[{find,replace}]`: each find must match exactly once in the detailed document, so unchanged file layouts, API examples, test requirements and gates survive. Unique exact text edits also synchronize automatically. A visual edit without a matching source passage marks the detailed document as needing reconciliation; it cannot be approved yet.

For structural changes or legacy plans, use `reconcile` with `id`, `expectedRevision`, and complete `reviewedMarkdown` (plus questionId/answer for a submitted reconciliation request). Preserve every unchanged detailed requirement and resolve superseded wording. Do not replace the full source with the shorter visual summary. Structural validation and exact matching cannot prove semantic completeness: inspect source coverage and any intentional removals. The original and versioned records are always retained.

Successful writes return `files` and `documentStatus`. Approval returns the exact revision, absolute Markdown path, SHA-256 and review URL; the host asks about implementation. Never hand an implementation agent the historical review export as if it were the reconciled approved plan.
