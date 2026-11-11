import { createProject, fetchProjects, onSignedOut } from './api';
import { addDays, dayMonth, daysBetween, fullDate, isIsoDate, isoWeek, longDate, weekdayDate } from './dates';
import { layoutGantt, LayoutStyle } from './ganttLayout';
import { currentList, elapsed, gantt, genPhases, genSprints, normalizeProject, periodsAt, slug, toStoredProject } from './project';
import {
  actionCounts, blankDraft, downloadName, draftFromStored, draftToStored, freeDate, newItem, recentHistory, reportFile, reportOnDate, reportPeriods, sprintsWithGoals, statusHistory,
} from './report';
import { isRichEmpty, leadHtml, richHtml, richPlain } from './rich';
import { href, parseRoute } from './route';
import { sizedSvg } from './logo';
import { actionItems, cleanExport, parseExport, projectFileName, reportFileName } from './exchange';

describe('dates', () => {
  test('format and count days', () => {
    expect(addDays('2031-05-15', 7)).toBe('2031-05-22');
    expect(addDays('2031-03-29', 2)).toBe('2031-03-31'); // across a DST change
    expect(daysBetween('2031-04-07', '2031-06-22')).toBe(76);
    expect(dayMonth('2031-04-07')).toBe('07 Apr');
    expect(longDate('2031-04-07')).toBe('7 Apr 2031');
    expect(weekdayDate('2031-05-15')).toBe('Thu 15 May');
    expect(fullDate('2031-05-15')).toBe('Thu 15 May 2031');
    expect(isoWeek('2031-05-15')).toBe(20);
    expect(isoWeek('2033-01-01')).toBe(53);
  });

  test('isIsoDate', () => {
    expect(isIsoDate('2031-02-28')).toBe(true);
    expect(isIsoDate('2031-02-30')).toBe(false);
    expect(isIsoDate('15/05/2031')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('projects', () => {
  test('slug keeps ids to lowercase letters, digits and dashes', () => {
    expect(slug('Acme Customer Portal')).toBe('acme-customer-portal');
    expect(slug('  Hello_World.v2!  ')).toBe('hello-world-v2');
    expect(slug('a'.repeat(59) + ' b')).toBe('a'.repeat(59)); // no dash left at the cut
  });

  test('sprints are generated back to back, the last cut at the end date', () => {
    const s = genSprints('2031-04-07', '2031-06-22', 3);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ name: 'Sprint 1', start: '2031-04-07', end: '2031-04-27' });
    expect(s[3]).toEqual({ name: 'Sprint 4', start: '2031-06-09', end: '2031-06-22' });
    expect(genSprints('2031-04-07', '2031-04-20', 4)).toEqual([{ name: 'Sprint 1', start: '2031-04-07', end: '2031-04-20' }]);
    expect(genSprints('2031-04-07', '2031-04-01', 3)).toEqual([]);
  });

  test('phases start at 20 / 60 / 20', () => {
    expect(genPhases('2031-01-01', '2031-01-11').map((p) => p.name)).toEqual(['Discovery and design', 'Implementation', 'Handover']);
    expect(genPhases('', '')).toEqual([{ name: '', start: '', end: '' }]);
  });

  test('a stored project reads as the screens use it', () => {
    const p = normalizeProject({
      id: 'acme-portal', name: 'Acme Portal', teamName: 'Web team', startDate: '2031-03-03', endDate: '2031-05-30',
      sprintDuration: 1, status: 'in-progress', projectGoals: ['One', ''],
      sprints: [{ number: 1, startDate: '2031-03-03', endDate: '2031-03-07', name: 'Sprint 1' }, { number: 2, startDate: '2031-03-10', endDate: '2031-03-14', name: '' }],
    });
    expect(p.model).toBe('sprint');
    expect(p.team).toBe('Web team');
    expect(p.periods.map((x) => x.name)).toEqual(['Sprint 1', 'Sprint 2']);
    expect(p.goals).toEqual(['One']);
    expect(p.hasLogo).toBe(false);
  });

  test('a sprint project without saved sprints has no periods', () => {
    const p = normalizeProject({ id: 'x', startDate: '2031-04-07', endDate: '2031-05-04', sprintDuration: 2, status: 'completed' });
    expect(p.periods).toEqual([]);
    expect(p.name).toBe('x');
    expect(p.status).toBe('completed');
  });

  const ms = normalizeProject({
    id: 'portal', name: 'Portal', startDate: '2031-02-03', endDate: '2031-07-04', deliveryModel: 'milestone',
    phases: [
      { name: 'Survey', startDate: '2031-02-03', endDate: '2031-02-28' }, { name: 'Build', startDate: '2031-03-03', endDate: '2031-04-25' },
      { name: 'Trial', startDate: '2031-04-28', endDate: '2031-05-23' }, { name: 'Close', startDate: '2031-06-09', endDate: '2031-07-04' },
    ],
  });

  test('periods by date', () => {
    expect(periodsAt(ms, '2031-01-20')).toEqual([]);
    expect(periodsAt(ms, '2031-03-20')).toEqual([1]);
    expect(periodsAt(ms, '2031-06-02')).toEqual([]); // in the gap
    expect(currentList(ms, [1], '2031-03-20')).toEqual([{ n: '2', name: 'Build', state: 'current' }]);
    expect(currentList(ms, [], '2031-06-02')[0].name).toBe('No active phase');
    expect(currentList(ms, [], '2031-01-20')[0].name).toBe('Yet to start');
    expect(currentList(ms, [], '2031-08-01')[0].name).toBe('Past end date');
    expect(currentList({ ...ms, status: 'completed' }, [1], '2031-03-20')[0].name).toBe('Closed'); // only a closed project says so
    expect(currentList({ model: 'sprint', periods: genSprints('2031-04-07', '2031-06-22', 3), end: '2031-06-22', status: 'in-progress' }, [1], '2031-05-15')[0].name).toBe('Sprint 2 of 4');
  });

  const overlapping = normalizeProject({
    id: 'overlap', name: 'Overlap', startDate: '2031-03-03', endDate: '2031-08-03', deliveryModel: 'milestone',
    phases: [
      { name: 'One', startDate: '2031-03-03', endDate: '2031-03-30' }, { name: 'Two', startDate: '2031-03-17', endDate: '2031-05-11' },
      { name: 'Three', startDate: '2031-05-12', endDate: '2031-07-06' }, { name: 'Four', startDate: '2031-05-26', endDate: '2031-07-20' },
      { name: 'Five', startDate: '2031-07-07', endDate: '2031-08-03' },
    ],
  });

  test('overlapping phases: several current, each overlap on its own row', () => {
    expect(periodsAt(overlapping, '2031-06-06')).toEqual([2, 3]);
    const g = gantt(overlapping.periods, '2031-06-06');
    expect(g).not.toBeNull();
    expect(g!.lanes.map((lane) => lane.map((b) => b.i))).toEqual([[0, 2, 4], [1, 3]]);
    expect(g!.lanes[0].map((b) => b.state)).toEqual(['past', 'current', 'future']);
    expect(g!.lanes[0][0]).toMatchObject({ col: 1, span: 28 });
    expect(g!.ticks[0]).toMatchObject({ label: 'Apr 2031' });
    expect(g!.todayPct).toBeGreaterThan(50);
    expect(gantt(overlapping.periods, null)!.todayPct).toBeNull();
    expect(gantt([], '2031-06-06')).toBeNull();
  });

  const style: LayoutStyle = { nameFont: "600 12px 'Red Hat Text'", dateFont: "400 10px 'Red Hat Mono'", nameLine: 15.6, dateLine: 13, padX: 6, badge: 24, padY: 7, minLane: 38, maxLabel: 240, gap: 6 };
  const measure = (text: string): number => text.length * 6.6;
  const place = (periods: { name: string; start: string; end: string }[], width = 1013) => {
    const g = gantt(periods, '2031-05-01');
    return layoutGantt(g!, width, style, (i) => ({ name: periods[i].name, dates: '1 Mar – 12 Mar' }), (i, s) => (i === 3 ? 'current' : s), true, measure);
  };
  const footprint = (b: { left: number; width: number; inside: boolean; side: string; labelWidth: number }) =>
    (b.inside ? [b.left, b.left + b.width] : b.side === 'right' ? [b.left, b.left + b.width + 6 + b.labelWidth] : [b.left - 6 - b.labelWidth, b.left + b.width]);

  test('a name too long for its bar goes beside it, never over another bar', () => {
    const longNames = [
      { name: 'Step one', start: '2031-02-03', end: '2031-02-28' }, { name: 'Step two of the work', start: '2031-03-03', end: '2031-04-04' },
      { name: 'Step three, with a rather longer name', start: '2031-04-07', end: '2031-06-06' },
      { name: 'Step four, with a name that is too long for a thin bar', start: '2031-06-09', end: '2031-06-20' },
      { name: 'Step five, with a longer name', start: '2031-06-21', end: '2031-08-08' },
    ];
    const lanes = place(longNames);
    const bar4 = lanes.flatMap((l) => l.bars).find((b) => b.i === 3)!;
    expect(bar4.inside).toBe(false);
    expect(bar4.state).toBe('current'); // picked in the report
    lanes.forEach((l) => {
      const spans = l.bars.map(footprint).sort((a, b) => a[0] - b[0]);
      spans.forEach((sp, k) => k && expect(sp[0]).toBeGreaterThanOrEqual(spans[k - 1][1]));
    });
    expect(lanes.flatMap((l) => l.bars).filter((b) => b.i !== 3).every((b) => b.inside)).toBe(true);
  });

  test('a label never covers the next bar, whatever the track width', () => {
    const periods = [
      { name: 'One', start: '2031-02-03', end: '2031-06-06' },
      { name: 'Step four, with a name that is too long for a thin bar', start: '2031-06-09', end: '2031-06-20' },
      { name: 'Five', start: '2031-06-21', end: '2031-08-08' },
    ];
    [700, 904.3, 1013.39, 1174].forEach((w) => {
      const lanes = place(periods, w);
      lanes.forEach((l) => {
        const spans = l.bars.map(footprint).sort((a, b) => a[0] - b[0]);
        spans.forEach((sp, k) => k && expect(sp[0]).toBeGreaterThanOrEqual(spans[k - 1][1] - 1));
      });
    });
  });

  test('overlapping phases still take a row each', () => {
    const lanes = place([
      { name: 'A', start: '2031-03-10', end: '2031-05-09' }, { name: 'B', start: '2031-04-09', end: '2031-06-08' }, { name: 'C', start: '2031-06-09', end: '2031-07-09' },
    ]);
    expect(lanes.map((l) => l.bars.map((b) => b.i))).toEqual([[0, 2], [1]]);
  });

  test('sprint timelines show five sprints: three before the current one, it and the next', () => {
    const ten = genSprints('2031-02-03', '2031-06-22', 2);
    expect(ten).toHaveLength(10);
    const at = (date: string | null) => gantt(ten, date, 5)!.lanes.flat().map((b) => b.i);
    expect(at('2031-05-01')).toEqual([3, 4, 5, 6, 7]); // in sprint 7
    expect(at('2031-02-08')).toEqual([0, 1, 2, 3, 4]); // early on
    expect(at('2031-06-29')).toEqual([5, 6, 7, 8, 9]); // after the end
    expect(at(null)).toEqual([0, 1, 2, 3, 4]);
    expect(gantt(ten.slice(0, 4), '2031-05-01', 5)!.lanes.flat()).toHaveLength(4);
  });

  test('back-to-back sprints share one row', () => {
    expect(gantt(genSprints('2031-04-07', '2031-06-22', 3), '2031-05-15')!.lanes).toHaveLength(1);
  });

  test('elapsed', () => {
    expect(elapsed({ start: '2031-04-07', end: '2031-06-22' }, '2031-05-22')).toEqual({ pct: 59, days: 45, total: 76, left: 31 });
    expect(elapsed({ start: '2031-04-07', end: '2031-06-22' }, '2031-01-01').pct).toBe(0);
    expect(elapsed({ start: '2031-04-07', end: '2031-06-22' }, '2031-07-01')).toMatchObject({ pct: 100, left: 0 });
  });

  test('the form becomes the stored shape', () => {
    const body = toStoredProject({
      id: 'x', name: ' X ', team: 'T', customer: 'C', logo: '', logoName: '', companyLogo: 'data:image/png;base64,AA==', companyLogoName: 'us.png', start: '2031-04-07', end: '2031-05-04',
      model: 'milestone', sprintWeeks: 2, periods: [{ name: ' A ', start: '2031-04-07', end: '2031-05-04' }, { name: 'B', start: '', end: '' }], goals: [' g ', ''],
    });
    expect(body).toMatchObject({ name: 'X', teamName: 'T', deliveryModel: 'milestone', phases: [{ name: 'A', startDate: '2031-04-07', endDate: '2031-05-04' }], projectGoals: ['g'] });
    expect(body).toMatchObject({ companyLogo: 'data:image/png;base64,AA==', companyLogoName: 'us.png' });
    expect(body.sprints).toBeUndefined();
  });
});

describe('reports', () => {
  const p = normalizeProject({ id: 'demo', name: 'Demo', startDate: '2031-04-07', endDate: '2031-06-22', sprintDuration: 3 });
  const overlappingProject = normalizeProject({
    id: 'overlap', name: 'Overlap', startDate: '2031-03-03', endDate: '2031-07-20', deliveryModel: 'milestone',
    phases: [
      { name: 'One', startDate: '2031-03-03', endDate: '2031-03-30' }, { name: 'Two', startDate: '2031-03-17', endDate: '2031-05-11' },
      { name: 'Three', startDate: '2031-05-12', endDate: '2031-07-06' }, { name: 'Four', startDate: '2031-05-26', endDate: '2031-07-20' },
    ],
  });

  test('file names', () => {
    expect(reportFile('demo', '2031-05-15')).toBe('20310515_demo_report.json');
    expect(downloadName('Acme / Portal 2', '2031-05-15')).toBe('Acme_Portal_2_Report_2031-05-15.pdf');
  });

  test('rich text keeps bold, italic and lists, and nothing else', () => {
    expect(richHtml('<p>Finished <b>the form</b></p><p>Two <i>tests</i></p>')).toBe('<div>Finished <strong>the form</strong></div><div>Two <em>tests</em></div>');
    expect(richHtml('<ul><li onclick="x()">One</li></ul><script>alert(1)</script><img src=x onerror=alert(2)>')).toBe('<ul><li>One</li></ul>');
    expect(richHtml('<a href="javascript:alert(1)">link</a> <span style="color:red">red</span>')).toBe('link red');
    expect(richHtml('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
    expect(richHtml('a < b')).toBe('a &lt; b');
    expect(richHtml('Line<br><br>')).toBe('Line');
    expect(richHtml(undefined)).toBe('');
    expect(richPlain('<div>One</div><div>Two</div>')).toBe('One Two');
    expect(isRichEmpty('<div><br></div>')).toBe(true);
  });

  test('plain items get their lead in bold', () => {
    expect(richHtml('Search: Finished the index')).toBe('<strong>Search:</strong> Finished the index');
    expect(leadHtml('Add a form — Test it <now>', ' — ')).toBe('<strong>Add a form</strong> — Test it &lt;now&gt;');
    expect(richHtml('No lead here')).toBe('No lead here');
    expect(richHtml('Reason: kept as it is', '')).toBe('Reason: kept as it is');
  });

  test('a draft round-trips through the stored report', () => {
    const d = { ...blankDraft('2031-05-15'), status: 'delayed' as const, reason: ' Search <b>slipped</b> ', done: [newItem('Login page'), newItem('<div><br></div>')], people: [newItem('Need a tester', 'ASK')] };
    const stored = draftToStored(d, p, false);
    expect(stored).toMatchObject({ reportDate: '2031-05-15', nextReportDate: '2031-05-22', status: 'delayed', statusReason: 'Search <strong>slipped</strong>', draft: false });
    expect(stored.currentPeriods).toBeUndefined(); // followed the date
    expect(stored.accomplishments).toEqual([{ text: 'Login page', type: 'FYI' }]);
    const back = draftFromStored(stored, false);
    expect(back).toMatchObject({ date: '2031-05-15', periods: null, status: 'delayed', reason: 'Search <strong>slipped</strong>', copiedFrom: null });
    expect(back.people.map((x) => [x.text, x.type])).toEqual([['Need a tester', 'ASK']]);
    expect(back.upcoming).toHaveLength(1); // an empty row to type into
    expect(back.tech).toHaveLength(0);
  });

  test('a report sets its sprint goal and plans the next one', () => {
    const sprints = normalizeProject({
      id: 's', startDate: '2031-04-07', endDate: '2031-07-20', sprintDuration: 2,
      sprints: genSprints('2031-04-07', '2031-07-20', 2).map((x, i) => ({ name: x.name, startDate: x.start, endDate: x.end, ...(i === 2 ? { goal: 'Old goal' } : {}) })),
    });
    expect(sprints.periods[2]).toMatchObject({ goal: 'Old goal', tentative: false });
    const d = { ...blankDraft('2031-05-15'), goalCur: '  Test plan ', goalNext: 'First invoices' };
    const out = sprintsWithGoals(sprints, d);
    expect(out[2]).toMatchObject({ goal: 'Test plan', tentative: false });
    expect(out[3]).toMatchObject({ goal: 'First invoices', tentative: true });
    expect(sprintsWithGoals(sprints, { ...d, goalCur: null, goalNext: null })[2]).toMatchObject({ goal: 'Old goal', tentative: false });
    expect(sprintsWithGoals(sprints, { ...d, goalCur: null, goalNext: null })[3].goal).toBeUndefined();
    const stored = draftToStored(d, sprints, true);
    expect(stored).toMatchObject({ sprintGoal: 'Test plan', nextSprintGoal: 'First invoices' });
    expect(draftFromStored(stored, false)).toMatchObject({ goalCur: 'Test plan', goalNext: 'First invoices' });
    expect(draftFromStored(stored, true)).toMatchObject({ goalCur: null, goalNext: null });
    expect(sprintsWithGoals(overlappingProject, d)).toBe(overlappingProject.periods); // phases have no goals
  });

  test('phases picked by hand are kept', () => {
    const d = { ...blankDraft('2031-06-06'), periods: [3, 2] };
    expect(reportPeriods(d, overlappingProject)).toEqual([3, 2]);
    const stored = draftToStored(d, overlappingProject, false);
    expect(stored).toMatchObject({ currentPeriods: [3, 2] });
    expect(draftFromStored(stored, false).periods).toEqual([3, 2]);
    expect(draftFromStored(stored, true).periods).toBeNull(); // a copy follows its new date
    expect(reportPeriods({ ...d, periods: null }, overlappingProject)).toEqual([2, 3]);
  });

  test('a reason is dropped once the status is on track', () => {
    const stored = draftToStored({ ...blankDraft('2031-05-15'), reason: 'old' }, p, true);
    expect(stored.statusReason).toBeUndefined();
  });

  test('starting from last week moves the dates and lets the period follow', () => {
    const d = draftFromStored({ reportDate: '2031-05-08', nextReportDate: '2031-05-15', currentPeriods: [3], status: 'at-risk', accomplishments: [{ text: '<p>Done</p>', type: 'FYI' }] }, true);
    expect(d).toMatchObject({ date: '2031-05-15', nextDate: '2031-05-22', periods: null, status: 'at-risk', copiedFrom: '2031-05-08' });
    expect(d.done[0].text).toBe('<div>Done</div>');
  });

  test('stakeholder actions are counted by type, FYI left out', () => {
    expect(actionCounts([{ type: 'FYI' }, { type: 'ASK' }, { type: 'DIRECTIVE' }, { type: 'ASK' }])).toEqual([{ type: 'ASK', n: 2 }, { type: 'DIRECTIVE', n: 1 }]);
  });

  test('recent history: eight submitted reports back from one, oldest first', () => {
    const reports = Array.from({ length: 10 }, (_, i) => ({ json: `r${i}`, pdf: null, date: addDays('2031-05-16', -7 * i), status: 'on-track', draft: i === 1 }));
    expect(recentHistory({ reports }).map((h) => h.json)).toEqual(['r8', 'r7', 'r6', 'r5', 'r4', 'r3', 'r2', 'r0']); // drafts left out
    expect(recentHistory({ reports }, 'r5').map((h) => h.json)).toEqual(['r9', 'r8', 'r7', 'r6', 'r5']);
  });

  test('status history: up to seven earlier weeks plus this one', () => {
    const reports = Array.from({ length: 10 }, (_, i) => ({ json: `r${i}`, pdf: null, date: addDays('2031-03-06', i * 7), status: i === 4 ? 'at-risk' : 'on-track', draft: false }));
    const h = statusHistory({ reports: [...reports, { json: 'bad', pdf: null, date: '2031-02-01', status: 'green', draft: false }, { json: 'saved', pdf: null, date: '2031-05-15', status: 'on-track', draft: false }] }, '2031-05-15', 'delayed');
    expect(h).toHaveLength(8);
    expect(h[7]).toEqual({ date: '2031-05-15', status: 'delayed' });
    expect(h.every((x, i) => i === 0 || x.date > h[i - 1].date)).toBe(true);
    expect(h.some((x) => x.date === '2031-05-15' && x.status === 'on-track')).toBe(false); // the saved copy of this week is replaced
  });
});

describe('routes', () => {
  test('parse what href builds', () => {
    expect(parseRoute('')).toEqual({ name: 'projects', filter: 'active' });
    expect(parseRoute(href.completed())).toEqual({ name: 'projects', filter: 'completed' });
    expect(href.completed()).toBe('#/closed');
    expect(parseRoute(href.newProject())).toEqual({ name: 'new-project' });
    expect(parseRoute(href.project('example-project'))).toEqual({ name: 'project', id: 'example-project' });
    expect(parseRoute(href.editProject('example-project'))).toEqual({ name: 'edit-project', id: 'example-project' });
    expect(parseRoute(href.newReport('demo', '20310508_demo_report.json'))).toEqual({ name: 'report', id: 'demo', file: null, copy: '20310508_demo_report.json' });
    expect(parseRoute(href.report('demo', '20310508_demo_report.json'))).toEqual({ name: 'view', id: 'demo', file: '20310508_demo_report.json' });
    expect(parseRoute(href.editReport('demo', '20310508_demo_report.json'))).toEqual({ name: 'report', id: 'demo', file: '20310508_demo_report.json', copy: null });
    expect(parseRoute('#/nonsense/here')).toEqual({ name: 'projects', filter: 'active' });
  });
});

describe('api', () => {
  const answer = (status: number, body: unknown, type = 'basic'): Promise<unknown> =>
    Promise.resolve({ status, type, ok: status >= 200 && status < 300, statusText: '', json: () => Promise.resolve(body) });
  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch;
  });

  test('a lapsed sign-in says so, and clears once a call works again', async () => {
    const seen: boolean[] = [];
    const stop = onSignedOut((value) => seen.push(value));
    global.fetch = jest.fn(() => answer(401, null)) as unknown as typeof fetch;
    await expect(createProject({ id: 'x', name: 'X' } as never)).rejects.toThrow(/sign-in has expired/);
    global.fetch = jest.fn(() => answer(0, null, 'opaqueredirect')) as unknown as typeof fetch;
    await expect(fetchProjects()).rejects.toThrow(/sign-in has expired/);
    global.fetch = jest.fn(() => answer(200, { projects: [] })) as unknown as typeof fetch;
    await expect(fetchProjects()).resolves.toEqual([]);
    expect(seen).toEqual([true, false]);
    stop();
  });

  test('other failures name the status or show the server message', async () => {
    global.fetch = jest.fn(() => answer(502, null)) as unknown as typeof fetch;
    await expect(createProject({ id: 'x', name: 'X' } as never)).rejects.toThrow("Couldn't save: Pulse answered 502.");
    await expect(fetchProjects()).rejects.toThrow("Couldn't load: Pulse answered 502.");
    global.fetch = jest.fn(() => answer(409, { error: 'A project with this ID already exists.' })) as unknown as typeof fetch;
    await expect(createProject({ id: 'x', name: 'X' } as never)).rejects.toThrow('A project with this ID already exists.');
    global.fetch = jest.fn(() => answer(403, { error: 'wrong origin' })) as unknown as typeof fetch;
    await expect(createProject({ id: 'x', name: 'X' } as never)).rejects.toThrow("Couldn't save: wrong origin.");
  });
});

describe('dates that already have a report', () => {
  const saved = (date: string, draft = false) => ({ json: reportFile('demo', date), pdf: null, date, status: 'on-track', draft });
  const project = { id: 'demo', reports: [saved('2027-01-07'), saved('2027-01-14', true), saved('2027-01-28')] };

  test('a report collides with any other report on its date, not with its own file', () => {
    expect(reportOnDate(project, '2027-01-07')?.json).toBe(reportFile('demo', '2027-01-07'));
    expect(reportOnDate(project, '2027-01-14')?.draft).toBe(true);
    expect(reportOnDate(project, '2027-01-21')).toBeUndefined();
    expect(reportOnDate(project, '2027-01-14', reportFile('demo', '2027-01-14'))).toBeUndefined();
    expect(reportOnDate(project, '2027-01-14', reportFile('demo', '2027-01-07'))).toBeDefined();
  });

  test('the next free date skips whole weeks past any saved report', () => {
    expect(freeDate(project, '2027-01-21')).toBe('2027-01-21');
    expect(freeDate(project, '2027-01-07')).toBe('2027-01-21');
    expect(freeDate(project, '2027-01-28')).toBe('2027-02-04');
    expect(freeDate({ id: 'demo', reports: [] }, '2027-01-07')).toBe('2027-01-07');
  });
});

describe('.json export and import', () => {
  const project = {
    id: 'harbour-move', name: 'Harbour Move', startDate: '2031-04-07', endDate: '2031-06-27', deliveryModel: 'milestone',
    phases: [{ name: 'Plan', startDate: '2031-04-07', endDate: '2031-06-27' }], projectGoals: ['<b onclick="x()">Move</b> it'],
  };
  const report = {
    reportDate: '2031-05-16', status: 'at-risk', statusReason: '<img src=x onerror="x()">Late',
    accomplishments: [{ text: 'Plan: <script>x()</script>signed off', type: 'FYI' }], peopleAndProcess: [{ text: 'Approve', type: 'APPROVAL' }, { text: 'Note', type: 'FYI' }],
  };
  const file = (d: unknown): string => JSON.stringify(d);
  const projectFile = { format: 'pulse-export', version: 1, kind: 'project', exportedAt: '2031-06-01T00:00:00.000Z', project, reports: [report] };

  test('file names', () => {
    expect(projectFileName('harbour-move', true)).toBe('harbour-move_project.json');
    expect(projectFileName('harbour-move', false)).toBe('harbour-move_setup.json');
    expect(reportFileName('harbour-move', '2031-05-16')).toBe('harbour-move_2031-05-16_report.json');
  });

  test('a file says why it can not be imported', () => {
    expect(parseExport(file(projectFile), 'a.json').kind).toBe('project');
    expect(parseExport(file({ format: 'pulse-export', version: 1, kind: 'report', projectId: 'harbour-move', report }), 'r.json').kind).toBe('report');
    expect(() => parseExport('{"format":"pulse-export",', 'cut.json')).toThrow("cut.json isn't a Pulse export. Choose a .json file exported from Pulse.");
    expect(() => parseExport(file({ hello: 1 }), 'x.json')).toThrow("x.json isn't a Pulse export.");
    expect(() => parseExport(file({ ...projectFile, version: 2 }), 'new.json')).toThrow('new.json was made by a newer version of Pulse. Update Pulse, then import it again.');
    const damaged = 'is incomplete or damaged, so nothing was imported. Export it again from Pulse.';
    expect(() => parseExport(file({ ...projectFile, reports: undefined }), 'd.json')).toThrow(damaged);
    expect(() => parseExport(file({ ...projectFile, project: { ...project, startDate: 'soon' } }), 'd.json')).toThrow(damaged);
    expect(() => parseExport(file({ ...projectFile, reports: [report, report] }), 'd.json')).toThrow(damaged);
    expect(() => parseExport(file({ ...projectFile, reports: [{ ...report, status: 'fine' }] }), 'd.json')).toThrow(damaged);
    expect(() => parseExport(file({ ...projectFile, kind: 'report' }), 'd.json')).toThrow(damaged);
  });

  test('rich text from a file is cleaned as the editor cleans it; plain text stays', () => {
    const clean = cleanExport(parseExport(file(projectFile), 'a.json'));
    if (clean.kind !== 'project') throw new Error('not a project');
    expect(clean.project.projectGoals).toEqual(['<strong>Move</strong> it']);
    expect(clean.reports[0].statusReason).toBe('Late');
    expect(clean.reports[0].accomplishments).toEqual([{ text: 'Plan: signed off', type: 'FYI' }]);
    expect(clean.reports[0].peopleAndProcess).toEqual(report.peopleAndProcess);
    expect(actionItems(clean.reports[0])).toBe(1);
  });
});

describe('logos', () => {
  // Browsers have these; the test page (jsdom) doesn't.
  beforeAll(() => {
    Object.assign(globalThis, { TextEncoder: jest.requireActual('util').TextEncoder, TextDecoder: jest.requireActual('util').TextDecoder });
  });
  const svgUrl = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const tagOf = (url: string | null): string => (Buffer.from((url || '').split(',')[1], 'base64').toString().match(/<svg\b[^>]*>/) || [''])[0];

  test('an SVG without a size gets one from its viewBox, which the PDF needs', () => {
    expect(tagOf(sizedSvg(svgUrl('<svg id="L" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80"><path d="M0 0"/></svg>'))))
      .toBe('<svg width="320" height="80" id="L" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80">');
    expect(tagOf(sizedSvg(svgUrl('<svg width="100%" viewBox="0,0,40,10"/>')))).toBe('<svg width="40" height="10" viewBox="0,0,40,10"/>');
  });

  test('a sized SVG and any other image stay as they are; an SVG with no size at all is refused', () => {
    const sized = svgUrl('<svg width="40" height="10px" viewBox="0 0 40 10"/>');
    expect(sizedSvg(sized)).toBe(sized);
    expect(sizedSvg('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(sizedSvg(svgUrl('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sizedSvg('data:image/svg+xml;base64,@@@')).toBeNull();
  });
});
