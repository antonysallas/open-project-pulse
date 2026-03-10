// ============================================================
// Open Project Pulse - Report Template
// ============================================================
// This template recreates the HTML report preview in Typst
// for clean, lightweight PDF generation.
// ============================================================

// --- Color Definitions ---
#let primary-color = rgb("#0a3b6c")
#let primary-light = rgb("#219EBC")
#let secondary-color = rgb("#f50057")
#let accent-color = rgb("#219EBC")

#let success-color = rgb("#4caf50")
#let warning-color = rgb("#ff9800")
#let danger-color = rgb("#f44336")

#let timeline-active = rgb("#d4edda")
#let timeline-inactive = rgb("#d1ecf1")
#let timeline-marker-color = rgb("#e74c3c")
#let timeline-progress = rgb("#8bc34a")
#let timeline-date-bg = rgb("#f9e8d2")
#let sprint-bg = rgb("#e3f2fd")

#let tag-fyi = rgb("#94D2BD")
#let tag-ask = rgb("#BB3E03")
#let tag-directive = rgb("#795548")
#let tag-approval = rgb("#7d5ba6")

#let text-primary = rgb("#000000").transparentize(13%)
#let text-secondary = rgb("#000000").transparentize(40%)
#let text-light = white
#let bg-default = rgb("#fafafa")
#let bg-paper = white
#let divider-color = rgb("#e0e0e0")
#let number-blue = rgb("#1976d2")

// --- Page Setup ---
#set page(
  width: 842pt,
  height: auto,
  margin: (x: 40pt, y: 40pt),
  fill: white,
)

#set text(font: "Red Hat Text", size: 10.5pt, fill: text-primary)

// --- Helper Functions ---

// Dark blue label box (e.g., "REPORT DATE", "PROJECT STATUS")
#let label-box(content, width: auto) = {
  box(
    fill: primary-color,
    radius: 3pt,
    width: width,
    inset: (x: 10pt, y: 5pt),
    text(fill: text-light, weight: "medium", size: 10pt, upper(content))
  )
}

// White date box with border
#let date-box(content) = {
  block(
    width: 100%,
    fill: bg-paper,
    stroke: 0.75pt + divider-color,
    radius: 3pt,
    inset: (x: 10pt, y: 5pt),
    text(weight: "medium", size: 10pt, content)
  )
}

// Section with dark blue header
#let report-section(title, body-content) = {
  stack(dir: ttb, spacing: 0pt,
    // Header bar
    block(
      width: 100%,
      fill: primary-color,
      stroke: 0.75pt + primary-color,
      radius: (top: 3pt),
      inset: (x: 12pt, y: 10pt),
      text(fill: text-light, weight: "medium", size: 12pt, tracking: 0.5pt, upper(title))
    ),
    // Content area
    block(
      width: 100%,
      fill: bg-paper,
      stroke: (left: 0.75pt + divider-color, right: 0.75pt + divider-color, bottom: 0.75pt + divider-color),
      radius: (bottom: 3pt),
      inset: 16pt,
      body-content
    ),
  )
}

// Tag badge (ASK, FYI, DIRECTIVE, APPROVAL)
#let tag-badge(tag-type) = {
  let bg = if tag-type == "ASK" { tag-ask }
    else if tag-type == "FYI" { tag-fyi }
    else if tag-type == "DIRECTIVE" { tag-directive }
    else if tag-type == "APPROVAL" { tag-approval }
    else { gray }

  let fg = if tag-type == "FYI" { text-primary } else { text-light }

  box(
    fill: bg,
    radius: 3pt,
    inset: (x: 10pt, y: 8pt),
    width: 70pt,
    {
      set align(center)
      text(fill: fg, weight: "medium", size: 9pt, tracking: 0.5pt, upper(tag-type))
    }
  )
}

// Numbered list item with blue number
#let numbered-item(num, content-text) = {
  grid(
    columns: (14pt, 1fr),
    gutter: 3pt,
    text(fill: number-blue, weight: "bold", size: 10.5pt, [#num.]),
    {
      set par(leading: 1em, justify: true)
      text(size: 10.5pt, content-text)
    },
  )
}

// Status traffic light
#let status-indicator(status) = {
  let r-opacity = if status == "delayed" { 100% } else { 100% }
  let y-opacity = if status == "at-risk" { 100% } else { 100% }
  let g-opacity = if status == "on-track" { 100% } else { 100% }

  let marker-offset = if status == "on-track" { 75pt }
    else if status == "at-risk" { 45pt }
    else { 15pt }

  let indicator = box(
    stroke: 0.75pt + divider-color,
    radius: 3pt,
    clip: true,
    baseline: 4pt,
    {
      box(fill: danger-color, width: 30pt, height: 18pt)
      box(fill: warning-color, width: 30pt, height: 18pt)
      box(fill: success-color, width: 30pt, height: 18pt)
    }
  )

  stack(dir: ttb, spacing: 1pt,
    pad(left: marker-offset, text(size: 8pt, [▼])),
    indicator,
  )
}

