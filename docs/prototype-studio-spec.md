# Prototype Studio — Product Specification

## What This Is

Prototype Studio is a command-line tool for frontend prototyping with LLM assistance. It bridges the gap between an LLM generating HTML screens and a developer reviewing, annotating, and iterating on them. The tool handles everything between "the LLM wrote a file" and "the LLM receives precise feedback" — making that loop fast, visual, and frictionless.

It is not a code editor. It is not an LLM interface. It is the review and annotation layer that sits between your editor (VS Code + Copilot) and your browser, turning a static HTML file into an interactive feedback surface.

---

## The Problem It Solves

When an LLM generates a UI prototype, the current feedback loop is broken. You either describe changes in vague prose ("make it look better"), paste entire files back and forth manually, or lose track of which version you were commenting on. There is no way to click on a specific element and say exactly what should change there. There is no contract that tells the LLM how to structure its output so it can be reliably targeted later. There is no way to accumulate multiple pieces of feedback across an entire screen before sending them all at once.

Prototype Studio solves all three problems.

---

## Core Concept

The tool works as a local server that you point at an HTML file. It serves that file in your browser, but with one important addition: a thin invisible layer of JavaScript injected into the page that turns it into an annotation surface. This injected code has no visual presence until you activate it — the prototype looks and behaves exactly as the LLM generated it. When you enter annotation mode, the same page becomes interactive: you can click any element, leave a typed comment, tag it with an intent, and move on. Those comments get written back into the HTML source file as structured HTML comments, positioned precisely at the element you clicked. When you are done annotating, you export the file — now rich with embedded intent — and hand it back to any LLM to action.

The LLM reads the file, sees the comments inline with the markup they describe, implements each one, removes the comment when done, and writes the updated file back to disk. The browser reloads automatically. The loop starts again.

---

## The Two Sides of the Tool

**The server side** runs on your machine as a background process started from the terminal. It is responsible for serving the HTML file, watching it for changes made by external tools (your editor, Copilot, any LLM agent), pushing reload signals to the browser over a persistent connection, receiving annotation events from the browser, and writing those annotations back into the correct location in the HTML source file. It also handles exporting the annotated file as a ready-to-paste LLM prompt.

**The client side** is a small JavaScript bundle that the server injects into every HTML file it serves. It is invisible by default and activates only when you invoke it. It is responsible for the annotation overlay, the comment popover UI, sending annotation data to the server, and receiving and displaying reload signals. It must be lightweight enough to have no impact on how the prototype looks or behaves in its normal state.

---

## Annotation as the Core Primitive

The annotation is the fundamental unit of this tool. An annotation is a piece of feedback attached to a specific element in a specific file. It has four parts: where it is (the element it targets), what kind of feedback it is (the tag), what the feedback says (the text), and when it was created.

The tags define the vocabulary of the feedback system. Each tag carries a specific meaning that the LLM is trained to act on differently:

**TODO** means something about this element needs to change. It is a direct instruction. The LLM implements it and removes the comment.

**FEATURE** means something new should be added at this location. It is an additive instruction. The LLM adds it and removes the comment.

**VARIANT** means an alternative version of this section should be generated alongside the current one. The LLM produces the variant and marks it clearly, but leaves the original intact.

**KEEP** means this element must not be changed under any circumstances. It is a preservation signal. The LLM reads it and skips the element entirely, even if other changes nearby might otherwise affect it.

**QUESTION** means you want the LLM to answer something before acting. The LLM responds by writing its answer back as a comment, and waits for you to remove it or replace it with a TODO before proceeding.

**CONTEXT** means background information that should inform decisions but requires no direct action. The LLM reads it silently and uses it as design context.

These tags form the entire communication protocol between you and the LLM. They are embedded in the HTML itself, not in a separate file, not in a chat interface — inline with the markup they describe. This means the LLM has perfect spatial context: it knows not just what you want changed, but exactly where in the document you want it.

---

## The Annotation Contract

For the annotation system to work reliably across LLM iterations, the HTML files must be structured in a predictable way. This is the annotation contract — a set of rules that the LLM must follow when generating prototype files.

