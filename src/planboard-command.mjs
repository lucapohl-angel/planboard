import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function planboardCommandRequest(argument=''){
 const skillPath=fileURLToPath(new URL('../skills/planboard/SKILL.md',import.meta.url));
 const skill=await readFile(skillPath,'utf8');
 return `The user explicitly invoked /planboard${argument?' with argument '+JSON.stringify(argument):' without a filename'}. Use the plan already drafted in this conversation, or the specified plan file. If the plan is only visible text or structured steps, faithfully save that public draft as Markdown first; do not invent or expand it. If no clear plan is available, ask which plan to review. Respect the harness's current permissions and plan-mode restrictions. Then use plan_board save with markdownPath, followed by open with openBrowser:true. Reuse the existing review if it matches this plan. This requests human review, not implementation.\n\nSkill instructions (relative links resolve from ${fileURLToPath(new URL('../skills/planboard/',import.meta.url))}):\n${skill}`;
}
