# MAKE IT A DATE — Week 4, final combined prototype

**Files:** `index.html` (the surface) · `engine.js` (the mechanism)
Open `index.html` in a browser. Add `?plain=1` to the URL for a faster, typo-free
run when you are screen-recording or demoing live.

Hidden switch for the crit: **triple-click the name "unknown"** in the chat
header to open the trace — every question, what you actually typed, how it was
read, what it removed from the field, and which readings were *inferred* rather
than given. Triple-click again to close.

---

## 0. The calendar is the first screen

The prototype now opens on an ordinary calendar. Today's date, a month grid,
*"Anything to add?"* — the system in its normal, unremarkable state.

**If the memory has a date, nothing in this project happens.** You tap the day,
type the thing, and it is in. One tap, no questions, no stranger, no narrowing.
That path takes four seconds and is the entire reason calendars exist.

**If it doesn't, the calendar has no way to accept it.** There is no cell to tap.
Under the grid is the other door — *"Remember something but not when it
happened?"* — and behind that door is everything else: the post, the stranger,
the interrogation, the field.

This means the Week 1 decision tree's first question — *does this experience
have a specific date?* — is no longer asked in words. **It is the shape of the
front screen.** The person answers it by choosing which door to use, before the
system has said anything. Everything the rest of this prototype does exists
only to serve the people who could not use the first door.

**What the record keeps.** Entries are saved in the browser (`localStorage`) and
listed under the calendar in two groups that never mix:

```
ON THE CALENDAR
  FEB 14 2025   The bus never came and we just stood there.
                EXACT DATE · VIA THE STRANGER · FRIDAY
  SEP 21 2026   Bought the wrong size batteries again.
                EXACT DATE

NOT ON THE CALENDAR        ← these happened. they have no day to sit on.
  —             I stopped waiting for a reply at some point.
                CANNOT BE REPRESENTED · VIA THE STRANGER
```

Every row says how it got in: straight off the calendar, or *via the stranger* —
and whether the day is one the person knew (**Exact**), one the field produced
(**Selected**), or none at all. Over a few runs this list becomes the clearest
artefact the project has: a record that is honest about which of its own
contents are facts, which are constructions, and which are neither.

The second group is the argument. A calendar with nothing in that section is a
calendar that has quietly converted everything it was given. This one keeps the
receipts.

---

## 1. What this version is

Week 3 produced two surfaces over one mechanism:

| | Version 1 — legible | Version 2 — obscured |
|---|---|---|
| form | decision tree + full-screen calendar | DM from a stranger |
| strength (from feedback) | the calendar **gradually reveals itself** — information is withheld and released | it is **conversational** — you answer by remembering, so you read the system as understanding, asking, participating |
| weakness | mechanical; you operate it, you don't talk to it | the field is invisible, so nothing visibly accumulates |

The note in the feedback was: *is there a way to add a little bit of this into
it?* This version takes Version 2 as the body and puts **one** thing back from
Version 1 — not the calendar as an interface, but the calendar as **evidence of
state**.

**The balance I chose:**

- **Revealed:** *what the system currently believes is still possible.* A strip
  pinned under the header shows the candidate field and gains resolution as the
  conversation goes: `year → month → week → day`. It is wordless. It never
  prints "365 → 151".
- **Hidden:** *why.* No rule, no weight, no count, no question ID. The person
  sees the field move right after they speak and has to build their own theory
  of what caused it.

That split is the whole experiment. In Version 1 the mechanism was legible and
the system felt operated. In Version 2 the mechanism was hidden and the system
felt like a person, but the field's accumulation went unnoticed. Here, the
*state* is legible and the *rule* is not — which is, I think, roughly the
condition under which people say a machine "understands."

---

## 2. What changed, and why each change is a test

Nothing here was added to make the prototype look more advanced. Each change is
a response to something I watched a participant do.

### 2.1 A message carries several things at once (not "one sentence = one answer")

