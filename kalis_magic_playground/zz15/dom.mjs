
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// The debug hook (window.__uramichi, plus the dry/fake flags) exists only on local hosts, never on the live site.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const DEBUG = LOCAL_HOSTS.includes(location.hostname) && params.get('debug') === '1';

export {
  $,
  params,
  DEBUG,
};
