import React, { useEffect } from 'react';
import {
  Button,
  DatePicker,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import dayjs from 'dayjs';
import { ReportData, ProjectInfo } from '../../types/ReportTypes';
import { generateTimelineDatesFromSprints, findCurrentTimelinePosition } from './DateUtils';

interface BasicInfoFormProps {
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onNextStep: () => void;
  selectedProject: ProjectInfo;
}

const formatDate = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

const parseDate = (val: string): Date => {
  if (val.split('-').length === 3) {
    return new Date(`${val}T00:00:00`);
  }
  return new Date(NaN);
};

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ reportData, onDataChange, onNextStep, selectedProject }) => {
  const handleDateChange = (field: 'reportDate' | 'nextReportDate' | 'projectStartDate' | 'projectEndDate') =>
    (_event: React.FormEvent<HTMLInputElement>, _value: string, dateValue?: Date) => {
      if (dateValue) {
        if (field === 'reportDate') {
          const nextDate = new Date(dateValue);
          nextDate.setDate(nextDate.getDate() + 7);

          let currentSprint = reportData.currentSprint;
          if (reportData.projectSprints && reportData.projectSprints.length > 0) {
            const matchingSprint = reportData.projectSprints.find(sprint => {
              const sprintStart = new Date(sprint.startDate);
              const sprintEnd = new Date(sprint.endDate);
              sprintEnd.setHours(23, 59, 59, 999);
              return dateValue >= sprintStart && dateValue <= sprintEnd;
            });
            if (matchingSprint) {
              currentSprint = matchingSprint.number;
            }
          }

          onDataChange({
            reportDate: dateValue,
            nextReportDate: nextDate,
            currentSprint: currentSprint
          });
        } else {
          onDataChange({ [field]: dateValue });
        }
      }
    };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (reportData.projectSprints && reportData.projectSprints.length > 0) {
      const newDates = generateTimelineDatesFromSprints(reportData.projectSprints);
      onDataChange({
        timelineDates: newDates,
        currentTimelinePosition: findCurrentTimelinePosition(newDates, reportData.reportDate)
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData.projectSprints, reportData.reportDate]);

  const statusColor = reportData.status === 'on-track' ? '#4caf50' :
    reportData.status === 'at-risk' ? '#ff9800' : '#f44336';

  return (
    <Form>
      <Title headingLevel="h3" style={{ marginBottom: '16px', color: 'var(--primary-blue)' }}>
        Basic Project Information
      </Title>

      <Grid hasGutter>
        <GridItem span={12}>
          <FormGroup label="Project Title" fieldId="projectTitle">
            <TextInput
              id="projectTitle"
              value={reportData.projectTitle}
              isDisabled
              type="text"
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12}>
          <FormGroup label="Project Goals" fieldId="projectGoals">
            <TextArea
              id="projectGoals"
              value={reportData.projectGoals.map((goal, index) => `${index + 1}. ${goal}`).join('\n')}
              isDisabled
              rows={8}
              resizeOrientation="vertical"
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12} sm={6}>
          <FormGroup label="Project Start Date" fieldId="projectStartDate">
            <DatePicker
              value={formatDate(reportData.projectStartDate)}
              onChange={handleDateChange('projectStartDate')}
              dateFormat={(date) => formatDate(date)}
              dateParse={parseDate}
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12} sm={6}>
          <FormGroup label="Project End Date" fieldId="projectEndDate">
            <DatePicker
              value={formatDate(reportData.projectEndDate)}
              onChange={handleDateChange('projectEndDate')}
              dateFormat={(date) => formatDate(date)}
              dateParse={parseDate}
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12} sm={6}>
          <FormGroup label="Current Report Date" fieldId="reportDate">
            <DatePicker
              value={formatDate(reportData.reportDate)}
              onChange={handleDateChange('reportDate')}
              dateFormat={(date) => formatDate(date)}
              dateParse={parseDate}
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12} sm={6}>
          <FormGroup label="Next Report Date" fieldId="nextReportDate">
            <DatePicker
              value={formatDate(reportData.nextReportDate)}
              onChange={handleDateChange('nextReportDate')}
              dateFormat={(date) => formatDate(date)}
              dateParse={parseDate}
            />
          </FormGroup>
        </GridItem>

        <GridItem span={12}>
          <Title headingLevel="h3" style={{ marginTop: '16px', marginBottom: '16px', color: 'var(--primary-blue)' }}>
            Status Information
          </Title>
        </GridItem>

        <GridItem span={12} sm={6}>
          <FormGroup label="Project Phase" fieldId="project-phase">
            <FormSelect
              id="project-phase"
              value={reportData.projectPhase || 'active'}
              onChange={(_event, value) => {
                const phase = value as 'pre-engagement' | 'active';
                onDataChange({
                  projectPhase: phase,
                  currentSprint: phase === 'pre-engagement' ? 0 : 1
                });
              }}
              aria-label="Project Phase"
            >
              <FormSelectOption value="pre-engagement" label="Pre-Engagement (Before Sprint 0)" />
              <FormSelectOption value="active" label="Active Engagement (Sprint Started)" />
            </FormSelect>
          </FormGroup>
        </GridItem>

        <GridItem span={12} sm={6}>
          {reportData.projectPhase === 'pre-engagement' ? (
            <FormGroup
              label="Pre-Engagement Period"
              fieldId="pre-engagement-period"
            >
              <TextInput
                id="pre-engagement-period"
                value={
                  selectedProject.preEngagementStartDate && reportData.projectSprints && reportData.projectSprints.length > 0
                    ? `${dayjs(selectedProject.preEngagementStartDate).format('MMM D')} - ${dayjs(reportData.projectSprints[0].startDate).format('MMM D, YYYY')}`
                    : reportData.projectSprints && reportData.projectSprints.length > 0
                    ? `Today - ${dayjs(reportData.projectSprints[0].startDate).format('MMM D, YYYY')}`
                    : 'Not defined'
                }
                isDisabled
                type="text"
              />
              <small style={{ color: '#6a6e73', marginTop: '4px', display: 'block' }}>
                Currently in Pre-Engagement Phase (Sprint 0 starts after this period)
              </small>
            </FormGroup>
          ) : (
            <FormGroup label="Current Sprint" fieldId="current-sprint">
              <FormSelect
                id="current-sprint"
                value={String(reportData.currentSprint)}
                onChange={(_event, value) => {
                  onDataChange({ currentSprint: Number(value) });
                }}
                aria-label="Current Sprint"
              >
                {reportData.projectSprints && reportData.projectSprints.length > 0 ? (
                  reportData.projectSprints.map((sprint) => (
                    <FormSelectOption key={sprint.number} value={String(sprint.number)} label={sprint.name} />
                  ))
                ) : (
                  Array.from({ length: 8 }).map((_, index) => (
                    <FormSelectOption key={index + 1} value={String(index + 1)} label={`Sprint ${index + 1}`} />
                  ))
                )}
              </FormSelect>
            </FormGroup>
          )}
        </GridItem>

        <GridItem span={12}>
          <FormGroup label="Project Status" fieldId="status">
            <FormSelect
              id="status"
              value={reportData.status}
              onChange={(_event, value) => {
                onDataChange({ status: value as 'on-track' | 'at-risk' | 'delayed' });
              }}
              aria-label="Project Status"
              style={{ color: statusColor, fontWeight: 'bold' }}
            >
              <FormSelectOption value="on-track" label="On Track" />
              <FormSelectOption value="at-risk" label="At Risk" />
              <FormSelectOption value="delayed" label="Delayed" />
            </FormSelect>
          </FormGroup>
        </GridItem>

        <GridItem span={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              Back to Project Selection
            </Button>
            <Button
              variant="primary"
              onClick={onNextStep}
            >
              Next: Sections &amp; Content
            </Button>
          </div>
        </GridItem>
      </Grid>
    </Form>
  );
};

export default BasicInfoForm;
