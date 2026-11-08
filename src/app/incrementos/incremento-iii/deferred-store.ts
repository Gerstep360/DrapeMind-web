/** Private queue: atomic IndexedDB commits, partitioned by API + company + user. */
export interface PendingPurchase {
  key: string; owner: string; operation: string; body?: Record<string, any>;
  remote?: PurchaseResult; cancelRequested?: boolean; localState?: string;
  createdAt: string; label: string;
}
export interface PurchaseResult {
  operacion_id: string; estado: string; pedido_id: number | null;
  total_autorizado: string; tarjeta_id: number | null; mensaje: string | null; vence_at: string;
}
export class DeferredStore {
  private database?: Promise<IDBDatabase>;
  private open(): Promise<IDBDatabase> {
    return this.database ??= new Promise((resolve,reject) => {
      const request=indexedDB.open('drapemind-checkout',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('context',{keyPath:'key'});request.result.createObjectStore('purchases',{keyPath:'key'});};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>{this.database=undefined;reject(request.error);};
      request.onblocked=()=>reject(new Error('Cierra otras pestañas para preparar tus compras guardadas.'));
    });
  }
  async read<T>(store:string,key:string):Promise<T|undefined> {
    const db=await this.open();return new Promise((resolve,reject)=>{const q=db.transaction(store).objectStore(store).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  }
  async write<T extends {key:string}>(store:string,value:T):Promise<void> {
    const db=await this.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No pudimos guardar la compra.'));});
  }
  async list(owner:string):Promise<PendingPurchase[]> {
    const db=await this.open();return new Promise((resolve,reject)=>{const q=db.transaction('purchases').objectStore('purchases').getAll();q.onsuccess=()=>resolve(q.result.filter((r:PendingPurchase)=>r.owner===owner));q.onerror=()=>reject(q.error);});
  }
}
