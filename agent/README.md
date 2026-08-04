# IELTS Speaking Examiner Agent

This LiveKit Agent is used only by the Speaking stage of the Exam Simulator. The
dashboard Speaking practice page does not connect to this service.

## Local development

The agent automatically loads `../backend/.env` when no `agent/.env.local` value is
provided. You can also copy `.env.example` to `agent/.env.local` and configure the
LiveKit credentials there.

From the repository root:

```bash
npm run dev:agent
```

Or run the complete local stack:

```bash
npm run dev
```

The backend creates and dispatches the `ielts-examiner` agent when the simulator
enters its Speaking stage. If the agent is not running, the browser can connect to
the room but will display a waiting state until the worker is available.
