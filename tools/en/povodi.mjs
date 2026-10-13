/* Английските страници по повод, по човек и по празник (13.10.2026).
   Българските празници без смисъл навън (имен ден, Гергьовден, Никулден,
   Ивановден, Димитровден, Цветница) и „кумове“ / „ловец“ нямат английска
   версия — търсенето за тях е само на български. Обратно: Mother's Day и
   Father's Day са само на английски (у нас не се търсят като повод).

   chip — точната стойност на чипа в бързата форма на en/index.html; оттам
   страницата отваря формата с избран повод (?povod=…#order). Без chip —
   формата се отваря без избор (страниците „за кого“: поводът е отделен въпрос).
   В текстовете НЯМА „AI“ — правилото на сайта важи и на английски. */

export const GRUPI = [
  { kod: "occasion", ime: "Occasions" },
  { kod: "person", ime: "For whom" },
  { kod: "holiday", ime: "Holidays" }
];

export const POVODI = [
  /* ================= ПОВОДИ ================= */
  {
    key: "birthday", grupa: "occasion", file: "birthday-song.html", bg: "podarak-pesen-za-rojden-den.html",
    chip: "Birthday", menu: "Birthday song", teaser: "a gift that celebrates the person, not the shelf",
    title: "Custom Birthday Song Gift — €19.90, Ready in 24 Hours",
    desc: "A personalised birthday song written from your story: their name in the chorus, your inside jokes in the verses. €19.90, delivered as MP3 within 24 hours.",
    kicker: "A gift they won't forget",
    h1: "A custom <span class=\"grad-text\">birthday song</span> with their name in it",
    short: "a personalised birthday song from Pesenta — original lyrics and music written from your story, €19.90, ready within 24 hours. You get the MP3 and the lyrics by email, plus a personal song page; one revision is free.",
    paras: [
      "Every year it's the same: perfume, a card, an envelope with cash. All nice — and a month later nobody remembers who gave what. A custom song is different. It carries their name, their story and the joke only your crowd gets. And it stays: it gets played at every birthday after this one.",
      "You tell us who they are — how you met, what makes them laugh, what kind of year they've had, the nickname they hate hearing in public. We turn those details into lyrics that sound like them, not like a rhyming greeting card.",
      "The style is your call: a ballad if you want a few happy tears, a party track for the cake and candles, rap if hip-hop is their thing. Pick the language too — English, Bulgarian or one of twelve others.",
      "Within 24 hours the song is in your inbox, just in time for the party. And it's one of a kind: no other guest will turn up with the same present."
    ],
    ctaLine: "Birthdays come every year. A song like this only once.",
    ctaBtn: "Order a birthday song",
    faq: [
      ["Can I order it as a surprise?", "Of course. We only ever talk to you. The song and our conversation stay private until you decide to give it."],
      ["The birthday is in two days — can you make it?", "Yes. The song is ready within 24 hours of payment. Order as early as you can so there's room for a revision before the party."],
      ["Can the song be for my own birthday?", "Sure — plenty of people order one for themselves, to play at their own party. Just say so in your story."]
    ],
    related: ["milestone", "eighteenth", "mom", "dad"],
    demo: ["krasi", "vladi", "rosen", "rocco"],
    bandH: "Make their next birthday the one they talk about",
    bandP: "Balloons and cake happen every year. A song written just for them — only this once."
  },
  {
    key: "wedding", grupa: "occasion", file: "wedding-song.html", bg: "podarak-pesen-za-svatba.html",
    chip: "Wedding", menu: "Wedding song", teaser: "a song the couple will remember longer than the menu",
    title: "Custom Wedding Song for the Couple — €19.90 | Pesenta",
    desc: "A personalised wedding song about the couple: how they met, the proposal, the friends around them. A gift from guests or a surprise for the first dance. €19.90.",
    kicker: "For the two of them",
    h1: "A custom <span class=\"grad-text\">wedding song</span> about how they found each other",
    short: "a personalised wedding song from Pesenta — original lyrics about the couple's story, music in the style you choose, €19.90 and ready within 24 hours. A popular gift from friends, siblings and the best man.",
    paras: [
      "Wedding gifts blur together: a kitchen gadget, an envelope, a frame with a quote. A song about the couple is the one thing at the reception that is only about them — the way they met, the first date that went wrong, the moment someone said yes.",
      "It works as a gift from the guests, a surprise from the best man or maid of honour, or a moment the bride and groom prepare for each other. Played after the speeches, it's the part of the night people film.",
      "Tell us their names, how long they've been together, the places that matter and a few stories your group still laughs about. We write the lyrics from those details and produce the song in the style you pick — a slow ballad, a sing-along anthem or something to dance to.",
      "You get the MP3 and the lyrics by email within 24 hours, so even a last-minute idea arrives on time."
    ],
    ctaLine: "The menu will be forgotten. Their song won't.",
    ctaBtn: "Order a wedding song",
    faq: [
      ["Can several friends order one song together?", "Yes — one person places the order and tells the story for the whole group. Add everyone's names if you want them in the song."],
      ["Can it be a first-dance song?", "It can. Tell us the tempo you need and whether it should be a slow ballad — we'll keep the arrangement simple enough to dance to."],
      ["Can we hear it before the wedding?", "Yes, you get it first. If a name or a detail isn't right, one revision is free."]
    ],
    related: ["engagement", "anniversary", "bachelor", "bachelorette"],
    demo: ["vladi", "rocco", "krasi", "veche"]
  },
  {
    key: "bachelor", grupa: "occasion", file: "bachelor-party-song.html", bg: "podarak-pesen-za-ergensko.html",
    chip: "Bachelor party", menu: "Bachelor party song", teaser: "an anthem for the crew, with every name in it",
    title: "Custom Bachelor Party Song — Roast the Groom | €19.90",
    desc: "A custom song for the stag or bachelor party: the groom's stories, the crew's names and the jokes you can't tell at the wedding. €19.90, ready in 24 hours.",
    kicker: "One last night out",
    h1: "A custom <span class=\"grad-text\">bachelor party song</span> for the groom and the crew",
    short: "a personalised stag or bachelor party song from Pesenta — the groom's stories and your crew's inside jokes turned into an anthem, €19.90, ready within 24 hours. This is where Pesenta started.",
    paras: [
      "Pesenta began at a bachelor party. We played a few songs written about the groom and his friends — and by midnight the whole table was standing on chairs, singing lyrics they had never heard before. The groom asked the DJ to play one of them three times in a row at the wedding.",
      "That's the idea: an anthem with the groom's name, his worst haircut, the trip nobody talks about and the nickname that stuck. Every friend gets a line. It's a roast, but a warm one — something he'll actually want to keep.",
      "Tell us about the groom and the crew. Want it explicit? Tick the 18+ option in your story and we'll write it uncensored; otherwise it stays family-friendly enough for the wedding playlist.",
      "Pick a party style — pop-punk, disco, rap, Balkan brass, Latin — and you'll have the MP3 within 24 hours."
    ],
    ctaLine: "Give the crew a song they'll be singing at the wedding too.",
    ctaBtn: "Order a bachelor party song",
    faq: [
      ["Can the song be rude?", "If you ask for it, yes. Mention 18+ in your story and we'll write it uncensored. You're responsible for who hears it."],
      ["We're ten friends — can everyone be in it?", "Yes. Give us names and one detail per person; the chorus stays about the groom."],
      ["Can we order a second, clean version for the wedding?", "Order a second song and tell us it's the clean version of the first — we'll keep the melody idea and rewrite the lyrics."]
    ],
    related: ["bachelorette", "wedding", "boyfriend"],
    demo: ["veche", "habibi", "vladi", "glig"]
  },
  {
    key: "bachelorette", grupa: "occasion", file: "bachelorette-party-song.html", bg: "podarak-pesen-za-mominsko.html",
    chip: "Bachelorette party", menu: "Bachelorette party song", teaser: "an anthem for the girls, uncensored if you like",
    title: "Custom Bachelorette / Hen Party Song — €19.90 | Pesenta",
    desc: "A personalised hen or bachelorette party song about the bride and her friends: the stories, the nicknames, the plans for the night. €19.90, ready in 24 hours.",
    kicker: "For the bride-to-be",
    h1: "A custom <span class=\"grad-text\">bachelorette party song</span> for the bride and her girls",
    short: "a personalised hen or bachelorette party song from Pesenta — the bride's stories and the group's inside jokes in one anthem, €19.90, ready within 24 hours.",
    paras: [
      "Sashes and matching T-shirts are fun for one night. A song about the bride and her friends lasts longer — it's the track you'll play in the car on the way, at the dinner and again at the wedding.",
      "Tell us about her: how she met the groom, what she's like after two glasses of wine, the trip the group still talks about, who always loses her phone. Every friend can get a line, and the chorus is all about the bride.",
      "It can be sweet, cheeky or completely uncensored — just say 18+ in your story if that's the plan. Pick the music: pop, disco, reggaeton, a power ballad or something you can scream along to.",
      "You'll have the MP3 and lyrics within 24 hours, ready for the playlist."
    ],
    ctaLine: "One night, one bride, one song that's all hers.",
    ctaBtn: "Order a bachelorette song",
    faq: [
      ["Can it stay a surprise for the bride?", "Yes — we only talk to whoever places the order."],
      ["Can it be explicit?", "If you ask for it in your story (18+), yes. Otherwise we keep it playful and clean."],
      ["Can it be in two languages?", "Yes — pick “Mixed” in the language field and tell us which two."]
    ],
    related: ["bachelor", "wedding", "girlfriend"],
    demo: ["krasi", "habibi", "rocco", "veche"]
  },
  {
    key: "anniversary", grupa: "occasion", file: "anniversary-song.html", bg: "podarak-pesen-za-godishnina.html",
    chip: "Anniversary", menu: "Anniversary song", teaser: "proof that the years add up",
    title: "Custom Anniversary Song Gift for Your Partner — €19.90",
    desc: "A personalised anniversary song about your story together: the first date, the places, the small things only the two of you know. €19.90, ready in 24 hours.",
    kicker: "Your story, set to music",
    h1: "A custom <span class=\"grad-text\">anniversary song</span> about the two of you",
    short: "a personalised anniversary song from Pesenta — original lyrics about your relationship, music in the style you love, €19.90, ready within 24 hours. Works for a first anniversary and for a fiftieth.",
    paras: [
      "After a few years together, finding a gift gets harder — you already have the watch, the weekend away, the necklace. A song about your story is the one thing they can't already own.",
      "Tell us how you met, what the first date was like, the song that was playing, the trips, the arguments you laugh about now, the way they make coffee in the morning. We'll write lyrics that only make sense to the two of you.",
      "Choose the mood: a slow ballad, an acoustic love song, a cheerful pop track or something in the style of the music you both grew up with. It can also be in your partner's native language.",
      "It arrives as an MP3 with the lyrics within 24 hours — play it at dinner, in the car, or first thing in the morning."
    ],
    ctaLine: "The years are counted. This song says what they meant.",
    ctaBtn: "Order an anniversary song",
    faq: [
      ["Is it suitable for parents' or grandparents' anniversaries?", "Very much so. Children often order one for their parents' 25th or 50th — tell us the family story and who is giving it."],
      ["Can the song mention our wedding song?", "We can mention it by name in the lyrics. We don't copy other songs' melodies or words."],
      ["Can I add a photo?", "Yes — upload up to three photos in the order form and we'll use one for the song's cover and personal page."]
    ],
    related: ["wedding", "husband", "wife", "valentine"],
    demo: ["vladi", "rocco", "tutso", "krasi"]
  },
  {
    key: "baby", grupa: "occasion", file: "baby-song.html", bg: "podarak-pesen-za-bebeski.html",
    chip: "New baby", menu: "New baby song", teaser: "the first gift a child will listen to for life",
    title: "Custom Song for a New Baby or Baby Shower — €19.90",
    desc: "A personalised song for a newborn or a baby shower: the baby's name, the parents' story and a lullaby or a cheerful welcome. €19.90, ready in 24 hours.",
    kicker: "Welcome to the world",
    h1: "A custom <span class=\"grad-text\">song for a new baby</span> — with their name in it",
    short: "a personalised song for a newborn or a baby shower from Pesenta — the baby's name and the family's story in a lullaby or a cheerful welcome song, €19.90, ready within 24 hours.",
    paras: [
      "Babies get a lot of clothes they outgrow in a month. A song with their name is a gift they'll grow into — first as a lullaby, later as the story of how they arrived.",
      "Tell us the baby's name, when they were born, who the parents are and how they waited for this moment. Older brother or sister? Grandparents counting the days? We'll put them in the song too.",
      "Pick a gentle lullaby, a soft acoustic song or an upbeat welcome for the baby shower. We can also write it in the family's native language.",
      "The MP3 and the lyrics arrive within 24 hours — perfect to play at the shower or to send to the new parents."
    ],
    ctaLine: "A first gift they'll still be playing at eighteen.",
    ctaBtn: "Order a baby song",
    faq: [
      ["Can it be a real lullaby?", "Yes — tell us you want a slow, quiet lullaby and we'll keep the arrangement soft enough for bedtime."],
      ["We don't know the name yet. Can we still order?", "Write the song around “little one”, or wait until the name is chosen — the song is ready within 24 hours either way."],
      ["Can grandparents order it?", "Of course — tell us who the gift is from and we'll write it from their point of view."]
    ],
    related: ["christening", "mom", "grandma"],
    demo: ["krasi", "rocco", "vladi"]
  },
  {
    key: "christening", grupa: "occasion", file: "christening-song.html", bg: "podarak-pesen-za-krashtene.html",
    chip: "Christening", menu: "Christening song", teaser: "a song the godparents will still play in twenty years",
    title: "Custom Christening or Baptism Song Gift — €19.90",
    desc: "A personalised song for a christening or baptism: the child's name, the family and the godparents' wishes. A lasting gift, €19.90, ready in 24 hours.",
    kicker: "For the little one's big day",
    h1: "A custom <span class=\"grad-text\">christening song</span> for the child and the family",
    short: "a personalised christening or baptism song from Pesenta — the child's name, the family's wishes and the godparents' promise in one song, €19.90, ready within 24 hours.",
    paras: [
      "A christening is a day for wishes: what the family hopes for the child, what the godparents promise to be. A song keeps those wishes in a form the child can hear one day — not just read in a card that gets lost.",
      "Tell us the child's name, the parents and godparents, and anything that makes this family special. We'll write a warm, gentle song — never preachy — and you choose the music.",
      "It's a favourite gift from godparents, but grandparents and close friends order it too. Play it at the celebration lunch and send the file to the family afterwards.",
      "The MP3 and the lyrics arrive within 24 hours."
    ],
    ctaLine: "A wish for the child, in a song they can keep.",
    ctaBtn: "Order a christening song",
    faq: [
      ["Can the song be religious?", "It can be as spiritual or as secular as you like — tell us in your story."],
      ["Can it be from the godparents?", "Yes, that's the most common version. Tell us their names and what they want to say."]
    ],
    related: ["baby", "godparent", "grandma"],
    demo: ["rocco", "krasi", "vladi"]
  },
  {
    key: "milestone", grupa: "occasion", file: "milestone-birthday-song.html", bg: "podarak-pesen-za-jubilej.html",
    chip: "Milestone birthday", menu: "Milestone birthday song", teaser: "for the round numbers, when you need the whole story",
    title: "Custom Song for a 40th, 50th, 60th or 70th Birthday",
    desc: "A personalised song for a milestone birthday — 30, 40, 50, 60, 70 — telling the whole life story in a few minutes. €19.90, ready in 24 hours.",
    kicker: "The round numbers",
    h1: "A custom song for a <span class=\"grad-text\">milestone birthday</span>",
    short: "a personalised song for a 30th, 40th, 50th, 60th or 70th birthday from Pesenta — a whole life story in a few minutes of music, €19.90, ready within 24 hours.",
    paras: [
      "A milestone birthday calls for more than another bottle of something nice. Fifty years are a story: where they grew up, the job they loved or hated, the people they raised, the trips, the stubborn habits everyone teases them about.",
      "Tell us the highlights — or let the whole family send details — and we'll fit the decades into a song. The chorus is theirs; the verses walk through the years.",
      "Pick a style from their era: 70s disco, 80s rock, a crooner ballad, a folk tune from where they grew up, or something modern that makes the grandchildren dance.",
      "You get the MP3 and the lyrics within 24 hours, ready for the party."
    ],
    ctaLine: "Half a century deserves its own song.",
    ctaBtn: "Order a milestone song",
    faq: [
      ["Can the whole family contribute?", "Yes — one person orders, but you can collect stories from everyone and paste them all into the form."],
      ["Can you play it at a restaurant?", "Of course — it's a standard MP3 that any DJ or speaker can play."]
    ],
    related: ["birthday", "retirement", "dad", "mom"],
    demo: ["tutso", "rocco", "vladi", "krasi"]
  },
  {
    key: "retirement", grupa: "occasion", file: "retirement-song.html", bg: "podarak-pesen-za-pensionirane.html",
    chip: "Retirement", menu: "Retirement song", teaser: "the last working day deserves more than cake in the kitchen",
    title: "Custom Retirement Song Gift for a Colleague — €19.90",
    desc: "A personalised retirement song for a colleague, boss or parent: the career, the stories from the office and what comes next. €19.90, ready in 24 hours.",
    kicker: "The last working day",
    h1: "A custom <span class=\"grad-text\">retirement song</span> for a career well done",
    short: "a personalised retirement song from Pesenta — a career, its people and its legends in one song, €19.90, ready within 24 hours. A great gift from the whole team.",
    paras: [
      "Thirty years in one place deserve more than a card signed by people from another floor. A retirement song tells the story: the first day, the projects, the coffee machine wars, the boss they outlasted.",
      "The team can collect stories and send them in one order. We write the lyrics with names and inside jokes, and add the plans for what comes next — the garden, the grandchildren, the fishing trips.",
      "Choose a style that fits the person: a big sing-along, a gentle ballad, rock, swing or a style from their youth. Need an invoice for the company? Tick the invoice option in the order form.",
      "The MP3 and lyrics arrive within 24 hours, ready for the farewell party."
    ],
    ctaLine: "Thank them for the years in a way the whole office will remember.",
    ctaBtn: "Order a retirement song",
    faq: [
      ["Can the company pay?", "Yes — tick “I need an invoice” in the order form and enter the company details."],
      ["Can we include the whole team?", "Yes, list the names and one memory per person; we'll fit in as many as the song allows."]
    ],
    related: ["corporate", "boss", "milestone"],
    demo: ["tutso", "vladi", "rocco"]
  },
  {
    key: "engagement", grupa: "occasion", file: "engagement-song.html", bg: "podarak-pesen-za-godej.html",
    chip: "Engagement", menu: "Engagement song", teaser: "the yes has been said — the song remembers the details",
    title: "Custom Engagement or Proposal Song — €19.90 | Pesenta",
    desc: "A personalised song for a proposal or an engagement party: how you met, why it's them, and the question itself. €19.90, ready in 24 hours.",
    kicker: "Will you…?",
    h1: "A custom <span class=\"grad-text\">proposal or engagement song</span>",
    short: "a personalised proposal or engagement song from Pesenta — your story together, ending with the question (or the yes), €19.90, ready within 24 hours.",
    paras: [
      "Planning a proposal? Imagine the song that plays just before you ask is about the two of you — the day you met, the trip where you knew, the little habits you love. The last line is the question.",
      "Already engaged? Friends order engagement songs as a gift for the party: the couple's story, a wink at how long it took, and a toast to the wedding ahead.",
      "Tell us what matters and choose a style — a romantic ballad, an acoustic song, a cheerful pop track. It can be in your partner's language, or in two languages at once.",
      "The MP3 and the lyrics arrive within 24 hours. We keep everything confidential, so the surprise stays a surprise."
    ],
    ctaLine: "Let the song ask the question for you.",
    ctaBtn: "Order a proposal song",
    faq: [
      ["Can the song end with “Will you marry me?”", "Yes — tell us how you want to ask and we'll build the song towards that line."],
      ["Is it confidential?", "Completely. We only talk to you, and the song is not published anywhere."]
    ],
    related: ["wedding", "anniversary", "girlfriend", "boyfriend"],
    demo: ["rocco", "vladi", "krasi"]
  },
  {
    key: "prom", grupa: "occasion", file: "prom-song.html", bg: "podarak-pesen-za-abiturientski-bal.html",
    chip: "Prom / school graduation", menu: "Prom & school graduation song", teaser: "twelve years of school in one song",
    title: "Custom Prom or High School Graduation Song — €19.90",
    desc: "A personalised song for prom or high school graduation: the class, the teachers, the years and what comes next. €19.90, ready in 24 hours.",
    kicker: "The end of school",
    h1: "A custom <span class=\"grad-text\">prom song</span> for the class or one graduate",
    short: "a personalised song for prom or high school graduation from Pesenta — for one graduate or the whole class, €19.90, ready within 24 hours.",
    paras: [
      "Twelve years of school end in one night. A song can hold all of it: the first day, the teachers with their famous sayings, the trips, the exams, the friends who were there every morning.",
      "Parents order it for their son or daughter; classmates order one for the whole class. Give us the names, a few legendary moments and the plans for what comes next.",
      "Choose the energy — an anthem to jump to, a nostalgic ballad for the slow dance, or rap with a line for everyone.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "School ends. The song stays.",
    ctaBtn: "Order a prom song",
    faq: [
      ["Can the whole class be in the song?", "We can fit a lot of names into a rap or a list-style chorus — send them with one detail each."],
      ["Is it suitable as a gift from parents?", "Yes — tell us it's from mum and dad and we'll write it from your point of view."]
    ],
    related: ["graduation", "eighteenth", "teacher"],
    demo: ["krasi", "vladi", "veche"]
  },
  {
    key: "eighteenth", grupa: "occasion", file: "18th-birthday-song.html", bg: "podarak-pesen-za-palnoletie.html",
    chip: "18th birthday", menu: "18th birthday song", teaser: "for your son or daughter, the whole road so far",
    title: "Custom 18th Birthday Song for a Son or Daughter",
    desc: "A personalised 18th birthday song: the whole road from childhood to today, from the people who were there. €19.90, ready in 24 hours.",
    kicker: "Officially an adult",
    h1: "A custom <span class=\"grad-text\">18th birthday song</span> for your son or daughter",
    short: "a personalised 18th birthday song from Pesenta — eighteen years in one song, from parents, siblings or friends, €19.90, ready within 24 hours.",
    paras: [
      "Eighteen is the birthday parents feel most. A song lets you say what's hard to say in a speech: the first steps, the school plays, the teenage years, and how proud you are now.",
      "Or, from friends: the parties, the trips, the driving lessons — the version parents shouldn't hear. Tell us which one you're ordering.",
      "Pick a style they actually listen to — rap, pop, rock, EDM — so it ends up on their playlist, not just in a drawer.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Eighteen years in a song they'll keep.",
    ctaBtn: "Order an 18th birthday song",
    faq: [
      ["Can it be both funny and emotional?", "Yes — tell us the balance you want. Many parents ask for funny verses and an emotional chorus."]
    ],
    related: ["birthday", "prom", "graduation"],
    demo: ["krasi", "vladi", "rosen"]
  },
  {
    key: "corporate", grupa: "occasion", file: "corporate-event-song.html", bg: "podarak-pesen-za-firmeno.html",
    chip: "Company event", menu: "Company event song", teaser: "a team anthem — with an invoice if you need one",
    title: "Custom Song for a Company Event or Team — €19.90",
    desc: "A personalised song for a company party, team-building, anniversary or client gift: your team, your product, your inside jokes. Invoice available. €19.90.",
    kicker: "For the team",
    h1: "A custom <span class=\"grad-text\">song for your company</span> or team event",
    short: "a personalised song for a company party, anniversary or team-building from Pesenta — your team's story and jokes as an anthem, €19.90, ready within 24 hours, with an invoice for the company.",
    paras: [
      "Company parties have a playlist nobody chose. A song about your team — the launch that nearly failed, the legendary client, the office dog — gets the whole room singing, including the people who never dance.",
      "It works for a year-end party, a company anniversary, a team-building, a farewell or as a gift to an important client. Tell us the names, the milestones and the in-jokes that are safe to sing in front of the boss.",
      "Choose the style and the language — we can also write it in English for an international team.",
      "Tick “I need an invoice” in the order form and enter your company details. The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Your team, your story, your anthem.",
    ctaBtn: "Order a team song",
    faq: [
      ["Do you issue invoices?", "Yes — tick the invoice option in the order form and add your company name, address and VAT number."],
      ["Can we use the song in marketing?", "Personal use is included. For commercial use — ads, monetised videos — write to us first and we'll agree on terms."]
    ],
    related: ["retirement", "boss"],
    demo: ["vladi", "glig", "habibi"]
  },
  {
    key: "graduation", grupa: "occasion", file: "graduation-song.html", bg: "podarak-pesen-za-diplomirane.html",
    chip: "Graduation", menu: "Graduation song", teaser: "years of study, one song that knows what they cost",
    title: "Custom University Graduation Song Gift — €19.90",
    desc: "A personalised song for a university graduation: the late nights, the exams, the friends and the diploma at last. €19.90, ready in 24 hours.",
    kicker: "Finally done",
    h1: "A custom <span class=\"grad-text\">graduation song</span> for the new graduate",
    short: "a personalised university graduation song from Pesenta — the years of study and what comes next, €19.90, ready within 24 hours.",
    paras: [
      "Years of lectures, all-nighters and exam stress end with a few seconds on stage. A song makes the moment last: the subject they fought with, the flatmates, the professor everyone imitated, the job that's waiting.",
      "Parents, partners and friends order graduation songs. Tell us the field, the city, the stories and who it's from.",
      "Pick a style for celebrating — a big pop anthem, rock, or a ballad if you want a few tears at the dinner afterwards.",
      "The MP3 and the lyrics arrive within 24 hours."
    ],
    ctaLine: "The diploma goes on the wall. The song goes everywhere.",
    ctaBtn: "Order a graduation song",
    faq: [
      ["Can you mention the university and the degree?", "Yes — names of places, subjects and people make the song personal."]
    ],
    related: ["prom", "eighteenth", "teacher"],
    demo: ["vladi", "krasi", "rocco"]
  },
  {
    key: "housewarming", grupa: "occasion", file: "housewarming-song.html", bg: "podarak-pesen-za-nov-dom.html",
    chip: "Housewarming", menu: "Housewarming song", teaser: "the first music in new walls",
    title: "Custom Housewarming Song Gift for a New Home",
    desc: "A personalised housewarming song: the search, the move, the boxes and the first night in a new home. A gift that's not another plant. €19.90.",
    kicker: "New keys, new walls",
    h1: "A custom <span class=\"grad-text\">housewarming song</span> for a new home",
    short: "a personalised housewarming song from Pesenta — the story of the move and the people who'll fill the house, €19.90, ready within 24 hours.",
    paras: [
      "Every housewarming ends with five plants and three bottles of wine. A song about the new home is the gift that fills it first — before the furniture arrives.",
      "Tell us about the search, the renovation drama, the neighbour, the dog who claimed the sofa, the first dinner in the kitchen. We'll write a song about the people, not the walls.",
      "Choose something to play at the party — funk, pop, swing, acoustic.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Make the new place sound like home.",
    ctaBtn: "Order a housewarming song",
    faq: [
      ["Can it be funny?", "Yes — renovation disasters make excellent lyrics."]
    ],
    related: ["wedding", "anniversary"],
    demo: ["rocco", "habibi", "krasi"]
  },
  {
    key: "teacher", grupa: "occasion", file: "teacher-song.html", bg: "podarak-pesen-za-uchitel.html",
    chip: "For a teacher", menu: "Song for a teacher", teaser: "the whole class in one song",
    title: "Custom Song for a Teacher — Thank-You Gift from the Class",
    desc: "A personalised thank-you song for a teacher from the whole class: their sayings, the lessons and the years together. €19.90, ready in 24 hours.",
    kicker: "Thank you, teacher",
    h1: "A custom <span class=\"grad-text\">song for a teacher</span> from the whole class",
    short: "a personalised thank-you song for a teacher from Pesenta — the class, the sayings and the lessons in one song, €19.90, ready within 24 hours.",
    paras: [
      "Teachers collect mugs and flowers every June. A song from the class is different: it shows they were listening — the famous phrases, the trips, the day the experiment exploded.",
      "Parents or students can order it. Send us the teacher's name, the subject, a few classroom stories and the names of the children if you want them in it.",
      "Choose a cheerful sing-along, a children's song or a heartfelt ballad.",
      "The MP3 and lyrics arrive within 24 hours, ready for the last day of school."
    ],
    ctaLine: "Say thank you in a way the whole school will hear.",
    ctaBtn: "Order a teacher song",
    faq: [
      ["Can the children sing along?", "Yes — ask for a simple chorus and we'll keep it easy to learn."]
    ],
    related: ["prom", "graduation", "coach"],
    demo: ["krasi", "rocco", "vladi"]
  },

  /* ================= ЗА КОГО ================= */
  {
    key: "mom", grupa: "person", file: "song-for-mom.html", bg: "podarak-pesen-za-mama.html",
    chip: "For mom", menu: "Song for mom", teaser: "her story, in her children's words",
    title: "Custom Song for Mom — A Gift She'll Cry Over (€19.90)",
    desc: "A personalised song for your mother: her story, her sayings and what you never managed to tell her. For her birthday, Mother's Day or just because. €19.90.",
    kicker: "For the one who has everything",
    h1: "A custom <span class=\"grad-text\">song for mom</span>, in her children's words",
    short: "a personalised song for your mother from Pesenta — her story and your thank-you in one song, €19.90, ready within 24 hours. For her birthday, Mother's Day or any day.",
    paras: [
      "She says she doesn't need anything. She's right — except this. A song about her: the things she always says, the food nobody can copy, the nights she waited up, what she gave up so you could have more.",
      "Children, grandchildren and partners order songs for mum. Tell us her name, a few memories and what you want her to hear. We'll make it warm without making it a greeting card.",
      "Pick a style she loves — a ballad, a folk song from where she grew up, an old-school pop sound — and the language she feels at home in.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "The only thing you can't buy her — except this.",
    ctaBtn: "Order a song for mom",
    faq: [
      ["Can siblings order one song together?", "Yes — one person orders and sends everyone's memories."],
      ["Can it be in her native language?", "Yes, we write in 14 languages."]
    ],
    related: ["mothers-day", "dad", "grandma", "birthday"],
    demo: ["rocco", "vladi", "krasi"]
  },
  {
    key: "dad", grupa: "person", file: "song-for-dad.html", bg: "podarak-za-tatko.html",
    chip: "For dad", menu: "Song for dad", teaser: "his story, not generic words",
    title: "Custom Song for Dad — His Story, His Song (€19.90)",
    desc: "A personalised song for your father: his jokes, his advice, his car and his stories. For his birthday, Father's Day or retirement. €19.90, ready in 24 hours.",
    kicker: "For the man who fixes everything",
    h1: "A custom <span class=\"grad-text\">song for dad</span> about the man he really is",
    short: "a personalised song for your father from Pesenta — his stories, sayings and the things you never told him, €19.90, ready within 24 hours.",
    paras: [
      "Dads are famously hard to shop for: another tie, another gadget, another bottle. A song about him is the gift that actually lands — his terrible jokes, his advice about money and cars, the way he drove you to every practice.",
      "Tell us what he's like, what you remember from childhood, his hobbies and his catchphrases. We'll write a song that's funny where it should be and honest where it counts.",
      "Pick his music — classic rock, country, folk, a crooner ballad.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "He taught you everything. Give him a song.",
    ctaBtn: "Order a song for dad",
    faq: [
      ["My dad hates sentimental stuff — can it be funny?", "Absolutely. Tell us the tone and we'll keep the tears to one line, or none."]
    ],
    related: ["fathers-day", "mom", "grandpa", "milestone"],
    demo: ["tutso", "glig", "vladi"]
  },
  {
    key: "grandma", grupa: "person", file: "song-for-grandma.html", bg: "podarak-za-baba.html",
    chip: "", menu: "Song for grandma", teaser: "the kitchen, the stories, the love — in one song",
    title: "Custom Song for Grandma — From the Grandchildren",
    desc: "A personalised song for your grandmother from the grandchildren: her kitchen, her stories and her love in one song. €19.90, ready in 24 hours.",
    kicker: "For the heart of the family",
    h1: "A custom <span class=\"grad-text\">song for grandma</span> from the grandchildren",
    short: "a personalised song for your grandmother from Pesenta — her life and the family around her in one song, €19.90, ready within 24 hours.",
    paras: [
      "Grandma has photo albums, embroidered cushions and a cupboard full of jars. What she doesn't have is a song about her — the pancakes, the garden, the stories from when she was young.",
      "Grandchildren of all ages order songs for grandma. Tell us her name, the family, her sayings and what she means to you. We'll write a warm song she'll want played at every family lunch.",
      "Choose a style from her youth — folk, an old-school waltz, a classic ballad — and her language.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Give her a song she can play for the neighbours.",
    faq: [
      ["Can very young grandchildren be in it?", "Yes — we'll mention every grandchild by name if you send the list."]
    ],
    related: ["grandpa", "mom", "milestone"],
    demo: ["rocco", "tutso", "vladi"]
  },
  {
    key: "grandpa", grupa: "person", file: "song-for-grandpa.html", bg: "podarak-za-dyado.html",
    chip: "", menu: "Song for grandpa", teaser: "his stories, finally set to music",
    title: "Custom Song for Grandpa — His Stories in a Song",
    desc: "A personalised song for your grandfather: the stories he tells at every lunch, his garage, his garden and his advice. €19.90, ready in 24 hours.",
    kicker: "For the family storyteller",
    h1: "A custom <span class=\"grad-text\">song for grandpa</span> and his stories",
    short: "a personalised song for your grandfather from Pesenta — the stories he tells at every family lunch, finally set to music, €19.90, ready within 24 hours.",
    paras: [
      "Grandpa has told the same three stories for twenty years. Put them in a song and he'll ask for it to be played again and again — the army, the first car, the way he met grandma.",
      "Send us his name, his stories, his hobbies and what the grandchildren call him. We'll write the song so he hears his own life in it.",
      "Pick music from his youth — rock 'n' roll, folk, swing, a big band — and his language.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "His stories deserve a chorus.",
    faq: [
      ["Can it be for his 80th or 90th birthday?", "Yes — tell us the occasion and we'll write it into the song."]
    ],
    related: ["grandma", "dad", "milestone"],
    demo: ["tutso", "glig", "rocco"]
  },
  {
    key: "sister", grupa: "person", file: "song-for-sister.html", bg: "podarak-za-sestra.html",
    chip: "", menu: "Song for sister", teaser: "the shared room, the secrets, the fights",
    title: "Custom Song for Your Sister — Gift She'll Keep (€19.90)",
    desc: "A personalised song for your sister: the shared room, the borrowed clothes, the secrets you kept for each other. €19.90, ready in 24 hours.",
    kicker: "Sisters",
    h1: "A custom <span class=\"grad-text\">song for your sister</span>",
    short: "a personalised song for your sister from Pesenta — your shared story with all its fights and secrets, €19.90, ready within 24 hours.",
    paras: [
      "Nobody knows you like your sister. The borrowed clothes, the shared room, the secrets you covered for, the fights that are funny now. A song about all of that is a gift no store can sell.",
      "Tell us your story — childhood, the moment she became your best friend, what she's like today. Birthday, wedding, a hard year or just because: tell us the occasion too.",
      "Choose her music and her language.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "For the one who knows all your secrets.",
    faq: [
      ["Can it be from all the siblings?", "Yes — send the names and memories from everyone."]
    ],
    related: ["brother", "girlfriend", "birthday"],
    demo: ["krasi", "rocco", "vladi"]
  },
  {
    key: "brother", grupa: "person", file: "song-for-brother.html", bg: "podarak-za-brat.html",
    chip: "", menu: "Song for brother", teaser: "the one who's had your back since day one",
    title: "Custom Song for Your Brother — €19.90 | Pesenta",
    desc: "A personalised song for your brother: the childhood fights, the adventures and the friendship that stayed. €19.90, ready in 24 hours.",
    kicker: "Brothers",
    h1: "A custom <span class=\"grad-text\">song for your brother</span>",
    short: "a personalised song for your brother from Pesenta — the adventures, the fights and the bond, €19.90, ready within 24 hours. Two of our best-loved songs, “For You, Brother”, started this way.",
    paras: [
      "Some of our favourite songs are for brothers — written by friends and siblings who wanted to say what you never say over a beer.",
      "Tell us about him: the childhood stories, the time he got you out of trouble, his car, his football team, his laugh. We'll write it with humour and with heart.",
      "Pick his style — rap, rock, pop, Balkan, anything.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Say it in a song — he'll pretend not to be moved.",
    faq: [
      ["Can it be for a brother-in-arms, not by blood?", "Of course — best friends count."]
    ],
    related: ["sister", "bachelor", "birthday"],
    demo: ["vladi", "tutso", "rosen"]
  },
  {
    key: "husband", grupa: "person", file: "song-for-husband.html", bg: "podarak-za-saprug.html",
    chip: "", menu: "Song for husband", teaser: "your love story, in his favourite style",
    title: "Custom Song for Your Husband — Love Story Gift (€19.90)",
    desc: "A personalised song for your husband: how you met, what he does that makes you laugh, and what you'd say if you were good at speeches. €19.90.",
    kicker: "For him",
    h1: "A custom <span class=\"grad-text\">song for your husband</span>",
    short: "a personalised song for your husband from Pesenta — your love story in his favourite style, €19.90, ready within 24 hours.",
    paras: [
      "He has the gadgets, the watch and enough socks. A song about your life together is the gift that surprises him — the day you met, the trips, the kids, his habits that drive you crazy and that you secretly love.",
      "Tell us the story and the occasion — birthday, anniversary, Valentine's Day — and we'll write the lyrics you'd say if you loved making speeches.",
      "Pick his music: rock, rap, country, a soulful ballad.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Say it in a way he can play on repeat.",
    faq: [
      ["Can it be funny instead of romantic?", "Yes — tell us the tone. A lot of the best love songs are jokes."]
    ],
    related: ["wife", "anniversary", "valentine"],
    demo: ["vladi", "rocco", "tutso"]
  },
  {
    key: "wife", grupa: "person", file: "song-for-wife.html", bg: "podarak-za-sapruga.html",
    chip: "", menu: "Song for wife", teaser: "the gift that says what flowers can't",
    title: "Custom Song for Your Wife — A Gift She'll Remember",
    desc: "A personalised song for your wife: your story, her smile, the moments only the two of you share. For her birthday, anniversary or just because. €19.90.",
    kicker: "For her",
    h1: "A custom <span class=\"grad-text\">song for your wife</span>",
    short: "a personalised song for your wife from Pesenta — your story together set to music, €19.90, ready within 24 hours.",
    paras: [
      "Flowers last a week, jewellery stays in a box. A song about your life together — the first date, the proposal, the children, the small rituals — is something she'll play again and again.",
      "Tell us what you love about her and what you'd say if you could write songs. We'll find the words and the melody.",
      "Choose the style she loves and the language — even her mother tongue, if it isn't yours.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Tell her in a song — then watch her face.",
    faq: [
      ["Can I upload a photo of us?", "Yes — up to three photos for the song's cover and personal page."]
    ],
    related: ["husband", "anniversary", "valentine"],
    demo: ["rocco", "vladi", "krasi"]
  },
  {
    key: "boyfriend", grupa: "person", file: "song-for-boyfriend.html", bg: "podarak-za-gadzhe.html",
    chip: "", menu: "Song for boyfriend", teaser: "your story so far, in his style",
    title: "Custom Song for Your Boyfriend — €19.90 | Pesenta",
    desc: "A personalised song for your boyfriend: how you met, your jokes, your plans. For his birthday, your anniversary or Valentine's Day. €19.90.",
    kicker: "For him",
    h1: "A custom <span class=\"grad-text\">song for your boyfriend</span>",
    short: "a personalised song for your boyfriend from Pesenta — your story so far, €19.90, ready within 24 hours.",
    paras: [
      "Whether it's been three months or five years, a song about the two of you is a gift he won't see coming — and won't be able to stop sharing with his friends.",
      "Tell us how you met, your first date, your inside jokes and what you love about him. Romantic, funny or both — you decide.",
      "Pick the style he actually listens to, so the song lands on his playlist.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "A gift with your story in it.",
    faq: [
      ["Is it OK if we've only been together a short time?", "Of course — first months are full of great details."]
    ],
    related: ["girlfriend", "valentine", "anniversary"],
    demo: ["vladi", "rosen", "krasi"]
  },
  {
    key: "girlfriend", grupa: "person", file: "song-for-girlfriend.html", bg: "podarak-za-priyatelka.html",
    chip: "", menu: "Song for girlfriend", teaser: "the one gift that's only hers",
    title: "Custom Song for Your Girlfriend — €19.90 | Pesenta",
    desc: "A personalised song for your girlfriend: the day you met, your jokes and what you love about her. For her birthday, Valentine's Day or an anniversary. €19.90.",
    kicker: "For her",
    h1: "A custom <span class=\"grad-text\">song for your girlfriend</span>",
    short: "a personalised song for your girlfriend from Pesenta — your story in a song that's only hers, €19.90, ready within 24 hours.",
    paras: [
      "Want to surprise her with something nobody else could give her? A song about you two — the place you met, the first trip, the joke only you get — does exactly that.",
      "Tell us your story and the occasion. We'll write lyrics that sound like you, not like a card from a petrol station.",
      "Choose a style she loves and a language — even hers, if it's not yours.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Give her a song that's only hers.",
    faq: [
      ["Can it be for a best friend instead?", "Of course — tell us it's for a friend and we'll write it as a friendship song."]
    ],
    related: ["boyfriend", "valentine", "anniversary"],
    demo: ["rocco", "krasi", "vladi"]
  },
  {
    key: "boss", grupa: "person", file: "song-for-boss-or-coworker.html", bg: "podarak-za-shef.html",
    chip: "", menu: "Song for boss or coworker", teaser: "the office legend, finally in a song",
    title: "Custom Song for Your Boss or Coworker — €19.90",
    desc: "A personalised song for a boss or colleague: a birthday, a promotion, a farewell or just a legend in the office. Invoice available. €19.90.",
    kicker: "For the office legend",
    h1: "A custom <span class=\"grad-text\">song for your boss or coworker</span>",
    short: "a personalised song for a boss or colleague from Pesenta — the office stories in one song, €19.90, ready within 24 hours, with an invoice if the company pays.",
    paras: [
      "Every office has a legend — the boss with the famous one-liners, the colleague who fixes everything, the one who's leaving after ten years. A song about them is the best gift the team can give together.",
      "Collect the stories, the catchphrases and the funny moments and send them in one order. We keep the jokes kind enough for HR.",
      "Birthday, promotion, farewell, retirement — tell us the occasion and choose the style.",
      "The MP3 and lyrics arrive within 24 hours; tick the invoice option if the company pays."
    ],
    ctaLine: "One song from the whole team.",
    faq: [
      ["Can the company pay?", "Yes — tick “I need an invoice” and add the company details."]
    ],
    related: ["corporate", "retirement", "birthday"],
    demo: ["vladi", "habibi", "glig"]
  },
  {
    key: "coach", grupa: "person", file: "song-for-coach.html", bg: "podarak-za-trenyor.html",
    chip: "", menu: "Song for a coach", teaser: "from the whole team, for the season",
    title: "Custom Song for a Coach — Gift from the Team (€19.90)",
    desc: "A personalised song for a sports coach from the team: the training sessions, the wins, the famous half-time speeches. €19.90, ready in 24 hours.",
    kicker: "For the coach",
    h1: "A custom <span class=\"grad-text\">song for your coach</span> from the team",
    short: "a personalised song for a coach from Pesenta — the season, the team and the famous speeches in one song, €19.90, ready within 24 hours.",
    paras: [
      "Coaches give years to a team and usually get a signed ball at the end of the season. A song from the team — with the names, the wins, the early practices and the half-time speeches — is a gift they'll remember.",
      "Send us the team, the sport, the season's highlights and the coach's catchphrases.",
      "Choose an anthem to chant in the locker room, or a ballad for the end-of-season dinner.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "Give the coach a song the whole team can chant.",
    faq: [
      ["Can players sing along?", "Ask for a simple chant-style chorus and we'll write one."]
    ],
    related: ["teacher", "boss"],
    demo: ["vladi", "glig", "krasi"]
  },
  {
    key: "godparent", grupa: "person", file: "song-for-godparent.html", bg: "podarak-za-krastnik.html",
    chip: "", menu: "Song for a godparent", teaser: "thank them for being there",
    title: "Custom Song for a Godparent — €19.90 | Pesenta",
    desc: "A personalised song for a godfather or godmother: thank them for being there, from the christening to today. €19.90, ready in 24 hours.",
    kicker: "For the godparents",
    h1: "A custom <span class=\"grad-text\">song for a godparent</span>",
    short: "a personalised song for a godfather or godmother from Pesenta — a thank-you from the godchild or the family, €19.90, ready within 24 hours.",
    paras: [
      "Godparents are there at the christening — and, the good ones, at every birthday after it. A song is a way to thank them for all those years.",
      "Tell us who they are, the memories with the godchild and what the family wants to say.",
      "Pick a warm ballad or a cheerful family song, in any of 14 languages.",
      "The MP3 and lyrics arrive within 24 hours."
    ],
    ctaLine: "A thank-you they can play again and again.",
    faq: [
      ["Can the godchild be the 'singer'?", "Yes — we can write the song from the child's point of view."]
    ],
    related: ["christening", "baby"],
    demo: ["rocco", "vladi", "krasi"]
  },

  /* ================= ПРАЗНИЦИ ================= */
  {
    key: "christmas", grupa: "holiday", file: "christmas-song-gift.html", bg: "podarak-za-koleda.html",
    chip: "Christmas", menu: "Christmas song gift", teaser: "a carol with their name in it",
    title: "Custom Christmas Song Gift — Personalised, €19.90",
    desc: "A personalised Christmas song for family, a partner or friends: their names, your year together and a festive sound. €19.90, ready in 24 hours.",
    kicker: "Under the tree",
    h1: "A custom <span class=\"grad-text\">Christmas song</span> as a gift",
    short: "a personalised Christmas song from Pesenta — your family's or friends' year in a festive song, €19.90, ready within 24 hours. Order early in December.",
    paras: [
      "Christmas music is the same forty songs every year. Add one that's about your people: the family's year, the new baby, the dog that ate the decorations, the cousin who always burns the turkey.",
      "Tell us who it's for and what happened this year. We'll write it with jingle bells or without — a classic festive sound, a cosy ballad or a jazzy swing.",
      "It's an easy gift to send to relatives abroad — they just get the MP3 and the lyrics by email.",
      "Ready within 24 hours. In the last days before Christmas, order as early as you can."
    ],
    ctaLine: "The one Christmas song that's about your family.",
    ctaBtn: "Order a Christmas song",
    faq: [
      ["Can you deliver on Christmas Eve?", "Yes, within 24 hours of payment. In the busiest week, order a few days early to be safe."]
    ],
    related: ["new-year", "valentine", "mom"],
    demo: ["rocco", "krasi", "vladi"]
  },
  {
    key: "new-year", grupa: "holiday", file: "new-year-song.html", bg: "podarak-za-nova-godina.html",
    chip: "New Year", menu: "New Year song", teaser: "the year in review, with a chorus",
    title: "Custom New Year Song — Your Year in Review (€19.90)",
    desc: "A personalised New Year's song for friends, family or a team: the year in review and a toast to the next one. €19.90, ready in 24 hours.",
    kicker: "Goodbye, old year",
    h1: "A custom <span class=\"grad-text\">New Year song</span> for your crew",
    short: "a personalised New Year's song from Pesenta — your year in review and a toast to the next, €19.90, ready within 24 hours.",
    paras: [
      "What happened this year? The wedding, the new job, the trip that went wrong, the resolution that lasted four days. Put it all in a song and play it before midnight.",
      "Great for a party with friends, a family evening or a company celebration. Tell us the highlights and the names.",
      "Choose something to count down to — disco, pop, EDM, swing.",
      "Ready within 24 hours."
    ],
    ctaLine: "Count down with a song about your year.",
    faq: [
      ["Can it be for a company?", "Yes — tick the invoice option in the order form."]
    ],
    related: ["christmas", "corporate"],
    demo: ["habibi", "krasi", "vladi"]
  },
  {
    key: "valentine", grupa: "holiday", file: "valentines-day-song.html", bg: "podarak-za-sveti-valentin.html",
    chip: "Valentine's Day", menu: "Valentine's Day song", teaser: "a love song that's actually about you two",
    title: "Custom Valentine's Day Love Song — €19.90 | Pesenta",
    desc: "A personalised love song for Valentine's Day: how you met, what you love about them, your plans together. €19.90, ready in 24 hours.",
    kicker: "February 14",
    h1: "A custom <span class=\"grad-text\">Valentine's Day song</span> about the two of you",
    short: "a personalised Valentine's Day love song from Pesenta — your story, your words, €19.90, ready within 24 hours.",
    paras: [
      "Roses and chocolates are what everyone gives on February 14th. A love song that's actually about you two — not about some stranger's romance — is what they'll remember.",
      "Tell us how you met, what you love about them, the moment you knew. Romantic, funny or both.",
      "Pick a style and a language — maybe theirs, if it's not yours.",
      "Ready within 24 hours, so even a February 13th idea works."
    ],
    ctaLine: "Skip the roses. Give them a song.",
    ctaBtn: "Order a love song",
    faq: [
      ["Is it OK for a new relationship?", "Yes — keep it light and playful; tell us the tone you want."]
    ],
    related: ["girlfriend", "boyfriend", "anniversary"],
    demo: ["rocco", "vladi", "krasi"]
  },
  {
    key: "mothers-day", grupa: "holiday", file: "mothers-day-song.html", bg: null,
    chip: "For mom", menu: "Mother's Day song", teaser: "the card she'll actually keep",
    title: "Custom Mother's Day Song — Personalised Gift (€19.90)",
    desc: "A personalised Mother's Day song: her story, her sayings and your thank-you, in a song she'll play for years. €19.90, ready within 24 hours.",
    kicker: "Mother's Day",
    h1: "A custom <span class=\"grad-text\">Mother's Day song</span> for mum",
    short: "a personalised Mother's Day song from Pesenta — her story and your thank-you set to music, €19.90, ready within 24 hours.",
    paras: [
      "Mother's Day flowers wilt by Wednesday. A song about her lasts: the lunchboxes, the advice you ignored, the hugs, the way she says your name when you're in trouble.",
      "Tell us her name, a few memories and what you want her to hear. Brothers and sisters can send their memories together.",
      "Choose her favourite style and language.",
      "Ready within 24 hours — even if you remembered on Saturday night."
    ],
    ctaLine: "Make this the Mother's Day gift she keeps.",
    ctaBtn: "Order a Mother's Day song",
    faq: [
      ["Can it be for a grandmother or stepmother?", "Of course — tell us who she is to you."]
    ],
    related: ["mom", "grandma", "fathers-day"],
    demo: ["rocco", "krasi", "vladi"]
  },
  {
    key: "fathers-day", grupa: "holiday", file: "fathers-day-song.html", bg: null,
    chip: "For dad", menu: "Father's Day song", teaser: "better than another tie",
    title: "Custom Father's Day Song — Better Than a Tie (€19.90)",
    desc: "A personalised Father's Day song: his jokes, his advice and what you never told him, in his favourite style. €19.90, ready within 24 hours.",
    kicker: "Father's Day",
    h1: "A custom <span class=\"grad-text\">Father's Day song</span> for dad",
    short: "a personalised Father's Day song from Pesenta — his stories and your thank-you set to music, €19.90, ready within 24 hours.",
    paras: [
      "Another tie, another mug, another barbecue tool. Or a song about him: the dad jokes, the car he swears by, the lessons he taught you without knowing.",
      "Tell us what he's like and what you'd say if you were good with words. We'll keep it as funny or as heartfelt as you want.",
      "Pick his music — classic rock, country, blues, folk.",
      "Ready within 24 hours."
    ],
    ctaLine: "Give him something better than a tie.",
    ctaBtn: "Order a Father's Day song",
    faq: [
      ["Can it be for a grandfather or stepdad?", "Of course — tell us who he is to you."]
    ],
    related: ["dad", "grandpa", "mothers-day"],
    demo: ["tutso", "glig", "vladi"]
  },

  /* ================= ДРУГИ ================= */
  {
    key: "last-minute", grupa: "extra", file: "last-minute-gift.html", bg: "podarak-v-poslednia-moment.html",
    chip: "", menu: "Last-minute gift", teaser: "forgot? it's ready within 24 hours",
    title: "Last-Minute Gift Idea: A Custom Song in 24 Hours",
    desc: "Forgot a birthday or anniversary? Order a personalised song now and get the MP3 within 24 hours — no shipping, no queues. €19.90.",
    kicker: "Forgot? It happens.",
    h1: "The <span class=\"grad-text\">last-minute gift</span> that doesn't look last-minute",
    short: "a personalised song from Pesenta is the last-minute gift that feels planned — written from your story, €19.90, delivered by email within 24 hours, no shipping.",
    paras: [
      "The party is tomorrow and you've got nothing. Shops are closed, delivery takes three days, and a gift card says “I forgot” in capital letters.",
      "A custom song needs five minutes of your time: tell us who it's for and a few stories. Within 24 hours you get an MP3 and the lyrics by email — something that looks like you planned it for weeks.",
      "Need it even sooner? Email " + "sales@pesenta.bg" + " before you pay. When we can, we make it the same day.",
      "Nobody will guess it was last-minute. They'll be too busy listening to their name in the chorus."
    ],
    ctaLine: "Five minutes now. A gift they'll remember.",
    ctaBtn: "Order now",
    faq: [
      ["Is 24 hours guaranteed?", "Yes — within 24 hours of payment and a complete story. Same-day delivery is possible on request, but not promised."]
    ],
    related: ["birthday", "anniversary", "valentine"],
    demo: ["krasi", "vladi", "rocco", "rosen"]
  }
];
