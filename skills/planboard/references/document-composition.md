# Workflow-owned composition

Use `plan_board(action="catalog", catalogKind="document")` for the current block contract. The existing default catalog still describes diagram node types.

New documents use `schemaVersion:2`. The root requires `title`, `brief`, `kind`, and `sections`. Section names and order come from the user's chosen workflow. Project kind is a descriptive label and does not select a template.

```json
{
  "schemaVersion": 2,
  "title": "Password reset",
  "kind": "webapp",
  "brief": "Help customers recover access without contacting support.",
  "workflow": {
    "name": "Team BDD workflow",
    "source": "The user's selected workflow",
    "constraints": ["Agree on observable behavior before implementation"]
  },
  "sections": [{
    "id": "expired-link",
    "title": "An expired link",
    "blocks": [{
      "id": "scenario",
      "type": "sequence",
      "items": [
        {"id":"given","label":"Given","detail":"The reset link has expired."},
        {"id":"when","label":"When","detail":"The customer opens the link."},
        {"id":"then","label":"Then","detail":"Explain that it expired and offer a new link."}
      ]
    }]
  }]
}
```

Available presentations:

- `text`: plain prose in `text`. Keep paragraphs concise; the renderer never executes HTML.
- `list`, `sequence`: `items:[{id,label,detail?}]`. Sequences visualize ordering; labels are arbitrary, not hardcoded BDD/TDD phases. Listed checks are planned checks, not passing results.
- `table`: `columns:string[]`, `rows:[{id,cells:string[]}]`. Use shared criteria for comparisons.
- `code`: literal `text` for file examples, commands, or verification instructions. Nothing executes in the viewer.
- `field`: `path` referencing existing plan text, `success`, or `scope/now|later|out`, avoiding duplicated content.
- `diagrams`, `tasks`, `technologies`, `decisions`: `ids` referencing the existing top-level `diagrams`, `steps`, `technologies`, or `questions` collections. Each defined reference item must be placed exactly once. Diagram syntax and IDs retain the existing catalog contract.

Every block has `id`, `type`, optional `title`, and optional `collapsed`. A collapsed block requires a title. Sections also have an optional short `summary` and `collapsed` flag. IDs stay stable when text or ordering changes. Text paths such as `sections/expired-link/blocks/scenario/items/then/detail` support annotations and revision-checked patches.

Use the same primitives for any method. A TDD plan can have one section per feature with a sequence inside it. A Superpowers plan can keep its own headings and task boundaries, referencing tasks and placing exact commands in code blocks. Do not invent compliance with a skill you have not read. In native Pi, follow the user's selected installed workflow skill; when passing a plan to the standalone reviewer, include its relevant constraints and source. The standalone reviewer does not automatically load arbitrary installed skills.

Write or select a plan `.md` file before presenting it. Pass `markdownPath` on the first save; the tool reads and archives the exact source as `sourceDocument:{name,path,sha256,sections:[{id,title,content}]}`. Do not generate this archive yourself. Later saves retain it. The review document is an authored presentation of that plan; do not silently drop requirements, change gates, or claim there is a Markdown parser that infers the workflow. The original download stays available; Markdown export follows the authored section order, with the original source and feedback retained.

Existing schemaVersion 1 plans keep their old presentation. Only migrate them when requested or when adopting an authored layout is part of the task; preserve their IDs, source document, annotations, discussions and saved revision history. An alternative template is not a reason to start a new plan for the same work.

## Diagram explanations

Every diagram saved through `plan_board action=save` requires `walkthroughs:[{id,title,kind,intro,result,steps}]`. Use `kind:"journey"` for an actual process or `kind:"reading-guide"` for understanding static structure. Each step is `{id,title,explanation,nodeIds,edges:[{layerId,from,to}]}`. `edges` may be empty for a step explaining a part without a transition. Each referenced edge must already exist in that layer, with both endpoints in the step's `nodeIds`. The viewer never invents connections. Get the complete contract from `catalogKind:"document"`.

Titles should describe familiar actions; explanations define unfamiliar terms in one or two short sentences. The first walkthrough opens initially. Steps are always shown above the canvas; selecting one highlights its parts. Different workflows use the same schema with their own stories and vocabulary. Stable paths such as `diagrams/system/walkthroughs/upload/steps/check/explanation` can be annotated and patched. Markdown exports retain the explanations.

Legacy records can still load and receive focused patches. Their fallback lists existing parts and explicitly says it is a reading guide, not an execution order. A full agent save must supply the actual explanation. The standalone reviewer receives the compact explanation rules directly in its system prompt; this does not depend on loading the skill body.
