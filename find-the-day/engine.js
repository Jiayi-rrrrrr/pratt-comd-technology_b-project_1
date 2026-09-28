/* ============================================================================
   engine.js — THE MECHANISM  (v3 — final combined prototype)
   ----------------------------------------------------------------------------
   Week 3 shipped two surfaces over this same file:
       Version 1  legible   — the decision tree, spoken in the tree's own words
       Version 2  obscured  — a stranger in a DM, asking the same questions

   Week 4 keeps ONE surface (the conversation) and gives back ONE thing from
   Version 1: a visible field of candidate days that gains resolution as the
   system learns. The rule is still hidden. The state is not.

       a field of candidate days
         → each answer removes days from the field
           → what is left decides the outcome

   WHAT CHANGED IN v3
   ------------------------------------------------------------------------
   1. A message is no longer "one sentence = one answer".
      read() pulls every signal out of a single message at once:
          time        2025 · last winter · August 21 · around March
          structure   single moment / a period
          represent.  is there a day that stands for it
          certainty   definitely / i think / not sure
          context     cold, a coat, school break, a weekend, snow, bare trees
      A NAMED DAY OUTRANKS EVERYTHING, including whatever was just asked.

   2. Not matching the offered options is no longer a failure.
      Each option carries a loose `hint`. When the strict match misses but a
      hint lands, the system does not decide — it PROPOSES a reading
      ("sounds more like it built up over time?") and waits to be confirmed
      or corrected. Saying no to a two-option question is itself information:
      the system flips to the other branch and records that it inferred it
      from a negation rather than from evidence.

   3. field() exposes the candidate set so the interface can draw it
      without ever naming the rule that produced it.

   Three outcomes, the same three as the Week 1 decision tree:
       A  EXACT DATE            one day is actually identified
       B  SELECTED DATE         a representative day chosen from what is left
       C  CANNOT BE REPRESENTED no single day belongs to this experience
   ========================================================================== */

