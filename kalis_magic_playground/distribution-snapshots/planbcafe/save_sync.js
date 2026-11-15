// One writer owns IDBFS from before initial load until the page closes.
(function (global) {
  "use strict";
  function create(environment) {
    var getFS = environment.getFS;
    // Hold one origin-wide writer for the entire game lifetime, before IDBFS loads.
    // Blocking a second game avoids stale whole-tree syncs deleting another channel.
    var saveWriter = false;
    function claimSaveWriter(start) {
      if (!environment.navigator.locks || !environment.navigator.locks.request) {
        environment.notice( "이 브라우저는 안전한 저장 잠금을 지원하지 않아요. 최신 브라우저에서 열어 주세요.");
        return;
      }
      environment.navigator.locks.request("planb-save-writer", {ifAvailable: true}, function (lock) {
        if (!lock) {
          environment.notice( "다른 탭이나 앱에서 게임이 열려 있어요. 그 화면을 닫은 뒤 새로고침해 주세요.");
          return;
        }
        saveWriter = true;
        start();
        return new Promise(function () {}); // Browser releases the lock when this page closes.
      }).catch(function (err) {
        saveWriter = false;
        console.error(err);
        environment.notice( "저장 잠금을 얻지 못했어요. 다른 게임 화면을 닫은 뒤 새로고침해 주세요.");
      });
    }
    var syncing = false, syncAgain = false, syncQueued = false, syncDirty = false;
    var syncWanted = 0, syncFlag = null, lastReport = null;
    var saveChannel = typeof environment.BroadcastChannel === "function" ? new environment.BroadcastChannel("planb-saves") : null;
    function persistSaves() {
      if (!saveWriter) {
        syncDirty = false; syncAgain = false;
        if (syncFlag && syncWanted && getFS()) {
          getFS().writeFile(syncFlag.dir + "/websync.txt", syncFlag.session + " " + syncWanted + " err\n");
        }
        return;
      }
      if (syncing || !getFS()) { syncAgain = true; return; }
      syncing = true; syncAgain = false; syncDirty = false;
      var covers = syncWanted, flag = syncFlag;
      function complete(err) {
        if (err) { console.error(err); syncDirty = true; }
        else if (saveChannel) saveChannel.postMessage("saved");
        if (flag && covers) {
          lastReport = { path: flag.dir + "/websync.txt", text: flag.session + " " + covers + (err ? " err" : " ok") + "\n" };
          try { getFS().writeFile(lastReport.path, lastReport.text); } catch (e) { console.error(e); }
        }
        syncing = false;
        if (syncAgain) persistSaves();
      }
      try { getFS().syncfs(false, complete); } catch (err) { complete(err); }
    }
    function requestPersist(url) {
      var args = String(url || "").split("?")[1];
      if (args) {
        var parts = args.split("&"), n = Number(parts[0]);
        if (n > 0 && parts[1] && parts[2]) {
          syncFlag = { session: parts[1], dir: parts.slice(2).join("&") };
          syncWanted = Math.max(syncWanted, n);
        }
      }
      syncDirty = true;
      if (syncQueued) return;   // several writes in one Lua call make one copy
      syncQueued = true;
      Promise.resolve().then(function () { syncQueued = false; persistSaves(); });
    }
    function flushUnsaved() { if (syncDirty || syncAgain) persistSaves(); }
    environment.document.addEventListener("visibilitychange", function () {
      if (environment.document.visibilityState === "hidden") flushUnsaved();
    });
    environment.window.addEventListener("pagehide", flushUnsaved);
    if (saveChannel) saveChannel.onmessage = function () {   // another page saved: take its files
      if (!saveWriter || syncing || syncDirty || syncAgain || !getFS()) return;   // our own writes copy first
      syncing = true;
      getFS().syncfs(true, function (err) {
        if (err) console.error(err);
        if (lastReport) { try { getFS().writeFile(lastReport.path, lastReport.text); } catch (e) { console.error(e); } }
        syncing = false;
        if (syncAgain) persistSaves();
      });
    };
    return {start: claimSaveWriter, request: requestPersist,
      ready: function () { if (syncAgain) requestPersist(); }, flush: flushUnsaved};
  }
  global.PlanbSaveSync = {create: create};
})(typeof window !== "undefined" ? window : globalThis);
