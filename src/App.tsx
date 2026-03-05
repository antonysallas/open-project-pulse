import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import html2pdf from "html2pdf.js";
import React, { useCallback, useEffect, useState } from "react";
import ProjectSelector from "./components/ProjectSelector";
import ReportForm from "./components/ReportForm";
import "./styles/main.css";
import { ProjectInfo, ReportData, SerializedTimelineWeek, WeeklyReport, TimelineWeek } from "./types/ReportTypes";
import { getWeeklyReports, saveWeeklyReport, saveReportPdf } from "./utils/projectService";
import { getCurrentSprintNumber } from "./utils/projectUtils";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0f3b64",
    },
    secondary: {
      main: "#e74c3c",
    },
    background: {
      default: "#f5f7fa",
    },
  },
  typography: {
    fontFamily: "var(--font-family)",
    h1: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    h2: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    h3: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    h4: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    h5: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    h6: {
      fontFamily: "var(--font-family)",
      fontWeight: 700,
    },
    subtitle1: {
      fontFamily: "var(--font-family)",
      fontWeight: 500,
    },
    subtitle2: {
      fontFamily: "var(--font-family)",
      fontWeight: 500,
    },
    body1: {
      fontFamily: "var(--font-family)",
      fontWeight: 400,
    },
    body2: {
      fontFamily: "var(--font-family)",
      fontWeight: 400,
    },
    button: {
      fontFamily: "var(--font-family)",
      fontWeight: 500,
      textTransform: "none",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: "var(--font-family)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-root": {
            fontFamily: "var(--font-family)",
          },
          "& .MuiInputLabel-root": {
            fontFamily: "var(--font-family)",
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: "var(--font-family)",
        },
      },
    },
  },
});

const steps = ["Select Project", "Fill Report Details", "Preview & Generate"];
const formSubStepTitles = ["Basic Info", "Sections & Content", "Review & Preview"];

// Helper functions for date calculations
const calculateDaysRemaining = (endDate: string, currentDate: Date = new Date()): number => {
  const end = new Date(endDate);
  const diffTime = end.getTime() - currentDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateCompletionPercentage = (startDate: string, endDate: string, currentDate: Date = new Date()): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalTime = end.getTime() - start.getTime();
  const elapsedTime = currentDate.getTime() - start.getTime();

  let percentage = (elapsedTime / totalTime) * 100;
  percentage = Math.min(Math.max(percentage, 0), 100); // Ensure between 0-100
  return Number(percentage.toFixed(1));
};

const findCurrentTimelinePosition = (dates: TimelineWeek[], currentDate: Date = new Date()): number => {
  // Find the closest date that's not in the future
  let closestPastIndex = 0;
  const currentTime = currentDate.getTime();

  for (let i = 0; i < dates.length; i++) {
    if (dates[i].date.getTime() <= currentTime) {
      closestPastIndex = i;
    } else {
      break;
    }
  }

  return closestPastIndex;
};

