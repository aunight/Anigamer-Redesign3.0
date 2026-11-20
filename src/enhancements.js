(() => {
  'use strict';

  // ── Shared Storage, Settings, Sanitization & Toast Helpers ──
  const SETTINGS_KEY = 'aniAmbientSettingsV1';
  const COL_STATUS_KEY = 'aniCollectionStatesV1';
  const PERM_HIST_KEY = 'aniPermanentHistoryV1';
  const TAG_CACHE_KEY = 'aniTagCacheV1';
  const CAT_EXCLUDE_KEY = 'aniCatalogExcludeV1';
  const WORK_META_CACHE_KEY = 'aniWorkMetaCacheV3';
  const LOCAL_MUTE_KEY = 'aniLocalMutedSendersV1';
  const EP_TITLES_CACHE_KEY = 'aniEpTitlesCacheV5';
  const EP_METADATA_VERSION = 4;
  // 繁中分集資料依中華電信 MOD 的第一季分集介紹改寫。
  const slimeSeasonOneDescriptions = [
    '三上悟遭人持刀襲擊，醒來後發現自己成了史萊姆，還在洞窟裡遇見被封印的暴風龍。',
    '三上與暴風龍交上朋友，並獲得「利姆路」這個名字。他嘗試解開維魯多拉的封印，消息震撼了周邊各國。',
    '離開洞窟後，利姆路遇見正受牙狼族威脅的哥布林。他決定守住村子，迎戰夜裡來襲的牙狼。',
    '為替村子引進工匠，利姆路一行前往矮人王國，卻在入境時惹上麻煩。此時礦坑又傳來鎧龍失控的消息。',
    '利姆路幫凱金解了圍，眾人到店裡慶祝。培斯塔大臣卻當面羞辱利姆路，凱金忍不住動了手。',
    '村子迎來更多哥布林。利姆路也遇到一隊人類冒險者，其中一位叫靜，同樣來自日本。',
    '靜回想自己從戰火中的東京被雷昂召喚到異世界的經過。寄宿在她體內的伊弗利特失控了。',
    '靜想起當年救她的勇者。在生命的最後一刻，她將自己未了的心願託付給利姆路。',
    '村子的建設逐漸上軌道，利姆路卻突然接到求救訊號。他趕到現場時，六名大鬼族正等著他。',
    '利姆路得知大鬼族的家園遭半獸人大軍摧毀，背後似乎還有戴面具的魔人。他提議讓倖存者加入自己的陣營。',
    '紅丸等人加入後，村子變得更加熱鬧。蜥人族的戈畢爾也找上門，想招攬哥布林對抗半獸人大軍。',
    '半獸人君主率軍橫掃朱拉大森林。見情勢危急，守護森林的樹妖精托蕾妮向利姆路求援。',
    '利姆路前往濕地尋求與蜥人族結盟，途中救了戈畢爾的妹妹。她拜託利姆路阻止哥哥貿然迎敵。',
    '魔人喀爾謬德現身，準備利用半獸人君主掌控森林。得知真相後，半獸人君主做出自己的選擇。',
    '戰鬥結束，各族開始商討戰後安排。利姆路說出他對蓋德的承諾，也試著找到讓大家共存的辦法。',
    '城鎮剛恢復平靜，魔王蜜莉姆就突然登門。紅丸和蘭加都擋不住她，利姆路必須想辦法應對。',
    '魔王卡利翁麾下的法比歐闖進城鎮，卻很快被蜜莉姆制伏。利姆路想弄清楚他這趟究竟為何而來。',
    '法比歐對敗給蜜莉姆耿耿於懷。兩名小丑趁機接近他，宣稱暴風大妖渦能給他抗衡魔王的力量。',
    '暴風大妖渦帶著成群巨鯊逼近城鎮。利姆路動員眾人迎敵，卻發現對方的力量遠超預期。',
    '利姆路夢見靜教導被召喚到異世界的孩子。為了完成她的心願，他動身到英格拉西亞王國找那些學生。',
    '利姆路接任老師，但對自己的未來感到不安的孩子們並不信任他。他提議先用一場模擬戰認識彼此。',
    '孩子們的生命所剩無幾。利姆路相信高階精靈能救他們，便帶著大家前往精靈神域。',
    '抵達精靈神域深處後，孩子們一一走上台座嘗試召喚精靈，利姆路在旁等候結果。',
    '在利姆路轉生以前，靜與一群冒險者受邀討伐復活的惡魔。這項委託背後另有隱情。',
  ];
  // 採動畫瘋的系列連續集數。第二、三季依中華電信 MOD，第四季依 Prime Video 與 LiTV 的繁中介紹改寫。
  const slimeSeasonDescriptions = {
    1: { firstEpisode: 1, summaries: slimeSeasonOneDescriptions },
    2: { firstEpisode: 25, summaries: [
      '利姆路準備與獸王國建交。眾人忙著迎賓時，一輛由巨大魔獸拉動的虎車出現在眼前。',
      '獸王國的交涉告一段落，利姆路準備前往德瓦崗參加友好儀式。紫苑堅持要跟著去。',
      '利姆路與蓋札王會談並在典禮上致詞。公務結束後，他瞞著朱菜和紫苑，帶哥布達等人另有行程。',
      '坦派斯特忙著準備迎接利姆路，尤姆則帶著新夥伴繆蘭到訪。法爾姆斯王國也在暗中行動。',
      '繆蘭奉克雷曼之命採取行動。法爾姆斯派來的三名異世界人，也趁利姆路不在時對坦派斯特出手。',
      '坦派斯特遭到攻擊，利姆路在回程也被攔截。出手的人是曾受靜教導的聖騎士坂口日向。',
      '日向將利姆路逼入絕境，他只能用「暴食者」尋找生路。此時坦派斯特已在襲擊中遭受重創。',
      '利姆路查明襲擊背後的陰謀，為失去的同伴悲痛不已。愛蓮帶來了一個意想不到的消息。',
      '為了救回紫苑等人，利姆路決定成為魔王。決戰前，他向同伴坦承自己曾經是人類。',
      '紅丸等人分頭執行反擊計畫，白老再次遇上恭彌和省吾。利姆路則親自迎戰法爾姆斯大軍。',
      '利姆路集齊進化所需的靈魂，開始覺醒。睡意襲來前，他召喚惡魔去追捕逃跑的敵人。',
      '法爾姆斯軍敗退後，坦派斯特仍有許多難題待解。拉斐爾此時帶來無限牢獄已被解析的消息。',
      '慶祝同伴與維爾德拉歸來後，利姆路召集眾人商議下一步，準備公開魔王身分並向克雷曼宣戰。',
      '各國代表來到坦派斯特商討局勢。另一頭，克雷曼一方也在謀劃下一步，而會議迎來意外來客。',
      '利姆路提議讓尤姆成為法爾姆斯的新王。蓋札親口確認尤姆是否願意承擔這項重任。',
      '克雷曼藉利姆路自稱魔王之事召集魔王盛宴。利姆路也開始部署對付克雷曼的行動。',
      '為保護獸王國的居民，利姆路必須趕在克雷曼軍得手前行動。他聽取拉斐爾與秘書的建議調整對策。',
      '克雷曼沒料到利姆路會如此反擊。金、雷昂和身為維爾德拉姊姊的維爾薩澤也開始留意這位新勢力。',
      '紅丸率軍傳送到獸王國，迎戰克雷曼的部隊。相信卡利翁還活著的三獸士也投入戰鬥。',
      '蘇菲亞與米德雷交手陷入苦戰。另一處戰場上，阿爾比思雖然壓制了亞姆札，局勢卻再次生變。',
      '利姆路出發參加魔王盛宴。朱菜等人則前往克雷曼的領地，在城堡附近遇上敵人阻攔。',
      '克雷曼讓蜜莉姆代自己出戰，打亂了原本的決鬥。利姆路迎戰蜜莉姆，紫苑則對上克雷曼。',
      '克雷曼一方節節敗退。他情急之下命令蜜莉姆狂化，企圖讓所有人同歸於盡。',
      '克雷曼覺醒後再度與利姆路對峙。兩人的恩怨和利姆路能否正式成為魔王，都將在這場決戰揭曉。',
    ] },
    3: { firstEpisode: 49, summaries: [
      '利姆路以新任魔王身分結束盛宴，返回坦派斯特。迪亞布羅也回來了，並揭露他促成法爾姆斯求和的手段。',
      '克雷曼之死打亂了優樹的計畫。另一方面，日向與魯米納斯等人商議該如何看待勢力逐漸壯大的利姆路。',
      '利姆路開始處理森林各族的外交事務，派紅丸前往天狗族領地，也想到可以用開國祭招待各國與新居民。',
      '城鎮周邊出現更強的魔物，培斯塔和凱金拿出結界裝置的原型。利姆路也為正煩惱如何帶領部下的蓋德安排任務。',
      '日向在兩支騎士團的會議上提議與利姆路和談。一封看似向她下戰帖的訊息，卻使局勢變得複雜。',
      '大主教遇害的假消息讓各國騎士集結到法爾姆斯，迪亞布羅設法挽回局勢。日向也在途中與聖騎士團會合。',
      '日向在途中看見坦派斯特推動人魔共存的成果，對先前的挑釁更感困惑。同時，聖騎士的先鋒已開始進攻。',
      '坦派斯特被迫迎戰聖騎士團。紫苑展現新能力，利姆路則正面接下日向從靜身上習得的劍技。',
      '利姆路與日向的交鋒仍未結束。迪亞布羅則當著各國記者的面要求愛德華王與尤姆和談。',
      '日向提議以全力一擊為決鬥畫下句點。利姆路成功接招後，她手中的劍卻突然失去控制。',
      '七曜大師遭到魯米納斯處置，戰事落幕。利姆路趁機與日向、魯米納斯商談建交，也得知東方商人的線索。',
      '坦派斯特各部門忙著籌備開國祭。朱菜想邀請同樣來自另一個世界的糕點師吉田到城裡。',
      '各國陸續收到開國祭邀請。菈米莉絲一心想搬到坦派斯特，利姆路也發現她的能力能派上用場。',
      '競技場完工後，利姆路與菈米莉絲接著規劃地下迷宮。當寶箱和陷阱逐步就緒，蜜莉姆突然現身。',
      '森林各族代表前來謁見利姆路。典禮途中結界被打破，三名來意不善的訪客出現在會場。',
      '紅丸為修築道路出使天狗族領地，但紅葉反對在山裡挖隧道。雙方僵持時，族長楓出面了。',
      '利姆路請蒼影查探奴隸交易，卻得知涉案商會已被勇者正幸摧毀。正幸現在正朝坦派斯特而來。',
      '法爾梅納斯成立後，利姆路赴英格拉西亞邀請學生和老師參加開國祭。返抵坦派斯特時，他們遇見了正幸。',
      '開國祭前夕，白老以壽司招待各國賓客，眾人也試著讓米德雷體會料理的滋味。天帝艾爾梅西亞突然到場。',
      '祭典開幕，日向帶孩子們逛攤位，利姆路也巡看各族同伴準備的演出與研究成果。',
      '開國祭的武鬥大會開打，正幸一路晉級。臨時被利姆路推上場的哥布達，也被強敵逼出了底牌。',
      '武鬥大會決賽前，摩邁爾通知利姆路金幣不夠支付貨款。艾爾梅西亞伸出援手，也問起他打算如何約束迪亞布羅。',
      '正幸答應替地下迷宮做宣傳。開國祭最後一天，利姆路在觀眾面前開放迷宮並進行公開測試。',
      '祭典結束後，利姆路趕去替摩邁爾解決貨款問題，提出建立經濟圈的構想，並提醒各國注意幕後的東方商人。',
    ] },
    4: { firstEpisode: 73, summaries: [
      '開國祭過後，冒險者抱怨地下迷宮太難。利姆路召集夥伴討論經營方式，正幸提出了新點子。',
      '休息區與獎金吸引更多挑戰者，迷宮的生意好轉。百人規模的綠亂小隊和入內修練的日向卻讓營運出現新難題。',
      '利姆路一行用假魔體組隊，練習配合以對付綠亂小隊。另一頭，瑪莉安貝爾和優樹私下會面。',
      '利姆路等人擊退綠亂小隊後繼續磨練配合，迷宮也因正幸而聲名大噪。西方諸國則開始討論魔國聯邦。',
      '利姆路應邀出席評議會，以為加入一事已近定案。暗中掌控議會的瑪莉安貝爾早已準備對策。',
      '利姆路解除影響議員的精神干預。艾洛利克王子卻在此時闖入，公開宣稱要討伐他。',
      '利姆路阻止刺殺艾洛利克的計畫，坦派斯特也順利加入評議會。審問刺客時，他推知背後的主使者。',
      '得知優樹可能受人操控，利姆路決定對自由公會提高警覺。即將成行的聯合調查卻讓他難以避開風險。',
      '調查隊在克雷曼城堡下方發現古代遺跡，著手解析術式與壁畫。瑪莉安貝爾一行也正逼近。',
      '瑪莉安貝爾的能力奈何不了利姆路，但優樹突然攔在兩人之間。自由公會的成員選擇相信自己的領袖。',
      '蜜莉姆無法對昔日的朋友混沌龍下手。利姆路提出一個辦法，希望把原本的靈魂救出來。',
      '坦派斯特在評議會的地位更加穩固，利姆路著手推動法治。視察途中，菈米莉絲突然緊急找他。',
      '利姆路為迪亞布羅的請託開始製作附身體，研究室卻缺人手。一位魔王恰巧前來造訪。',
      '迪亞布羅帶著新招攬的惡魔回到坦派斯特，魔國聯邦因此增添了一批戰力。',
      '魔國聯邦持續擴張。同一時間，中庸小丑幫轉而主動接觸魔王雷昂。',
      '魯米納斯與利姆路見面，商討接下來的計畫。',
      '雷昂希望艾爾梅西亞協助尋找克蘿耶，格蘭貝爾的勢力卻在此時攻入魯貝利歐斯。',
      '戴絲特蘿莎出面應付西方諸國的危機。利姆路與雷昂會合，試圖弄清格蘭貝爾的真正目的。',
      '格蘭貝爾的目的終於明朗，利姆路等人發現阻止他的時間已經所剩無幾。',
      '日向在克蘿耶體內恢復意識。兩人這才發現，技能發動後她們已身在兩千年前。',
      '克蘿耶和日向遇見魯米納斯，並以克羅諾亞的身分展開漫長的旅途。',
      '克羅諾亞破封後失控，利姆路召來維爾德拉應戰，並與雷昂聯手尋找解救克蘿耶和日向的方法。',
      '紫苑在與蘭斯洛的交戰中正視自己的弱點，能力也隨之進化。另一邊，利姆路等人準備展開救援。',
      '利姆路設法平息克羅諾亞的暴走。魯米納斯也終於得知，格蘭貝爾為何如此執著於讓勇者覺醒。',
    ] },
  };
  const slimeSeasonTitles = {
    1: '暴風龍維魯多拉｜與哥布林們的邂逅｜哥布林村的戰鬥｜在矮人王國｜英雄王加澤爾・多瓦格｜靜｜爆炎支配者｜繼承的願望｜大鬼族的襲擊｜豬頭帝｜加維爾前來拜見！｜錯亂的齒輪｜大激戰｜吞噬萬物者｜朱拉森林大同盟｜魔王蜜莉姆來襲｜集結的人們｜悄悄逼近的惡意｜暴風大妖渦｜神樂坂優樹｜靜小姐的學生們｜迷宮攻略｜靈魂的救贖｜外傳：黑與假面',
    2: '利姆路忙碌的日常｜與獸王國的交易｜再次來到樂園｜謀略的法爾姆斯王國｜災厄的前奏曲｜展開行動的麗人｜絕望｜希望｜賭上所有的一切｜神之怒｜魔王誕生｜解放者｜造訪者們｜人魔會談｜來自菈米莉絲的消息｜會議漫舞｜會戰前夕｜魔王們｜開宴的信號｜在因緣之地｜食指阿德曼｜魔王盛宴｜起死回生｜八星魔王',
    3: '惡魔與謀策｜聖人的意圖｜和平的日子｜各自的職責｜兩翼會議｜步步逼近的人們｜聖魔激戰｜越陷越深的誤解｜七曜密謀｜神與魔王｜和解與協定｜開幕準備｜各國與邀請函｜迷宮與暴風龍｜謁見典禮｜紅丸的災難｜閃光的勇者｜賓客如雲｜前夜祭｜開國祭｜武鬥大會｜與勇者的決鬥｜迷宮開放｜祭典過後',
    4: '嶄新的日子｜進化的迷宮｜組成假魔體小隊｜邀請函｜最初的一步｜西方諸國評議會｜幕後黑手的真面目｜貪婪的布局｜遺跡調查｜貪婪之主｜蜜莉姆的朋友｜進化的魔國聯邦｜新的夥伴們｜黑色軍團｜不祥的氣息｜黎明勇者格蘭｜集結之地魯貝利歐斯｜西方動亂｜死亡與消失｜勇者克羅諾亞·前篇｜勇者克羅諾亞·後篇｜靈魂的所在｜格蘭貝爾的希望｜勇者覺醒',
  };
  const slimeSpinoffEpisodes = {
    diary: {
      titles: '魔物城鎮的居民們｜春天的空氣｜朱拉的夏天｜穿泳裝過一天｜重現夏日祭典｜逐漸改變｜魔王來了！｜收成的秋天｜冬天的到來｜白雪覆蓋的魔物城鎮｜聖誕老人在哪裡｜享受新年假期',
      // 中華電信 MOD、MyVideo 的繁中分集介紹。
      summaries: [
        '利姆路想把轉生後的經歷寫成日記，卻發現一時寫不完，索性放下筆去看看城裡的日常。',
        '春天到了。為了讓城鎮能自己供應糧食，利姆路號召各族居民一起開墾種菜。',
        '朱拉迎來意外炎熱的夏天。利姆路懷疑這氣溫和自己有關，便帶哥布達等人去抓蟲轉換心情。',
        '利姆路一行到森林另一端的湖邊消暑。換上泳裝後，朱菜和紫苑卻對利姆路的打扮有意見。',
        '為了重現記憶中的日本夏日祭典，利姆路和居民準備攤販、浴衣、盆舞與煙火。',
        '盂蘭盆節到了，靜回來看看利姆路過得如何，卻撞見他穿著兔女郎裝。',
        '魔王蜜莉姆突然造訪坦派斯特，打亂了城裡原本平靜的日常。',
        '秋天收成豐富，居民們開始籌辦豐收祭，也為即將到來的冬天做準備。',
        '冬季來臨，利姆路為了避免火災，帶著居民上街巡邏並提醒大家注意用火。',
        '大雪堆到連門都推不開。坦派斯特正式進入冬季，也有人迫不及待想去滑雪。',
        '利姆路突發奇想，打算在坦派斯特辦一場比前世還熱鬧的聖誕節。',
        '忙完年末活動，坦派斯特換上新年盛裝。利姆路打扮成鏡餅，和大家一起迎接新年。',
      ],
    },
    coleus: {
      titles: '前往柯里烏斯國｜大怪盜阿悟｜紫與薔薇',
      // LiTV 的繁中分集介紹。
      summaries: [
        '教師生活告一段落前，利姆路接下優樹的委託，前往柯里烏斯調查王位之爭。替公主診治時，他察覺有人在背後動手腳。',
        '利姆路走訪支持王子的貴族，保羅則在酒館失了手。兩名王子的衝突一觸即發，利姆路派紅丸與蒼影阻止。',
        '公主出面勸住兩位王子，自己卻被古斯塔夫擄走。保羅試圖救人，魯米納斯與紫色始祖也在此時現身。',
      ],
    },
  };
  // Episode numbers follow AniGamer. Summaries are paraphrased from Prime Video and Shochiku's story pages.
  const polarOppositesSeasonTwoDescriptions = {
    13: '鈴木和谷準備一起過交往後的第一個平安夜。谷為了約會學做蛋糕，認真的模樣讓鈴木心動。',
    14: '寒假裡，山田約西一起寫作業，想趁見面時表明心意，卻一直找不到開口的機會。',
    15: '元旦那天，鈴木突然受邀到谷家拜年。一想到要面對谷的家人，她就緊張得頻頻出糗。',
    16: '平和東在放學路上化解先前的誤會。另一邊，西在梨花子的鼓勵下，說出自己對山田的感情。',
    17: '情人節當天，山田準備和西約會。他一直找不到時機告白，出門前仍在反覆思量該怎麼開口。',
    18: '學期結束，東希望即使重新分班也能繼續和平來往。她還沒弄清楚自己的心意，新學年就要開始了。',
    19: '春假裡，剛成為情侶的山田和西去水族館約會。開學後，東和平則發現兩人被分到了不同班。',
    20: '升上高三，大家開始為畢業後的方向煩惱。鈴木因備考而少了和谷相處的時間，谷也正為自己的下一步猶豫。',
    21: '東察覺自己喜歡平，試著把雀躍藏在心裡。鈴木滿心期待畢業後的生活，身旁的谷卻顯得心事重重。',
    22: '考試愈來愈近，鈴木和谷一起念書、互相打氣。察覺谷還在為升學方向猶豫，鈴木想給他做決定的空間。',
    23: '東發現自己喜歡平，仍和他保持距離。鈴木則擔心埋頭準備考試的谷把自己逼得太緊。',
    24: '大家各自迎來入學考，接著便是畢業典禮。東準備離開時，平想到畢業後或許難再見面，下意識拉住了她。',
    25: '谷回想鈴木是怎麼一步步走進自己的生活。春天來臨，兩人即將展開遠距離交往，在車站迎來分別。',
  };
  const OFFSHELF_CACHE_KEY = 'aniOffshelfCacheV1';
  const TAG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const WORK_META_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  const COL_STATUS_META = [
    ['plan', '待看'],
    ['watching', '追番中'],
    ['completed', '已看完'],
    ['paused', '暫停'],
  ];
  const COL_STATUS_MAP = Object.fromEntries(COL_STATUS_META);

  const enhIcon = (inner, size = 15) =>
    `<svg class="ani-enh-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  let toTraditional;
  const traditionalTitle = (title) => {
    toTraditional ||= globalThis.OpenCC?.Converter({ from: 'cn', to: 'tw' });
    return toTraditional?.(title) ?? title;
  };

  const COL_STATUS_ICONS = {
    all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    plan: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    watching: '<polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/>',
    completed: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    paused: '<g fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></g>',
    unset: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/>',
    auto: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
    clear: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
  };

  const ORIGIN_ICONS = {
    all: COL_STATUS_ICONS.all,
    manga: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    light_novel: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 2v7l2.5-1.5L14 9V2"/>',
    game: '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4m-2-2v4m7-3h.01m2.99 2h.01"/>',
    original: '<path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"/>',
    short: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  };

  const applyShadowMarquee = (box) => {
    if (!box) return;
    let track = box.querySelector(':scope > .ani-marquee-track');
    if (!track) {
      const txt = box.textContent || '';
      track = document.createElement('span');
      track.className = 'ani-marquee-track';
      track.textContent = txt;
      box.replaceChildren(track);
    }
    const avail = box.clientWidth;
    const total = Math.max(box.scrollWidth || 0, track.scrollWidth || 0, track.offsetWidth || 0);
    const distance = avail > 0 ? Math.max(0, total - avail) : 0;
    const isOverflow = distance > 2;
    if (isOverflow) {
      box.dataset.aniMarquee = 'true';
      box.style.setProperty('--ani-marquee-dist', `-${Math.ceil(distance + 16)}px`);
      box.style.setProperty('--ani-marquee-dur', `${Math.max(5.5, (distance + 16) / 16).toFixed(2)}s`);
    } else {
      delete box.dataset.aniMarquee;
      box.style.removeProperty('--ani-marquee-dist');
      box.style.removeProperty('--ani-marquee-dur');
    }
  };

  // ── Filter Switch Motion Helper (emilkowalski-motion + WAAPI skill) ──
  const activeFilterAnims = new WeakMap();
  const animateFilterSwitch = (pillBtn, container, itemSelector) => {
    try {
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (pillBtn && typeof pillBtn.animate === 'function') {
        pillBtn.animate(
          [
            { transform: 'scale(0.95)' },
            { transform: 'scale(1.03)', offset: 0.55 },
            { transform: 'scale(1)' },
          ],
          { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
      if (!container || !itemSelector) return;
      const items = [...container.querySelectorAll(itemSelector)]
        .filter((el) => {
          if (el.hidden || el.hasAttribute('data-ani-ep-hidden')) return false;
          for (const cls of [
            'ani-col-status-hidden',
            'ani-catalog-excluded',
            'ani-origin-hidden',
            'ani-dm-filtered-hidden',
          ]) {
            if (el.classList.contains(cls)) return false;
          }
          return true;
        })
        .slice(0, 12);
      items.forEach((el, idx) => {
        if (typeof el.animate !== 'function') return;
        activeFilterAnims.get(el)?.cancel?.();
        const anim = el.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(0.985)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          {
            duration: 200,
            delay: idx * 14,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          },
        );
        activeFilterAnims.set(el, anim);
      });
    } catch {}
  };

  const escapeHtml = (str) =>
    String(str ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));

  const safeImageUrl = (raw) => {
    if (!raw) return '';
    try {
      const u = new URL(String(raw), location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch {
      return '';
    }
  };

  const formatMmSs = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '—';
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
      : `${m}:${String(rem).padStart(2, '0')}`;
  };

  const formatDateTime = (ts) => {
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const storageGet = async (key, fallback) => {
    let localVal = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localVal = JSON.parse(raw);
    } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        const res = await new Promise((resolve) =>
          chrome.storage.local.get({ [key]: localVal ?? fallback }, (out) => resolve(out?.[key])),
        );
        if (res !== undefined && res !== null && typeof res === typeof (fallback ?? {})) return res;
      } catch {}
    }
    return localVal !== null && typeof localVal === typeof (fallback ?? {}) ? localVal : fallback;
  };

  const storageSet = async (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    if (globalThis.chrome?.storage?.local) {
      try {
        await new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
      } catch {}
    }
  };

  const normalizeSettings = (values) => {
    const mod = globalThis.AniAmbientSettings;
    if (mod?.normalize) return mod.normalize(values, mod.defaults);
    return { ...(mod?.defaults || {}), ...(values || {}) };
  };

  let currentSettings = normalizeSettings({});
  const settingsListeners = new Set();

  const notifySettings = (next) => {
    currentSettings = normalizeSettings(next);
    for (const fn of settingsListeners) {
      try { fn(currentSettings); } catch {}
    }
  };

  const readSettings = async () => {
    const mod = globalThis.AniAmbientSettings;
    const defaults = mod?.defaults || {};
    if (globalThis.AniAmbientStorage?.get) {
      return new Promise((resolve) => {
        globalThis.AniAmbientStorage.get(defaults, (out) => {
          currentSettings = normalizeSettings(out);
          resolve(currentSettings);
        });
      });
    }
    if (globalThis.chrome?.storage?.sync) {
      try {
        const out = await new Promise((resolve) =>
          chrome.storage.sync.get(defaults, (res) => resolve(res || defaults)),
        );
        currentSettings = normalizeSettings(out);
        return currentSettings;
      } catch {}
    }
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        currentSettings = normalizeSettings(saved);
        return currentSettings;
      }
    } catch {}
    return currentSettings;
  };

  const writeSettings = async (patch) => {
    const next = normalizeSettings({ ...currentSettings, ...patch });
    notifySettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    if (globalThis.AniAmbientStorage?.set) {
      try {
        await new Promise((resolve) => globalThis.AniAmbientStorage.set(next, resolve));
      } catch {}
    } else if (globalThis.chrome?.storage?.sync?.set) {
      try {
        await new Promise((resolve) => chrome.storage.sync.set(next, resolve));
      } catch {}
    }
    return next;
  };

  if (globalThis.AniAmbientStorage?.onChanged?.addListener) {
    globalThis.AniAmbientStorage.onChanged.addListener((changes) => {
      const merged = { ...currentSettings };
      for (const [k, delta] of Object.entries(changes || {})) {
        if (delta && 'newValue' in delta) merged[k] = delta.newValue;
      }
      notifySettings(merged);
    });
  }
  if (globalThis.chrome?.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      if (changes?.[SETTINGS_KEY]?.newValue) {
        notifySettings(changes[SETTINGS_KEY].newValue);
        return;
      }
      let touched = false;
      const merged = { ...currentSettings };
      const defaults = globalThis.AniAmbientSettings?.defaults || {};
      for (const [k, delta] of Object.entries(changes || {})) {
        if (Object.hasOwn(defaults, k) && delta && 'newValue' in delta) {
          merged[k] = delta.newValue;
          touched = true;
        }
      }
      if (touched) notifySettings(merged);
    });
  }
  window.addEventListener('storage', (ev) => {
    if (ev.key === SETTINGS_KEY && ev.newValue) {
      try { notifySettings(JSON.parse(ev.newValue)); } catch {}
    }
  });

  let toastTimer = 0;
  const showToast = (message) => {
    let toast = document.querySelector('.ani-enh-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'ani-enh-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.innerHTML = `${enhIcon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>', 18)}<span>${escapeHtml(message || '')}</span>`;
    toast.hidden = false;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.hidden = true;
    }, 2400);
  };

  const getSnFromHref = (href) => {
    if (!href) return '';
    try {
      const m = String(href).match(/[?&]sn=(\d+)/);
      if (m?.[1]) return m[1];
      return new URL(href, location.href).searchParams.get('sn') || '';
    } catch {
      return '';
    }
  };

  // 「我的動畫」收藏狀態：手動標記優先，其餘依集數進度分類。
  let colActiveFilter = 'all';
  let colStatesCache = null;
  let colBusy = false;

  function syncCollectionStatesOnStorage(refresh) {
    window.addEventListener('storage', event => {
      if (event.key !== COL_STATUS_KEY) return;
      try {
        colStatesCache = JSON.parse(event.newValue) || {};
      } catch {
        return;
      }
      refresh();
    });
  }

  async function saveCollectionStatus(sn, choice) {
    colStatesCache = await storageGet(COL_STATUS_KEY, {});
    if (Object.hasOwn(COL_STATUS_MAP, choice)) {
      colStatesCache[sn] = { status: choice, updatedAt: Date.now() };
    } else {
      delete colStatesCache[sn];
    }
    await storageSet(COL_STATUS_KEY, colStatesCache);
  }

  const initCollectionStatusTagger = async () => {
    if (location.pathname !== '/mygather.php') return;
    if (colStatesCache === null) {
      colStatesCache = await storageGet(COL_STATUS_KEY, {});
      if (!colStatesCache || typeof colStatesCache !== 'object') colStatesCache = {};
    }

    const applyAndSync = () => {
      const list = document.querySelector('.animate-theme-list .theme-list-block');
      const filterBody = document.querySelector('.ani-collection-filters .ani-filter-body');
      if (!list) return;
      colBusy = true;
      try {
        const counts = { all: 0, plan: 0, watching: 0, completed: 0, paused: 0, unset: 0 };
        let visibilityChanged = false;
        for (const card of list.querySelectorAll('.theme-list-main')) {
          const sn = getSnFromHref(card.getAttribute('href'));
          const entry = sn ? colStatesCache[sn] : null;
          const manual = entry?.status && Object.hasOwn(COL_STATUS_MAP, entry.status) ? entry.status : '';
          const progress = card.querySelector('.theme-number')?.textContent.match(/(\d+)\s*\/\s*(\d+)/);
          let status = manual || 'unset';
          if (!manual && progress) {
            const [, watched, total] = progress.map(Number);
            status = watched === 0 ? 'plan' : watched >= total ? 'completed' : 'watching';
          }
          counts.all++;
          counts[status]++;

          const matched = colActiveFilter === 'all' || status === colActiveFilter;
          if (card.classList.contains('ani-col-status-hidden') === matched) {
            card.classList.toggle('ani-col-status-hidden', !matched);
            visibilityChanged = true;
          }

          const imgHost = card.querySelector('.theme-img-block') || card.querySelector('.anime-detail-block') || card;
          let bar = card.querySelector('.ani-col-status-bar');
          if (!bar && sn) {
            bar = document.createElement('div');
            bar.className = 'ani-col-status-bar';
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ani-col-status-chip';
            const menu = document.createElement('div');
            menu.className = 'ani-col-status-menu';
            menu.hidden = true;
            for (const [val, label] of COL_STATUS_META) {
              const opt = document.createElement('button');
              opt.type = 'button';
              opt.dataset.choice = val;
              opt.innerHTML = `${enhIcon(COL_STATUS_ICONS[val] || COL_STATUS_ICONS.add, 14)}<span>${escapeHtml(label)}</span>`;
              menu.append(opt);
            }
            const clearOpt = document.createElement('button');
            clearOpt.type = 'button';
            clearOpt.dataset.choice = '';
            clearOpt.innerHTML = `${enhIcon(COL_STATUS_ICONS.auto, 14)}<span>自動</span>`;
            menu.append(clearOpt);
            bar.append(chip, menu);
            imgHost.append(bar);
            card.addEventListener('pointerleave', () => { menu.hidden = true; });

            chip.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const willOpen = menu.hidden;
              for (const other of document.querySelectorAll('.ani-col-status-menu')) {
                other.hidden = true;
              }
              menu.hidden = !willOpen;
            });

            menu.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const btn = ev.target.closest('button[data-choice]');
              if (!btn) return;
              const choice = btn.dataset.choice;
              menu.hidden = true;
              await saveCollectionStatus(sn, choice);
              applyAndSync();
            });
          }
          const chipEl = bar?.querySelector('.ani-col-status-chip');
          if (chipEl && (chipEl.dataset.status !== status || chipEl.dataset.manualStatus !== manual)) {
            chipEl.dataset.status = status;
            chipEl.dataset.manualStatus = manual;
            const labelTxt = COL_STATUS_MAP[status] || '未同步';
            chipEl.innerHTML = enhIcon(COL_STATUS_ICONS[status] || COL_STATUS_ICONS.add, 15);
            chipEl.title = labelTxt;
            chipEl.setAttribute('aria-label', `收藏分類：${labelTxt}`);
            for (const opt of bar.querySelectorAll('.ani-col-status-menu button[data-choice]')) {
              const isAct = opt.dataset.choice === manual;
              opt.classList.toggle('is-active', isAct);
              opt.setAttribute('aria-pressed', String(isAct));
            }
          }
        }

        if (filterBody && !filterBody.querySelector('.ani-custom-status-filter')) {
          const section = document.createElement('section');
          section.className = 'class_list ani-custom-status-filter';
          section.setAttribute('role', 'group');
          section.setAttribute('aria-label', '收藏狀態');
          const header = document.createElement('div');
          header.className = 'ani-extra-filter-header';
          header.innerHTML = `<h3>${enhIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', 20)}收藏狀態</h3>`;
          const ul = document.createElement('ul');
          for (const [key, label] of [['all', '全部'], ...COL_STATUS_META, ['unset', '未同步']]) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.filterStatus = key;
            btn.innerHTML = `<span>${escapeHtml(label)}</span> <small></small>`;
            btn.addEventListener('click', () => {
              colActiveFilter = key;
              applyAndSync();
              animateFilterSwitch(btn, list, '.theme-list-main');
            });
            li.append(btn);
            ul.append(li);
          }
          section.append(header, ul);
          const countEl = filterBody.querySelector('.ani-collection-count');
          if (countEl) countEl.before(section);
          else filterBody.append(section);
        }

        const filterSec = filterBody?.querySelector('.ani-custom-status-filter');
        if (filterSec) {
          for (const btn of filterSec.querySelectorAll('button[data-filter-status]')) {
            const key = btn.dataset.filterStatus;
            const active = key === colActiveFilter;
            btn.setAttribute('aria-pressed', String(active));
            btn.parentElement.classList.toggle('now', active);
            const sm = btn.querySelector('small');
            const label = `(${counts[key] ?? 0})`;
            if (sm && sm.textContent !== label) sm.textContent = label;
          }
        }
        if (visibilityChanged) list.dispatchEvent(new Event('ani-collection-status-change'));
      } finally {
        colBusy = false;
      }
    };

    if (!document.documentElement.dataset.aniColMenuClose) {
      document.documentElement.dataset.aniColMenuClose = '1';
      document.addEventListener('click', (ev) => {
        if (ev.target.closest('.ani-col-status-bar')) return;
        for (const m of document.querySelectorAll('.ani-col-status-menu')) m.hidden = true;
      });
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          for (const m of document.querySelectorAll('.ani-col-status-menu')) m.hidden = true;
        }
      });
    }

    applyAndSync();
    const rootListWrap = document.querySelector('.animate-theme-list');
    if (rootListWrap && !rootListWrap.dataset.aniColStatusObs) {
      rootListWrap.dataset.aniColStatusObs = '1';
      syncCollectionStatesOnStorage(applyAndSync);
      let t = 0;
      new MutationObserver(() => {
        if (colBusy) return;
        clearTimeout(t);
        t = setTimeout(applyAndSync, 40);
      }).observe(rootListWrap, { childList: true, characterData: true, subtree: true });
    }
  };

  const initWatchCollectionStatusButton = async () => {
    if (!['/animeVideo.php', '/animeRef.php'].includes(location.pathname)) return;
    const favBtn = document.querySelector(
      '.anime_name button[onclick*="toggleGather"], button[onclick*="animefun.toggleGather"], .anime-title .anime-option .favorite-btn, .anime_name .favorite-btn',
    );
    if (!favBtn || favBtn.parentElement?.querySelector('.ani-col-status-bar.is-watch-chip')) return;

    const refLink = document.querySelector('.anime_name a[href*="animeRef.php?sn="], .anime-title a[href*="animeRef.php?sn="]');
    const gatherMatch = (favBtn.getAttribute('onclick') || '').match(/toggleGather\(\s*\d+\s*,\s*(\d+)/);
    const sn =
      (location.pathname === '/animeRef.php' ? getSnFromHref(location.href) : '') ||
      gatherMatch?.[1] ||
      getSnFromHref(refLink?.getAttribute('href'));
    if (!sn) return;

    if (colStatesCache === null) {
      colStatesCache = await storageGet(COL_STATUS_KEY, {});
      if (!colStatesCache || typeof colStatesCache !== 'object') colStatesCache = {};
    }

    const bar = document.createElement('div');
    bar.className = 'ani-col-status-bar is-watch-chip';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ani-col-status-chip';
    const menu = document.createElement('div');
    menu.className = 'ani-col-status-menu';
    menu.hidden = true;

    for (const [val, label] of COL_STATUS_META) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.dataset.choice = val;
      opt.innerHTML = `${enhIcon(COL_STATUS_ICONS[val] || COL_STATUS_ICONS.add, 14)}<span>${escapeHtml(label)}</span>`;
      menu.append(opt);
    }
    const clearOpt = document.createElement('button');
    clearOpt.type = 'button';
    clearOpt.dataset.choice = '';
    clearOpt.innerHTML = `${enhIcon(COL_STATUS_ICONS.auto, 14)}<span>自動</span>`;
    menu.append(clearOpt);
    bar.append(chip, menu);
    favBtn.after(bar);
    bar.addEventListener('pointerleave', () => { menu.hidden = true; });

    const syncChip = () => {
      const entry = colStatesCache?.[sn];
      const st = entry?.status && Object.hasOwn(COL_STATUS_MAP, entry.status) ? entry.status : '';
      chip.dataset.status = st;
      const labelTxt = st ? COL_STATUS_MAP[st] : '自動';
      const iconKey = st || 'auto';
      chip.innerHTML = `${enhIcon(COL_STATUS_ICONS[iconKey], 15)}<span>${escapeHtml(labelTxt)}</span>`;
      chip.setAttribute('aria-label', `收藏分類：${labelTxt}`);
      for (const opt of menu.querySelectorAll('button[data-choice]')) {
        const isAct = opt.dataset.choice === st;
        opt.classList.toggle('is-active', isAct);
        opt.setAttribute('aria-pressed', String(isAct));
      }
    };
    syncChip();
    syncCollectionStatesOnStorage(() => { if (bar.isConnected) syncChip(); });

    chip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    menu.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const btn = ev.target.closest('button[data-choice]');
      if (!btn) return;
      const choice = btn.dataset.choice;
      menu.hidden = true;
      await saveCollectionStatus(sn, choice);
      syncChip();
      showToast(choice && COL_STATUS_MAP[choice] ? `已標記為「${COL_STATUS_MAP[choice]}」` : '已切換為自動分類');
    });
  };

  const initCommentSendButton = () => {
    const injectSendButtons = () => {
      for (const iconHost of document.querySelectorAll('#w-post-box .c-reply__editor .comment_icon')) {
        if (iconHost.querySelector('.ani-comment-send-btn')) continue;
        const editor = iconHost.closest('.c-reply__editor');
        const input = editor?.querySelector('.input-article-content, textarea, input[type="text"]');
        if (!input) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-comment-send-btn';
        btn.setAttribute('aria-label', '發送留言');
        btn.title = '發送留言';
        btn.innerHTML =
          '<svg class="ani-player-glyph ani-send-glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="m3 3 19 9-19 9 3-8 10-1-10-1Z"/></svg>';
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          input.focus();
          for (const type of ['keydown', 'keypress', 'keyup']) {
            input.dispatchEvent(
              new KeyboardEvent(type, {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              }),
            );
          }
        });
        iconHost.append(btn);
      }
    };
    injectSendButtons();
    const postBox = document.querySelector('#w-post-box');
    if (postBox && !postBox.dataset.aniCommentSendObs) {
      postBox.dataset.aniCommentSendObs = '1';
      let t = 0;
      new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(injectSendButtons, 80);
      }).observe(postBox, { childList: true, subtree: true });
    }
  };

  // ── Feature 1B: 永久本地觀看紀錄庫 (/animeVideo.php & /viewList.php) ──
  let histWriteQueue = Promise.resolve();
  const mutatePermanentHistory = (mutator) => {
    const job = histWriteQueue.then(async () => {
      const current = await storageGet(PERM_HIST_KEY, {});
      const data = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
      const changed = mutator(data);
      if (changed) {
        const keys = Object.keys(data);
        if (keys.length > 5000) {
          keys
            .sort((a, b) => (data[b]?.watchedAt || 0) - (data[a]?.watchedAt || 0))
            .slice(5000)
            .forEach((oldKey) => { delete data[oldKey]; });
        }
        await storageSet(PERM_HIST_KEY, data);
      }
      return data;
    }).catch(() => ({}));
    histWriteQueue = job.then(() => {}, () => {});
    return job;
  };

  const isLandscapeOgBanner = (url) =>
    !url || /\/OG\/|og_image|\/B\/2KU\/d/i.test(String(url));

  const extractCleanVideoInfo = () => {
    const videoSn = getSnFromHref(location.href);
    const refLink = document.querySelector('a[href*="animeRef.php?sn="]');
    const sn = getSnFromHref(refLink?.getAttribute('href')) || videoSn;
    const rawTitle = (document.querySelector('.anime_name h1')?.textContent || document.title || '').trim();
    const title = rawTitle.replace(/\s*(?:\[\s*\d+(?:\.\d+)?\s*\]|EP\.?\s*\d+(?:\.\d+)?)\s*$/i, '').replace(/\s*-\s*巴哈姆特動畫瘋.*$/, '').trim() || `動畫 #${sn}`;
    const epFromNav = document.querySelector('.season li.playing a')?.textContent?.trim();
    const epFromTitle = rawTitle.match(/(?:\[\s*|EP\.?\s*)(\d+(?:\.\d+)?)\s*\]?\s*$/i)?.[1];
    const episode = epFromNav || epFromTitle || '1';
    const allEpEls = [...document.querySelectorAll('.season li a')];
    const latestEp = allEpEls.length ? (allEpEls[allEpEls.length - 1].textContent || '').trim() : '';
    const rawCover = safeImageUrl(
      document.querySelector('.data-img, .data-file img, .anime_info_detail img')?.getAttribute('src') || '',
    );
    const cover = isLandscapeOgBanner(rawCover) ? '' : rawCover;
    const score =
      document.querySelector('.acg-score .score-overall-number, .score-overall-number')?.textContent?.trim() || '';
    const video = document.querySelector('#ani_video video');
    const isEpisodeMedia = video && !video.closest('.vjs-ad-playing, .vjs-ad-loading, .vjs-anigamer-ad-playing, .vjs-anigamer-m3u8-ad-playing, .ani-age-screen-ready, .ani-has-consent');
    const elapsedSec = isEpisodeMedia && Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : 0;
    let durationSec = isEpisodeMedia && Number.isFinite(video.duration) && video.duration >= 60 ? Math.floor(video.duration) : 0;
    if (!durationSec) {
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const val = JSON.parse(script.textContent);
          for (const item of Array.isArray(val) ? val : val?.['@graph'] || [val]) {
            const m = item?.duration?.match?.(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
            if (m) {
              const sec = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
              if (sec >= 60) durationSec = sec;
            }
          }
        } catch {}
      }
    }
    if (!durationSec && video && Number.isFinite(video.duration) && video.duration > 0 && elapsedSec > 0) {
      durationSec = Math.floor(video.duration);
    }
    return { sn, videoSn, title, episode, latestEp, cover, score, elapsedSec, durationSec, completed: Boolean(isEpisodeMedia && video.ended) };
  };

  const episodeIsComplete = position => Boolean(position?.completed ||
    (position?.durationSec > 0 && position?.elapsedSec >= Math.max(1, position.durationSec - 15)));

  function resolveEpisodeProgress({details, local, native, breakpoint, media}) {
    const duration = [media?.duration, local?.durationSec, native?.durationSec, details?.duration]
      .map(Number).find(value => Number.isFinite(value) && value > 0) || 0;
    const resume = [local, details?.playback, breakpoint, native]
      .filter(item => item?.elapsedSec > 0)
      .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))[0];
    const completed = Boolean(media?.ended || episodeIsComplete(local) || episodeIsComplete(native) ||
      episodeIsComplete({...details?.playback, durationSec: duration}) ||
      (media?.currentTime > 0 && episodeIsComplete({elapsedSec: media.currentTime, durationSec: duration})));
    const fraction = Math.min(1, Math.max(0, Number(native?.fraction) || 0));
    const position = media?.currentTime || resume?.elapsedSec || fraction * duration;
    const elapsed = completed && duration ? duration : duration ? Math.min(duration, position) : position;
    const progress = completed ? 1 : duration ? elapsed / duration : fraction;
    const watchedWithoutTiming = Boolean((local?.watched || native?.watched) && !position && !fraction && !completed);
    return {completed, duration, elapsed,
      progress,
      displayProgress: watchedWithoutTiming ? 1 : progress,
      watchedWithoutTiming,
      watched: Boolean(completed || position > 0 || fraction > 0 || local?.watched || native?.watched),
    };
  }

  const recordVideoProgress = () => {
    if (location.pathname !== '/animeVideo.php') return Promise.resolve();
    const info = extractCleanVideoInfo();
    if (!info.sn) return Promise.resolve();
    const now = Date.now();
    return mutatePermanentHistory((data) => {
      const prev = data[info.sn] && typeof data[info.sn] === 'object' ? data[info.sn] : {};
      const prevEps = prev.episodes && typeof prev.episodes === 'object' ? { ...prev.episodes } : {};
      const videoProgress = { ...prev.videoProgress };
      const previousEpisode = prevEps[info.episode];
      if (previousEpisode?.videoSn && previousEpisode.videoSn !== info.videoSn) {
        videoProgress[previousEpisode.videoSn] ||= previousEpisode;
      }
      const previousVideo = videoProgress[info.videoSn]
        || (previousEpisode?.videoSn === info.videoSn ? previousEpisode : null)
        || (prev.videoSn === info.videoSn ? prev : null);
      const position = {
        videoSn: info.videoSn,
        watchedAt: info.elapsedSec > 0 ? now : previousVideo?.watchedAt || 0,
        durationSec: info.durationSec || previousVideo?.durationSec || 0,
        elapsedSec: info.elapsedSec || previousVideo?.elapsedSec || 0,
        completed: episodeIsComplete(previousVideo) || episodeIsComplete(info),
      };
      if (info.episode) {
        prevEps[info.episode] = position;
      }
      delete videoProgress[info.videoSn];
      const prevCover = isLandscapeOgBanner(prev.cover) ? '' : (prev.cover || '');
      data[info.sn] = {
        ...prev,
        sn: info.sn,
        videoSn: info.videoSn || prev.videoSn || info.sn,
        title: info.title || prev.title || '',
        cover: info.cover || prevCover || '',
        score: info.score || prev.score || '',
        latestEp: info.latestEp || prev.latestEp || '',
        episode: info.episode || prev.episode || '',
        elapsedSec: position.elapsedSec,
        durationSec: position.durationSec,
        completed: position.completed,
        watchedAt: now,
        episodes: prevEps,
        videoProgress,
      };
      return true;
    });
  };

  const initVideoHistoryTracker = () => {
    if (location.pathname !== '/animeVideo.php') return;
    let lastSavedAt = 0;
    const bindVideo = (video) => {
      if (!video || video.dataset.aniPermTracked) return;
      video.dataset.aniPermTracked = '1';
      recordVideoProgress();
      lastSavedAt = Date.now();
      video.addEventListener('timeupdate', () => {
        if (Date.now() - lastSavedAt >= 15000) {
          lastSavedAt = Date.now();
          recordVideoProgress();
        }
      });
      video.addEventListener('pause', () => { recordVideoProgress(); });
      video.addEventListener('ended', () => { recordVideoProgress(); });
    };
    const v = document.querySelector('#ani_video video');
    if (v) bindVideo(v);
    else recordVideoProgress();
    if (!document.documentElement.dataset.aniPermPagehide) {
      document.documentElement.dataset.aniPermPagehide = '1';
      window.addEventListener('pagehide', () => { recordVideoProgress(); });
    }
    const player = document.querySelector('#ani_video');
    if (player && !player.dataset.aniPermObs) {
      player.dataset.aniPermObs = '1';
      new MutationObserver(() => {
        const vid = player.querySelector('video');
        if (vid) bindVideo(vid);
      }).observe(player, { childList: true, subtree: true });
    }
  };

  const parseDateToMs = (raw) => {
    if (!raw) return Date.now();
    const m = String(raw).match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return Date.now();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)).getTime() || Date.now();
  };

  const snapshotNativeHistoryCards = () => {
    const cards = [...document.querySelectorAll('.user-watch-list > .anime-card')];
    if (!cards.length) return Promise.resolve({});
    return mutatePermanentHistory((data) => {
      let changed = false;
      for (const card of cards) {
        const more = card.querySelector('.more-btn');
        const play = card.querySelector('.play-btn[href]') || card.querySelector('.click-area[href]');
        const videoSn = getSnFromHref(play?.getAttribute('href'));
        const sn = more?.dataset.anime || card.querySelector('[data-anime-sn]')?.dataset.animeSn || videoSn;
        if (!sn) continue;
        const title = card.querySelector('.history-anime-title')?.textContent?.trim() || `動畫 #${sn}`;
        const coverEl = card.querySelector('.postimg img');
        const cover = safeImageUrl(coverEl?.dataset.src || coverEl?.getAttribute('src'));
        let episode = card.querySelector('.user-lastwatch')?.textContent?.trim() || '';
        const timingTxt = card.querySelector('.ani-history-timing')?.textContent || '';
        const nativeTxt = [...card.querySelectorAll('.history-lastwatch')].map((n) => n.textContent).join(' ');
        const minSec = nativeTxt.match(/(?:(\d+)\s*時\s*)?(?:(\d+)\s*分\s*)?(\d+)\s*秒/);
        let elapsedSec = minSec ? (Number(minSec[1] || 0) * 3600 + Number(minSec[2] || 0) * 60 + Number(minSec[3])) : 0;
        let durationSec = 0;
        const pb = card.querySelector('.progress-bar');
        const pbMax = Number(pb?.getAttribute('aria-valuemax'));
        const pbNow = Number(pb?.getAttribute('aria-valuenow'));
        if (Number.isFinite(pbMax) && pbMax > 0) durationSec = Math.floor(pbMax);
        if (!elapsedSec && Number.isFinite(pbNow) && pbNow > 0) elapsedSec = Math.floor(pbNow);
        if (!durationSec && /\//.test(timingTxt)) {
          const dm = timingTxt.split('/')[1]?.trim().match(/(?:(\d+):)?(\d+):(\d+)/);
          if (dm) durationSec = Number(dm[1] || 0) * 3600 + Number(dm[2]) * 60 + Number(dm[3]);
        }

        const prev = data[sn] && typeof data[sn] === 'object' ? data[sn] : null;
        const eps = prev?.episodes && typeof prev.episodes === 'object' ? { ...prev.episodes } : {};
        const videoProgress = { ...prev?.videoProgress };
        const previousVideo = videoSn && (prev?.videoSn === videoSn ? prev : videoProgress[videoSn]
          || Object.values(eps).find(entry => entry?.videoSn === videoSn));
        const subList = document.querySelector(`.user-watchTime-list[data-anime-sn="${sn}"], #sub-list-${sn}`);
        let latestMs = prev?.watchedAt || 0;
        if (subList) {
          for (const a of subList.querySelectorAll('a')) {
            const title = a.querySelector('.history-list-anime-title');
            const eTitle = (title?.dataset.aniOriginalTitle || title?.textContent || '').normalize('NFKC');
            const ep = eTitle.match(/\[\s*(\d+(?:\.\d+)?)\s*\]/)?.[1] || eTitle.match(/EP\.(\d+(?:\.\d+)?)/i)?.[1];
            const dateStr = a.querySelector('.date')?.textContent?.trim();
            const ms = parseDateToMs(dateStr);
            if (ms > latestMs) latestMs = ms;
            const eSn = getSnFromHref(a.getAttribute('href'));
            if (!ep || !eSn) continue;
            if (eSn === videoSn) episode = ep;
            const existing = eps[ep];
            const entry = existing?.videoSn === eSn ? existing : videoProgress[eSn];
            const position = { ...entry, videoSn: eSn, watched: true, watchedAt: entry?.watchedAt || ms };
            if (!existing || existing.videoSn === eSn) eps[ep] = position;
            else videoProgress[eSn] = position;
          }
        }
        if (episode && !eps[episode]) {
          eps[episode] = { videoSn: videoSn || sn, watchedAt: latestMs || Date.now(), elapsedSec };
        }
        const scoreTxt =
          card.querySelector('.ani-history-score, .tm-acg-rating, .ani-custom-rating')?.textContent?.match(/([0-5](?:\.\d+)?)/)?.[1] || '';
        const latestMatch =
          nativeTxt.match(/已更新至\s*第?\s*(\d+)\s*集/)?.[1] ||
          card.querySelector('.ani-history-update')?.textContent?.match(/EP\.(\d+)/)?.[1] ||
          '';
        let cachedTags = prev?.tags || [];
        let cachedStudio = prev?.studio || '';
        try {
          const rawMeta = localStorage.getItem(`ani-history-meta:${sn}:${videoSn || sn}`);
          const parsedMeta = rawMeta ? JSON.parse(rawMeta)?.value : null;
          if (parsedMeta?.tags?.length) cachedTags = parsedMeta.tags;
          if (parsedMeta?.studio) cachedStudio = parsedMeta.studio;
          if (!durationSec && parsedMeta?.duration > 0) durationSec = parsedMeta.duration;
        } catch {}
        const merged = {
          ...prev,
          sn,
          videoSn: videoSn || prev?.videoSn || sn,
          title: title || prev?.title || '',
          cover: cover || (!isLandscapeOgBanner(prev?.cover) ? prev?.cover : '') || '',
          score: scoreTxt || prev?.score || '',
          latestEp: latestMatch || prev?.latestEp || '',
          tags: cachedTags,
          studio: cachedStudio,
          episode: episode || prev?.episode || '',
          elapsedSec: elapsedSec || previousVideo?.elapsedSec || 0,
          durationSec: durationSec || previousVideo?.durationSec || 0,
          completed: /觀看結束|已看完/.test(nativeTxt) || episodeIsComplete(previousVideo),
          watchedAt: prev?.watchedAt ? Math.max(prev.watchedAt, latestMs) : (latestMs || Date.now()),
          episodes: eps,
          videoProgress,
        };
        data[sn] = merged;
        changed = true;
      }
      return changed;
    });
  };

  let permHistoryBusy = false;
  let permActiveTab = 'native';

  const initPermanentHistoryPage = async () => {
    if (location.pathname !== '/viewList.php') return;
    await snapshotNativeHistoryCards();

    const hostParent =
      document.querySelector('.history-wrapper') ||
      document.querySelector('.center-container') ||
      document.querySelector('#BH_background');
    const nativeHistory = document.querySelector('#historyList, .history');
    if (!hostParent || document.querySelector('.ani-perm-history-shell')) return;

    const shell = document.createElement('section');
    shell.className = 'ani-perm-history-shell';

    const filterCard = document.createElement('div');
    filterCard.className = 'filter-section ani-browse-filters ani-perm-filter-card';
    filterCard.setAttribute('aria-label', '觀看紀錄分類與篩選');
    filterCard.hidden = true;

    const tabs = document.createElement('div');
    tabs.className = 'ani-perm-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '觀看紀錄來源');
    const tabNative = document.createElement('button');
    tabNative.type = 'button';
    tabNative.className = 'ani-perm-tab';
    tabNative.setAttribute('role', 'tab');
    tabNative.innerHTML = `${enhIcon('<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18"/>', 16)}<span>官方觀看紀錄</span>`;
    const tabPerm = document.createElement('button');
    tabPerm.type = 'button';
    tabPerm.className = 'ani-perm-tab';
    tabPerm.setAttribute('role', 'tab');
    tabPerm.innerHTML = `${enhIcon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', 16)}<span class="ani-perm-tab-label">永久本地紀錄 (0)</span>`;
    tabs.append(tabNative, tabPerm);

    const titleBlock = document.querySelector('#BH_background .theme-title-block');
    if (titleBlock) {
      let actions = titleBlock.querySelector('.ani-section-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'ani-section-actions';
        titleBlock.append(actions);
      }
      actions.prepend(tabs);
    } else {
      const topBar = document.createElement('div');
      topBar.className = 'ani-perm-top-actions';
      topBar.append(tabs);
      shell.append(topBar);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'ani-perm-toolbar';
    toolbar.hidden = true;
    toolbar.innerHTML = `
      <div class="ani-perm-filter-row">
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 20)}觀看狀態</h3>
        </div>
        <div class="ani-perm-filter-pills" role="group" aria-label="進度篩選">
          <button type="button" class="ani-perm-btn" data-perm-prog="all" aria-pressed="true"><span>全部</span></button>
          <button type="button" class="ani-perm-btn" data-perm-prog="inprogress" aria-pressed="false"><span>未看完</span></button>
          <button type="button" class="ani-perm-btn" data-perm-prog="completed" aria-pressed="false"><span>已看完</span></button>
        </div>
      </div>
      <div class="ani-perm-filter-row">
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 20)}搜尋管理</h3>
        </div>
        <div class="ani-perm-manage-row">
          <div class="anime_search-input ani-collection-search-capsule ani-perm-search-capsule">
            <input type="search" class="ani-perm-search" placeholder="搜尋永久觀看紀錄…" aria-label="搜尋永久觀看紀錄">
            <button type="button" class="anime_search-icon ani-perm-search-icon" aria-label="搜尋紀錄" tabindex="-1">
              ${enhIcon('<circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/>', 16)}
            </button>
          </div>
          <div class="ani-perm-io-actions">
            <button type="button" class="ani-perm-btn" data-perm-export title="匯出 JSON">${enhIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', 15)}<span>匯出 JSON</span></button>
            <button type="button" class="ani-perm-btn" data-perm-import title="匯入 JSON">${enhIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', 15)}<span>匯入 JSON</span></button>
            <button type="button" class="ani-perm-btn is-danger" data-perm-clear title="清空永久本地紀錄">${enhIcon(COL_STATUS_ICONS.clear, 15)}<span class="ani-perm-clear-label">清空</span></button>
            <input type="file" data-perm-file accept="application/json,.json" hidden>
          </div>
        </div>
      </div>
    `;

    filterCard.append(toolbar);

    const panel = document.createElement('div');
    panel.className = 'ani-perm-history-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="ani-perm-grid"></div>`;

    shell.append(filterCard, panel);
    if (nativeHistory && nativeHistory.parentElement === hostParent) nativeHistory.before(shell);
    else hostParent.prepend(shell);

    let progFilter = 'all';
    const searchEl = filterCard.querySelector('.ani-perm-search');
    filterCard.querySelector('.ani-perm-search-icon')?.addEventListener('click', () => searchEl?.focus());
    const gridEl = panel.querySelector('.ani-perm-grid');
    const clearBtn = filterCard.querySelector('[data-perm-clear]');
    let openDrawerSn = null;
    let clearArmed = false;

    const syncTabState = (records) => {
      const count = Object.keys(records || {}).length;
      tabPerm.querySelector('.ani-perm-tab-label').textContent = `永久本地紀錄 (${count})`;
      const isPerm = permActiveTab === 'perm';
      tabNative.setAttribute('aria-selected', String(!isPerm));
      tabPerm.setAttribute('aria-selected', String(isPerm));
      filterCard.hidden = !isPerm;
      toolbar.hidden = !isPerm;
      panel.hidden = !isPerm;
      const nativeTargets = new Set([
        ...document.querySelectorAll('.history:not(.ani-perm-grid), #historyList, .history-year-month-block, .history-wrapper .anime-btn-show-more'),
      ]);
      const wrapper = document.querySelector('.history-wrapper');
      if (wrapper) {
        for (const child of wrapper.children) {
          if (child !== shell && !child.classList.contains('ani-perm-history-shell')) {
            nativeTargets.add(child);
          }
        }
      }
      for (const el of nativeTargets) {
        if (el.closest('.ani-perm-history-shell')) continue;
        el.classList.toggle('ani-perm-native-hidden', isPerm);
        if (isPerm) el.setAttribute('data-ani-perm-hidden', '1');
        else el.removeAttribute('data-ani-perm-hidden');
        el.hidden = isPerm;
      }
    };

    const enrichInflight = new Set();
    const enrichPermHistoryItem = async (it) => {
      if (!it?.sn || enrichInflight.has(it.sn) || typeof fetch !== 'function') return;
      const needsCover = !it.cover || isLandscapeOgBanner(it.cover);
      const needsMeta = !Array.isArray(it.tags) || !it.tags.length || !it.studio;
      if (!needsCover && !needsMeta) return;
      enrichInflight.add(it.sn);
      try {
        let fetchedCover = '';
        for (const nativeCard of document.querySelectorAll('.user-watch-list > .anime-card')) {
          const nativeSn =
            nativeCard.querySelector('.more-btn')?.dataset?.anime ||
            nativeCard.querySelector('[data-anime-sn]')?.dataset?.animeSn ||
            getSnFromHref(nativeCard.querySelector('.play-btn, .click-area')?.getAttribute('href'));
          if (nativeSn === String(it.sn)) {
            const cEl = nativeCard.querySelector('.postimg img');
            const cUrl = safeImageUrl(cEl?.dataset?.src || cEl?.getAttribute('src') || '');
            if (cUrl && !isLandscapeOgBanner(cUrl)) {
              fetchedCover = cUrl;
              break;
            }
          }
        }
        let fetchedTags = Array.isArray(it.tags) ? it.tags : [];
        let fetchedStudio = it.studio || '';
        let fetchedScore = it.score || '';
        let fetchedLatest = it.latestEp || '';
        let fetchedDuration = it.durationSec || 0;

        try {
          const rawMeta = localStorage.getItem(`ani-history-meta:${it.sn}:${it.videoSn || it.sn}`);
          const parsedMeta = rawMeta ? JSON.parse(rawMeta)?.value : null;
          if (parsedMeta?.tags?.length) fetchedTags = parsedMeta.tags;
          if (parsedMeta?.studio) fetchedStudio = parsedMeta.studio;
          if (!fetchedDuration && parsedMeta?.duration > 0) fetchedDuration = parsedMeta.duration;
        } catch {}

        const targetUrl = new URL(`animeVideo.php?sn=${encodeURIComponent(it.videoSn || it.sn)}`, location.origin);
        if (targetUrl.origin === location.origin) {
          const resp = await fetch(targetUrl.href, { credentials: 'include' });
          if (resp.ok) {
            const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
            const imgEl = doc.querySelector('.data-img, .data-file img, .anime_info_detail img');
            const rawSrc = safeImageUrl(imgEl?.dataset?.src || imgEl?.getAttribute('src') || '');
            if (rawSrc && !isLandscapeOgBanner(rawSrc)) fetchedCover = rawSrc;
            if (!fetchedTags.length) {
              fetchedTags = [...doc.querySelectorAll('li.type .tag-list .tag')]
                .map((n) => n.textContent.trim())
                .filter((t) => t && t.length < 30);
            }
            if (!fetchedStudio) {
              const stNode = [...doc.querySelectorAll('.title')]
                .find((n) => n.textContent.trim() === '製作廠商')
                ?.parentElement?.cloneNode(true);
              stNode?.querySelector('.title')?.remove();
              fetchedStudio = (stNode?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
            }
            if (!fetchedScore) {
              fetchedScore =
                doc.querySelector('.acg-score .score-overall-number, .score-overall-number')?.textContent?.trim() || '';
            }
            const epLinks = [...doc.querySelectorAll('.season li a')];
            if (epLinks.length) {
              fetchedLatest = (epLinks[epLinks.length - 1].textContent || '').trim();
            }
            if (!fetchedCover) {
              const refHref = doc.querySelector('.anime_name a[href*="animeRef.php?sn="]')?.getAttribute('href');
              if (refHref) {
                const refUrl = new URL(refHref, location.origin);
                if (refUrl.origin === location.origin) {
                  const rResp = await fetch(refUrl.href, { credentials: 'include' });
                  if (rResp.ok) {
                    const rDoc = new DOMParser().parseFromString(await rResp.text(), 'text/html');
                    const rImg = rDoc.querySelector('.data-img, .data-file img');
                    const rSrc = safeImageUrl(rImg?.dataset?.src || rImg?.getAttribute('src') || '');
                    if (rSrc && !isLandscapeOgBanner(rSrc)) fetchedCover = rSrc;
                  }
                }
              }
            }
          }
        }

        if (fetchedCover || fetchedTags.length || fetchedStudio || fetchedScore || fetchedLatest || fetchedDuration) {
          await mutatePermanentHistory((data) => {
            const cur = data[it.sn];
            if (!cur) return false;
            if (fetchedCover) cur.cover = fetchedCover;
            if (fetchedTags.length) cur.tags = fetchedTags;
            if (fetchedStudio) cur.studio = fetchedStudio;
            if (fetchedScore) cur.score = fetchedScore;
            if (fetchedLatest) cur.latestEp = fetchedLatest;
            if (!cur.durationSec && fetchedDuration > 0) cur.durationSec = fetchedDuration;
            return true;
          });
          if (permActiveTab === 'perm') renderGrid();
        }
      } catch {}
    };

    const renderGrid = async () => {
      const records = await storageGet(PERM_HIST_KEY, {});
      syncTabState(records);
      if (permActiveTab !== 'perm') return;
      const q = searchEl.value.trim().toLocaleLowerCase();
      const items = Object.values(records || {})
        .filter((it) => it && typeof it === 'object' && it.sn)
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        .filter((it) => {
          if (q && !(it.title || '').toLocaleLowerCase().includes(q)) return false;
          const isDone = episodeIsComplete(it);
          if (progFilter === 'completed') return isDone;
          if (progFilter === 'inprogress') return !isDone;
          return true;
        });

      if (!items.length) {
        panel.innerHTML = '<div class="ani-perm-empty">尚無符合條件的永久本地紀錄。觀看影片時將自動寫入，超過 180 天也不會消失。</div>';
        return;
      }

      const renderPermCardHtml = (it) => {
        const {duration, elapsed, progress, completed} = resolveEpisodeProgress({local:it});
        const hasDur = duration > 0;
        const hasElapsed = elapsed > 0;
        const pct = Math.round(progress * 100);
        const remSec = hasDur && hasElapsed ? Math.max(0, duration - elapsed) : null;
        const progressLabel =
          completed || remSec === 0
            ? '已看完'
            : remSec !== null
            ? `已看 ${pct}% · 剩餘 ${Math.floor(remSec / 60)}分${String(Math.floor(remSec % 60)).padStart(2, '0')}秒`
            : '';
        const rawCover = safeImageUrl(it.cover);
        const cover = isLandscapeOgBanner(rawCover) ? '' : rawCover;
        const epKeys = Object.keys(it.episodes || {})
          .filter(episode => /^\d+(?:\.\d+)?$/.test(episode))
          .sort((a, b) => Number(b) - Number(a));
        const epListHtml = epKeys
          .map((ep) => {
            const epObj = it.episodes[ep] || {};
            const epSn = encodeURIComponent(epObj.videoSn || it.videoSn || it.sn);
            const epDate = formatDateTime(epObj.watchedAt || it.watchedAt);
            return `<li><a href="animeVideo.php?sn=${epSn}"><span class="history-list-anime-title">EP.${escapeHtml(ep)}</span><span class="date">${escapeHtml(epDate)}</span></a></li>`;
          })
          .join('');
        const drawerId = `perm-sub-list-${escapeHtml(it.sn)}`;
        const open = Boolean(epListHtml) && openDrawerSn === String(it.sn);
        const resumeSn = encodeURIComponent(it.videoSn || it.sn);
        const watchedDate = formatDateTime(it.watchedAt);
        const updateTxt = it.latestEp ? `已更新至 EP.${it.latestEp}` : '';
        const metaLines = [];
        if (Array.isArray(it.tags) && it.tags.length) metaLines.push(`動畫類型：${it.tags.join('、')}`);
        if (it.studio) metaLines.push(`製作組：${it.studio}`);
        const metaTxt = metaLines.join('\n');

        return `
          <div class="ani-perm-watch-slot">
            <article class="anime-card ani-history-card ani-perm-card${open ? ' is-open' : ''}" data-perm-sn="${escapeHtml(it.sn)}">
              <a class="click-area" href="animeVideo.php?sn=${resumeSn}" aria-label="${escapeHtml(it.title)}"></a>
              <button type="button" class="delete-btn ani-perm-del-btn" data-perm-delete="${escapeHtml(it.sn)}" aria-label="刪除「${escapeHtml(it.title)}」的本地紀錄" title="刪除此筆紀錄">×</button>
              <div class="postimg ani-perm-cover-wrap">
                ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(it.title)}" loading="lazy">` : ''}
                ${it.score ? `<span class="ani-history-score">★ ${escapeHtml(it.score)}</span>` : ''}
              </div>
              <div class="anime-info ani-perm-info">
                <p class="history-anime-title ani-perm-title"><span class="ani-marquee-track">${escapeHtml(traditionalTitle(it.title))}</span></p>
                <div class="ani-history-playback">
                  <div class="ani-history-position">
                    <p class="ani-history-timing"><span class="ani-history-elapsed">${hasElapsed ? formatMmSs(elapsed) : '—'}</span> / ${hasDur ? formatMmSs(duration) : '—'}</p>
                    ${pct > 0 ? `<div class="progress-bar" role="progressbar" aria-label="觀看進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress ani-perm-bar-fill" style="width:${pct}%"></div></div>` : ''}
                  </div>
                  ${it.episode ? `<span class="ani-history-episode ani-perm-ep-badge">EP.${escapeHtml(it.episode)}</span>` : ''}
                </div>
                ${progressLabel ? `<p class="ani-history-progress-text">${escapeHtml(progressLabel)}</p>` : ''}
                <div class="ani-history-secondary">
                  ${updateTxt ? `<p class="ani-history-update">${escapeHtml(updateTxt)}</p>` : '<span></span>'}
                  ${watchedDate ? `<span class="ani-perm-watched-at">${escapeHtml(watchedDate)}</span>` : ''}
                </div>
                <div class="ani-history-meta">${escapeHtml(metaTxt)}</div>
              </div>
              <div class="btn-set ani-perm-actions">
                <a class="play-btn round-btn ani-perm-resume" href="animeVideo.php?sn=${resumeSn}">
                  <svg class="ani-history-play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>
                  <span class="ani-history-play-label">繼續觀看</span>
                </a>
                ${epListHtml ? `<button type="button" class="more-btn round-btn ani-perm-more-btn" data-perm-more="${escapeHtml(it.sn)}" aria-controls="${drawerId}" aria-expanded="${open}" aria-label="${open ? '收合' : '展開'}每集紀錄">${enhIcon('<path d="m6 9 6 6 6-6"/>', 18)}</button>` : ''}
              </div>
            </article>
            ${epListHtml ? `<div class="user-watchTime-list ani-perm-ep-drawer" id="${drawerId}" style="display:${open ? 'block' : 'none'}"><div class="watch-list-card"><ul class="user-watch-textlist">${epListHtml}</ul></div></div>` : ''}
          </div>
        `;
      };

      const monthGroups = new Map();
      for (const it of items) {
        const d = new Date(Number(it.watchedAt) || Date.now());
        const label = Number.isNaN(d.getTime()) ? '較早紀錄' : `${d.getFullYear()}年${d.getMonth() + 1}月`;
        if (!monthGroups.has(label)) monthGroups.set(label, []);
        monthGroups.get(label).push(it);
      }

      const openDrawerId = openDrawerSn === null ? '' : `perm-sub-list-${openDrawerSn}`;
      const readEpisodeScroller = () => document.getElementById(openDrawerId)?.querySelector('.user-watch-textlist');
      const episodeScrollTop = openDrawerId ? readEpisodeScroller()?.scrollTop : undefined;
      panel.innerHTML = [...monthGroups.entries()]
        .map(
          ([monthLabel, groupItems]) => `
          <div class="history-year-month-block ani-perm-month-block">
            <div class="date-title">${escapeHtml(monthLabel)}</div>
            <div class="ani-perm-grid">${groupItems.map(renderPermCardHtml).join('')}</div>
          </div>`,
        )
        .join('');
      if (episodeScrollTop !== undefined) {
        const scroller = readEpisodeScroller();
        if (scroller) scroller.scrollTop = episodeScrollTop;
      }
      for (const titleEl of panel.querySelectorAll('.ani-perm-title')) {
        applyShadowMarquee(titleEl);
      }
      for (const it of items.slice(0, 12)) {
        enrichPermHistoryItem(it);
      }
    };

    tabNative.addEventListener('click', () => {
      permActiveTab = 'native';
      renderGrid();
      animateFilterSwitch(tabNative, document.querySelector('.history'), '.anime-card');
    });
    tabPerm.addEventListener('click', async () => {
      permActiveTab = 'perm';
      await renderGrid();
      animateFilterSwitch(tabPerm, panel, '.ani-perm-card');
    });
    searchEl.addEventListener('input', () => { renderGrid(); });
    for (const pb of filterCard.querySelectorAll('[data-perm-prog]')) {
      pb.addEventListener('click', async () => {
        progFilter = pb.dataset.permProg;
        for (const b of filterCard.querySelectorAll('[data-perm-prog]')) {
          b.setAttribute('aria-pressed', String(b === pb));
        }
        await renderGrid();
        animateFilterSwitch(pb, panel, '.ani-perm-card');
      });
    }
    const setDrawerOpen = (button, open) => {
      const slot = button.closest('.ani-perm-watch-slot');
      const card = slot.querySelector('.ani-perm-card');
      const drawer = slot.querySelector('.ani-perm-ep-drawer');
      card.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', `${open ? '收合' : '展開'}每集紀錄`);
      globalThis.aniAnimateHistoryDrawer(drawer, open);
    };
    panel.addEventListener('click', async (ev) => {
      const moreBtn = ev.target.closest('[data-perm-more]');
      if (moreBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        const sn = moreBtn.dataset.permMore;
        const open = openDrawerSn !== sn;
        if (open && openDrawerSn !== null) {
          const previous = panel.querySelector('[data-perm-more][aria-expanded="true"]');
          if (previous) setDrawerOpen(previous, false);
        }
        openDrawerSn = open ? sn : null;
        setDrawerOpen(moreBtn, open);
        return;
      }
      const del = ev.target.closest('[data-perm-delete]');
      if (!del) return;
      ev.preventDefault();
      ev.stopPropagation();
      const sn = del.dataset.permDelete;
      if (openDrawerSn === sn) openDrawerSn = null;
      await mutatePermanentHistory((data) => {
        if (!Object.hasOwn(data, sn)) return false;
        delete data[sn];
        return true;
      });
      showToast('已從永久本地紀錄刪除');
      renderGrid();
    });

    filterCard.querySelector('[data-perm-export]').addEventListener('click', async () => {
      const records = await storageGet(PERM_HIST_KEY, {});
      const payload = JSON.stringify({ format: 'anigamer-redesign-history', version: 1, exportedAt: Date.now(), records }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anigamer-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已匯出永久觀看紀錄');
    });

    const fileInput = filterCard.querySelector('[data-perm-file]');
    filterCard.querySelector('[data-perm-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = parsed?.records && typeof parsed.records === 'object' ? parsed.records : parsed;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('invalid');
        let importedCount = 0;
        await mutatePermanentHistory((data) => {
          for (const [sn, item] of Object.entries(incoming)) {
            if (!/^\d+$/.test(sn) || !item || typeof item !== 'object') continue;
            const prev = data[sn];
            data[sn] = {
              sn,
              videoSn: String(item.videoSn || prev?.videoSn || sn),
              title: String(item.title || prev?.title || `動畫 #${sn}`).slice(0, 120),
              cover: safeImageUrl(item.cover || prev?.cover),
              episode: String(item.episode || prev?.episode || '').slice(0, 16),
              elapsedSec: Math.max(0, Number(item.elapsedSec || 0)),
              durationSec: Math.max(0, Number(item.durationSec || 0)),
              watchedAt: Math.max(Number(item.watchedAt || 0), Number(prev?.watchedAt || 0)) || Date.now(),
              episodes: { ...(prev?.episodes || {}), ...(item.episodes && typeof item.episodes === 'object' ? item.episodes : {}) },
            };
            importedCount++;
          }
          return importedCount > 0;
        });
        showToast(`已匯入 ${importedCount} 筆觀看紀錄`);
        renderGrid();
      } catch {
        showToast('匯入失敗：檔案格式無效');
      } finally {
        fileInput.value = '';
      }
    });

    const setClearLabel = (txt) => {
      const lbl = clearBtn.querySelector('.ani-perm-clear-label');
      if (lbl) lbl.textContent = txt;
      else clearBtn.textContent = txt;
    };

    clearBtn.addEventListener('click', async () => {
      if (!clearArmed) {
        clearArmed = true;
        clearBtn.classList.add('is-armed');
        setClearLabel('再點確認清空');
        setTimeout(() => {
          clearArmed = false;
          clearBtn.classList.remove('is-armed');
          setClearLabel('清空');
        }, 3500);
        return;
      }
      clearArmed = false;
      clearBtn.classList.remove('is-armed');
      setClearLabel('清空');
      await storageSet(PERM_HIST_KEY, {});
      openDrawerSn = null;
      showToast('已清空永久本地紀錄');
      renderGrid();
    });

    await renderGrid();

    const histWrap = document.querySelector('.history');
    if (histWrap && !histWrap.dataset.aniPermObs) {
      histWrap.dataset.aniPermObs = '1';
      let t = 0;
      new MutationObserver(() => {
        if (permHistoryBusy) return;
        clearTimeout(t);
        t = setTimeout(async () => {
          permHistoryBusy = true;
          try {
            await snapshotNativeHistoryCards();
            await renderGrid();
          } finally {
            permHistoryBusy = false;
          }
        }, 200);
      }).observe(histWrap, { childList: true });
    }
  };

  const sendWorkerMessage = (payload) =>
    new Promise((resolve) => {
      try {
        if (!globalThis.chrome?.runtime?.sendMessage) {
          if (payload.acgIds && typeof GM_xmlhttpRequest === 'function') {
            const items = Object.create(null);
            const failed = [];
            Promise.all(Object.entries(payload.acgIds).map(([title, id]) => new Promise(done => {
              const fail = () => { failed.push(title); done(); };
              GM_xmlhttpRequest({
                method: 'GET', url: 'https://acg.gamer.com.tw/acgDetail.php?s=' + encodeURIComponent(id),
                timeout: 8000, anonymous: true, ontimeout: fail, onerror: fail,
                onload(response) {
                  if (response.status !== 200) return fail();
                  items[title] = parseBahamutWorkOrigin(response.responseText);
                  done();
                },
              });
            }))).then(() => resolve({ ok: true, items, failed }), () => resolve(null));
            return;
          }
          resolve(null);
          return;
        }
        chrome.runtime.sendMessage(payload, (resp) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(resp ?? null);
        });
      } catch {
        resolve(null);
      }
    });

  const tagSnMemory = new Map();
  const tagFetchInflight = new Map();

  const readJsonLocal = (key, fallback = {}) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return fallback;
  };

  const writeJsonLocal = (key, obj) => {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {}
  };

  const fetchTagSnSet = (rawTag, hrefOverride = '') => {
    const tag = String(rawTag || '').trim();
    if (!tag) return Promise.resolve(new Set());
    const cachedMem = tagSnMemory.get(tag);
    if (cachedMem && Date.now() - cachedMem.ts < TAG_CACHE_TTL_MS) {
      return Promise.resolve(new Set(cachedMem.sns));
    }
    const cacheMap = readJsonLocal(TAG_CACHE_KEY, {});
    const diskEntry = cacheMap[tag];
    if (diskEntry && Array.isArray(diskEntry.sns) && Date.now() - Number(diskEntry.ts || 0) < TAG_CACHE_TTL_MS) {
      const mem = { ts: Number(diskEntry.ts), sns: new Set(diskEntry.sns) };
      tagSnMemory.set(tag, mem);
      return Promise.resolve(new Set(mem.sns));
    }
    if (tagFetchInflight.has(tag)) return tagFetchInflight.get(tag);

    const job = (async () => {
      const sns = new Set();
      let baseHref = '';
      if (hrefOverride) {
        try {
          const u = new URL(hrefOverride, location.origin);
          if (u.origin === location.origin) baseHref = u.href;
        } catch {}
      }
      if (!baseHref) {
        baseHref = `${location.origin}/animeList.php?tags=${encodeURIComponent(tag)}`;
      }
      let currentUrl = baseHref;
      for (let pageIdx = 1; pageIdx <= 3 && currentUrl; pageIdx++) {
        try {
          const u = new URL(currentUrl, location.origin);
          if (u.origin !== location.origin) break;
          if (pageIdx > 1) u.searchParams.set('page', String(pageIdx));
          const res = await fetch(u.href, {
            credentials: 'include',
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
          });
          if (!res?.ok) break;
          const html = await res.text();
          if (!html) break;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const links = [...doc.querySelectorAll('.theme-list-main, a[href*="animeRef.php?sn="], a[href*="animeVideo.php?sn="]')];
          let foundHere = 0;
          for (const a of links) {
            const sn = getSnFromHref(a.getAttribute('href'));
            if (sn) {
              sns.add(sn);
              foundHere++;
            }
          }
          if (!foundHere) break;
          const hasNextPage = [...doc.querySelectorAll('.page_number a')].some(
            (a) => Number(a.textContent?.trim()) === pageIdx + 1,
          );
          if (!hasNextPage) break;
          currentUrl = baseHref;
        } catch {
          break;
        }
      }
      const ts = Date.now();
      tagSnMemory.set(tag, { ts, sns });
      const freshMap = readJsonLocal(TAG_CACHE_KEY, {});
      freshMap[tag] = { ts, sns: [...sns] };
      // Prune oldest entries if cache grows beyond 40 tags
      const keys = Object.keys(freshMap);
      if (keys.length > 40) {
        keys.sort((a, b) => (freshMap[b]?.ts || 0) - (freshMap[a]?.ts || 0)).slice(40).forEach((k) => delete freshMap[k]);
      }
      writeJsonLocal(TAG_CACHE_KEY, freshMap);
      return new Set(sns);
    })().finally(() => {
      tagFetchInflight.delete(tag);
    });

    tagFetchInflight.set(tag, job);
    return job;
  };

  // ── Feature 2: 所有動畫（片庫）反向排除標籤、原作分類與跳頁電梯 (/animeList.php) ──
  const DEFAULT_CATALOG_TAGS = [
    '動作', '奇幻', '冒險', '校園', '戀愛', '科幻', '懸疑', '治癒',
    '異世界', '泡麵番', 'BL', 'GL', '恐怖', '機戰', '運動',
  ];
  const ORIGIN_OPTIONS = [
    ['all', '全部'],
    ['manga', '漫畫改編'],
    ['light_novel', '輕小說改編'],
    ['game', '遊戲改編'],
    ['original', '原創動畫'],
    ['short', '輕動畫 / 泡麵番'],
  ];
  const ORIGIN_BADGE_LABELS = {
    manga: '漫改',
    light_novel: '輕改',
    game: '遊改',
    original: '原創',
    short: '輕動畫',
  };

  const buildCatalogPageUrl = (pageNum, baseHref = location.href) => {
    const u = new URL(baseHref, location.origin);
    const n = Math.max(1, Math.floor(Number(pageNum) || 1));
    u.searchParams.set('page', String(n));
    return u.href;
  };

  const initCatalogEnhancements = () => {
    const isCollection = location.pathname === '/mygather.php';
    if (!isCollection && location.pathname !== '/animeList.php') return;
    const filterSection = document.querySelector(isCollection ? '.ani-collection-filters' : '.filter-section');
    const filterBody = filterSection?.querySelector('.ani-filter-body') || filterSection;
    const listBlock = document.querySelector('.animate-theme-list .theme-list-block');
    if (!listBlock || !filterBody || listBlock.dataset.aniCatalogObs) return;

    // Collect ALL native 屬性 tags before injecting extra panels
    const tagLinks = new Map();
    if (!isCollection) {
      const tagAnchors = [
        ...filterSection.querySelectorAll('.class_list a[href*="tags="]'),
        ...filterSection.querySelectorAll('.class_list a'),
      ];
      for (const a of tagAnchors) {
        const label = (a.textContent || '').trim();
        const href = a.getAttribute('href') || '';
        if (!label || label === '全部' || label.length > 16 || /^javascript:/i.test(href)) continue;
        // Skip year/target/audio filter links unless they are actual tag links
        if (href && !/tags=/i.test(href) && /(?:year|target|audio|sort)=/i.test(href)) continue;
        if (!tagLinks.has(label)) tagLinks.set(label, href);
      }
    }
    for (const dt of DEFAULT_CATALOG_TAGS) {
      if (!tagLinks.has(dt)) tagLinks.set(dt, '');
    }
    const availableTags = [...tagLinks.keys()];

    const savedEx = isCollection ? {} : readJsonLocal(CAT_EXCLUDE_KEY, { tags: [], keyword: '' });
    const excludedTags = new Set(Array.isArray(savedEx.tags) ? savedEx.tags.map((t) => String(t).trim()).filter(Boolean) : []);
    let excludeKeyword = String(savedEx.keyword || '');
    let activeOrigin = 'all';
    const metaCache = Object.assign(Object.create(null), readJsonLocal(WORK_META_CACHE_KEY, {}));
    const metaPending = new Set();
    const metaFailed = new Set();
    const directMisses = new Map();
    let originQueue = Promise.resolve();
    let excludedSns = new Set();
    let exclusionRevision = 0;

    const saveExcludeState = () => {
      writeJsonLocal(CAT_EXCLUDE_KEY, { tags: [...excludedTags], keyword: excludeKeyword });
    };

    const getCardCleanTitle = (card) =>
      (card.querySelector('.theme-name')?.textContent || '')
        .replace(/\s*\[\s*\d+(?:\.\d+)?\s*\]\s*$/, '')
        .trim();

    const ensureOriginBadge = (card, meta) => {
      if (!meta) return;
      const host = card.querySelector('.theme-img-block');
      if (!host) return;
      let badge = host.querySelector('.ani-origin-badge');
      if (isCollection) {
        badge?.remove();
        return;
      }
      const badgeKey = meta.isShort ? 'short' : meta.source;
      const label = ORIGIN_BADGE_LABELS[badgeKey];
      if (!label) return;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ani-origin-badge';
        host.append(badge);
      }
      if (badge.textContent !== label) badge.textContent = label;
    };

    const updateText = (selector, text) => {
      const status = filterBody?.querySelector(selector);
      if (status && status.textContent !== text) status.textContent = text;
    };

    let renderFrame = null;
    const scheduleCatalogFilters = () => {
      if (renderFrame !== null) return;
      renderFrame = requestAnimationFrame(() => {
        renderFrame = null;
        applyCatalogFilters();
      });
    };

    const settleOrigin = (title, meta, failed = false) => {
      if (failed) metaFailed.add(title);
      else metaCache[title] = {
        source: 'other', isShort: false, ...meta, originChecked: true,
        ts: Date.now() - (meta ? 0 : WORK_META_TTL_MS - 3600000),
      };
      metaPending.delete(title);
    };

    const publishOrigins = () => {
      const keys = Object.keys(metaCache);
      const recentCache = keys.length <= 400 ? metaCache : Object.fromEntries(
        keys.sort((a, b) => metaCache[b].ts - metaCache[a].ts).slice(0, 400).map((key) => [key, metaCache[key]]),
      );
      writeJsonLocal(WORK_META_CACHE_KEY, recentCache);
      scheduleCatalogFilters();
    };

    const loadOriginBatch = async (entries) => {
      const newTitles = entries.filter(([title, , acgId]) => !directMisses.has(title) && !(acgId && activeOrigin === 'game')).map(([title]) => title);
      if (newTitles.length) {
        const response = await sendWorkerMessage({ type: 'ani-fetch-work-meta', titles: newTitles });
        for (const title of newTitles) {
          const hit = response?.items?.[title];
          if (hit?.source && hit.source !== 'other' && (activeOrigin !== 'game' || hit.source === 'game')) settleOrigin(title, hit);
          else directMisses.set(title, { hit, failed: !response?.ok });
        }
        publishOrigins();
      }

      for (let index = 0; index < entries.length; index += 6) {
        const candidates = entries.slice(index, index + 6).filter(([title]) => metaPending.has(title));
        const acgIds = Object.create(null);
        await Promise.all(candidates.map(async ([title, sn, cardAcgId]) => {
          if (activeOrigin === 'all' || !listBlock.isConnected) {
            metaPending.delete(title);
            return;
          }
          if (cardAcgId) { acgIds[title] = cardAcgId; return; }
          if (!sn) {
            const previous = directMisses.get(title);
            settleOrigin(title, previous?.hit, previous?.failed);
            return;
          }
          try {
            const request = globalThis.AniAmbientFetch || fetch;
            const response = await request(`https://ani.gamer.com.tw/animeRef.php?sn=${sn}`, {
              credentials: 'same-origin', ...(globalThis.AniAmbientFetch ? { timeoutMs: 8000 } : { signal: AbortSignal.timeout(8000) }),
            });
            if (!response.ok) throw new Error('Work page unavailable');
            const html = await response.text();
            const acgId = html.match(/href=["'](?:https:)?\/\/acg\.gamer\.com\.tw\/acgDetail\.php\?s=(\d+)["']/i)?.[1];
            if (acgId) acgIds[title] = acgId;
            else {
              const previous = directMisses.get(title);
              settleOrigin(title, previous?.hit && { ...previous.hit, officialChecked: true }, previous?.failed);
            }
          } catch {
            settleOrigin(title, null, true);
          }
        }));
        const unresolved = Object.keys(acgIds);
        if (unresolved.length) {
          const response = await sendWorkerMessage({ type: 'ani-fetch-work-meta', titles: unresolved, acgIds });
          for (const title of unresolved) {
            const official = response?.items?.[title];
            const previous = directMisses.get(title);
            const meta = official
              ? { ...previous?.hit, ...official, isShort: official.isShort || Boolean(previous?.hit?.isShort), officialChecked: true }
              : { ...previous?.hit, officialChecked: true };
            settleOrigin(title, meta, !response?.ok || Boolean(response.failed?.includes(title)) || (!official && Boolean(previous?.failed)));
          }
        }
        if (candidates.length) publishOrigins();
      }
    };

    const applyCatalogFilters = () => {
      const kwTokens = excludeKeyword.split(/[,，、\n]+/).map((word) => word.trim().toLocaleLowerCase()).filter(Boolean);
      const missing = new Map();
      let visibilityChanged = false;
      let pendingCount = 0;
      let excludedCount = 0;
      let originShown = 0;
      let unknownCount = 0;
      const now = Date.now();

      for (const card of listBlock.querySelectorAll('.theme-list-main')) {
        const sn = getSnFromHref(card.getAttribute('href'));
        const title = getCardCleanTitle(card);
        const text = kwTokens.length ? (card.textContent || '').toLocaleLowerCase() : '';
        const isExcluded = excludedSns.has(sn) || kwTokens.some((word) => text.includes(word));
        card.classList.toggle('ani-catalog-excluded', isExcluded);
        if (isExcluded) excludedCount++;

        const cached = Object.hasOwn(metaCache, title) ? metaCache[title] : null;
        const meta = cached && (cached.source !== 'other' || cached.originChecked) &&
          now - Number(cached.ts || 0) < WORK_META_TTL_MS ? cached : null;
        const shortHint = /泡麵番|輕動畫|短篇/.test(title) ||
          [...card.querySelectorAll('.label-edition, .theme-time, .theme-number')].some((badge) => /泡麵番|輕動畫|短篇/.test(badge.textContent));
        const episodeText = card.querySelector('.theme-number');
        const availableEpisodes = Number(episodeText?.dataset.aniTotalEpisodes
          || episodeText?.textContent.match(/(\d+)\s*集\s*$/)?.[1]);
        const matchesEpisodeCount = !meta?.episodes || !(availableEpisodes > meta.episodes);
        const isShort = shortHint || (meta?.isShort && matchesEpisodeCount);
        if (meta || isShort) ensureOriginBadge(card, { source: meta?.source, isShort });
        const eligible = !card.hidden && !card.classList.contains('ani-col-status-hidden') && !isExcluded;
        const verifyGameOrigin = activeOrigin === 'game' && meta && meta.source !== 'game' && !meta.officialChecked;
        if (title && (!meta || verifyGameOrigin) && !metaFailed.has(title)) {
          if (verifyGameOrigin) directMisses.set(title, { hit: meta });
          const lookupNeeded = activeOrigin !== 'all' ? eligible : !directMisses.has(title);
          if (lookupNeeded && !metaPending.has(title)) {
            const action = card.querySelector('[onclick*="toggleGather"]')?.getAttribute('onclick');
            const acgId = action?.match(/toggleGather\(\s*(\d+)\s*,/)?.[1];
            missing.set(title, [title, sn, acgId]);
          }
          if (eligible && (lookupNeeded || metaPending.has(title))) pendingCount++;
        }
        if (eligible && meta?.source === 'other' && !meta.format) unknownCount++;

        const matches = activeOrigin === 'short' ? isShort : meta?.source === activeOrigin;
        const hideByOrigin = activeOrigin !== 'all' && !matches;
        if (card.classList.contains('ani-origin-hidden') !== hideByOrigin) {
          card.classList.toggle('ani-origin-hidden', hideByOrigin);
          visibilityChanged = true;
        }
        if (eligible && !hideByOrigin) originShown++;
      }

      updateText('.ani-exclude-count', excludedCount ? `已排除 ${excludedCount} 部` : '');
      const busy = String(pendingCount > 0);
      if (listBlock.dataset.aniOriginBusy !== busy) listBlock.dataset.aniOriginBusy = busy;
      const pageState = listBlock.dataset.aniBrowsePages;
      let status = `符合此原作分類：${originShown} 部`;
      if (pageState === 'cooldown') status = `已找到 ${originShown} 部，巴哈暫時限制請求，稍後自動接續`;
      else if (pageState === 'failed') status = `已找到 ${originShown} 部，後續頁面載入失敗`;
      else if (pendingCount) status = `已找到 ${originShown} 部，正在比對 ${pendingCount} 部…`;
      else if (pageState === 'pending') status = `已找到 ${originShown} 部，正在搜尋其餘頁面…`;
      else if (metaFailed.size) status = `已找到 ${originShown} 部，點分類重試比對`;
      else if (unknownCount) status += `，另有 ${unknownCount} 部原作未確認`;
      updateText('.ani-origin-status', activeOrigin === 'all' ? '' : status);
      if (isCollection && visibilityChanged) listBlock.dispatchEvent(new Event('ani-origin-results-change'));

      const entries = [...missing.values()];
      for (const title of missing.keys()) metaPending.add(title);
      for (let i = 0; i < entries.length; i += 30) {
        const batch = entries.slice(i, i + 30);
        originQueue = originQueue.then(() => listBlock.isConnected && loadOriginBatch(batch));
      }
    };

    const updateTagExclusions = async () => {
      const revision = ++exclusionRevision;
      const sets = await Promise.all([...excludedTags].map((tag) => fetchTagSnSet(tag, tagLinks.get(tag) || '')));
      if (revision !== exclusionRevision) return;
      excludedSns = new Set(sets.flatMap((set) => [...set]));
      applyCatalogFilters();
    };

    // 2A & 2B panels appended at the END of .ani-filter-body (preserving 年份 as firstElementChild & .class-header svg === 4)
    if (!isCollection && !filterBody.querySelector('.ani-exclude-panel')) {
      const exPanel = document.createElement('section');
      exPanel.className = 'ani-exclude-panel';
      exPanel.setAttribute('aria-label', '反向排除篩選');
      exPanel.innerHTML = `
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>', 20)}排除標籤</h3>
          <span class="ani-exclude-count" role="status"></span>
        </div>
        <div class="ani-exclude-body">
          <div class="ani-exclude-pills"></div>
          <div class="ani-exclude-controls">
            <div class="anime_search-input ani-collection-search-capsule ani-exclude-search-capsule">
              <input type="search" class="ani-exclude-keyword" placeholder="輸入要排除的關鍵字（逗號分隔）…" aria-label="排除關鍵字">
              <button type="button" class="anime_search-icon ani-exclude-search-icon" aria-label="搜尋排除關鍵字" tabindex="-1">
                ${enhIcon('<circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/>', 16)}
              </button>
            </div>
            <button type="button" class="ani-exclude-clear" title="清除排除" aria-label="清除排除">
              ${enhIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', 16)}
              <span>清除排除</span>
            </button>
          </div>
        </div>
      `;
      const pillsWrap = exPanel.querySelector('.ani-exclude-pills');
      for (const tag of availableTags) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-exclude-pill';
        btn.dataset.excludeTag = tag;
        const active = excludedTags.has(tag);
        btn.classList.toggle('is-excluded', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.textContent = tag;
        btn.addEventListener('click', () => {
          if (excludedTags.has(tag)) excludedTags.delete(tag);
          else excludedTags.add(tag);
          const nowEx = excludedTags.has(tag);
          btn.classList.toggle('is-excluded', nowEx);
          btn.setAttribute('aria-pressed', String(nowEx));
          saveExcludeState();
          void updateTagExclusions();
          animateFilterSwitch(btn, listBlock, '.theme-list-main');
        });
        pillsWrap.append(btn);
      }
      const kwInput = exPanel.querySelector('.ani-exclude-keyword');
      exPanel.querySelector('.ani-exclude-search-icon')?.addEventListener('click', () => kwInput?.focus());
      kwInput.value = excludeKeyword;
      let kwTimer = 0;
      kwInput.addEventListener('input', () => {
        excludeKeyword = kwInput.value;
        saveExcludeState();
        clearTimeout(kwTimer);
        kwTimer = setTimeout(applyCatalogFilters, 80);
      });
      const clearExBtn = exPanel.querySelector('.ani-exclude-clear');
      clearExBtn.addEventListener('click', () => {
        excludedTags.clear();
        excludeKeyword = '';
        kwInput.value = '';
        for (const b of pillsWrap.querySelectorAll('.ani-exclude-pill')) {
          b.classList.remove('is-excluded');
          b.setAttribute('aria-pressed', 'false');
        }
        saveExcludeState();
        void updateTagExclusions();
        animateFilterSwitch(clearExBtn, listBlock, '.theme-list-main');
      });
      filterBody.append(exPanel);
    }

    if (filterBody && !filterBody.querySelector('.ani-origin-panel')) {
      const originPanel = document.createElement('section');
      originPanel.className = 'ani-origin-panel';
      originPanel.setAttribute('aria-label', '原作 / 型態分類');
      originPanel.innerHTML = `
        <div class="ani-extra-filter-header">
          <h3>${enhIcon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 20)}原作分類</h3>
        </div>
        <div class="ani-origin-pills" role="group" aria-label="選擇原作類型"></div>
        <span class="ani-origin-status" role="status"></span>
      `;
      const oWrap = originPanel.querySelector('.ani-origin-pills');
      for (const [key, label] of ORIGIN_OPTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ani-origin-pill';
        btn.dataset.origin = key;
        btn.setAttribute('aria-pressed', String(key === activeOrigin));
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (activeOrigin === key && !metaFailed.size && listBlock.dataset.aniBrowsePages !== 'failed') return;
          if (key !== 'all') metaFailed.clear();
          activeOrigin = key;
          for (const b of oWrap.querySelectorAll('.ani-origin-pill')) {
            b.setAttribute('aria-pressed', String(b === btn));
          }
          applyCatalogFilters();
          listBlock.dispatchEvent(new CustomEvent('ani-origin-filter-change', { detail: key !== 'all' }));
        });
        oWrap.append(btn);
      }
      const count = isCollection && filterBody.querySelector('.ani-collection-count');
      if (count) count.before(originPanel);
      else filterBody.append(originPanel);
    }

    // Remove any stale page elevator if present (infinite scroll only)
    document.querySelectorAll('.ani-page-elevator').forEach((el) => el.remove());

    listBlock.dataset.aniCatalogObs = '1';
    const observer = new MutationObserver((records) => {
      if (records.some(({ target, type }) => target === listBlock ||
        (type === 'attributes' && target.matches('.theme-list-main')))) scheduleCatalogFilters();
    });
    observer.observe(listBlock, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-ani-browse-pages'],
    });
    if (isCollection) listBlock.addEventListener('ani-collection-status-change', scheduleCatalogFilters);
    applyCatalogFilters();
    if (excludedTags.size) void updateTagExclusions();
  };

  // ── Feature 3: 避雷薄碼 / 預覽圖模糊遮罩 ──
  let blurBusy = false;
  let appliedStudioBlurCards = new WeakSet();
  let blurSubscribed = false;

  const clearSpoilerBlurFromCover = (cover) => {
    cover.classList.remove('ani-spoiler-blurred', 'is-unblurred');
    cover.querySelector('.ani-spoiler-mask')?.remove();
    cover.querySelector('.ani-blur-rehide-btn')?.remove();
  };

  const BLUR_EYE_ON_SVG = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  const BLUR_EYE_OFF_SVG = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';

  const renderBlurToggleInner = (btn, enabled) => {
    btn.setAttribute('aria-pressed', String(enabled));
    btn.innerHTML = `${enhIcon(enabled ? BLUR_EYE_ON_SVG : BLUR_EYE_OFF_SVG, 17)}<span class="ani-blur-toggle-label">避雷遮罩</span><span class="ani-blur-switch-track" aria-hidden="true"><span class="ani-blur-switch-thumb"></span></span>`;
  };

  const applySpoilerBlur = async () => {
    if (blurBusy) return;
    blurBusy = true;
    try {
      const enabled = Boolean(currentSettings.spoilerBlurEnabled);
      const quickBtn = document.querySelector('.ani-blur-quick-toggle');
      if (quickBtn && quickBtn.getAttribute('aria-pressed') !== String(enabled)) {
        renderBlurToggleInner(quickBtn, enabled);
      }

      const cards = [...document.querySelectorAll('.theme-list-main, .anime-card-block, .ani-perm-card, .anime-card')];
      if (!enabled) {
        for (const cover of document.querySelectorAll('.ani-spoiler-blurred')) {
          clearSpoilerBlurFromCover(cover);
        }
        return;
      }

      const tags = String(currentSettings.spoilerBlurTags || '')
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const keywords = String(currentSettings.spoilerBlurKeywords || '')
        .split(/[,，、\n]+/)
        .map((s) => s.trim().toLocaleLowerCase())
        .filter(Boolean);
      const globalMode = tags.length === 0 && keywords.length === 0;

      const blurredSns = new Set();
      if (!globalMode && tags.length) {
        const snSets = await Promise.all(tags.map((t) => fetchTagSnSet(t)));
        for (const set of snSets) {
          for (const sn of set) blurredSns.add(sn);
        }
      }

      for (const card of cards) {
        const cover = card.querySelector('.theme-img-block, .anime-pic, .ani-perm-cover-wrap, .postimg');
        if (!cover) continue;
        if (card.closest('.ani-studio-panel')) appliedStudioBlurCards.add(card);

        let match = globalMode;
        if (!match) {
          const href =
            card.getAttribute('href') ||
            card.querySelector('a[href*="sn="]')?.getAttribute('href') ||
            '';
          const sn = card.dataset?.permSn || getSnFromHref(href);
          if (sn && blurredSns.has(sn)) match = true;
          if (!match && keywords.length) {
            const titleText =
              card.querySelector('.theme-name, .history-anime-title, .ani-perm-title, .anime-name')?.textContent || '';
            const imgAlt = cover.querySelector('img')?.getAttribute('alt') || '';
            const blob = `${titleText} ${imgAlt} ${card.textContent || ''}`.toLocaleLowerCase();
            match = keywords.some((kw) => blob.includes(kw));
          }
        }

        if (!match) {
          if (cover.classList.contains('ani-spoiler-blurred')) {
            clearSpoilerBlurFromCover(cover);
          }
          continue;
        }

        cover.classList.add('ani-spoiler-blurred');
        if (!cover.querySelector('.ani-spoiler-mask')) {
          const mask = document.createElement('div');
          mask.className = 'ani-spoiler-mask';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ani-spoiler-reveal-btn';
          btn.innerHTML = `${enhIcon(BLUR_EYE_OFF_SVG, 14)}<span>避雷遮罩 · 點擊預覽</span>`;
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cover.classList.add('is-unblurred');
          });
          mask.append(btn);
          cover.append(mask);
        }
        if (!cover.querySelector('.ani-blur-rehide-btn')) {
          const rehide = document.createElement('button');
          rehide.type = 'button';
          rehide.className = 'ani-blur-rehide-btn';
          rehide.innerHTML = `${enhIcon(BLUR_EYE_ON_SVG, 13)}<span>重新遮罩</span>`;
          rehide.title = '重新套用避雷模糊';
          rehide.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cover.classList.remove('is-unblurred');
          });
          cover.append(rehide);
        }
      }
    } finally {
      blurBusy = false;
    }
  };

  const initSpoilerBlur = async () => {
    const allowedPaths = ['/', '/index.php', '/animeList.php', '/mygather.php', '/search.php', '/viewList.php', '/animeVideo.php'];
    if (!allowedPaths.includes(location.pathname)) return;

    const topRightSortHost =
      document.querySelector('.filter-title-block .ani-section-actions') ||
      document.querySelector('.animate-theme-list:has(> .filter-section) > .theme-title-block .ani-section-actions') ||
      document.querySelector('.ani-collection-sort-host') ||
      document.querySelector('.filter-title-block') ||
      document.querySelector('.animate-theme-list:has(> .filter-section) > .theme-title-block') ||
      document.querySelector('.ani-perm-io-actions');
    const filterSection = document.querySelector('.filter-section');
    const filterToggle = filterSection?.querySelector(':scope > .ani-filter-toggle');
    const collectionSort = location.pathname === '/mygather.php'
      ? document.querySelector('.ani-collection-sort-host > .ani-collection-sort-segment')
      : null;
    const existingToggle = document.querySelector('.ani-blur-quick-toggle');

    if (collectionSort && existingToggle && collectionSort.previousElementSibling !== existingToggle) {
      collectionSort.before(existingToggle);
    }
    if ((collectionSort || topRightSortHost || filterSection) && !existingToggle) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ani-blur-quick-toggle';
      renderBlurToggleInner(btn, Boolean(currentSettings.spoilerBlurEnabled));
      btn.addEventListener('click', async () => {
        await writeSettings({ spoilerBlurEnabled: !currentSettings.spoilerBlurEnabled });
      });
      const catalogToolbar = location.pathname === '/animeList.php' && document.querySelector('.filter-title-block');
      if (collectionSort) {
        collectionSort.before(btn);
      } else if (catalogToolbar) {
        const sort = catalogToolbar.querySelector(':scope > .btn-newanime-filter');
        if (sort) {
          const actions = document.createElement('div');
          actions.className = 'ani-catalog-right-tools';
          const segment = catalogToolbar.querySelector(':scope > .ani-catalog-sort');
          sort.before(actions);
          actions.append(btn, sort);
          if (segment) actions.append(segment);
        } else {
          catalogToolbar.append(btn);
        }
      } else if (topRightSortHost) {
        topRightSortHost.append(btn);
      } else if (filterSection) {
        filterSection.classList.add('has-top-right-blur-toggle');
        if (filterToggle) filterToggle.after(btn);
        else filterSection.prepend(btn);
      }
    }

    if (!blurSubscribed) {
      blurSubscribed = true;
      settingsListeners.add(() => {
        appliedStudioBlurCards = new WeakSet();
        applySpoilerBlur();
      });
    }

    await applySpoilerBlur();

    for (const host of document.querySelectorAll('.animate-theme-list:not(.ani-studio-row), .ani-studio-panel, .newanime-block, .history-wrapper')) {
      if (host.dataset.aniSpoilerObs) continue;
      host.dataset.aniSpoilerObs = '1';
      let t = 0;
      const isStudioPanel = host.matches('.ani-studio-panel');
      new MutationObserver(records => {
        if (blurBusy) return;
        if (isStudioPanel) {
          const needsUpdate = records.some(record => [...record.addedNodes].some(node => {
            if (node.nodeType !== 1) return false;
            if (!currentSettings.spoilerBlurEnabled) return Boolean(node.querySelector('.ani-spoiler-blurred'));
            return (node.matches('.theme-list-main') && !appliedStudioBlurCards.has(node)) ||
              [...node.querySelectorAll('.theme-list-main')].some(card => !appliedStudioBlurCards.has(card));
          }));
          if (!needsUpdate) return;
        }
        clearTimeout(t);
        t = setTimeout(() => { applySpoilerBlur(); }, 120);
      }).observe(host, { childList: true, subtree: true });
    }
  };

  // ── Feature 4: 彈幕列表搜尋、多維排序與單一發送者局部消音 (/animeVideo.php) ──
  const parseDanmuSeconds = (row) => {
    const raw = (row.querySelector('b')?.textContent || '').trim();
    const parts = raw.split(':').map((n) => Number(n.trim()));
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const getDanmuRowText = (row) =>
    (row.querySelector('.sub_content')?.textContent || row.textContent || '').trim();

  const extractDanmuSender = (row) => {
    const attrSender =
      row.dataset?.userid ||
      row.dataset?.user ||
      row.dataset?.uid ||
      row.getAttribute('data-userid') ||
      row.getAttribute('data-user') ||
      row.querySelector('.sub_user, .user-id, .name, [data-userid], [data-user]')?.getAttribute('data-userid') ||
      row.querySelector('.sub_user, .user-id, .name, [data-userid], [data-user]')?.getAttribute('data-user') ||
      row.querySelector('.sub_user, .user-id, .name')?.textContent?.trim();
    if (attrSender) return String(attrSender).trim();

    for (const el of row.querySelectorAll('.edit, button, a')) {
      const oc = el.getAttribute('onclick') || '';
      const strArgs = [...oc.matchAll(/['"]([a-zA-Z0-9._-]{2,32})['"]/g)].map((m) => m[1]);
      if (strArgs.length) return strArgs[strArgs.length - 1];
      const href = el.getAttribute('href') || '';
      const qUser = href.match(/[?&](?:user|userid|uid)=([^&]+)/i)?.[1];
      if (qUser) return decodeURIComponent(qUser);
    }
    return '';
  };

  let dmBusy = false;
  let dmObserver = null;
  let dmOverlayObserver = null;

  const initDanmuListTools = async () => {
    if (location.pathname !== '/animeVideo.php') return;
    const subList = document.querySelector('#sub_list');
    if (!subList) return;
    const scrollWrap = subList.closest('.danmu-scroll');

    let mutedMap = await storageGet(LOCAL_MUTE_KEY, {});
    if (!mutedMap || typeof mutedMap !== 'object' || Array.isArray(mutedMap)) mutedMap = {};

    let searchQuery = '';
    let sortKey = 'time';
    let sortDir = 'asc';
    let origCounter = 0;
    let bar = document.querySelector('.ani-danmu-tools-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ani-danmu-tools-bar';
      bar.innerHTML = `
        <div class="ani-danmu-search-row">
          <div class="anime_search-input ani-collection-search-capsule ani-danmu-search-capsule">
            <input type="search" class="ani-danmu-search" placeholder="搜尋彈幕或發送者…" aria-label="搜尋彈幕或發送者">
            <button type="button" class="anime_search-icon ani-danmu-search-icon" aria-label="搜尋彈幕" tabindex="-1">
              ${enhIcon('<circle cx="10" cy="10" r="6"/><path d="m14.4 14.4 5.6 5.6"/>', 15)}
            </button>
          </div>
          <span class="ani-danmu-count" role="status"></span>
          <div class="ani-dm-muted-host">
            <button type="button" class="ani-danmu-muted-pill" aria-expanded="false" title="已消音發送者">0 人</button>
            <div class="ani-danmu-muted-popover" hidden></div>
          </div>
          <button type="button" class="ani-dm-refresh-btn" title="重新載入彈幕" aria-label="重新載入彈幕">
            ${enhIcon('<path d="M20.5 4.5V10H15M20 10a8 8 0 1 0-.9 7"/>', 16)}
          </button>
        </div>
        <div class="ani-danmu-sort-row" role="group" aria-label="彈幕排序">
          <button type="button" class="ani-dm-sort-btn" data-dm-sort="time" aria-pressed="true">動畫時間 ↑</button>
          <button type="button" class="ani-dm-sort-btn" data-dm-sort="length" aria-pressed="false">彈幕長度</button>
          <button type="button" class="ani-dm-sort-btn" data-dm-sort="sn" aria-pressed="false">發送時間</button>
        </div>
      `;
      const tabContent = subList.closest('#ani-tab-content-1') || subList.closest('.ani-tab-content__item');
      if (tabContent && scrollWrap) {
        tabContent.classList.add('ani-has-dm-tools');
        scrollWrap.before(bar);
        // Blur the scrolled content directly so the toolbar does not depend on backdrop sampling.
        const filterHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        filterHost.setAttribute('class', 'ani-dm-filter-defs');
        filterHost.setAttribute('aria-hidden', 'true');
        filterHost.innerHTML = `
          <filter id="ani-dm-toolbar-blur" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feFlood x="0" y="0" width="100%" result="toolbarStrip" />
            <feImage preserveAspectRatio="none" result="toolbarRegion" />
            <feComposite in="SourceGraphic" in2="toolbarStrip" operator="out" result="sharp" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="soft" />
            <feComposite in="soft" in2="toolbarRegion" operator="in" result="softInside" />
            <feMerge><feMergeNode in="sharp" /><feMergeNode in="softInside" /></feMerge>
          </filter>
        `;
        scrollWrap.before(filterHost);
        const toolbarRegion = filterHost.querySelector('feImage');
        const toolbarStrip = filterHost.querySelector('feFlood');
        const updateToolbarBounds = () => {
          scrollWrap.style.setProperty('--ani-danmu-toolbar-height', `${bar.offsetHeight}px`);
          const width = bar.offsetWidth;
          const height = bar.offsetHeight;
          if (!width || !height) return;
          const radius = parseFloat(getComputedStyle(bar).borderTopLeftRadius);
          const shape = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}"/></svg>`;
          toolbarRegion.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(shape)}`);
          toolbarRegion.setAttribute('x', bar.offsetLeft - scrollWrap.offsetLeft);
          const top = bar.offsetTop - scrollWrap.offsetTop;
          toolbarRegion.setAttribute('y', top);
          toolbarStrip.setAttribute('height', Math.max(0, top + height));
          toolbarRegion.setAttribute('width', width);
          toolbarRegion.setAttribute('height', height);
        };
        updateToolbarBounds();
        if (typeof ResizeObserver === 'function') {
          const toolbarObserver = new ResizeObserver(updateToolbarBounds);
          toolbarObserver.observe(bar);
          toolbarObserver.observe(scrollWrap);
        }
      } else {
        subList.before(bar);
      }
    }

    const searchInput = bar.querySelector('.ani-danmu-search');
    bar.querySelector('.ani-danmu-search-icon')?.addEventListener('click', () => searchInput?.focus());
    const countEl = bar.querySelector('.ani-danmu-count');
    const sortBtns = [...bar.querySelectorAll('.ani-dm-sort-btn')];
    const mutedPill = bar.querySelector('.ani-danmu-muted-pill');
    const mutedPopover = bar.querySelector('.ani-danmu-muted-popover');

    const syncLiveOverlayMute = () => {
      const hasMutes = Object.keys(mutedMap).length > 0;
      const overlay = document.querySelector('.danmu-container, .vjs-danmu-layer');
      const sweepOverlay = () => {
        if (!overlay) return;
        for (const item of overlay.querySelectorAll('[data-userid], [data-user], .danmu-item')) {
          const u = item.getAttribute('data-userid') || item.getAttribute('data-user') || '';
          const muted = Boolean(u && mutedMap[u]);
          item.classList.toggle('ani-dm-filtered-hidden', muted);
        }
      };
      if (hasMutes && overlay) {
        sweepOverlay();
        if (!dmOverlayObserver) {
          dmOverlayObserver = new MutationObserver(() => {
            if (Object.keys(mutedMap).length > 0) sweepOverlay();
          });
          dmOverlayObserver.observe(overlay, { childList: true });
        }
      } else if (dmOverlayObserver) {
        dmOverlayObserver.disconnect();
        dmOverlayObserver = null;
        if (overlay) {
          for (const item of overlay.querySelectorAll('.ani-dm-filtered-hidden')) {
            item.classList.remove('ani-dm-filtered-hidden');
          }
        }
      }
    };

    const DM_SORT_ICONS = {
      time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      length: '<path d="M4 7h16M4 12h12M4 17h8"/>',
      sn: '<path d="M3 6h13M3 12h10M3 18h7"/><path d="m17 15 3 3 3-3M20 6v12"/>',
    };
    const DM_MUTE_ICON = '<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';

    const renderMutedPopover = () => {
      const senders = Object.keys(mutedMap);
      mutedPill.innerHTML = `${enhIcon(DM_MUTE_ICON, 14)}<span>${senders.length} 人</span>`;
      mutedPill.title = `已消音 ${senders.length} 人`;
      if (!senders.length) {
        mutedPopover.innerHTML = '<p class="ani-dm-muted-empty">尚未消音任何發送者</p>';
        return;
      }
      mutedPopover.innerHTML = `
        <div class="ani-dm-muted-list">
          ${senders
            .map(
              (id) => {
                const displayId = String(id).replace(/^ID\s*[:：]?\s*/i, '').trim() || id;
                return `
            <div class="ani-dm-muted-item">
              <span class="ani-dm-muted-id" title="${escapeHtml(displayId)}"><small>ID</small> ${escapeHtml(displayId)}</span>
              <button type="button" class="ani-dm-unmute-one" data-unmute-sender="${escapeHtml(id)}" title="解除消音">${enhIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', 12)}<span>解除</span></button>
            </div>`;
              },
            )
            .join('')}
        </div>
        <button type="button" class="ani-dm-unmute-all">${enhIcon(COL_STATUS_ICONS.clear, 13)}<span>全部解除</span></button>
      `;
    };

    const updateSortLabels = () => {
      const names = { time: '動畫時間', length: '彈幕長度', sn: '發送時間' };
      for (const b of sortBtns) {
        const key = b.dataset.dmSort;
        const active = key === sortKey;
        b.setAttribute('aria-pressed', String(active));
        const label = active ? `${names[key]} ${sortDir === 'asc' ? '↑' : '↓'}` : names[key];
        b.innerHTML = `${enhIcon(DM_SORT_ICONS[key] || DM_SORT_ICONS.time, 13)}<span>${escapeHtml(label)}</span>`;
      }
    };

    const applyDanmuListState = () => {
      if (dmBusy) return;
      dmBusy = true;
      try {
        const rows = [...subList.querySelectorAll('.sub-list-li')];
        if (!rows.length) {
          countEl.textContent = '0 / 0';
          renderMutedPopover();
          syncLiveOverlayMute();
          return;
        }

        for (const row of rows) {
          if (!row.dataset.aniOrigIdx) {
            row.dataset.aniOrigIdx = String(++origCounter);
          }
          const sender = row.dataset.aniSender || extractDanmuSender(row);
          if (sender) row.dataset.aniSender = sender;
          const nativeMute = row.querySelector('.edit.mute');
          if (sender && nativeMute && !nativeMute.dataset.aniMuteBound) {
            nativeMute.dataset.aniMuteBound = '1';
            nativeMute.addEventListener('click', async () => {
              const targetSender = row.dataset.aniSender;
              if (!targetSender) return;
              mutedMap[targetSender] = { mutedAt: Date.now() };
              await storageSet(LOCAL_MUTE_KEY, mutedMap);
              applyDanmuListState();
            });
          }
        }

        const q = searchQuery.trim().toLocaleLowerCase();
        let shown = 0;
        for (const row of rows) {
          const sender = row.dataset.aniSender || '';
          const txt = getDanmuRowText(row);
          const isMuted = Boolean(sender && mutedMap[sender]);
          const matchesQuery =
            !q || txt.toLocaleLowerCase().includes(q) || sender.toLocaleLowerCase().includes(q);
          const hidden = isMuted || !matchesQuery;
          row.classList.toggle('ani-dm-filtered-hidden', hidden);
          if (!hidden) shown++;
        }

        countEl.textContent = `${shown} / ${rows.length}`;
        renderMutedPopover();
        syncLiveOverlayMute();

        const sorted = [...rows].sort((a, b) => {
          let cmp = 0;
          if (sortKey === 'length') {
            cmp = getDanmuRowText(a).length - getDanmuRowText(b).length;
          } else if (sortKey === 'sn') {
            const sa = Number(a.dataset.danmuSn || a.getAttribute('data-danmu-sn') || a.dataset.aniOrigIdx || 0);
            const sb = Number(b.dataset.danmuSn || b.getAttribute('data-danmu-sn') || b.dataset.aniOrigIdx || 0);
            cmp = sa - sb;
          } else {
            cmp = parseDanmuSeconds(a) - parseDanmuSeconds(b);
          }
          if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
          return Number(a.dataset.aniOrigIdx) - Number(b.dataset.aniOrigIdx);
        });

        const orderChanged = sorted.some((node, idx) => node !== rows[idx]);
        if (orderChanged) {
          const frag = document.createDocumentFragment();
          for (const node of sorted) frag.append(node);
          subList.append(frag);
        }
      } finally {
        dmObserver?.takeRecords();
        dmBusy = false;
      }
    };

    if (!bar.dataset.aniDmWired) {
      bar.dataset.aniDmWired = '1';
      let searchTimer = 0;
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyDanmuListState, 80);
      });
      for (const b of sortBtns) {
        b.addEventListener('click', () => {
          const key = b.dataset.dmSort;
          if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else {
            sortKey = key;
            sortDir = key === 'time' ? 'asc' : 'desc';
          }
          updateSortLabels();
          applyDanmuListState();
          animateFilterSwitch(b, subList, '.sub-list-li');
        });
      }
      bar.querySelector('.ani-dm-refresh-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const nativeRefresh = bar.closest('.subtitle')?.querySelector(
          ':is(button.refresh, .ani-danmu-reload-pill):not(.ani-dm-refresh-btn)',
        );
        if (nativeRefresh) nativeRefresh.click();
        btn.classList.remove('is-spinning');
        void btn.offsetWidth;
        btn.classList.add('is-spinning');
        setTimeout(() => btn.classList.remove('is-spinning'), 500);
      });
      mutedPill.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextOpen = mutedPopover.hidden;
        mutedPopover.hidden = !nextOpen;
        mutedPill.setAttribute('aria-expanded', String(nextOpen));
      });
      mutedPopover.addEventListener('click', async (e) => {
        e.stopPropagation();
        const unmuteBtn = e.target.closest('.ani-dm-unmute-one');
        if (unmuteBtn) {
          const id = unmuteBtn.dataset.unmuteSender;
          if (id && mutedMap[id]) {
            delete mutedMap[id];
            await storageSet(LOCAL_MUTE_KEY, mutedMap);
            applyDanmuListState();
          }
          return;
        }
        if (e.target.closest('.ani-dm-unmute-all')) {
          mutedMap = {};
          await storageSet(LOCAL_MUTE_KEY, mutedMap);
          applyDanmuListState();
        }
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.ani-dm-muted-host')) {
          mutedPopover.hidden = true;
          mutedPill.setAttribute('aria-expanded', 'false');
        }
      });
    }

    updateSortLabels();
    applyDanmuListState();

    // Critical contract: observe #sub_list with childList: true ONLY + debounced guard
    if (!subList.dataset.aniDmObs) {
      subList.dataset.aniDmObs = '1';
      let obsTimer = 0;
      dmObserver = new MutationObserver(() => {
        if (dmBusy) return;
        clearTimeout(obsTimer);
        obsTimer = setTimeout(applyDanmuListState, 150);
      });
      dmObserver.observe(subList, { childList: true });
    }
  };

  // ── Feature 5A: 長篇集數自動分組折疊 (/animeVideo.php) ──
  let epGroupSubscribed = false;
  let episodeListId = 0;
  const observedEpisodeLists = new WeakSet();
  const episodePreviewRenderers = new WeakMap();
  const episodeListSnapshots = new WeakMap();
  const episodeTrackStates = new WeakMap();
  let episodeListRootObserver;
  let episodeOrder = 'asc';
  let episodeOrderButton;
  let episodeLayoutSwitch;
  let episodeOrderRow;
  const episodeCardWatch = new WeakMap();
  const updateEpisodeCardWatch = (frame, watch) => {
    const {completed, duration, elapsed, displayProgress, watched, watchedWithoutTiming} = resolveEpisodeProgress(watch);
    const done = completed || watchedWithoutTiming;
    const displayElapsed = done ? duration : elapsed;
    frame.style.setProperty('--episode-progress', displayProgress * 100 + '%');
    frame.querySelector('.ani-episode-card-progress').hidden = !watched;
    if (displayElapsed > 0 || duration > 0) {
      frame.dataset.playbackTime = `${displayElapsed > 0 ? formatMmSs(displayElapsed) : '—'} / ${duration > 0 ? formatMmSs(duration) : '—'}`;
    } else {
      delete frame.dataset.playbackTime;
    }
    const label = done ? '已看完' : '';
    const status = frame.querySelector('.ani-episode-card-watch');
    status.dataset.label = label;
    status.setAttribute('aria-label', label);
    status.hidden = !label;
  };
  async function loadEpisodeCard(frame, originalSn) {
    const sn = frame.dataset.videoSn;
    const details = /^\d+$/.test(sn) ? globalThis.aniGetEpisodeDetails?.(sn) : null;
    const original = originalSn && originalSn !== sn ? globalThis.aniGetEpisodeDetails?.(originalSn) : null;
    void renderEpisodeCardCover(frame, original, details);
    const data = await details;
    if (!frame.isConnected || !data) return;
    const date = frame.parentElement.querySelector('.ani-episode-card-date');
    if (date && data.date) {
      date.dateTime = data.date.replaceAll('/', '-');
      date.dataset.label = data.date;
      date.setAttribute('aria-label', `上架日期 ${data.date}`);
    }
    const watch = episodeCardWatch.get(frame);
    watch.details = data;
    updateEpisodeCardWatch(frame, watch);
  }
  async function renderEpisodeCardCover(frame, original, details) {
    const cover = safeImageUrl((await original)?.cover) || safeImageUrl((await details)?.cover);
    if (!frame.isConnected) return;
    if (cover.startsWith('https://')) {
      frame.parentElement.style.setProperty('--ani-card-cover', `url(${JSON.stringify(cover)})`);
      const image = document.createElement('img');
      image.alt = '';
      image.decoding = 'async';
      image.src = cover;
      try {
        await image.decode();
        if (frame.isConnected) frame.append(image);
      } catch {
        // The card can still show its episode number and history.
      }
    }
  }
  const episodeCardObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      episodeCardObserver.unobserve(entry.target);
      void loadEpisodeCard(entry.target, episodeCardWatch.get(entry.target)?.originalSn);
    }
  }) : null;

  const episodeTitleObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    const headings = new Set();
    for (const { target } of entries) {
      const heading = target.closest('.ani-episode-card-heading');
      if (heading) headings.add(heading);
    }
    headings.forEach(applyShadowMarquee);
  }) : null;

  const episodeSurfaceObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    const cards = new Set(entries.map(({target}) => target.closest('a')));
    for (const card of cards) {
      const description = card?.querySelector('.ani-episode-card-description');
      const reveal = description?.querySelector('.ani-episode-card-synopsis-reveal');
      if (!reveal) continue;
      card.style.setProperty('--ani-episode-surface-height', `${description.offsetTop + reveal.offsetHeight + 1}px`);
    }
  }) : null;

  function isMovieEpisodeTrack(label) {
    return /^(?:(?:中文|國語|日文)?電影(?:版)?|劇場版)\s*[:：]?$/.test(label);
  }

  function normalizeBilingualEpisodeTracks(tracks) {
    const dubbed = tracks.findIndex(track => /^(?:中文配音|中配|國語配音|國語|(?:中文|國語)電影)(?:版)?$/.test(track.label));
    if (dubbed < 0) return;
    const original = tracks.findIndex(track => /^(?:電影|日文電影|日文(?:配音)?|日語(?:配音)?|日配|本篇|正片)(?:版)?$/.test(track.label));
    tracks[dubbed].label = '中文配音';
    if (original < 0) return;
    tracks[original].label = '日文配音';
    if (original > dubbed) [tracks[dubbed], tracks[original]] = [tracks[original], tracks[dubbed]];
  }

  function syncEpisodeTracks(season) {
    const tracks = [...season.querySelectorAll(':scope > ul')].map((list, index) => {
      const before = list.previousElementSibling;
      const range = before?.matches('.ani-ep-group-bar') ? before : null;
      const heading = (range || list).previousElementSibling;
      const title = heading?.matches('p') ? heading : null;
      const expand = list.nextElementSibling?.matches('.ani-ep-list-expand') ? list.nextElementSibling : null;
      return { list, title, label: title?.textContent.trim() || (index === 0 ? '本篇' : ''), controls: [range, expand] };
    });
    normalizeBilingualEpisodeTracks(tracks);
    let state = episodeTrackStates.get(season);
    if (!currentSettings.themeEnabled || tracks.length < 2 || tracks.some(track => !track.label)) {
      state?.bar.remove();
      episodeTrackStates.delete(season);
      for (const node of season.querySelectorAll(':scope > .ani-episode-track-hidden')) {
        node.classList.remove('ani-episode-track-hidden');
      }
      return;
    }
    if (!state) {
      const bar = document.createElement('div');
      bar.className = 'ani-episode-track-choices ani-catalog-sort';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', '分集分類');
      season.prepend(bar);
      state = { bar, active: tracks.find(track => track.list.querySelector('li.playing'))?.list };
      episodeTrackStates.set(season, state);
    }
    const refresh = () => {
      for (const [index, track] of tracks.entries()) {
        const active = track.list === state.active;
        state.bar.children[index].setAttribute('aria-pressed', String(active));
        track.title?.classList.add('ani-episode-track-hidden');
        for (const node of [track.list, ...track.controls]) node?.classList.toggle('ani-episode-track-hidden', !active);
      }
    };
    if (!tracks.some(track => track.list === state.active)) state.active = tracks[0].list;
    if (state.tracks?.length !== tracks.length ||
      tracks.some((track, index) => track.list !== state.tracks[index].list || track.label !== state.tracks[index].label)) {
      state.bar.replaceChildren(...tracks.map(track => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = track.label;
        button.onclick = () => {
          state.active = track.list;
          syncEpisodeTracks(season);
        };
        return button;
      }));
    }
    state.tracks = tracks;
    refresh();
  }

  const initLongEpisodeGrouping = () => {
    if (location.pathname !== '/animeVideo.php') return;
    const lists = [...document.querySelectorAll('.season ul')];
    const cardsAvailable = currentSettings.themeEnabled &&
      lists.every(ul => ul.children.length <= 100 && ![...ul.querySelectorAll('li a')].some(a => Number(a.textContent.trim()) > 100));
    const cardMode = cardsAvailable && currentSettings.episodeThumbnailGrid;
    const applyGrouping = (ul) => {
      const items = [...ul.children].filter(item => item.tagName === 'LI');
      const existingBar = ul.previousElementSibling?.matches('.ani-ep-group-bar') ? ul.previousElementSibling : null;
      const next = ul.nextElementSibling;
      const existingExpand = next?.matches('.ani-ep-list-expand') ? next : null;
      ul.classList.toggle('ani-episode-cards', Boolean(cardMode));
      if (cardMode) {
        existingBar?.remove();
        existingExpand?.remove();
        const trackLabel = ul.previousElementSibling?.textContent.trim() || '';
        const isMovie = isMovieEpisodeTrack(trackLabel);
        const isDub = /^(?:中文配音|中配|國語配音|國語)(?:版)?$/.test(trackLabel);
        const originals = new Map();
        if (isDub) {
          const mainList = ul.parentElement.querySelector(':scope > ul');
          if (mainList && mainList !== ul) {
            for (const link of mainList.querySelectorAll(':scope > li > a')) {
              const number = link.textContent.trim();
              const videoSn = link.dataset.aniVideoSn || new URL(link.href, location.href).searchParams.get('sn');
              if (/^\d+(?:\.\d+)?$/.test(number) && /^\d+$/.test(videoSn || '')) originals.set(Number(number), videoSn);
            }
          }
        }
        episodePreviewRenderers.delete(ul);
        episodeListSnapshots.delete(ul);
        ul.classList.remove('ani-ep-one-row');
        ul.classList.add('ani-ep-managed');
        ul.dataset.aniEpRendered = 'true';
        if ((ul.dataset.aniEpOrder || 'asc') !== episodeOrder) {
          ul.append(...items.reverse());
          ul.dataset.aniEpOrder = episodeOrder;
        }
        const pendingCards = [];
        for (const li of items) {
          li.removeAttribute('data-ani-ep-hidden');
          const link = li.querySelector('a');
          if (!link || link.querySelector('.ani-episode-frame')) continue;
          link.removeAttribute('title');
          const frame = document.createElement('span');
          frame.className = 'ani-episode-frame';
          const number = link.textContent.trim();
          if (!isMovie) frame.dataset.label = /^\d+(?:\.\d+)?$/.test(number) ? 'EP.' + number : number;
          const playingBadge = document.createElement('span');
          playingBadge.className = 'ani-ep-playing-label';
          playingBadge.innerHTML = '<span class="ani-ep-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
          frame.append(playingBadge);
          const progress = document.createElement('span');
          progress.className = 'ani-episode-card-progress';
          progress.hidden = true;
          progress.setAttribute('aria-hidden', 'true');
          frame.append(progress);
          const status = document.createElement('span');
          status.className = 'ani-episode-card-watch';
          status.setAttribute('role', 'img');
          status.hidden = true;
          frame.append(status);
          frame.dataset.videoSn = link.dataset.aniVideoSn || new URL(link.href, location.href).searchParams.get('sn') || '';
          const originalSn = originals.get(Number(number));
          episodeCardWatch.set(frame, { originalSn });
          pendingCards.push(frame);
          link.prepend(frame);
          const heading = document.createElement('span');
          heading.className = 'ani-episode-card-heading';
          heading.dataset.title = link.dataset.aniEpTitle || '';
          const titleTrack = document.createElement('span');
          titleTrack.className = 'ani-marquee-track';
          titleTrack.dataset.title = heading.dataset.title;
          heading.append(titleTrack);
          const date = document.createElement('time');
          date.className = 'ani-episode-card-date';
          date.innerHTML = enhIcon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/>', 12);
          const metadata = document.createElement('span');
          metadata.className = 'ani-episode-card-metadata';
          metadata.append(heading);
          const description = document.createElement('span');
          description.className = 'ani-episode-card-description';
          description.dataset.text = link.dataset.aniEpDescription || '';
          const synopsis = document.createElement('span');
          synopsis.className = 'ani-episode-card-synopsis';
          synopsis.dataset.text = description.dataset.text;
          const synopsisReveal = document.createElement('span');
          synopsisReveal.className = 'ani-episode-card-synopsis-reveal';
          const details = document.createElement('span');
          details.className = 'ani-episode-card-details';
          details.append(synopsis, date);
          synopsisReveal.append(details);
          description.append(synopsisReveal);
          const glow = document.createElement('span');
          glow.className = 'ani-episode-card-glow';
          glow.setAttribute('aria-hidden', 'true');
          link.append(metadata, description, glow);
          episodeTitleObserver?.observe(heading);
          episodeTitleObserver?.observe(titleTrack);
          episodeSurfaceObserver?.observe(link);
          episodeSurfaceObserver?.observe(synopsisReveal);
          if (episodeCardObserver) episodeCardObserver.observe(frame);
          else void loadEpisodeCard(frame, originalSn);
        }
        if (pendingCards.length) {
          globalThis.aniGetEpisodeWatchHistory?.(pendingCards.map(frame => frame.dataset.videoSn)).then(history => {
            for (const frame of pendingCards) {
              if (!frame.isConnected) continue;
              const watch = episodeCardWatch.get(frame);
              Object.assign(watch, history.get(frame.dataset.videoSn));
              updateEpisodeCardWatch(frame, watch);
            }
          });
        }
        return;
      }
      for (const frame of ul.querySelectorAll('.ani-episode-frame')) {
        episodeCardObserver?.unobserve(frame);
        const link = frame.parentElement;
        episodeSurfaceObserver?.unobserve(link);
        const reveal = link.querySelector('.ani-episode-card-synopsis-reveal');
        if (reveal) episodeSurfaceObserver?.unobserve(reveal);
        const heading = link.querySelector('.ani-episode-card-heading');
        if (heading) {
          episodeTitleObserver?.unobserve(heading);
          episodeTitleObserver?.unobserve(heading.firstElementChild);
          heading.parentElement.remove();
        }
        link.querySelector('.ani-episode-card-description')?.remove();
        link.querySelector('.ani-episode-card-glow')?.remove();
        link.style.removeProperty('--ani-card-cover');
        link.style.removeProperty('--ani-episode-surface-height');
        frame.remove();
      }
      if (items.length < 2) {
        episodePreviewRenderers.delete(ul);
        episodeListSnapshots.delete(ul);
        existingBar?.remove();
        existingExpand?.remove();
        for (const li of items) li.removeAttribute('data-ani-ep-hidden');
        delete ul.dataset.aniEpActiveGroup;
        delete ul.dataset.aniEpExpanded;
        delete ul.dataset.aniEpRendered;
        ul.classList.remove('ani-ep-managed', 'ani-ep-one-row');
        return;
      }
      ul.classList.add('ani-ep-managed');

      if ((ul.dataset.aniEpOrder || 'asc') !== episodeOrder) {
        items.reverse();
        ul.append(...items);
        ul.dataset.aniEpOrder = episodeOrder;
      }
      const grouped = currentSettings.episodeAutoGroup && items.length >= 50;
      const previous = episodeListSnapshots.get(ul);
      if (previous?.grouped === grouped && previous.items.length === items.length &&
          previous.items.every((item, index) => item === items[index])) return;
      episodeListSnapshots.set(ul, { grouped, items });

      const chunkSize = 25;
      const compact = grouped && items.length > chunkSize * 5;
      const descending = episodeOrder === 'desc';
      const itemAt = index => items[descending ? items.length - 1 - index : index];
      const episodeLabel = index => itemAt(index)?.querySelector('a')?.textContent.trim() || String(index + 1);
      const chunks = [];
      for (let start = 0; start < items.length;) {
        let end = Math.min(start + chunkSize, items.length) - 1;
        // Absorb a trailing singleton in long lists without moving any earlier boundary.
        if (compact && end === items.length - 2) end++;
        const first = episodeLabel(start);
        const last = episodeLabel(end);
        const numericLabel = /^\d+(?:\.\d+)?$/;
        const label = start === end ? first : (numericLabel.test(first) && numericLabel.test(last)
          ? `${first}–${last}`
          : `${start + 1}–${end + 1}`);
        chunks.push({ id: String(chunks.length), start, end, label });
        start = end + 1;
      }
      const orderedChunks = descending ? [...chunks].reverse() : chunks;
      if (!grouped || !chunks[Number(ul.dataset.aniEpActiveGroup)]) ul.dataset.aniEpActiveGroup = 'all';

      const bar = existingBar || document.createElement('div');
      bar.className = 'ani-ep-group-bar';
      bar.classList.toggle('ani-ep-group-compact', compact);
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', '集數區間分組');
      bar.innerHTML = '';
      const expand = existingExpand || document.createElement('button');
      if (!existingExpand) {
        expand.type = 'button';
        expand.className = 'ani-week-expand ani-ep-list-expand';
        ul.id ||= `ani-episode-list-${++episodeListId}`;
        expand.setAttribute('aria-controls', ul.id);
        expand.innerHTML = '<span></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
        ul.after(expand);
      }

      let rangeTrigger, rangeLabel, rangeMenu, previousGroup, nextGroup;
      let activeIndex = 0;
      const groupOptions = [{ id: 'all', label: '全部' }, ...orderedChunks];
      let visibleStart, visibleEnd, visiblePreview;
      const renderVisibility = () => {
        const active = ul.dataset.aniEpActiveGroup;
        for (const btn of bar.querySelectorAll('.ani-ep-group-btn')) {
          btn.setAttribute('aria-pressed', String(btn.dataset.epGroup === active));
        }
        if (rangeTrigger) {
          activeIndex = groupOptions.findIndex(option => option.id === active);
          rangeLabel.textContent = groupOptions[activeIndex].label;
          previousGroup.disabled = activeIndex === 0;
          nextGroup.disabled = activeIndex === groupOptions.length - 1;
          [...rangeMenu.children].forEach((option, index) => {
            option.setAttribute('aria-selected', String(index === activeIndex));
          });
        }
        const all = active === 'all';
        const expanded = ul.dataset.aniEpExpanded === 'true';
        const preview = all && !expanded;
        ul.classList.toggle('ani-ep-one-row', preview);
        expand.hidden = !all;
        expand.setAttribute('aria-expanded', String(all && expanded));
        expand.firstElementChild.textContent = expanded ? '收合集數' : '展開全部集數';
        // Determine how many tiles fit without making the hidden rows participate in layout.
        const width = ul.clientWidth || ul.getBoundingClientRect().width;
        const columns = width > 0 ? Math.max(1, Math.floor((width + 8) / 68)) : 6;
        ul.style.setProperty('--ani-ep-columns', String(columns));
        let start = 0;
        let end = items.length - 1;
        if (all) {
          if (!expanded) end = Math.min(end, columns - 1);
          expand.hidden = !expanded && items.length <= columns;
        } else {
          const group = chunks[Number(active)];
          start = descending ? items.length - 1 - group.end : group.start;
          end = descending ? items.length - 1 - group.start : group.end;
        }
        if (start === visibleStart && end === visibleEnd && preview === visiblePreview) return;
        visibleStart = start;
        visibleEnd = end;
        visiblePreview = preview;
        items.forEach((li, idx) => {
          // The player resets episode classes after loading its playback state.
          li.toggleAttribute('data-ani-ep-hidden', idx < start || idx > end);
        });
        ul.dataset.aniEpRendered = 'true';
      };
      episodePreviewRenderers.set(ul, renderVisibility);
      expand.onclick = () => {
        const open = ul.dataset.aniEpExpanded !== 'true';
        ul.dataset.aniEpExpanded = String(open);
        renderVisibility();
        if (open && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          expand.animate?.([{ opacity: 0.65 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
        }
      };

      const selectGroup = (id, button) => {
        ul.dataset.aniEpActiveGroup = id;
        if (id === 'all') ul.dataset.aniEpExpanded = String(!compact);
        renderVisibility();
        if (button) animateFilterSwitch(button);
      };
      if (compact) {
        const rangeField = document.createElement('div');
        rangeField.className = 'ani-ep-range-field ani-catalog-date-field';
        rangeTrigger = document.createElement('button');
        rangeTrigger.type = 'button';
        rangeTrigger.className = 'ani-ep-range-trigger';
        rangeTrigger.setAttribute('aria-haspopup', 'listbox');
        rangeTrigger.setAttribute('aria-expanded', 'false');
        rangeLabel = document.createElement('span');
        rangeLabel.id = `${ul.id}-range-label`;
        rangeTrigger.setAttribute('aria-labelledby', rangeLabel.id);
        rangeTrigger.append(rangeLabel);

        rangeMenu = document.createElement('div');
        rangeMenu.id = `${ul.id}-ranges`;
        rangeMenu.className = 'ani-ep-range-menu';
        rangeMenu.setAttribute('aria-label', '集數區間');
        rangeMenu.setAttribute('role', 'listbox');
        rangeMenu.setAttribute('popover', 'auto');
        rangeTrigger.setAttribute('popovertarget', rangeMenu.id);
        for (const { id, label } of groupOptions) {
          const option = document.createElement('button');
          option.type = 'button';
          option.setAttribute('role', 'option');
          option.textContent = label;
          option.onclick = () => {
            selectGroup(id);
            rangeMenu.hidePopover?.();
            rangeTrigger.focus();
          };
          rangeMenu.append(option);
        }
        rangeMenu.addEventListener('beforetoggle', event => {
          const opening = event.newState === 'open';
          rangeTrigger.setAttribute('aria-expanded', String(opening));
          if (!opening) return;
          const rect = rangeTrigger.getBoundingClientRect();
          const below = window.innerHeight - rect.bottom;
          rangeMenu.style.left = `${rect.left}px`;
          rangeMenu.style.width = `${rect.width}px`;
          const openBelow = below >= 180 || below >= rect.top;
          rangeMenu.style.top = openBelow ? `${rect.bottom + 6}px` : 'auto';
          rangeMenu.style.bottom = openBelow ? 'auto' : `${window.innerHeight - rect.top + 6}px`;
          rangeMenu.style.maxHeight = `${Math.min(300, (openBelow ? below : rect.top) - 12)}px`;
        });
        rangeMenu.addEventListener('toggle', event => {
          if (event.newState === 'open') rangeMenu.children[activeIndex]?.focus();
        });
        rangeMenu.addEventListener('keydown', event => {
          const index = [...rangeMenu.children].indexOf(event.target);
          const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: groupOptions.length - 1 }[event.key];
          if (target === undefined) return;
          event.preventDefault();
          rangeMenu.children[Math.max(0, Math.min(groupOptions.length - 1, target))]?.focus();
        });
        rangeField.append(rangeTrigger, rangeMenu);
        const makeStepButton = (step, label) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'ani-ep-group-btn';
          button.setAttribute('aria-label', label);
          button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${step < 0 ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'}"/></svg>`;
          button.onclick = () => selectGroup(groupOptions[activeIndex + step].id);
          return button;
        };
        previousGroup = makeStepButton(-1, '上一組集數');
        nextGroup = makeStepButton(1, '下一組集數');
        bar.append(previousGroup, rangeField, nextGroup);
      } else if (grouped) {
        for (const { id, label } of groupOptions) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ani-ep-group-btn';
          btn.dataset.epGroup = id;
          btn.textContent = label;
          btn.onclick = () => selectGroup(id, btn);
          bar.append(btn);
        }
      }

      if (grouped && !existingBar) ul.before(bar);
      if (!grouped) existingBar?.remove();
      renderVisibility();
    };

    if (!epGroupSubscribed) {
      epGroupSubscribed = true;
      settingsListeners.add(initLongEpisodeGrouping);
      const syncPlayingCard = event => {
        const video = event.target;
        if (!video.matches?.('#ani_video video') || !Number.isFinite(video.duration) ||
            video.closest('.vjs-ad-playing')) return;
        for (const frame of document.querySelectorAll('.ani-episode-cards li.playing .ani-episode-frame')) {
          const watch = episodeCardWatch.get(frame);
          watch.media = video;
          updateEpisodeCardWatch(frame, watch);
        }
      };
      for (const event of ['timeupdate', 'seeked', 'ended']) {
        document.addEventListener(event, syncPlayingCard, true);
      }
    }
    const root = document.querySelector('#BH_background');
    if (root && !episodeListRootObserver) {
      episodeListRootObserver = new MutationObserver(records => {
        if (records.some(record =>
          record.target.matches?.('.season ul') ||
          [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
            (node.matches('.season, ul.ani-ep-managed, .season ul') || node.querySelector('.season')))
        )) initLongEpisodeGrouping();
      });
      episodeListRootObserver.observe(root, { childList: true, subtree: true });
    }
    const firstList = lists.find(ul => ul.children.length > 1) ||
      (cardsAvailable && lists.find(ul => ul.children.length));
    const heading = firstList?.closest('.ani-episode-shelf')?.querySelector('.ani-episode-heading');
    if (firstList) {
      if (!episodeOrderButton) {
        episodeOrderButton = document.createElement('button');
        episodeOrderButton.type = 'button';
        episodeOrderButton.className = 'ani-ep-order';
        episodeOrderButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9m-9 6h7m-7 6h5"/><path data-episode-order-arrow/></svg><span></span>';
        episodeOrderButton.onclick = () => {
          episodeOrder = episodeOrder === 'asc' ? 'desc' : 'asc';
          initLongEpisodeGrouping();
        };
      }
      const label = episodeOrder === 'asc' ? '正序' : '倒序';
      if (episodeOrderButton.textContent !== label) {
        episodeOrderButton.lastElementChild.textContent = label;
        episodeOrderButton.querySelector('[data-episode-order-arrow]').setAttribute('d',
          episodeOrder === 'asc' ? 'M18 18V6m-3 3 3-3 3 3' : 'M18 6v12m-3-3 3 3 3-3');
        episodeOrderButton.setAttribute('aria-label', `集數${label}，點擊切換`);
      }
      if (!episodeOrderRow) {
        episodeOrderRow = document.createElement('div');
        episodeOrderRow.className = 'ani-ep-order-row';
        episodeLayoutSwitch = document.createElement('button');
        episodeLayoutSwitch.type = 'button';
        episodeLayoutSwitch.className = 'ani-ep-layout-switch';
        episodeLayoutSwitch.setAttribute('role', 'switch');
        episodeLayoutSwitch.setAttribute('aria-label', '使用原版選集');
        episodeLayoutSwitch.textContent = '原版';
        episodeLayoutSwitch.onclick = () => void writeSettings({ episodeThumbnailGrid: !currentSettings.episodeThumbnailGrid });
        episodeOrderRow.append(episodeOrderButton);
      }
      if (cardsAvailable) {
        episodeLayoutSwitch.setAttribute('aria-checked', String(!cardMode));
        if (episodeLayoutSwitch.parentElement !== episodeOrderRow) episodeOrderRow.append(episodeLayoutSwitch);
      } else {
        episodeLayoutSwitch.remove();
      }
      episodeOrderButton.hidden = firstList.children.length < 2;
      if (heading) {
        const expand = heading.querySelector('.ani-episode-section-toggle');
        if (expand && expand.previousElementSibling !== episodeOrderRow) expand.before(episodeOrderRow);
        else if (episodeOrderRow.parentElement !== heading) heading.append(episodeOrderRow);
      } else {
        const season = firstList.closest('.season');
        if (episodeOrderRow.nextElementSibling !== season) season.before(episodeOrderRow);
      }
    } else {
      episodeOrderRow?.remove();
    }
    for (const ul of lists) {
      applyGrouping(ul);
      if (observedEpisodeLists.has(ul)) continue;
      observedEpisodeLists.add(ul);
      if (typeof ResizeObserver === 'function') {
        let width;
        new ResizeObserver(([entry]) => {
          if (width === entry.contentRect.width) return;
          width = entry.contentRect.width;
          episodePreviewRenderers.get(ul)?.();
        }).observe(ul);
      }
    }
    for (const season of new Set(lists.map(ul => ul.closest('.ani-episode-shelf .season')).filter(Boolean))) {
      syncEpisodeTracks(season);
    }
  };

  // ── Feature 5B: 單集副標題懸浮預覽 ＋ 全螢幕中上副標題與長標題陰影遮罩跑馬燈 ──
  const getCleanAnimeTitle = () => {
    const raw = (document.querySelector('.anime_name h1')?.textContent || document.title || '').trim();
    return raw
      .replace(/\s*(?:線上看\s*)?-\s*巴哈姆特動畫瘋.*$/, '')
      .replace(/(?:\s*(?:\[\s*(?:\d+(?:\.\d+)?|中文配音|中配|國語(?:配音)?|雙語|特別篇|OAD|OVA)\s*\]|EP\.?\s*\d+(?:\.\d+)?))+\s*$/i, '')
      .trim();
  };

  const syncFullscreenSubtitleAndMarquee = () => {
    if (location.pathname !== '/animeVideo.php') return;
    const playerEl = document.querySelector('#ani_video');
    if (!playerEl) return;

    const animeTitleText = getCleanAnimeTitle().replace(/\s*\[(?:電影|劇場版)\]\s*$/, '');

    let fsTitle = playerEl.querySelector('.ani-fs-title');
    if (!fsTitle && animeTitleText) {
      fsTitle = document.createElement('div');
      fsTitle.className = 'ani-fs-title';
      playerEl.append(fsTitle);
    }
    if (!fsTitle) return;

    let mainBox = fsTitle.querySelector('.ani-fs-title-main');
    let subBox = fsTitle.querySelector('.ani-fs-subtitle');
    if (!mainBox) {
      const initialTxt = animeTitleText || (fsTitle.textContent || '').trim();
      fsTitle.textContent = '';
      mainBox = document.createElement('div');
      mainBox.className = 'ani-fs-title-main';
      const mainTrack = document.createElement('span');
      mainTrack.className = 'ani-marquee-track';
      mainTrack.textContent = initialTxt;
      mainBox.append(mainTrack);

      subBox = document.createElement('div');
      subBox.className = 'ani-fs-subtitle';
      subBox.hidden = true;
      const subTrack = document.createElement('span');
      subTrack.className = 'ani-marquee-track';
      subBox.append(subTrack);

      fsTitle.append(mainBox, subBox);
    } else if (animeTitleText) {
      const mt = mainBox.querySelector('.ani-marquee-track');
      if (mt && mt.textContent !== animeTitleText) mt.textContent = animeTitleText;
    }

    const playingLink = document.querySelector('.season li.playing a');
    const epSub = playingLink?.dataset?.aniEpTitle || '';
    if (subBox) {
      const st = subBox.querySelector('.ani-marquee-track');
      if (epSub) {
        if (st && st.textContent !== epSub) st.textContent = epSub;
        subBox.hidden = false;
      } else {
        if (st) st.textContent = '';
        subBox.hidden = true;
      }
    }

    applyShadowMarquee(mainBox);
    if (subBox && !subBox.hidden) applyShadowMarquee(subBox);

    if (!fsTitle.dataset.aniFsMarqueeBound) {
      fsTitle.dataset.aniFsMarqueeBound = '1';
      const remeasure = () => {
        applyShadowMarquee(mainBox);
        if (subBox && !subBox.hidden) applyShadowMarquee(subBox);
      };
      document.addEventListener('fullscreenchange', remeasure);
      document.addEventListener('webkitfullscreenchange', remeasure);
      window.addEventListener('resize', remeasure, { passive: true });
      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(remeasure);
        ro.observe(fsTitle);
        ro.observe(mainBox);
      }
    }
  };

  const getEpTooltipNode = () => {
    let tip = document.getElementById('ani-ep-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'ani-ep-tooltip';
      tip.className = 'ani-ep-tooltip';
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      document.body.append(tip);
    }
    return tip;
  };

  const initEpisodeTitleTooltips = async () => {
    if (location.pathname !== '/animeVideo.php') return;
    syncFullscreenSubtitleAndMarquee();
    const season = document.querySelector('.season');
    if (!season) return;
    const cleanTitle = getCleanAnimeTitle();
    if (!cleanTitle) return;

    const tip = getEpTooltipNode();
    if (!season.dataset.aniEpTipWired) {
      season.dataset.aniEpTipWired = '1';
      const showTip = (link) => {
        link.removeAttribute('title');
        if (link.closest('.ani-episode-cards')) {
          tip.hidden = true;
          return;
        }
        const epTitle = link.dataset.aniEpTitle;
        const synopsis = document.body.classList.contains('ani-hide-episode-description') ? '' : link.dataset.aniEpDescription;
        const airdate = link.dataset.aniUploadDate || '';
        tip.innerHTML = `
          ${epTitle ? `<div class="ani-ep-tip-title">${escapeHtml(epTitle)}</div>` : ''}
          ${synopsis ? `<div class="ani-ep-tip-synopsis">${escapeHtml(synopsis)}</div>` : ''}
          ${airdate ? `<time class="ani-ep-tip-date" datetime="${escapeHtml(airdate.replaceAll('/', '-'))}">${escapeHtml(airdate)}</time>` : ''}
        `;
        tip.hidden = !epTitle && !synopsis && !airdate;
        if (!tip.hidden) {
          const rect = link.getBoundingClientRect();
          const box = tip.getBoundingClientRect();
          const left = Math.max(8, Math.min(innerWidth - box.width - 8, rect.left + (rect.width - box.width) / 2));
          const below = rect.bottom + 8;
          const above = rect.top - box.height - 8;
          tip.style.left = `${left}px`;
          tip.style.top = `${below + box.height <= innerHeight - 8 || above < 8 ? below : above}px`;
        }
        const sn = link.dataset.aniVideoSn || new URL(link.href, location.href).searchParams.get('sn');
        if (!airdate && /^\d+$/.test(sn)) globalThis.aniGetEpisodeDetails?.(sn).then(data => {
          if (data?.date) {
            link.dataset.aniUploadDate = data.date;
            if (link.matches(':hover') || link === document.activeElement) showTip(link);
          }
        });
      };
      const hideTip = () => { tip.hidden = true; };
      season.addEventListener('mouseover', (e) => {
        const a = e.target.closest('li a');
        if (a) showTip(a);
      });
      season.addEventListener('focusin', (e) => {
        const a = e.target.closest('li a');
        if (a) showTip(a);
      });
      season.addEventListener('mouseout', (e) => {
        const a = e.target.closest('li a');
        if (a && !a.contains(e.relatedTarget)) hideTip();
      });
      season.addEventListener('focusout', hideTip);
      window.addEventListener('scroll', hideTip, { passive: true });
    }

    const cache = readJsonLocal(EP_TITLES_CACHE_KEY, {});
    const cachedEntry = cache[cleanTitle];
    let epMap =
      cachedEntry && Date.now() - Number(cachedEntry.ts || 0) < WORK_META_TTL_MS && cachedEntry.episodes
        ? cachedEntry.episodes
        : null;

    if (!epMap || cachedEntry.metadataVersion !== EP_METADATA_VERSION) {
      const acgUrl = document.querySelector('a[href*="acg.gamer.com.tw/acgDetail.php?s="]')?.href || '';
      let resp = await sendWorkerMessage({ type: 'ani-fetch-episode-titles', title: cleanTitle, acgUrl });
      if (!resp?.ok && typeof fetchEpisodeTitles === 'function' && typeof GM_xmlhttpRequest === 'function') {
        const request = (url, options) => new Promise((resolve, reject) => GM_xmlhttpRequest({
          url, method: options.method || 'GET', headers: options.headers, data: options.body,
          timeout: 8000, onerror: reject, ontimeout: reject,
          onload: res => resolve({ ok: res.status === 200, text: () => res.responseText, json: () => JSON.parse(res.responseText) }),
        }));
        resp = { ok: true, episodes: await fetchEpisodeTitles(cleanTitle, request, acgUrl) };
      }
      if (resp?.ok && resp.episodes && Object.keys(resp.episodes).length > 0) {
        epMap = resp.episodes;
        cache[cleanTitle] = { ts: Date.now(), metadataVersion: EP_METADATA_VERSION, episodes: epMap };
        const keys = Object.keys(cache);
        if (keys.length > 120) {
          keys.sort((a, b) => (cache[b]?.ts || 0) - (cache[a]?.ts || 0)).slice(120).forEach((k) => delete cache[k]);
        }
        writeJsonLocal(EP_TITLES_CACHE_KEY, cache);
      }
    }

    const mainEpisodes = season.querySelector('ul');
    const movieWork = /劇場版/.test(cleanTitle) ||
      /\[(?:(?:中文|國語|日文)?電影(?:版)?|劇場版)\]/.test(document.querySelector('.anime_name h1')?.textContent || '');
    const movieName = cleanTitle
      .replace(/(?:\s*\[\s*(?:(?:中文|國語|日文)?電影(?:版)?|劇場版)\s*\])+\s*$/, '')
      .replace(/^(?:劇場版\s*)?關於我轉生變成史萊姆這檔事\s*(?:劇場版\s*)?(?=紅蓮之絆篇|蒼海之淚篇)/, '');
    const movieSubtitle = movieName.match(/^.+?劇場版\s*[:：・－—-]?\s*(.+)$/)?.[1] || movieName;
    const workSynopsis = () => document.querySelector('.ani-side-synopsis')?.textContent.trim() ||
      [...document.querySelectorAll('#BH_background section.data .data-intro > p')]
        .map(paragraph => paragraph.textContent.trim()).join(' ');
    const isPolarOpposites = /^相反的你和我(?:\s*第[二2][季期])?$/.test(cleanTitle);
    const slimeSeasonLabel = cleanTitle.match(/^關於我轉生變成史萊姆這檔事(?:\s*第([一二三四1-4])[季期])?$/);
    const slimeSeasonNumber = slimeSeasonLabel &&
      (Number(slimeSeasonLabel[1]) || '一二三四'.indexOf(slimeSeasonLabel[1] || '一') + 1);
    const slimeSeason = slimeSeasonDescriptions[slimeSeasonNumber];
    const slimeSpinoff = /^(?:轉生史萊姆日記(?:\s*關於我轉生變成史萊姆這檔事)?|關於我轉生變成史萊姆這檔事\s*轉生史萊姆日記)$/.test(cleanTitle)
      ? slimeSpinoffEpisodes.diary
      : /^關於我轉生變成史萊姆這檔事\s*柯里烏斯之夢$/.test(cleanTitle) ? slimeSpinoffEpisodes.coleus : null;
    const verifiedTitles = (slimeSeasonTitles[slimeSeasonNumber] || slimeSpinoff?.titles)?.split('｜');
    for (const a of season.querySelectorAll('li a')) {
      const rawEp = (a.textContent || '').trim();
      const numMatch = rawEp.match(/(\d+(?:\.\d+)?)/)?.[1];
      const epData = epMap?.[rawEp] || (numMatch ? epMap?.[numMatch] || epMap?.[String(Number(numMatch))] : null);
      const list = a.closest('ul');
      const previous = list?.previousElementSibling;
      const listLabel = (previous?.matches('.ani-ep-group-bar') ? previous.previousElementSibling : previous)?.textContent.trim() || '';
      const isStoryList = (list === mainEpisodes && (!slimeSeason || !/特別篇|OAD|OVA/i.test(listLabel))) ||
        /^(?:中文配音|中配|國語配音|國語)(?:版)?$/.test(listLabel);
      const episodeNumber = Number(numMatch);
      const isMovie = isMovieEpisodeTrack(listLabel) ||
        (movieWork && list?.querySelectorAll('li a').length === 1 && isStoryList);
      const verifiedIndex = episodeNumber - (slimeSeason?.firstEpisode || 1);
      const episodeTitle = isMovie ? movieSubtitle : isStoryList ? epData?.name || verifiedTitles?.[verifiedIndex]
        : slimeSeason || slimeSpinoff ? null : epData?.name;
      if (episodeTitle) {
        a.dataset.aniEpTitle = traditionalTitle(episodeTitle);
        const heading = a.querySelector('.ani-episode-card-heading');
        if (heading) {
          heading.dataset.title = a.dataset.aniEpTitle;
          heading.firstElementChild.dataset.title = a.dataset.aniEpTitle;
        }
        if (epData?.airdate) a.dataset.aniEpAirdate = epData.airdate;
        a.removeAttribute('title');
      }
      // Bangumi lists the main episodes separately from specials.
      const description = a.querySelector('.ani-episode-card-description');
      const synopsis = description?.querySelector('.ani-episode-card-synopsis');
      if (isStoryList || isMovie) {
        const source = typeof epData?.description === 'string' ? epData.description : '';
        // Some episode records put staff credits in the description field.
        const story = source.split(/(?:^|\r?\n)[^\S\r\n]*(?:[＜<【\[]\s*)?(?:(?:STAFF|製作團隊|製作人員)(?:\s*[＞>】\]])?(?=\s|[:：]|$)|(?:[｜|]\s*)?(?:脚本|腳本|劇本|分鏡|分镜|絵コンテ|演出|原畫|原画|作畫監督|作画監督|原畫\s*[/／]\s*作監|作監)\s*[:：])/i)[0];
        const chinese = story.split(/\r?\n[^\S\r\n]*\r?\n/)
          .map(paragraph => paragraph.trim())
          .filter(paragraph => /\p{Script=Han}/u.test(paragraph) &&
            !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(paragraph));
        const verifiedStory = slimeSeason || slimeSpinoff ? (slimeSeason || slimeSpinoff).summaries[verifiedIndex]
          : chinese.join(' ') || (isMovie ? workSynopsis() : '') ||
            (isPolarOpposites ? polarOppositesSeasonTwoDescriptions[episodeNumber] : '');
        if (verifiedStory) {
          const text = traditionalTitle(verifiedStory).replace(/\s+/g, ' ').trim();
          const maxLength = 82;
          const characters = Array.from(text);
          const excerpt = characters.slice(0, maxLength).join('');
          const completeSentences = excerpt.match(/^.*[。！？!?]/u)?.[0];
          a.dataset.aniEpDescription = characters.length <= maxLength
            ? text
            : completeSentences || excerpt.trimEnd() + '…';
          if (description) description.dataset.text = a.dataset.aniEpDescription;
          if (synopsis) synopsis.dataset.text = a.dataset.aniEpDescription;
          continue;
        }
      }
      delete a.dataset.aniEpDescription;
      if (description) description.dataset.text = '';
      if (synopsis) synopsis.dataset.text = '';
    }
    season.dispatchEvent(new Event('ani-episode-titles-ready'));
    const hovered = season.querySelector('li a:hover, li a:focus');
    if (hovered) hovered.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    syncFullscreenSubtitleAndMarquee();
  };

  // ── Feature 5C: 即將下架醒目提醒 ──
  const parseOffshelfNotice = (rawText) => {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const dated = text.match(
      /(?:預計|將於|本作品將於)?\s*((?:20\d{2}[\/\-年])?\d{1,2}[\/\-月]\d{1,2}日?(?:\s*\d{1,2}:\d{2})?)\s*(?:起)?(?:下架|到期|停止授權)/,
    );
    const labeled = text.match(/(?:下架時間|授權到期)[：:]\s*([^\n，,。]{3,28})/);
    const generic = !dated && !labeled ? text.match(/(即將下架|即將到期|下架預告)/) : null;
    if (!dated && !labeled && !generic) return null;

    const dateText = (dated?.[1] || labeled?.[1] || '').trim();
    let daysLeft = null;
    if (dateText) {
      const ymd = dateText.match(/(?:(20\d{2})[\/\-年])?(\d{1,2})[\/\-月](\d{1,2})/);
      if (ymd) {
        const now = new Date();
        let yr = ymd[1] ? Number(ymd[1]) : now.getFullYear();
        const mo = Number(ymd[2]) - 1;
        const dy = Number(ymd[3]);
        let target = new Date(yr, mo, dy, 23, 59, 59);
        if (!ymd[1] && target.getTime() < now.getTime() - 7 * 86400000) {
          target = new Date(yr + 1, mo, dy, 23, 59, 59);
        }
        const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
        if (diff >= 0 && diff <= 120) daysLeft = diff;
      }
    }
    const notice = dated?.[0] || labeled?.[0] || generic?.[0] || '即將下架';
    return { notice, dateText, daysLeft };
  };

  let offshelfSubscribed = false;

  const initOffshelfAlerts = () => {
    const allowedPaths = ['/', '/index.php', '/animeList.php', '/mygather.php', '/animeVideo.php', '/animeRef.php'];
    if (!allowedPaths.includes(location.pathname)) return;

    const run = () => {
      if (!currentSettings.showOffshelfAlert) {
        for (const el of document.querySelectorAll('.ani-offshelf-banner, .ani-offshelf-badge')) el.remove();
        return;
      }

      const offshelfCache = readJsonLocal(OFFSHELF_CACHE_KEY, {});
      const now = Date.now();
      let cacheUpdated = false;
      for (const [k, v] of Object.entries(offshelfCache)) {
        if (!v || now - Number(v.detectedAt || 0) > 60 * 86400000) {
          delete offshelfCache[k];
          cacheUpdated = true;
        }
      }

      if (location.pathname === '/animeVideo.php' || location.pathname === '/animeRef.php') {
        const scanText = [...document.querySelectorAll('.anime_info_detail, .data_intro, .notice, .season, .anime_name')]
          .map((el) => el.textContent || '')
          .join(' ');
        const parsed = parseOffshelfNotice(scanText);
        const refLink = document.querySelector('a[href*="animeRef.php?sn="]');
        const sn = getSnFromHref(refLink?.getAttribute('href')) || getSnFromHref(location.href);
        const title = getCleanAnimeTitle();
        if (parsed) {
          if (sn) {
            offshelfCache[sn] = { sn, title, ...parsed, detectedAt: now };
            cacheUpdated = true;
          }
          const hostAnchor =
            document.querySelector('.container-player > .anime-title') ||
            document.querySelector('.anime_name') ||
            document.querySelector('#BH_background');
          if (hostAnchor) {
            let banner = document.querySelector('.ani-offshelf-banner');
            if (!banner) {
              banner = document.createElement('div');
              banner.className = 'ani-offshelf-banner';
              banner.setAttribute('role', 'status');
              if (hostAnchor.classList.contains('anime-title')) hostAnchor.after(banner);
              else hostAnchor.prepend(banner);
            }
            const dayNote =
              parsed.daysLeft !== null
                ? parsed.daysLeft === 0
                  ? '（今天到期）'
                  : `（剩餘 ${parsed.daysLeft} 天）`
                : '';
            banner.innerHTML = `<span class="ani-offshelf-dot" aria-hidden="true">!</span><strong>即將下架提醒</strong><span>${escapeHtml(parsed.notice)}${escapeHtml(dayNote)}</span>`;
          }
        }
      } else {
        const expiringInCollection = [];
        for (const card of document.querySelectorAll('.theme-list-main')) {
          const sn = getSnFromHref(card.getAttribute('href'));
          const cover = card.querySelector('.theme-img-block');
          if (!cover) continue;
          const inlineMatch = parseOffshelfNotice(card.textContent || '');
          const hit = inlineMatch || (sn ? offshelfCache[sn] : null);
          if (inlineMatch && sn) {
            offshelfCache[sn] = {
              sn,
              title: (card.querySelector('.theme-name')?.textContent || '').trim(),
              ...inlineMatch,
              detectedAt: now,
            };
            cacheUpdated = true;
          }
          const existingBadge = cover.querySelector('.ani-offshelf-badge');
          if (!hit) {
            existingBadge?.remove();
            continue;
          }
          const cardTitle = (card.querySelector('.theme-name')?.textContent || hit.title || '').trim();
          expiringInCollection.push({ sn, title: cardTitle, dateText: hit.dateText, notice: hit.notice });
          const label = hit.daysLeft !== null && hit.daysLeft <= 30
            ? `${hit.daysLeft === 0 ? '今日' : `${hit.daysLeft}天`}下架`
            : hit.dateText
            ? `${hit.dateText} 下架`
            : '即將下架';
          const badge = existingBadge || document.createElement('span');
          badge.className = 'ani-offshelf-badge';
          badge.classList.toggle('has-score', Boolean(cover.querySelector('.ani-poster-score')));
          badge.textContent = label;
          if (!existingBadge) cover.append(badge);
        }

        if (location.pathname === '/mygather.php' && expiringInCollection.length) {
          const listWrap = document.querySelector('.animate-theme-list .theme-list-block');
          if (listWrap) {
            let banner = document.querySelector('.ani-offshelf-banner');
            if (!banner) {
              banner = document.createElement('div');
              banner.className = 'ani-offshelf-banner is-collection';
              banner.setAttribute('role', 'status');
              listWrap.before(banner);
            }
            const names = expiringInCollection.slice(0, 3).map((x) => x.title).filter(Boolean).join('、');
            const extra = expiringInCollection.length > 3 ? ` 等 ${expiringInCollection.length} 部` : '';
            banner.innerHTML = `<span class="ani-offshelf-dot" aria-hidden="true">!</span><strong>收藏即將下架提醒</strong><span>${escapeHtml(names)}${escapeHtml(extra)} 即將授權到期，建議優先補完！</span>`;
          }
        }
      }

      if (cacheUpdated) writeJsonLocal(OFFSHELF_CACHE_KEY, offshelfCache);
    };

    if (!offshelfSubscribed) {
      offshelfSubscribed = true;
      settingsListeners.add(() => { run(); });
    }
    run();
  };

  const state = {
    getSettings: () => currentSettings,
    onSettingsChange: (fn) => {
      settingsListeners.add(fn);
      return () => settingsListeners.delete(fn);
    },
    readSettings,
    writeSettings,
    storageGet,
    storageSet,
    escapeHtml,
    traditionalTitle,
    showToast,
    getSnFromHref,
    fetchTagSnSet,
    buildCatalogPageUrl,
    recordVideoProgress,
    resolveEpisodeProgress,
    isMovieEpisodeTrack,
    normalizeBilingualEpisodeTracks,
    initBrowseFilters: initCatalogEnhancements,
    reinit: async () => {
      await readSettings();
      initLongEpisodeGrouping();
      await initCollectionStatusTagger();
      await initWatchCollectionStatusButton();
      initCatalogEnhancements();
      await initSpoilerBlur();
      await initDanmuListTools();
      initCommentSendButton();
      await initEpisodeTitleTooltips();
      initOffshelfAlerts();
      initVideoHistoryTracker();
      await initPermanentHistoryPage();
    },
  };

  globalThis.AniEnhancements = state;
  document.dispatchEvent(new Event('ani-enhancements-ready'));

  const boot = async () => {
    await readSettings();
    initLongEpisodeGrouping();
    await initCollectionStatusTagger();
    initCatalogEnhancements();
    if (location.pathname === '/animeVideo.php') document.documentElement.dataset.aniEpisodePreview = 'true';
    document.documentElement.dataset.aniEnhancementsUiReady = 'true';
    window.dispatchEvent(new Event('ani-enhancements-ui-ready'));
    await initWatchCollectionStatusButton();
    await initSpoilerBlur();
    await initDanmuListTools();
    initCommentSendButton();
    await initEpisodeTitleTooltips();
    initOffshelfAlerts();
    initVideoHistoryTracker();
    await initPermanentHistoryPage();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  } else {
    boot();
  }
})();
