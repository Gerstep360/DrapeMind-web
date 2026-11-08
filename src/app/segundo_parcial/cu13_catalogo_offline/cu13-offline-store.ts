/** IndexedDB commits are awaited. Records never use an unscoped global key. */
export class OfflineStore {
  private database?: Promise<IDBDatabase>;
  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('drapemind-incremento-ii', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('bundles', { keyPath: 'key' });
        request.result.createObjectStore('reservations', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.database = undefined;
        reject(request.error);
      };
      request.onblocked = () =>
        reject(new Error('Cierra otras pestañas de DrapeMind para preparar el almacenamiento.'));
    }));
  }
  async read<T>(store: string, key: string): Promise<T | undefined> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }
  async write(store: string, value: { key: string }): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('No se guardaron los datos en este dispositivo.'));
    });
  }
  async list<T extends { owner: string }>(owner: string): Promise<T[]> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction('reservations').objectStore('reservations').getAll();
      request.onsuccess = () =>
        resolve((request.result as T[]).filter((row) => row.owner === owner));
      request.onerror = () => reject(request.error);
    });
  }
}
