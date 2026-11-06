import React, { useEffect, useRef, useState } from 'react';
import { EditItem, ListKey, ReportDraft } from '../types/ReportTypes';
import { ScreenProps } from '../types/ScreenTypes';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu, { ExportFormat } from '../components/ExportMenu';
import Icon from '../components/Icon';
import { ItemList, TypedList } from '../components/ItemsEditor';
import { Legend, NumberedRich, ReportHead } from '../components/ReportParts';
import RichEditor from '../components/RichEditor';
import { InkCard, LabelChip, PhaseBadge } from '../components/ui';
import PdfPreview from '../pdf/PdfPreview';
import { downloadBlob, pptxName, useReportExport } from '../pdf/useExport';
import { fetchReport, fetchReportToEdit, savePdf, saveReport, updateProject } from '../utils/api';
import { useOtherEditors } from '../utils/editing';
import { addDays, dayMonth, dayMonthYear, daysBetween, isoWeek, today, weekdayDate } from '../utils/dates';
import { savedTime, useDraft } from '../utils/drafts';
import { useLogo, useOrgLogo } from '../utils/logo';
import { periodsAt, periodState, toStoredPeriods } from '../utils/project';
import {
  blankDraft, downloadName, draftFromStored, draftToStored, freeDate, newItem, pdfFile, reportFile, reportOnDate, reportPeriods, sprintsWithGoals, STATUS, submitted, upcomingTitle,
} from '../utils/report';
import { isRichEmpty } from '../utils/rich';
import { go, href } from '../utils/route';
import { NotFound } from './ProjectScreen';

interface ReportScreenProps extends ScreenProps {
  id: string;
  file: string | null; // a saved report to open: a draft, or a submitted one not locked
  copy: string | null; // a saved report to start from
}

const rekey = (items: EditItem[] | undefined): EditItem[] => (Array.isArray(items) ? items : []).map((x) => newItem(x.text, x.type));

const ReportScreen: React.FC<ReportScreenProps> = ({ projects, id, file, copy, reload, notify }): JSX.Element => {
  const p = projects.find((x) => x.id === id);
  const logo = useLogo(p);
  const orgLogo = useOrgLogo();
  const base = useRef<ReportDraft | null>(null); // as opened, before any change
  // A new report is for the week after the latest submitted one.
  const latest = p ? submitted(p)[0] : undefined;
  const nextWeek = latest && latest.date ? addDays(latest.date, 7) : today();
  // Never on a date that already has a report: that week's draft opens instead, and
  // a report started from another one takes the next free week.
  const firstFree = p ? freeDate(p, nextWeek) : nextWeek;
  const started = p && !file && !copy ? reportOnDate(p, nextWeek) : undefined;
  const continuing = !!started && started.draft;
  const opened = useRef<string | null>(file); // the file a save may replace
  const version = useRef<string | null>(null); // and its version when this screen last saw it
  const [draft, setDraft] = useState<ReportDraft | null>(() => {
    base.current = file || copy || continuing ? null : blankDraft(firstFree);
    return base.current;
  });
  const [reasonKey, setReasonKey] = useState(0); // a new key redraws the reason box
  const [loadError, setLoadError] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState<'save' | 'export' | null>(null);
  const [sub, setSub] = useState(false); // editing a submitted report
  const [leaving, setLeaving] = useState(false); // Cancel with unsaved changes
  const [stale, setStale] = useState(false); // saved somewhere else since it was opened
  const draftKey = `report-${id}-${file ? file.replace(/\.json$/, '').replace(/[^A-Za-z0-9._-]/g, '_') : 'new'}`;
  const otherEditors = useOtherEditors(draftKey);
  const autosave = useDraft<ReportDraft>(draftKey, draft, (saved) => {
    setDraft((cur) => (cur ? {
      ...cur,
      ...saved,
      periods: Array.isArray(saved.periods) ? saved.periods : null,
      reason: typeof saved.reason === 'string' ? saved.reason : '',
      done: rekey(saved.done),
      upcoming: rekey(saved.upcoming),
      people: rekey(saved.people),
      tech: rekey(saved.tech),
    } : cur));
    setReasonKey((k) => k + 1);
  });

  useEffect(() => {
    if (!continuing || !p || !started) return;
    notify(`You already have a draft for ${dayMonth(nextWeek)}. Carry on with it here.`);
    window.location.replace(href.editReport(p.id, started.json)); // so Back doesn't return here
    // Once per route; the screen is keyed by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = file || copy;
    if (!source || !p) return undefined;
    let live = true;
    const load = file
      ? fetchReportToEdit(p.id, file).then((got) => {
        version.current = got.version;
        return got.report;
      })
      : fetchReport(p.id, source);
    load
      .then((r) => {
        if (!live) return;
        // A locked report is final: show it instead.
        if (file && r.locked) {
          go(href.report(p.id, file));
          return;
        }
        setSub(!!file && r.draft !== true);
        const loaded = draftFromStored(r, !!copy);
        // Started from any report, it is still next week's.
        base.current = copy ? { ...loaded, date: firstFree, nextDate: addDays(firstFree, 7) } : loaded;
        setDraft(base.current);
        setReasonKey((k) => k + 1);
      })
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
    // Load once per route; the screen is keyed by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hooks above the early returns.
  // What the PDF and slides draw: the project with the sprint goals this report sets.
  const shown = p && draft ? { ...p, periods: sprintsWithGoals(p, draft) } : p;
  const ex = useReportExport(shown, draft, logo, orgLogo);

  if (!p) return <NotFound />;

  const crumbs = [
    { label: 'Projects', href: href.projects() },
    { label: p.name, href: href.project(p.id) },
    { label: `Report · ${draft ? dayMonth(draft.date) : '…'}` },
  ];

  if (!draft) {
    return (
      <>
        <AppHeader crumbs={crumbs} />
        <main className="pulse-main">
          {loadError ? (
            <div className="s-alert s-alert--danger">
              <div>
                <p className="s-alert__title">Couldn't open the report</p>
                <span>{loadError}</span>
              </div>
              <a href={href.project(p.id)} className="s-btn s-btn--sm" style={{ marginLeft: 'auto' }}>Back to project</a>
            </div>
          ) : (
            <div className="s-card" aria-busy="true"><div className="s-skeleton" style={{ height: 16, width: '50%' }} /></div>
          )}
        </main>
      </>
    );
  }

  const d = draft;
  const ms = p.model === 'milestone';
  const word = ms ? 'Phase' : 'Sprint';
  const cur = reportPeriods(d, p);
  const set = (patch: Partial<ReportDraft>): void => setDraft((s) => (s ? { ...s, ...patch } : s));
  const setList = (key: ListKey) => (items: EditItem[]): void => set({ [key]: items } as Partial<ReportDraft>);
  const actionCount = [...d.people, ...d.tech].filter((x) => x.type !== 'FYI' && !isRichEmpty(x.text)).length;
  // A submitted report stays in its own file.
  const json = sub && file ? file : reportFile(p.id, d.date);
  const taken = sub ? undefined : reportOnDate(p, d.date, opened.current);

  const togglePeriod = (i: number): void => {
    if (!ms) {
      set({ periods: [i], goalCur: null, goalNext: null });
      return;
    }
    const now = d.periods || periodsAt(p, d.date);
    set({ periods: now.includes(i) ? now.filter((x) => x !== i) : [...now, i].sort((a, b) => a - b) });
  };

  // A submitted report goes back to its page; anything else to the project.
  const finish = async (message: string): Promise<void> => {
    autosave.clear();
    await reload();
    go(sub ? href.report(p.id, json) : href.project(p.id));
    notify(message);
  };

  // Cancel goes back, asking first if there are unsaved changes, and drops them.
  const leave = (): void => {
    autosave.clear();
    go(sub && file ? href.report(p.id, file) : href.project(p.id));
  };

  const store = async (asDraft: boolean): Promise<void> => {
    const saved = await saveReport(p.id, json, draftToStored(d, p, asDraft), opened.current, version.current);
    opened.current = json; // so that a retry after a failed PDF replaces this save
    version.current = saved.version;
  };

  const failed = (err: unknown): void => {
    const { message } = err as Error;
    notify(message, 'danger');
    if (/changed somewhere else/.test(message)) setStale(true);
  };

  const saveDraft = async (): Promise<void> => {
    setSaving('save');
    try {
      await store(true);
      await finish(`Draft saved · ${weekdayDate(d.date)}. Open it from Reports to continue.`);
    } catch (err) {
      failed(err);
    } finally {
      setSaving(null);
    }
  };

  // Saving for real (submitting, or saving a submitted report) always keeps
  // the PDF on the server next to the report.
  const saveWithPdf = async (): Promise<Awaited<ReturnType<typeof ex.pdf>>> => {
    await store(false);
    // A submitted report confirms its sprint's goal on the project, and plans the next.
    if (!ms && reportPeriods(d, p).length) await updateProject(p.id, { sprints: toStoredPeriods(sprintsWithGoals(p, d)) });
    const pdf = await ex.pdf();
    const { pdfBase64 } = await import('../pdf/exportPdf');
    await savePdf(p.id, pdfFile(p.id, d.date), pdfBase64(pdf));
    return pdf;
  };

  const saveChanges = async (): Promise<void> => {
    setSaving('save');
    try {
      await saveWithPdf();
      await finish(`Report saved · ${weekdayDate(d.date)}. Its PDF is updated too.`);
    } catch (err) {
      failed(err);
    } finally {
      setSaving(null);
    }
  };

  const saveAndExport = async (format: ExportFormat): Promise<void> => {
    setSaving('export');
    try {
      const pdf = await saveWithPdf();
      if (format === 'pdf') {
        const name = downloadName(p.name, d.date);
        pdf.save(name);
        await finish(`Report saved · ${name}`);
      } else {
        const name = pptxName(p.name, d.date);
        downloadBlob(await ex.pptx(), name);
        await finish(`Report saved · ${name}`);
      }
    } catch (err) {
      failed(err);
    } finally {
      setSaving(null);
    }
  };

  const discardDraft = (): void => {
    if (!base.current) return;
    autosave.discard(base.current);
    setDraft({ ...base.current, done: rekey(base.current.done), upcoming: rekey(base.current.upcoming), people: rekey(base.current.people), tech: rekey(base.current.tech) });
    setReasonKey((k) => k + 1);
  };

  // A submitted report can't go back to being a draft.
  const saveButton = sub
    ? <button type="button" className="s-btn" disabled={!!saving} onClick={saveChanges}>{saving === 'save' ? 'Saving…' : 'Save'}</button>
    : <button type="button" className="s-btn" disabled={!!saving || !!taken} onClick={saveDraft}>{saving === 'save' ? 'Saving…' : 'Save draft'}</button>;
  const cancelButton = (className = ''): JSX.Element => (
    <button type="button" className={`s-btn s-btn--ghost${className}`} disabled={!!saving} onClick={() => (autosave.changed() ? setLeaving(true) : leave())}>Cancel</button>
  );

  const actions = (
    <>
      {autosave.savedAt && <span className="pulse-saved pulse-hide-sm">{`Autosaved ${savedTime(autosave.savedAt)}`}</span>}
      <button type="button" className="s-btn s-btn--ghost" aria-pressed={preview} onClick={() => setPreview(!preview)}>
        <Icon name={preview ? 'pencil' : 'eye'} />
        {preview ? 'Back to editing' : 'Preview report'}
      </button>
      {cancelButton(' pulse-hide-sm')}
      {saveButton}
      <ExportMenu label={saving === 'export' ? 'Exporting…' : 'Save and export'} heading="Save the report, then export as" disabled={!!saving || !!taken} onPick={saveAndExport} />
    </>
  );

  return (
    <>
      <AppHeader crumbs={crumbs}>{actions}</AppHeader>

      {preview ? (
        <main className="pulse-main" style={{ paddingTop: 24 }}>
          <div className="pulse-note">
            <Icon name="eye" />
            <span>The two PDF pages as they will be exported.</span>
            <button type="button" className="s-btn s-btn--sm" onClick={() => setPreview(false)}>Back to editing</button>
          </div>
          <PdfPreview project={shown || p} draft={d} logo={logo} orgLogo={orgLogo} />
        </main>
      ) : (
        <main className="pulse-main" style={{ paddingTop: 24 }}>
          {autosave.restoredAt && (
            <div className="pulse-note">
              <span>
                <strong>Your unsaved changes are back.</strong>
                {` From ${savedTime(autosave.restoredAt)}. Save the report to keep them, or discard them to start from ${file ? 'the saved report' : copy ? 'the copied report' : 'a blank report'}.`}
              </span>
              <button type="button" className="s-btn s-btn--sm" onClick={discardDraft}>Discard changes</button>
            </div>
          )}
          {d.copiedFrom && (
            <div className="pulse-note">
              <Icon name="copy" />
              <span>
                <strong>{`Copied from the ${dayMonth(d.copiedFrom)} report.`}</strong>
                {' Dates moved forward a week. Edit what changed and remove what\'s done.'}
              </span>
            </div>
          )}
          {file && (
            <div className="pulse-note" style={{ background: 'var(--bg-sidebar)', color: 'var(--text)' }}>
              <Icon name="pencil" />
              {sub ? (
                <span>
                  <strong>Editing a submitted report.</strong>
                  {' Save to update it and its PDF. Its report date stays as submitted. Lock it from the report page once it has been presented.'}
                </span>
              ) : (
                <span>
                  <strong>Draft · not submitted yet.</strong>
                  {' Pick up where you left off. Save and export to submit it.'}
                </span>
              )}
            </div>
          )}

          {stale && (
            <div className="s-alert s-alert--warning" role="alert" style={{ marginBottom: 12 }}>
              <div>
                <p className="s-alert__title">This report was changed somewhere else</p>
                <span>Your save was refused, so nothing was overwritten. Reload to see the latest version. What you typed here comes back as unsaved changes, and you can then save or discard it.</span>
              </div>
              <button type="button" className="s-btn s-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => window.location.reload()}>Reload</button>
            </div>
          )}
          {otherEditors && !stale && (
            <div className="s-alert s-alert--warning" role="status" style={{ marginBottom: 12 }}>
              <div>
                <p className="s-alert__title">This report is also open somewhere else</p>
                <span>If it is saved there first, your save here is refused, so nothing gets overwritten.</span>
              </div>
            </div>
          )}
          {taken && (
            <div className="s-alert s-alert--warning" role="alert" style={{ marginBottom: 12 }}>
              <div>
                <p className="s-alert__title">{`There is already a report for ${dayMonth(d.date)}`}</p>
                <span>
                  {'Pick another date to save this one, or '}
                  <a href={taken.draft ? href.editReport(p.id, taken.json) : href.report(p.id, taken.json)}>open that report</a>
                  {'. What you typed here is kept as a draft.'}
                </span>
              </div>
            </div>
          )}

          <div className="pulse-pagerule">Page 1 · Status and plan</div>
          <ReportHead
            chips={(
              <>
                {/* The date names a submitted report's file, so it stays. */}
                {sub ? <LabelChip label="Report Date" value={dayMonthYear(d.date)} /> : (
                  <label className="pulse-chip">
                    <span className="pulse-chip__label">Report Date</span>
                    <input type="date" value={d.date} onChange={(e) => e.target.value && set({ date: e.target.value, nextDate: addDays(e.target.value, 7), periods: null })} />
                  </label>
                )}
                <label className="pulse-chip">
                  <span className="pulse-chip__label">Next Report</span>
                  <input type="date" value={d.nextDate} onChange={(e) => set({ nextDate: e.target.value })} />
                </label>
              </>
            )}
            title={p.name}
            sub={[p.team, p.customer].filter(Boolean).join(' · ')}
            week={String(isoWeek(d.date))}
            status={d.status}
            onStatus={(status) => set({ status })}
          />

          {d.status !== 'on-track' && (
            <div className="pulse-why pulse-why--edit" style={{ background: STATUS[d.status].soft }}>
              <span className="pulse-why__tag" style={{ background: STATUS[d.status].fill, color: STATUS[d.status].on }}>{`Why ${STATUS[d.status].label}`}</span>
              <div className="pulse-why__body">
                <RichEditor
                  key={reasonKey}
                  html={d.reason}
                  label="Reason for the status"
                  placeholder="Why the project is not on track. Shown under the status on page 1."
                  onChange={(reason) => set({ reason })}
                />
              </div>
            </div>
          )}

          <div className="pulse-pair pulse-pair--top">
            <InkCard
              title={ms ? `Current ${word}(s)` : 'Current Sprint'}
              meta={d.periods ? <button type="button" className="pulse-ink__btn" onClick={() => set({ periods: null })}>Reset to report date</button> : undefined}
            >
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="pulse-help" style={{ padding: '0 4px 2px' }}>
                  {!ms
                    ? d.periods ? 'Set by hand. Choose the sprint this report covers.' : 'Picked from the report date. Choose another sprint if this report covers a different one.'
                    : d.periods ? `Set by hand. Select every ${word.toLowerCase()} running during this report.` : `Picked from the report date. Select more if ${word.toLowerCase()}s run in parallel.`}
                </span>
                {!p.periods.length && <span className="pulse-help" style={{ padding: '0 4px' }}>{`No ${word.toLowerCase()}s set. Add them in the project setup.`}</span>}
                {p.periods.map((x, i) => {
                  const on = cur.includes(i);
                  const st = periodState(x, d.date);
                  const note = st === 'past' ? 'done' : st === 'future' ? 'not started' : `${daysBetween(d.date, x.end)} days left`;
                  return (
                    // eslint-disable-next-line react/no-array-index-key
                    <button key={i} type="button" className="pulse-pick" role={ms ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => togglePeriod(i)}>
                      <PhaseBadge n={i + 1} state={on ? 'current' : st} big />
                      <span className="pulse-pick__text">
                        <span className="pulse-pick__name">{x.name || `${word} ${i + 1}`}</span>
                        <span className="pulse-pick__dates">{`${dayMonth(x.start)} – ${dayMonth(x.end)} · ${note}`}</span>
                      </span>
                      <span className="pulse-pick__check">{ms && <Icon name="check" size={14} />}</span>
                    </button>
                  );
                })}
                {!ms && cur.length > 0 && (() => {
                  const cs = p.periods[cur[0]];
                  const ns = p.periods[cur[0] + 1];
                  const goalCur = typeof d.goalCur === 'string' ? d.goalCur : cs.goal || '';
                  const goalNext = typeof d.goalNext === 'string' ? d.goalNext : (ns && ns.goal) || '';
                  return (
                    <div className="pulse-goals">
                      <label className="pulse-goal">
                        <span className="pulse-goal__head">
                          <span>{`${cs.name} goal`}</span>
                          <span className="pulse-goal__count" data-near={goalCur.length >= 45 ? 'true' : undefined}>{`${goalCur.length}/50`}</span>
                        </span>
                        <input className="s-input" maxLength={50} value={goalCur} placeholder="e.g. Finish the pilot and start training" onChange={(e) => set({ goalCur: e.target.value })} />
                        <span className="pulse-help">Shown on the timeline card for this sprint. Up to 50 characters.</span>
                      </label>
                      {ns && (
                        <label className="pulse-goal">
                          <span className="pulse-goal__head">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {`${ns.name} goal`}
                              <span className="pulse-goal__tag">Tentative · optional</span>
                            </span>
                            <span className="pulse-goal__count" data-near={goalNext.length >= 45 ? 'true' : undefined}>{`${goalNext.length}/50`}</span>
                          </span>
                          <input className="s-input" maxLength={50} value={goalNext} placeholder="What you plan to pick up next, if known" onChange={(e) => set({ goalNext: e.target.value })} />
                          <span className="pulse-help">Prints in italics as tentative. Confirm or change it in next week's report.</span>
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>
            </InkCard>
            <InkCard title="Project Objectives" meta={<a href={href.editProject(p.id)} className="pulse-ink__btn">Edit in project setup</a>}>
              {p.goals.length ? <NumberedRich items={p.goals} sep=" — " /> : <span className="pulse-empty">No objectives yet.</span>}
              <span className="pulse-help" style={{ display: 'block', padding: '0 16px 12px' }}>Set once per project. Every report prints them on page 1.</span>
            </InkCard>
          </div>

          <div className="pulse-pagerule" style={{ paddingTop: 10 }}>Page 2 · This week</div>
          <div className="pulse-pair pulse-pair--top">
            <ItemList title="Accomplishments" items={d.done} onChange={setList('done')} placeholder={ms ? 'Something finished this week' : 'Something delivered this sprint'} />
            <ItemList title={upcomingTitle(p)} items={d.upcoming} onChange={setList('upcoming')} placeholder={ms ? 'A task still open or in progress' : 'A goal for next week'} />
          </div>

          <h2 className="pulse-h2">{`Needs Stakeholder Action · ${actionCount}`}</h2>
          <div className="pulse-pair">
            <TypedList title="People and Process" items={d.people} onChange={setList('people')} placeholder="A people or process item" />
            <TypedList title="Technology" items={d.tech} onChange={setList('tech')} placeholder="A technology item" />
          </div>
          <Legend />

          <div className="pulse-footline">
            <span>{`Writes ${json} · 2 pages, A4 landscape`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {cancelButton()}
              {saveButton}
              <ExportMenu label={saving === 'export' ? 'Exporting…' : 'Save and export'} heading="Save the report, then export as" disabled={!!saving || !!taken} onPick={saveAndExport} up />
            </div>
          </div>
        </main>
      )}

      {ex.stage}
      {leaving && (
        <ConfirmDialog
          title="Leave without saving?"
          body={sub
            ? 'Edits you haven\'t saved will be lost. The report and its PDF stay as they were.'
            : file
              ? 'Edits you haven\'t saved will be lost. The draft stays as it was last saved.'
              : 'This report hasn\'t been saved. What you wrote in it will be lost.'}
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={leave}
          onCancel={() => setLeaving(false)}
        />
      )}
    </>
  );
};

export default ReportScreen;