function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [formSubStep, setFormSubStep] = useState(0);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("success");

  // Scroll to top when navigating between steps or substeps
  useEffect(() => {
    // Small timeout to ensure DOM updates first
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100);
  }, [activeStep, formSubStep]);

  useEffect(() => {
    // If a project is selected, initialize the report data
    if (selectedProject) {
      const today = new Date();
      const nextReportDate = new Date(today);
      nextReportDate.setDate(today.getDate() + 7); // Next report in 1 week

      // Use a local variable to detect component unmount
      let isMounted = true;

      // Load previous reports for this project
      getWeeklyReports(selectedProject.id)
        .then((reports) => {
          // Only set state if component is still mounted
          if (!isMounted) return;

          // If we have previous reports, use the latest one as a basis
          if (reports.length > 0) {
            const latestReport = reports[reports.length - 1];

            setReportData({
              projectTitle: selectedProject.name,
              projectStartDate: new Date(selectedProject.startDate),
              projectEndDate: new Date(selectedProject.endDate),
              reportDate: today,
              nextReportDate: nextReportDate,
              currentSprint: latestReport.currentSprint,
              sprintDuration: selectedProject.sprintDuration || 1, // Fallback to 1 week if not specified
              sprintStart: 1, // Default to starting at Sprint 1
              status: latestReport.status,
              timelineDates: Array.isArray(latestReport.timelineDates)
                ? latestReport.timelineDates.map((item: any) => {
                    if (typeof item === "string") {
                      // Convert old string format to new TimelineWeek format
                      const date = new Date();
                      const [day, month] = item.split("-");
                      const monthMap: { [key: string]: number } = {
                        Jan: 0,
                        Feb: 1,
                        Mar: 2,
                        Apr: 3,
                        May: 4,
                        Jun: 5,
                        Jul: 6,
                        Aug: 7,
                        Sep: 8,
                        Oct: 9,
                        Nov: 10,
                        Dec: 11,
                      };
                      date.setMonth(monthMap[month]);
                      date.setDate(parseInt(day));
                      return {
                        date,
                        label: item,
                        sprintNumber: 1,
                        isSprintStart: false,
                      };
                    } else if (item.date && typeof item.date === "string") {
                      // Convert serialized date string back to Date object
                      return {
                        ...item,
                        date: new Date(item.date),
                      };
                    }
                    return item;
                  })
                : [],
              accomplishments: Array.isArray(latestReport.accomplishments)
                ? latestReport.accomplishments.map((item: any) => {
                    return typeof item === "string" ? { text: item, type: "ASK" } : item;
                  })
                : [],
              upcomingGoals: Array.isArray(latestReport.upcomingGoals)
                ? latestReport.upcomingGoals.map((item: any) => {
                    return typeof item === "string" ? { text: item, type: "ASK" } : item;
                  })
                : [],
              peopleAndProcess: Array.isArray(latestReport.peopleAndProcess)
                ? latestReport.peopleAndProcess.map((item: any) => {
                    return typeof item === "string" ? { text: item, type: "FYI" } : item;
                  })
                : [],
              technology: Array.isArray(latestReport.technology)
                ? latestReport.technology.map((item: any) => {
                    return typeof item === "string" ? { text: item, type: "FYI" } : item;
                  })
                : [],
              teamName: selectedProject.teamName || "Project Team",
              projectGoals: selectedProject.projectGoals || [], // Include project goals/outcomes from project info
              projectSprints: selectedProject.sprints || [], // Include predefined sprints if available
              completionPercentage: calculateCompletionPercentage(
                selectedProject.startDate,
                selectedProject.endDate,
                today
              ),
              daysRemaining: calculateDaysRemaining(selectedProject.endDate, today),
              currentTimelinePosition: 0,
            });
          } else {
            // Initialize with default data
            const projectSprints = selectedProject.sprints || [];
            // Automatically determine current sprint based on today's date
            const currentSprint = getCurrentSprintNumber(projectSprints, today);
            
            setReportData({
              projectTitle: selectedProject.name,
              projectStartDate: new Date(selectedProject.startDate),
              projectEndDate: new Date(selectedProject.endDate),
              reportDate: today,
              nextReportDate: nextReportDate,
              currentSprint: currentSprint, // Automatically determined based on current date
              sprintDuration: selectedProject.sprintDuration || 1, // Fallback to 1 week if not specified
              sprintStart: 1, // Default to starting at Sprint 1
              status: "on-track",
              timelineDates: [],
              accomplishments: [],
              upcomingGoals: [],
              peopleAndProcess: [],
              technology: [],
              teamName: selectedProject.teamName || "Project Team",
              projectGoals: selectedProject.projectGoals || [], // Include project goals/outcomes from project info
              projectSprints: projectSprints, // Include predefined sprints if available
              completionPercentage: calculateCompletionPercentage(
                selectedProject.startDate,
                selectedProject.endDate,
                today
              ),
              daysRemaining: calculateDaysRemaining(selectedProject.endDate, today),
              currentTimelinePosition: 0,
            });
          }
        })
        .catch((error) => {
          console.error("Error loading weekly reports:", error);
          // Handle error but don't cause a render loop
        });

      // Cleanup function to prevent state updates on unmounted component
      return () => {
        isMounted = false;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]); // Only depend on the selectedProject.id, not the entire object

  const handleSelectProject = useCallback((project: ProjectInfo) => {
    setSelectedProject(project);
  }, []);

  const handleNext = () => {
    if (activeStep === 0) {
      // Moving from project selection to form
      setActiveStep(1);
    } else if (activeStep === 1) {
      // Moving from form to next step
      if (formSubStep < 2) {
        // Move to the next form substep
        setFormSubStep(formSubStep + 1);
      }
    }
  };

  const handleBack = () => {
    // Handle going back
    if (activeStep === 2) {
      // When going back from preview to the form content step
      setActiveStep(1); // Go back to step 2
      setFormSubStep(1); // Go to the Content form (second form step)
    } else if (activeStep === 1) {
      if (formSubStep > 0) {
        // If we're on Content form, go back to Basic Info
        setFormSubStep(formSubStep - 1);
      } else {
        // If we're on the Basic Info form, go back to project selection
        setActiveStep(0);
      }
    } else {
      // Default case, move back one step
      setActiveStep((prevActiveStep) => Math.max(0, prevActiveStep - 1));
    }
  };

  const handleSubStepChange = (subStep: number) => {
    setFormSubStep(subStep);
  };

  const handleFormChange = (newData: Partial<ReportData>) => {
    if (!reportData) return;

    setReportData((prevData) => {
      if (!prevData) return null;

      const updatedData = {
        ...prevData,
        ...newData,
      };

      // Recalculate dynamic values if related fields have changed
      const recalculateNeeded = newData.reportDate !== undefined;

      if (recalculateNeeded && selectedProject) {
        // Recalculate completion percentage
        updatedData.completionPercentage = calculateCompletionPercentage(
          selectedProject.startDate,
          selectedProject.endDate,
          updatedData.reportDate
        );

        // Recalculate days remaining
        updatedData.daysRemaining = calculateDaysRemaining(selectedProject.endDate, updatedData.reportDate);

        // Recalculate current timeline position
        if (updatedData.timelineDates && updatedData.timelineDates.length > 0) {
          updatedData.currentTimelinePosition = findCurrentTimelinePosition(
            updatedData.timelineDates,
            updatedData.reportDate
          );
        }
      }

      return updatedData;
    });
  };

  const handleGenerateReport = async () => {
    if (!reportData || !selectedProject) return;

    const weeklyReport: WeeklyReport = {
      reportDate: reportData.reportDate.toISOString().split("T")[0],
      nextReportDate: reportData.nextReportDate.toISOString().split("T")[0],
      currentSprint: reportData.currentSprint,
      completionPercentage: reportData.completionPercentage,
      daysRemaining: reportData.daysRemaining,
      status: reportData.status,
      accomplishments: reportData.accomplishments,
      upcomingGoals: reportData.upcomingGoals,
      peopleAndProcess: reportData.peopleAndProcess,
      technology: reportData.technology,
      timelineDates: reportData.timelineDates.map(
        (week): SerializedTimelineWeek => ({
          date: week.date.toISOString(),
          label: week.label,
          sprintNumber: week.sprintNumber,
          isSprintStart: week.isSprintStart,
        })
      ),
      currentTimelinePosition: reportData.currentTimelinePosition,
    };

    try {
      // Save JSON report
      await saveWeeklyReport(selectedProject.id, weeklyReport);

      // Generate and save PDF
      const element = document.getElementById("report-preview");
      if (!element) return;

      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      const originalPosition = element.style.position;

      element.style.width = "1200px";
      element.style.height = "auto";
      element.style.position = "relative";

      setSnackbarMessage("Generating report...");
      setSnackbarSeverity("info");
      setSnackbarOpen(true);

      setTimeout(() => {
        const contentWidth = element.offsetWidth;
        const contentHeight = element.scrollHeight;
        const pdfFilename = `${reportData.projectTitle.replace(/\s+/g, "_")}_Report_${reportData.reportDate.toISOString().split("T")[0]}.pdf`;

        const options = {
          margin: 10,
          filename: pdfFilename,
          image: { type: "png" as const, quality: 1.0 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: true,
            backgroundColor: "#ffffff",
            allowTaint: true,
          },
          jsPDF: {
            unit: "px",
            format: [contentWidth + 40, contentHeight + 40] as [number, number],
            orientation: "portrait" as const,
          },
        };

        html2pdf()
          .set(options)
          .from(element)
          .toPdf()
          .get("pdf")
          .then(async (pdf: any) => {
            element.style.width = originalWidth;
            element.style.height = originalHeight;
            element.style.position = originalPosition;

            const base64 = pdf.output("datauristring").split(",")[1];
            await saveReportPdf(selectedProject.id, pdfFilename, base64);

            setSnackbarMessage("Report and PDF saved successfully!");
            setSnackbarSeverity("success");
            setSnackbarOpen(true);
          })
          .catch((error: Error) => {
            console.error("Error generating PDF:", error);
            element.style.width = originalWidth;
            element.style.height = originalHeight;
            element.style.position = originalPosition;

            setSnackbarMessage("Error generating PDF. Please try again.");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
          });
      }, 500);
    } catch (error) {
      console.error("Failed to save report:", error);
      setSnackbarMessage("Failed to save report. Please try again.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ my: 4 }}>
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: 2,
            background: "linear-gradient(to right, #f9f9f9, #ffffff)",
          }}
        >
          <Typography variant="h4" component="h1" align="center" gutterBottom color="primary">
            Project Management Report Generator
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4, py: 3 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel 
                  sx={{ 
                    '& .MuiStepLabel-label': {
                      // Apply primary color to all steps, but ensure the "Preview & Generate" label always shows in primary color
                      color: index === 2 || activeStep === index ? 'primary.main' : '',
                      fontWeight: index === activeStep ? 'bold' : 'normal'
                    },
                    // Override the disabled color specifically
                    '& .MuiStepLabel-label.Mui-disabled': {
                      color: index === 2 ? 'primary.main' : ''
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && <ProjectSelector onSelectProject={handleSelectProject} />}

          {/* The preview step is now handled in the form's Review & Preview substep */}

          {activeStep === 1 && reportData && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" color="primary" gutterBottom>
                  {formSubStepTitles[formSubStep]}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Step {formSubStep + 1} of 3
                </Typography>
              </Box>
              <ReportForm
                currentStep={formSubStep}
                reportData={reportData}
                onDataChange={handleFormChange}
                onSubStepChange={handleSubStepChange}
                selectedProject={selectedProject!}
              />
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              justifyContent: activeStep === 0 ? "flex-end" : "space-between",
              mt: 3,
            }}
          >
            {/* Project selection screen - Start button */}
            {activeStep === 0 && (
              <Button 
                variant="contained" 
                onClick={handleNext} 
                disabled={!selectedProject}
              >
                Start Report Form
              </Button>
            )}
            
            {/* Navigation buttons for final form step */}
            {activeStep === 1 && formSubStep === 2 && (
              <>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  onClick={handleBack}
                >
                  Back to Sections & Content
                </Button>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={handleGenerateReport}
                >
                  Generate & Save Report
                </Button>
              </>
            )}
          </Box>
        </Paper>
      </Container>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
