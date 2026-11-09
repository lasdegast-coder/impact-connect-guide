/**
 * Impact Connect student guide: data sync
 *
 * Sends the programmes (the Programmes Database joined with the tags in the Catalogue) and the
 * alumni who gave permission to the student guide. The guide's sync function checks every value
 * again and answers with a report of problems.
 *
 * - This script only reads the three Google Sheets below, and only the columns listed here.
 * - It never reads or sends alumni phone numbers or email addresses.
 *
 * How to install and update it: apps-script/README.md in the impact-connect-guide repository.
 * Run from the editor:
 *   syncNow          sends everything now and shows the report in the execution log
 *   startHourlySync  from now on, sends everything every hour (run once)
 *   stopHourlySync   stops the hourly sync
 */

const SHEETS = {
  programmes: '1jIjZ15sPo5i6OIOW4dlv1kAlTT-2qObawFDdMUF4Ejc',
  catalogue: '162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY',
  alumni: '1bMsC5tPuzI195xlvU2UIm-ITMMsHyFR_bVTGqdmE3-Q',
};

const PROGRAMME_TABS = [
  'Volunteer work',
  'Youth Organizations',
  'Impact Driven Programmes',
  'Paid Impact Programmes',
  'Summer School Programmes',
  'Programs from other university',
];
const CATALOGUE_TAB = 'Catalogue';
const ALUMNI_TAB = 'Formulierreacties 1';

// Where the data goes. Each environment needs its secret in Project Settings → Script
// Properties; an environment without one is skipped.
const ENVIRONMENTS = [
  {
    name: 'test',
    url: 'https://pamkxxyinunskokuquzv.supabase.co/functions/v1/sync',
    secretProperty: 'SYNC_SECRET_TEST',
  },
  {
    name: 'live',
    url: 'https://utmgdneedxrohyvqhdzy.supabase.co/functions/v1/sync',
    secretProperty: 'SYNC_SECRET_LIVE',
  },
];

// The only columns this script reads. Headers are matched ignoring capitals and extra spaces.
// "raw" columns are read as values (a date and time) instead of the text shown in the sheet.
const CATALOGUE_COLUMNS = {
  id: { header: 'ID', required: true },
  name: { header: 'Programme name', required: true },
  sourceTab: { header: 'Source tab', required: true },
  type: { header: 'Type', required: true },
  mainField: { header: 'Main field', required: true },
  otherFields: { header: 'Other fields', required: true },
  topics: { header: 'Specific topics', required: true },
  waysOfContributing: { header: 'Ways of contributing', required: true },
  skills: { header: 'Skills you build', required: true },
  experienceLevel: { header: 'Experience level', required: true },
  hoursPerWeek: { header: 'Hours per week', required: true },
  costs: { header: 'Costs', required: true },
  language: { header: 'Language', required: true },
  location: { header: 'Location', required: true },
  deadlineStatus: { header: 'Deadline status', required: true },
  // Read exactly as shown (2026-11-16). Reading the date value would shift it by the time zone.
  nextDeadline: { header: 'Next deadline', required: true },
  goodFitFor: { header: 'Good fit for', required: true },
};

// Columns from the tabs of the Programmes Database. Not every tab has every column.
// Internal columns ("other notes", "Partner (yes/no)", "Interest") are never read.
const PROGRAMME_COLUMNS = {
  name: { header: 'Programme Name', required: true },
  description: { header: 'Description', required: true },
  url: { header: 'URL', required: true },
  oneLiner: { header: 'one-liner' },
  signUp: { header: ['Sign up date', 'Sign up date /moment'] },
  deadlineDetails: { header: 'Sign-up deadline' },
  duration: { header: 'Duration' },
  locationDetails: { header: 'Location' },
  costsDetails: { header: 'Costs' },
  host: { header: 'Host university/institution' },
};

