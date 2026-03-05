import React, { useEffect } from 'react';
import { Box, TextField, Typography, Grid, Button, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { ReportData, ProjectInfo } from '../../types/ReportTypes';
import { generateTimelineDatesFromSprints, findCurrentTimelinePosition, generatePreEngagementWithSprintsTimeline } from './DateUtils';

interface BasicInfoFormProps {
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onNextStep: () => void;
  selectedProject: ProjectInfo;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ reportData, onDataChange, onNextStep, selectedProject }) => {
  const handleDateChange = (field: 'reportDate' | 'nextReportDate' | 'projectStartDate' | 'projectEndDate') => (date: dayjs.Dayjs | null) => {
    if (date) {
      if (field === 'reportDate') {
        // When report date changes, automatically set next report date to 1 week ahead
        const nextDate = date.add(1, 'week');
        const newReportDate = date.toDate();
        
        // Also update the current sprint based on the new report date
        let currentSprint = reportData.currentSprint;
        if (reportData.projectSprints && reportData.projectSprints.length > 0) {
          // Find the sprint that contains this date
          const matchingSprint = reportData.projectSprints.find(sprint => {
            const sprintStart = new Date(sprint.startDate);
            const sprintEnd = new Date(sprint.endDate);
            // Adjust the end date to include the entire day
            sprintEnd.setHours(23, 59, 59, 999);
            return newReportDate >= sprintStart && newReportDate <= sprintEnd;
          });
          
          if (matchingSprint) {
            currentSprint = matchingSprint.number;
          }
        }
        
        onDataChange({
          reportDate: newReportDate,
          nextReportDate: nextDate.toDate(),
          currentSprint: currentSprint
        });
      } else {
        onDataChange({ [field]: date.toDate() });
      }
    }
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // Auto-generate timeline when component mounts or when sprints/phase change
  useEffect(() => {
    if (reportData.projectSprints && reportData.projectSprints.length > 0) {
      // Generate timeline based on project phase
      let newDates;
      if (reportData.projectPhase === 'pre-engagement') {
        // Generate timeline with pre-engagement block followed by sprints
        newDates = generatePreEngagementWithSprintsTimeline(
          reportData.projectSprints,
          selectedProject.preEngagementStartDate
        );
      } else {
        // Generate regular sprint timeline
        newDates = generateTimelineDatesFromSprints(reportData.projectSprints);
      }
      
      onDataChange({
        timelineDates: newDates,
        currentTimelinePosition: findCurrentTimelinePosition(newDates, reportData.reportDate)
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData.projectSprints, reportData.reportDate, reportData.projectPhase, selectedProject.preEngagementStartDate]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
        Basic Project Information
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            id="projectTitle"
            name="projectTitle"
            label="Project Title"
            fullWidth
            value={reportData.projectTitle}
            InputProps={{
              readOnly: true,
              sx: {
                bgcolor: 'var(--white)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--border-color)'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            id="projectGoals"
            name="projectGoals"
            label="Project Goals"
            fullWidth
            multiline
            rows={8}
            value={reportData.projectGoals.map((goal, index) => `${index + 1}. ${goal}`).join('\n')}
            InputProps={{
              readOnly: true,
              sx: {
                bgcolor: 'var(--white)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--border-color)'
                },
                '& .MuiInputBase-multiline': {
                  padding: '12px',
                  lineHeight: '1.5'
                }
              }
            }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Project Start Date"
              value={dayjs(reportData.projectStartDate)}
              onChange={handleDateChange('projectStartDate')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Project End Date"
              value={dayjs(reportData.projectEndDate)}
              onChange={handleDateChange('projectEndDate')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Current Report Date"
              value={dayjs(reportData.reportDate)}
              onChange={handleDateChange('reportDate')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Next Report Date"
              value={dayjs(reportData.nextReportDate)}
              onChange={handleDateChange('nextReportDate')}
              format="DD/MM/YYYY"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 2, color: 'var(--primary-blue)' }}>
            Status Information
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="project-phase-label">Project Phase</InputLabel>
            <Select
              labelId="project-phase-label"
              value={reportData.projectPhase || 'active'}
              label="Project Phase"
              onChange={(e: SelectChangeEvent) => {
                const phase = e.target.value as 'pre-engagement' | 'active';
                onDataChange({ 
                  projectPhase: phase,
                  currentSprint: phase === 'pre-engagement' ? -1 : 0
                });
              }}
            >
              <MenuItem value="pre-engagement">Pre-Engagement (Before Sprint 0)</MenuItem>
              <MenuItem value="active">Active Engagement (Sprint Started)</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          {reportData.projectPhase === 'pre-engagement' ? (
            <Box>
              <TextField
                label="Pre-Engagement Period"
                fullWidth
                value={
                  selectedProject.preEngagementStartDate && reportData.projectSprints && reportData.projectSprints.length > 0
                    ? `${dayjs(selectedProject.preEngagementStartDate).format('MMM D')} - ${dayjs(reportData.projectSprints[0].startDate).format('MMM D, YYYY')}`
                    : reportData.projectSprints && reportData.projectSprints.length > 0 
                    ? `Today - ${dayjs(reportData.projectSprints[0].startDate).format('MMM D, YYYY')}`
                    : 'Not defined'
                }
                InputProps={{
                  readOnly: true,
                  sx: {
                    bgcolor: 'var(--white)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--border-color)'
                    }
                  }
                }}
                helperText="Currently in Pre-Engagement Phase (Sprint 0 starts after this period)"
              />
            </Box>
          ) : (
            <FormControl fullWidth>
              <InputLabel id="current-sprint-label">Current Sprint</InputLabel>
              <Select
                labelId="current-sprint-label"
                value={reportData.currentSprint}
                label="Current Sprint"
                onChange={(e: SelectChangeEvent<number>) => {
                  onDataChange({ currentSprint: Number(e.target.value) });
                }}
              >
                {/* Use predefined sprints from project details */}
                {reportData.projectSprints && reportData.projectSprints.length > 0 ? (
                  reportData.projectSprints.map((sprint) => (
                    <MenuItem key={sprint.number} value={sprint.number}>
                      {sprint.name}
                    </MenuItem>
                  ))
                ) : (
                  // Fall back to the old method if no sprints are defined
                  Array.from({ length: 8 }).map((_, index) => (
                    <MenuItem key={index + 1} value={index + 1}>Sprint {index + 1}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          )}
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id="status-label">Project Status</InputLabel>
            <Select
              labelId="status-label"
              value={reportData.status}
              label="Project Status"
              onChange={(e) => {
                onDataChange({
                  status: e.target.value as 'on-track' | 'at-risk' | 'delayed'
                });
              }}
              sx={{
                '.MuiSelect-select': {
                  color: reportData.status === 'on-track' ? '#4caf50' : 
                         reportData.status === 'at-risk' ? '#ff9800' : 
                         reportData.status === 'delayed' ? '#f44336' : 'inherit',
                  fontWeight: 'bold'
                }
              }}
            >
              <MenuItem value="on-track" sx={{ color: '#4caf50', fontWeight: 'bold' }}>On Track</MenuItem>
              <MenuItem value="at-risk" sx={{ color: '#ff9800', fontWeight: 'bold' }}>At Risk</MenuItem>
              <MenuItem value="delayed" sx={{ color: '#f44336', fontWeight: 'bold' }}>Delayed</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => window.location.reload()} // Simple way to go back to project selection
            >
              Back to Project Selection
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={onNextStep}
            >
              Next: Sections & Content
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BasicInfoForm;