# Gemini Interaction Guidelines

This document outlines specific guidelines for the Gemini model when interacting with the DJ DataForge v6 project.

## General Instructions

- **Language:** Prioritize Portuguese for user-facing communication, especially when explaining code or project concepts, as the existing documentation and comments are predominantly in Portuguese.
- **Code Style:** Adhere strictly to the existing TypeScript and JavaScript code style, formatting, and naming conventions found in the `src/` directory.
- **Dependencies:** Before introducing any new libraries or frameworks, verify their usage within the project by checking `package.json` and existing import statements.
- **Testing:** When implementing new features or fixing bugs, always consider adding or updating relevant unit and E2E tests. Refer to the `npm run test` scripts in `package.json` for existing testing patterns.
- **Build Process:** After making changes, ensure the project builds correctly by running `npm run build`.
- **Linting & Type Checking:** Always run `npm run lint` and `npm run type-check` to ensure code quality and type safety.

## Project-Specific Information

- **Project Name:** DJ DataForge v6
- **Core Technologies:** Vite, TypeScript, React (implied by `vite.config.ts` and `src/app.ts` but not explicitly stated as React in `README.md`), PapaParse, SheetJS, idb, Chart.js, decimal.js.
- **Key Directories:**
    - `src/@core/`: Contains core logic (Workbook, CalcEngine, Storage, Kernel).
    - `src/plugins/`: Contains plugin implementations.
    - `dist/`: Build output directory.
- **Build Execution:** When testing the build, remember to use `npm run preview` or a local HTTP server (e.g., `python -m http.server`) instead of directly opening `index.html` due to CORS policies.

## Workflow for Code Changes

1.  **Understand:** Thoroughly read the relevant code, documentation (especially the SPECs mentioned in `README.md`), and existing tests.
2.  **Plan:** Formulate a detailed plan, including any new tests to be written.
3.  **Implement:** Write code adhering to project conventions.
4.  **Test:** Run unit/E2E tests.
5.  **Verify:** Run `npm run build`, `npm run lint`, and `npm run type-check`.
6.  **Review:** Self-review changes against the plan and guidelines.

This `GEMINI.md` file will help ensure consistent and effective interactions with the DJ DataForge v6 project.