// Columns from the alumni form. "Phone number" and "Email" are deliberately not in this list,
// so they are never read. "I prefer to be contact by" and the frequency are not needed either.
const ALUMNI_COLUMNS = {
  respondedAt: { header: 'Tijdstempel', required: true, raw: true },
  fullName: { header: 'Full name', required: true },
  bachelor: { header: 'BSC', required: true },
  master: { header: 'MSC', required: true },
  currentOccupation: { header: 'Current occupation', required: true },
  previousOccupation: { header: 'Previous occupation', required: true },
  fieldsOfInterest: { header: 'Fields of interest', required: true },
  permission: {
    header: 'Do you hereby give us permission to be contact by a student for a career related question?',
    required: true,
  },
  linkedin: { header: 'LinkedIn', required: true },
};

// The only answer that counts as permission (ignoring capitals and extra spaces).
const PERMISSION_YES = 'Yes, I give permission';

const MIN_SECRET_LENGTH = 32;


// ---- Run from the editor -----------------------------------------------------------------

function syncNow() {
  const outcome = runSync_();
  console.log(outcome.report);
  if (outcome.failed) throw new Error('The sync failed. See the report above.');
}

function startHourlySync() {
  stopHourlySync();
  ScriptApp.newTrigger('syncOnSchedule').timeBased().everyHours(1).create();
  console.log('The sync now runs every hour. You get an email when it finds new problems.');
}

function stopHourlySync() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'syncOnSchedule')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

// Called every hour once startHourlySync has run. Emails the report when it needs attention
// and differs from the last report that was emailed.
function syncOnSchedule() {
  let outcome;
  try {
    outcome = runSync_();
  } catch (error) {
    outcome = { failed: true, problems: [], report: 'The sync could not run: ' + error.message };
  }
  console.log(outcome.report);
  emailIfNew_(outcome);
}


// ---- The sync ----------------------------------------------------------------------------

function runSync_() {
  const targets = environmentsToSync_();
  const data = collectData_(readSheets_());
  const results = targets.map((target) => sendTo_(target, data.payload));
  return summarise_(data, results);
}

function readSheets_() {
  const programmesFile = SpreadsheetApp.openById(SHEETS.programmes);
  const catalogueFile = SpreadsheetApp.openById(SHEETS.catalogue);
  const alumniFile = SpreadsheetApp.openById(SHEETS.alumni);
  const programmeTabs = {};
  PROGRAMME_TABS.forEach((tab) => {
    programmeTabs[tab] = readColumns_(programmesFile, tab, PROGRAMME_COLUMNS);
  });
  return {
    programmeTabs: programmeTabs,
    catalogue: readColumns_(catalogueFile, CATALOGUE_TAB, CATALOGUE_COLUMNS),
    alumni: readColumns_(alumniFile, ALUMNI_TAB, ALUMNI_COLUMNS),
  };
}

// Reads only the listed columns of a tab, one column at a time, so other columns are never read.
// Returns one object per row, with the sheet row number.
function readColumns_(file, tabName, columns) {
  const sheet = file.getSheetByName(tabName);
  if (!sheet) throw new Error('The tab "' + tabName + '" was not found in "' + file.getName() + '".');

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(normalise_);
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);

  const cellsByKey = {};
  const missing = [];
  Object.keys(columns).forEach((key) => {
    const spec = columns[key];
    const names = [].concat(spec.header);
    const index = headers.findIndex((header) => names.some((name) => normalise_(name) === header));
    if (index === -1) {
      if (spec.required) missing.push('"' + names[0] + '"');
      return;
    }
    if (rowCount === 0) return;
    const range = sheet.getRange(2, index + 1, rowCount, 1);
    cellsByKey[key] = (spec.raw ? range.getValues() : range.getDisplayValues()).map((cell) => cell[0]);
  });
  if (missing.length > 0) {
    throw new Error(
      'The tab "' + tabName + '" has no column ' + missing.join(', ') +
        '. Was it renamed? Nothing was sent.'
    );
  }

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const row = { rowNumber: i + 2 };
    Object.keys(columns).forEach((key) => {
      row[key] = cellsByKey[key] ? cellsByKey[key][i] : '';
    });
    rows.push(row);
  }
  return rows;
}

