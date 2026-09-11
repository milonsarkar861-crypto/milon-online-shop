MILON ONLINE SHOP — FIXED UPDATE v2

এই ZIP আগের Milon Online Shop Worker project-এর corrected version।
Existing Worker/domain একই থাকবে:
https://floral-surf-51e5.milonsarkar861.workers.dev

যা ঠিক করা হয়েছে:
1. Admin product save/update flow শক্ত করা হয়েছে।
2. Existing product edit করলে নতুন ছবি না দিলেও আগের ছবি নষ্ট হবে না।
3. Category এখন real dropdown; নতুন category দেওয়ার option আছে।
4. Product Active/Inactive বাস্তবে কাজ করে।
5. Bulk “সব Active করুন / সব Inactive করুন” যোগ করা হয়েছে।
6. Active product-এর price/stock validation যোগ করা হয়েছে।
7. Public page Admin-এর active product API থেকে data নেয় এবং refresh করা যায়।
8. Public category filter + product search যোগ করা হয়েছে।
9. Product card → Add to Cart → quantity → total flow ঠিক করা হয়েছে।
10. Cart-এর পুরোনো invalid/stock-over quantity clean করা হয়।
11. Order submit করার আগে server-side product/stock/price যাচাই হয়।
12. Server order total/subtotal আবার হিসাব করে, client-এর ভুল total বিশ্বাস করে না।
13. Admin Customer Orders refresh ও status/courier/tracking save flow রাখা ও শক্ত করা হয়েছে।
14. Website link share/copy button যোগ করা হয়েছে।
15. Public page-এর product loading error message পরিষ্কার করা হয়েছে।
16. Wrangler assets directory `./public` করা হয়েছে, যাতে GitHub/Cloudflare case-sensitive deployment-এ asset path mismatch না হয়।
17. Public/admin HTML JavaScript syntax check করা হয়েছে।
18. Worker API smoke test করা হয়েছে: health, login, product save, public product, order create, admin order list — সব expected response দিয়েছে।

DEPLOY:
- GitHub repository-তে এই ZIP খুলে আগের project-এর files replace করুন।
- বিশেষ করে worker.js, public/index.html, public/admin.html, wrangler.jsonc replace হবে।
- Cloudflare Worker-এর existing KV binding `STORE` একই রাখতে হবে।
- Existing domain/Worker name পরিবর্তন করবেন না।
- Deploy হওয়ার পরে /admin খুলে product Active করে price + stock নিশ্চিত করুন।
- তারপর public homepage refresh করে product দেখুন।

নোট:
- এই ZIP database/KV-এর পুরোনো product data মুছে দেয় না।
- Real bKash payment/TrxID ছাড়া fake order test করবেন না।


AUDIT v3: Order endpoint now validates delivery amount, phone/bKash numbers, TrxID, payment confirmation, quantity limit, and admin order updates are field-whitelisted. Order IDs are collision-resistant. Public and admin JavaScript syntax checked after these changes.