// ============================================================
// TEMPLATE FUNCTION - Called with report data
// ============================================================

#let report(
  project-title: "Project Title",
  report-date: "05-Mar-2026",
  next-report-date: "12-Mar-2026",
  status: "on-track",
  year: "2026",
  timeline-dates: (),
  sprint-bars: (),
  progress-percentage: 0,
  marker-position: 0,
  current-sprint: 1,
  project-goals: (),
  accomplishments: (),
  upcoming-goals: (),
  people-and-process: (),
  technology: (),
) = {

  // === HEADER ===
  block(
    width: 100%,
    fill: bg-default,
    stroke: 0.75pt + divider-color,
    inset: 16pt,
    radius: 3pt,
    {
      grid(
        columns: (auto, 1fr, auto),
        align: (left + horizon, center + horizon, right + horizon),
        // Left: Report date boxes
        {
          grid(
            columns: (auto, 88pt),
            row-gutter: 3pt,
            column-gutter: 3pt,
            label-box("Report Date", width: 105pt), date-box(report-date),
            label-box("Next Report", width: 105pt), date-box(next-report-date),
          )
        },
        // Center: Project title
        text(font: "Red Hat Display", size: 18pt, weight: "medium", project-title),
        // Right: Status
        {
          {
            let marker-offset = if status == "on-track" { 72pt }
              else if status == "at-risk" { 42pt }
              else { 12pt }

            let indicator = box(
              stroke: 0.75pt + divider-color,
              radius: 3pt,
              clip: true,
              {
                box(fill: danger-color, width: 30pt, height: 18pt)
                box(fill: warning-color, width: 30pt, height: 18pt)
                box(fill: success-color, width: 30pt, height: 18pt)
              }
            )

            // Indicator with triangle overlaid above (no layout impact)
            let indicator-with-marker = box({
              place(dx: marker-offset, dy: -12pt,
                text(size: 12pt, [▼])
              )
              indicator
            })

            grid(
              columns: (auto, auto),
              gutter: 8pt,
              align: horizon,
              label-box("Project Status"),
              indicator-with-marker,
            )
          }
        },
      )
    }
  )

  v(20pt)

  // === TIMELINE ===
  report-section("Timeline", {
    let num-dates = timeline-dates.len()

    if num-dates > 0 {
      // Year badge centered
      {
        set align(center)
        v(4pt)
        box(
          fill: bg-paper,
          stroke: 0.75pt + divider-color,
          radius: 3pt,
          inset: (x: 14pt, y: 5pt),
          text(fill: secondary-color, weight: "medium", size: 12pt, year)
        )
        v(2pt)
      }

      // Timeline with marker overlay
      layout(size => {
        let content-width = size.width

        // Timeline date row + sprint bars as one table
        let timeline-table = {
          let date-cells = timeline-dates.map(d => {
            table.cell(
              fill: timeline-date-bg,
              inset: 8pt,
              align(center, text(weight: "medium", size: 10pt, d))
            )
          })

          let sprint-cells = sprint-bars.map(s => {
            let bg = if s.at("active", default: false) { timeline-active }
              else if s.at("prep", default: false) { rgb("#e8d5b7") }
              else { timeline-inactive }
            let cols = s.at("span", default: 1)

            table.cell(
              colspan: cols,
              fill: bg,
              inset: 8pt,
              align(center, text(weight: "medium", size: 10pt, upper(s.label)))
            )
          })

          table(
            columns: (1fr,) * num-dates,
            stroke: 0.5pt + white,
            ..date-cells,
            ..sprint-cells,
          )
        }

        let progress = block(
          width: 100%,
          height: 12pt,
          radius: 6pt,
          fill: rgb("#dddddd"),
          clip: true,
          {
            block(
              width: progress-percentage * 1%,
              height: 12pt,
              fill: timeline-progress,
              radius: (left: 6pt),
            )
          }
        )

        // Marker position as percentage of width
        let marker-x = marker-position * content-width / 100

        box(width: 100%, {
          // Actual content below the triangle
          pad(top: 14pt, {
            timeline-table
            v(1pt)
            progress
          })
          // Red marker (triangle + line grouped)
          place(top + left, dx: marker-x, dy: 0pt,
            box({
              place(dx: -3.25pt, dy: 1pt,
                text(fill: timeline-marker-color, size: 12pt, [▼])
              )
              place(dy: 8pt,
                line(
                  start: (0pt, 0pt),
                  end: (0pt, 77pt),
                  stroke: 1pt + timeline-marker-color,
                )
              )
            })
          )
        })
      })
    }
  })

  v(20pt)

  // === PROJECT OBJECTIVES ===
  report-section("Project Objectives", {
    text(weight: "bold", size: 11pt, [Overall Project Goals and Objectives])
    v(10pt)
    pad(left: 8pt, {
      for (i, goal) in project-goals.enumerate() {
        numbered-item(i + 1, goal)
        v(6pt)
      }
    })
  })

  v(20pt)

  // === ACCOMPLISHMENTS & UPCOMING GOALS (side by side) ===
  grid(
    columns: (1fr, 20pt, 1fr),
    // Accomplishments
    report-section("Accomplishments", {
      text(weight: "bold", size: 11pt, [Current Sprint Goals and Accomplishments])
      v(10pt)
      pad(left: 8pt, {
        if accomplishments.len() == 0 {
          text(fill: text-secondary, [No accomplishments listed])
        } else {
          for (i, item) in accomplishments.enumerate() {
            numbered-item(i + 1, item)
            v(6pt)
          }
        }
      })
    }),
    // Spacer
    [],
    // Upcoming Goals
    report-section("Upcoming Goals", {
      text(weight: "bold", size: 11pt, [Upcoming Sprint Goals])
      v(10pt)
      pad(left: 8pt, {
        if upcoming-goals.len() == 0 {
          text(fill: text-secondary, [No upcoming goals listed])
        } else {
          for (i, item) in upcoming-goals.enumerate() {
            numbered-item(i + 1, item)
            v(6pt)
          }
        }
      })
    }),
  )

  v(20pt)

  // === PEOPLE AND PROCESS & TECHNOLOGY (side by side) ===

  // Group items by type for a section
  let render-items-by-type(items) = {
    let item-types = ("ASK", "APPROVAL", "DIRECTIVE", "FYI")
    for tag-type in item-types {
      let filtered = items.filter(it => it.type == tag-type)
      if filtered.len() > 0 {
        tag-badge(tag-type)
        v(8pt)
        pad(left: 8pt, {
          let counter = 1
          for item in filtered {
            numbered-item(counter, item.text)
            v(6pt)
            counter = counter + 1
          }
        })
        v(8pt)
      }
    }
  }

  grid(
    columns: (1fr, 20pt, 1fr),
    // People and Process
    report-section("People and Process", {
      render-items-by-type(people-and-process)
    }),
    [],
    // Technology
    report-section("Technology", {
      render-items-by-type(technology)
    }),
  )

  v(20pt)

  // === LEGEND ===
  report-section("Legend", {
    text(weight: "bold", size: 11pt, [Legend])
    v(12pt)
    pad(left: 8pt, {
      grid(
        columns: (1fr, 1fr),
        row-gutter: 14pt,
        column-gutter: 20pt,
        // ASK
        {
          grid(
            columns: (auto, 1fr),
            gutter: 8pt,
            align: horizon,
            tag-badge("ASK"),
            text(size: 9.5pt, fill: text-secondary, [High risk. Needs urgent resolution by Stakeholders.]),
          )
        },
        // DIRECTIVE
        {
          grid(
            columns: (auto, 1fr),
            gutter: 8pt,
            align: horizon,
            tag-badge("DIRECTIVE"),
            text(size: 9.5pt, fill: text-secondary, [Needs Stakeholders' mandatory instruction.]),
          )
        },
        // APPROVAL
        {
          grid(
            columns: (auto, 1fr),
            gutter: 8pt,
            align: horizon,
            tag-badge("APPROVAL"),
            text(size: 9.5pt, fill: text-secondary, [Awaiting Stakeholders' "Yes/No" decision.]),
          )
        },
        // FYI
        {
          grid(
            columns: (auto, 1fr),
            gutter: 8pt,
            align: horizon,
            tag-badge("FYI"),
            text(size: 9.5pt, fill: text-secondary, [For information only. No action needed.]),
          )
        },
      )
    })
  })
}

// ============================================================
// EXAMPLE USAGE - Replace with actual data from the app
// ============================================================

#report(
  project-title: "AIS AI Labs Residency",
  report-date: "04-Mar-2026",
  next-report-date: "11-Mar-2026",
  status: "delayed",
  year: "2026",
  timeline-dates: ("04-Mar", "20-Mar", "23-Mar", "27-Mar", "30-Mar", "03-Apr", "06-Apr", "10-Apr", "20-Apr", "24-Apr", "27-Apr", "01-May"),
  sprint-bars: (
    (label: "Prep", span: 2, prep: true),
    (label: "Sprint 1", span: 2, active: false),
    (label: "Sprint 2", span: 2, active: false),
    (label: "Sprint 3", span: 2, active: false),
    (label: "Sprint 4", span: 2, active: false),
    (label: "Sprint 5", span: 2, active: false),
  ),
  progress-percentage: 4,
  marker-position: 4,
  current-sprint: -1,
  project-goals: (
    "Develop a custom LLM-based intent and NLU Engine to replace Nuance by fine-tuning an opensource model on AIS's proprietary chat dataset",
    "Provide full ownership and extensibility by enabling AIS team with hands-on training on Red Hat OpenShift AI operations",
  ),
  accomplishments: (
    [*Use Case Finalisation:* Successfully finalised the AI Use Case for the Labs Residency with AIS stakeholders for the upcoming engagement.],
    [*Prerequisites Identification & Alignment:* Identified and shared a structured prerequisite assessment covering platform, data, integration components, and team readiness. Clearly communicated all dependencies and required preparatory work to the AIS team to prevent execution delays during the 5-week engagement.],
    [*Platform Selection Confirmation (Azure ARO):* Secured confirmation from AIS that Azure Red Hat OpenShift (ARO) will be the target platform for the engagement. This decision aligns with AIS's existing Azure ecosystem, internal approval processes, and cost optimisation strategy.],
  ),
  upcoming-goals: (
    [*Platform Readiness & Environment Confirmation:* Validate technical equivalency of Azure ARO sizing against the originally proposed AWS/ROSA configuration, confirm provisioning timelines for OpenShift, RHOAI, and supporting infrastructure, and ensure environment readiness prior to engagement commencement to mitigate delivery risk.],
    [*Data Readiness & Preparation Strategy:* Evaluate the quality and structure of the Nuance data dump provided by AIS, identify required curation, sanitisation, and labelling improvements, confirm AIS ownership of training dataset preparation, and determine the scope of Red Hat enablement support required to ensure data is suitable for model training.],
    [*Solution Component Operational Readiness:* Confirm AIS operational readiness for all supporting solution components (Redis, chatbot frontend/backend, orchestrator, and backend integrations), including environment provisioning, CI/CD pipeline setup, integration endpoint access, and security approvals, to prevent downstream delays during model integration and testing phases.],
    [*AIS Team Availability & Engagement Stability:* Validate confirmed resource allocation from AIS for the entire 5-week engagement, assess implications of recent schedule changes, and proactively identify risks arising from partial allocation, competing initiatives, or decision-making delays to protect engagement outcomes and delivery timelines.],
  ),
  people-and-process: (
    (text: [*SOW App3 Revision Requirement Due to Scope Change:* The revised use case extends beyond what is documented in the current change request form, which does not adequately define updated outcomes, assumptions, prerequisites, dependencies, and risks. A formal SOW update is required to secure customer alignment and mitigate delivery, scope, and commercial risks.], type: "FYI"),
  ),
  technology: (
    (text: [*Platform Readiness Delay:* AIS has confirmed Azure Red Hat OpenShift (ARO) as the preferred deployment platform over the initially proposed ROSA (AWS-based) setup due to alignment with their existing Azure ecosystem, streamlined internal approval processes, and cost advantages through Microsoft enterprise agreements. The environment is not ready yet and there is a risk that provisioning delays for ARO, RHOAI, and supporting infrastructure could impact the engagement timeline. Red Hat is actively working with AIS to validate technical equivalency of the ARO configuration and expedite environment readiness to mitigate this risk.], type: "FYI"),
    (text: [*Data Readiness Risk:* The data export provided by AIS does not meet the data requirements as requested by the Red Hat team. The AIS teams have been briefed on the data requirements and the importance of data quality for model training, but there is a risk that the data may not be sufficiently curated, sanitized, or labeled in time for the engagement, which could impact the effectiveness of the model training and overall engagement outcomes.], type: "FYI"),
  ),
)
