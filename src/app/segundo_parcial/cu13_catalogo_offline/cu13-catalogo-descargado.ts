import {OfflineBundle} from './cu13-offline.models';
import {Product,ProductVariant,Category,BranchStock} from '../../core/models';

export function downloadedProducts(bundle:OfflineBundle):Product[]{
  return bundle.products.map(p=>{
    const variants:ProductVariant[]=bundle.variants.filter(v=>v.producto_id===p.id).map(v=>{
      const available=bundle.stock.filter(s=>s.variante_id===v.id).reduce((n,s)=>n+s.disponible,0);
      return {...v,codigo_color:null,activo:true,imagen:v.imagen||null,stock_total:available,stock_reservado:0,stock_disponible:available};
    });
    return {...p,precio:+p.precio,descripcion:p.descripcion||null,marca:p.marca||null,material:p.material||null,
      calidad_nivel:p.calidad_nivel??3,genero_objetivo:p.genero_objetivo??'UNISEX',costo_referencia:null,
      descripcion_ai:null,tags_ai:p.tags_ai??[],activo:true,created_at:p.created_at||'1970-01-01T00:00:00Z',
      stock_disponible:variants.reduce((n,v)=>n+v.stock_disponible,0),variantes:variants};
  });
}
export function filterDownloadedProducts(bundle:OfflineBundle,filters:Record<string,any>):Product[]{
  const query=String(filters['q']||'').toLocaleLowerCase();
  const rows=downloadedProducts(bundle).filter(p=>
    (!query||`${p.nombre} ${p.descripcion||''} ${p.marca||''}`.toLocaleLowerCase().includes(query))&&
    (!filters['categoria_id']||p.categoria_id===+filters['categoria_id'])&&
    (!(filters['genero']||filters['gender'])||p.genero_objetivo===(filters['genero']||filters['gender'])||p.genero_objetivo==='UNISEX')&&
    (!(filters['precio_max']||filters['max_price'])||p.precio<=+(filters['precio_max']||filters['max_price']))&&
    (!filters['calidad_min']||p.calidad_nivel>=+filters['calidad_min'])&&
    (!filters['talla']||p.variantes?.some(v=>v.talla===filters['talla']&&v.stock_disponible>0)));
  if(filters['sort']==='price_asc')rows.sort((a,b)=>a.precio-b.precio);
  if(filters['sort']==='price_desc')rows.sort((a,b)=>b.precio-a.precio);
  return rows.slice(+filters['offset']||0,(+filters['offset']||0)+(+filters['limit']||50));
}
export function downloadedCategories(bundle:OfflineBundle):Category[]{return bundle.categories.map(c=>({...c,slug:String(c.id),descripcion:null,parent_id:null,activo:true}));}
export function downloadedAvailability(bundle:OfflineBundle,productId:number):BranchStock[]{
  const product=downloadedProducts(bundle).find(p=>p.id===productId);if(!product)return [];
  return bundle.stock.flatMap(s=>{const v=product.variantes?.find(v=>v.id===s.variante_id);return v?[{...s,producto_id:productId,producto:product.nombre,sku:v.sku,color:v.color,talla:v.talla,stock_total:s.disponible,stock_reservado:0,stock_disponible:s.disponible,precio:product.precio,activo:true}]:[];});
}
