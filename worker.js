const DEFAULT_PRODUCTS = [
  {id:'p1',name:'শ্যাম্পু স্যাশে',category:'পার্সোনাল কেয়ার',desc:'আপনার ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p2',name:'হেয়ার/বডি অয়েল',category:'পার্সোনাল কেয়ার',desc:'ব্র্যান্ড, সাইজ ও দাম Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
  {id:'p3',name:'Emami Fair and Handsome',category:'Men / ছেলেদের',desc:'সঠিক সাইজ ও মূল্য Admin থেকে সেট করুন।',price:0,cost:0,stock:0,active:false,image:'',supplier:'',sampleTest:'Pending',notes:''},
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
    const product={id,name:String(p.name),category:String(p.category||'অন্যান্য'),desc:String(p.desc||''),price:Number(p.price||0),cost:Number(p.cost||0),stock:Math.max(0,Number(p.stock||0)),active:Boolean(p.active),image:String(p.image||''),supplier:String(p.supplier||''),sampleTest:String(p.sampleTest||'Pending'),notes:String(p.notes||'')};
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
    const id='ORD-'+Date.now().toString(36).toUpperCase();
    const record={id,createdAt:new Date().toISOString(),status:'নতুন',courier:'',tracking:'',...order};
    await env.STORE.put('order:'+id,JSON.stringify(record));

    // Optional automatic WhatsApp Business Cloud API notification.
    // Configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Cloudflare secrets/vars.
    // Never put the access token in GitHub.
    let whatsappNotified=false;
    let whatsappError='';
    try{
      if(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID){
        const apiVersion=String(env.WHATSAPP_GRAPH_VERSION||'v23.0');
        const to=String(env.WHATSAPP_NOTIFY_TO||'8801834156413').replace(/\D/g,'');
        const lines=(record.items||[]).map(i=>`${i.name} × ${i.qty} = ৳${Number(i.price||0)*Number(i.qty||0)}`).join('\n');
        const text=[
          '🛍️ Milon Online Shop - নতুন অর্ডার',
          `Order ID: ${record.id}`,
          '',
          `নাম: ${record.name}`,
          `মোবাইল: ${record.phone}`,
          `ঠিকানা: ${record.address}`,
          '',
          'পণ্য:',
          lines,
          '',
          `পণ্যের মূল্য (COD): ৳${record.codAmount??record.subtotal??0}`,
          `ডেলিভারি চার্জ (অগ্রিম): ৳${record.delivery??0}`,
          `bKash নম্বর: ${record.senderNumber||'N/A'}`,
          `TrxID: ${record.trxid||'N/A'}`,
          '',
          'অর্ডার Admin Panel-এও সংরক্ষিত হয়েছে।'
        ].join('\n');
        const resp=await fetch(`https://graph.facebook.com/${apiVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
          method:'POST',
          headers:{'Authorization':`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},
          body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{preview_url:false,body:text}})
        });
        if(!resp.ok){whatsappError=await resp.text();}
        else whatsappNotified=true;
      }
    }catch(err){whatsappError=String(err?.message||err)}
    if(whatsappNotified) record.whatsappNotifiedAt=new Date().toISOString();
    if(whatsappError) record.whatsappError=whatsappError.slice(0,1000);
    await env.STORE.put('order:'+id,JSON.stringify(record));
    return json({ok:true,id,whatsappNotified});
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
