# Tasks instructions

Mark implemented tasks as you proceed. Make sure to update the TESTING.md document with the new features and their testing status (unit + e2e).

# Tasks list

[x] The overlay dots should be shown specific per page, not globally. (eq. if I open a property details page, only the overlay icons for that page should be shown, not the one for the map etc...)
[x] Remove the task types, all tasks are jsut tasks with a status.
[x] Remove priority
[x] Extract test id as a selector over a css selector (css selector as last resort)
[x] Add UI for the prototype to be able to switch between different variants of the same page or component
[x] Create me an HTML prototype for the full overlay UI in few variants (use or CLI for it to attach to the project and then generate following the instructions)
[x] tasks command should return all information that is inside the yaml front matter
[x] remove archive logic, command, and what is related
[] The task editing UI should be a full screen modal, with a simple .md editor. 2 tabs (edit and preview) please.
[] the overlay seams to be broken, there is an error in the console

    Uncaught SyntaxError: Unexpected token ','
        at eval (<anonymous>)
        at <anonymous>:2:20
        at <anonymous>:3:11

[] Fix the bug:

    root@BEAST:/home/zorcec/workspace/prototyper-cli# npx proto serve ./docs
    file:///home/zorcec/workspace/prototyper-cli/dist/index.js:2571
    registerPagesApi(app, isDir ? pageRoutes : []);
                                    ^

    ReferenceError: pageRoutes is not defined
        at serve (file:///home/zorcec/workspace/prototyper-cli/dist/index.js:2571:33)
        at Command.<anonymous> (file:///home/zorcec/workspace/prototyper-cli/dist/index.js:3046:9)
        at Command.listener [as _actionHandler] (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:542:17)
        at /home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1502:14
        at Command._chainOrCall (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1386:12)
        at Command._parseCommand (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1501:27)
        at /home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1265:27
        at Command._chainOrCall (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1386:12)
        at Command._dispatchSubcommand (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1261:25)
        at Command._parseCommand (/home/zorcec/workspace/prototyper-cli/node_modules/commander/lib/command.js:1457:19)

    Node.js v22.22.1