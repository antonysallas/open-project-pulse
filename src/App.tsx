import {
  Alert,
  AlertGroup,
  AlertActionCloseButton,
  Button,
  Card,
  CardBody,
  ProgressStepper,
  ProgressStep,
  Title,
} from "@patternfly/react-core";
import React, { useCallback, useEffect, useState } from "react";
import ProjectSelector from "./components/ProjectSelector";
import ReportForm from "./components/ReportForm";
import "./styles/main.css";
import { ProjectInfo, ReportData, TimelineWeek } from "./types/ReportTypes";
import { getWeeklyReports, generateTypstPdf } from "./utils/projectService";
import { getCurrentSprintNumber } from "./utils/projectUtils";

const steps = ["Select Project", "Fill Report Details", "Preview & Generate"];
const formSubStepTitles = ["Basic Info", "Sections & Content", "Review & Preview"];

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
  percentage = Math.min(Math.max(percentage, 0), 100);
  return Number(percentage.toFixed(1));
};

const findCurrentTimelinePosition = (dates: TimelineWeek[], currentDate: Date = new Date()): number => {
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
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "danger" | "info">("success");

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, [activeStep, formSubStep]);

  useEffect(() => {
    if (selectedProject) {
      const today = new Date();
      const nextReportDate = new Date(today);
      nextReportDate.setDate(today.getDate() + 7);

      let isMounted = true;

      getWeeklyReports(selectedProject.id)
        .then((reports) => {
          if (!isMounted) return;

          if (reports.length > 0) {
            const latestReport = reports[reports.length - 1];

            setReportData({
              projectTitle: selectedProject.name,
              projectStartDate: new Date(selectedProject.startDate),
              projectEndDate: new Date(selectedProject.endDate),
              reportDate: today,
              nextReportDate: nextReportDate,
              currentSprint: latestReport.currentSprint,
              sprintDuration: selectedProject.sprintDuration || 1,
              sprintStart: 1,
              status: latestReport.status,
              timelineDates: Array.isArray(latestReport.timelineDates)
                ? latestReport.timelineDates.map((item: any) => {
                    if (typeof item === "string") {
                      const date = new Date();
                      const [day, month] = item.split("-");
                      const monthMap: { [key: string]: number } = {
                        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
                      };
                      date.setMonth(monthMap[month]);
                      date.setDate(parseInt(day));
                      return { date, label: item, sprintNumber: 1, isSprintStart: false };
                    } else if (item.date && typeof item.date === "string") {
                      return { ...item, date: new Date(item.date) };
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
              projectGoals: selectedProject.projectGoals || [],
              projectSprints: selectedProject.sprints || [],
              completionPercentage: calculateCompletionPercentage(
                selectedProject.startDate, selectedProject.endDate, today
              ),
              daysRemaining: calculateDaysRemaining(selectedProject.endDate, today),
              currentTimelinePosition: 0,
            });
          } else {
            const projectSprints = selectedProject.sprints || [];
            const currentSprint = getCurrentSprintNumber(projectSprints, today);

            setReportData({
              projectTitle: selectedProject.name,
              projectStartDate: new Date(selectedProject.startDate),
              projectEndDate: new Date(selectedProject.endDate),
              reportDate: today,
              nextReportDate: nextReportDate,
              currentSprint: currentSprint,
              sprintDuration: selectedProject.sprintDuration || 1,
              sprintStart: 1,
              status: "on-track",
              timelineDates: [],
              accomplishments: [],
              upcomingGoals: [],
              peopleAndProcess: [],
              technology: [],
              teamName: selectedProject.teamName || "Project Team",
              projectGoals: selectedProject.projectGoals || [],
              projectSprints: projectSprints,
              completionPercentage: calculateCompletionPercentage(
                selectedProject.startDate, selectedProject.endDate, today
              ),
              daysRemaining: calculateDaysRemaining(selectedProject.endDate, today),
              currentTimelinePosition: 0,
            });
          }
        })
        .catch((error) => {
          console.error("Error loading weekly reports:", error);
        });

      return () => {
        isMounted = false;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  const handleSelectProject = useCallback((project: ProjectInfo) => {
    setSelectedProject(project);
  }, []);

  const handleNext = () => {
    if (activeStep === 0) {
      setActiveStep(1);
    } else if (activeStep === 1) {
      if (formSubStep < 2) {
        setFormSubStep(formSubStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (activeStep === 2) {
      setActiveStep(1);
      setFormSubStep(1);
    } else if (activeStep === 1) {
      if (formSubStep > 0) {
        setFormSubStep(formSubStep - 1);
      } else {
        setActiveStep(0);
      }
    } else {
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

      const updatedData = { ...prevData, ...newData };
      const recalculateNeeded = newData.reportDate !== undefined;

      if (recalculateNeeded && selectedProject) {
        updatedData.completionPercentage = calculateCompletionPercentage(
          selectedProject.startDate, selectedProject.endDate, updatedData.reportDate
        );
        updatedData.daysRemaining = calculateDaysRemaining(selectedProject.endDate, updatedData.reportDate);
        if (updatedData.timelineDates && updatedData.timelineDates.length > 0) {
          updatedData.currentTimelinePosition = findCurrentTimelinePosition(
            updatedData.timelineDates, updatedData.reportDate
          );
        }
      }

      return updatedData;
    });
  };

  const handleGenerateReport = async () => {
    if (!reportData || !selectedProject) return;

    setSnackbarMessage("Generating report...");
    setSnackbarSeverity("info");
    setSnackbarOpen(true);

    try {
      const { blob, savedPath } = await generateTypstPdf(selectedProject.id, reportData);

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = reportData.reportDate.toISOString().split("T")[0];
      a.href = url;
      a.download = `${reportData.projectTitle.replace(/\s+/g, "_")}_Report_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (savedPath) {
        setSnackbarMessage(`PDF generated and saved! Path: ${savedPath}`);
      } else {
        setSnackbarMessage("PDF generated and downloaded successfully!");
      }
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      setSnackbarMessage(
        `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setSnackbarSeverity("danger");
      setSnackbarOpen(true);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const getStepVariant = (index: number): "success" | "info" | "pending" | "default" => {
    const effectiveStep = activeStep === 1 && formSubStep === 2 ? 2 : activeStep;
    if (index < effectiveStep) return "success";
    if (index === effectiveStep) return "info";
    return "pending";
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px', width: '100%' }}>
        <Card style={{ background: 'linear-gradient(to right, #f9f9f9, #ffffff)' }}>
          <CardBody>
            <Title headingLevel="h1" size="xl" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--primary-blue)' }}>
              Project Management Report Generator
            </Title>

            <ProgressStepper style={{ marginBottom: '32px', paddingTop: '16px', paddingBottom: '16px' }}>
              {steps.map((label, index) => (
                <ProgressStep
                  key={label}
                  id={`step-${index}`}
                  titleId={`step-${index}-title`}
                  variant={getStepVariant(index)}
                  isCurrent={index === (activeStep === 1 && formSubStep === 2 ? 2 : activeStep)}
                  aria-label={label}
                >
                  {label}
                </ProgressStep>
              ))}
            </ProgressStepper>

            {activeStep === 0 && <ProjectSelector onSelectProject={handleSelectProject} />}

            {activeStep === 1 && reportData && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <Title headingLevel="h2" style={{ color: 'var(--primary-blue)' }}>
                    {formSubStepTitles[formSubStep]}
                  </Title>
                  <small style={{ color: '#6a6e73' }}>
                    Step {formSubStep + 1} of 3
                  </small>
                </div>
                <ReportForm
                  currentStep={formSubStep}
                  reportData={reportData}
                  onDataChange={handleFormChange}
                  onSubStepChange={handleSubStepChange}
                  selectedProject={selectedProject!}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: activeStep === 0 ? "flex-end" : "space-between",
                marginTop: "24px",
              }}
            >
              {activeStep === 0 && (
                <Button variant="primary" onClick={handleNext} isDisabled={!selectedProject}>
                  Start Report Form
                </Button>
              )}

              {activeStep === 1 && formSubStep === 2 && (
                <>
                  <Button variant="secondary" onClick={handleBack}>
                    Back to Sections &amp; Content
                  </Button>
                  <Button variant="danger" onClick={handleGenerateReport}>
                    Generate &amp; Save Report
                  </Button>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {snackbarOpen && (
        <AlertGroup isToast isLiveRegion>
          <Alert
            variant={snackbarSeverity}
            title={snackbarMessage}
            actionClose={<AlertActionCloseButton onClose={handleCloseSnackbar} />}
            timeout={6000}
            onTimeout={handleCloseSnackbar}
          />
        </AlertGroup>
      )}
    </div>
  );
}

export default App;
