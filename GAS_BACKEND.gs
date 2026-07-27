/*
  Paste this entire file into script.google.com and deploy as a Web app.
  It stores only the current draw state and short-lived device presence.
  Each QR session is separated by its room code, so a previous rehearsal does
  not overwrite the live draw session.
*/
const PREFIX = 'rapee69_v16_';

function doGet(e) {
  const room = room_(e && e.parameter && e.parameter.room);
  const props = PropertiesService.getScriptProperties();
  const data = {
    state: JSON.parse(props.getProperty(stateKey_(room)) || 'null'),
    presence: JSON.parse(props.getProperty(presenceKey_(room)) || '{}')
  };
  const callback = String((e.parameter && e.parameter.callback) || '');
  return callback ? ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT) : json_(data);
}

function doPost(e) {
  const body = JSON.parse((e.postData && e.postData.contents) || '{}');
  const room = room_(body.room);
  const props = PropertiesService.getScriptProperties();
  if (body.action === 'state' && body.state && typeof body.state === 'object') {
    props.setProperty(stateKey_(room), JSON.stringify(body.state));
  }
  if (body.action === 'presence' && body.role && body.clientId) {
    const presence = JSON.parse(props.getProperty(presenceKey_(room)) || '{}');
    presence[body.clientId] = { role: String(body.role), at: Number(body.at) || Date.now() };
    Object.keys(presence).forEach(id => { if (Date.now() - presence[id].at > 180000) delete presence[id]; });
    props.setProperty(presenceKey_(room), JSON.stringify(presence));
  }
  return json_({ ok: true });
}

function room_(value) {
  const room = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
  return room || 'default';
}
function stateKey_(room) { return PREFIX + room + '_state'; }
function presenceKey_(room) { return PREFIX + room + '_presence'; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