The most important rule is that every meaningful element in the prototype must carry a stable semantic identifier in its markup. This identifier does not change when the LLM rewrites surrounding content. It is how the tool knows where to re-attach annotations after a file has been regenerated. Without this, annotations drift — a comment left on a button in version one might land on a completely different element in version two.

The contract also specifies how the file should be structured in general: how to handle styles, how to reference assets, what assumptions to make about the viewport, and what constitutes a "self-contained" prototype file. A file that violates these rules may still serve and preview correctly, but annotation targeting becomes unreliable.

The contract is not enforced programmatically. It is enforced through the LLM's instructions. The tool generates a rules document that you add to your project, and that document becomes part of every prompt — either automatically through your editor's context (Copilot reads workspace files) or explicitly through the export prompt.

---

## The Initialization Workflow

When you use the tool in a project for the first time, you run an initialization command. This writes two things to your project: a full rules document that specifies everything the LLM must know to generate compatible prototypes, and a condensed version of those rules formatted specifically for GitHub Copilot's automatic workspace instruction file.

After initialization, any LLM that has access to your workspace — Copilot, Claude Code, or any agent you configure — will automatically follow the rules when generating prototype files, without you needing to remind it in every prompt.

---

## The Serving Workflow

You point the tool at a file or a directory. It starts a local server and opens your browser. If you point it at a directory, every HTML file in that directory becomes a tab in the browser interface, and you can switch between them. This is how variant review works: ask the LLM to generate three variants, each as a separate file, and the tool presents all three side by side.

The browser view is the prototype exactly as generated, with the invisible annotation layer attached. You review the design as a user would experience it. When you want to leave feedback, you activate annotation mode with a keyboard shortcut. The page shifts subtly to signal that you are in annotation mode — elements highlight as you hover over them. You click, type your comment, choose a tag, and confirm. The overlay disappears. You continue reviewing.

At any point, you can open a sidebar that lists all annotations left so far — their tag type, their text, and which element they target. You can delete annotations from this sidebar. You can also see the annotations rendered as small visual badges overlaid on their target elements, so you always know what has already been commented on.

---

## The Export Workflow

When you have finished annotating and are ready to hand off to the LLM, you run the export command. The tool assembles a complete prompt: it takes the current HTML file — with all annotations embedded as HTML comments — wraps it in a precise set of instructions that tells the LLM exactly what each tag means and what to do with it, and outputs the result to your clipboard.

You paste this into Copilot Chat, Claude, or any LLM interface. The LLM works through the file, implements every annotation, and writes the result back to disk. The tool's file watcher detects the change and reloads your browser automatically. You review the new version and begin the next annotation pass.

---

## The Validation Workflow

After the LLM returns a new version of the file, you can run a validation pass. The tool checks that the stable element identifiers from the previous version are still present, that every TODO and FEATURE comment has been removed (meaning the LLM implemented them), that every KEEP element is unchanged, and that the file is valid HTML with no external dependencies introduced. If any check fails, the tool tells you exactly what is missing or broken before you open the browser.

This turns LLM output from something you trust blindly into something you can verify against an explicit contract.

---

## What the Tool Is Not

It is not an LLM. It makes no API calls to any model. It does not generate prototypes. It does not apply annotations automatically. All generation and implementation is done by external tools — your editor, Copilot, Claude Code, or any agent you choose. The tool's only job is to make the review and annotation step as fast and precise as possible, and to produce the best possible input for whatever LLM you hand the file back to.

It is not opinionated about which LLM you use. The export format is plain text. It works with any chat interface, any agent, any API.

It is not a web application framework. The prototypes it serves are plain HTML files. No build step, no bundler, no component system. The simplest possible substrate — a single file that any LLM can read and write in one pass.

---

## Success Criteria

The tool is successful if it makes the following true:

You can go from a freshly generated prototype to a fully annotated feedback pass in under five minutes. The LLM never has to guess where on the screen you mean — your comment is already sitting next to the element in the markup. Every annotation survives an LLM iteration without drifting to the wrong element. You never manually copy-paste file contents into a chat interface — the export command handles the entire prompt assembly. And after three or four iteration loops, you have a prototype that looks and behaves the way you intended, built through a workflow that felt like a natural extension of your existing editor setup rather than a separate tool you had to learn.
