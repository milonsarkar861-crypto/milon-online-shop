const DEFAULT_PRODUCTS = [
  {id:'p1',name:'শ্যাম্পু স্যাশে',category:'পার্সোনাল কেয়ার',desc:'আপনার ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p2',name:'হেয়ার/বডি অয়েল',category:'পার্সোনাল কেয়ার',desc:'ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p3',name:'Emami Fair and Handsome',category:'গ্রুমিং',desc:'সঠিক সাইজ ও মূল্য Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p4',name:'ক্রিম ৪–১০ গ্রাম',category:'স্কিন কেয়ার',desc:'ব্র্যান্ড, গ্রাম ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''}
];
const ADMIN_PASSWORD = 'Milon@8613'; // Change before public business use.

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}})}
function key(id){return `product:${id}`}
function auth(req){return req.headers.get('x-admin-password')===ADMIN_PASSWORD}

async function listAll(env,prefix){
  if(!env.STORE) return [];
  const out=[]; let cursor;
  do{
    const res=await env.STORE.list({prefix,cursor});
    for(const k of res.keys){const v=await env.STORE.get(k.name,'json');if(v)out.push(v)}
    cursor=res.list_complete?undefined:res.cursor;
  }while(cursor);
  return out;
}

async function allProducts(env){
  if(!env.STORE) return DEFAULT_PRODUCTS;
  let arr=await listAll(env,'product:');
  if(!arr.length){for(const p of DEFAULT_PRODUCTS) await env.STORE.put(key(p.id),JSON.stringify(p));arr=[...DEFAULT_PRODUCTS]}
  return arr.sort((a,b)=>String(a.name).localeCompare(String(b.name),'bn'));
}

async function handleApi(req,env,url){
  if(url.pathname==='/api/products' && req.method==='GET') return json({products:(await allProducts(env)).filter(p=>p.active&&Number(p.stock)>0&&Number(p.price)>0)});

  if(url.pathname==='/api/admin/products' && req.method==='GET'){
    if(!auth(req)) return json({error:'Unauthorized'},401);
    return json({products:await allProducts(env)});
  }

  if(url.pathname==='/api/admin/products' && req.method==='POST'){
    if(!auth(req)) return json({error:'Unauthorized'},401);
    if(!env.STORE) return json({error:'STORE binding missing'},500);
    const p=await req.json();
    if(!p.name) return json({error:'পণ্যের নাম দিন'},400);
    const id=p.id||('p_'+crypto.randomUUID());
    const product={id,name:String(p.name),category:String(p.category||'সাধারণ'),desc:String(p.desc||''),price:Number(p.price||0),cost:Number(p.cost||0),stock:Math.max(0,Number(p.stock||0)),active:Boolean(p.active),image:String(p.image||''),supplier:String(p.supplier||''),sampleTest:String(p.sampleTest||'Pending'),notes:String(p.notes||'')};
    await env.STORE.put(key(id),JSON.stringify(product));
    return json({ok:true,product});
  }

  const m=url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if(m && req.method==='DELETE'){
    if(!auth(req)) return json({error:'Unauthorized'},401);
    await env.STORE.delete(key(m[1]));
    return json({ok:true});
  }

  if(url.pathname==='/api/orders' && req.method==='POST'){
    if(!env.STORE) return json({error:'STORE binding missing'},500);
    const order=await req.json();
    if(!order.name||!order.phone||!order.address||!Array.isArray(order.items)||!order.items.length) return json({error:'অর্ডারের তথ্য অসম্পূর্ণ'},400);
    const id='ORD-'+Date.now().toString(36).toUpperCase();
    const record={id,createdAt:new Date().toISOString(),status:'নতুন',courier:'',tracking:'',...order};
    await env.STORE.put('order:'+id,JSON.stringify(record));
    return json({ok:true,id});
  }

  if(url.pathname==='/api/admin/orders' && req.method==='GET'){
    if(!auth(req)) return json({error:'Unauthorized'},401);
    return json({orders:(await listAll(env,'order:')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
  }

  const om=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if(om && req.method==='PUT'){
    if(!auth(req)) return json({error:'Unauthorized'},401);
    const current=await env.STORE.get('order:'+om[1],'json');
    if(!current) return json({error:'Order not found'},404);
    const patch=await req.json();
    const updated={...current,...patch};
    await env.STORE.put('order:'+om[1],JSON.stringify(updated));
    return json({ok:true,order:updated});
  }
  return json({error:'Not found'},404);
}

export default {async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==='/api/health') return json({ok:true,store:!!env.STORE,assets:!!env.ASSETS});
  if(url.pathname.startsWith('/api/')) return handleApi(req,env,url);
  if(url.pathname==='/admin' || url.pathname==='/admin/') return Response.redirect(new URL('/admin.html',req.url),302);
  return env.ASSETS.fetch(req);
}};
