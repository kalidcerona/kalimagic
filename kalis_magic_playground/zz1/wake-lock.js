    let wakeLock=null,wakeLockPending=false;
    async function acquireWakeLock(){if(wakeLock||wakeLockPending||document.visibilityState!=="visible"||!navigator.wakeLock)return;wakeLockPending=true;try{const lock=await navigator.wakeLock.request("screen");wakeLock=lock;lock.addEventListener("release",()=>{if(wakeLock===lock)wakeLock=null;if(document.visibilityState==="visible")acquireWakeLock();});}catch(_){}finally{wakeLockPending=false;}}

function askToKeepStoredData(){try{if(typeof navigator==="undefined"||!navigator.storage||typeof navigator.storage.persist!=="function")return;Promise.resolve(navigator.storage.persist()).catch(()=>{});}catch(_){}}
askToKeepStoredData();

export { wakeLock, acquireWakeLock };