// Joins programmes with their catalogue tags and picks the alumni to send.
// Returns what to send, the problems found here, and counts for the report.
function collectData_(sheets) {
  const programmes = joinProgrammes_(sheets.programmeTabs, sheets.catalogue);
  const alumni = selectAlumni_(sheets.alumni);
  return {
    payload: { programmes: programmes.records, alumni: alumni.records },
    problems: programmes.problems.concat(alumni.problems),
    counts: {
      catalogueRows: programmes.catalogueRows,
      sourceRows: programmes.sourceRows,
      alumniResponses: alumni.responses,
      alumniWithPermission: alumni.withPermission,
    },
  };
}

// Each catalogue row is matched with the row of the same name in its source tab
// (ignoring capitals and extra spaces). Only matched programmes are sent.
function joinProgrammes_(programmeTabs, catalogueRows) {
  const problems = [];
  const sourceIndex = {};
  let sourceRows = 0;

  PROGRAMME_TABS.forEach((tab) => {
    sourceIndex[tab] = {};
    (programmeTabs[tab] || []).forEach((row) => {
      if (isEmptyRow_(row)) return;
      const name = text_(row.name);
      if (!name) {
        problems.push(problem_(tab + ' row ' + row.rowNumber, 'Programme Name',
          'is empty, so this row is not sent.'));
        return;
      }
      sourceRows++;
      const key = normalise_(name);
      (sourceIndex[tab][key] = sourceIndex[tab][key] || []).push(row);
    });
  });

  const used = {};
  const matched = [];
  let catalogueCount = 0;
  catalogueRows.forEach((row) => {
    if (isEmptyRow_(row)) return;
    catalogueCount++;
    const label = [text_(row.id), text_(row.name)].filter(Boolean).join(', ');
    const where = 'Catalogue row ' + row.rowNumber + (label ? ' (' + label + ')' : '');
    const tab = PROGRAMME_TABS.find((candidate) => normalise_(candidate) === normalise_(text_(row.sourceTab)));
    if (!tab) {
      problems.push(problem_(where, 'Source tab', '"' + text_(row.sourceTab) + '" is not one of the tabs: ' +
        PROGRAMME_TABS.join(', ') + '.'));
      return;
    }
    const candidates = sourceIndex[tab][normalise_(text_(row.name))] || [];
    if (candidates.length === 0) {
      problems.push(problem_(where, 'Programme name', 'was not found in the tab "' + tab +
        '" of the Programmes Database. The names must match.'));
      return;
    }
    if (candidates.length > 1) {
      problems.push(problem_(where, 'Programme name', 'appears more than once in the tab "' + tab +
        '" (rows ' + candidates.map((candidate) => candidate.rowNumber).join(', ') + ').'));
      return;
    }
    const source = candidates[0];
    const sourceKey = tab + '|' + source.rowNumber;
    used[sourceKey] = (used[sourceKey] || []).concat([row.rowNumber]);
    matched.push({ catalogue: row, source: source, tab: tab, sourceKey: sourceKey, where: where });
  });

  const records = [];
  matched.forEach((match) => {
    if (used[match.sourceKey].length > 1) {
      problems.push(problem_(match.where, 'Programme name', 'Catalogue rows ' + used[match.sourceKey].join(', ') +
        ' point to the same programme.'));
      return;
    }
    records.push(programmeRecord_(match.catalogue, match.source, match.tab));
  });

  PROGRAMME_TABS.forEach((tab) => {
    Object.keys(sourceIndex[tab]).forEach((key) => {
      sourceIndex[tab][key].forEach((source) => {
        if (!used[tab + '|' + source.rowNumber]) {
          problems.push(problem_(tab + ' row ' + source.rowNumber + ' (' + text_(source.name) + ')',
            'Programme Name', 'has no row in the Catalogue yet, so it is not sent.'));
        }
      });
    });
  });

  return { records: records, problems: problems, catalogueRows: catalogueCount, sourceRows: sourceRows };
}