**Observed:** people answered a question and volunteered three other things in
the same breath, and Version 2 threw all of it away.

`engine.js → read()` now pulls every signal out of one message simultaneously:

- **time** — `2025`, `last winter`, `August 21`, `around March`
- **structure** — single moment / a period
- **representativeness** — whether one day can stand for the whole thing
- **certainty** — `definitely` / `i think` / `not sure`
- **context** — cold, a coat, school break, a weekend, snow, bare trees

Each of these is applied to the field independently, and the stranger repeats
back what it took: *"a weekend, cold — you hadn't been asked that yet, but I'm
taking it."* That line is doing most of the work people read as listening.

It also reads the **post itself** before the first message, so the field has
already moved once before you have said anything:
*"you already said cold, so i'm starting from that."*

### 2.2 A named day outranks whatever was just asked

**Observed (your bug):** a participant typed a real date mid-flow and the system
ignored it because it was busy waiting for an answer about coats.

A parsed day now short-circuits everything, from any turn, including the very
first message — which Version 2 discarded entirely. A hedged day
(`maybe aug 21`) is still taken; it just produces **Selected Date** instead of
**Exact Date**. A day that contradicts earlier clues overrides them, and the
system says so out loud: *"that contradicts the earlier bit. I'm keeping the
day. You'd know."* Deference is a behavioural cue, not a bug fix.

### 2.3 Not matching the options is no longer a failure — it becomes an interpretation

**Observed (your second bug):** the system offered two options, the person
answered with their own understanding, and the system read it as nothing.

I deliberately did **not** try to make this understand all natural language. No
API, no model. Instead the limit is turned into the interaction:

> **system:** was there one particular day when it happened / or did it come on gradually
> **person:** I didn't notice it at first. At some point I just realized I was used to it.
> **system:** *hm —*
> **system:** *sounds more like it built up over time?*

Each option carries a loose `hint` regex that is never applied silently — it can
only be **proposed**. The person then confirms (`yeah`) or corrects
(`not exactly. there was one specific day.`), and on a two-option question a
rejection is itself an answer: the system flips to the other branch and marks
in the trace that it got there **from a negation, not from evidence**.

It also owns the mistake out loud — *"ok, i had it backwards"* — and it is
allowed only **one** guess per question, because a system that keeps guessing at
the same thing stops reading as thoughtful and starts reading as stuck.

### 2.4 The field is visible, the rule is not

The strip moves **only when the candidate set actually changes**. Saying the
same thing twice does nothing, and you can see that it does nothing. Its
resolution is earned:

```
2023   2024   2025   2026                        ← nothing known yet
       2025                                      ← a year is fixed
JAN FEB MAR — — — — — — — NOV DEC                ← months survive or fade
NOVEMBER 2025 · weekdays fade, weekends stay     ← week / day resolution
NOV 15                                           ← the day it commits to
```

It is set in monospace, so the interior of the machine is a different *material*
from its voice. When the outcome is **Cannot Be Represented**, the strip refuses
to resolve and dims instead — the refusal is visible as well as spoken.

### 2.5 It asks about the thing you remembered, instead of stepping over it

**Observed (the sharpest failure in testing):** the system asked what pinned the
day, the participant answered *"a photo"* — the only detail they had
volunteered without being squeezed for it — and the system immediately went
back to asking for a date. *"Then what was the point of asking?"*

Now `specific_day → yes` opens a branch of its own: **`anchor_what`**, phrased
for whatever they named (*the photo — what's in it* / *what was the ticket for*
/ *whose birthday*). The description is then read for time:

> **person:** a photo with a little lamb
> **system:** *a lamb — that puts it in the spring, isn't it*

A short lexicon (lambs, blossom, pumpkins, graduation, fireworks, snowmen…)
maps described scenes to months. This is not comprehension; it is a list of the
dozen things people actually name when describing a photograph. But it is the
moment in every test run where the person sits up — the system used something
they said *about their life*, not something it had prompted for. The anchor is
also remembered and referred back to at the end.

