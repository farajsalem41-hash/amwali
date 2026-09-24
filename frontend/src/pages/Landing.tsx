import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Logo } from '../components/Logo';

const HOW = [
  ['01','أنشئ طلب الدفع','حدد المبلغ والعميل ووصف الخدمة في ثوانٍ.'],
  ['02','أرسل الرابط','شارك رابطًا أنيقًا أو QR عبر واتساب أو أي قناة.'],
  ['03','استلم الإثبات','العميل يرى بياناتك، يحوّل، ثم يرفع صورة الإشعار.'],
  ['04','أكد واستلم','راجع الإثبات وسجّل الدفع، وسيُحسب المتبقي تلقائيًا.'],
];
const FEATURES = [
  ['⚡','طلبات دفع فورية','روابط عامة آمنة بدون حاجة لحساب العميل.'],
  ['◈','دفعات جزئية','سجّل أكثر من دفعة واعرف المدفوع والمتبقي بدقة.'],
  ['▣','إثباتات الدفع','مراجعة منظمة بدل صور ورسائل واتساب المتفرقة.'],
  ['▤','فواتير ومنتجات','بنود وخصومات ومواعيد استحقاق في مكان واحد.'],
  ['◎','عملاء وموظفون','سجل عملاء وصلاحيات حسب دور كل موظف.'],
  ['↗','تقارير ذكية','ملخص التحصيل والمتبقي والعمليات مع التصدير.'],
];
const PRICING = [
  {name:'مجانية',price:'0',items:['20 طلب دفع شهريًا','حسابان بنكيان','فرع واحد','إثبات دفع ومراجعة']},
  {name:'أساسية',price:'49',items:['300 طلب دفع شهريًا','6 حسابات بنكية','3 موظفين و3 فروع','تقارير وتصدير'],featured:true},
  {name:'احترافية',price:'99',items:['5000 طلب دفع شهريًا','20 حسابًا بنكيًا','25 موظفًا و25 فرعًا','دعم أولوية']},
];
const FAQ = [
  ['هل أموالي بنك أو بوابة دفع؟','لا. أموالي منصة لتنظيم وإدارة طلبات الدفع والتحويلات، ولا تحتفظ بالأموال ولا تنفّذ التحويل البنكي.'],
  ['هل يحتاج العميل حسابًا؟','لا. يفتح العميل الرابط العام، يرى بيانات الدفع، يحوّل، ثم يرفع الإثبات بدون تسجيل.'],
  ['من يؤكد الدفع؟','التاجر هو من يراجع الإثبات ويؤكد الدفع نهائيًا.'],
  ['هل تدعم الدفعات الجزئية؟','نعم، ويمكن تسجيل عدة دفعات لنفس الطلب مع حساب المتبقي تلقائيًا.'],
];

