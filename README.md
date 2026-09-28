# Make It a Date — Week 3
### Two representations of one date-resolving system
Jiayi Li · DES-720B Technology B

---

## 怎么运行

双击 `version2-obscured.html` 直接在浏览器打开，不需要服务器、不需要 API。
`version1-legible.html` 同理。

**三个文件必须放在同一个文件夹里**，因为两个版本读取的是同一个 `engine.js`。

```
/make-it-a-date
  engine.js                 ← 系统本体（两个版本共用，同一个文件）
  version1-legible.html     ← 版本一：决策树完全暴露
  version2-obscured.html    ← 版本二：同一棵树，藏在聊天里
```

---

## 最新一轮修改

**1. 你主动说出的日期永远不会被丢掉**
之前的 bug：系统连续两次读不懂你的回答就会「放弃 → 记为不记得 → 走到 C」，
所以你打的 "maybe aug 21" 整个被忽略了。现在改成：
**每一条消息都会先被扫一遍有没有时间信息**，不管当时问的是什么问题。

- 带 maybe / I think / probably / around / 大概 的日期 → **Selected Date**（B），
  那一天直接成为 representative date，绝不会变成 C
- 语气肯定的完整日期 → **Exact Date**（A）
- 只说了月份、年份或季节（"winter, maybe 2024"）→ 当作线索收窄候选集合，
  一条消息里的多个线索会同时生效
- 说了日期但没说年份 → 它会追问一句 "which year was that, though"

顺带修了两个解析 bug：`maybe 2024` 曾被读成「5 月 20 日」（"**may**be" + "**20**24"），
`august 2023` 曾被读成「8 月 20 日」。

**2. 先聊时间背景，再问能不能定到某天**
之前 period 分支是「你说是渐进的 → 立刻问有没有代表日 → 没有就 C」，
三句话就结束了，完全没有收集信息。现在两条分支都改成：
**先问一轮季节 / 天气 / 穿什么 / 开学没 / 树什么样 / 周末还是工作日，再问能不能定到一天。**
所以就算最后走到 C，它也能说 "i can get it to around jan, feb, dec 2025 — but not to a day"，
而不是两手空空。同时，一旦你给出了具体某天，它就不会再多此一举地问
「有没有哪一天能代表」或「周末还是工作日」了。

**3. 三个结论的名字在界面上统一了**
之前底层判的是 A/B/C，但界面上我自己另起了一套词（CLOSEST FIT / NO DATE / DATED），
两边对不上。现在聊天里的结果卡片和帖子上的标签**都直接用这三个名字**：

| 结论 | 卡片 / 帖子标签 | 陌生人说的话 | 副标题说明它怎么来的 |
|---|---|---|---|
| A | **EXACT DATE** | "I think we have the exact day." | 星期几 |
| B | **SELECTED DATE** | "I don't think we can know for sure, but this is the day that fits best." | `one of 24 days that still fit` / `the day you named, without being sure` |
| C | **CANNOT BE REPRESENTED** | "I don't think this belongs to one specific day." | `closest it gets: Jan, Feb, Dec` |

陌生人**说**的话仍然是完全口语的（决策树的词一个都不出现），
正式的结论名字只出现在系统渲染的结果卡片和帖子上 —— 相当于平台在盖章，不是那个人在说话。

**4. 最后的日期会回写到你的帖子上**
对话结束后聊天框换成两个按钮：**see your post** / start over。
点第一个回到 feed，你那条帖子下面多了一栏：
`DATED — CLOSEST FIT · February 9, 2025`，
走到 C 的话是 `UNDATED · No single day`，下面小字写它最接近的范围。
（顺带修了返回动画：之前从私聊退回 feed 时聊天页是往左滑的，会盖住 feed，现在往右滑走。）

**5. 标题**
`Something you can't quite place.` → **`You remember it. Not when.`**
副标题：Post a small thing you can't put a date on. / Someone here will help you find the day.

**6. 课堂演示模式**
打开时在网址后面加 `?plain=1`（`version2-obscured.html?plain=1`），
会关掉错字模拟、缩短打字停顿，方便录屏和当场演示。正常体验就不要加。

---

## 上一轮改了什么（对照你提的要求）

**1. 日期不再是提前生成的**
上一版是按下 Share 的瞬间就算好日期，后面聊什么都不影响结果。现在删掉了。
现在的流程是：发帖时只建立一个「候选日期集合」（默认约 1460 天），
**每回答一个问题就从这个集合里划掉一批日子**，最后剩下什么决定结局。
你在 Version 1 右侧能实时看到 `1461 → 365 → 151 → 120 → 90 → 24 天`。

**2. 三种结局都真的能到达，系统不会硬凑日期**

| | 触发条件 | 陌生人最后说的话 |
|---|---|---|
| **A · Exact Date** | 对话中真的确认了某一天（语气肯定地说出某天，或候选集合只剩 1 天） | "I think we have the exact day." |
| **B · Selected Date** | ① 说了某天但带不确定语气；② 收窄到一段范围但定不到某天 → 取剩余集合的中间那天 | "I don't think we can know for sure, but this is the day that fits best." |
| **C · Cannot Be Represented** | ① 是 period 且没有任何一天能代表它；② 线索太少，集合从头到尾没收窄 | "I don't think this belongs to one specific day." |

C 的结局不给日期，给的是一张「没有日期」的卡片：*It stays a period.*，
下面写它最接近的范围（例如 *closest it gets: Jan, Feb, Dec 2025*）。

