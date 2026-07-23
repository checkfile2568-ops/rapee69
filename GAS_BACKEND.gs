/* Paste this file into script.google.com, deploy as a Web app (Anyone), then put
   the deployment URL in sync-config.js. This stores only the public draw state. */
const STATE_KEY = 'rapee69_v14_state';
const PRESENCE_KEY = 'rapee69_v14_presence';

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const data = { state: JSON.parse(props.getProperty(STATE_KEY) || 'null'), presence: JSON.parse(props.getProperty(PRESENCE_KEY) || '{}') };
  const callback = String((e.parameter && e.parameter.callback) || '');
  return callback ? ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT) : json_(data);
}
function doPost(e) {
  const body = JSON.parse((e.postData && e.postData.contents) || '{}');
  const props = PropertiesService.getScriptProperties();
  if (body.action === 'state' && body.state && typeof body.state === 'object') props.setProperty(STATE_KEY, JSON.stringify(body.state));
  if (body.action === 'presence' && body.role && body.clientId) {
    const presence = JSON.parse(props.getProperty(PRESENCE_KEY) || '{}');
    presence[body.clientId] = { role: String(body.role), at: Number(body.at) || Date.now() };
    Object.keys(presence).forEach(id => { if (Date.now() - presence[id].at > 10000) delete presence[id]; });
    props.setProperty(PRESENCE_KEY, JSON.stringify(presence));
  }
  return json_({ ok: true });
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
