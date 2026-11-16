const open = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open("pulse-private-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("entries");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function read(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries"),
      r = tx.objectStore("entries").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function write(key, value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").put(JSON.parse(JSON.stringify(value)), key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearPrivate() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export const exclusive = (fn) =>
  navigator.locks
    ? navigator.locks.request("pulse-workout", fn)
    : Promise.reject(
        new Error(
          "Questo browser non supporta il salvataggio coordinato tra schede. Usa Chrome aggiornato.",
        ),
      );