Saying *"a photo"* at any other moment now works too: the system drops its own
question and takes the offer — *"hold on, that's better than anything I was
about to ask."*

### 2.6 It stops pretending, in four specific places

Each of these came from watching a session go wrong.

- **"Sorry, I can't remember clearly."** used to be *unreadable*, because two
  questions had no "don't know" branch. Saying you don't remember is now a
  valid answer to every question in the tree, including the ones asking for a
  date.
- **"18 years ago"** used to fall through, because the options only offered four
  time bands, and the year range was hard-capped at eight years back. Any
  number of years now parses, and the field expands to hold it — the strip
  compresses to `2008 · 2026` rather than breaking.
- **A month you state now overrules a month the system inferred.** Previously,
  saying *"july"* after the system had worked out "cold, so Nov–Mar" was
  silently discarded — while the system replied *"july. ok"*. It now drops its
  own reasoning out loud: *"that cuts against what I'd worked out from the
  weather. I'll drop mine."*
- **Repeating yourself is met with memory, not failure.** Saying something about
  time it already has returns *"you said 2008 before — I'm still going off
  that"* instead of *"I can't tell from that."*

### 2.7 The honesty rule: a Selected Date has to be earned

This is the change I care most about. A participant answered *"I can't
remember"* three times and the system still produced **Selected Date ·
September 30** — a day it had invented and attached to their life, in a month
they had explicitly contradicted.

A Selected Date is now only produced when the field is **≤ 62 days** and the
person supplied at least some of the narrowing themselves (what they *state*
counts double what the system *infers*). Otherwise the output is **Cannot Be
Represented**, and the system first reads back everything it did keep, then
refuses:

> *what I have is: a single moment, 18 years ago, not cold, a photo with a
> little lamb*
> **Cannot Be Represented — no single day**
> *I could hand you a day. It would be a number I made up and put in your life.*
> *If the photo turns up, that's the thing that would do it.*

The refusal is the strongest output the system has. It is also the only one
that is definitely true.

---

## 3. The research structure

**1 · Reconstruction — how does it work?**
The mechanism is the Week 1 decision tree from calendar/scheduling systems: an
experience is admitted into the system only if it can be reduced to one
processable day. Three outcomes: *Exact Date* · *Selected Date* · *Cannot Be
Represented*. Reconstructed literally as a field of candidate days that only
ever shrinks — the date does not exist until the answers produce it.

**2 · Intervention — what happens if I change something?**
The same engine, three surfaces. Week 3: mechanism shown (V1) vs mechanism
hidden (V2). Week 4: mechanism hidden, **state shown**; and the system's
failures of comprehension converted into visible acts of interpretation.

**3 · Observation — what changed?**
- V1: people **operated** it. They optimized their answers to reach an output.
- V2: people **talked to** it, and read questions as curiosity — but nothing
  accumulated visibly, so the ending felt asserted rather than arrived at.
- Testing the final version produced the most useful observation of the whole
  project, and it was a negative one. **Every complaint was about the system
  failing to honour something the person had already given it** — a date said
  at the wrong moment, a number outside the offered options, a month it
  overruled with its own inference, a photograph it stepped over, an admission
  of not remembering that it processed as noise. Not one complaint was that it
  guessed the wrong date.
- What people called "it doesn't understand me" was never a parsing failure in
  the abstract. It was the system **discarding their contribution while
  continuing to sound attentive** — replying *"july. ok"* and then producing
  September. Fluency plus disposal reads as worse than silence.
- Final (what to watch for in the crit): does the visible field make the ending
  feel *earned* without making the system feel *mechanical* again? And does the
  system proposing a wrong reading — then being corrected — make it seem more
  intelligent than a system that simply parses correctly?