// What is sent for one programme: tags from the catalogue, details from the Programmes Database.
function programmeRecord_(catalogue, source, tab) {
  return {
    catalogueRow: catalogue.rowNumber,
    sourceRow: source.rowNumber,
    id: text_(catalogue.id),
    sourceTab: tab,
    type: text_(catalogue.type),
    mainField: text_(catalogue.mainField),
    otherFields: text_(catalogue.otherFields),
    topics: text_(catalogue.topics),
    waysOfContributing: text_(catalogue.waysOfContributing),
    skills: text_(catalogue.skills),
    experienceLevel: text_(catalogue.experienceLevel),
    hoursPerWeek: text_(catalogue.hoursPerWeek),
    costs: text_(catalogue.costs),
    language: text_(catalogue.language),
    location: text_(catalogue.location),
    deadlineStatus: text_(catalogue.deadlineStatus),
    nextDeadline: text_(catalogue.nextDeadline),
    goodFitFor: text_(catalogue.goodFitFor),
    name: text_(source.name),
    description: text_(source.description),
    oneLiner: text_(source.oneLiner),
    url: text_(source.url),
    signUp: text_(source.signUp),
    deadlineDetails: text_(source.deadlineDetails),
    duration: text_(source.duration),
    locationDetails: text_(source.locationDetails),
    costsDetails: text_(source.costsDetails),
    host: text_(source.host),
  };
}

// Only alumni who gave permission are sent. When someone filled in the form more than once
// (same name), only their newest response counts: if that one says no, nothing is sent for them.
function selectAlumni_(rows) {
  const problems = [];
  const responsesByName = {};
  let responses = 0;

  rows.forEach((row) => {
    if (isEmptyRow_(row)) return;
    responses++;
    const name = normalise_(text_(row.fullName));
    if (!name) {
      if (hasPermission_(row)) {
        problems.push(problem_('Alumni row ' + row.rowNumber, 'Full name', 'is empty, so this alumnus is not sent.'));
      }
      return;
    }
    (responsesByName[name] = responsesByName[name] || []).push(row);
  });

  const records = [];
  Object.keys(responsesByName).forEach((name) => {
    const personResponses = responsesByName[name];
    const newest = personResponses.reduce((a, b) => (responseTime_(b) >= responseTime_(a) ? b : a));
    if (personResponses.length > 1) {
      problems.push(problem_(
        'Alumni rows ' + personResponses.map((row) => row.rowNumber).join(', '),
        'Full name',
        'look like the same person. Only the newest response (row ' + newest.rowNumber + ') is used. ' +
          'Delete the older one, or make the names different if they are two people.'
      ));
    }
    if (!hasPermission_(newest)) return;
    if (responseTime_(newest) === Infinity) {
      problems.push(problem_('Alumni row ' + newest.rowNumber, 'Tijdstempel',
        'is empty or not a date, so this alumnus is not sent.'));
      return;
    }
    records.push({
      row: newest.rowNumber,
      respondedAt: newest.respondedAt.toISOString(),
      consent: true,
      fullName: text_(newest.fullName),
      bachelor: text_(newest.bachelor),
      master: text_(newest.master),
      currentOccupation: text_(newest.currentOccupation),
      previousOccupation: text_(newest.previousOccupation),
      fieldsOfInterest: text_(newest.fieldsOfInterest),
      linkedin: text_(newest.linkedin),
    });
  });
  records.sort((a, b) => a.row - b.row);
  return { records: records, problems: problems, responses: responses, withPermission: records.length };
}

// When a response was given. A response without a valid date counts as the newest, so that a
// "no" typed in by hand always wins over an older "yes".
function responseTime_(row) {
  const time = row.respondedAt instanceof Date ? row.respondedAt.getTime() : NaN;
  return isNaN(time) ? Infinity : time;
}

function hasPermission_(row) {
  return normalise_(text_(row.permission)) === normalise_(PERMISSION_YES);
}

