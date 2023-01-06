import data from './assets/sites.json' assert {type: 'json'};
// methods to be exported
export default (urlFromReq) => {
    let parsedUrl = new URL(urlFromReq);
    let host = parsedUrl.host || parsedUrl.pathname.trim().split("/")[0];
    if (host in data) return true;
    let thing = host.split(".");
    let check1 = thing.slice(thing.length - 2).join(".");
    let check2 = "www." + check1;
    if (check2 in data) return true;
    if (!host.startsWith('www.')) host = `www.${host}`;
    if (host in data) return true;
    return false;
}