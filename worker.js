const DEFAULT_PRODUCTS = [
  {id:'p1',name:'শ্যাম্পু স্যাশে',category:'পার্সোনাল কেয়ার',desc:'আপনার ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p2',name:'হেয়ার/বডি অয়েল',category:'পার্সোনাল কেয়ার',desc:'ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p3',name:'Emami Fair and Handsome',category:'গ্রুমিং',desc:'সঠিক সাইজ ও মূল্য Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p4',name:'ক্রিম ৪–১০ গ্রাম',category:'স্কিন কেয়ার',desc:'ব্র্যান্ড, গ্রাম ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''}
];
const ADMIN_PASSWORD = 'Milon@8613'; // Change before public business use.

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}})}
function key(id){return `product:${id}`}
async function auth(req,env){
  const c=req.headers.get('cookie')||'';
  const m=c.match(/(?:^|;\s*)milon_admin=([^;]+)/);
  if(!m||!env.STORE)return false;
  const token=m[1];
  return !!(await env.STORE.get('session:'+token));
}

async function listAll(env,prefix){
  if(!env.STORE) return [];
  const out=[]; let cursor;
  do{
    const res=await env.STORE.list({prefix,cursor});
    const vals=await Promise.all(res.keys.map(k=>env.STORE.get(k.name,'json')));for(const v of vals){if(v)out.push(v)}
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
  if(url.pathname==='/api/admin/login' && req.method==='POST'){
    const body=await req.json().catch(()=>({}));
    if(body.password!==ADMIN_PASSWORD) return json({error:'Password ভুল'},401);
    if(!env.STORE) return json({error:'STORE binding missing'},500);
    const token=crypto.randomUUID()+crypto.randomUUID().replaceAll('-','');
    await env.STORE.put('session:'+token,'1',{expirationTtl:60*60*24*30});
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store','set-cookie':`milon_admin=${token}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`}});
  }
  if(url.pathname==='/api/admin/logout' && req.method==='POST'){
    const c=req.headers.get('cookie')||''; const m=c.match(/(?:^|;\s*)milon_admin=([^;]+)/);
    if(m&&env.STORE) await env.STORE.delete('session:'+m[1]);
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json;charset=UTF-8','set-cookie':'milon_admin=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'}});
  }
  if(url.pathname==='/api/products' && req.method==='GET') return json({products:(await allProducts(env)).filter(p=>p.active&&Number(p.stock)>0&&Number(p.price)>0)});

  if(url.pathname==='/api/admin/products' && req.method==='GET'){
    if(!(await auth(req,env))) return json({error:'Unauthorized'},401);
    return json({products:await allProducts(env)});
  }

  if(url.pathname==='/api/admin/products' && req.method==='POST'){
    if(!(await auth(req,env))) return json({error:'Unauthorized'},401);
    if(!env.STORE) return json({error:'STORE binding missing'},500);
    const p=await req.json();
    if(!p.name) return json({error:'পণ্যের নাম দিন'},400);
    const id=p.id||('p_'+crypto.randomUUID());
    const product={id,name:String(p.name),category:String(p.category||'সাধারণ'),desc:String(p.desc||''),size:String(p.size||''),usage:String(p.usage||''),benefits:String(p.benefits||''),price:Number(p.price||0),cost:Number(p.cost||0),stock:Math.max(0,Number(p.stock||0)),active:Boolean(p.active),image:String(p.image||''),supplier:String(p.supplier||''),sampleTest:String(p.sampleTest||'Pending'),notes:String(p.notes||'')};
    await env.STORE.put(key(id),JSON.stringify(product));
    return json({ok:true,product});
  }

  const m=url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if(m && req.method==='DELETE'){
    if(!(await auth(req,env))) return json({error:'Unauthorized'},401);
    await env.STORE.delete(key(m[1]));
    return json({ok:true});
  }

  if(url.pathname==='/api/orders' && req.method==='POST'){
    if(!env.STORE) return json({error:'STORE binding missing'},500);
    const order=await req.json();
    if(!order.name||!order.phone||!order.address||!Array.isArray(order.items)||!order.items.length) return json({error:'অর্ডারের তথ্য অসম্পূর্ণ'},400);
    const outside=order.areaType==='কালাই থানার বাইরে';
    const delivery=Number(order.delivery||0);
    if(outside){
      if(![60].includes(delivery)||!order.senderNumber||!order.trxid||order.deliveryPaidConfirmed!==true) return json({error:'বাইরের এলাকার অর্ডারে সঠিক Delivery Charge, bKash sender number, TrxID এবং confirmation প্রয়োজন'},400);
    }else if(delivery!==0){return json({error:'কালাই থানার ভিতরের ডেলিভারি চার্জ অবশ্যই ০ হতে হবে'},400)}
    // Re-check products on the server so a client cannot change prices or order unavailable stock.
    const catalog=await allProducts(env);
    const normalizedItems=[];
    let subtotal=0;
    for(const item of order.items){
      const p=catalog.find(x=>String(x.id)===String(item.id));
      const qty=Math.floor(Number(item.qty));
      if(!p||!p.active||Number(p.price)<=0||Number(p.stock)<=0||!Number.isInteger(qty)||qty<1||qty>Number(p.stock)) return json({error:`পণ্য/স্টক যাচাই করা যায়নি: ${item.name||item.id}`},400);
      normalizedItems.push({id:p.id,name:p.name,qty,price:Number(p.price)});
      subtotal += qty*Number(p.price);
    }
    const expectedTotal=subtotal+delivery;
    const id='ORD-'+Date.now().toString(36).toUpperCase();
    const record={id,createdAt:new Date().toISOString(),status:'নতুন',courier:'',tracking:'',...order,items:normalizedItems,subtotal,total:expectedTotal,codAmount:subtotal};
    // Reserve/decrement stock before accepting the order. KV is not transactional, so re-read each item immediately before write.
    for(const item of normalizedItems){
      const latest=await env.STORE.get(key(item.id),'json');
      if(!latest||!latest.active||Number(latest.stock)<item.qty||Number(latest.price)!==item.price) return json({error:`${item.name} এর স্টক/দাম পরিবর্তিত হয়েছে। আবার চেষ্টা করুন।`},409);
    }
    for(const item of normalizedItems){
      const latest=await env.STORE.get(key(item.id),'json');
      latest.stock=Math.max(0,Number(latest.stock)-item.qty);
      await env.STORE.put(key(item.id),JSON.stringify(latest));
    }
    await env.STORE.put('order:'+id,JSON.stringify(record));
    return json({ok:true,id,subtotal,total:expectedTotal});
  }

  if(url.pathname==='/api/admin/orders' && req.method==='GET'){
    if(!(await auth(req,env))) return json({error:'Unauthorized'},401);
    return json({orders:(await listAll(env,'order:')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
  }

  const om=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if(om && req.method==='PUT'){
    if(!(await auth(req,env))) return json({error:'Unauthorized'},401);
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
  if(url.pathname==='/admin' || url.pathname==='/admin/') return env.ASSETS.fetch(new Request(new URL('/admin.html',req.url),req));
  return env.ASSETS.fetch(req);
}};
