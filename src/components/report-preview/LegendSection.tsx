import React from 'react';

const LegendSection: React.FC = () => {
  return (
    <div className="section-group-full">
      <div className="section">
        <div className="section-header">LEGEND</div>
        <div className="section-content">
          <div className="subsection-title">
            <strong>Legend</strong>
          </div>
          <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, rowGap: 15 }}>
              <div>
                <div className="tag tag-ask">ASK</div>
                <div className="tag-description">High risk. Needs urgent resolution by Stakeholders.</div>
              </div>

              <div>
                <div className="tag tag-directive">DIRECTIVE</div>
                <div className="tag-description">Needs Stakeholders' mandatory instruction.</div>
              </div>

              <div>
                <div className="tag tag-approval">APPROVAL</div>
                <div className="tag-description">Awaiting Stakeholders' "Yes/No" decision.</div>
              </div>

              <div>
                <div className="tag tag-fyi">FYI</div>
                <div className="tag-description">For information only. No action needed.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegendSection;