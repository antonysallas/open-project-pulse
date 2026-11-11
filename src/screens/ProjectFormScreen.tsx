import React, { useEffect, useMemo, useState } from 'react';
import { DeliveryModel, EditItem, Period, Project } from '../types/ReportTypes';
import { ScreenProps } from '../types/ScreenTypes';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import Gantt from '../components/Gantt';
import Icon from '../components/Icon';
import { ItemList } from '../components/ItemsEditor';
import { InkCard, PhaseBadge } from '../components/ui';
import { createProject, fetchProjectDetails, updateProject } from '../utils/api';
import { addDays, daysBetween, toDate, today } from '../utils/dates';
import { savedTime, useDraft } from '../utils/drafts';
import { useOtherEditors } from '../utils/editing';
import { forgetLogo, sizedSvg } from '../utils/logo';
import { gantt, genPhases, genSprints, NEW_ID, periodState, slug, toStoredProject } from '../utils/project';
import { newItem } from '../utils/report';
import { isRichEmpty, richHtml } from '../utils/rich';
import { go, href, scrollToTop } from '../utils/route';
import { NotFound } from './ProjectScreen';

interface ProjectFormScreenProps extends ScreenProps {
  id: string | null; // null: a new project
}

interface Row extends Period {
  key: string;
}

interface FormState {
  name: string;
  team: string;
  customer: string;
  logo: string; // the customer's
  logoName: string;
  logoChanged: boolean;
  logoErr: string;
  dragOver: boolean;
  companyLogo: string; // your own organisation's
  companyLogoName: string;
  companyLogoChanged: boolean;
  companyLogoErr: string;
  companyDragOver: boolean;
  start: string;
  end: string;
  model: DeliveryModel;
  sprintWeeks: number;
  sprints: Row[];
  phases: Row[];
  goals: EditItem[];
}

type Errors = Partial<Record<'name' | 'id' | 'end' | 'periods', string>>;

// New sprints keep the goals the old ones had, by position.
const keepGoals = (fresh: Period[], old: Period[]): Period[] =>
  fresh.map((x, i) => (old[i] && old[i].goal ? { ...x, goal: old[i].goal, tentative: old[i].tentative } : x));

let rowKey = 1;
const keyed = (rows: Period[]): Row[] => rows.map((r) => ({ ...r, key: `r${rowKey++}` }));
const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];

const subtle: React.CSSProperties = { color: 'var(--text-muted)', fontWeight: 400 };

// The two logos the form takes, and the fields each keeps.
type LogoSlot = 'customer' | 'company';
const SLOT = {
  customer: { url: 'logo', name: 'logoName', changed: 'logoChanged', err: 'logoErr', drag: 'dragOver' },
  company: { url: 'companyLogo', name: 'companyLogoName', changed: 'companyLogoChanged', err: 'companyLogoErr', drag: 'companyDragOver' },
} as const;
const NO_LOGOS = {
  logo: '', logoName: '', logoChanged: false, logoErr: '', dragOver: false,
  companyLogo: '', companyLogoName: '', companyLogoChanged: false, companyLogoErr: '', companyDragOver: false,
};

interface LogoFieldProps {
  label: string;
  url: string;
  name: string;
  err: string;
  drag: boolean;
  hint?: [string, string]; // under the field: while empty, once filled
  onFile: (file: File) => void;
  onDrag: (over: boolean) => void;
  onRemove: () => void;
}

// A logo drop zone, or the logo with Remove once there is one.
const LogoField: React.FC<LogoFieldProps> = ({ label, url, name, err, drag, hint, onFile, onDrag, onRemove }): JSX.Element => (
  <div className="s-field">
    <span className="s-label">{label} <span style={subtle}>· optional</span></span>
    {url ? (
      <div className="pulse-logo-box">
        <img src={url} alt={label} />
        <span className="pulse-help" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={onRemove}>Remove</button>
      </div>
    ) : (
      <label
        className="s-dropzone"
        data-dragover={drag ? 'true' : undefined}
        style={{ position: 'relative', padding: '8px 12px', flexDirection: 'row', gap: 8, justifyContent: 'flex-start', minHeight: 36, boxSizing: 'border-box' }}
        onDragOver={(e) => { e.preventDefault(); if (!drag) onDrag(true); }}
        onDragLeave={() => onDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDrag(false);
          const file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <Icon name="image-up" />
        <span>Drop a logo or <span style={{ color: 'var(--accent-text)', fontWeight: 500 }}>browse</span></span>
        <input
          type="file"
          accept={LOGO_TYPES.join(',')}
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
      </label>
    )}
    {err && <span className="s-error">{err}</span>}
    {hint && !err && <span className="pulse-help">{url ? hint[1] : hint[0]}</span>}
  </div>
);

function nextMonday(from: string): string {
  const wd = toDate(from).getDay();
  return addDays(from, ((8 - wd) % 7) || 7);
}

function initialState(p: Project | undefined): FormState {
  if (p) {
    return {
      name: p.name, team: p.team, customer: p.customer, ...NO_LOGOS,
      start: p.start, end: p.end, model: p.model, sprintWeeks: p.sprintWeeks,
      sprints: keyed(p.model === 'sprint' ? p.periods : genSprints(p.start, p.end, p.sprintWeeks)),
      phases: keyed(p.model === 'milestone' ? p.periods : genPhases(p.start, p.end)),
      goals: p.goals.length ? p.goals.map((g) => newItem(richHtml(g, ' — '))) : [newItem()],
    };
  }
  const start = nextMonday(today());
  const end = addDays(start, 7 * 12 - 3);
  return {
    name: '', team: '', customer: '', ...NO_LOGOS,
    start, end, model: 'milestone', sprintWeeks: 2,
    sprints: keyed(genSprints(start, end, 2)), phases: keyed(genPhases(start, end)), goals: [newItem()],
  };
}

// What a draft keeps: not the drop zones' state, and a logo only when it was
// changed (the stored ones load from the details file).
const draftOf = (s: FormState): FormState => ({
  ...s,
  dragOver: false,
  logoErr: '',
  companyDragOver: false,
  companyLogoErr: '',
  ...(s.logoChanged ? {} : { logo: '', logoName: '' }),
  ...(s.companyLogoChanged ? {} : { companyLogo: '', companyLogoName: '' }),
});
const MODELS: [DeliveryModel, string, string][] = [
  ['milestone', 'Phases', 'Named phases with their own dates. Phases can overlap. Reports show Accomplishments and Ongoing and Outstanding Tasks.'],
  ['sprint', 'Sprints', 'Fixed-length iterations back to back. Reports show Accomplishments and Upcoming Goals.'],
];

const ProjectFormScreen: React.FC<ProjectFormScreenProps> = ({ projects, id, reload, notify }): JSX.Element => {
  const editing = projects.find((x) => x.id === id);
  const mode = id === null ? 'new' : 'edit';
  const [f, setF] = useState<FormState>(() => initialState(editing));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false); // Cancel with unsaved changes
  const [serverError, setServerError] = useState('');
  const [logoLoads, setLogoLoads] = useState(0);
  const snapshot = useMemo(() => draftOf(f), [f]);
  const otherEditors = useOtherEditors(id === null ? null : `project-${id}`);
  const autosave = useDraft<FormState>(id === null ? 'new-project' : `project-${id}`, snapshot, (saved) => setF((cur) => ({
    ...cur,
    ...saved,
    sprints: keyed(saved.sprints || cur.sprints),
    phases: keyed(saved.phases || cur.phases),
    goals: (saved.goals || cur.goals).map((g) => newItem(g.text)),
    ...(saved.logoChanged ? {} : { logo: cur.logo, logoName: cur.logoName }),
    ...(saved.companyLogoChanged ? {} : { companyLogo: cur.companyLogo, companyLogoName: cur.companyLogoName }),
  })));

  // The logos are not in the project list: load them from the details file.
  useEffect(() => {
    if (!editing || (!editing.hasLogo && !editing.hasCompanyLogo)) return undefined;
    let live = true;
    fetchProjectDetails(editing.id).then((d) => {
      if (!live) return;
      setF((s) => ({
        ...s,
        ...(s.logoChanged || typeof d.logo !== 'string' ? {} : { logo: d.logo, logoName: d.logoName || 'Current logo' }),
        ...(s.companyLogoChanged || typeof d.companyLogo !== 'string' ? {} : { companyLogo: d.companyLogo, companyLogoName: d.companyLogoName || 'Current logo' }),
      }));
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [editing, logoLoads]);

  if (mode === 'edit' && !editing) return <NotFound />;

  const sp = f.model === 'sprint';
  const rows = sp ? f.sprints : f.phases;
  const rk: 'sprints' | 'phases' = sp ? 'sprints' : 'phases';
  // The ID (the reports' folder and file names) comes from the name and is
  // fixed once the project exists.
  const fid = mode === 'edit' ? (id as string) : slug(f.name);

  const validate = (s: FormState): Errors => {
    const e: Errors = {};
    const list = s.model === 'sprint' ? s.sprints : s.phases;
    if (!s.name.trim()) e.name = 'Enter a project name.';
    if (mode === 'new') {
      const newId = slug(s.name);
      if (s.name.trim() && !NEW_ID.test(newId)) e.name = 'Use letters or digits in the name.';
      else if (newId && projects.some((p) => p.id === newId)) e.name = 'A project with this name already exists. Choose a different name.';
    }
    if (!s.start || !s.end || s.end <= s.start) e.end = 'End date must be after the start date.';
    if (!list.length) e.periods = s.model === 'sprint' ? 'Add at least one sprint, or generate them from the dates.' : 'Add at least one phase.';
    else if (list.some((r) => !r.start || !r.end || r.end < r.start || (s.model === 'milestone' && !r.name.trim()))) {
      e.periods = s.model === 'sprint' ? 'Each sprint needs a start and an end on or after it.' : 'Each phase needs a name and a start and end date.';
    }
    return e;
  };
  const errors = submitted ? validate(f) : {};
  const errorCount = Object.keys(errors).length;

  const set = (patch: Partial<FormState> | ((s: FormState) => Partial<FormState>)): void =>
    setF((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  const field = (name: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>): void => set({ [name]: e.target.value } as Partial<FormState>);
  const updRow = (key: string, patch: Partial<Period>): void => set((s) => ({ [rk]: s[rk].map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const setSlot = (slot: LogoSlot, patch: Partial<Record<'url' | 'name' | 'changed' | 'err' | 'drag', string | boolean>>): void =>
    set(Object.fromEntries(Object.entries(patch).map(([k, v]) => [SLOT[slot][k as keyof typeof SLOT.customer], v])) as Partial<FormState>);
  const readLogo = (slot: LogoSlot, file: File): void => {
    if (!LOGO_TYPES.includes(file.type)) {
      setSlot(slot, { err: "That file isn't a PNG, SVG, JPEG or WebP image. Choose another." });
      return;
    }
    if (file.size > 1048576) {
      setSlot(slot, { err: `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. Choose a file under 1 MB.` });
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      const url = sizedSvg(String(rd.result));
      if (!url) {
        setSlot(slot, { err: `${file.name} has no size, so reports can't place it. Add width and height to its <svg> tag, or choose a PNG.` });
        return;
      }
      setSlot(slot, { url, name: `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`, err: '', changed: true });
    };
    rd.onerror = () => setSlot(slot, { err: `Couldn't read ${file.name}. Try again.` });
    rd.readAsDataURL(file);
  };
  const logoField = (slot: LogoSlot, label: string, hint?: [string, string]): JSX.Element => (
    <LogoField
      label={label}
      url={f[SLOT[slot].url]}
      name={f[SLOT[slot].name]}
      err={f[SLOT[slot].err]}
      drag={f[SLOT[slot].drag]}
      hint={hint}
      onFile={(file) => readLogo(slot, file)}
      onDrag={(over) => setSlot(slot, { drag: over })}
      onRemove={() => setSlot(slot, { url: '', name: '', changed: true, err: '' })}
    />
  );

  const addPeriod = (): void => set((s) => {
    const list = s[rk];
    const lastRow = list[list.length - 1];
    const s0 = lastRow && lastRow.end ? addDays(lastRow.end, 1) : s.start;
    const e0 = s0 ? addDays(s0, sp ? s.sprintWeeks * 7 - 1 : 27) : '';
    return { [rk]: [...list, ...keyed([{ name: sp ? `Sprint ${list.length + 1}` : '', start: s0, end: e0 }])] };
  });

  const discardDraft = (): void => {
    const fresh = initialState(editing);
    autosave.discard(draftOf(fresh));
    setF(fresh);
    setSubmitted(false);
    setServerError('');
    setLogoLoads((n) => n + 1);
  };

  // Cancel goes back, asking first if there are unsaved changes, and drops them.
  const leave = (): void => {
    autosave.clear();
    go(mode === 'edit' ? href.project(id as string) : href.projects());
  };
  const cancel = (): void => (autosave.changed() ? setLeaving(true) : leave());

  const submit = async (): Promise<void> => {
    setSubmitted(true);
    setServerError('');
    if (Object.keys(validate(f)).length) {
      scrollToTop(true);
      return;
    }
    const goals = f.goals.map((g) => richHtml(g.text)).filter((g) => !isRichEmpty(g));
    const body = toStoredProject({ ...f, id: fid, periods: rows, goals });
    if (mode === 'edit' && !f.logoChanged) {
      delete body.logo;
      delete body.logoName;
    }
    if (mode === 'edit' && !f.companyLogoChanged) {
      delete body.companyLogo;
      delete body.companyLogoName;
    }
    setSaving(true);
    try {
      if (mode === 'new') await createProject(body);
      else await updateProject(fid, body);
      forgetLogo(fid);
      autosave.clear();
      await reload();
      go(href.project(fid));
      notify(mode === 'edit' ? 'Project saved' : `Project created · projects/${fid}.json`);
    } catch (err) {
      setServerError((err as Error).message);
      scrollToTop(true);
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = mode === 'edit' ? 'Save' : 'Create project';
  const actions = (
    <>
      {autosave.savedAt && <span className="pulse-saved pulse-hide-sm">{`Autosaved ${savedTime(autosave.savedAt)}`}</span>}
      <button type="button" className="s-btn s-btn--ghost" disabled={saving} onClick={cancel}>Cancel</button>
      <button type="button" className="s-btn s-btn--primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : submitLabel}</button>
    </>
  );
  const crumbs = mode === 'edit'
    ? [{ label: 'Projects', href: href.projects() }, { label: editing!.name, href: href.project(editing!.id) }, { label: 'Edit project' }]
    : [{ label: 'Projects', href: href.projects() }, { label: f.name.trim() || 'New project' }];
  const rowInvalid = (r: Row): boolean => !!errors.periods && (!r.start || !r.end || r.end < r.start || (!sp && !r.name.trim()));
  const preview = gantt(rows, mode === 'edit' ? today() : null, sp ? 5 : undefined);
  const overlapOf = (r: Row): number[] => rows
    .map((o, j) => ({ o, j }))
    .filter(({ o }) => o !== r && o.start && o.end && r.start && r.end && r.start <= o.end && o.start <= r.end)
    .map(({ j }) => j + 1);

  return (
    <>
      <AppHeader crumbs={crumbs}>{actions}</AppHeader>
      <form className="pulse-main pulse-main--form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 className="pulse-h1">{mode === 'edit' ? `Edit ${f.name || 'project'}` : f.name.trim() || 'New project'}</h1>
          <span className="pulse-sub">
            {mode === 'edit' ? 'Changes apply to future reports. Saved reports keep their content.' : 'Set it up once. Every weekly report reads its dates, phases and objectives from here.'}
          </span>
        </div>
        {otherEditors && (
          <div className="s-alert s-alert--warning" role="status" style={{ marginBottom: 12 }}>
            <div>
              <p className="s-alert__title">This project is also open somewhere else</p>
              <span>The last one saved wins, so check there before you save here.</span>
            </div>
          </div>
        )}
        {autosave.restoredAt && (
          <div className="pulse-note">
            <span>
              <strong>Your unsaved changes are back.</strong>
              {` From ${savedTime(autosave.restoredAt)}. ${submitLabel} to keep them, or discard them to ${mode === 'edit' ? 'go back to the saved project' : 'start over'}.`}
            </span>
            <button type="button" className="s-btn s-btn--sm" onClick={discardDraft}>Discard changes</button>
          </div>
        )}
        {errorCount > 0 && (
          <div className="pulse-note pulse-note--danger">
            <span>
              <strong>{`${errorCount === 1 ? '1 thing' : `${errorCount} things`} to fix before saving.`}</strong>
              {' Check the fields marked below.'}
            </span>
          </div>
        )}
        {serverError && (
          <div className="pulse-note pulse-note--danger">
            <span>
              <strong>{"Couldn't save the project. "}</strong>
              {serverError}
            </span>
          </div>
        )}

        <InkCard title="Project">
          <div className="pulse-form-body">
            <label className="s-field">
              <span className="s-label">Project name</span>
              <input className="s-input" placeholder="e.g. Customer Portal Launch" value={f.name} aria-invalid={errors.name ? true : undefined} onChange={(e) => {
                const name = e.target.value;
                set({ name });
              }}
              />
              {errors.name && <span className="s-error">{errors.name}</span>}
            </label>
            <div className="pulse-grid">
              <label className="s-field">
                <span className="s-label">Team</span>
                <input className="s-input" placeholder="e.g. Web team" value={f.team} onChange={field('team')} />
              </label>
              <label className="s-field">
                <span className="s-label">Customer</span>
                <input className="s-input" placeholder="e.g. Acme Inc." value={f.customer} onChange={field('customer')} />
              </label>
            </div>
            <div className="pulse-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label className="s-field">
                <span className="s-label">Start date</span>
                <input type="date" className="s-input" value={f.start} onChange={field('start')} />
              </label>
              <label className="s-field">
                <span className="s-label">End date</span>
                <input type="date" className="s-input" value={f.end} aria-invalid={errors.end ? true : undefined} onChange={field('end')} />
                {errors.end && <span className="s-error">{errors.end}</span>}
              </label>
              {logoField('company', 'Company logo', [
                'Your own organisation. Leave empty to keep the default logo on reports.',
                'Shown beside the customer logo in the footer of every report page.',
              ])}
              {logoField('customer', 'Customer logo')}
            </div>
          </div>
        </InkCard>

        <InkCard title="Delivery and Timeline">
          <div className="pulse-form-body">
            <div className="pulse-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {MODELS.map(([key, title, desc]) => (
                <label key={key} className="pulse-model" data-on={f.model === key ? 'true' : undefined}>
                  <input type="radio" className="s-radio" name="model" checked={f.model === key} onChange={() => set({ model: key })} style={{ marginTop: 2 }} />
                  <span className="pulse-model__text">
                    <span className="pulse-model__title">{title}</span>
                    <span className="pulse-model__desc">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {sp ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div className="s-field">
                  <span className="s-label">Sprint length</span>
                  <div className="s-segmented" role="group" aria-label="Sprint length">
                    {Array.from(new Set([1, 2, 3, 4, f.sprintWeeks])).sort((a, b) => a - b).map((w) => (
                      <button key={w} type="button" aria-pressed={f.sprintWeeks === w} onClick={() => set({ sprintWeeks: w })}>{`${w} wk`}</button>
                    ))}
                  </div>
                </div>
                <button type="button" className="s-btn" onClick={() => set((s) => ({ sprints: keyed(keepGoals(genSprints(s.start, s.end, s.sprintWeeks), s.sprints)) }))}>
                  <Icon name="refresh-cw" />
                  Generate sprints
                </button>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="pulse-period-row pulse-period-row--head">
                <span />
                <span>{sp ? 'Sprint' : 'Phase name'}</span>
                <span>Start</span>
                <span>End</span>
                <span />
              </div>
              {rows.map((r, n) => {
                const ov = sp ? [] : overlapOf(r);
                const invalid = rowInvalid(r) ? true : undefined;
                return (
                  <div key={r.key} className="pulse-period-row">
                    <PhaseBadge n={n + 1} state={r.start && r.end ? periodState(r, mode === 'edit' ? today() : null) : 'future'} big />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <textarea
                        className="s-input"
                        rows={1}
                        value={r.name}
                        placeholder={sp ? 'Sprint name' : 'e.g. Discovery and design'}
                        aria-label={`${sp ? 'Sprint' : 'Phase'} ${n + 1} name`}
                        aria-invalid={invalid}
                        onChange={(e) => updRow(r.key, { name: e.target.value })}
                      />
                      {ov.length > 0 && <span className="pulse-overlap">{`Runs in parallel with ${ov.length > 1 ? 'phases' : 'phase'} ${ov.join(', ')}`}</span>}
                    </div>
                    <input type="date" className="s-input" aria-label={`${sp ? 'Sprint' : 'Phase'} ${n + 1} start`} value={r.start} aria-invalid={invalid} onChange={(e) => updRow(r.key, { start: e.target.value })} />
                    <input type="date" className="s-input" aria-label={`${sp ? 'Sprint' : 'Phase'} ${n + 1} end`} value={r.end} aria-invalid={invalid} onChange={(e) => updRow(r.key, { end: e.target.value })} />
                    <button type="button" className="s-btn s-btn--ghost s-btn--icon s-btn--sm" style={{ marginTop: 4 }} aria-label="Remove row" onClick={() => set((s) => ({ [rk]: s[rk].filter((x) => x.key !== r.key) }))}>
                      <Icon name="x" />
                    </button>
                  </div>
                );
              })}
              {errors.periods && <span className="s-error">{errors.periods}</span>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 28 }}>
                <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={addPeriod}>
                  <Icon name="plus" />
                  {sp ? 'Add sprint' : 'Add phase'}
                </button>
                {rows.length > 0 && (
                  <span className="pulse-dateline" style={{ fontSize: 12 }}>
                    {`${rows.length} ${sp ? 'sprint' : 'phase'}${rows.length === 1 ? '' : 's'} · ${f.start && f.end && f.end > f.start ? `${daysBetween(f.start, f.end) + 1} days` : 'dates incomplete'}`}
                  </span>
                )}
              </div>
            </div>
            {preview && (
              <div className="pulse-preview-tl">
                <span className="pulse-label">How the timeline appears in reports</span>
                <div className="pulse-gantt--flat"><Gantt gantt={preview} phased={!sp} /></div>
              </div>
            )}
          </div>
        </InkCard>

        <ItemList
          title="Project Objectives"
          items={f.goals}
          onChange={(goals: EditItem[]) => set({ goals })}
          placeholder="e.g. Customers can pay their invoices online by the end of the year"
          addLabel="Add objective"
          note="Printed on page 1 of every report."
          noList
          tall
        />

        <div className="pulse-footline">
          <span />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="s-btn s-btn--ghost" disabled={saving} onClick={cancel}>Cancel</button>
            <button type="submit" className="s-btn s-btn--primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
          </div>
        </div>
      </form>
      {leaving && (
        <ConfirmDialog
          title="Leave without saving?"
          body={mode === 'edit'
            ? 'Edits you haven\'t saved will be lost. The project stays as it was.'
            : 'This project hasn\'t been created. What you entered will be lost.'}
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={leave}
          onCancel={() => setLeaving(false)}
        />
      )}
    </>
  );
};

export default ProjectFormScreen;