function environmentsToSync_() {
  const properties = PropertiesService.getScriptProperties();
  const targets = [];
  ENVIRONMENTS.forEach((environment) => {
    const secret = (properties.getProperty(environment.secretProperty) || '').trim();
    if (!secret) return;
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(environment.secretProperty + ' is shorter than ' + MIN_SECRET_LENGTH +
        ' characters. Use the same long secret as SYNC_SECRET in Supabase.');
    }
    targets.push({ name: environment.name, url: environment.url, secret: secret });
  });
  if (targets.length === 0) {
    throw new Error('No sync secret found. Add SYNC_SECRET_TEST under Project Settings → Script Properties.');
  }
  return targets;
}

function sendTo_(target, payload) {
  try {
    const response = UrlFetchApp.fetch(target.url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-sync-secret': target.secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    let body;
    try {
      body = JSON.parse(response.getContentText());
    } catch (error) {
      body = { ok: false, error: 'Unexpected answer from the guide (HTTP ' + status + ').' };
    }
    return { environment: target.name, status: status, body: body };
  } catch (error) {
    return { environment: target.name, status: 0, body: { ok: false, error: 'Could not reach the guide: ' + error.message } };
  }
}

// Turns everything into one readable report.
function summarise_(data, results) {
  const counts = data.counts;
  const lines = [
    'Impact Connect sync, ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    'Read ' + counts.catalogueRows + ' catalogue rows, ' + counts.sourceRows + ' programmes and ' +
      counts.alumniResponses + ' alumni form responses. Sent ' + data.payload.programmes.length +
      ' programmes and ' + counts.alumniWithPermission + ' alumni with permission.',
    '',
  ];

  const problems = data.problems.slice();
  const seen = {};
  problems.forEach((item) => { seen[problemText_(item)] = true; });
  let failed = false;
  results.forEach((result) => {
    const body = result.body || {};
    if (body.ok) {
      lines.push(result.environment + ': saved ' + body.saved.programmes + ' programmes and ' +
        body.saved.alumni + ' alumni (left out: ' + body.leftOut.programmes + ' programmes, ' +
        body.leftOut.alumni + ' alumni).');
    } else {
      failed = true;
      lines.push(result.environment + ': FAILED. ' + (body.error || 'No answer.'));
    }
    (body.problems || []).forEach((item) => {
      const key = problemText_(item);
      if (!seen[key]) {
        seen[key] = true;
        problems.push(item);
      }
    });
  });

  lines.push('');
  if (problems.length === 0) {
    lines.push('No problems found.');
  } else {
    lines.push(problems.length + ' problems to fix in the sheets. Rows with a problem are left out until it is fixed:');
    problems.forEach((item) => lines.push('- ' + problemText_(item)));
  }
  return { failed: failed, problems: problems, report: lines.join('\n') };
}

// Sends the report by email when it needs attention and is different from the last one sent.
function emailIfNew_(outcome) {
  const properties = PropertiesService.getScriptProperties();
  const needsAttention = outcome.failed || outcome.problems.length > 0;
  if (!needsAttention) {
    properties.deleteProperty('LAST_EMAILED_REPORT');
    return;
  }
  const fingerprint = String(hash_(
    (outcome.failed ? 'failed\n' : '') + outcome.problems.map(problemText_).join('\n')
  ));
  if (properties.getProperty('LAST_EMAILED_REPORT') === fingerprint) return;
  const subject = outcome.failed
    ? 'Impact Connect sync failed'
    : 'Impact Connect sync: ' + outcome.problems.length + ' problems to fix';
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, outcome.report);
  properties.setProperty('LAST_EMAILED_REPORT', fingerprint);
}


// ---- Small helpers -----------------------------------------------------------------------

function problem_(where, column, message) {
  return { where: where, column: column, message: message };
}

function problemText_(item) {
  return item.where + ', ' + item.column + ': ' + item.message;
}

function text_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalise_(value) {
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function isEmptyRow_(row) {
  return Object.keys(row).every((key) => key === 'rowNumber' || text_(row[key]) === '');
}

// A short fingerprint of a text, to notice when the report changed.
function hash_(value) {
  let result = 0;
  for (let i = 0; i < value.length; i++) result = (result * 31 + value.charCodeAt(i)) | 0;
  return result;
}
