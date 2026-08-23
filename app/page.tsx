"use client";
/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-static-element-interactions -- grouped date controls and dismissible backdrop */

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CustomAgentBuilder } from "@/components/custom-agent-builder";

type Locale = "en" | "ar";
type AgentId = "hamdan" | "noura" | "adam";
type AudioLanguage = "ar" | "en" | "ru";

const audioLanguages: { id: AudioLanguage; label: string; short: string }[] = [
  { id: "ar", label: "Arabic", short: "AR" },
  { id: "en", label: "English", short: "EN" },
  { id: "ru", label: "Russian", short: "RU" },
];

const agentAudio: Record<AgentId, Record<AudioLanguage, string>> = {
  hamdan: { ar: "/audio/hamdan-ar.mp3", en: "/audio/hamdan-en.mp3", ru: "/audio/hamdan-ru.mp3" },
  noura: { ar: "/audio/sama-ar.mp3", en: "/audio/sama-en.mp3", ru: "/audio/sama-ru.mp3" },
  adam: { ar: "/audio/adam-ar.mp3", en: "/audio/adam-en.mp3", ru: "/audio/adam-ru.mp3" },
};

const agents = [
  { id: "hamdan" as AgentId, name: "Hamdan", arabic: "حمدان", language: "5 language skills", skills: ["English", "Arabic", "Russian", "Italian", "Spanish"], role: "Customer operations", roles: "Banking · Property · Collections", image: "/agents/hamdan.png", alt: "Pixel portrait of Hamdan, a multilingual RoleField AI agent in Emirati attire" },
  { id: "noura" as AgentId, name: "Sama", arabic: "سما", language: "5 language skills", skills: ["English", "Russian", "French", "German", "Italian"], role: "Service orchestration", roles: "Hospitality · Scheduling · Support", image: "/agents/noura.png", alt: "Pixel portrait of Sama, a multilingual RoleField AI agent" },
  { id: "adam" as AgentId, name: "Adam", arabic: "آدم", language: "7 language skills", skills: ["English", "Arabic", "Hindi", "Urdu", "Tagalog", "Russian", "Malayalam"], role: "Revenue operations", roles: "Sales · Qualification · Follow-up", image: "/agents/adam.png", alt: "Pixel portrait of Adam, a multilingual revenue operations AI agent" },
];

const useCases = [
  { tag: "SUPPORT", title: "Customer support", problem: "Queues grow while routine requests repeat.", action: "Answers, verifies and resolves across languages.", outcome: "Faster resolution with human escalation.", agent: "noura" },
  { tag: "REVENUE", title: "Lead qualification", problem: "Sales teams lose time on unqualified enquiries.", action: "Engages, qualifies and updates your CRM.", outcome: "More sales-ready conversations.", agent: "adam" },
  { tag: "OPERATIONS", title: "Appointment booking", problem: "Manual scheduling creates missed opportunities.", action: "Finds availability, books and confirms.", outcome: "Full calendars with less admin.", agent: "noura" },
  { tag: "FINANCE", title: "Collections", problem: "Payment follow-ups are repetitive and sensitive.", action: "Calls naturally and captures commitments.", outcome: "Consistent follow-up without losing trust.", agent: "hamdan" },
  { tag: "HOSPITALITY", title: "Guest concierge", problem: "Guests expect immediate, local service.", action: "Handles requests, bookings and follow-ups.", outcome: "Round-the-clock guest care.", agent: "noura" },
  { tag: "PROPERTY", title: "Real estate enquiries", problem: "High lead volume makes response times uneven.", action: "Answers questions and schedules viewings.", outcome: "Every serious buyer gets a response.", agent: "hamdan" },
  { tag: "BANKING", title: "Banking assistance", problem: "Customers need fast answers with clear controls.", action: "Guides routine requests and escalates exceptions.", outcome: "Accessible service with human oversight.", agent: "hamdan" },
  { tag: "LOGISTICS", title: "Order & delivery", problem: "Address and delivery exceptions drive call volume.", action: "Confirms details and coordinates changes.", outcome: "Fewer failed deliveries.", agent: "adam" },
];

