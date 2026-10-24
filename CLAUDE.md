See [AGENTS.md](AGENTS.md) for project instructions.

## Working with the dev app

- After finishing a change, end the reply with the URL of the running app and the dev sign-in, so it can be tested straight away. Check the app answers first and start it if not (Quarkus dev mode with Quinoa; Docker must be running for the Postgres, Keycloak and Mailpit Dev Services).
  - App: http://localhost:8080, `dev@labeleur.test` / `labeleur-dev`
  - Keycloak admin, where relevant: http://localhost:8180, `admin` / `admin`
  - Mailpit, where relevant: http://localhost:8025
- For visual checks, don't use the Claude in Chrome extension: its browser can't reach the local dev server (ERR_CONNECTION_REFUSED on localhost). Instead launch local headless Chrome (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=<scratch dir>`) and drive it with a small Node script over the CDP WebSocket (`Page.navigate`, `Runtime.evaluate` to sign in and click, `Page.captureScreenshot`), then read the PNG. Wrap evaluated code that awaits in an async IIFE.
