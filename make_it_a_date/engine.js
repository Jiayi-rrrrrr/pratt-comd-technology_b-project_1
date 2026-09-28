/* ============================================================================
   engine.js — THE MECHANISM
   ----------------------------------------------------------------------------
   Version 1 (legible) and Version 2 (obscured) both load this file and walk
   the SAME question sequence over the SAME state. Nothing is pre-computed:
   the date does not exist until the answers produce it.

       a field of candidate days
         → each answer removes days from the field
           → what is left decides the outcome

   Every question carries two wordings of itself:
       .node  — how Version 1 says it   (the decision-tree language)
       .chat  — how Version 2 says it   (ordinary conversation)
   They are the same question. That is the whole argument of the pair.

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

const not = ms => ALL.filter(m => !ms.includes(m));
const inter = (a,b) => a.filter(m => b.includes(m));
const monthList = ms => ms.length===12 ? "any month"
  : ms.length===0 ? "nothing"
  : ms.map(m=>SHORT[m]).join(", ");

/* ---- free-text readers (Version 2 types; Version 1 clicks) -------------- */
const IDK = /\b(i don'?t know|idk|dunno|no idea|not sure|can'?t remember|don'?t remember|no clue|unsure|hard to say|either way)\b|不记得|不知道|不确定|忘了/i;
const YES = /\b(yes|yeah|yep|yup|ye|definitely|for sure|certainly|true|correct|right|i think so|probably|i was|it was|we were|there was|i did|we did)\b|^(对|是|嗯|有)/i;
const NO  = /\b(no|nope|nah|not really|not at all|wasn'?t|weren'?t|didn'?t|doesn'?t|never|none)\b|^(不|没|沒)/i;

/* ---- date parsing, for when someone actually names a day ---------------- */
function parseDate(text){
  const t = String(text);
  let m = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s*(\d{1,2})(?!\d)(?:st|nd|rd|th)?,?\s*((?:19|20)\d{2})?/i);
  if(m){
    const mon = SHORT.findIndex(s => s.toLowerCase()===m[1].slice(0,3).toLowerCase());
    const day = Math.min(parseInt(m[2],10));
    const yr  = m[3] ? parseInt(m[3],10) : null;
    return { month:mon, day, year:yr };
  }
  m = t.match(/\b(\d{1,2})(?!\d)\s*(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?,?\s*((?:19|20)\d{2})?/i);
  if(m){
    const mon = SHORT.findIndex(s => s.toLowerCase()===m[2].slice(0,3).toLowerCase());
    return { month:mon, day:Math.min(parseInt(m[1],10)), year:m[3]?parseInt(m[3],10):null };
  }
  m = t.match(/\b((?:19|20)\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
  if(m) return { year:+m[1], month:+m[2]-1, day:Math.min(+m[3]) };
  m = t.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.]((?:19|20)\d{2})\b/);
  if(m) return { year:+m[3], month:+m[1]-1, day:Math.min(+m[2]) };
  m = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if(m) return { year:+m[1], month:+m[2]-1, day:Math.min(+m[3]) };
  return null;
}

/* ---- scan ANY message for volunteered time information ------------------
   People don't wait to be asked. They say "maybe aug 21" in the middle of
   something else. This finds that, wherever it turns up.                   */
const HEDGE = /\b(maybe|i think|probably|possibly|around|roughly|about|might|may have|could have|could be|sometime|somewhere|not sure|guess|guessing|ish|or so|something like)\b|大概|可能|好像|大约/i;
const SEASON_WORDS = [
  { months:[5,6,7],    words:/\b(summer|midsummer)\b|夏天?/i,            say:"summer" },
  { months:[11,0,1],   words:/\b(winter|midwinter)\b|冬天?/i,            say:"winter" },
  { months:[2,3,4],    words:/\b(spring|springtime)\b|春天?/i,           say:"spring" },
  { months:[8,9,10],   words:/\b(autumn|the fall)\b|秋天?/i,             say:"autumn" }
];

function scanTime(text){
  const t = String(text||"");
  const hedged = HEDGE.test(t);
  const out = { hedged, date:null, month:null, year:null, months:null, say:[] };

  const yr = t.match(/\b((?:19|20)\d{2})\b/);
  if(yr){ out.year = +yr[1]; out.say.push(String(out.year)); }

  const d = parseDate(t);
  if(d){
    if(!d.year && out.year) d.year = out.year;
    out.date = d;
    return out;                       /* a full day outranks everything else */
  }

  const mo = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b\.?/i);
  if(mo){
    const idx = SHORT.findIndex(x => x.toLowerCase() === mo[1].slice(0,3).toLowerCase());
    if(idx>=0){ out.month = idx; out.say.unshift(MONTHS[idx]); }
  }

  const se = SEASON_WORDS.find(x => x.words.test(t));
  if(se && out.month===null){ out.months = se.months; out.say.unshift(se.say); }

  return (out.month!==null || out.year!==null || out.months) ? out : null;
}