const dates = Array.from({ length: 16 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }).filter(d => ![5, 6].includes(d.getDay())).slice(0, 8);
const slots = ["10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

const copy = {
  en: {
    nav: ["Platform", "Agents", "Use cases", "Languages", "Security"],
    eyebrow: "AUTONOMOUS CUSTOMER OPERATIONS, BUILT FOR THE GCC",
    title: <>One AI workforce for <em>every language, task and customer.</em></>,
    lede: "Arabic-native and fluent across the languages of the GCC. RoleField agents run customer-facing work end to end—from the first conversation to follow-ups, reminders, CRM updates and human handover.",
    talk: "Yalla, let’s talk", demo: "Book a demo", trust: "Customer data stays in the region.",
    agentsTitle: <>Meet a workforce <em>configured around your work.</em></>, agentsText: "These agents are examples, not fixed roles. You define the task, language, workflow and outcome; RoleField delivers it.",
  },
  ar: {
    nav: ["المنصة", "الوكلاء", "حالات الاستخدام", "اللغات", "الأمان"],
    eyebrow: "عمليات عملاء مستقلة، مصممة للخليج",
    title: <>فريق ذكاء اصطناعي واحد <em>لكل لغة ومهمة وعميل.</em></>,
    lede: "وكلاء RoleField عربيو المنشأ ويتحدثون بطلاقة لغات سكان الخليج. يديرون العمل مع العملاء من البداية إلى النهاية، من المحادثة الأولى إلى المتابعة والتذكير وتحديث CRM والتحويل للموظفين.",
    talk: "يلا، خلّنا نتكلم", demo: "احجز عرضاً", trust: "بيانات العملاء تبقى داخل المنطقة.",
    agentsTitle: <>فريق عمل <em>مصمم حول مهامك.</em></>, agentsText: "هؤلاء الوكلاء أمثلة وليست أدواراً ثابتة. أنت تحدد المهمة واللغة وسير العمل والنتيجة، وRoleField تنفذها.",
  },
};

const arabicText: Record<string, string> = {
  "Arabic-native":"عربي أصيل","Regional dialects":"لهجات إقليمية","In-region deployment":"استضافة داخل المنطقة","Enterprise integrations":"تكاملات مؤسسية","Human escalation":"تحويل سلس للموظفين",
  "YOUR LOCALLY FLUENT AI TEAM":"فريق ذكاء اصطناعي يتحدث بلهجتك","SELECTED":"محدد","READY":"جاهز","UAE Arabic":"العربية الإماراتية","English + Arabic":"الإنجليزية + العربية","Customer care":"خدمة العملاء","Banking · Real estate":"الخدمات المصرفية · العقارات","Appointments":"المواعيد","Hospitality · Support":"الضيافة · الدعم","Enterprise sales":"مبيعات المؤسسات","Qualification · Scheduling":"تأهيل العملاء · الجدولة","Listening":"جارٍ الاستماع","Listen":"استمع","Start conversation ↗":"ابدأ المحادثة ↗","Book live session":"احجز جلسة مباشرة","The live voice connection plugs in here. Book a working demo to speak with this agent using your own use case.":"سيتم ربط المحادثة الصوتية المباشرة هنا. احجز عرضاً عملياً للتحدث مع هذا الوكيل باستخدام حالة عملك.",
  "THE ROLEFIELD PLATFORM":"منصة ROLEFIELD","Not a chatbot":"ليست دردشة آلية","with a voice.":"بصوت فقط.","RoleField listens, reasons and acts across the customer journey—handling interruptions, switching languages, completing actions in your systems and bringing in your team when judgement is needed.":"تستمع RoleField وتفهم وتتخذ الإجراءات طوال رحلة العميل، وتتعامل مع المقاطعات وتبدّل اللغات وتنجز المهام في أنظمتك وتستعين بفريقك عند الحاجة.","Sub-second":"أقل من ثانية","natural response flow":"تدفق استجابة طبيعي","Human-like":"تجربة بشرية","interruptions and handoffs":"مقاطعات وتحويلات سلسة","Connected":"متصلة","CRM and workflow actions":"إجراءات CRM وسير العمل","ROLEFIELD CONTROL ROOM":"مركز تحكم ROLEFIELD","● LIVE OPERATIONS":"● عمليات مباشرة","CONVERSATIONS":"المحادثات","Live":"مباشرة","Monitor every active agent":"راقب كل وكيل نشط","OUTCOMES":"النتائج","Visible":"واضحة","Track intent, action and result":"تتبع النية والإجراء والنتيجة","Arabic · Customer care":"العربية · خدمة العملاء","Intent understood":"تم فهم الطلب","CRM updated":"تم تحديث CRM","English · Lead qualification":"الإنجليزية · تأهيل العملاء","Qualified opportunity":"فرصة مؤهلة","Sales notified":"تم إشعار المبيعات","Khaleeji · Booking":"الخليجية · الحجوزات","Availability checked":"تم التحقق من التوفر","Confirmed":"تم التأكيد",
  "PRACTICAL BUSINESS OUTCOMES":"نتائج أعمال عملية","One workforce.":"فريق واحد.","Eight roles.":"ثمانية أدوار.","Select a workflow to see the problem, action and outcome.":"اختر سير العمل لعرض المشكلة والإجراء والنتيجة.","SUPPORT":"الدعم","REVENUE":"الإيرادات","OPERATIONS":"العمليات","FINANCE":"المالية","HOSPITALITY":"الضيافة","PROPERTY":"العقارات","BANKING":"الخدمات المصرفية","LOGISTICS":"الخدمات اللوجستية","Customer support":"دعم العملاء","Queues grow while routine requests repeat.":"تزداد قوائم الانتظار مع تكرار الطلبات الروتينية.","Answers, verifies and resolves across languages.":"يجيب ويتحقق ويحل الطلبات عبر لغات متعددة.","Faster resolution with human escalation.":"حل أسرع مع تحويل سلس للموظفين.","Lead qualification":"تأهيل العملاء المحتملين","Sales teams lose time on unqualified enquiries.":"تهدر فرق المبيعات وقتها على استفسارات غير مؤهلة.","Engages, qualifies and updates your CRM.":"يتواصل ويؤهل ويحدّث نظام CRM.","More sales-ready conversations.":"محادثات أكثر جاهزية للمبيعات.","Appointment booking":"حجز المواعيد","Manual scheduling creates missed opportunities.":"تؤدي الجدولة اليدوية إلى ضياع الفرص.","Finds availability, books and confirms.":"يتحقق من التوفر ويحجز ويؤكد الموعد.","Full calendars with less admin.":"جداول ممتلئة بأعمال إدارية أقل.","Collections":"التحصيل","Payment follow-ups are repetitive and sensitive.":"متابعة المدفوعات متكررة وحساسة.","Calls naturally and captures commitments.":"يتواصل بأسلوب طبيعي ويسجل التزامات الدفع.","Consistent follow-up without losing trust.":"متابعة منتظمة مع الحفاظ على ثقة العميل.","Guest concierge":"خدمة الضيوف","Guests expect immediate, local service.":"يتوقع الضيوف خدمة فورية ومحلية.","Handles requests, bookings and follow-ups.":"يدير الطلبات والحجوزات والمتابعة.","Round-the-clock guest care.":"رعاية للضيوف على مدار الساعة.","Real estate enquiries":"استفسارات العقارات","High lead volume makes response times uneven.":"يؤدي حجم الاستفسارات الكبير إلى تفاوت سرعة الاستجابة.","Answers questions and schedules viewings.":"يجيب عن الأسئلة ويحدد مواعيد المعاينة.","Every serious buyer gets a response.":"يحصل كل مشترٍ جاد على استجابة.","Banking assistance":"المساعدة المصرفية","Customers need fast answers with clear controls.":"يحتاج العملاء إلى إجابات سريعة ضمن ضوابط واضحة.","Guides routine requests and escalates exceptions.":"يرشد الطلبات الروتينية ويحوّل الاستثناءات.","Accessible service with human oversight.":"خدمة سهلة الوصول بإشراف بشري.","Order & delivery":"الطلبات والتوصيل","Address and delivery exceptions drive call volume.":"تزيد استثناءات العناوين والتوصيل من حجم المكالمات.","Confirms details and coordinates changes.":"يؤكد التفاصيل وينسق التغييرات.","Fewer failed deliveries.":"عمليات توصيل فاشلة أقل.","THE PROBLEM":"المشكلة","ROLEFIELD DOES":"ما تنفذه ROLEFIELD","THE OUTCOME":"النتيجة",
  "HOW IT WORKS":"كيف تعمل","From role to resolution":"من الدور إلى الحل","in three clear steps.":"في ثلاث خطوات واضحة.","Choose a role and dialect":"اختر الدور واللهجة","Select the voice, regional language and business outcome your agent owns.":"اختر الصوت واللغة الإقليمية ونتيجة العمل التي سيتولاها الوكيل.","Connect systems and knowledge":"اربط الأنظمة والمعرفة","Link approved content, CRM data, booking tools and operating workflows.":"اربط المحتوى المعتمد وبيانات CRM وأدوات الحجز وسير العمل.","Deploy across calls and channels":"انشر عبر المكالمات والقنوات","Launch, monitor outcomes and escalate to your team whenever needed.":"أطلق الخدمة وراقب النتائج وحوّل إلى فريقك عند الحاجة.",
  "LANGUAGE INTELLIGENCE":"ذكاء لغوي","Local fluency is":"الطلاقة المحلية","the product.":"هي أساس المنتج.","Dialect, voice and role are independent controls. Build the right agent for every customer journey without tying language to appearance.":"اللهجة والصوت والدور عناصر مستقلة. أنشئ الوكيل المناسب لكل رحلة عميل دون ربط اللغة بالمظهر.","Natural Gulf Arabic · Context retained":"عربية خليجية طبيعية · سياق محفوظ","CONFIGURE AN AGENT":"إعداد الوكيل","● READY":"● جاهز","1. Dialect":"١. اللهجة","2. Voice":"٢. الصوت","3. Role":"٣. الدور","Saudi Arabic":"العربية السعودية","Khaleeji Arabic":"العربية الخليجية","Modern Standard Arabic":"العربية الفصحى","English":"الإنجليزية","Hindi / Urdu":"الهندية / الأردية","Warm & professional":"دافئ واحترافي","Calm & reassuring":"هادئ ومطمئن","Clear & direct":"واضح ومباشر","Sales":"المبيعات","Bookings":"الحجوزات","YOUR CONFIGURATION":"إعداداتك",
  "ENTERPRISE CONTROL":"تحكم مؤسسي","Regional by design.":"مصممة للمنطقة.","Secure by default.":"آمنة بشكل افتراضي.","Choose UAE or Saudi hosting, control every integration and keep a reviewable record of what your agents heard, decided and did.":"اختر استضافة في الإمارات أو السعودية، وتحكم في كل تكامل واحتفظ بسجل قابل للمراجعة لما سمعه وكلاؤك وقرروه ونفذوه.","Discuss your requirements ↗":"ناقش متطلباتك ↗","UAE and Saudi hosting options for customer data and recordings.":"خيارات استضافة في الإمارات والسعودية لبيانات العملاء والتسجيلات.","Private integrations":"تكاملات خاصة","Least-privilege access to CRM, telephony and core business systems.":"وصول بأقل الصلاحيات إلى CRM والاتصالات والأنظمة الأساسية.","Human in control":"الإنسان في دائرة التحكم","Clear escalation rules, approval paths and conversation review.":"قواعد تحويل واضحة ومسارات اعتماد ومراجعة للمحادثات.","Measurable governance":"حوكمة قابلة للقياس","Outcome analytics, quality monitoring and auditable action records.":"تحليلات النتائج ومراقبة الجودة وسجلات إجراءات قابلة للتدقيق.",
  "READY FOR A REAL CONVERSATION?":"هل أنت جاهز لمحادثة حقيقية؟","Your next customer conversation can be handled by":"يمكن إدارة محادثتك التالية مع العميل بواسطة","Talk to an agent ↘":"تحدث مع وكيل ↘","Book a GCC demo":"احجز عرضاً للخليج","Arabic and multilingual AI voice agents for organisations across the GCC.":"وكلاء ذكاء اصطناعي صوتيون بالعربية ولغات متعددة للمؤسسات في دول الخليج.","A company by AI7Lab, UAE.":"إحدى شركات AI7Lab، الإمارات.","EXPLORE":"استكشف","Platform":"المنصة","Agents":"الوكلاء","Use cases":"حالات الاستخدام","CAPABILITIES":"الإمكانات","Languages":"اللغات","Security":"الأمان","Book a demo":"احجز عرضاً","CONTACT":"تواصل معنا","Dubai, United Arab Emirates":"دبي، الإمارات العربية المتحدة","Built in the UAE for the GCC":"صُنع في الإمارات للخليج",
  "DEMO CONFIRMED":"تم تأكيد العرض","You’re booked.":"شكراً، سنتواصل معك قريباً.","Done":"تم","BOOK A ROLEFIELD DEMO":"احجز عرضاً من ROLEFIELD","Choose a time for your GCC use case.":"اختر موعداً يناسب استخدامك في الخليج.","30 minutes with our UAE team · English or Arabic":"٣٠ دقيقة مع فريقنا في الإمارات · العربية أو الإنجليزية","Select a date":"اختر التاريخ","Select a time":"اختر الوقت","Gulf Standard Time (UTC+4)":"توقيت الخليج (UTC+4)","Continue":"متابعة","← Change time":"غيّر الموعد →","Your name":"الاسم","Work email":"بريد العمل","Company":"الشركة","Phone":"الهاتف","Preferred language":"اللغة المفضلة","العربية (Arabic)":"العربية","Both":"كلتاهما","Primary use case":"حالة الاستخدام الرئيسية","Customer service":"خدمة العملاء","Booking & scheduling":"الحجز والجدولة","Sales qualification":"تأهيل العملاء للمبيعات","Delivery & logistics":"التوصيل والخدمات اللوجستية","Other":"أخرى","Other attendees (optional)":"حضور آخرون (اختياري)","What should we demonstrate?":"ماذا تريد أن نعرض؟","We couldn’t save the booking. Please try again.":"تعذر حفظ الحجز. يرجى المحاولة مرة أخرى.","Confirming…":"جارٍ التأكيد…","Confirm demo":"تأكيد العرض",
  "10+ fluent languages":"أكثر من 10 لغات بطلاقة","Configurable work":"عمل قابل للتخصيص","24/7/365 execution":"تنفيذ على مدار الساعة","Improves with outcomes":"يتحسن مع النتائج","YOUR CONFIGURABLE AI WORKFORCE":"فريق ذكاء اصطناعي قابل للتخصيص","Arabic + multilingual":"العربية + لغات متعددة","English + multilingual":"الإنجليزية + لغات متعددة","Customer operations":"عمليات العملاء","Banking · Property · Collections":"الخدمات المصرفية · العقارات · التحصيل","Service orchestration":"تنسيق الخدمات","Hospitality · Scheduling · Support":"الضيافة · الجدولة · الدعم","Revenue operations":"عمليات الإيرادات","Sales · Qualification · Follow-up":"المبيعات · التأهيل · المتابعة",
  "Not a chatbot.":"ليست دردشة آلية.","An operating workforce.":"بل فريق عمل متكامل.","RoleField understands the request, takes the next action and stays accountable for the outcome. It follows up, sends reminders, updates your CRM, coordinates across systems and hands over to a person with full context when needed.":"تفهم RoleField الطلب وتتخذ الإجراء التالي وتبقى مسؤولة عن النتيجة. تتابع وترسل التذكيرات وتحدّث نظام CRM وتنسق بين الأنظمة وتحول للموظف مع كامل السياق عند الحاجة.","Always on":"دائماً متاحة","24/7/365 operations":"عمليات 24/7/365","Outcome-led":"موجهة بالنتائج","conversion and experience":"التحويل وتجربة العميل","Self-improving":"تحسن مستمر","from approved feedback":"من الملاحظات المعتمدة","WORK IN PROGRESS":"العمل الجاري","Always":"دائماً","Every task, follow-up and handover":"كل مهمة ومتابعة وتحويل","IMPACT":"الأثر","Measured":"قابل للقياس","Conversions, cost and experience":"التحويل والتكلفة والتجربة","Arabic · Customer operations":"العربية · عمليات العملاء","Follow-up completed":"اكتملت المتابعة","Hindi · Lead conversion":"الهندية · تحويل العملاء","Reminder sent":"تم إرسال التذكير","Tagalog · Service request":"التاغالوغ · طلب خدمة","Case resolved":"تم حل الحالة",
  "CONFIGURABLE BUSINESS OUTCOMES":"نتائج أعمال قابلة للتخصيص","Your task.":"مهمتك.","Your agent.":"وكيلك.","Start with these common workflows—or define your own. Roles are configurable, not limited to a catalogue.":"ابدأ بسير العمل الشائع هذا أو عرّف سيرك الخاص. الأدوار قابلة للتخصيص وليست محدودة بقائمة.","EXAMPLE WORKFLOW":"مثال لسير العمل",
  "From business outcome":"من نتيجة العمل","to continuous improvement.":"إلى التحسن المستمر.","Define the task and success measure":"حدد المهمة ومقياس النجاح","Tell RoleField what must be done, in which languages, under which rules and what a successful outcome looks like.":"حدد لـRoleField ما يجب إنجازه واللغات والقواعد وشكل النتيجة الناجحة.","Connect the complete workflow":"اربط سير العمل كاملاً","Link knowledge, CRM, calendars, payments, telephony and every system needed to finish the job.":"اربط المعرفة وCRM والتقويمات والمدفوعات والاتصالات وكل نظام مطلوب لإتمام المهمة.","Launch, measure and improve":"أطلق وقِس وحسّن","Operate 24/7/365, learn from approved feedback and outcomes, and hand over with full context whenever people are needed.":"اعمل 24/7/365 وتعلم من الملاحظات والنتائج المعتمدة وحوّل للموظفين بكامل السياق عند الحاجة.",
  "Arabic-native.":"عربي المنشأ.","Fluent across the GCC.":"يتحدث لغات الخليج بطلاقة.","RoleField is built around Arabic dialects and the GCC's diverse population. Configure one agent to move naturally between languages while retaining intent, context and workflow state.":"صُممت RoleField حول اللهجات العربية وتنوع سكان الخليج. جهّز وكيلاً واحداً للتنقل بسلاسة بين اللغات مع الحفاظ على النية والسياق وحالة سير العمل.","Russian":"الروسية","Malayalam":"المالايالامية","Bangla":"البنغالية","Hindi":"الهندية","Gujarati":"الغوجاراتية","Tagalog":"التاغالوغ","Turkish":"التركية","Urdu":"الأردية","10+ languages · One continuous customer context":"أكثر من 10 لغات · سياق عميل واحد متصل",
  "READY TO REDESIGN THE WORK?":"هل أنت جاهز لإعادة تصميم العمل؟","Give RoleField the outcome. It handles the conversations—and the work that follows.":"حدد النتيجة لـRoleField، وهي تدير المحادثات وكل العمل الذي يليها.","Multilingual autonomous AI agents for customer operations across the GCC.":"وكلاء ذكاء اصطناعي مستقلون ومتعددو اللغات لعمليات العملاء في الخليج.","1. Language":"١. اللغة","Custom task":"مهمة مخصصة","Operations":"العمليات","Human handover":"تحويل للموظف"
};
Object.assign(arabicText, {
  "ROLEFIELD CONTROL":"تحكم ROLEFIELD","● LIVE":"● مباشر","AGENT MANAGEMENT":"إدارة الوكلاء",
  "Customer operations":"عمليات العملاء","Service orchestration":"تنسيق الخدمات","Revenue operations":"عمليات الإيرادات",
  "WORKFLOW ENGINE":"محرك سير العمل","Knowledge base":"قاعدة المعرفة","Approved answers · Versioned":"إجابات معتمدة · إصدارات منظمة",
  "Rules & actions":"القواعد والإجراءات","CRM · Calendar · Follow-up":"CRM · التقويم · المتابعة",
  "Human handover":"تحويل للموظف","Context and approval intact":"السياق والموافقة محفوظان",
  "OUTCOMES & REPORTING":"النتائج والتقارير","Tasks completed":"المهام المكتملة","Average response":"متوسط الاستجابة",
  "Conversion":"التحويل","Actions logged":"الإجراءات المسجلة","Governance active":"الحوكمة مفعلة",
  "Audit trail · Permissions · QA":"سجل التدقيق · الصلاحيات · الجودة","Knowledge synced":"المعرفة متزامنة","CRM connected":"CRM متصل","Reporting live":"التقارير مباشرة",
});

const englishText = Object.fromEntries(Object.entries(arabicText).map(([en, ar]) => [ar, en]));
englishText["You’re booked."] = "Shukran. We’ll be in touch.";

function Brand() {
  return <span className="brand-lockup">
    <Image className="brand-logo" src="/rolefield-logo.png" alt="RoleField.ai" width={1527} height={406} priority />
    <small>conversations &amp; more</small>
  </span>;
}

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [menu, setMenu] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("hamdan");
  const [audioLanguage, setAudioLanguage] = useState<Record<AgentId, AudioLanguage>>({ hamdan: "ar", noura: "ar", adam: "ar" });
  const [playing, setPlaying] = useState<string | null>(null);
  const [useCase, setUseCase] = useState(0);
  const [dialect, setDialect] = useState("UAE Arabic");
  const [voice, setVoice] = useState("Warm & professional");
  const [role, setRole] = useState("Customer care");
  const [scheduler, setScheduler] = useState(false);
  const [callback, setCallback] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const t = copy[locale];
  const dateKey = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    const timer = window.setTimeout(() => setScheduler(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!scheduler && !callback) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setScheduler(false); setCallback(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [scheduler, callback]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const translate = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;
      while ((textNode = walker.nextNode())) {
        const raw = textNode.nodeValue || "";
        const value = raw.trim();
        const translated = locale === "ar" ? arabicText[value] : englishText[value];
        if (translated && !(textNode.parentElement as HTMLElement | null)?.closest("[data-no-translate]")) textNode.nodeValue = raw.replace(value, translated);
      }
    };
    translate(root);
    const observer = new MutationObserver(records => records.forEach(record => translate(record.target)));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  function openScheduler() { setCallback(false); setScheduler(true); setStep(1); setStatus("idle"); setMenu(false); }
  function openCallback() { setScheduler(false); setCallback(true); setStatus("idle"); setMenu(false); }
  async function toggleAgentAudio(agentId: AgentId, language: AudioLanguage) {
    const key = `${agentId}-${language}`;
    if (playing === key) { audioRef.current?.pause(); setPlaying(null); return; }
    audioRef.current?.pause();
    const audio = new Audio(agentAudio[agentId][language]);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    setSelectedAgent(agentId);
    setAudioLanguage(current => ({ ...current, [agentId]: language }));
    setPlaying(key);
    try { await audio.play(); } catch { setPlaying(null); }
  }
  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/demos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, date: dateKey, time: selectedTime }) });
      if (!response.ok) throw new Error(); setStatus("done");
    } catch { setStatus("error"); }
  }
  async function submitCallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/callbacks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(); setStatus("done");
    } catch { setStatus("error"); }
  }

  return <div ref={pageRef} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={locale === "ar" ? "rtl" : "ltr"}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-nav">
      <a className="brand" href="#top" aria-label="RoleField.ai home"><Brand/></a>
      <button className="menu-toggle" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}><span/><span/><span/><b>{locale === "en" ? "Menu" : "القائمة"}</b></button>
      <nav id="main-nav" className={menu ? "open" : ""} aria-label="Primary navigation">
        {["platform","agents","use-cases","languages","security"].map((id,i)=><a key={id} href={`#${id}`} onClick={()=>setMenu(false)}>{t.nav[i]}</a>)}
        <a href="/roi-calculator" onClick={()=>setMenu(false)}>ROI calculator</a>
        <a href="/login" onClick={()=>setMenu(false)}>App</a>
        <div className="mobile-nav-actions"><button data-no-translate onClick={()=>setLocale(locale === "en" ? "ar" : "en")}>{locale === "en" ? "العربية" : "English"}</button><button onClick={openScheduler}>{t.demo}</button></div>
      </nav>
      <div className="nav-actions"><button className="language-switch" data-no-translate onClick={()=>setLocale(locale === "en" ? "ar" : "en")}>{locale === "en" ? "العربية" : "English"}</button><button className="button dark compact" onClick={openScheduler}>{t.demo}</button></div>
    </header>

    <main id="main-content">

    <section className="hero technical-grid" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><i/> {t.eyebrow}</p>
        <h1>{t.title}</h1><p className="lede">{t.lede}</p>
        <div className="hero-ctas"><button className="button teal" onClick={openScheduler}>{t.demo}</button><button className="button light" onClick={openCallback}>{locale === "ar" ? "اطلب مكالمة" : "Request a callback"}</button></div>
        <p className="trust"><i/> {t.trust}</p>
        <div className="proof-points"><span>Arabic-native</span><span>10+ fluent languages</span><span>Configurable work</span><span>24/7/365 execution</span><span>Improves with outcomes</span></div>
      </div>
      <div className="hero-art"><Image src="/rolefield-gcc-office.png" alt="Isometric GCC workplace with local AI agents supporting banking, hospitality, logistics, sales and customer service" width={1692} height={929} priority sizes="(max-width: 800px) 100vw, 62vw" /></div>
    </section>

    <section className="agent-section section" id="agents">
      <header className="section-heading"><div><p className="eyebrow"><i/> YOUR CONFIGURABLE AI WORKFORCE</p><h2>{t.agentsTitle}</h2></div><p>{t.agentsText}</p></header>
      <div className="agent-grid">
        {agents.map(agent => <article key={agent.id} className={`agent-card ${selectedAgent===agent.id?"selected":""}`}>
          <div className="agent-status"><span><i/>{selectedAgent===agent.id?"SELECTED":"READY"}</span><small>{agent.language}</small></div>
          <div className="portrait"><Image className={`agent-image ${agent.id}`} src={agent.image} alt={agent.alt} width={1312} height={1285} sizes="(max-width: 700px) 80vw, 30vw" /></div>
          <div className="agent-details"><div className="agent-profile"><p>{agent.role}</p><h3>{agent.name}<small>{agent.arabic}</small></h3><span>{agent.roles}</span><div className="agent-skills" aria-label={`${agent.name}'s language skills`}><b>LANGUAGES</b><div>{agent.skills.map(skill=><span className="skill" key={skill}>{skill}</span>)}</div></div></div><div className="agent-audio"><span>HEAR {agent.name.toUpperCase()}</span><div className="audio-languages" aria-label={`Listen to ${agent.name}`}>{audioLanguages.map(language=>{const isPlaying=playing===`${agent.id}-${language.id}`;return <button key={language.id} className={`${audioLanguage[agent.id]===language.id?"active":""} ${isPlaying?"playing":""}`} onClick={()=>toggleAgentAudio(agent.id,language.id)} aria-pressed={isPlaying} aria-label={`${isPlaying?"Pause":"Listen to"} ${agent.name} in ${language.label}`}><i/>{language.short}</button>})}</div></div><div className="agent-buttons"><button onClick={()=>{setSelectedAgent(agent.id);openCallback();}}>{locale === "ar" ? "اطلب مكالمة" : "Request a callback"}</button><button onClick={()=>{setSelectedAgent(agent.id);openScheduler();}}>{locale === "ar" ? "احجز عرضاً" : "Book a demo"}</button></div></div>
          <span className="pixel-corner a"/><span className="pixel-corner b"/>
        </article>)}
        <CustomAgentBuilder onBookSession={openScheduler} />
      </div>
      <div className="workflow-orchestration" aria-label="RoleField complete customer workflow">
        <header><div><p className="eyebrow"><i/> BEYOND THE CONVERSATION</p><h3>One agent owns the <em>entire workflow.</em></h3></div><p>RoleField does not wait for a call. It finds the next customer, completes the conversation, takes the next action and keeps every system up to date.</p></header>
        <div className="workflow-rail">
          {[
            { n:"01", icon:"◎", title:"Find the next customer", text:"Reads the queue, segment and CRM context.", system:"CRM · LEAD QUEUE" },
            { n:"02", icon:"◖", title:"Call and understand", text:"Speaks naturally, qualifies intent and handles questions.", system:"VOICE · CONTEXT" },
            { n:"03", icon:"▦", title:"Schedule the demo", text:"Checks availability, books a slot and confirms it.", system:"CALENDAR · EMAIL" },
            { n:"04", icon:"↻", title:"Follow up", text:"Sends reminders and continues until the next outcome.", system:"EMAIL · WHATSAPP" },
            { n:"05", icon:"✓", title:"Complete the record", text:"Fills CRM fields, notes the outcome and alerts your team.", system:"CRM · HANDOVER" },
          ].map((step,index)=><article key={step.n}><div className="workflow-node"><span>{step.icon}</span><b>{step.n}</b></div><div><small>{step.system}</small><h4>{step.title}</h4><p>{step.text}</p></div>{index<4&&<i className="workflow-connector"/>}</article>)}
        </div>
        <footer><span><i/> Every action logged</span><span><i/> Human handover when needed</span><button onClick={openScheduler}>See your workflow in a demo <b>→</b></button></footer>
      </div>
    </section>

    <section className="platform-section" id="platform"><div className="platform-copy"><p className="eyebrow light"><i/> THE ROLEFIELD PLATFORM</p><h2>Not a chatbot.<br/>An operating workforce.</h2><p>RoleField understands the request, takes the next action and stays accountable for the outcome. It follows up, sends reminders, updates your CRM, coordinates across systems and hands over to a person with full context when needed.</p><div className="platform-facts"><div><b>Always on</b><span>24/7/365 operations</span></div><div><b>Outcome-led</b><span>conversion and experience</span></div><div><b>Self-improving</b><span>from approved feedback</span></div></div></div><div className="control-room"><div className="control-top"><span>ROLEFIELD CONTROL ROOM</span><i>● LIVE OPERATIONS</i></div><div className="control-kpis"><div><small>WORK IN PROGRESS</small><b>Always</b><span>Every task, follow-up and handover</span></div><div><small>IMPACT</small><b>Measured</b><span>Conversions, cost and experience</span></div></div><div className="conversation-rows"><p><i/><b>Arabic · Customer operations</b><span>Follow-up completed</span><em>CRM updated</em></p><p><i/><b>Hindi · Lead conversion</b><span>Qualified opportunity</span><em>Reminder sent</em></p><p><i/><b>Tagalog · Service request</b><span>Human handover</span><em>Case resolved</em></p></div></div></section>

    <section className="usecase-section section" id="use-cases"><header className="section-heading"><div><p className="eyebrow"><i/> CONFIGURABLE BUSINESS OUTCOMES</p><h2>Your task.<br/><em>Your agent.</em></h2></div><p>Start with these common workflows—or define your own. Roles are configurable, not limited to a catalogue.</p></header><div className="usecase-layout"><div className="usecase-tabs" role="tablist">{useCases.map((item,i)=><button key={item.title} role="tab" aria-selected={useCase===i} onClick={()=>setUseCase(i)}><span>{String(i+1).padStart(2,"0")}</span><b>{item.title}</b><small>{item.tag}</small></button>)}</div><article className="usecase-detail"><div className="usecase-agent"><Image src={agents.find(a=>a.id===useCases[useCase].agent)?.image || agents[0].image} alt="Selected RoleField agent" width={1312} height={1285}/></div><p className="eyebrow"><i/> EXAMPLE WORKFLOW</p><h3>{useCases[useCase].title}</h3><dl><div><dt>THE PROBLEM</dt><dd>{useCases[useCase].problem}</dd></div><div><dt>ROLEFIELD DOES</dt><dd>{useCases[useCase].action}</dd></div><div><dt>THE OUTCOME</dt><dd>{useCases[useCase].outcome}</dd></div></dl></article></div></section>

    <section className="how-section"><header><p className="eyebrow light"><i/> HOW IT WORKS</p><h2>From business outcome<br/>to continuous improvement.</h2></header><ol><li><span>01</span><div className="step-marker"><i/><i/><i/></div><h3>Define the task and success measure</h3><p>Tell RoleField what must be done, in which languages, under which rules and what a successful outcome looks like.</p></li><li><span>02</span><div className="step-marker connect"><i/><i/><i/></div><h3>Connect the complete workflow</h3><p>Link knowledge, CRM, calendars, payments, telephony and every system needed to finish the job.</p></li><li><span>03</span><div className="step-marker deploy"><i/><i/><i/></div><h3>Launch, measure and improve</h3><p>Operate 24/7/365, learn from approved feedback and outcomes, and hand over with full context whenever people are needed.</p></li></ol></section>

    <section className="language-section technical-grid" id="languages"><div className="language-intro"><p className="eyebrow"><i/> LANGUAGE INTELLIGENCE</p><h2>Arabic-native.<br/><em>Fluent across the GCC.</em></h2><p>Configure your preferred language below. Audio samples are currently available in Arabic, English and Russian.</p><div className="language-cloud" aria-label="Language availability">{[locale === "ar" ? "العربية" : "Arabic","English","Russian","Hindi","Urdu","Malayalam","Bangla","Tagalog","Turkish","Gujarati"].map(item=><button key={item} className="available" onClick={()=>setDialect(item)} aria-pressed={dialect===item}>{item}</button>)}</div><div className="arabic-sample" lang="ar" dir="rtl">أهلاً وسهلاً، كيف أقدر أساعدك اليوم؟<small>Arabic · English · Russian available to listen</small></div></div><div className="language-builder"><div className="builder-head"><span>CONFIGURE AN AGENT</span><i>● READY</i></div><fieldset><legend>1. Language</legend>{["UAE Arabic","Saudi Arabic","English","Russian","Hindi","Urdu","Malayalam","Bangla","Tagalog","Turkish","Gujarati"].map(x=><button key={x} className={dialect===x?"active":""} onClick={()=>setDialect(x)} aria-pressed={dialect===x}>{x}</button>)}</fieldset><fieldset><legend>2. Voice</legend>{["Warm & professional","Calm & reassuring","Clear & direct"].map(x=><button key={x} className={voice===x?"active":""} onClick={()=>setVoice(x)}>{x}</button>)}</fieldset><fieldset><legend>3. Role</legend>{["Customer care","Sales","Bookings","Collections","Operations","Custom task"].map(x=><button key={x} className={role===x?"active":""} onClick={()=>setRole(x)}>{x}</button>)}</fieldset><div className="builder-result"><Image src={agents.find(a=>a.id===selectedAgent)?.image || agents[0].image} alt="Configured RoleField agent" width={1312} height={1285}/><div><small>YOUR CONFIGURATION</small><b>{dialect}</b><span>{voice} · {role}</span></div></div></div></section>

    <section className="video-showcase" aria-labelledby="rolefield-video-title"><header><p className="eyebrow"><i/> SEE ROLEFIELD IN ACTION</p><h2 id="rolefield-video-title">Conversations are only the beginning.</h2><p>See how RoleField turns a customer conversation into coordinated action across the complete workflow.</p></header><div className="video-embed"><iframe id="js_video_iframe" src="https://jumpshare.com/embed/8NJ9HBAsNGtSjGx9mDtB" title="RoleField customer operations overview" loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen /></div></section>

    <section className="security-section section" id="security"><div><p className="eyebrow"><i/> ENTERPRISE CONTROL</p><h2>Regional by design.<br/><em>Secure by default.</em></h2><p>Choose UAE or Saudi hosting, control every integration and keep a reviewable record of what your agents heard, decided and did.</p><button className="button light" onClick={openScheduler}>Book a demo</button></div><div className="security-list"><article><span>01</span><div><b>In-region deployment</b><p>UAE and Saudi hosting options for customer data and recordings.</p></div></article><article><span>02</span><div><b>Private integrations</b><p>Least-privilege access to CRM, telephony and core business systems.</p></div></article><article><span>03</span><div><b>Human in control</b><p>Clear escalation rules, approval paths and conversation review.</p></div></article><article><span>04</span><div><b>Measurable governance</b><p>Outcome analytics, quality monitoring and auditable action records.</p></div></article></div></section>

    <section className="final-cta technical-grid"><div><p className="eyebrow"><i/> READY TO REDESIGN THE WORK?</p><h2>Give RoleField the outcome. It handles the conversations—and <em>the work that follows.</em></h2><div><button className="button dark" onClick={openScheduler}>Book a demo</button><button className="button light" onClick={openCallback}>Request a callback</button></div></div><div className="platform-infographic" aria-label="RoleField platform management overview"><header><div><i/><span>ROLEFIELD CONTROL</span></div><b>● LIVE</b></header><div className="platform-map"><section className="fleet-panel"><small>AGENT MANAGEMENT</small><div className="mini-agent"><Image src="/agents/hamdan.png" alt="" width={1312} height={1199}/><span><b>Hamdan</b><small>Customer operations</small></span><em>LIVE</em></div><div className="mini-agent"><Image src="/agents/noura.png" alt="" width={1224} height={1285}/><span><b>Sama</b><small>Service orchestration</small></span><em>READY</em></div><div className="mini-agent"><Image src="/agents/adam.png" alt="" width={1312} height={1199}/><span><b>Adam</b><small>Revenue operations</small></span><em>LIVE</em></div></section><section className="platform-core"><div className="core-orbit"><span>RF</span><b>WORKFLOW<br/>ENGINE</b></div><article className="module knowledge"><i>▤</i><span><b>Knowledge base</b><small>Approved answers · Versioned</small></span></article><article className="module rules"><i>⌘</i><span><b>Rules &amp; actions</b><small>CRM · Calendar · Follow-up</small></span></article><article className="module handover"><i>↗</i><span><b>Human handover</b><small>Context and approval intact</small></span></article></section><section className="outcome-panel"><small>OUTCOMES &amp; REPORTING</small><div className="outcome-kpi"><span><b>92%</b><small>Tasks completed</small></span><i style={{"--value":"92%"} as React.CSSProperties}/></div><div className="outcome-kpi"><span><b>31 sec</b><small>Average response</small></span><i style={{"--value":"68%"} as React.CSSProperties}/></div><div className="outcome-grid"><span><b>↑ 24%</b><small>Conversion</small></span><span><b>100%</b><small>Actions logged</small></span></div><div className="governance"><i>✓</i><span><b>Governance active</b><small>Audit trail · Permissions · QA</small></span></div></section></div><footer><span><i/> Knowledge synced</span><span><i/> CRM connected</span><span><i/> Reporting live</span></footer></div></section>
    </main>

    <footer><div className="footer-main"><div><a className="brand" href="#top" aria-label="RoleField.ai home"><Brand/></a><p className="footer-tagline">conversations &amp; more</p><small>A company by AI7Lab, UAE.</small></div><div><b>EXPLORE</b><a href="#platform">Platform</a><a href="#agents">Agents</a><a href="/about">About us</a><a href="/partnerships">Partnerships</a><a href="/roi-calculator">ROI calculator</a></div><div><b>GET STARTED</b><button onClick={openScheduler}>Book a demo</button><button onClick={openCallback}>Request a callback</button><a href="/contact">Contact</a></div><div><b>CONTACT</b><a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a><p>DIFC, Dubai, UAE</p><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RoleField</span><span>Built in the UAE for the GCC</span></div></footer>

    {scheduler && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setScheduler(false)}><div className="scheduler" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><button className="close" onClick={()=>setScheduler(false)} aria-label={locale === "ar" ? "إغلاق" : "Close"}>×</button>{status==="done"?<div className="success"><span>✓</span><p className="eyebrow">DEMO CONFIRMED</p><h2>You’re booked.</h2><p>{locale === "ar" ? `حجزنا لك موعداً الساعة ${selectedTime} بتوقيت الخليج يوم ${selectedDate.toLocaleDateString("ar-AE",{weekday:"long",day:"numeric",month:"long"})}. سيتواصل معك أحد مختصي RoleField بتفاصيل الاجتماع.` : `We’ve reserved ${selectedTime} Gulf time on ${selectedDate.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}. A RoleField specialist will contact you with the meeting details.`}</p><button className="button dark" onClick={()=>setScheduler(false)}>Done</button></div>:<><p className="eyebrow"><i/> BOOK A ROLEFIELD DEMO</p><h2 id="schedule-title">Choose a time to explore your customer workflow.</h2><p className="modal-lede">30 minutes with our UAE team · English or Arabic</p>{step===1?<div className="slot-picker"><label>Select a date</label><div className="dates">{dates.map(d=><button key={d.toISOString()} className={d.toDateString()===selectedDate.toDateString()?"selected":""} onClick={()=>setSelectedDate(d)}><small>{d.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB",{weekday:"short"})}</small><b>{d.getDate()}</b><span>{d.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB",{month:"short"})}</span></button>)}</div><label>Select a time <small>Gulf Standard Time (UTC+4)</small></label><div className="times">{slots.map(x=><button key={x} className={x===selectedTime?"selected":""} onClick={()=>setSelectedTime(x)}>{x}</button>)}</div><button className="button dark continue" onClick={()=>setStep(2)}>Continue <span>→</span></button></div>:<form onSubmit={submitDemo}><button type="button" className="back" onClick={()=>setStep(1)}>← Change time</button><div className="chosen"><b>{selectedDate.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB",{weekday:"long",day:"numeric",month:"long"})}</b><span>{selectedTime} GST · 30 minutes</span></div><div className="form-grid"><label>Your name<input name="name" required autoComplete="name" maxLength={120}/></label><label>Work email<input name="email" type="email" required autoComplete="email" maxLength={200}/></label><label>Company<input name="company" required autoComplete="organization" maxLength={160}/></label><label>Phone<input name="phone" type="tel" required autoComplete="tel" placeholder="+971" maxLength={40}/></label><label>Preferred language<select name="language"><option>English</option><option>العربية (Arabic)</option><option>Both</option></select></label><label>Primary use case<select name="useCase"><option>Customer service</option><option>Collections</option><option>Booking & scheduling</option><option>Sales qualification</option><option>Delivery & logistics</option><option>Other</option></select></label><label className="full">Other attendees (optional)<input name="attendees" placeholder="colleague@company.com" maxLength={500}/></label><label className="full">What should we demonstrate?<textarea name="notes" rows={3} maxLength={3000} placeholder={locale === "ar" ? "أخبرنا عن سير عمل المكالمات الذي تريد أتمتته." : "Tell us about the call workflow you want to automate."}/></label></div>{status==="error"&&<p className="form-error" role="alert">We couldn’t save the booking. Please try again or email <a href="mailto:voice@ai7lab.net">voice@ai7lab.net</a>.</p>}<p className="form-privacy">By confirming, you agree that RoleField may contact you about this request. See our <a href="/privacy">Privacy Notice</a>.</p><button className="button dark submit" disabled={status==="saving"}>{status==="saving"?"Confirming…":"Confirm demo"}</button></form>}</>}</div></div>}
    {callback && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setCallback(false)}><div className="scheduler callback-modal" role="dialog" aria-modal="true" aria-labelledby="callback-title"><button className="close" onClick={()=>setCallback(false)} aria-label={locale === "ar" ? "إغلاق" : "Close"}>×</button>{status==="done"?<div className="success"><span>✓</span><p className="eyebrow">CALLBACK REQUESTED</p><h2>We’ll call you.</h2><p>A RoleField specialist will contact you during your preferred time window.</p><button className="button dark" onClick={()=>setCallback(false)}>Done</button></div>:<><p className="eyebrow"><i/> REQUEST A CALLBACK</p><h2 id="callback-title">Let’s talk about your use case.</h2><p className="modal-lede">Leave your details and our UAE team will call you back.</p><form onSubmit={submitCallback}><div className="form-grid"><label>Your name<input name="name" required autoComplete="name"/></label><label>Work email<input name="email" type="email" required autoComplete="email"/></label><label>Company<input name="company" required autoComplete="organization"/></label><label>Phone<input name="phone" type="tel" required autoComplete="tel" placeholder="+971"/></label><label>Preferred language<select name="language"><option>English</option><option>العربية (Arabic)</option><option>Both</option></select></label><label>Best time to call<select name="callbackWindow"><option>Morning (09:00–12:00 GST)</option><option>Afternoon (12:00–16:00 GST)</option><option>Evening (16:00–19:00 GST)</option><option>Any time</option></select></label><label className="full">Primary use case<select name="useCase"><option>Customer service</option><option>Collections</option><option>Booking & scheduling</option><option>Sales qualification</option><option>Delivery & logistics</option><option>Other</option></select></label><label className="full">How can we help?<textarea name="notes" rows={3} placeholder="Tell us briefly what you would like to discuss."/></label></div>{status==="error"&&<p className="form-error">We couldn’t save your request. Please try again.</p>}<button className="button dark submit" disabled={status==="saving"}>{status==="saving"?"Sending…":"Request callback"}</button></form></>}</div></div>}
  </div>;
}
