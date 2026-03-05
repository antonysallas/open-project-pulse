import React from 'react';
import dayjs from 'dayjs';
import { ReportData } from '../../types/ReportTypes';

interface ReportHeaderProps {
  reportData: ReportData;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ reportData }) => {
  return (
    <div className="header">
      <div className="report-info">
        <table style={{ borderSpacing: 0, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0 2px 2px 0' }}>
                <div className="report-box" style={{ marginRight: 0 }}>REPORT DATE</div>
              </td>
              <td style={{ padding: '0 0 2px 0' }}>
                <div className="date-box">{dayjs(reportData.reportDate).format('DD-MMM-YYYY')}</div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0 2px 0 0' }}>
                <div className="report-box" style={{ marginRight: 0 }}>NEXT REPORT</div>
              </td>
              <td style={{ padding: 0 }}>
                <div className="date-box">{dayjs(reportData.nextReportDate).format('DD-MMM-YYYY')}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h1>{reportData.projectTitle}</h1>

      <div className="status-section">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="report-box">PROJECT STATUS</div>
          <div style={{ position: 'relative' }}>
            <div className="status-indicator">
              <div className={`status-red ${reportData.status === 'delayed' ? 'active' : ''}`}></div>
              <div className={`status-yellow ${reportData.status === 'at-risk' ? 'active' : ''}`}></div>
              <div className={`status-green ${reportData.status === 'on-track' ? 'active' : ''}`}></div>
            </div>
            <div className="dropdown-icon" style={{
              position: 'absolute',
              top: 0,
              right: reportData.status === 'on-track' ? 12 : 
                     reportData.status === 'at-risk' ? 44 : 
                     76, // Adjust position based on status
              transform: 'translateY(-90%)',
              textAlign: 'center',
              color: '#000',
              fontSize: 16
            }}>
              ▼
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;