**4 · Claim**
> Intelligence was not read from the system's accuracy. It was read from what
> the system **did with what it was given** — whether the person's own words
> survived contact with it. A system that keeps your contribution and says what
> it did with it reads as understanding. A system that quietly overwrites your
> contribution with its own inference reads as not listening, **even when its
> inference is better**, and even when it is fluent and warm while doing it.

The moment participants most reliably described as "it understands me" was not
a correct parse. It was the moment the system offered its own interpretation of
something ambiguous and asked to be told it was wrong — or took a detail they
had volunteered (*a photo with a little lamb*) and made something of it in
front of them. Understanding, as perceived, is not a property of the model — it
is an event that happens when the machine makes its reading of *you*
inspectable and revisable.

The inverse is the sharper finding, because it is the one the prototype had to
be rebuilt around: **the failure mode that destroys the reading of intelligence
is not being wrong, it is being lossy while sounding attentive.**

The visible field supports the same claim from the other side: showing *what*
the system believes while hiding *why* keeps people interpreting. The version
that explained itself (V1) was trusted and found dull; the version that
explained nothing (V2) was uncanny but unaccountable. What produced the
strongest reading of "it is thinking" was a system that showed its **state**
and withheld its **reasons** — the same asymmetry we grant other people.

---

## 4. Live demo script (2 minutes, use `index.html?plain=1`)

**Open on the calendar and do the easy thing first — it takes ten seconds and
it sets up everything.** Tap today, type *"Bought the wrong size batteries
again."*, hit Add. Say: *this is the whole system working normally. Now here is
the memory it cannot take.* Then tap **Find the day →**.

Post — mood **annoyed**:
> We waited for the bus that never came. I know it was cold, but I couldn't tell you what month.

Then, one message at a time:

1. `ok`
   → *"you already said cold, so i'm starting from that"* — **it read the post**
2. `no, that's the part i lost`
3. `I didn't notice it at first. At some point I just realized I was used to it.`
   → **the proposal fires**: *"hm — sounds more like it built up over time?"*
4. `not exactly. there was one specific day.`
   → *"ok, i had it backwards"* — **corrected, and it says so**
5. `it was 2025, freezing, and a saturday i think`
   → three signals in one message; **watch the strip go year → months**
6. `Actually I think it was February 14, 2025. I remember because it was Valentine's Day.`
   → the named day **overrides the question on the table**; strip goes to the
   week, then pins the day

**A second run, if there is time — the one that ends in a refusal.** It is the
better demo, because the system's best behaviour is its worst outcome:

1. `ok`
2. `Sorry, I can't remember clearly.` → accepted as an answer, not as noise
3. `No` → *"sounds more like it built up over time?"*, then `one particular day`
   → *"ok, I had it backwards"*
4. `18 years ago` → **the strip jumps to `2008 · 2026`**, bar collapses to a
   quarter
5. `a few years` → *"you said 2008 before — I'm still going off that"*
6. `a photo` → *"hold on, that's better than anything I was about to ask"* →
   *"the photo — what's in it"*
7. `a photo with a little lamb` → *"a lamb — that puts it in the spring"*;
   **two month grids open: APRIL 2008 · MAY 2008**
8. `Sorry, I can't remember clearly.` → it reads back everything it kept, then
   **refuses to name a day**

Ending variants worth knowing:
- drop *"I remember because…"* from a stated date and it becomes a hedged day →
  **Selected Date**
- answer `no, there's no one day` at any point on the period path → **Cannot Be
  Represented**, and the strip dims instead of resolving

Then **back to the calendar**, and show the record: the batteries went in
without being asked anything; this one is either sitting on a day it was talked
into, or in the section underneath, with no day at all.

Then triple-click **unknown** to show the trace: same conversation, re-read as
the decision tree it always was.

*(Entries persist between runs. To reset before a crit, open the browser console
and run `localStorage.clear()`, then reload. If the browser blocks storage on
`file://`, the app still works — the record just empties on reload.)*