window.DateSystem = (function () {

const MONTHS   = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
const SHORT    = MONTHS.map(m => m.slice(0,3));
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ALL      = [0,1,2,3,4,5,6,7,8,9,10,11];
const Y        = new Date().getFullYear();
const YEAR_FLOOR = Y - 3;          /* the field the strip shows on opening */

const not   = ms => ALL.filter(m => !ms.includes(m));
const inter = (a,b) => a.filter(m => b.includes(m));
const monthList = ms => ms.length===12 ? "any month"
  : ms.length===0 ? "nothing"
  : ms.map(m=>SHORT[m]).join(", ");
const prettyDay = e => e ? `${MONTHS[e.month]} ${e.day}, ${e.year}` : "";

/* ---- free-text readers -------------------------------------------------- */
const IDK = /\b(i don'?t know|idk|dunno|no idea|not sure|can'?t remember|don'?t remember|no clue|unsure|hard to say|either way|no memory)\b|不记得|不知道|不确定|忘了/i;
const YES = /\b(yes|yeah|yep|yup|ya|ye|definitely|for sure|certainly|true|correct|right|i think so|probably|i was|it was|we were|there was|i did|we did|sure)\b|^(对|是|嗯|有)/i;
const NO  = /\b(no|nope|nah|not really|not at all|not exactly|not quite|wasn'?t|weren'?t|didn'?t|doesn'?t|never|none|other way)\b|^(不|没|沒)/i;

const HEDGE = /\b(maybe|i think|probably|possibly|around|roughly|about|might|may have|could have|could be|sometime|somewhere|not sure|guess|guessing|ish|or so|something like|pretty sure)\b|大概|可能|好像|大约/i;
const SURE  = /\b(definitely|for sure|certain|i'?m sure|100%|absolutely|no doubt|i know it was|exactly|i remember because)\b|确定|肯定/i;

const SEASON_WORDS = [
  { months:[5,6,7],  words:/\b(summer|midsummer)\b|夏天?/i,  say:"summer" },
  { months:[11,0,1], words:/\b(winter|midwinter)\b|冬天?/i,  say:"winter" },
  { months:[2,3,4],  words:/\b(spring|springtime)\b|春天?/i, say:"spring" },
  { months:[8,9,10], words:/\b(autumn|the fall|fall of)\b|秋天?/i, say:"autumn" }
];

/* what a described scene gives away about the time of year.
   this is not general understanding — it is a short list of things people
   actually name when they describe a photograph. when it hits, it hits hard,
   and the system says which word it used, so the person can overrule it. */
const SCENE = [
  { re:/\b(lambs?|chicks?|ducklings?|easter|baby (animals|birds|goats))\b|小羊|复活节/i,
    months:[2,3,4], say:"a lamb — that puts it in the spring" },
  { re:/\b(blossoms?|cherry blossom|tulips?|daffodils?|buds|magnolia)\b|樱花|开花/i,
    months:[2,3], say:"blossom — so march, april" },
  { re:/\b(beach|swimming|the pool|sunburn|sunburnt|ice ?cream|camping|festival)\b|海边|游泳/i,
    months:[5,6,7], say:"that's the summer" },
  { re:/\b(pumpkins?|halloween|costumes?)\b|万圣节/i,
    months:[9], say:"halloween — october" },
  { re:/\b(thanksgiving)\b|感恩节/i, months:[10], say:"thanksgiving — november" },
  { re:/\b(christmas|xmas|new year'?s eve|advent|the tree lights)\b|圣诞|过年/i,
    months:[11,0], say:"christmas — december, january" },
  { re:/\b(graduation|graduated|commencement|cap and gown)\b|毕业/i,
    months:[4,5], say:"graduation — may, june" },
  { re:/\b(fireworks|fourth of july|4th of july|independence day)\b|烟花/i,
    months:[6], say:"fireworks — july" },
  { re:/\b(valentine)\b|情人节/i, months:[1], say:"valentine's — february" },
  { re:/\b(first day of (school|class)|back to school|orientation|move-?in day)\b|开学/i,
    months:[7,8], say:"start of term — august, september" },
  { re:/\b(snowman|sledding|sledging|ice skating|snowball)\b|堆雪人/i,
    months:[11,0,1], say:"snow like that is deep winter" },
  { re:/\b(fallen leaves|foliage|apple picking|pumpkin patch)\b|落叶/i,
    months:[9,10], say:"that's the autumn" }
];
function readScene(text){
  const t = String(text||"");
  const hit = SCENE.find(x => x.re.test(t));
  return hit ? { months:hit.months.slice(), say:hit.say } : null;
}

/* relative years, the way people actually say them */
const REL_YEARS = [
  { re:/\b(this year)\b|今年/i,                         span:()=>[Y,Y],     say:"this year" },
  { re:/\b(last year)\b|去年/i,                         span:()=>[Y-1,Y-1], say:"last year" },
  { re:/\b(two years ago|the year before last)\b|前年/i, span:()=>[Y-2,Y-2], say:"two years ago" },
  { re:/\b(three years ago)\b/i,                        span:()=>[Y-3,Y-3], say:"three years ago" },
  { re:/\b(four years ago)\b/i,                         span:()=>[Y-4,Y-4], say:"four years ago" },
  { re:/\b(five years ago)\b/i,                         span:()=>[Y-5,Y-5], say:"five years ago" }
];

/* ---- date parsing, for when someone actually names a day ---------------- */
const MONTH_RE = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

function monthIndex(word){
  return SHORT.findIndex(s => s.toLowerCase() === String(word).slice(0,3).toLowerCase());
}

function parseDate(text){
  const t = String(text);
  let m = t.match(new RegExp("\\b(" + MONTH_RE + ")\\b\\.?\\s*(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?\\s*((?:19|20)\\d{2})?","i"));
  if(m) return { month:monthIndex(m[1]), day:+m[2], year:m[3]?+m[3]:null };

  m = t.match(new RegExp("\\b(\\d{1,2})(?!\\d)\\s*(?:st|nd|rd|th)?\\s+(?:of\\s+)?(" + MONTH_RE + ")\\b\\.?,?\\s*((?:19|20)\\d{2})?","i"));
  if(m) return { month:monthIndex(m[2]), day:+m[1], year:m[3]?+m[3]:null };

  m = t.match(/\b((?:19|20)\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if(m) return { year:+m[1], month:+m[2]-1, day:+m[3] };

  m = t.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.]((?:19|20)\d{2})\b/);
  if(m) return { year:+m[3], month:+m[1]-1, day:+m[2] };

  m = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if(m) return { year:+m[1], month:+m[2]-1, day:+m[3] };

  return null;
}

function validDate(d){
  if(!d) return null;
  if(d.month<0 || d.month>11) return null;
  if(d.day<1 || d.day>31) return null;
  if(d.year && (d.year<1900 || d.year>Y+1)) return null;
  return d;
}

/* ===========================================================================
   read() — everything one message is carrying, all at once
   =========================================================================== */
function read(text){
  const t = String(text||"");
  const sig = {
    raw:t, hedged:HEDGE.test(t), sure:SURE.test(t), idk:IDK.test(t),
    date:null, year:null, month:null, months:null,
    structure:null, representative:null, context:[], say:[]
  };
  sig.certainty = sig.idk ? "unsure" : sig.sure ? "sure" : sig.hedged ? "hedge" : null;

  /* explicit year */
  const yr = t.match(/\b((?:19|20)\d{2})\b/);
  if(yr && +yr[1] <= Y+1){ sig.year = +yr[1]; sig.say.push(String(sig.year)); }

  /* "18 years ago" — any number, not just the four the options offered.
     this used to fall through as unreadable, which is the opposite of the
     point: the person gave a harder number than the question asked for. */
  const ago = t.match(/\b(\d{1,3})\s*(?:\+|or so|ish)?\s*years?\s*(?:ago|back)\b/i)
           || t.match(/(\d{1,3})\s*年\s*前/);
  if(ago && sig.year===null){
    const n = +ago[1];
    if(n>=0 && n<=120){ sig.year = Y - n; sig.say.push(`${n} years ago`); }
  }
  const moAgo = t.match(/\b(\d{1,3})\s*months?\s*ago\b/i);
  if(moAgo && sig.year===null && sig.month===null){
    const back = new Date(Y, new Date().getMonth() - (+moAgo[1]), 1);
    sig.year = back.getFullYear();
    sig.month = back.getMonth();
    sig.say.push(`${moAgo[1]} months ago`);
  }

  /* a whole day, named. this outranks everything else in the message. */
  const d = validDate(parseDate(t));
  if(d){
    if(!d.year && sig.year) d.year = sig.year;
    sig.date = d;
    sig.say = [ (SHORT[d.month] + " " + d.day + (d.year? ", "+d.year : "")) ];
    return sig;                                  /* nothing else can outrank it */
  }

  /* a month on its own */
  const mo = t.match(new RegExp("\\b(" + MONTH_RE + ")\\b\\.?","i"));
  if(mo){
    const idx = monthIndex(mo[1]);
    if(idx>=0){ sig.month = idx; sig.say.unshift(MONTHS[idx]); }
  }

  /* a season */
  const se = SEASON_WORDS.find(x => x.words.test(t));
  if(se && sig.month===null){ sig.months = se.months; sig.say.unshift(se.say); }

  /* a relative year — "last winter" is a season AND a year */
  const rel = REL_YEARS.find(x => x.re.test(t));
  if(rel && sig.year===null){
    const sp = rel.span();
    sig.year = sp[0];
    sig.say.push(rel.say);
  } else if(sig.year===null && se && /\blast\b|去年/i.test(t)){
    sig.year = se.say==="winter" ? Y-1 : Y-1;
    sig.say.push("last " + se.say);
  }

  /* the shape of the event, when it is volunteered rather than asked.
     only the unmistakable wordings count here — the loose `hint` readings
     are never applied behind the person's back, they are proposed. */
  for(const o of Q.moment_or_period.opts)
    if(o.vol && o.vol.test(t)) sig.structure = o.v;

  /* "there's no one day" — said while another question was on the table */
  for(const o of Q.representative.opts)
    if(o.vol && o.vol.test(t)) sig.representative = o.v;

  sig.say = sig.say.filter((x,i)=>sig.say.indexOf(x)===i);

  /* someone naming the thing that pins the day, before being asked for it */
  if(/\b(?:a |the |my )?(photos?|pictures?|screenshots?|tickets?|receipts?|birthdays?|anniversar(?:y|ies)|deadlines?|messages?|texts?|emails?)\b|照片|票|生日/i.test(t)
     && !/\b(no|not|without|don'?t have|didn'?t take|there'?s no)\b/i.test(t))
    sig.anchor = anchorKindOf(t);

  /* the message is *about* time, even if nothing new came out of it.
     used to answer "you already told me that" instead of "i can't tell". */
  sig.timeish = /\b(year|years|month|months|week|weeks|ago|back then|around|winter|summer|spring|autumn|fall)\b|年|月|前/i.test(t);

  /* context clues that belong to questions nobody has asked yet */
  for(const id of NARROW_IDS){
    const q = Q[id];
    const hits = (q.opts||[]).filter(o => o.ctx && o.ctx.test(t));
    if(hits.length === 1) sig.context.push({ id, v:hits[0].v, say:hits[0].say });
  }

  return sig;
}

/* a plain yes / no, used when the system has proposed a reading.
   if the message carries real information instead, this returns null and the
   message is read properly rather than taken as a vote. */
function verdict(text){
  const t = String(text||"");
  const s = read(t);
  if(s.date || s.month!==null || s.months || s.year!==null || s.context.length) return null;
  const y = YES.test(t), n = NO.test(t);
  if(n && !y) return "no";
  if(y && !n) return "yes";
  return null;
}

/* ===========================================================================
   THE QUESTIONS
     .node  how Version 1 said it        .chat  how the stranger says it
     .match strict reading of an answer  .hint  loose reading → only a proposal
     .ctx   the words that give this away when nobody asked
   =========================================================================== */
const Q = {

/* --- structural: the shape of the Week 1 tree --------------------------- */

has_date: {
  kind:"structural",
  node:"Does this experience have a specific date?",
  chat:["do you know the actual date of it", "or is the date the part that's gone"],
  opts:[
    { v:"yes", label:"Yes — I know the date",
      match:/\b(yes|yeah|i know it|i know the date|i do|i remember the date|it was on)\b/i,
      hint:/\b(i have it|written down|in my (phone|calendar|photos)|i could look)\b/i,
      guess:"so you do have the date somewhere?",
      say:"knows the date",
      apply:s => s.next="the_date" },
    { v:"no", label:"No — that's what I've lost", idkFallback:true,
      match:/\b(no|nope|i don'?t|that'?s the part|lost|not really|no idea)\b/i,
      hint:/\b(gone|never knew|wish i|that'?s why|somewhere around|only that)\b/i,
      guess:"so the date itself is the part that's gone?",
      say:"does not know the date",
      apply:s => s.next="moment_or_period" }
  ],
  fallback:"sorry — do you know the date, or not"
},

the_date: {
  kind:"date",
  node:"Record the stated date.",
  chat:["what was it"],
  fallback:"what date though — month and day is enough"
},

date_covers: {
  kind:"structural",
  node:"Can this date adequately represent the whole experience?",
  chat:["and that one day covers the whole thing", "or was it bigger than that day"],
  opts:[
    { v:"yes", label:"Yes — that day is the experience",
      match:/\b(yes|yeah|that'?s it|it does|covers it|just that day|only that day)\b/i,
      hint:/\b(that'?s all|nothing before|nothing after|one day|the whole thing was)\b/i,
      guess:"so that day is the whole of it?",
      say:"the day covers the whole experience",
      apply:s => { s.outcome="A"; s.next=null; } },
    { v:"no", label:"No — it was bigger than that day", idkFallback:true,
      match:/\b(no|bigger|longer|more than|went on|whole|months|weeks|years|a while)\b/i,
      hint:/\b(before that|after that|leading up|part of|not just)\b/i,
      guess:"so that day is only part of it?",
      say:"bigger than one day — treat as a period",
      apply:s => { s.kind="period"; s.exact=null; s.offered=false;
                   s.pendingStructural="representative"; s.next="narrow"; } }
  ],
  fallback:"does that one day cover it, or was it bigger than that"
},

moment_or_period: {
  kind:"structural",
  node:"Is this experience closer to a single moment or a period of time?",
  chat:["was there one particular day when it happened",
        "or did it come on gradually"],
  opts:[
    { v:"moment", label:"A single moment",
      match:/\b(one day|a day|particular|single|specific|moment|that day|it happened|sudden|suddenly|once|right then|instantly)\b|一天|某天/i,
      hint:/\b(i was (standing|sitting|walking)|i remember (the|that)|the second|as soon as|the minute|that afternoon|that night|that morning)\b/i,
      vol:/\b(one (specific|particular) day|there was one day|a single day|it happened on)\b|某一天/i,
      guess:"sounds like there was one actual day it happened?",
      say:"a single moment",
      apply:s => { s.kind="moment"; s.next="narrow"; } },
    { v:"period", label:"A period of time",
      match:/\b(gradual|gradually|slowly|over time|over the years|period|a while|months|weeks|years|little by little|gotten used|kept)\b|渐渐|慢慢|一直|好几个月/i,
      hint:/\b(didn'?t notice|at some point|eventually|by the time|used to it|got used|started to|stopped being|somehow|before i knew|piled up|built up|one of those things)\b/i,
      vol:/\b(gradually|over the course of|over months|over years|little by little|it was a whole (period|stretch))\b|渐渐|慢慢/i,
      guess:"sounds more like it built up over time?",
      say:"a period of time",
      apply:s => { s.kind="period"; s.pendingStructural="representative"; s.next="narrow"; } },
    { v:"unknown", label:"I can't tell",
      match:IDK, say:"cannot tell which",
      apply:s => { s.kind="period"; s.unknowns++; s.pendingStructural="representative"; s.next="narrow"; } }
  ],
  fallback:"one day, or more of a slow thing"
},

representative: {
  kind:"structural",
  node:"Is there a moment that could represent this period?",
  chat:["if you had to point at one day where it was most true",
        "is there one"],
  opts:[
    { v:"yes", label:"Yes — one moment stands for it",
      match:/\b(yes|yeah|there is|i think so|probably|maybe there|the day (i|we)|when i|when we)\b/i,
      hint:/\b(the time (i|we)|that night|that morning|the first time|the last time|i'?d say)\b/i,
      guess:"so there is one day you'd point at?",
      say:"one moment can stand for the period",
      apply:s => { s.hasRepresentative=true; s.next="narrow"; } },
    { v:"no", label:"No — no day stands for it",
      match:/\b(no|nope|not really|nothing|there isn'?t|there'?s no|can'?t|cannot|couldn'?t|don'?t think i can|can'?t (choose|pick|name|say)|no single|not one|it wasn'?t like that)\b|选不出|没有那样一天/i,
      hint:/\b(all of it|every day|the whole|any of them|none of them|equally|spread|it was just)\b/i,
      vol:/\b(no single day|not one day|there'?s no one day|there isn'?t one day|no one day stands|can'?t pick one day|can'?t choose one day)\b|没有哪一天|选不出/i,
      guess:"sounds like no one day stands for it?",
      say:"no moment can stand for the period",
      apply:s => { s.hasRepresentative=false; s.outcome="C"; s.reason="period-no-moment"; s.next=null; } },
    { v:"unknown", label:"I don't know",
      match:IDK, say:"unknown",
      apply:s => { s.unknowns++; s.hasRepresentative=false; s.outcome="C"; s.reason="period-no-moment"; s.next=null; } }
  ],
  fallback:"is there one day that stands for it, or not really"
},

specific_day: {
  kind:"structural",
  node:"Can you identify a specific day?",
  chat:["is there anything that pins it to one day",
        "a ticket, a photo, somebody's birthday, a deadline"],
  opts:[
    { v:"yes", label:"Yes — I can name the day",
      match:/\b(yes|yeah|there is|i think so|my birthday|a photo|the photo|ticket|receipt|it was the|it was on)\b/i,
      hint:/\b(i could check|it'?s in my|somewhere|screenshot|message|text)\b/i,
      guess:"so there is something that fixes the day?",
      say:"can name the day",
      apply:s => s.next="anchor_what" },
    { v:"no", label:"No — nothing pins it",
      match:/\b(no|nope|not really|nothing|there isn'?t|there'?s no|i can'?t|cannot|don'?t think i can|no photo|no ticket)\b|^(没有|不行)/i,
      hint:/\b(wish i did|nothing like that|i didn'?t (take|keep)|gone)\b/i,
      guess:"nothing that fixes it to a day, then?",
      say:"nothing identifies one day",
      apply:s => { s.next=null; } },
    { v:"unknown", label:"I don't know", match:IDK, say:"unknown",
      apply:s => { s.unknowns++; s.next=null; } }
  ],
  fallback:"anything that fixes it to one day? a photo, a birthday"
},

/* The thing they named — a photo, a ticket, a birthday — is not just a
   pointer to a date. It is the only piece of the memory they volunteered
   without being squeezed for it. Asking about it is the difference between
   a system that is interviewing you and one that is listening to you.
   It also pays: a described scene often carries the month. */
anchor_what: {
  kind:"open",
  node:"Ask about the thing that pins the day, and read the scene for time.",
  chat:["what is it"],
  fallback:"anything about it — what's in it"
},

the_day: {
  kind:"date",
  node:"Record the identified day.",
  chat:["does the date come with it", "even roughly — month and day"],
  fallback:"what was the date — month and day"
},

/* --- narrowing: these are what actually move the field ------------------ */

how_long_ago: {
  kind:"narrow", weight:4,
  node:"Approximately how long ago did it happen?",
  chat:["roughly how long ago was this"],
  opts:[
    { v:"this", label:"This year",
      match:/\b(this year|a few months|couple of months|recently|recent|months ago)\b|今年/i,
      ctx:/\b(this year)\b|今年/i,
      say:"this year", years:[Y,Y] },
    { v:"one", label:"About a year ago",
      match:/\b(last year|a year|one year|about a year)\b|去年/i,
      ctx:/\b(last year)\b|去年/i,
      say:"about a year ago", years:[Y-1,Y-1] },
    { v:"few", label:"Two or three years",
      match:/\b(two|three|2|3|couple of years|few years)\b|前年|两三年/i,
      ctx:/\b(two years ago|three years ago|a couple of years ago)\b|前年/i,
      say:"two to three years ago", years:[Y-3,Y-2] },
    { v:"long", label:"Longer than that",
      match:/\b(longer|more than|four|five|six|a long time|years and years|college|high school)\b|好久|很久/i,
      ctx:/\b(years and years|back in (college|school|high school))\b/i,
      say:"longer than three years", years:[Y-6,Y-4] },
    { v:"unknown", label:"No idea", match:IDK, say:"no idea", years:null }
  ],
  hintAll:true,
  fallback:"a rough guess is fine. this year? a few years?"
},

coat: {
  kind:"narrow", weight:3,
  node:"Was the weather cold? (coat / no coat)",
  chat:["do you remember what you were wearing", "was it cold enough for a coat"],
  opts:[
    { v:"yes", label:"Coat weather", match:YES,
      ctx:/\b(coat|jacket|parka|puffer|scarf|gloves|freezing|so cold|it was cold|bundled|hood)\b|冷|外套/i,
      hint:/\b(cold|chilly|shivering|heating)\b/i, guess:"so it was cold?",
      say:"cold — coat weather", months:[10,11,0,1,2] },
    { v:"no",  label:"No coat", match:NO,
      ctx:/\b(t-?shirt|shorts|sandals|no coat|didn'?t need a coat|warm out|sweating)\b/i,
      hint:/\b(mild|fine out|nice out|warm)\b/i, guess:"so, not coat weather?",
      say:"not cold", months:[3,4,5,6,7,8,9] },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"coat, or no coat"
},

hot: {
  kind:"narrow", weight:3,
  node:"Was it hot? (sweating / air conditioning)",
  chat:["was it hot enough to be uncomfortable", "ac on, or windows open"],
  opts:[
    { v:"yes", label:"Hot", match:YES,
      ctx:/\b(so hot|boiling|heat ?wave|sweating|air ?con|a\/?c was on|humid)\b|很热|空调/i,
      hint:/\b(hot|stifling|muggy)\b/i, guess:"so it was hot?",
      say:"hot", months:[5,6,7,8] },
    { v:"no",  label:"Not hot", match:NO,
      ctx:/\b(not hot|wasn'?t hot|cool out|cold)\b/i,
      hint:/\b(cool|cold|fine)\b/i, guess:"so, not hot?",
      say:"not hot", months:not([5,6,7]) },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"hot or not hot"
},

dark_early: {
  kind:"narrow", weight:2,
  node:"Was it getting dark early?",
  chat:["was it already getting dark early that day"],
  opts:[
    { v:"yes", label:"Dark early", match:YES,
      ctx:/\b(dark (early|by)|already dark|dark at|pitch black|street ?lights were on)\b|天黑得早/i,
      hint:/\b(dark|evening|night)\b/i, guess:"so it was dark early?",
      say:"dark early", months:[8,9,10,11,0,1] },
    { v:"no",  label:"Still light", match:NO,
      ctx:/\b(still light|light out|bright|sun was still|long evening)\b/i,
      hint:/\b(light|bright|sunny)\b/i, guess:"so it was still light?",
      say:"light late", months:[3,4,5,6,7] },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"was it dark early, or still light"
},

school: {
  kind:"narrow", weight:2,
  node:"Where was it in the school/work year?",
  chat:["were you in classes then", "or was it a break"],
  opts:[
    { v:"session", label:"Term in session",
      match:/\b(in classes|classes|in session|semester|term|midterm|studying|lectures|school had started|started already|during term)\b|上课|开学/i,
      ctx:/\b(midterms?|finals|semester|in class(es)?|lectures|deadline|crit|studio)\b|上课|开学/i,
      hint:/\b(school|work|busy)\b/i, guess:"you were in classes then?",
      say:"term in session", months:[8,9,10,1,2,3,4] },
    { v:"break", label:"On a break",
      match:/\b(break|vacation|holiday|off|summer break|winter break|not in class|no classes)\b|放假|暑假|寒假/i,
      ctx:/\b(spring break|summer break|winter break|school break|on vacation|holidays)\b|放假|暑假|寒假/i,
      hint:/\b(break|off|away)\b/i, guess:"that was during a break?",
      say:"on a break", months:[5,6,7,11,0] },
    { v:"unknown", label:"Doesn't apply / don't remember",
      match:/\b(n\/?a|doesn'?t apply|not a student|i wasn'?t)\b/i, say:"unknown", months:null }
  ],
  fallback:"in classes, or on a break"
},

trees: {
  kind:"narrow", weight:1.5,
  node:"What state were the trees / plants in?",
  chat:["anything about how outside looked", "bare trees, turning, blossom, full green"],
  opts:[
    { v:"bare", label:"Bare", match:/\b(bare|no leaves|dead|empty|nothing on)\b|光秃/i,
      ctx:/\b(bare trees|no leaves|branches were bare)\b|光秃/i,
      say:"bare trees", months:[11,0,1,2] },
    { v:"turning", label:"Turning colour",
      match:/\b(turning|orange|yellow|red|falling|autumn|fall colou?r)\b|落叶|变黄/i,
      ctx:/\b(leaves (were )?(turning|falling)|fall colou?rs?)\b|落叶/i,
      say:"leaves turning", months:[9,10] },
    { v:"blossom", label:"Blossom / new green",
      match:/\b(blossom|bloom|flower|flowers|new green|buds|spring)\b|开花|花/i,
      ctx:/\b(blossom|in bloom|cherry blossom|buds)\b|开花/i,
      say:"blossom", months:[3,4] },
    { v:"green", label:"Full green",
      match:/\b(green|full|leafy|lush|leaves were out|everything was green)\b|绿/i,
      ctx:/\b(everything was green|full green|leafy|lush)\b/i,
      say:"full green", months:[4,5,6,7,8] },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"bare, turning, blossom or green — any of those"
},

snow: {
  kind:"narrow", weight:2, only:s => inter(s.months,[10,11,0,1,2]).length>0,
  node:"Was there snow or ice?",
  chat:["was there snow on the ground"],
  opts:[
    { v:"yes", label:"Snow / ice", match:YES,
      ctx:/\b(snow|snowing|snowed|ice|icy|slush|salt on the)\b|下雪|雪/i,
      say:"snow on the ground", months:[11,0,1,2] },
    { v:"no",  label:"No snow", match:NO,
      ctx:/\b(no snow|hadn'?t snowed)\b/i,
      say:"no snow", months:not([11,0,1]) },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"snow or no snow"
},

weekend: {
  kind:"narrow", weight:1, days:true,
  node:"Weekday or weekend?",
  chat:["weekday or weekend, do you think"],
  opts:[
    { v:"weekend", label:"Weekend",
      match:/\b(weekend|saturday|sunday|sat|sun|day off)\b|周末|星期六|星期天/i,
      ctx:/\b(weekend|saturday|sunday|day off|wasn'?t working)\b|周末|星期六|星期天/i,
      say:"weekend", weekend:true },
    { v:"weekday", label:"Weekday",
      match:/\b(weekday|week ?day|monday|tuesday|wednesday|thursday|friday|work|working|class|school day)\b|工作日|平日/i,
      ctx:/\b(weekday|monday|tuesday|wednesday|thursday|friday|after work|before work|at work|school day)\b|工作日|平日/i,
      say:"weekday", weekend:false },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", weekend:null }
  ],
  fallback:"weekday or weekend"
},

before_after: {
  kind:"narrow", weight:2, only:s => s.anchor,
  node:"Before or after the anchor event named in the post?",
  chat:["was this before or after you moved"],
  opts:[
    { v:"before", label:"Before", match:/\b(before|prior|earlier|ahead of)\b|之前/i,
      say:"before the anchor", half:"early" },
    { v:"after", label:"After", match:/\b(after|since|following|later)\b|之后|以后/i,
      say:"after the anchor", half:"late" },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", half:null }
  ],
  fallback:"before or after"
}
};

const NARROW_IDS = Object.keys(Q).filter(k => Q[k].kind==="narrow");

/* how the stranger asks about the anchor depends on what the anchor is */
const ANCHOR_ASK = {
  photo:    ["the photo — what's in it"],
  ticket:   ["what was the ticket for"],
  birthday: ["whose birthday", "do you know the date of it"],
  deadline: ["what was the deadline for"],
  message:  ["what did it say"],
  event:    ["what was it"],
  other:    ["what is it", "anything about it helps"]
};
function anchorKindOf(raw){
  const t = String(raw||"").toLowerCase();
  if(/\b(photo|picture|pic|image|screenshot|album)\b|照片/.test(t)) return "photo";
  if(/\b(ticket|stub|boarding pass|receipt)\b|票/.test(t)) return "ticket";
  if(/\b(birthday|anniversary|wedding)\b|生日/.test(t)) return "birthday";
  if(/\b(deadline|due|submission|exam|interview)\b|截止/.test(t)) return "deadline";
  if(/\b(message|text|email|chat|dm)\b|短信|消息/.test(t)) return "message";
  if(/\b(concert|game|trip|flight|party|show)\b/.test(t)) return "event";
  return "other";
}

/* ===========================================================================
   SESSION
   =========================================================================== */
function createSession(postText){
  const post = String(postText||"");

  const s = {
    post,
    kind:null,                 // "moment" | "period"
    months:[...ALL],
    yearMin:YEAR_FLOOR, yearMax:Y,
    weekend:null,
    exact:null,                // {year,month,day} when a real date is named
    hasRepresentative:null,
    unknowns:0,
    asked:[], narrowAsked:0, volunteered:[], proposed:{}, stated:0,
    offered:false, offeredHedged:false, needYear:false, pendingStructural:null,
    anchorKind:null, anchorText:null,
    outcome:null, reason:null,
    next:"has_date",
    anchor:/\b(moved|move|moving|apartment|new place|new city|new job|started (school|work|the job))\b|搬家|搬到/i.test(post),
    postSignals:null, postRead:false,
    trace:[]
  };

  s.postSignals = read(post);

  /* --- candidate field ------------------------------------------------- */
  function candidates(){
    if(s.exact) return [new Date(s.exact.year, s.exact.month, s.exact.day)];
    const out=[];
    for(let y=s.yearMin; y<=s.yearMax; y++){
      for(const m of s.months){
        const last = new Date(y,m+1,0).getDate();
        for(let d=1; d<=last; d++){
          const dt = new Date(y,m,d);
          if(s.weekend===true  && ![0,6].includes(dt.getDay())) continue;
          if(s.weekend===false &&  [0,6].includes(dt.getDay())) continue;
          out.push(dt);
        }
      }
    }
    return out;
  }

  /* --- what the interface is allowed to draw ---------------------------- */
  function field(){
    const days = candidates();
    const yearsAlive = [];
    for(let y=s.yearMin; y<=s.yearMax; y++) yearsAlive.push(y);
    const spanFrom = Math.min(YEAR_FLOOR, s.yearMin);
    const spanTo   = Math.max(Y, s.yearMax);
    const allYears = [];
    for(let y=spanFrom; y<=spanTo; y++) allYears.push(y);

    /* level: how much resolution the field has actually earned */
    let level = 0;                                   // 0 years · 1 months · 2 days · 3 one day
    if(s.months.length < 12 || yearsAlive.length === 1) level = 1;
    if(yearsAlive.length === 1 && s.months.length <= 2) level = 2;
    if(days.length === 1 || s.exact) level = 3;

    return {
      allYears, years:yearsAlive, months:[...s.months],
      weekend:s.weekend, exact:s.exact, outcome:s.outcome,
      count: days.length, level,
      first: days[0] || null, last: days[days.length-1] || null
    };
  }

  /* --- which narrowing question is worth asking next -------------------- */
  function bestNarrow(){
    let best=null, bestScore=0;
    for(const id of NARROW_IDS){
      if(s.asked.includes(id)) continue;
      if(s.offered) continue;          /* a day is named — only the year is open */
      const q=Q[id];
      if(q.only && !q.only(s)) continue;
      let score=0;
      if(id==="how_long_ago") score = (s.yearMax-s.yearMin)>0 ? 40 : 0;
      else if(q.days) score = s.months.length<=3 ? 12 : 4;
      else {
        const sizes = q.opts.filter(o=>o.months).map(o=>inter(s.months,o.months).length);
        if(!sizes.length) continue;
        const avg = sizes.reduce((a,b)=>a+b,0)/sizes.length;
        const useful = sizes.filter(n=>n>0 && n<s.months.length).length;
        score = (s.months.length - avg) * (useful?1:0.1);
      }
      score *= (q.weight||1);
      if(score>bestScore){ bestScore=score; best=id; }
    }
    return bestScore > 0.6 ? best : null;
  }

  const enoughNarrowing = () => s.months.length<=2 || s.narrowAsked>=5;

  function nextId(){
    if(s.outcome) return null;
    if(s.needYear && !s.asked.includes("how_long_ago")) return "how_long_ago";
    if(s.next && s.next!=="narrow") return s.next;
    if(s.next==="narrow"){
      if(!enoughNarrowing()){
        const n=bestNarrow();
        if(n) return n;
      }
      if(s.pendingStructural && !s.asked.includes(s.pendingStructural)
         && !(s.offered && s.pendingStructural==="representative")) return s.pendingStructural;
      if(!s.offered && !s.asked.includes("specific_day") &&
         (s.kind==="moment" || s.hasRepresentative)) return "specific_day";
      return null;
    }
    return null;
  }

  function current(){
    const id=nextId();
    if(!id) return null;
    const q=Q[id];
    const chat = id==="anchor_what"
      ? (ANCHOR_ASK[s.anchorKind] || ANCHOR_ASK.other)
      : q.chat;
    return { id, kind:q.kind, node:q.node, chat, fallback:q.fallback,
             options:(q.opts||[]).map(o=>({value:o.v, label:o.label})) };
  }

  /* --- trace ------------------------------------------------------------ */
  function record(id,q,opt,raw,effect,extra){
    s.trace.push(Object.assign({
      id, node:q.node, chat:(q.chat||[]).join(" / "),
      answer: opt ? opt.label : raw,
      raw,
      reading: opt ? opt.say : "recorded",
      effect,
      contradiction:false,
      remaining: candidates().length,
      months: monthList(s.months),
      years: s.yearMin===s.yearMax ? String(s.yearMin) : `${s.yearMin}–${s.yearMax}`
    }, extra||{}));
  }

  /* --- applying one option --------------------------------------------- */
  function applyOption(id, q, opt, raw, extra){
    s.asked.push(id);
    if(q.kind==="narrow") s.narrowAsked++;
    if(opt.v==="unknown") s.unknowns++;

    let effect="no change", contradiction=false;

    if(opt.months){
      const nextMonths = inter(s.months, opt.months);
      if(nextMonths.length===0){
        contradiction = true;
        effect = `conflicts with what is already fixed (${monthList(s.months)}) — constraint discarded`;
      }else{
        s.months = nextMonths;
        effect = `months → ${monthList(s.months)}`;
      }
    }
    if(opt.years){
      s.yearMin = opt.years[0];
      s.yearMax = opt.years[1];
      effect = `year → ${s.yearMin===s.yearMax ? s.yearMin : s.yearMin+"–"+s.yearMax}`;
    }
    if(opt.weekend!==undefined && opt.weekend!==null){
      s.weekend = opt.weekend;
      effect = opt.weekend ? "weekends only" : "weekdays only";
    }
    if(opt.half){
      const mid = Math.floor((s.yearMin+s.yearMax)/2);
      if(opt.half==="early") s.yearMax = mid; else s.yearMin = mid;
      effect = `year → ${s.yearMin===s.yearMax ? s.yearMin : s.yearMin+"–"+s.yearMax}`;
    }
    if(opt.apply){ opt.apply(s); if(effect==="no change") effect = "path → " + (s.next||s.outcome||"end"); }
    /* a narrowing question answered out of band — volunteered in a message,
       or read out of the post — must NOT move the conversation off whatever
       structural question it was still standing on. */
    else if(q.kind==="narrow" && s.next!=="narrow" && !(extra && extra.volunteered))
      s.next="narrow";

    record(id,q,opt,raw,effect,Object.assign({contradiction},extra||{}));
    return { ok:true, id, option:opt, contradiction, effect, finished:!nextId() };
  }

  /* answer with a typed sentence or with an option value */
  function answer(input, byValue){
    const id = nextId();
    if(!id) return { ok:false, finished:true };
    const q = Q[id];
    const raw = String(input||"").trim();

    /* the anchor: a described thing, not an answer to pick from a list */
    if(q.kind==="open"){
      if(!raw) return { ok:false, id, reason:"unparsed", fallback:q.fallback };
      const d = validDate(parseDate(raw));
      if(d){ s.asked.push(id); return Object.assign(offerDate(d, false), { id, exact:true }); }
      s.anchorText = raw.slice(0,90);
      s.asked.push(id);
      const sc = readScene(raw);
      let effect = "kept as an anchor — carries no time value on its own";
      let overrode = false;
      if(sc){
        const nm = inter(s.months, sc.months);
        if(nm.length && nm.length < s.months.length){
          s.months = nm; effect = `months → ${monthList(s.months)}`;
        }else if(!nm.length){
          s.months = sc.months.slice(); overrode = true;
          effect = `months → ${monthList(s.months)} — the remembered scene overrode the inferred months`;
        }
      }
      record(id,q,null,raw,effect,{ scene: sc ? sc.say : null, contradiction:overrode });
      s.next = "the_day";
      return { ok:true, id, open:true, scene:sc, overrode };
    }

    if(q.kind==="date"){
      /* saying you don't remember the date IS an answer. it should never
         be met with "sorry, i can't tell from that". */
      if(IDK.test(raw)) return { ok:false, id, reason:"idk" };
      const d = validDate(parseDate(raw));
      if(!d) return { ok:false, id, reason:"unparsed", fallback:q.fallback };
      s.exact = { year: d.year ?? guessYear(), month:d.month, day:d.day };
      s.months=[s.exact.month]; s.yearMin=s.yearMax=s.exact.year;
      s.asked.push(id);
      record(id,q,null,raw,`date recorded: ${prettyDay(s.exact)}`);
      if(id==="the_date") s.next="date_covers";
      else { s.outcome="A"; s.next=null; }
      return { ok:true, id, exact:true };
    }

    let opt=null;
    if(byValue!==undefined) opt = q.opts.find(o=>o.v===byValue);
    else {
      /* "i don't remember" is a valid answer to every question. where a
         question has no explicit unknown branch, the humbler branch takes it
         rather than the message being thrown away as unreadable. */
      if(IDK.test(raw))
        opt = q.opts.find(o=>o.v==="unknown") || q.opts.find(o=>o.idkFallback) || null;
      if(!opt) opt = q.opts.find(o => o.match && o.match!==IDK && o.match.test(raw)) || null;
      if(!opt && q.opts.some(o=>o.match===YES)){
        if(YES.test(raw)) opt = q.opts.find(o=>o.match===YES);
        else if(NO.test(raw)) opt = q.opts.find(o=>o.match===NO);
      }
    }
    if(!opt) return { ok:false, id, reason:"unparsed", fallback:q.fallback };
    if(id==="specific_day" && opt.v==="yes") s.anchorKind = anchorKindOf(raw);
    return applyOption(id, q, opt, raw);
  }

  /* --- a day the person named, whenever they named it ------------------- */
  function offerDate(d, hedged){
    const conflict = !s.months.includes(d.month) && s.months.length < 12;
    const year = d.year || (s.yearMin===s.yearMax ? s.yearMin : null);
    s.exact = { year: year || Math.round((s.yearMin+s.yearMax)/2),
                month: d.month, day: d.day };
    s.months = [d.month];
    if(year){ s.yearMin = s.yearMax = year; s.needYear = false; }
    else if(!s.asked.includes("how_long_ago") && s.yearMin !== s.yearMax){
      s.needYear = true;
    } else {
      s.yearMin = s.yearMax = s.exact.year; s.needYear = false;
    }
    s.offered = true;
    s.offeredHedged = !!hedged;
    s.hasRepresentative = true;
    if(s.outcome === "C"){ s.outcome = null; s.reason = null; }
    /* a day arrived before the shape of the event was ever settled.
       the question worth asking now is whether that day covers the whole of it. */
    if(!s.kind && !s.asked.includes("date_covers")){
      if(!s.asked.includes("has_date")) s.asked.push("has_date");
      s.next = "date_covers";
    }
    if(!s.next) s.next = "narrow";
    record("offered_date", { node:"Record a date the person volunteered.",
                             chat:["(said without being asked)"] },
           null, prettyDay(s.exact),
           `${hedged?"hedged ":""}date taken as the representative day` +
           (conflict ? " — it overrides the earlier constraints" : ""),
           { contradiction:conflict, volunteered:true });
    return { ok:true, offered:true, needYear:s.needYear, conflict };
  }

  /* a month, a year or a season in passing — narrows, does not pin */
  function offerClue(clue){
    const bits = []; let conflict = false;
    if(clue.year!==null && clue.year!==undefined){
      const isNew = !(s.yearMin===clue.year && s.yearMax===clue.year);
      s.yearMin = s.yearMax = clue.year; s.needYear = false;
      if(!s.asked.includes("how_long_ago")) s.asked.push("how_long_ago");
      if(isNew) bits.push(`year → ${clue.year}`);
    }
    const ms = (clue.month!==null && clue.month!==undefined) ? [clue.month] : clue.months;
    if(ms){
      const nm = inter(s.months, ms);
      if(nm.length && nm.length < s.months.length){
        s.months = nm; bits.push(`months → ${monthList(s.months)}`);
      }
      else if(!nm.length){
        /* The person named a month. Everything it collides with was INFERRED
           by this system from coats and daylight. Their statement wins, and
           the system says out loud that it is dropping its own reasoning —
           it does not quietly keep the guess and answer "ok". */
        conflict = true;
        s.months = ms.slice();
        bits.push(`months → ${monthList(s.months)} — stated month overrode the inferred ones`);
      }
    }
    if(s.next==="has_date") s.next="moment_or_period";
    if(bits.length) s.stated++;         /* time the PERSON stated, not inferred */
    const effect = bits.length ? bits.join("; ") : "no change";
    record("offered_clue", { node:"Record time information volunteered in passing.",
                             chat:["(said without being asked)"] },
           null, (clue.say||[]).join(", ") || "time reference", effect,
           { contradiction:conflict, volunteered:true });
    return { ok:true, clue:true, effect, conflict };
  }

  /* context clues answering questions nobody asked ----------------------- */
  function applyContext(sig){
    const done = [];
    for(const c of sig.context){
      if(s.asked.includes(c.id)) continue;
      if(s.offered) continue;
      const q = Q[c.id];
      if(q.only && !q.only(s)) continue;
      const opt = q.opts.find(o=>o.v===c.v);
      if(!opt) continue;
      const r = applyOption(c.id, q, opt, sig.raw, { volunteered:true });
      s.volunteered.push({ id:c.id, v:c.v, say:opt.say });
      done.push({ id:c.id, v:c.v, say:opt.say, effect:r.effect, contradiction:r.contradiction });
    }
    return done;
  }

  /* --- a reading the system is not sure enough to act on ---------------- */
  function proposalFor(raw, id){
    const q = Q[id];
    if(!q || !q.opts) return null;
    /* one guess per question. a system that keeps guessing at the same
       thing stops reading as thoughtful and starts reading as stuck. */
    if(s.proposed[id]) return null;
    const hits = q.opts.filter(o => o.hint && o.v!=="unknown" && o.hint.test(raw));
    if(hits.length !== 1) return null;
    const o = hits[0];
    s.proposed[id] = 1;
    return { id, v:o.v, say:o.say, ask:o.guess || `so — ${o.label.toLowerCase()}?` };
  }

  /* A bare "yes" / "no" to a question phrased as "was it A ... or was it B".
     It is not nothing: it answers the first clause. The system says which
     way it is taking it rather than deciding silently. */
  function bareVerdictProposal(raw, id){
    const q = Q[id];
    if(!q || !q.opts) return null;
    if(s.proposed[id]) return null;
    const real = q.opts.filter(o=>o.v!=="unknown");
    if(real.length !== 2) return null;
    const y = YES.test(raw), n = NO.test(raw);
    if(y === n) return null;
    const o = y ? real[0] : real[1];
    s.proposed[id] = 1;
    return { id, v:o.v, say:o.say, ask:o.guess || `so — ${o.label.toLowerCase()}?` };
  }

  /* the person confirmed the reading */
  function confirmProposal(p){
    const q = Q[p.id];
    const opt = q.opts.find(o=>o.v===p.v);
    if(!opt) return { ok:false };
    return applyOption(p.id, q, opt, "(confirmed the system's reading)", { inferred:"confirmed" });
  }

  /* the person rejected it. on a two-way question that is itself an answer. */
  function rejectProposal(p){
    const q = Q[p.id];
    const others = q.opts.filter(o=>o.v!==p.v && o.v!=="unknown");
    if(others.length === 1){
      return applyOption(p.id, q, others[0], "(rejected the system's reading)",
                         { inferred:"from a negation, not from evidence" });
    }
    record(p.id, q, null, "(rejected the system's reading)", "no change — asked again",
           { inferred:"rejected" });
    return { ok:false, reAsk:true };
  }

  /* --- ONE ENTRY POINT for a typed message ------------------------------ */
  function ingest(raw, opts){
    const answerCurrent = !opts || opts.answerCurrent !== false;
    const before = candidates().length;
    const sig = read(raw);
    const rep = { sig, applied:[], answered:false, proposal:null, contradiction:false,
                  unread:false, before, after:before, changed:false,
                  certainty:sig.certainty, id:null, option:null };

    const q0 = nextId();
    const cur = q0 ? Q[q0] : null;

    /* 1. a named day outranks the question on the table */
    if(sig.date && (!cur || cur.kind!=="date")){
      const r = offerDate(sig.date, sig.hedged && !sig.sure);
      rep.applied.push({ kind:"date", say:prettyDay(s.exact), hedged:!!(sig.hedged && !sig.sure),
                         needYear:r.needYear, conflict:r.conflict });
      rep.contradiction = rep.contradiction || r.conflict;
      rep.after = candidates().length;
      rep.changed = rep.after !== before;
      return rep;                       /* nothing else in the message matters */
    }

    /* 2. a month, season or year said in passing */
    if(!sig.date && (sig.year!==null || sig.month!==null || sig.months)){
      const r = offerClue(sig);
      if(r.effect!=="no change"){
        rep.applied.push({ kind:"clue", say:(sig.say||[]).join(", "),
                           effect:r.effect, conflict:r.conflict });
        rep.contradiction = rep.contradiction || r.conflict;
      }
    }

    /* 3. context that answers questions nobody asked */
    applyContext(sig).forEach(c=>{
      rep.applied.push({ kind:"context", say:c.say, id:c.id, v:c.v });
      rep.contradiction = rep.contradiction || c.contradiction;
    });

    /* 4. the shape of the event, volunteered while something else was asked.
       when moment_or_period IS the question on the table it is left alone,
       so that an off-script answer can be PROPOSED rather than assumed. */
    if(sig.structure && q0!=="moment_or_period"
       && !s.asked.includes("moment_or_period") && nextId()!=="the_date"){
      const q = Q.moment_or_period;
      const opt = q.opts.find(o=>o.v===sig.structure);
      if(opt){
        applyOption("moment_or_period", q, opt, raw, { volunteered:true });
        rep.applied.push({ kind:"structure", say:opt.say, v:opt.v, id:"moment_or_period" });
      }
    }

    /* "there's no one day in it" — heard even while another question stood */
    if(sig.representative && q0!=="representative"
       && !s.asked.includes("representative") && s.pendingStructural==="representative"){
      const q = Q.representative;
      const opt = q.opts.find(o=>o.v===sig.representative);
      if(opt){
        applyOption("representative", q, opt, raw, { volunteered:true });
        rep.applied.push({ kind:"structure", say:opt.say, v:opt.v, id:"representative" });
      }
    }

    /* 4b. they named the thing that pins the day — a photo, a ticket — while
       the system was asking about coats. That is the most valuable thing in
       the message, and the old version answered it with "sorry, that one's
       past me". Now it takes the offer and asks about the thing itself. */
    if(sig.anchor && !s.asked.includes("specific_day") && !s.offered && !s.outcome
       && q0!=="specific_day" && nextId()!=="the_date" && nextId()!=="anchor_what"){
      const q = Q.specific_day;
      s.anchorKind = sig.anchor;
      applyOption("specific_day", q, q.opts.find(o=>o.v==="yes"), raw, { volunteered:true });
      s.next = "anchor_what";
      rep.applied.push({ kind:"anchor", say:sig.anchor, id:"specific_day" });
    }

    /* 5. the question that was actually on the table */
    const stillPending = nextId();
    if(q0 && stillPending === q0 && !s.outcome && answerCurrent){
      const r = answer(raw);
      if(r.ok){
        rep.answered = true; rep.id = r.id; rep.option = r.option;
        rep.scene = r.scene || null;
        rep.overrode = !!r.overrode;
        rep.contradiction = rep.contradiction || r.contradiction || !!r.overrode;
      }else if(r.reason==="idk"){
        /* they said they don't remember the date. that is an answer. */
        giveUp();
        rep.answered = true; rep.idk = true; rep.id = q0;
      }else{
        const p = proposalFor(raw, q0) || bareVerdictProposal(raw, q0);
        if(p) rep.proposal = p;
        else if(!rep.applied.length){
          /* before saying "i can't tell from that": is this something they
             already told me? saying so is memory, not failure. */
          if(sig.timeish && s.yearMin===s.yearMax)
            rep.stale = { kind:"year", value:s.yearMin };
          else rep.unread = true;
        }
      }
    }else if(q0 && stillPending !== q0){
      rep.answered = true;              /* something in the message moved us on */
    }

    rep.after = candidates().length;
    rep.changed = rep.after !== before;
    return rep;
  }

  /* the post itself, read once, before the first question ---------------- */
  function applyPost(){
    if(s.postRead) return null;
    s.postRead = true;
    const sig = s.postSignals;
    const got = [];
    if(sig && (sig.year!==null || sig.month!==null || sig.months)){
      offerClue(sig); got.push({ id:"clue", v:null, say:(sig.say||[]).join(", ") });
    }
    if(sig) applyContext(sig).forEach(c=>got.push({ id:c.id, v:c.v, say:c.say }));
    return got.length ? got : null;
  }

  /* could not read an answer — record a non-answer and move on ----------- */
  function giveUp(){
    const id = nextId(); if(!id) return null;
    const q = Q[id];
    if(q.kind==="date" || q.kind==="open"){
      s.asked.push(id);
      s.unknowns++;
      record(id,q,null,"(not remembered)","no date supplied");
      /* failing to name the day does not end the conversation. there are
         still things to rule out. */
      s.next = id==="the_date" ? "moment_or_period" : "narrow";
      return { ok:true, id, gaveUp:true };
    }
    const opt = q.opts.find(o=>o.v==="unknown");
    if(opt) return answer(null, "unknown");
    /* has_date and date_covers have no "don't know" branch. the humbler of
       the two answers is taken, so the conversation never stalls on one. */
    const fallbackOpt = q.opts[q.opts.length-1];
    s.unknowns++;
    return applyOption(id, q, fallbackOpt, "(no answer)", { inferred:"no answer — took the weaker branch" });
  }

  function guessYear(){ return Math.round((s.yearMin+s.yearMax)/2); }

  /* --- the outcome ------------------------------------------------------ */
  function result(){
    const fieldDays = candidates();

    if(s.offered && s.exact){
      const d = new Date(s.exact.year, s.exact.month, s.exact.day);
      return s.offeredHedged
        ? pack("B", d, [d], "The person offered this day themselves, without certainty. It is taken as the day that fits best.")
        : pack("A", d, [d], "A specific day was identified by the person, not chosen by the system.");
    }
    if(s.outcome==="C"){
      return pack("C", null, fieldDays, "This experience was not lived as one day, and no single moment stands in for it.");
    }
    /* ------------------------------------------------------------------
       WHEN A SELECTED DATE IS ALLOWED TO EXIST
       A representative day is only representative of a field that is
       actually narrow. If the person kept saying they could not remember,
       the middle of what is left is not a representative day — it is a
       number this system made up and attributed to their life. The Week 1
       tree already had a name for that case, and this is it.
       ------------------------------------------------------------------ */
    /* what the person supplied themselves counts for more than what the
       system worked out from coats and daylight */
    const informative = (s.narrowAsked - s.unknowns) + s.stated*2;
    /* these rules exist to stop the system inventing a day. They must never
       fire when a day is already fixed — the person gave one, or the tree
       recorded one. Without this guard, answering "yes, I know the date" and
       then giving it came back as Cannot Be Represented. */
    const dayIsFixed = !!s.exact || s.outcome==="A";
    if(!s.offered && !dayIsFixed){
      if(fieldDays.length > 62)
        return pack("C", null, fieldDays,
          `The field is still ${fieldDays.length} days wide. No day inside it represents the others; naming one would be an invention.`);
      if(informative < 2)
        return pack("C", null, fieldDays,
          "Almost nothing could be recalled. The narrowing that did happen was the system's inference, not the person's memory.");
      if(s.unknowns >= 3 && s.stated === 0)
        return pack("C", null, fieldDays,
          "The person answered “I don't remember” more often than not. A single day would misrepresent that.");
    }
    if(s.outcome==="A" && s.exact){
      return pack("A", new Date(s.exact.year,s.exact.month,s.exact.day), fieldDays,
                  "A specific day was identified by the person, not chosen by the system.");
    }
    if(fieldDays.length===1){
      return pack("A", fieldDays[0], fieldDays, "The answers left exactly one day in the field.");
    }
    if(fieldDays.length===0){
      return pack("C", null, fieldDays, "The answers contradicted each other; nothing is left in the field.");
    }
    const mid = fieldDays[Math.floor((fieldDays.length-1)/2)];
    return pack("B", mid, fieldDays,
      `${fieldDays.length} days are still possible. The middle of that field is offered as representative.`);
  }

  /* everything the person actually told this system, in their order.
     used at the end, so the refusal can show what it did hold on to. */
  function kept(){
    return s.trace
      .filter(t => t.reading && t.reading!=="unknown" && !/^\(no/.test(t.raw||"")
                && t.effect && t.effect!=="no change")
      .map(t => ({ id:t.id,
                   reading: t.reading==="recorded" ? String(t.raw||"").toLowerCase() : t.reading,
                   raw:t.raw }));
  }

  function pack(output, date, fieldDays, why){
    const span = fieldDays.length ? { from:fieldDays[0], to:fieldDays[fieldDays.length-1] } : null;
    return {
      output, date, why,
      pretty: date ? date.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : null,
      weekday: date ? WEEKDAYS[date.getDay()] : null,
      remaining: fieldDays.length,
      months: monthList(s.months),
      years: s.yearMin===s.yearMax ? String(s.yearMin) : `${s.yearMin}–${s.yearMax}`,
      span: span ? {
        from: span.from.toLocaleDateString("en-US",{month:"short",year:"numeric"}),
        to:   span.to.toLocaleDateString("en-US",{month:"short",year:"numeric"})
      } : null,
      kind: s.kind, unknowns: s.unknowns, volunteered: s.volunteered,
      anchor: s.anchorText, kept: kept(), trace: s.trace
    };
  }

  return { state:s, current, answer, ingest, giveUp, offerDate, offerClue,
           proposalFor, confirmProposal, rejectProposal, applyPost,
           result, candidates, field,
           get finished(){ return !nextId(); } };
}

return { createSession, parseDate, read, verdict, scanTime:read,
         HEDGE, Q, MONTHS, SHORT, WEEKDAYS, YEAR_FLOOR, THIS_YEAR:Y };
})();
