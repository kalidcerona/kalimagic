    if("serviceWorker" in navigator&&location.hash!=="#selftest")window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
