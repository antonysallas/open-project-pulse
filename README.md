# Open Project Pulse

A simple, local web app for creating professional project progress reports. Fill in a form, preview the report, and generate a PDF — all from your browser.

## What It Does

- **Multi-step form** to enter project status, accomplishments, goals, and updates
- **Visual timeline** showing sprints and current progress
- **PDF export** saved automatically to the project directory
- **Multiple projects** supported via simple JSON configuration
- **Tagged items** (ASK, APPROVAL, DIRECTIVE, FYI) for stakeholder communication

## Getting Started

```bash
git clone <your-repo-url>
cd open-project-pulse
bash run.sh
```

Use `bash run.sh` every time. It figures out what to do:

- **First run** -- installs Node.js (Mac only, via Homebrew),
  dependencies, and sample data, then starts the app
- **Every run after** -- just starts the app

It also picks another port automatically if 3010 is already in use.

## Adding Your Own Project

### Step 1: Create a project details file

Create a new JSON file in `public/data/projects/`. Use this template:

```json
{
  "id": "my-project",
  "name": "My Project Name",
  "description": "A short description of the project",
  "startDate": "2026-01-05",
  "endDate": "2026-03-27",
  "sprintDuration": 1,
  "teamName": "My Team",
  "status": "in-progress",
  "projectGoals": [
    "First goal for the project",
    "Second goal for the project"
  ],
  "sprints": [
    { "number": 1, "startDate": "2026-01-05", "endDate": "2026-01-09", "name": "Sprint 1" },
    { "number": 2, "startDate": "2026-01-12", "endDate": "2026-01-16", "name": "Sprint 2" },
    { "number": 3, "startDate": "2026-01-19", "endDate": "2026-01-23", "name": "Sprint 3" }
  ]
}
```

**Notes:**

- `id` must be unique and match the filename (e.g., `my-project.json`)
- `status` must be `"in-progress"` for the project to appear in the app
- Dates use `YYYY-MM-DD` format
- Add as many sprints as your project needs

### Step 2: Register it in the project list

Edit `public/data/projects.json` and add your project:

```json
{
  "projects": [
    {
      "id": "my-project",
      "name": "My Project Name",
      "description": "A short description",
      "status": "in-progress",
      "detailsFile": "projects/my-project.json"
    }
  ]
}
```

Refresh the app and your project will appear in the project selector.

## Generating Reports

1. Select your project
2. Fill in the report details (dates, status, accomplishments, goals, etc.)
3. Preview the report in the final step
4. Click **Generate & Save Report**

Reports are saved to the `reports/` directory as both JSON and PDF.

## Project Structure

```
open-project-pulse/
  public/
    data/
      projects.json             <- your project list
      projects/                 <- project detail files
      *.json.example            <- sample files for reference
  reports/                      <- generated reports (JSON + PDF)
  src/                          <- application source code
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md)
before submitting a pull request.

## License

This project is licensed under the GNU General Public License v3.0 --
see the [LICENSE](LICENSE) file for details.