**3. 决策树的判断被翻译成了自然提问**
每个问题在 `engine.js` 里都同时带两种说法，`node` 是 Version 1 的树语言，`chat` 是 Version 2 的口语。**它们是同一个问题**：

| Version 1（node） | Version 2（chat） |
|---|---|
| Does this experience have a specific date? | "do you know the actual date of it / or is the date the part that's gone" |
| Is this experience closer to a single moment or a period of time? | "was there one particular day when it happened / or did it come on gradually" |
| Is there a moment that could represent this period? | "if you had to point at one day where it was most true / is there one" |
| Approximately how long ago did it happen? | "roughly how long ago was this" |
| Was the weather cold? (coat / no coat) | "do you remember what you were wearing / was it cold enough for a coat" |
| Was it getting dark early? | "was it already getting dark early that day" |
| Where was it in the school/work year? | "were you in classes then / or was it a break" |
| What state were the trees / plants in? | "anything about how outside looked / bare trees, turning, blossom, full green" |
| Weekday or weekend? | "weekday or weekend, do you think" |
| Can you identify a specific day? | "is there anything that pins it to one day / a ticket, a photo, somebody's birthday" |

Version 1 的每个选项按钮右边会直接印出这个选项会把月份砍成什么，
Version 2 一个字都不提。陌生人只会偶尔像人一样自言自语一句
"so we're somewhere in the cold part of it" —— 这是推理，不是规则。

**4. 陌生人的身份改了**
不再假装「我当时在现场」。现在它是主动说「我看到你说你想不起来是什么时候了，
我挺会推这个的，问你几件事」—— 和你写的设定一致：一起回想，不是目击者。

**5. 问题是自适应的，不是固定顺序**
每一轮系统会算「哪个问题最能砍掉候选集合」再决定问什么。
所以已经确定是冬天时它不会再问「是不是很热」，
月份已经排除冬季时它不会问「有没有雪」。这个打分在 `bestNarrow()` 里，
Version 1 也走同一套。

**6. 会发现你自相矛盾**
如果你先说「冷到要穿大衣」，后面又说「天还很亮、没到天黑」，两个条件的交集是空的。
这时陌生人会说 *"wait — that doesn't sit with what you said before. i'll keep the earlier one"*，
Version 1 则直接把那一步标成 ⚠ contradiction。同一个判断，两种说法。

**7. 读不懂你的回答时会追问，不会卡死**
自由输入靠正则判读。读不懂就用人的方式再问一次
（"sorry — in classes, or on a break"），**连续两次读不懂就当作「不记得」继续走**，
并且「不记得」的次数本身会影响结局 —— 攒够三次且集合没收窄，就会走到 C。

上一版的聊天手感全部保留：多条短消息、打字停顿、偶尔打错字再单独发 `*更正`、
输入框永不 disable（对方打字时你照样能发，消息会排队）、
在聊天页随便按个键焦点自动跳进输入框、18–25 秒不说话它会主动问一句。

---

## Documentation for class

### The claim

Both versions load the same `engine.js` and walk the same `createSession()` state
machine. Version 1 renders `question.node`; Version 2 renders `question.chat`.
Neither version contains a rule of its own.

**Checkable in front of the class:** answer the same way in both and you land on the
same output letter and the same date. Version 1 shows you the field shrinking
`1461 → 365 → 151 → 120 → 90 → 24`; Version 2 shows you a person saying "ok, that moves it."

### The mechanism

```
a field of every candidate day (≈1460)
  → each answer deletes days from the field
    → what is left decides which of the three outputs you get
```

There is no hash and no pre-computed answer. A Selected Date is literally the middle
element of the surviving array — which is why Version 1 can say *"24 days are still
possible; the middle one is offered as representative"* and Version 2 can say
*"don't hold me to the day, the month is solid"* about the identical fact.

### What the pair is for

The interesting comparison is no longer "does the audience believe the date."
It is **what the audience thinks the system is doing while it asks.**

- In Version 1 a question is visibly a filter. You watch October die.
- In Version 2 the same question is an act of interest in your life. Someone asking
  what you were wearing is not reading as a month-range constraint, even though that
  is exactly and only what it is.

Both versions ask about your coat. Only one of them is understood to be asking about
the calendar.

### The sharpest comparison

Enter **"I gradually started to feel that New York was becoming home."** in both.
Answer *a period of time*, then *no, there isn't one day like that*.

Both reach **Output C** and refuse to produce a date. Version 1 prints
`CANNOT BE REPRESENTED`. Version 2's stranger says *"i don't think this belongs to one
specific day,"* and then — this is the line worth watching people react to —
*"i could give you a day. it would just be a number i made up."*

The refusal is the same refusal. In Version 1 it reads as a limitation of the system.
In Version 2 it reads as integrity.

### Observations to test in class

- People answer the weather questions far more fully than the structural ones. Ask
  "single moment or a period" and you get one word; ask "what were you wearing" and
  you get a paragraph. The paragraph is worth less to the system.
- The moment participants become convinced is usually the contradiction catch — being
  *caught* feels like being *known*.
- Ending on C surprises people more than any date does. A system that declines is read
  as more intelligent than one that answers, even though declining is one `if`.
- Nobody asks what the middle of the field means.

*(Class demo: triple-click the name **unknown** in the chat header at any point. The
hidden panel prints the same trace Version 1 shows on screen — node wording, how the
answer was read, what it deleted, how many days survive.)*

### Question for the imitation game

Version 1 and Version 2 ask the same questions, in the same order, and delete the same
days. If an audience calls one of them a tool and the other one a person, what were
they actually judging — the behavior, or the manner?
