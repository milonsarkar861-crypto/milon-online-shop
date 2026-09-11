const DEFAULT_CATEGORIES = [
  'ঘরের ব্যবহার্য পণ্য','কসমেটিকস','স্কিন কেয়ার','হেয়ার কেয়ার','বডি কেয়ার',
  'পার্সোনাল কেয়ার','গ্রুমিং','বিউটি','ফ্যাশন ও এক্সেসরিজ','জুতা ও স্যান্ডেল',
  'স্মার্ট প্রোডাক্ট','স্মার্ট গ্যাজেট','মোবাইল এক্সেসরিজ','ইলেকট্রনিক্স','অন্যান্য'
];
const DEFAULT_SETTINGS = {
  shopName:'Milon Online Shop',
  tagline:'আপনার অনলাইন শপ',
  heroTitle:'প্রয়োজনের পণ্য, সহজে অর্ডার',
  heroText:'ঘরের ব্যবহার্য পণ্য, কসমেটিকস, পার্সোনাল কেয়ার ও স্মার্ট প্রোডাক্ট।',
  facebookUrl:'https://www.facebook.com/share/1EWASsCEah/',
  whatsappNumber:'01834156413',
  bkashNumber:'01834156413',
  deliveryCharges:[60,80],
  categories:DEFAULT_CATEGORIES
};
const DEFAULT_PRODUCTS = [
  {id:'p1',name:'শ্যাম্পু স্যাশে',category:'পার্সোনাল কেয়ার',desc:'আপনার ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p2',name:'হেয়ার/বডি অয়েল',category:'বডি কেয়ার',desc:'ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p3',name:'Emami Fair and Handsome',category:'গ্রুমিং',desc:'সঠিক সাইজ ও মূল্য Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p4',name:'ক্রিম ৪–১০ গ্রাম',category:'স্কিন কেয়ার',desc:'ব্র্যান্ড, গ্রাম ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''}
];
const ADMIN_PASSWORD = 'Milon@8613'; // Optional: set env.ADMIN_PASSWORD in Cloudflare for a different secret.
const ORDER_STATUSES = ['নতুন','কনফার্ম','কুরিয়ারে','ডেলিভার্ড','বাতিল'];
const DELIVERY_OPTIONS = [60,80];
const MAX_ORDER_QTY = 20;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store',...extra}})}
function key(id){return `product:${id}`}
function cleanProduct(p,id=p.id){const image=p.image||p.imageData||p.imageUrl||p.photoUrl||p.photo||'';return {id:String(id||''),name:String(p.name||'').trim(),category:String(p.category||'অন্যান্য').trim()||'অন্যান্য',desc:String(p.desc||''),price:Math.max(0,Number(p.price)||0),cost:Math.max(0,Number(p.cost)||0),stock:Math.max(0,Math.floor(Number(p.stock)||0)),active:(p.active===true||p.active==='true'||p.active===1||p.active==='1'),image:String(image),supplier:String(p.supplier||''),sampleTest:String(p.sampleTest||'Pending'),notes:String(p.notes||'')}}
function normalizeSettings(s){
  const x={...DEFAULT_SETTINGS,...(s||{})};
  const charges=Array.isArray(x.deliveryCharges)?x.deliveryCharges.map(Number).filter(n=>Number.isFinite(n)&&n>0).slice(0,4):DEFAULT_SETTINGS.deliveryCharges;
  const cats=Array.isArray(x.categories)?x.categories.map(v=>String(v).trim()).filter(Boolean):DEFAULT_CATEGORIES;
  x.deliveryCharges=charges.length?charges:DEFAULT_SETTINGS.deliveryCharges;
  x.categories=[...new Set([...DEFAULT_CATEGORIES,...cats])];
  return x;
}
async function getSettings(env){if(!env.STORE)return DEFAULT_SETTINGS;const s=await env.STORE.get('settings','json');return normalizeSettings(s)}
async function auth(req,env){const c=req.headers.get('cookie')||'';const m=c.match(/(?:^|;\s*)milon_admin=([^;]+)/);if(!m||!env.STORE)return false;return !!(await env.STORE.get('session:'+m[1]))}
async function listAll(env,prefix){if(!env.STORE)return [];const out=[];let cursor;do{const res=await env.STORE.list({prefix,cursor});for(const k of res.keys){const v=await env.STORE.get(k.name,'json');if(v)out.push(v)}cursor=res.list_complete?undefined:res.cursor}while(cursor);return out}
async function allProducts(env){if(!env.STORE)return DEFAULT_PRODUCTS;let arr=await listAll(env,'product:');if(!arr.length){for(const p of DEFAULT_PRODUCTS)await env.STORE.put(key(p.id),JSON.stringify(p));arr=[...DEFAULT_PRODUCTS]}return arr.map(p=>cleanProduct(p)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'bn'))}
function validPhone(v){return /^01\d{9}$/.test(String(v||'').replace(/\s|-/g,''))}
function validTrx(v){return /^[A-Za-z0-9_-]{6,80}$/.test(String(v||'').trim())}
async function handleApi(req,env,url){
  if(url.pathname==='/api/health'&&req.method==='GET')return json({ok:true,store:!!env.STORE,assets:!!env.ASSETS});
  if(url.pathname==='/api/categories'&&req.method==='GET'){const settings=await getSettings(env);const products=await allProducts(env);return json({categories:[...new Set([...settings.categories,...products.map(p=>p.category).filter(Boolean)])]})}
  if(url.pathname==='/api/settings'&&req.method==='GET')return json(await getSettings(env));
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){
    const body=await req.json().catch(()=>({}));if(body.password!==(env.ADMIN_PASSWORD||ADMIN_PASSWORD))return json({error:'Password ভুল'},401);if(!env.STORE)return json({error:'STORE binding missing'},500);
    const token=crypto.randomUUID()+crypto.randomUUID().replaceAll('-','');await env.STORE.put('session:'+token,'1',{expirationTtl:60*60*24*30});
    return json({ok:true},200,{'set-cookie':`milon_admin=${token}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`});
  }
  if(url.pathname==='/api/admin/logout'&&req.method==='POST'){const c=req.headers.get('cookie')||'';const m=c.match(/(?:^|;\s*)milon_admin=([^;]+)/);if(m&&env.STORE)await env.STORE.delete('session:'+m[1]);return json({ok:true},200,{'set-cookie':'milon_admin=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'})}
  if(url.pathname==='/api/products'&&req.method==='GET'){
    const products=(await allProducts(env)).filter(p=>p.active&&p.stock>0&&p.price>0);const settings=await getSettings(env);
    return json({products,categories:[...new Set([...settings.categories,...products.map(p=>p.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'bn')),settings:{shopName:settings.shopName,tagline:settings.tagline,heroTitle:settings.heroTitle,heroText:settings.heroText,facebookUrl:settings.facebookUrl,whatsappNumber:settings.whatsappNumber,bkashNumber:settings.bkashNumber,deliveryCharges:settings.deliveryCharges}})
  }
  if(url.pathname==='/api/admin/products'&&req.method==='GET'){if(!(await auth(req,env)))return json({error:'Unauthorized'},401);const settings=await getSettings(env);return json({products:await allProducts(env),categories:[...new Set([...settings.categories,...(await allProducts(env)).map(p=>p.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'bn')),settings})}
  if(url.pathname==='/api/admin/products'&&req.method==='POST'){
    if(!(await auth(req,env)))return json({error:'Unauthorized'},401);if(!env.STORE)return json({error:'STORE binding missing'},500);const body=await req.json().catch(()=>({}));
    if(!String(body.name||'').trim())return json({error:'পণ্যের নাম দিন'},400);const id=body.id||('p_'+crypto.randomUUID());const product=cleanProduct(body,id);await env.STORE.put(key(id),JSON.stringify(product));return json({ok:true,product})
  }
  if(url.pathname==='/api/admin/settings'&&req.method==='PUT'){
    if(!(await auth(req,env)))return json({error:'Unauthorized'},401);if(!env.STORE)return json({error:'STORE binding missing'},500);const body=await req.json().catch(()=>({}));
    const s=normalizeSettings(body);if(!String(s.shopName).trim())return json({error:'Shop name দিন'},400);if(!validPhone(s.whatsappNumber)||!validPhone(s.bkashNumber))return json({error:'WhatsApp/bKash নম্বর 01XXXXXXXXX ফরম্যাটে দিন'},400);
    await env.STORE.put('settings',JSON.stringify(s));return json({ok:true,settings:s})
  }
  if(url.pathname==='/api/admin/products/bulk-active'&&req.method==='POST'){if(!(await auth(req,env)))return json({error:'Unauthorized'},401);if(!env.STORE)return json({error:'STORE binding missing'},500);const active=Boolean((await req.json().catch(()=>({active:true}))).active);const products=await allProducts(env);await Promise.all(products.map(p=>env.STORE.put(key(p.id),JSON.stringify({...p,active}))));return json({ok:true,count:products.length,active})}
  const pm=url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);if(pm&&req.method==='DELETE'){if(!(await auth(req,env)))return json({error:'Unauthorized'},401);await env.STORE.delete(key(pm[1]));return json({ok:true})}
  if(url.pathname==='/api/orders'&&req.method==='POST'){
    if(!env.STORE)return json({error:'STORE binding missing'},500);const order=await req.json().catch(()=>({}));
    if(!String(order.name||'').trim()||!validPhone(order.phone)||!String(order.address||'').trim()||!Array.isArray(order.items)||!order.items.length)return json({error:'নাম, সঠিক মোবাইল, ঠিকানা ও পণ্য নির্বাচন করুন।'},400);
    if(!validPhone(order.senderNumber))return json({error:'bKash sender নম্বর সঠিক নয়।'},400);if(!validTrx(order.trxid))return json({error:'bKash TrxID সঠিকভাবে দিন।'},400);if(order.deliveryPaidConfirmed!==true)return json({error:'ডেলিভারি চার্জ bKash-এ পাঠিয়ে confirmation দিন।'},400);
    const settings=await getSettings(env);const allowedDeliveries=(settings.deliveryCharges||DELIVERY_OPTIONS).map(Number).filter(n=>Number.isFinite(n)&&n>0);const delivery=Number(order.delivery);if(!allowedDeliveries.includes(delivery))return json({error:'সঠিক delivery charge নির্বাচন করুন।'},400);
    const products=await allProducts(env),items=[];for(const raw of order.items){const p=products.find(x=>x.id===raw.id);const qty=Math.max(1,Math.floor(Number(raw.qty)||0));if(qty>MAX_ORDER_QTY)return json({error:'একটি পণ্যের সর্বোচ্চ 20টি অর্ডার করা যাবে।'},400);if(!p||!p.active||p.stock<qty||p.price<=0)return json({error:`${p?.name||'একটি পণ্য'} এখন অর্ডার করা যাচ্ছে না বা পর্যাপ্ত stock নেই।`},400);items.push({id:p.id,name:p.name,qty,price:p.price})}
    const subtotal=items.reduce((s,i)=>s+i.qty*i.price,0),id='ORD-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
    const record={id,createdAt:new Date().toISOString(),status:'নতুন',courier:'',tracking:'',name:String(order.name).trim(),phone:String(order.phone).replace(/\s|-/g,''),address:String(order.address).trim(),senderNumber:String(order.senderNumber).replace(/\s|-/g,''),trxid:String(order.trxid).trim(),deliveryPaidConfirmed:true,items,subtotal,total:subtotal+delivery,codAmount:subtotal,delivery};
    // Save the order first, then reduce stock so successful orders reserve inventory.
    // Validate every current stock value before writing any stock change; if a later write fails,
    // roll back the earlier stock writes and remove the order record.
    const originals=[];
    for(const item of items){const latest=await env.STORE.get(key(item.id),'json');if(!latest||!latest.active||Number(latest.stock)<item.qty||Number(latest.price)<=0)return json({error:`${item.name} এর stock পরিবর্তিত হয়েছে। আবার অর্ডার করুন।`},409);originals.push({item,latest})}
    await env.STORE.put('order:'+id,JSON.stringify(record));
    const written=[];
    try{
      for(const {item,latest} of originals){const current=await env.STORE.get(key(item.id),'json');if(!current||!current.active||Number(current.stock)<item.qty||Number(current.price)<=0)throw new Error('stock_changed');await env.STORE.put(key(item.id),JSON.stringify(cleanProduct({...current,stock:Number(current.stock)-item.qty},item.id)));written.push({id:item.id,current});}
    }catch(err){
      for(const w of written)await env.STORE.put(key(w.id),JSON.stringify(cleanProduct(w.current,w.id)));
      await env.STORE.delete('order:'+id);return json({error:'অর্ডারটি সংরক্ষণ করা যায়নি কারণ stock পরিবর্তিত হয়েছে। আবার চেষ্টা করুন।'},409)
    }
    return json({ok:true,id,order:record})
  }
  if(url.pathname==='/api/admin/orders'&&req.method==='GET'){if(!(await auth(req,env)))return json({error:'Unauthorized'},401);return json({orders:(await listAll(env,'order:')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))})}
  const om=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);if(om&&req.method==='PUT'){if(!(await auth(req,env)))return json({error:'Unauthorized'},401);const current=await env.STORE.get('order:'+om[1],'json');if(!current)return json({error:'Order not found'},404);const patch=await req.json().catch(()=>({}));const updated={...current,status:ORDER_STATUSES.includes(patch.status)?patch.status:current.status,courier:String(patch.courier||'').slice(0,120),tracking:String(patch.tracking||'').slice(0,120)};await env.STORE.put('order:'+om[1],JSON.stringify(updated));return json({ok:true,order:updated})}
  return json({error:'Not found'},404)
}
export default {async fetch(req,env){const url=new URL(req.url);if(url.pathname.startsWith('/api/'))return handleApi(req,env,url);if(url.pathname==='/admin'||url.pathname==='/admin/'){const r=await env.ASSETS.fetch(new Request(new URL('/admin.html',req.url),req));return new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers), 'cache-control':'no-store'}})}const r=await env.ASSETS.fetch(req);if(req.method==='GET'&&(url.pathname==='/'||url.pathname.endsWith('.html')))return new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),'cache-control':'no-store'}});return r}}