function Icon({children}:{children:string}) { return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-xl text-emerald-600">{children}</span>; }

export default function Landing() {
  const [openFaq,setOpenFaq]=useState(0);
  return <div className="min-h-screen overflow-hidden bg-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link to="/"><Logo light /></Link>
        <nav className="mr-auto hidden items-center gap-7 text-sm font-bold text-slate-300 lg:flex">
          <a href="#how" className="transition hover:text-white">كيف يعمل</a><a href="#features" className="transition hover:text-white">المميزات</a><a href="#pricing" className="transition hover:text-white">الأسعار</a><a href="#faq" className="transition hover:text-white">الأسئلة</a>
        </nav>
        <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-300 hover:text-white">دخول</Link>
        <Link to="/register" className="shine rounded-xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20">ابدأ مجانًا</Link>
      </div>
    </header>

    <section className="hero-grid relative isolate overflow-hidden bg-slate-950 px-4 pb-24 pt-16 text-white sm:px-6 sm:pt-24 lg:px-8">
      <div className="hero-orb animate-pulse-glow absolute -right-32 top-10 h-80 w-80 rounded-full bg-emerald-400/20"/><div className="hero-orb absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-cyan-400/15"/>
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr]">
        <div className="animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-extrabold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_4px_rgba(52,211,153,.45)]"/> منصة ليبية لإدارة طلبات الدفع</div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">خلّي تحصيلك <span className="bg-gradient-to-l from-emerald-300 via-cyan-300 to-white bg-clip-text text-transparent">أذكى، أسرع، وأرتب.</span></h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">أنشئ طلب دفع احترافي، أرسله للعميل، استلم إثبات التحويل، وتابع المدفوع والمتبقي من لوحة واحدة مصممة للتاجر الليبي.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link to="/register" className="shine rounded-2xl bg-gradient-to-l from-emerald-400 to-cyan-400 px-7 py-3.5 text-sm font-black text-slate-950 shadow-[0_18px_45px_-16px_rgba(52,211,153,.65)]">ابدأ مجانًا الآن</Link><a href="#how" className="rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white backdrop-blur hover:bg-white/10">شوف كيف يخدم ↓</a></div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-xs font-bold text-slate-400"><span>✓ بدون بوابة دفع</span><span>✓ بدون تخزين أموال</span><span>✓ واجهة عربية RTL</span></div>
        </div>

        <div className="perspective animate-fade-up [animation-delay:120ms]">
          <div className="relative mx-auto max-w-xl mock-3d">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-emerald-400/20 via-cyan-400/10 to-violet-500/20 blur-3xl"/>
            <div className="premium-card relative overflow-hidden p-4 sm:p-5">
              <div className="rounded-[1.4rem] bg-slate-950 p-5 text-white shadow-2xl sm:p-6">
                <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">طلب دفع جديد</p><p className="mt-1 text-lg font-black">REQ-000148</p></div><span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">بانتظار الدفع</span></div>
                <div className="mt-7 rounded-3xl border border-white/10 bg-white/[.06] p-5"><p className="text-xs text-slate-400">المبلغ المطلوب</p><p className="mt-1 text-4xl font-black tracking-tight">1,250 <span className="text-base text-emerald-300">د.ل</span></p><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-l from-emerald-300 to-cyan-300"/></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>مدفوع 850 د.ل</span><span>متبقي 400 د.ل</span></div></div>
                <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs text-slate-400">العميل</p><p className="mt-1 font-bold">محمد سالم</p></div><div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs text-slate-400">آخر تحديث</p><p className="mt-1 font-bold">منذ 4 دقائق</p></div></div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-white/10 bg-white/95 px-4 py-3 text-slate-900 shadow-2xl sm:flex sm:items-center sm:gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">✓</span><div><p className="text-xs text-slate-400">دفعة مؤكدة</p><p className="text-sm font-black">+ 350 د.ل</p></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-slate-100 bg-white px-4 py-7 sm:px-6"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-bold text-slate-400"><span>مصمم للتاجر الليبي</span><span>•</span><span>Mobile First</span><span>•</span><span>Secure Links</span><span>•</span><span>RTL Native</span></div></section>

    <section id="how" className="px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-sm font-black text-emerald-600">بسيطة من أول خطوة</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">من الطلب إلى التأكيد في 4 خطوات</h2></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{HOW.map(([n,t,b])=><div key={n} className="group relative rounded-3xl border border-slate-200 bg-slate-50 p-6 transition duration-300 hover:-translate-y-2 hover:border-emerald-200 hover:bg-white hover:shadow-[0_25px_60px_-30px_rgba(16,185,129,.45)]"><span className="text-xs font-black text-emerald-600">{n}</span><h3 className="mt-7 text-lg font-black">{t}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{b}</p><div className="mt-7 h-1 w-10 rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400 transition-all group-hover:w-20"/></div>)}</div></div></section>

    <section id="features" className="bg-slate-950 px-4 py-20 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="text-center"><p className="text-sm font-black text-emerald-300">كل شيء في مكان واحد</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">أدوات تخدم تجارتك، مش تعقّدها</h2></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([ic,t,b])=><div key={t} className="group rounded-3xl border border-white/10 bg-white/[.045] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[.07]"><Icon>{ic}</Icon><h3 className="mt-5 text-lg font-black">{t}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{b}</p></div>)}</div></div></section>

    <section id="pricing" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="text-center"><p className="text-sm font-black text-emerald-600">أسعار واضحة</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">ابدأ مجانًا وكبّر مع شغلك</h2></div><div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">{PRICING.map(p=><div key={p.name} className={`relative rounded-[2rem] border p-7 ${p.featured?'border-emerald-300 bg-slate-950 text-white shadow-[0_30px_80px_-30px_rgba(16,185,129,.5)]':'border-slate-200 bg-white'}`}>{p.featured&&<span className="absolute -top-3 right-6 rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400 px-3 py-1 text-xs font-black text-slate-950">الأكثر طلبًا</span>}<p className={`font-black ${p.featured?'text-emerald-300':'text-emerald-600'}`}>{p.name}</p><div className="mt-4"><span className="text-5xl font-black">{p.price}</span><span className={p.featured?'text-slate-400':'text-slate-500'}> د.ل / شهر</span></div><ul className="mt-7 space-y-3 text-sm">{p.items.map(x=><li key={x} className={`flex gap-2 ${p.featured?'text-slate-300':'text-slate-600'}`}><span className="text-emerald-500">✓</span>{x}</li>)}</ul><Link to="/register" className={`mt-8 block rounded-2xl px-5 py-3 text-center text-sm font-black ${p.featured?'bg-emerald-400 text-slate-950 hover:bg-emerald-300':'bg-slate-950 text-white hover:bg-slate-800'}`}>ابدأ الآن</Link></div>)}</div></div></section>

    <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><div className="text-center"><p className="text-sm font-black text-emerald-600">قبل ما تبدأ</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">أسئلة تتكرر</h2></div><div className="mt-10 space-y-3">{FAQ.map(([q,a],i)=><div key={q} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button onClick={()=>setOpenFaq(openFaq===i?-1:i)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-right"><span className="font-black">{q}</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-emerald-600">{openFaq===i?'−':'+'}</span></button>{openFaq===i&&<p className="px-5 pb-5 text-sm leading-7 text-slate-500">{a}</p>}</div>)}</div></div></section>

    <section className="relative overflow-hidden bg-gradient-to-l from-emerald-400 via-cyan-400 to-emerald-300 px-4 py-16 sm:px-6"><div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/20 blur-3xl"/><div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-7"><div><h2 className="text-3xl font-black text-slate-950">جاهز ترتّب تحصيلك؟</h2><p className="mt-2 font-bold text-slate-800">افتح حسابك وجرّب أول طلب دفع اليوم.</p></div><Link to="/register" className="rounded-2xl bg-slate-950 px-7 py-3.5 text-sm font-black text-white shadow-xl hover:bg-slate-900">ابدأ مجانًا</Link></div></section>
    <footer className="bg-slate-950 px-4 py-10 text-slate-400 sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5"><Logo light/><p className="text-xs">أموالي © 2026 — منصة لتنظيم طلبات الدفع والتحويلات.</p></div></footer>
  </div>;
}