---

## 5. Limits, and the unresolved question

**Assumptions / limits**
- Rule-based, no language model. Comprehension is a performance made out of
  regular expressions; the proposal mechanism is what makes that performance
  survive contact with real sentences, not an actual increase in understanding.
- Season→month mappings are northern-hemisphere and climate-naive.
- Small n, participants are classmates, and they knew a system was being tested.
- The strip is legible partly *because* my sample already knows what a calendar
  is. It borrows credibility from a familiar instrument.

**Unresolved**
> If what people read as understanding is the system's willingness to be
> corrected, then a system could be made to feel *more* understanding by being
> *more* wrong — as long as it is wrong out loud and in the right shape. I do
> not know how to tell that apart from understanding from the outside, and I am
> not sure the people using it can either.
>
> And the honesty rule has the same problem in reverse. The refusal reads as
> the most intelligent thing this system does — but it is one comparison
> against a threshold I chose. I cannot tell whether people are reading
> *integrity* or just reading *a well-timed silence*.

---

## 6. 中文速记（给自己讲的时候用）

- **首页日历 = Week 1 决策树的第一个问题，被做成了界面**。有日期的事情，点一下格子
  直接写进去，四秒钟，不需要这个项目的任何东西。没日期的，日历**根本没有格子可以接
  住它**，只能走下面那道门。所以"这件事有确切日期吗"这句话不用问出口，人在开口之前
  就已经用"选哪道门"回答了。
- **历史记录分两组，永远不混**：ON THE CALENDAR / NOT ON THE CALENDAR，每条都标注
  它是怎么进来的（直接写入，还是 via the stranger），以及它是 Exact / Selected /
  Cannot Be Represented。第二组就是论点本身——**一个第二组为空的日历，是一个把所有
  东西都悄悄换算掉了的日历。这个留了凭据。**

- **保留 V2 的对话**：它是"被读成一个在理解你的对象"的来源。
- **放回 V1 的一样东西**：不是日历界面，而是**候选场的可见性**。顶部 time strip
  只显示"还剩哪些可能"，**不解释为什么**。年 → 月 → 周 → 日，分辨率是"挣来的"。
- **两个 bug 的修法不是修 bug，是变成机制**：
  - 具体日期最高优先级 → 系统"听见你比听见自己重要"（deference）。
  - 没按选项回答 → 系统**提出自己的解读**让你确认/纠正，而不是识别失败。
    二选一时你说"不是"，系统就翻到另一边，并在 trace 里标注"这是从否定推出来的"。
- **测试里所有抱怨都是同一件事**：系统把人已经给出的东西丢掉了——说早了的日期、
  超出选项的"18 years ago"、被自己推论压过去的"july"、被跨过去的那张照片、
  被当成噪音的"我不记得了"。**没有一条抱怨是"它猜错了日期"。**
- **所以"它不懂我"不是解析失败**，而是：**它一边丢掉你的话，一边继续显得很专注。**
  回一句 "july. ok" 然后输出九月——流畅加上丢失，比沉默更糟。
- **主张一句话**：人读出"它懂我"，取决于**你的话在它那里活没活下来**，而不是它算得
  准不准。留住你说的并说明它拿它做了什么 → 像在理解；悄悄用自己的推论覆盖掉 →
  像没在听，**哪怕它的推论更对**。
- **最强的输出是拒绝**：候选场还剩 62 天以上、或者窄下来靠的全是系统自己的推论时，
  它不再给日期，而是先把留住的东西念一遍，然后说"我可以给你一天，但那会是我编出来
  塞进你生活里的一个数字"。
- **未解决的问题**：那是不是意味着，一个"错得恰到好处、并且错得出声"的系统，会比
  一个安静地正确的系统显得更懂人？而那句拒绝，人读到的究竟是诚实，还是只是一个
  时机很好的沉默？