/* ===========================================================================
   THE QUESTIONS
   Each option carries `apply(state)` — the only thing that ever changes state.
   =========================================================================== */
const Q = {

/* --- structural questions: the shape of the Week 1 tree ----------------- */

has_date: {
  kind:"structural",
  node:"Does this experience have a specific date?",
  chat:["do you know the actual date of it", "or is the date the part that's gone"],
  opts:[
    { v:"yes", label:"Yes — I know the date",
      match:/\b(yes|yeah|i know it|i know the date|i do|i remember the date|it was on)\b/i,
      say:"knows the date",
      apply:s => s.next="the_date" },
    { v:"no", label:"No — that's what I've lost",
      match:/\b(no|nope|i don'?t|that'?s the part|lost|not really|no idea)\b/i,
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
      say:"the day covers the whole experience",
      apply:s => { s.outcome="A"; s.next=null; } },
    { v:"no", label:"No — it was bigger than that day",
      match:/\b(no|bigger|longer|more than|went on|whole|months|weeks|years|a while)\b/i,
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
      match:/\b(one day|a day|particular|single|specific|moment|that day|it happened|sudden|once)\b|一天|某天/i,
      say:"a single moment",
      apply:s => { s.kind="moment"; s.next="narrow"; } },
    { v:"period", label:"A period of time",
      match:/\b(gradual|gradually|slowly|over time|over the years|period|a while|months|weeks|years|little by little|gotten used|gets|kept)\b|渐渐|慢慢|一直|好几个月/i,
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
      say:"one moment can stand for the period",
      apply:s => { s.hasRepresentative=true; s.next="narrow"; } },
    { v:"no", label:"No — no day stands for it",
      match:/\b(no|nope|not really|nothing|there isn'?t|there'?s no|can'?t|cannot|couldn'?t|don'?t think i can|can'?t (choose|pick|name|say)|no single|not one|it wasn'?t like that)\b|选不出|没有那样一天/i,
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
      match:/\b(yes|yeah|there is|i think so|my birthday|a photo|the photo|ticket|it was the|it was on)\b/i,
      say:"can name the day",
      apply:s => s.next="the_day" },
    { v:"no", label:"No — nothing pins it",
      match:/\b(no|nope|not really|nothing|there isn'?t|there'?s no|i can'?t|cannot|don'?t think i can|no photo|no ticket)\b|^(没有|不行)/i,
      say:"nothing identifies one day",
      apply:s => { s.next=null; } },
    { v:"unknown", label:"I don't know", match:IDK, say:"unknown",
      apply:s => { s.unknowns++; s.next=null; } }
  ],
  fallback:"anything that fixes it to one day? a photo, a birthday"
},

the_day: {
  kind:"date",
  node:"Record the identified day.",
  chat:["what day was it"],
  fallback:"what was the date — month and day"
},

/* --- narrowing questions: these are what actually move the field -------- */

how_long_ago: {
  kind:"narrow", weight:4,
  node:"Approximately how long ago did it happen?",
  chat:["roughly how long ago was this"],
  opts:[
    { v:"this", label:"This year", match:/\b(this year|a few months|couple of months|recently|recent|months ago)\b|今年/i,
      say:"this year", years:[Y,Y] },
    { v:"one", label:"About a year ago", match:/\b(last year|a year|one year|about a year)\b|去年/i,
      say:"about a year ago", years:[Y-1,Y-1] },
    { v:"few", label:"Two or three years", match:/\b(two|three|2|3|couple of years|few years)\b|前年|两三年/i,
      say:"two to three years ago", years:[Y-3,Y-2] },
    { v:"long", label:"Longer than that", match:/\b(longer|more than|four|five|six|a long time|years and years|college|high school)\b|好久|很久/i,
      say:"longer than three years", years:[Y-6,Y-4] },
    { v:"unknown", label:"No idea", match:IDK, say:"no idea", years:null }
  ],
  fallback:"a rough guess is fine. this year? a few years?"
},

coat: {
  kind:"narrow", weight:3,
  node:"Was the weather cold? (coat / no coat)",
  chat:["do you remember what you were wearing", "was it cold enough for a coat"],
  opts:[
    { v:"yes", label:"Coat weather", match:YES, say:"cold — coat weather", months:[10,11,0,1,2] },
    { v:"no",  label:"No coat",      match:NO,  say:"not cold", months:[3,4,5,6,7,8,9] },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"coat, or no coat"
},

hot: {
  kind:"narrow", weight:3,
  node:"Was it hot? (sweating / air conditioning)",
  chat:["was it hot enough to be uncomfortable", "ac on, or windows open"],
  opts:[
    { v:"yes", label:"Hot", match:YES, say:"hot", months:[5,6,7,8] },
    { v:"no",  label:"Not hot", match:NO, say:"not hot", months:not([5,6,7]) },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"hot or not hot"
},

dark_early: {
  kind:"narrow", weight:2,
  node:"Was it getting dark early?",
  chat:["was it already getting dark early that day"],
  opts:[
    { v:"yes", label:"Dark early", match:YES, say:"dark early", months:[8,9,10,11,0,1] },
    { v:"no",  label:"Still light", match:NO, say:"light late", months:[3,4,5,6,7] },
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
      say:"term in session", months:[8,9,10,1,2,3,4] },
    { v:"break", label:"On a break",
      match:/\b(break|vacation|holiday|off|summer break|winter break|not in class|no classes)\b|放假|暑假|寒假/i,
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
      say:"bare trees", months:[11,0,1,2] },
    { v:"turning", label:"Turning colour", match:/\b(turning|orange|yellow|red|falling|autumn|fall colou?r)\b|落叶|变黄/i,
      say:"leaves turning", months:[9,10] },
    { v:"blossom", label:"Blossom / new green", match:/\b(blossom|bloom|flower|flowers|new green|buds|spring)\b|开花|花/i,
      say:"blossom", months:[3,4] },
    { v:"green", label:"Full green", match:/\b(green|full|leafy|lush|leaves were out|everything was green)\b|绿/i,
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
    { v:"yes", label:"Snow / ice", match:YES, say:"snow on the ground", months:[11,0,1,2] },
    { v:"no",  label:"No snow", match:NO, say:"no snow", months:not([11,0,1]) },
    { v:"unknown", label:"Don't remember", match:IDK, say:"unknown", months:null }
  ],
  fallback:"snow or no snow"
},

weekend: {
  kind:"narrow", weight:1, days:true,
  node:"Weekday or weekend?",
  chat:["weekday or weekend, do you think"],
  opts:[
    { v:"weekend", label:"Weekend", match:/\b(weekend|saturday|sunday|sat|sun|day off)\b|周末|星期六|星期天/i,
      say:"weekend", weekend:true },
    { v:"weekday", label:"Weekday", match:/\b(weekday|week ?day|monday|tuesday|wednesday|thursday|friday|work|working|class|school day)\b|工作日|平日/i,
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

/* ===========================================================================
   SESSION
   =========================================================================== */
function createSession(postText){
  const post = String(postText||"");

  const s = {
    post,
    kind:null,                 // "moment" | "period"
    months:[...ALL],
    yearMin:Y-3, yearMax:Y,
    weekend:null,
    exact:null,                // {year,month,day} when a real date is named
    hasRepresentative:null,
    unknowns:0,
    asked:[], narrowAsked:0,
    offered:false, offeredHedged:false, needYear:false, pendingStructural:null,
    outcome:null, reason:null,
    next:"has_date",
    anchor:/\b(moved|move|moving|apartment|new place|new city|new job|started (school|work|the job))\b|搬家|搬到/i.test(post),
    trace:[]
  };

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

  /* --- which narrowing question is worth asking next -------------------- */
  function bestNarrow(){
    let best=null, bestScore=0;
    for(const id of NARROW_IDS){
      if(s.asked.includes(id)) continue;
      /* a day has been named — nothing left to narrow except the year,
         and that is requested directly by nextId() */
      if(s.offered) continue;
      const q=Q[id];
      if(q.only && !q.only(s)) continue;
      let score=0;
      if(id==="how_long_ago") score = (s.yearMax-s.yearMin)>0 ? 40 : 0;
      else if(q.days) score = s.months.length<=3 ? 12 : 4;
      else {
        // how much would the average answer cut the month field?
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

  function enoughNarrowing(){
    return s.months.length<=2 || s.narrowAsked>=5;
  }

  /* --- the plan: what to ask now ---------------------------------------- */
  function nextId(){
    if(s.outcome) return null;
    /* a date was volunteered without a year — the year is now the only gap */
    if(s.needYear && !s.asked.includes("how_long_ago")) return "how_long_ago";
    if(s.next && s.next!=="narrow") return s.next;
    if(s.next==="narrow"){
      if(!enoughNarrowing()){
        const n=bestNarrow();
        if(n) return n;
      }
      /* the structural question the period path deferred until after
         the context questions had a chance to place it */
      /* don't ask for a representative day once they have given one */
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
    return { id, kind:q.kind, node:q.node, chat:q.chat, fallback:q.fallback,
             options:(q.opts||[]).map(o=>({value:o.value||o.v, label:o.label})) };
  }

  /* --- applying an answer ----------------------------------------------- */
  function record(id,q,opt,raw,effect,contradiction){
    s.trace.push({
      id, node:q.node, chat:(q.chat||[]).join(" / "),
      answer: opt ? opt.label : raw,
      raw,
      reading: opt ? opt.say : "recorded",
      effect,
      contradiction: !!contradiction,
      remaining: candidates().length,
      months: monthList(s.months),
      years: s.yearMin===s.yearMax ? String(s.yearMin) : `${s.yearMin}–${s.yearMax}`
    });
  }

  /* answer with a typed sentence (V2) or an option value (V1) */
  function answer(input, byValue){
    const id = nextId();
    if(!id) return { ok:false, finished:true };
    const q = Q[id];
    const raw = String(input||"").trim();

    /* a question that wants a date */
    if(q.kind==="date"){
      const d = parseDate(raw);
      if(!d) return { ok:false, id, reason:"unparsed", fallback:q.fallback };
      s.exact = { year: d.year ?? guessYear(), month:d.month, day:d.day };
      s.months=[s.exact.month]; s.yearMin=s.yearMax=s.exact.year;
      s.asked.push(id);
      record(id,q,null,raw,`date recorded: ${MONTHS[s.exact.month]} ${s.exact.day}, ${s.exact.year}`);
      if(id==="the_date"){ s.next="date_covers"; }
      else { s.outcome="A"; s.next=null; }
      return { ok:true, id, exact:true };
    }

    /* a question with options */
    let opt=null;
    if(byValue!==undefined) opt = q.opts.find(o=>o.v===byValue);
    else {
      if(IDK.test(raw)) opt = q.opts.find(o=>o.v==="unknown") || null;
      if(!opt) opt = q.opts.find(o => o.match && o.match!==IDK && o.match.test(raw)) || null;
      if(!opt && q.opts.some(o=>o.match===YES)){
        if(YES.test(raw)) opt = q.opts.find(o=>o.match===YES);
        else if(NO.test(raw)) opt = q.opts.find(o=>o.match===NO);
      }
    }
    if(!opt) return { ok:false, id, reason:"unparsed", fallback:q.fallback };

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
      s.yearMin = Math.max(opt.years[0], Y-8);
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
    if(opt.apply) { opt.apply(s); if(effect==="no change") effect = "path → " + (s.next||s.outcome||"end"); }
    else if(q.kind==="narrow" && s.next!=="narrow") s.next="narrow";

    record(id,q,opt,raw,effect,contradiction);
    return { ok:true, id, option:opt, contradiction, finished:!nextId() };
  }

  /* A date the person volunteered, anywhere in the conversation.
     Hedged ("maybe aug 21") counts: it becomes the representative day and
     the outcome is a Selected Date — never Cannot Be Represented. */
  function offerDate(d, hedged){
    const year = d.year || (s.yearMin===s.yearMax ? s.yearMin : null);
    s.exact = { year: year || Math.round((s.yearMin+s.yearMax)/2),
                month: d.month, day: d.day };
    s.months = [d.month];
    if(year){ s.yearMin = s.yearMax = year; s.needYear = false; }
    else if(!s.asked.includes("how_long_ago") && s.yearMin !== s.yearMax){
      s.needYear = true;                       /* ask which year, it's the only gap */
    } else {
      /* already asked and they couldn't say — settle on the middle year so the
         date and the range it is shown with agree */
      s.yearMin = s.yearMax = s.exact.year; s.needYear = false;
    }
    s.offered = true;
    s.offeredHedged = !!hedged;
    s.hasRepresentative = true;
    if(s.outcome === "C"){ s.outcome = null; s.reason = null; }   /* a named day overrides a refusal */
    if(!s.next) s.next = "narrow";
    record("offered_date", { node:"Record a date the person volunteered.",
                             chat:["(said without being asked)"] },
           null, `${MONTHS[d.month]} ${d.day}${d.year?", "+d.year:""}`,
           `${hedged?"hedged ":""}date taken as the representative day` );
    return { ok:true, offered:true, needYear:s.needYear };
  }

  /* a month, a year or a season mentioned in passing — narrows, does not pin */
  function offerClue(clue){
    const bits = [];
    if(clue.year){
      s.yearMin = s.yearMax = clue.year; s.needYear = false;
      bits.push(`year → ${clue.year}`);
    }
    const ms = clue.month!==null && clue.month!==undefined ? [clue.month] : clue.months;
    if(ms){
      const nm = inter(s.months, ms);
      if(nm.length){ s.months = nm; bits.push(`months → ${monthList(s.months)}`); }
      else bits.push("conflicts with what is already fixed — discarded");
    }
    const effect = bits.length ? bits.join("; ") : "no change";
    record("offered_clue", { node:"Record time information volunteered in passing.",
                             chat:["(said without being asked)"] },
           null, (clue.say||[]).join(", ") || "time reference", effect);
    return { ok:true, clue:true, effect };
  }

  /* the conversation could not read an answer — record it as a non-answer
     and move on, exactly as if the person had said they don't remember */
  function giveUp(){
    const id = nextId(); if(!id) return null;
    const q = Q[id];
    if(q.kind==="date"){
      s.asked.push(id);
      record(id,q,null,"(no date given)","no date supplied");
      if(id==="the_date"){ s.next="moment_or_period"; }
      else { s.next=null; }
      return { ok:true, id, gaveUp:true };
    }
    const opt = q.opts.find(o=>o.v==="unknown");
    if(opt) return answer(null, "unknown");
    s.asked.push(id); s.unknowns++;
    if(q.kind==="narrow"){ s.narrowAsked++; s.next="narrow"; }
    record(id,q,null,"(no answer)","no change");
    return { ok:true, id, gaveUp:true };
  }

  function guessYear(){ return Math.round((s.yearMin+s.yearMax)/2); }

  /* --- the outcome ------------------------------------------------------ */
  function result(){
    const field = candidates();

    /* a day the person named themselves — hedged or not — always produces
       a date. Hedged becomes a Selected Date, certain becomes an Exact one. */
    if(s.offered && s.exact){
      const d = new Date(s.exact.year, s.exact.month, s.exact.day);
      return s.offeredHedged
        ? pack("B", d, [d], "The person offered this day themselves, without certainty. It is taken as the day that fits best.")
        : pack("A", d, [d], "A specific day was identified by the person, not chosen by the system.");
    }

    /* C — the period had no moment that could stand for it */
    if(s.outcome==="C"){
      return pack("C", null, field, "This experience was not lived as one day, and no single moment stands in for it.");
    }
    /* C — nothing could be placed: too many unknowns, field never narrowed */
    const usefulAnswers = s.narrowAsked - s.unknowns;
    if(s.unknowns>=3 && usefulAnswers<2 && s.months.length>6){
      return pack("C", null, field, "Too little could be recalled to place it. The field never narrowed.");
    }
    /* A — a real date was named */
    if(s.outcome==="A" && s.exact){
      return pack("A", new Date(s.exact.year,s.exact.month,s.exact.day), field,
                  "A specific day was identified by the person, not chosen by the system.");
    }
    /* A — the answers themselves left exactly one day standing */
    if(field.length===1){
      return pack("A", field[0], field, "The answers left exactly one day in the field.");
    }
    /* B — representative day: the middle of what is left */
    if(field.length===0){
      return pack("C", null, field, "The answers contradicted each other; nothing is left in the field.");
    }
    const mid = field[Math.floor((field.length-1)/2)];
    return pack("B", mid, field,
      `${field.length} days are still possible. The middle of that field is offered as representative.`);
  }

  function pack(output, date, field, why){
    const span = field.length ? {
      from: field[0], to: field[field.length-1]
    } : null;
    return {
      output, date, why,
      pretty: date ? date.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : null,
      weekday: date ? WEEKDAYS[date.getDay()] : null,
      remaining: field.length,
      months: monthList(s.months),
      years: s.yearMin===s.yearMax ? String(s.yearMin) : `${s.yearMin}–${s.yearMax}`,
      span: span ? {
        from: span.from.toLocaleDateString("en-US",{month:"short",year:"numeric"}),
        to:   span.to.toLocaleDateString("en-US",{month:"short",year:"numeric"})
      } : null,
      kind: s.kind, unknowns: s.unknowns, trace: s.trace
    };
  }

  return { state:s, current, answer, giveUp, offerDate, offerClue, result, candidates,
           get finished(){ return !nextId(); } };
}

return { createSession, parseDate, scanTime, HEDGE, Q, MONTHS, WEEKDAYS };
})();
