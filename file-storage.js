(() => {
  "use strict";
  const DB_NAME = "rapee69-file-storage";
  const STORE_NAME = "handles";
  const ACTIVE_FOLDER_KEY = "active-folder";

  function openDb(){
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function readActiveFolder(){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ACTIVE_FOLDER_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  async function rememberActiveFolder(handle){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, ACTIVE_FOLDER_KEY);
      request.onsuccess = () => resolve(handle);
      request.onerror = () => reject(request.error);
    });
  }
  async function ensurePermission(handle, request = false){
    if(!handle) return false;
    const options = { mode:"readwrite" };
    let permission = await handle.queryPermission?.(options);
    if(permission !== "granted" && request) permission = await handle.requestPermission?.(options);
    return permission === "granted";
  }
  async function chooseFolder(){
    if(!window.showDirectoryPicker) throw new Error("เบราว์เซอร์นี้ไม่รองรับการบันทึกไฟล์ตรงลงโฟลเดอร์ โปรดใช้ Chrome หรือ Microsoft Edge");
    const handle = await window.showDirectoryPicker({ mode:"readwrite", id:"rapee69-output" });
    if(!await ensurePermission(handle, true)) throw new Error("ยังไม่ได้อนุญาตให้ระบบบันทึกไฟล์ลงโฟลเดอร์นี้");
    await rememberActiveFolder(handle);
    return handle;
  }
  async function getActiveFolder({ requestPermission = false } = {}){
    const handle = await readActiveFolder();
    return await ensurePermission(handle, requestPermission) ? handle : null;
  }
  async function writeBlob(fileName, blob, handle){
    const destination = handle || await getActiveFolder();
    if(!destination) throw new Error("ยังไม่ได้เลือกโฟลเดอร์เก็บงาน");
    const fileHandle = await destination.getFileHandle(fileName, { create:true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { name:fileName, folder:destination.name };
  }
  function fallbackDownload(fileName, blob){
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url; link.download = fileName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.DrawFileStore = { chooseFolder, getActiveFolder, rememberActiveFolder, ensurePermission, writeBlob, fallbackDownload };
})();
