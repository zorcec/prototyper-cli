# Tasks instructions

Mark implemented tasks as you proceed. Make sure to update the TESTING.md document with the new features and their testing status (unit + e2e).

# Tasks list

[x] make sure that proto injected overlay doesnt interfeere with the extension. Only one should "win"
[x] add e2e testing possibility of the chrome extension, brainstorm abotu all the use cases that are possible and cover with e2e tests
[x] make chrome extension stable, so it never loses connection to the server, check how is that done in the browser bridge extension "/home/zorcec/workspace/sarah-ai/src/vscode-extensions/vscode-skills"
[x] add screenshot of selected area feature as part of the task, that is the only screenshot feature we need, any other you can clean up
[x] tasks in the protype area should add into the overlay a small sign on the item where something is put, once hovered it should show the tasks details as an overlay
[x] improve injected overlay code by splitting it into seperate files (css, UI ....)
[x] add edit task feature (from all places) / keep logic DRY
[x] add a way to be able to remove the screenshot
[x] add posibility to show/hide tasks in the overlay and on the side bar. Legend should be in the side bar to be able to toggle. Persistant in local storage
[x] when task "icon" in hte overlay is clicked, the poup stays on screen as long it is not closed or clicked somewhere else
[x] number os tasks is growing over time, and we need a way for the agent to manage it better. Add commands on the CLI to read tasks, with a filter (to get only done, not done, etc.). Update the copilot-rules.md and rules.md so the agent knows how to use the tool propery.
[x] create a prompt template that will get added to the project with purpose of implementing the tasks that are not done yet.
[x] add a feature "archive" and "archive" all for tasks. Once Archived, all tasks are collected into one .md file, and individual files are removed out. Add information  inside when were archived, and the reason provided by the user.
[x] screenshots are sometimes off, rework the logic to use the chrome extension API to get the screenshot, instead of the current logic that is based on the injected code.
[x] read the whole codebase, challange what can be simplified or improved in the implementation, and implement those improvements. (for example, we have some duplicated code in the server and extension for the screenshot, we can unify that, etc.).
[x] brainstorm about edge cases and what can be additional e2e tested, then implement those tests.
[x] improve unit tests coverage; >85% per files
[] improve the overlay filter, There should be a legend what should be shown what not. FIlter applies to both overlay icons and tasks sidebar

[] check an implement all tasks that are left in "/home/zorcec/workspace/home-finder/docs/real-estate-reference/prototype/.proto/tasks.md"
  - before implementation read: /home/zorcec/workspace/home-finder/docs/real-estate-reference/prototype/prototype-rules.md