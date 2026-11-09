/*
  無機変換ラボ — 高校無機化学の変換パズル
  出発物質と目標物質がランダムに出題される。試薬を加えてビーカーの中身を目標に変える。
  見た目はサイト（Aoristos）に合わせ、クラス名はすべて ik- で始める（サイトの CSS とぶつからないように）。
*/
(function () {
// ---------- formula formatter: digits after a letter/)/] become subscripts, ^{..} or ^+/^- become superscripts
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function f(s){let o="",i=0;const L=s.length;
  while(i<L){const c=s[i];
    if(c==="^"){let ch;if(s[i+1]==="{"){const j=s.indexOf("}",i);ch=s.slice(i+2,j);i=j+1}else{ch=s[i+1];i+=2}
      o+="<sup>"+esc(ch).replace(/-/g,"−")+"</sup>";continue}
    if(/[0-9]/.test(c)&&i>0&&/[A-Za-z\)\]]/.test(s[i-1])){let d="";while(i<L&&/[0-9]/.test(s[i])){d+=s[i];i++}o+="<sub>"+d+"</sub>";continue}
    o+=esc(c);i++}
  return o}
function fu(s){const SB="₀₁₂₃₄₅₆₇₈₉",SP={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻"};
  return s.replace(/\^\{([^}]*)\}|\^(.)/g,(m,a,b)=>[...(a||b)].map(c=>SP[c]||c).join(""))
          .replace(/([A-Za-z\)\]])(\d+)/g,(m,a,d)=>a+[...d].map(c=>SB[c]).join(""))}
function rich(t){return t.split("$").map((p,k)=>k%2?'<span class="ik-fx">'+f(p)+"</span>":esc(p)).join("")}

// ---------- reagents
const R={
  HCl:{f:"HCl",s:"希塩酸"}, cHCl:{f:"HCl",s:"濃塩酸・加熱"}, HNO3:{f:"HNO3",s:"硝酸"}, H2SO4:{f:"H2SO4",s:"希硫酸"},
  NaOH:{f:"NaOH",s:"水酸化ナトリウム水溶液"}, NH3:{f:"NH3",s:"アンモニア水"},
  H2Sa:{f:"H2S",s:"酸性で通じる"}, H2Sb:{f:"H2S",s:"中性〜塩基性で通じる"},
  SO2:{f:"SO2",s:"吹き込む"}, CO2:{f:"CO2",s:"吹き込む"},
  Cl2:{f:"Cl2",s:"塩素水"}, Br2:{f:"Br2",s:"臭素水"}, I2:{f:"I2",s:"ヨウ素ヨウ化カリウム水溶液"},
  H2O2:{f:"H2O2",s:"過酸化水素水"}, KMnO4:{f:"KMnO4",s:"硫酸酸性"}, H2C2O4:{f:"(COOH)2",s:"シュウ酸・硫酸酸性で加温"},
  MnO2a:{f:"MnO2",s:"濃硫酸を加えて加熱"},
  KBr:{f:"KBr",s:"臭化カリウム"}, KI:{f:"KI",s:"ヨウ化カリウム"}, AgNO3:{f:"AgNO3",s:"硝酸銀"},
  K2CrO4:{f:"K2CrO4",s:"クロム酸カリウム"}, KSCN:{f:"KSCN",s:"チオシアン酸カリウム"},
  K4:{f:"K4[Fe(CN)6]",s:"ヘキサシアニド鉄(II)酸K"}, K3:{f:"K3[Fe(CN)6]",s:"ヘキサシアニド鉄(III)酸K"},
  S2O3:{f:"Na2S2O3",s:"チオ硫酸ナトリウム"}, Na2CO3:{f:"Na2CO3",s:"炭酸ナトリウム"},
  CuSO4:{f:"CuSO4",s:"硫酸銅(II)"}, BaCl2:{f:"BaCl2",s:"塩化バリウム"},
  starch:{f:null,t:"デンプン",s:"デンプン水溶液"},
  heat:{f:null,t:"Δ",s:"加熱する"}, light:{f:null,t:"hν",s:"光を当てる"}
};
const ORDER=Object.keys(R);
function rHTML(id){const r=R[id];return r.f?'<span class="ik-fx">'+f(r.f)+"</span>":esc(r.t)}
function rFull(id){const r=R[id];return r.f?rHTML(id)+"（"+esc(r.s)+"）":esc(r.s)}

// ---------- forms: ph aq = solution (col = solution color), s = precipitate (col = solid color)
const W=null;
const F={
 cu2:{f:"Cu^{2+}",ph:"aq",col:"#3f9ad6",look:"青色の溶液"},
 cuoh:{f:"Cu(OH)2",ph:"s",col:"#8ec3e8",look:"青白色の沈殿"},
 cuo:{f:"CuO",ph:"s",col:"#1c1c1c",look:"黒色の沈殿"},
 cunh:{f:"[Cu(NH3)4]^{2+}",ph:"aq",col:"#1a3cb0",look:"深青色の溶液"},
 cus:{f:"CuS",ph:"s",col:"#151515",look:"黒色の沈殿"},

 ag1:{f:"Ag^+",ph:"aq",col:W,look:"無色の溶液"},
 agcl:{f:"AgCl",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 ag2o:{f:"Ag2O",ph:"s",col:"#6b4a2b",look:"褐色の沈殿"},
 agnh:{f:"[Ag(NH3)2]^+",ph:"aq",col:W,look:"無色の溶液"},
 ag2s:{f:"Ag2S",ph:"s",col:"#141414",look:"黒色の沈殿"},
 agi:{f:"AgI",ph:"s",col:"#efd75a",look:"黄色の沈殿"},
 ag2cro4:{f:"Ag2CrO4",ph:"s",col:"#9b2e1d",look:"赤褐色の沈殿"},
 agtsc:{f:"[Ag(S2O3)2]^{3-}",ph:"aq",col:W,look:"無色の溶液"},
 ag:{f:"Ag",ph:"s",col:"#4a4a4a",look:"黒っぽい銀の粒"},

 zn2:{f:"Zn^{2+}",ph:"aq",col:W,look:"無色の溶液"},
 znoh:{f:"Zn(OH)2",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 znoh4:{f:"[Zn(OH)4]^{2-}",ph:"aq",col:W,look:"無色の溶液"},
 znnh:{f:"[Zn(NH3)4]^{2+}",ph:"aq",col:W,look:"無色の溶液"},
 zns:{f:"ZnS",ph:"s",col:"#f3f3ef",look:"白色の沈殿"},

 al3:{f:"Al^{3+}",ph:"aq",col:W,look:"無色の溶液"},
 aloh:{f:"Al(OH)3",ph:"s",col:"#eef1f2",look:"白色ゲル状の沈殿"},
 aloh4:{f:"[Al(OH)4]^-",ph:"aq",col:W,look:"無色の溶液"},

 fe2:{f:"Fe^{2+}",ph:"aq",col:"#b6d79a",look:"淡緑色の溶液"},
 fe3:{f:"Fe^{3+}",ph:"aq",col:"#c98f2e",look:"黄褐色の溶液"},
 feoh2:{f:"Fe(OH)2",ph:"s",col:"#a8c79a",look:"緑白色の沈殿"},
 feoh3:{f:"Fe(OH)3",ph:"s",col:"#8a3a15",look:"赤褐色の沈殿"},
 fes:{f:"FeS",ph:"s",col:"#161616",look:"黒色の沈殿"},
 fescn:{f:"[Fe(SCN)]^{2+}",ph:"aq",col:"#8c0b10",look:"血赤色の溶液"},
 pblue:{f:"KFe[Fe(CN)6]",ph:"s",col:"#132f7a",look:"濃青色の沈殿",end:true},
 fe2k4:{f:"K2Fe[Fe(CN)6]",ph:"s",col:"#c4d8ee",look:"青白色の沈殿"},

 pb2:{f:"Pb^{2+}",ph:"aq",col:W,look:"無色の溶液"},
 pbcl2:{f:"PbCl2",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 pbso4:{f:"PbSO4",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 pbcro4:{f:"PbCrO4",ph:"s",col:"#f1c100",look:"黄色の沈殿"},
 pbs:{f:"PbS",ph:"s",col:"#151515",look:"黒色の沈殿"},
 pboh:{f:"Pb(OH)2",ph:"s",col:"#f4f4f2",look:"白色の沈殿"},
 pboh4:{f:"[Pb(OH)4]^{2-}",ph:"aq",col:W,look:"無色の溶液"},
 pbi2:{f:"PbI2",ph:"s",col:"#f4cf00",look:"黄色の沈殿"},

 ni2:{f:"Ni^{2+}",ph:"aq",col:"#5fae6c",look:"緑色の溶液"},
 nioh:{f:"Ni(OH)2",ph:"s",col:"#6dbb6a",look:"緑色の沈殿"},
 ninh:{f:"[Ni(NH3)6]^{2+}",ph:"aq",col:"#6f62c4",look:"青紫色の溶液"},
 nis:{f:"NiS",ph:"s",col:"#151515",look:"黒色の沈殿"},

 cr2o7:{f:"Cr2O7^{2-}",ph:"aq",col:"#e0661a",look:"橙赤色の溶液"},
 cro4:{f:"CrO4^{2-}",ph:"aq",col:"#f0c419",look:"黄色の溶液"},
 cr3:{f:"Cr^{3+}",ph:"aq",col:"#3d6b45",look:"暗緑色の溶液"},
 croh3:{f:"Cr(OH)3",ph:"s",col:"#728c6c",look:"灰緑色の沈殿"},
 croh4:{f:"[Cr(OH)4]^-",ph:"aq",col:"#3f8f4f",look:"緑色の溶液"},

 mno4:{f:"MnO4^-",ph:"aq",col:"#7a1a6e",look:"赤紫色の溶液"},
 mn2:{f:"Mn^{2+}",ph:"aq",col:"#f3dfe3",look:"淡桃色（ほぼ無色）の溶液"},
 mnoh2:{f:"Mn(OH)2",ph:"s",col:"#efe4df",look:"白色〜淡桃色の沈殿"},
 mns:{f:"MnS",ph:"s",col:"#e7b5b5",look:"淡桃色の沈殿"},
 mno2:{f:"MnO2",ph:"s",col:"#2a1f1a",look:"黒褐色の沈殿"},

 caoh:{f:"Ca(OH)2",ph:"aq",col:W,look:"無色の溶液（石灰水）"},
 ca2:{f:"Ca^{2+}",ph:"aq",col:W,look:"無色の溶液"},
 caco3:{f:"CaCO3",ph:"s",col:"#f6f6f4",look:"白色の沈殿（白濁）"},
 cahco3:{f:"Ca(HCO3)2",ph:"aq",col:W,look:"無色の溶液"},
 caso4:{f:"CaSO4",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},

 ba2:{f:"Ba^{2+}",ph:"aq",col:W,look:"無色の溶液"},
 baso4:{f:"BaSO4",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 baco3:{f:"BaCO3",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 bacro4:{f:"BaCrO4",ph:"s",col:"#f0c419",look:"黄色の沈殿"},

 cl1:{f:"Cl^-",ph:"aq",col:W,look:"無色の溶液"},
 cl2x:{f:"Cl2",ph:"aq",col:"#d8e486",look:"黄緑色の溶液（塩素水）"},
 agclx:{f:"AgCl",ph:"s",col:"#f6f6f4",look:"白色の沈殿"},
 br1:{f:"Br^-",ph:"aq",col:W,look:"無色の溶液"},
 br2:{f:"Br2",ph:"aq",col:"#b5501d",look:"赤褐色の溶液（臭素水）"},
 agbrx:{f:"AgBr",ph:"s",col:"#f1e7a8",look:"淡黄色の沈殿"},
 i1:{f:"I^-",ph:"aq",col:W,look:"無色の溶液"},
 i2:{f:"I2",ph:"aq",col:"#8a4a14",look:"褐色の溶液"},
 istarch:{f:"I2（デンプン）",ph:"aq",col:"#3b2a7a",look:"青紫色の溶液（ヨウ素デンプン反応）"},
 agix:{f:"AgI",ph:"s",col:"#efd75a",look:"黄色の沈殿"},

 h2s:{f:"H2S",ph:"aq",col:W,look:"無色の溶液（硫化水素水）"},
 s0:{f:"S",ph:"s",col:"#f0ebc4",look:"白濁（淡黄色の硫黄）"},
 so2:{f:"SO2",ph:"aq",col:W,look:"無色の溶液（亜硫酸水）"},
 so4:{f:"SO4^{2-}",ph:"aq",col:W,look:"無色の溶液"},
 baso4s:{f:"BaSO4",ph:"s",col:"#f6f6f4",look:"白色の沈殿",end:true},
 cuss:{f:"CuS",ph:"s",col:"#151515",look:"黒色の沈殿"}
};

// ---------- names (systematic name / common name)
const NM={cu2:"銅(II)イオン",cuoh:"水酸化銅(II)",cuo:"酸化銅(II)",cunh:"テトラアンミン銅(II)イオン",cus:"硫化銅(II)",
 ag1:"銀イオン",agcl:"塩化銀",ag2o:"酸化銀",agnh:"ジアンミン銀(I)イオン",ag2s:"硫化銀",agi:"ヨウ化銀",ag2cro4:"クロム酸銀",agtsc:"ビス(チオスルファト)銀(I)酸イオン",ag:"銀",
 zn2:"亜鉛イオン",znoh:"水酸化亜鉛",znoh4:"テトラヒドロキシド亜鉛(II)酸イオン",znnh:"テトラアンミン亜鉛(II)イオン",zns:"硫化亜鉛",
 al3:"アルミニウムイオン",aloh:"水酸化アルミニウム",aloh4:"テトラヒドロキシドアルミン酸イオン",
 fe2:"鉄(II)イオン",fe3:"鉄(III)イオン",feoh2:"水酸化鉄(II)",feoh3:"水酸化鉄(III)",fes:"硫化鉄(II)",fescn:"チオシアナト鉄(III)イオン",
 pblue:"ヘキサシアニド鉄(II)酸鉄(III)カリウム",fe2k4:"ヘキサシアニド鉄(II)酸鉄(II)カリウム",
 pb2:"鉛(II)イオン",pbcl2:"塩化鉛(II)",pbso4:"硫酸鉛(II)",pbcro4:"クロム酸鉛(II)",pbs:"硫化鉛(II)",pboh:"水酸化鉛(II)",pboh4:"テトラヒドロキシド鉛(II)酸イオン",pbi2:"ヨウ化鉛(II)",
 ni2:"ニッケル(II)イオン",nioh:"水酸化ニッケル(II)",ninh:"ヘキサアンミンニッケル(II)イオン",nis:"硫化ニッケル(II)",
 cr2o7:"二クロム酸イオン",cro4:"クロム酸イオン",cr3:"クロム(III)イオン",croh3:"水酸化クロム(III)",croh4:"テトラヒドロキシドクロム(III)酸イオン",
 mno4:"過マンガン酸イオン",mn2:"マンガン(II)イオン",mnoh2:"水酸化マンガン(II)",mns:"硫化マンガン(II)",mno2:"酸化マンガン(IV)",
 caoh:"水酸化カルシウム",ca2:"カルシウムイオン",caco3:"炭酸カルシウム",cahco3:"炭酸水素カルシウム",caso4:"硫酸カルシウム",
 ba2:"バリウムイオン",baso4:"硫酸バリウム",baco3:"炭酸バリウム",bacro4:"クロム酸バリウム",
 cl1:"塩化物イオン",cl2x:"塩素",agclx:"塩化銀",br1:"臭化物イオン",br2:"臭素",agbrx:"臭化銀",i1:"ヨウ化物イオン",i2:"ヨウ素",istarch:"ヨウ素デンプン複合体",agix:"ヨウ化銀",
 h2s:"硫化水素",s0:"硫黄",so2:"二酸化硫黄",so4:"硫酸イオン",baso4s:"硫酸バリウム",cuss:"硫化銅(II)"};
// default common names
const AL={pblue:"紺青（ベルリンブルー／ターンブルブルー）",fe2k4:"Everitt 塩",pbcro4:"クロムイエロー",caoh:"石灰水",cl2x:"塩素水",br2:"臭素水",so2:"亜硫酸水",baso4:"X線造影剤",baso4s:"X線造影剤"};
for(const k in F){F[k].nm=NM[k]||"";F[k].al=AL[k]||null}
F.istarch.f="I2";
// path-dependent common names, keyed "from>reagent"
const PAL={
 "fe3>K4":"ベルリンブルー（プルシアンブルー）",
 "fe2k4>H2O2":"ベルリンブルー（プルシアンブルー）",
 "fe2>K3":"ターンブルブルー",
 "cuoh>NH3":"Schweizer 試薬",
 "ag2o>NH3":"Tollens 試薬（アンモニア性硝酸銀）",
 "agcl>light":"感光で析出した銀","agi>light":"感光で析出した銀",
 "aloh4>CO2":"Bayer 法で析出させる水酸化アルミニウム",
 "caoh>CO2":"石灰水の白濁",
 "caco3>CO2":"鍾乳洞の地下水に溶けた形",
 "cahco3>heat":"鍾乳石・石筍",
 "h2s>SO2":"コロイド状の硫黄"
};
const PNOTE={
 "fe2>K3":"　※かつてはベルリンブルーとは別物質と考えられていたが、現在は同一物質とされる",
 "fe3>K4":"　※ $Fe^{2+}$ と $K3[Fe(CN)6]$ から得られるターンブルブルーと同一物質"
};
function nameHTML(id,alias){const fm=F[id];const al=alias||fm.al;
  return (fm.nm?'<span class="ik-nm">'+esc(fm.nm)+'</span>':"")+(al?'<span class="ik-chip">'+esc(al)+'</span>':"")}
function fxBlock(id,alias){return '<div class="ik-fxwrap"><span class="ik-fx">'+f(F[id].f)+'</span>'+nameHTML(id,alias)+'</div>'}

// ---------- transitions: T[form][reagent] = [nextForm|null, observation, equation|null]
const A3=(to,eq,obs,keys=["HCl","HNO3","H2SO4"])=>Object.fromEntries(keys.map(k=>[k,[to,obs,eq]]));
const T={
 cu2:{NaOHs:["cuoh","青白色の沈殿が生じた","Cu^{2+} + 2OH^- → Cu(OH)2↓"],
      NaOHx:["cuoh","青白色の沈殿が生じた．$Cu(OH)2$ は両性ではないので過剰の $NaOH$ には溶けない","Cu^{2+} + 2OH^- → Cu(OH)2↓"],
      NH3s:["cuoh","青白色の沈殿が生じた","Cu^{2+} + 2NH3 + 2H2O → Cu(OH)2↓ + 2NH4^+"],
      NH3x:["cunh","いったん沈殿が生じたのち溶け、深青色の溶液になった","Cu^{2+} + 4NH3 → [Cu(NH3)4]^{2+}"],
      H2Sa:["cus","黒色の沈殿が生じた（$CuS$ は酸性でも沈殿する）","Cu^{2+} + H2S → CuS↓ + 2H^+"]},
 cuoh:{...A3("cu2","Cu(OH)2 + 2H^+ → Cu^{2+} + 2H2O","沈殿が溶けて青色の溶液になった"),
      NaOHx:[null,"$Cu(OH)2$ は過剰の $NaOH$ に溶けない"],
      NH3x:["cunh","沈殿が溶けて深青色の溶液になった","Cu(OH)2 + 4NH3 → [Cu(NH3)4]^{2+} + 2OH^-"],
      H2Sa:["cus","黒色の沈殿に変わった","Cu(OH)2 + H2S → CuS↓ + 2H2O"],
      heat:["cuo","加熱すると黒色に変わった","Cu(OH)2 → CuO + H2O"]},
 cuo:{...A3("cu2","CuO + 2H^+ → Cu^{2+} + H2O","黒色の固体が溶けて青色の溶液になった"),
      H2Sa:["cus","酸に溶けた後、黒色の $CuS$ が沈殿した","CuO + H2S → CuS + H2O"]},
 cunh:{...A3("cu2","[Cu(NH3)4]^{2+} + 4H^+ → Cu^{2+} + 4NH4^+","深青色が薄れ、青色の溶液になった"),
      H2Sa:["cus","黒色の沈殿が生じた","[Cu(NH3)4]^{2+} + H2S + 2H^+ → CuS↓ + 4NH4^+"]},
 cus:{HNO3:["cu2","黒色の沈殿が溶けて青色の溶液になり、硫黄が遊離した（酸化力のある酸が必要）","3CuS + 8HNO3 → 3Cu(NO3)2 + 3S + 2NO + 4H2O"],
      HCl:[null,"$CuS$ は塩酸には溶けない"],H2SO4:[null,"$CuS$ は希硫酸には溶けない"]},

 ag1:{HCl:["agcl","白色の沈殿が生じた","Ag^+ + Cl^- → AgCl↓"],
      NaOHs:["ag2o","褐色の沈殿が生じた","2Ag^+ + 2OH^- → Ag2O↓ + H2O"],
      NH3s:["ag2o","褐色の沈殿が生じた","2Ag^+ + 2NH3 + H2O → Ag2O↓ + 2NH4^+"],
      NH3x:["agnh","いったん褐色の沈殿が生じたのち溶け、無色の溶液になった","Ag^+ + 2NH3 → [Ag(NH3)2]^+"],
      H2Sa:["ag2s","黒色の沈殿が生じた","2Ag^+ + H2S → Ag2S↓ + 2H^+"],
      KI:["agi","黄色の沈殿が生じた","Ag^+ + I^- → AgI↓"],
      K2CrO4:["ag2cro4","赤褐色の沈殿が生じた","2Ag^+ + CrO4^{2-} → Ag2CrO4↓"],
      S2O3:["agtsc","無色の錯イオンになった","Ag^+ + 2S2O3^{2-} → [Ag(S2O3)2]^{3-}"]},
 agcl:{NH3x:["agnh","沈殿が溶けて無色の溶液になった","AgCl + 2NH3 → [Ag(NH3)2]^+ + Cl^-"],
      NH3s:[null,"少量では溶けきらない"],
      H2Sa:["ag2s","黒色に変わった（$Ag2S$ の方が溶けにくい）","2AgCl + H2S → Ag2S + 2HCl"],
      KI:["agi","黄色に変わった（$AgI$ の方が溶けにくい）","AgCl + I^- → AgI + Cl^-"],
      K2CrO4:[null,"$AgCl$ の方が $Ag2CrO4$ より溶けにくいので変化しない"],
      S2O3:["agtsc","沈殿が溶けて無色の溶液になった","AgCl + 2S2O3^{2-} → [Ag(S2O3)2]^{3-} + Cl^-"],
      light:["ag","光で分解され、黒っぽくなった（感光性）","2AgCl → 2Ag + Cl2"]},
 ag2o:{HCl:["agcl","白色の沈殿に変わった","Ag2O + 2H^+ + 2Cl^- → 2AgCl + H2O"],
      HNO3:["ag1","沈殿が溶けて無色の溶液になった","Ag2O + 2H^+ → 2Ag^+ + H2O"],
      NH3x:["agnh","沈殿が溶けて無色の溶液になった","Ag2O + 4NH3 + H2O → 2[Ag(NH3)2]^+ + 2OH^-"],
      H2Sa:["ag2s","黒色の沈殿に変わった","Ag2O + H2S → Ag2S + H2O"],
      KI:["agi","黄色の沈殿に変わった","Ag2O + 2I^- + H2O → 2AgI + 2OH^-"],
      S2O3:["agtsc","沈殿が溶けて無色の溶液になった","Ag2O + 4S2O3^{2-} + H2O → 2[Ag(S2O3)2]^{3-} + 2OH^-"]},
 agnh:{HCl:["agcl","白色の沈殿が生じた","[Ag(NH3)2]^+ + 2H^+ + Cl^- → AgCl↓ + 2NH4^+"],
      HNO3:["ag1","無色のまま（錯イオンが壊れて $Ag^+$ に戻った）","[Ag(NH3)2]^+ + 2H^+ → Ag^+ + 2NH4^+"],
      H2Sa:["ag2s","黒色の沈殿が生じた","2[Ag(NH3)2]^+ + H2S + 2H^+ → Ag2S↓ + 4NH4^+"],
      KI:["agi","黄色の沈殿が生じた（$AgI$ は $NH3$ 水に溶けないほど溶けにくい）","[Ag(NH3)2]^+ + I^- → AgI↓ + 2NH3"],
      K2CrO4:[null,"錯イオンのままなので沈殿しない"]},
 ag2s:{HNO3:["ag1","黒色の沈殿が溶けて無色の溶液になり、硫黄が遊離した","3Ag2S + 8HNO3 → 6AgNO3 + 3S + 2NO + 4H2O"],
      HCl:[null,"$Ag2S$ は塩酸に溶けない"],NH3x:[null,"$Ag2S$ はアンモニア水に溶けない"],S2O3:[null,"$Ag2S$ はほとんど溶けない"]},
 agi:{S2O3:["agtsc","沈殿が溶けて無色の溶液になった","AgI + 2S2O3^{2-} → [Ag(S2O3)2]^{3-} + I^-"],
      NH3x:[null,"$AgI$ はアンモニア水にほとんど溶けない"],
      H2Sa:["ag2s","黒色に変わった（$Ag2S$ の方がさらに溶けにくい）","2AgI + H2S → Ag2S + 2HI"],
      light:["ag","光で分解され、黒っぽくなった","2AgI → 2Ag + I2"],
      HNO3:[null,"$AgI$ は硝酸に溶けない"]},
 ag2cro4:{HNO3:["ag1","沈殿が溶けた","2Ag2CrO4 + 2H^+ → 4Ag^+ + Cr2O7^{2-} + H2O"],
      NH3x:["agnh","沈殿が溶けた","Ag2CrO4 + 4NH3 → 2[Ag(NH3)2]^+ + CrO4^{2-}"],
      HCl:["agcl","白色の沈殿に変わった","Ag2CrO4 + 2Cl^- → 2AgCl + CrO4^{2-}"],
      KI:["agi","黄色の沈殿に変わった","Ag2CrO4 + 2I^- → 2AgI + CrO4^{2-}"],
      H2Sa:["ag2s","黒色の沈殿に変わった",null],
      S2O3:["agtsc","沈殿が溶けた","Ag2CrO4 + 4S2O3^{2-} → 2[Ag(S2O3)2]^{3-} + CrO4^{2-}"]},
 agtsc:{H2Sa:["ag2s","黒色の沈殿が生じた","2[Ag(S2O3)2]^{3-} + H2S → Ag2S↓ + 4S2O3^{2-} + 2H^+"],
      KI:[null,"錯イオンのままなので $AgI$ は沈殿しない"],
      HCl:[null,"$S2O3^{2-}$ が酸で分解して白濁した（銀の形は変わらないものとする）"],
      HNO3:[null,"$S2O3^{2-}$ が酸で分解して白濁した（銀の形は変わらないものとする）"]},
 ag:{HNO3:["ag1","銀が溶けて無色の溶液になった","3Ag + 4HNO3 → 3AgNO3 + NO + 2H2O"]},

 zn2:{NaOHs:["znoh","白色の沈殿が生じた","Zn^{2+} + 2OH^- → Zn(OH)2↓"],
      NaOHx:["znoh4","いったん白色の沈殿が生じたのち溶けた","Zn^{2+} + 4OH^- → [Zn(OH)4]^{2-}"],
      NH3s:["znoh","白色の沈殿が生じた","Zn^{2+} + 2NH3 + 2H2O → Zn(OH)2↓ + 2NH4^+"],
      NH3x:["znnh","いったん白色の沈殿が生じたのち溶けた","Zn^{2+} + 4NH3 → [Zn(NH3)4]^{2+}"],
      H2Sa:[null,"変化なし．酸性では $S^{2-}$ が少ないので $ZnS$ は沈殿しない"],
      H2Sb:["zns","白色の沈殿が生じた","Zn^{2+} + S^{2-} → ZnS↓"]},
 znoh:{...A3("zn2","Zn(OH)2 + 2H^+ → Zn^{2+} + 2H2O","沈殿が溶けた",["HCl","H2SO4"]),
      NaOHx:["znoh4","沈殿が溶けた（両性）","Zn(OH)2 + 2OH^- → [Zn(OH)4]^{2-}"],
      NH3x:["znnh","沈殿が溶けた（錯イオン形成）","Zn(OH)2 + 4NH3 → [Zn(NH3)4]^{2+} + 2OH^-"],
      H2Sa:["zn2","酸に溶けたが、酸性なので $ZnS$ は沈殿しない","Zn(OH)2 + 2H^+ → Zn^{2+} + 2H2O"],
      H2Sb:["zns","白色の $ZnS$ に変わった","Zn(OH)2 + H2S → ZnS↓ + 2H2O"]},
 znoh4:{...A3("zn2","[Zn(OH)4]^{2-} + 4H^+ → Zn^{2+} + 4H2O","いったん沈殿が生じたのち溶けた（酸を十分に加えた）",["HCl","H2SO4"]),
      H2Sa:["zn2","酸性になって $Zn^{2+}$ に戻ったが、$ZnS$ は沈殿しない","[Zn(OH)4]^{2-} + 4H^+ → Zn^{2+} + 4H2O"],
      H2Sb:["zns","白色の沈殿が生じた","[Zn(OH)4]^{2-} + H2S → ZnS↓ + 2OH^- + 2H2O"]},
 znnh:{...A3("zn2","[Zn(NH3)4]^{2+} + 4H^+ → Zn^{2+} + 4NH4^+","無色のまま（錯イオンが壊れた）",["HCl","H2SO4"]),
      H2Sa:["zn2","酸性になって $Zn^{2+}$ に戻ったが、$ZnS$ は沈殿しない","[Zn(NH3)4]^{2+} + 4H^+ → Zn^{2+} + 4NH4^+"],
      H2Sb:["zns","白色の沈殿が生じた","[Zn(NH3)4]^{2+} + H2S → ZnS↓ + 2NH4^+ + 2NH3"]},
 zns:{...A3("zn2","ZnS + 2H^+ → Zn^{2+} + H2S↑","沈殿が溶け、$H2S$ が発生した",["HCl","H2SO4"])},

 al3:{NaOHs:["aloh","白色ゲル状の沈殿が生じた","Al^{3+} + 3OH^- → Al(OH)3↓"],
      NaOHx:["aloh4","いったん沈殿が生じたのち溶けた（両性）","Al^{3+} + 4OH^- → [Al(OH)4]^-"],
      NH3s:["aloh","白色ゲル状の沈殿が生じた","Al^{3+} + 3NH3 + 3H2O → Al(OH)3↓ + 3NH4^+"],
      NH3x:["aloh","白色ゲル状の沈殿が生じた．$Al(OH)3$ は過剰のアンモニア水に溶けない","Al^{3+} + 3NH3 + 3H2O → Al(OH)3↓ + 3NH4^+"]},
 aloh:{HCl:["al3","沈殿が溶けた","Al(OH)3 + 3H^+ → Al^{3+} + 3H2O"],
      NaOHx:["aloh4","沈殿が溶けた（両性）","Al(OH)3 + OH^- → [Al(OH)4]^-"],
      NaOHs:[null,"少量では溶けきらない"],
      NH3x:[null,"$Al(OH)3$ はアンモニア水に溶けない（錯イオンをつくらない）"]},
 aloh4:{HCl:["al3","いったん沈殿が生じたのち溶けた（酸を十分に加えた）","[Al(OH)4]^- + 4H^+ → Al^{3+} + 4H2O"],
      CO2:["aloh","白色ゲル状の沈殿が生じた（弱酸で中和）","[Al(OH)4]^- + CO2 → Al(OH)3↓ + HCO3^-"]},

 fe2:{HNO3:["fe3","黄褐色の溶液になった（酸化）","3Fe^{2+} + NO3^- + 4H^+ → 3Fe^{3+} + NO + 2H2O"],
      NaOHs:["feoh2","緑白色の沈殿が生じた","Fe^{2+} + 2OH^- → Fe(OH)2↓"],
      NH3x:["feoh2","緑白色の沈殿が生じた","Fe^{2+} + 2NH3 + 2H2O → Fe(OH)2↓ + 2NH4^+"],
      H2Sa:[null,"変化なし．酸性では $FeS$ は沈殿しない"],
      H2Sb:["fes","黒色の沈殿が生じた","Fe^{2+} + S^{2-} → FeS↓"],
      H2O2:["fe3","黄褐色の溶液になった（酸化）","2Fe^{2+} + H2O2 + 2H^+ → 2Fe^{3+} + 2H2O"],
      KSCN:[null,"$Fe^{2+}$ では血赤色にならない"],
      K4:["fe2k4","青白色の沈殿が生じた",null],
      K3:["pblue","濃青色の沈殿が生じた","K^+ + Fe^{2+} + [Fe(CN)6]^{3-} → KFe[Fe(CN)6]↓"]},
 fe3:{NaOHs:["feoh3","赤褐色の沈殿が生じた","Fe^{3+} + 3OH^- → Fe(OH)3↓"],
      NH3x:["feoh3","赤褐色の沈殿が生じた","Fe^{3+} + 3NH3 + 3H2O → Fe(OH)3↓ + 3NH4^+"],
      H2Sa:["fe2","淡緑色になり、白濁した（$H2S$ が還元剤として働き $S$ が析出）","2Fe^{3+} + H2S → 2Fe^{2+} + S↓ + 2H^+"],
      H2Sb:["fes","黒色の沈殿が生じた","2Fe^{3+} + 3S^{2-} → 2FeS↓ + S↓"],
      KSCN:["fescn","血赤色の溶液になった","Fe^{3+} + SCN^- → [Fe(SCN)]^{2+}"],
      K4:["pblue","濃青色の沈殿が生じた","K^+ + Fe^{3+} + [Fe(CN)6]^{4-} → KFe[Fe(CN)6]↓"],
      K3:[null,"褐色の溶液になるが、沈殿はしない"],
      KI:["fe2","$I2$ が遊離して褐色になった（$Fe^{3+}$ が酸化剤）","2Fe^{3+} + 2I^- → 2Fe^{2+} + I2"]},
 feoh2:{HCl:["fe2","沈殿が溶けて淡緑色の溶液になった","Fe(OH)2 + 2H^+ → Fe^{2+} + 2H2O"],
      HNO3:["fe3","沈殿が溶け、酸化されて黄褐色の溶液になった",null],
      H2O2:["feoh3","赤褐色の沈殿に変わった（酸化）","2Fe(OH)2 + H2O2 → 2Fe(OH)3"],
      H2Sa:["fe2","酸に溶けて淡緑色の溶液になった",null],
      H2Sb:["fes","黒色の沈殿に変わった","Fe(OH)2 + H2S → FeS↓ + 2H2O"]},
 feoh3:{HCl:["fe3","沈殿が溶けて黄褐色の溶液になった","Fe(OH)3 + 3H^+ → Fe^{3+} + 3H2O"],
      HNO3:["fe3","沈殿が溶けて黄褐色の溶液になった","Fe(OH)3 + 3H^+ → Fe^{3+} + 3H2O"],
      H2Sa:["fe2","酸に溶けた $Fe^{3+}$ が $H2S$ に還元され、淡緑色になった（$S$ が析出）",null],
      H2Sb:["fes","黒色の沈殿に変わった",null]},
 fes:{HCl:["fe2","沈殿が溶け、$H2S$ が発生した","FeS + 2H^+ → Fe^{2+} + H2S↑"],
      HNO3:["fe3","沈殿が溶け、黄褐色の溶液になった",null]},
 fescn:{NaOHs:["feoh3","赤褐色の沈殿が生じた","[Fe(SCN)]^{2+} + 3OH^- → Fe(OH)3↓ + SCN^-"],
      NH3x:["feoh3","赤褐色の沈殿が生じた",null],
      H2Sa:["fe2","血赤色が消え、淡緑色になった（$S$ が析出）",null],
      KI:["fe2","血赤色が消え、$I2$ の褐色になった",null],
      H2Sb:["fes","黒色の沈殿が生じた",null]},
 fe2k4:{H2O2:["pblue","酸化されて濃青色の沈殿に変わった",null]},

 pb2:{HCl:["pbcl2","白色の沈殿が生じた","Pb^{2+} + 2Cl^- → PbCl2↓"],
      H2SO4:["pbso4","白色の沈殿が生じた","Pb^{2+} + SO4^{2-} → PbSO4↓"],
      NaOHs:["pboh","白色の沈殿が生じた","Pb^{2+} + 2OH^- → Pb(OH)2↓"],
      NaOHx:["pboh4","いったん白色の沈殿が生じたのち溶けた（両性）","Pb^{2+} + 4OH^- → [Pb(OH)4]^{2-}"],
      NH3x:["pboh","白色の沈殿が生じた．過剰のアンモニア水には溶けない","Pb^{2+} + 2NH3 + 2H2O → Pb(OH)2↓ + 2NH4^+"],
      H2Sa:["pbs","黒色の沈殿が生じた","Pb^{2+} + H2S → PbS↓ + 2H^+"],
      K2CrO4:["pbcro4","黄色の沈殿が生じた","Pb^{2+} + CrO4^{2-} → PbCrO4↓"],
      KI:["pbi2","黄色の沈殿が生じた","Pb^{2+} + 2I^- → PbI2↓"]},
 pbcl2:{heat:["pb2","熱水に溶けた（冷やすと再び沈殿する）","PbCl2 → Pb^{2+} + 2Cl^-"],
      H2SO4:["pbso4","より溶けにくい $PbSO4$ に変わった","PbCl2 + SO4^{2-} → PbSO4 + 2Cl^-"],
      K2CrO4:["pbcro4","黄色の沈殿に変わった","PbCl2 + CrO4^{2-} → PbCrO4 + 2Cl^-"],
      H2Sa:["pbs","黒色の沈殿に変わった","PbCl2 + H2S → PbS + 2HCl"],
      KI:["pbi2","黄色の沈殿に変わった","PbCl2 + 2I^- → PbI2 + 2Cl^-"],
      NaOHs:["pboh","白色の $Pb(OH)2$ に変わった","PbCl2 + 2OH^- → Pb(OH)2 + 2Cl^-"],
      NaOHx:["pboh4","沈殿が溶けた","PbCl2 + 4OH^- → [Pb(OH)4]^{2-} + 2Cl^-"],
      NH3x:["pboh","白色の $Pb(OH)2$ に変わった",null]},
 pbso4:{NaOHx:["pboh4","沈殿が溶けた","PbSO4 + 4OH^- → [Pb(OH)4]^{2-} + SO4^{2-}"],
      H2Sa:["pbs","黒色の沈殿に変わった","PbSO4 + H2S → PbS + H2SO4"],
      heat:[null,"$PbCl2$ と違い、$PbSO4$ は熱水にも溶けない"],
      HNO3:[null,"$PbSO4$ は希硝酸にほとんど溶けない"],HCl:[null,"$PbSO4$ は塩酸にほとんど溶けない"]},
 pbcro4:{NaOHx:["pboh4","沈殿が溶けた","PbCrO4 + 4OH^- → [Pb(OH)4]^{2-} + CrO4^{2-}"],
      HNO3:["pb2","沈殿が溶けた","2PbCrO4 + 2H^+ → 2Pb^{2+} + Cr2O7^{2-} + H2O"],
      H2Sa:["pbs","黒色の沈殿に変わった",null]},
 pbs:{HNO3:["pb2","黒色の沈殿が溶け、硫黄が遊離した","3PbS + 8HNO3 → 3Pb(NO3)2 + 3S + 2NO + 4H2O"],
      HCl:[null,"$PbS$ は塩酸に溶けない"]},
 pboh:{HNO3:["pb2","沈殿が溶けた","Pb(OH)2 + 2H^+ → Pb^{2+} + 2H2O"],
      HCl:["pbcl2","溶けずに白色の $PbCl2$ に変わった","Pb(OH)2 + 2HCl → PbCl2↓ + 2H2O"],
      H2SO4:["pbso4","溶けずに白色の $PbSO4$ に変わった","Pb(OH)2 + H2SO4 → PbSO4↓ + 2H2O"],
      NaOHx:["pboh4","沈殿が溶けた（両性）","Pb(OH)2 + 2OH^- → [Pb(OH)4]^{2-}"],
      NH3x:[null,"$Pb(OH)2$ はアンモニア水に溶けない"],
      H2Sa:["pbs","黒色の沈殿に変わった","Pb(OH)2 + H2S → PbS + 2H2O"],
      K2CrO4:["pbcro4","黄色の沈殿に変わった",null],
      KI:["pbi2","黄色の沈殿に変わった",null]},
 pboh4:{HNO3:["pb2","いったん沈殿が生じたのち溶けた","[Pb(OH)4]^{2-} + 4H^+ → Pb^{2+} + 4H2O"],
      HCl:["pbcl2","白色の沈殿が生じた",null],
      H2SO4:["pbso4","白色の沈殿が生じた",null],
      H2Sa:["pbs","黒色の沈殿が生じた",null]},
 pbi2:{heat:["pb2","熱水に溶けた（冷やすと黄金色の結晶が析出する）",null],
      NaOHx:["pboh4","沈殿が溶けた",null],
      H2Sa:["pbs","黒色の沈殿に変わった",null]},

 ni2:{NaOHs:["nioh","緑色の沈殿が生じた","Ni^{2+} + 2OH^- → Ni(OH)2↓"],
      NaOHx:["nioh","緑色の沈殿が生じた．過剰の $NaOH$ には溶けない","Ni^{2+} + 2OH^- → Ni(OH)2↓"],
      NH3s:["nioh","緑色の沈殿が生じた","Ni^{2+} + 2NH3 + 2H2O → Ni(OH)2↓ + 2NH4^+"],
      NH3x:["ninh","いったん沈殿が生じたのち溶け、青紫色の溶液になった","Ni^{2+} + 6NH3 → [Ni(NH3)6]^{2+}"],
      H2Sa:[null,"変化なし．酸性では $NiS$ は沈殿しない"],
      H2Sb:["nis","黒色の沈殿が生じた","Ni^{2+} + S^{2-} → NiS↓"]},
 nioh:{...A3("ni2","Ni(OH)2 + 2H^+ → Ni^{2+} + 2H2O","沈殿が溶けて緑色の溶液になった",["HCl","HNO3"]),
      NaOHx:[null,"$Ni(OH)2$ は両性ではないので溶けない"],
      NH3x:["ninh","沈殿が溶けて青紫色の溶液になった","Ni(OH)2 + 6NH3 → [Ni(NH3)6]^{2+} + 2OH^-"],
      H2Sa:["ni2","酸に溶けたが、酸性なので $NiS$ は沈殿しない","Ni(OH)2 + 2H^+ → Ni^{2+} + 2H2O"],
      H2Sb:["nis","黒色の沈殿に変わった","Ni(OH)2 + H2S → NiS↓ + 2H2O"]},
 ninh:{...A3("ni2","[Ni(NH3)6]^{2+} + 6H^+ → Ni^{2+} + 6NH4^+","青紫色が消え、緑色の溶液になった",["HCl","HNO3"]),
      H2Sa:["ni2","酸性になって $Ni^{2+}$ に戻ったが、$NiS$ は沈殿しない","[Ni(NH3)6]^{2+} + 6H^+ → Ni^{2+} + 6NH4^+"],
      H2Sb:["nis","黒色の沈殿が生じた","[Ni(NH3)6]^{2+} + H2S → NiS↓ + 2NH4^+ + 4NH3"]},
 nis:{HNO3:["ni2","黒色の沈殿が溶けて緑色の溶液になり、硫黄が遊離した","3NiS + 8HNO3 → 3Ni(NO3)2 + 3S + 2NO + 4H2O"],
      HCl:[null,"いったん生じた $NiS$ は塩酸に溶けにくい"]},

 cr2o7:{NaOHs:["cro4","黄色の溶液になった","Cr2O7^{2-} + 2OH^- → 2CrO4^{2-} + H2O"],
      NaOHx:["cro4","黄色の溶液になった","Cr2O7^{2-} + 2OH^- → 2CrO4^{2-} + H2O"],
      NH3x:["cro4","塩基性になり、黄色の溶液になった",null],
      H2Sa:["cr3","暗緑色の溶液になり、白濁した（$Cr2O7^{2-}$ が酸化剤として働く）","Cr2O7^{2-} + 3H2S + 8H^+ → 2Cr^{3+} + 3S + 7H2O"],
      H2SO4:[null,"すでに酸性側の形なので変化しない"]},
 cro4:{H2SO4:["cr2o7","橙赤色の溶液になった","2CrO4^{2-} + 2H^+ → Cr2O7^{2-} + H2O"],
      H2Sa:["cr3","酸性にすると $Cr2O7^{2-}$ になり、さらに還元されて暗緑色になった",null]},
 cr3:{NaOHs:["croh3","灰緑色の沈殿が生じた","Cr^{3+} + 3OH^- → Cr(OH)3↓"],
      NaOHx:["croh4","いったん沈殿が生じたのち溶け、緑色の溶液になった（両性）","Cr^{3+} + 4OH^- → [Cr(OH)4]^-"],
      NH3x:["croh3","灰緑色の沈殿が生じた","Cr^{3+} + 3NH3 + 3H2O → Cr(OH)3↓ + 3NH4^+"],
      H2O2:[null,"酸性では $Cr^{3+}$ は $H2O2$ で酸化されない"]},
 croh3:{H2SO4:["cr3","沈殿が溶けた","Cr(OH)3 + 3H^+ → Cr^{3+} + 3H2O"],
      NaOHx:["croh4","沈殿が溶けた（両性）","Cr(OH)3 + OH^- → [Cr(OH)4]^-"],
      H2Sa:["cr3","酸に溶けた","Cr(OH)3 + 3H^+ → Cr^{3+} + 3H2O"]},
 croh4:{H2SO4:["cr3","暗緑色の溶液になった","[Cr(OH)4]^- + 4H^+ → Cr^{3+} + 4H2O"],
      H2O2:["cro4","黄色の溶液になった（塩基性で酸化）","2[Cr(OH)4]^- + 3H2O2 + 2OH^- → 2CrO4^{2-} + 8H2O"],
      H2Sa:["cr3","酸性になり、暗緑色の溶液になった",null]},

 mno4:{H2O2:["mn2","赤紫色が消え、気体（$O2$）が発生した","2MnO4^- + 5H2O2 + 6H^+ → 2Mn^{2+} + 5O2 + 8H2O"],
      H2C2O4:["mn2","赤紫色が消えた（$CO2$ 発生）","2MnO4^- + 5(COOH)2 + 6H^+ → 2Mn^{2+} + 10CO2 + 8H2O"],
      H2Sa:["mn2","赤紫色が消え、白濁した","2MnO4^- + 5H2S + 6H^+ → 2Mn^{2+} + 5S + 8H2O"],
      H2Sb:["mno2","黒褐色の沈殿が生じた（中性〜塩基性では $MnO2$ まで還元される）",null],
      cHCl:["mn2","赤紫色が消え、黄緑色の気体（$Cl2$）が発生した","2MnO4^- + 16H^+ + 10Cl^- → 2Mn^{2+} + 5Cl2 + 8H2O"],
      H2SO4:[null,"酸性にしただけでは変化しない"]},
 mn2:{NaOHs:["mnoh2","白色（淡桃色）の沈殿が生じた（空気中で次第に褐色になる）","Mn^{2+} + 2OH^- → Mn(OH)2↓"],
      H2Sa:[null,"変化なし．酸性では $MnS$ は沈殿しない"],
      H2Sb:["mns","淡桃色の沈殿が生じた","Mn^{2+} + S^{2-} → MnS↓"]},
 mnoh2:{H2SO4:["mn2","沈殿が溶けた","Mn(OH)2 + 2H^+ → Mn^{2+} + 2H2O"],
      cHCl:["mn2","沈殿が溶けた","Mn(OH)2 + 2H^+ → Mn^{2+} + 2H2O"],
      H2C2O4:["mn2","酸に溶けた",null],
      H2Sa:["mn2","酸に溶けたが、$MnS$ は沈殿しない",null],
      H2Sb:["mns","淡桃色の沈殿に変わった","Mn(OH)2 + H2S → MnS↓ + 2H2O"],
      H2O2:["mno2","酸化されて黒褐色になった",null]},
 mns:{H2SO4:["mn2","沈殿が溶け、$H2S$ が発生した","MnS + 2H^+ → Mn^{2+} + H2S↑"],
      cHCl:["mn2","沈殿が溶け、$H2S$ が発生した","MnS + 2H^+ → Mn^{2+} + H2S↑"],
      H2Sa:["mn2","酸に溶けた（$MnS$ は酸性では存在できない）","MnS + 2H^+ → Mn^{2+} + H2S↑"]},
 mno2:{cHCl:["mn2","黄緑色の気体（$Cl2$）が発生し、固体が溶けた","MnO2 + 4HCl → MnCl2 + Cl2 + 2H2O"],
      H2O2:[null,"$MnO2$ は触媒として働き、$O2$ が発生するだけで変化しない"],
      H2Sa:["mn2","固体が溶け、白濁した","MnO2 + H2S + 2H^+ → Mn^{2+} + S + 2H2O"],
      H2C2O4:["mn2","固体が溶け、$CO2$ が発生した","MnO2 + (COOH)2 + 2H^+ → Mn^{2+} + 2CO2 + 2H2O"],
      H2SO4:[null,"希硫酸だけでは溶けない"]},

 caoh:{CO2:["caco3","白濁した","Ca(OH)2 + CO2 → CaCO3↓ + H2O"],
      HCl:["ca2","中和された","Ca(OH)2 + 2HCl → CaCl2 + 2H2O"],
      H2SO4:["caso4","白色の沈殿が生じた","Ca(OH)2 + H2SO4 → CaSO4↓ + 2H2O"],
      Na2CO3:["caco3","白色の沈殿が生じた","Ca^{2+} + CO3^{2-} → CaCO3↓"]},
 ca2:{H2SO4:["caso4","白色の沈殿が生じた","Ca^{2+} + SO4^{2-} → CaSO4↓"],
      Na2CO3:["caco3","白色の沈殿が生じた","Ca^{2+} + CO3^{2-} → CaCO3↓"],
      CO2:[null,"変化なし．中性〜酸性では $CaCO3$ は沈殿しない"]},
 caco3:{HCl:["ca2","泡を出して溶けた","CaCO3 + 2HCl → CaCl2 + H2O + CO2↑"],
      H2SO4:["caso4","表面が $CaSO4$ で覆われ、反応はすぐ止まった","CaCO3 + H2SO4 → CaSO4 + H2O + CO2↑"],
      CO2:["cahco3","白濁が消え、無色透明になった","CaCO3 + CO2 + H2O → Ca(HCO3)2"],
      heat:[null,"水中で加熱しても $CaCO3$ は変化しない"]},
 cahco3:{heat:["caco3","再び白濁した（鍾乳石ができる反応）","Ca(HCO3)2 → CaCO3↓ + CO2↑ + H2O"],
      HCl:["ca2","泡を出した","Ca(HCO3)2 + 2HCl → CaCl2 + 2H2O + 2CO2↑"],
      H2SO4:["caso4","白色の沈殿が生じた",null],
      Na2CO3:["caco3","白色の沈殿が生じた","Ca^{2+} + CO3^{2-} → CaCO3↓"]},
 caso4:{HCl:[null,"$CaSO4$ は塩酸にほとんど溶けない"]},

 ba2:{H2SO4:["baso4","白色の沈殿が生じた","Ba^{2+} + SO4^{2-} → BaSO4↓"],
      Na2CO3:["baco3","白色の沈殿が生じた","Ba^{2+} + CO3^{2-} → BaCO3↓"],
      K2CrO4:["bacro4","黄色の沈殿が生じた","Ba^{2+} + CrO4^{2-} → BaCrO4↓"],
      CO2:[null,"変化なし．中性〜酸性では $BaCO3$ は沈殿しない"]},
 baco3:{HCl:["ba2","泡を出して溶けた","BaCO3 + 2HCl → BaCl2 + H2O + CO2↑"],
      H2SO4:["baso4","泡を出して $BaSO4$ に変わった","BaCO3 + H2SO4 → BaSO4 + H2O + CO2↑"]},
 bacro4:{HCl:["ba2","沈殿が溶けて橙色の溶液になった","2BaCrO4 + 2H^+ → 2Ba^{2+} + Cr2O7^{2-} + H2O"],
      H2SO4:["baso4","白色の $BaSO4$ に変わった",null]},
 baso4:{HCl:[null,"$BaSO4$ は酸にも溶けない（X線造影剤に使われる理由）"]},

 cl1:{AgNO3:["agclx","白色の沈殿が生じた","Ag^+ + Cl^- → AgCl↓"],
      MnO2a:["cl2x","黄緑色の気体（$Cl2$）が発生した","MnO2 + 2Cl^- + 4H^+ → Mn^{2+} + Cl2 + 2H2O"],
      Br2:[null,"$Br2$ は $Cl2$ より酸化力が弱いので変化しない"],I2:[null,"$I2$ は $Cl2$ より酸化力が弱いので変化しない"]},
 cl2x:{KI:["cl1","褐色になった（$I2$ が遊離）．$Cl$ は $Cl^-$ になった","Cl2 + 2I^- → 2Cl^- + I2"],
      KBr:["cl1","赤褐色になった（$Br2$ が遊離）．$Cl$ は $Cl^-$ になった","Cl2 + 2Br^- → 2Cl^- + Br2"],
      SO2:["cl1","黄緑色が消えた（$SO2$ が還元剤）","Cl2 + SO2 + 2H2O → 2HCl + H2SO4"],
      H2O2:["cl1","黄緑色が消え、$O2$ が発生した","Cl2 + H2O2 → 2HCl + O2"],
      S2O3:["cl1","黄緑色が消えた（脱塩素剤）",null],
      light:["cl1","光で分解し、黄緑色が消えた","2Cl2 + 2H2O → 4HCl + O2"]},
 agclx:{NH3x:["cl1","沈殿が溶けた．$Cl$ は $Cl^-$ として溶液中へ","AgCl + 2NH3 → [Ag(NH3)2]^+ + Cl^-"],
      S2O3:["cl1","沈殿が溶けた","AgCl + 2S2O3^{2-} → [Ag(S2O3)2]^{3-} + Cl^-"],
      KI:["cl1","黄色の $AgI$ に変わった．$Cl$ は $Cl^-$ として溶液中へ","AgCl + I^- → AgI + Cl^-"],
      KBr:["cl1","淡黄色の $AgBr$ に変わった．$Cl$ は $Cl^-$ として溶液中へ","AgCl + Br^- → AgBr + Cl^-"],
      light:["cl2x","光で分解し、黒っぽくなった","2AgCl → 2Ag + Cl2"]},
 br1:{AgNO3:["agbrx","淡黄色の沈殿が生じた","Ag^+ + Br^- → AgBr↓"],
      Cl2:["br2","赤褐色になった","2Br^- + Cl2 → Br2 + 2Cl^-"],
      MnO2a:["br2","赤褐色の $Br2$ が生じた","MnO2 + 2Br^- + 4H^+ → Mn^{2+} + Br2 + 2H2O"],
      I2:[null,"$I2$ は $Br2$ より酸化力が弱いので変化しない"]},
 br2:{KI:["br1","褐色になった（$I2$ が遊離）．$Br$ は $Br^-$ になった","Br2 + 2I^- → 2Br^- + I2"],
      SO2:["br1","赤褐色が消えた","Br2 + SO2 + 2H2O → 2HBr + H2SO4"],
      S2O3:["br1","赤褐色が消えた",null],
      Cl2:[null,"変化しない"]},
 agbrx:{S2O3:["br1","沈殿が溶けた（写真の定着）","AgBr + 2S2O3^{2-} → [Ag(S2O3)2]^{3-} + Br^-"],
      KI:["br1","黄色の $AgI$ に変わった．$Br$ は $Br^-$ として溶液中へ","AgBr + I^- → AgI + Br^-"],
      NH3x:[null,"$AgBr$ はアンモニア水にわずかしか溶けない"],
      light:["br2","光で分解し、黒っぽくなった（写真の感光）","2AgBr → 2Ag + Br2"]},
 i1:{AgNO3:["agix","黄色の沈殿が生じた","Ag^+ + I^- → AgI↓"],
      Cl2:["i2","褐色になった","2I^- + Cl2 → I2 + 2Cl^-"],
      Br2:["i2","褐色になった","2I^- + Br2 → I2 + 2Br^-"],
      H2O2:["i2","褐色になった（硫酸酸性）","2I^- + H2O2 + 2H^+ → I2 + 2H2O"],
      MnO2a:["i2","褐色の $I2$ が生じた","MnO2 + 2I^- + 4H^+ → Mn^{2+} + I2 + 2H2O"],
      starch:[null,"$I^-$ ではデンプンは呈色しない"]},
 i2:{SO2:["i1","褐色が消えた","I2 + SO2 + 2H2O → 2HI + H2SO4"],
      S2O3:["i1","褐色が消えた（ヨウ素滴定の反応）","I2 + 2S2O3^{2-} → 2I^- + S4O6^{2-}"],
      starch:["istarch","青紫色になった（ヨウ素デンプン反応）",null],
      KI:[null,"$I3^-$ となって溶けやすくなるだけで、色は褐色のまま"]},
 istarch:{SO2:["i1","青紫色が消えた","I2 + SO2 + 2H2O → 2HI + H2SO4"],
      S2O3:["i1","青紫色が消えた（滴定の終点）","I2 + 2S2O3^{2-} → 2I^- + S4O6^{2-}"]},
 agix:{S2O3:["i1","沈殿が溶けた","AgI + 2S2O3^{2-} → [Ag(S2O3)2]^{3-} + I^-"],
      NH3x:[null,"$AgI$ はアンモニア水に溶けない"],
      light:["i2","光で分解し、黒っぽくなった","2AgI → 2Ag + I2"]},

 h2s:{SO2:["s0","白濁した（$H2S$ が還元剤、$SO2$ が酸化剤）","2H2S + SO2 → 3S + 2H2O"],
      H2O2:["s0","白濁した","H2S + H2O2 → S + 2H2O"],
      I2:["s0","褐色が消えて白濁した","H2S + I2 → S + 2HI"],
      Cl2:["s0","白濁した","H2S + Cl2 → S + 2HCl"],
      KMnO4:["s0","赤紫色が消えて白濁した","5H2S + 2MnO4^- + 6H^+ → 5S + 2Mn^{2+} + 8H2O"],
      HNO3:["s0","酸化されて白濁した",null],
      CuSO4:["cuss","黒色の沈殿が生じた（$H2S$ の検出）","Cu^{2+} + H2S → CuS↓ + 2H^+"],
      BaCl2:[null,"変化しない"]},
 s0:{HNO3:["so4","濃硝酸と加熱すると硫黄が溶けた","S + 6HNO3 → H2SO4 + 6NO2 + 2H2O"]},
 so2:{H2Sa:["s0","白濁した（ここでは $SO2$ が酸化剤）","SO2 + 2H2S → 3S + 2H2O"],
      H2O2:["so4","変化は見えないが、硫酸になった","SO2 + H2O2 → H2SO4"],
      I2:["so4","褐色が消えた（$SO2$ が還元剤）","SO2 + I2 + 2H2O → H2SO4 + 2HI"],
      Cl2:["so4","黄緑色が消えた","SO2 + Cl2 + 2H2O → H2SO4 + 2HCl"],
      KMnO4:["so4","赤紫色が消えた","5SO2 + 2MnO4^- + 2H2O → 5SO4^{2-} + 2Mn^{2+} + 4H^+"],
      HNO3:["so4","酸化されて硫酸になった",null],
      BaCl2:[null,"変化なし．酸性では $BaSO3$ は沈殿しない"]},
 so4:{BaCl2:["baso4s","白色の沈殿が生じた（$SO4^{2-}$ の検出）","Ba^{2+} + SO4^{2-} → BaSO4↓"]},
 cuss:{HNO3:["s0","黒色の沈殿が溶け、硫黄が遊離した","3CuS + 8HNO3 → 3Cu(NO3)2 + 3S + 2NO + 4H2O"]}
};

// ---------- chapters
const CH=[
 {id:"Cu",z:"29",nm:"銅",shelf:["HCl","HNO3","H2SO4","NaOHs","NaOHx","NH3s","NH3x","H2Sa","heat"],forms:["cu2","cuoh","cuo","cunh","cus"]},
 {id:"Ag",z:"47",nm:"銀",shelf:["HCl","HNO3","NaOHs","NH3s","NH3x","H2Sa","KI","K2CrO4","S2O3","light"],forms:["ag1","agcl","ag2o","agnh","ag2s","agi","ag2cro4","agtsc","ag"]},
 {id:"Zn",z:"30",nm:"亜鉛",shelf:["HCl","H2SO4","NaOHs","NaOHx","NH3s","NH3x","H2Sa","H2Sb"],forms:["zn2","znoh","znoh4","znnh","zns"]},
 {id:"Al",z:"13",nm:"アルミ",shelf:["HCl","NaOHs","NaOHx","NH3s","NH3x","CO2"],forms:["al3","aloh","aloh4"]},
 {id:"Fe",z:"26",nm:"鉄",shelf:["HCl","HNO3","NaOHs","NH3x","H2Sa","H2Sb","H2O2","KSCN","K4","K3","KI"],forms:["fe2","fe3","feoh2","feoh3","fes","fescn","pblue","fe2k4"]},
 {id:"Pb",z:"82",nm:"鉛",shelf:["HCl","HNO3","H2SO4","NaOHs","NaOHx","NH3x","H2Sa","K2CrO4","KI","heat"],forms:["pb2","pbcl2","pbso4","pbcro4","pbs","pboh","pboh4","pbi2"]},
 {id:"Ni",z:"28",nm:"ニッケル",shelf:["HCl","HNO3","NaOHs","NaOHx","NH3s","NH3x","H2Sa","H2Sb"],forms:["ni2","nioh","ninh","nis"]},
 {id:"Cr",z:"24",nm:"クロム",shelf:["H2SO4","NaOHs","NaOHx","NH3x","H2Sa","H2O2"],forms:["cr2o7","cro4","cr3","croh3","croh4"]},
 {id:"Mn",z:"25",nm:"マンガン",shelf:["H2SO4","cHCl","NaOHs","H2Sa","H2Sb","H2O2","H2C2O4"],forms:["mno4","mn2","mnoh2","mns","mno2"]},
 {id:"Ca",z:"20",nm:"カルシウム",shelf:["HCl","H2SO4","Na2CO3","CO2","heat"],forms:["caoh","ca2","caco3","cahco3","caso4"]},
 {id:"Ba",z:"56",nm:"バリウム",shelf:["HCl","H2SO4","Na2CO3","K2CrO4","CO2"],forms:["ba2","baso4","baco3","bacro4"]},
 {id:"X",z:"17族",nm:"ハロゲン",shelf:["Cl2","Br2","I2","KBr","KI","AgNO3","NH3x","S2O3","SO2","H2O2","MnO2a","starch","light"],forms:["cl1","cl2x","agclx","br1","br2","agbrx","i1","i2","istarch","agix"]},
 {id:"S",z:"16",nm:"硫黄",shelf:["SO2","H2Sa","H2O2","I2","Cl2","KMnO4","CuSO4","BaCl2","HNO3"],forms:["h2s","s0","so2","so4","baso4s","cuss"]}
];
// 1回目は「少量」の反応、生じた沈殿にもう一度加えると「過剰」の反応になるように統合する
(function(){
  for(const k in T){const t=T[k];
    for(const [base,sm,ex] of [["NaOH","NaOHs","NaOHx"],["NH3","NH3s","NH3x"]]){
      const a=t[sm],b=t[ex];let pick=null;
      if(a&&a[0])pick=a;else if(b)pick=b;else if(a)pick=a;
      delete t[sm];delete t[ex];if(pick)t[base]=pick}}
  CH.forEach(c=>{c.shelf=[...new Set(c.shelf.map(r=>r.replace(/^(NaOH|NH3)[sx]$/,"$1")))]});
  // 1回目と2回目で変化が分かれるものの観察文を調整
  T.pb2.NH3=["pboh","白色の沈殿が生じた","Pb^{2+} + 2NH3 + 2H2O → Pb(OH)2↓ + 2NH4^+"];
  T.cuoh.NH3[1]="さらに加えると沈殿が溶け、深青色の溶液になった";
  T.ag2o.NH3[1]="さらに加えると沈殿が溶け、無色の溶液になった";
  T.znoh.NaOH[1]="さらに加えると沈殿が溶けた（両性）";T.znoh.NH3[1]="さらに加えると沈殿が溶けた（錯イオン形成）";
  T.aloh.NaOH[1]="さらに加えると沈殿が溶けた（両性）";
  T.pboh.NaOH[1]="さらに加えると沈殿が溶けた（両性）";
  T.croh3.NaOH[1]="さらに加えると沈殿が溶け、緑色の溶液になった（両性）";
  T.nioh.NH3[1]="さらに加えると沈殿が溶け、青紫色の溶液になった";
  T.cuoh.NaOH=[null,"さらに加えても $Cu(OH)2$ は溶けない（両性ではない）"];
  T.nioh.NaOH=[null,"さらに加えても $Ni(OH)2$ は溶けない（両性ではない）"];
  T.aloh.NH3=[null,"さらに加えても $Al(OH)3$ は溶けない（アンモニアと錯イオンをつくらない）"];
  T.pboh.NH3=[null,"さらに加えても $Pb(OH)2$ は溶けない"];
  T.feoh2.NaOH=[null,"さらに加えても溶けない"];T.feoh3.NaOH=[null,"さらに加えても溶けない"];
  T.feoh2.NH3=[null,"さらに加えても溶けない"];T.feoh3.NH3=[null,"さらに加えても溶けない"];
  T.croh3.NH3=[null,"さらに加えても $Cr(OH)3$ はほとんど溶けない"];
  // 錯イオンに酸を加えると、まず水酸化物が沈殿し、さらに加えると溶ける
  const two=(k,acids,to,eq,obs)=>acids.forEach(a=>{T[k][a]=[to,obs,eq]});
  two("znoh4",["HCl","H2SO4"],"znoh","[Zn(OH)4]^{2-} + 2H^+ → Zn(OH)2↓ + 2H2O","白色の沈殿が生じた（中和）．さらに加えると溶ける");
  two("aloh4",["HCl"],"aloh","[Al(OH)4]^- + H^+ → Al(OH)3↓ + H2O","白色ゲル状の沈殿が生じた（中和）．さらに加えると溶ける");
  two("pboh4",["HNO3"],"pboh","[Pb(OH)4]^{2-} + 2H^+ → Pb(OH)2↓ + 2H2O","白色の沈殿が生じた（中和）．さらに加えると溶ける");
  two("croh4",["H2SO4"],"croh3","[Cr(OH)4]^- + H^+ → Cr(OH)3↓ + H2O","灰緑色の沈殿が生じた（中和）．さらに加えると溶ける");
  two("cunh",["HCl","HNO3","H2SO4"],"cuoh","[Cu(NH3)4]^{2+} + 2H^+ + 2H2O → Cu(OH)2↓ + 4NH4^+","深青色が消え、青白色の沈殿が生じた．さらに加えると溶ける");
  two("znnh",["HCl","H2SO4"],"znoh","[Zn(NH3)4]^{2+} + 2H^+ + 2H2O → Zn(OH)2↓ + 4NH4^+","白色の沈殿が生じた．さらに加えると溶ける");
  two("ninh",["HCl","HNO3"],"nioh","[Ni(NH3)6]^{2+} + 4H^+ + 2H2O → Ni(OH)2↓ + 6NH4^+","青紫色が消え、緑色の沈殿が生じた．さらに加えると溶ける");
})();
const DIFF=[{nm:"やさしい",lo:1,hi:2},{nm:"ふつう",lo:2,hi:3},{nm:"むずかしい",lo:3,hi:9}];

// ---------- graph search
function step(form,r){const t=(T[form]||{})[r];return t&&t[0]?t[0]:null}
function dists(from,shelf){const d={[from]:0},q=[from];
  while(q.length){const u=q.shift();for(const r of shelf){const v=step(u,r);if(v&&!(v in d)){d[v]=d[u]+1;q.push(v)}}}return d}
function path(from,to,shelf){if(from===to)return [];const prev={[from]:null},q=[from];
  while(q.length){const u=q.shift();for(const r of shelf){const v=step(u,r);if(v&&!(v in prev)){prev[v]=[u,r];if(v===to){const p=[];let x=v;while(prev[x]){p.unshift(prev[x]);x=prev[x][0]}return p}q.push(v)}}}
  return null}
function candidates(cis,lo,hi){const out=[];
  for(const ci of cis){const c=CH[ci];for(const s of c.forms){const d=dists(s,c.shelf);for(const t in d){if(d[t]>=lo&&d[t]<=hi)out.push({ci,s,t,d:d[t]})}}}return out}

// ---------- state
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let stats=store.get("ikl-stats",{solved:0,stars:0});
let S={scope:-1,diff:1,free:false,ci:0,start:"cu2",target:"cunh",par:1,hist:["cu2"],names:[null],log:[],won:false,gave:false};
const $=id=>document.getElementById(id);
const cur=()=>S.hist[S.hist.length-1];
const shelf=()=>CH[S.ci].shelf;
function starsFor(m,par){return m<=par?3:m<=par+2?2:1}

function newProblem(){
  const cis=S.scope<0?CH.map((_,i)=>i):[S.scope];const D=DIFF[S.diff];
  let c=candidates(cis,D.lo,D.hi);if(!c.length)c=candidates(cis,1,9);
  const fresh=c.filter(x=>!(x.s===S.start&&x.t===S.target));if(fresh.length)c=fresh;
  // pick a chapter first so large chapters don't dominate
  const chs=[...new Set(c.map(x=>x.ci))];const pick=chs[Math.floor(Math.random()*chs.length)];
  const pool=c.filter(x=>x.ci===pick);const p=pool[Math.floor(Math.random()*pool.length)];
  Object.assign(S,{free:false,ci:p.ci,start:p.s,target:p.t,par:p.d,hist:[p.s],names:[null],log:[],won:false,gave:false});
  $("flash").textContent="";render()}
function freeLab(start,ciArg){
  const ci=ciArg!=null?ciArg:(S.scope<0?S.ci:S.scope);start=start&&CH[ci].forms.includes(start)?start:CH[ci].forms[0];
  Object.assign(S,{free:true,ci,start,target:null,par:null,hist:[start],names:[null],log:[],won:false,gave:false});$("flash").textContent="";render()}

// ---------- beaker
const DOTS=(()=>{const a=[];let s=7;const rnd=()=>(s=(s*9301+49297)%233280)/233280;
  for(let i=0;i<46;i++)a.push([48+rnd()*104,186+rnd()*20,1.6+rnd()*2.6]);return a})();
function drawBeaker(id){
  const fm=F[id];const liq=$("liq"),ppt=$("ppt");
  if(fm.ph==="aq"){liq.setAttribute("fill",fm.col||"var(--water)");liq.setAttribute("fill-opacity",fm.col?".72":"1");ppt.style.opacity=0}
  else{liq.setAttribute("fill","var(--water)");liq.setAttribute("fill-opacity","1");
    ppt.innerHTML='<path d="M40 212 L40 194 Q70 182 100 186 Q130 182 160 194 L160 212 Z" fill="'+fm.col+'" stroke="var(--pptline)" stroke-width="1"/>'+
      DOTS.map(d=>'<circle cx="'+d[0].toFixed(1)+'" cy="'+(d[1]-8).toFixed(1)+'" r="'+d[2].toFixed(1)+'" fill="'+fm.col+'" stroke="var(--pptline)" stroke-width=".5"/>').join("");
    ppt.style.opacity=1}}
let animDelay=0,motionTimer=null;
const GAS=["CO2","SO2","H2Sa","H2Sb"];
// 酸・塩基など、ふつう液体としてそのまま注ぐもの
const POUR=["HCl","cHCl","HNO3","H2SO4","NaOH","NH3","H2O2","Cl2","Br2","I2","KMnO4","H2C2O4","MnO2a"];
const STREAM={Cl2:"#cfdc6e",Br2:"#b5501d",I2:"#8a4a14",KMnO4:"#7a1a6e",K2CrO4:"#f0c419",CuSO4:"#3f9ad6",K3:"#d8b23a",K4:"#e8d36a"};
const ALLCLS=["heating","lit","gassing","pouring","dropping"];
function motion(r){const b=$("beaker");clearTimeout(motionTimer);b.classList.remove(...ALLCLS);void b.getBBox();
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cls=r==="heat"?"heating":r==="light"?"lit":GAS.includes(r)?"gassing":POUR.includes(r)?"pouring":"dropping";
  b.style.setProperty("--stream",STREAM[r]||"rgba(120,170,200,.85)");
  b.classList.add(cls);
  const dur={heating:1800,lit:1800,gassing:1800,pouring:1800,dropping:1200}[cls];
  animDelay=reduce?0:(cls==="dropping"?500:800);
  motionTimer=setTimeout(()=>b.classList.remove(cls),reduce?400:dur)}

// ---------- render
function render(){
  const c=CH[S.ci],obs=$("obsMode").checked,id=cur(),fm=F[id],done=S.won||S.gave;
  $("sSolved").textContent=stats.solved;$("sStars").textContent=stats.stars;
  $("tiles").innerHTML='<button class="ik-tile ik-all" aria-pressed="'+(S.scope<0)+'" data-scope="-1"><span class="ik-sym">全</span><span class="ik-nm">全範囲</span></button>'+
    CH.map((h,i)=>'<button class="ik-tile" aria-pressed="'+(S.scope===i)+'" data-scope="'+i+'"><span class="ik-z">'+h.z+'</span><span class="ik-sym">'+h.id+'</span><span class="ik-nm">'+h.nm+'</span></button>').join("");
  $("diffs").innerHTML=DIFF.map((d,i)=>'<button class="ik-lv" aria-pressed="'+(!S.free&&S.diff===i)+'" data-diff="'+i+'">'+d.nm+'</button>').join("");
  $("freeBtn").setAttribute("aria-pressed",S.free);

  $("curFx").innerHTML=(obs&&!done)?'<span class="ik-fx" style="color:var(--muted)">？</span>':fxBlock(id,S.names[S.names.length-1]);
  $("curLook").textContent=fm.look;
  if(animDelay){const d=animDelay;animDelay=0;setTimeout(()=>drawBeaker(cur()),d)}else drawBeaker(id);
  const moves=S.hist.length-1;$("moves").textContent=moves;
  $("undo").disabled=moves===0;$("reset").disabled=moves===0;

  if(!S.free){const tf=F[S.target];
    $("goalEb").textContent="目標　"+c.nm+"（"+(c.id==="X"?"ハロゲン":c.id)+"）の問題";
    $("goal").innerHTML='<span class="ik-goal-sw" style="background:'+(tf.col||"var(--water)")+'"></span><div class="ik-goal-meta"><div class="ik-state-fx">'+fxBlock(S.target)+'</div><p class="ik-look">'+esc(tf.look)+'</p></div>';
    $("par").textContent=S.par;$("parBox").hidden=false;$("hint").hidden=false;$("giveup").hidden=false;
    $("hint").disabled=done;$("giveup").disabled=done;
    $("shelfNote").innerHTML='出発 <span class="ik-fx">'+f(F[S.start].f)+'</span>';
    if(S.won){const st=starsFor(moves,S.par);
      $("win").innerHTML='<div class="ik-win"><h3>達成</h3><p><span class="ik-stars">'+"★".repeat(st)+"☆".repeat(3-st)+'</span>　'+moves+'手（最少 '+S.par+'手）</p><button class="ik-btn ik-primary" data-next="1">次の問題へ</button></div>'}
    else if(S.gave){const p=path(S.start,S.target,c.shelf);
      $("win").innerHTML='<div class="ik-win ik-gave"><h3>解答例</h3><div class="ik-path"><span class="ik-fx">'+f(F[S.start].f)+'</span>'+
        p.map(([u,r])=>'<span class="ik-arr">→ '+rHTML(r)+(R[r].f?"<small>（"+esc(R[r].s)+"）</small>":"")+' →</span><span class="ik-fx">'+f(F[step(u,r)].f)+'</span><span class="ik-nm" style="font-size:12px">'+esc(F[step(u,r)].nm)+'</span>').join("")+
        '</div><p></p><button class="ik-btn ik-primary" data-next="1">次の問題へ</button></div>'}
    else $("win").innerHTML="";
  }else{
    $("goalEb").textContent="自由実験　"+c.nm;$("parBox").hidden=true;$("hint").hidden=true;$("giveup").hidden=true;$("win").innerHTML="";
    $("goal").innerHTML='<div class="ik-goal-meta"><label for="freeChap" class="ik-look">元素と出発物質を選ぶ</label><div class="ik-bar" style="margin-top:6px"><select id="freeChap" class="ik-free-sel">'+
      CH.map((h,i)=>'<option value="'+i+'"'+(i===S.ci?" selected":"")+'>'+esc(h.nm)+'</option>').join("")+'</select><select id="freeStart" class="ik-free-sel">'+
      c.forms.map(k=>'<option value="'+k+'"'+(k===S.start?" selected":"")+'>'+esc(fu(F[k].f)+"　"+F[k].nm+"（"+F[k].look+"）")+'</option>').join("")+'</select></div></div>';
    $("shelfNote").textContent="目標なし．好きに試そう";
  }
  $("shelf").innerHTML=ORDER.filter(r=>c.shelf.includes(r)).map(r=>{const x=R[r];
    return '<button class="ik-rg" data-r="'+r+'">'+(x.f?'<span class="ik-fx">'+f(x.f)+'</span>':'<span class="ik-heatsym">'+esc(x.t)+'</span>')+'<small>'+esc(x.s)+'</small></button>'}).join("");

  $("log").innerHTML=S.log.length?S.log.map((e,i)=>'<li class="'+(e.to?"":"ik-nochg")+'"><span class="ik-n">'+String(i+1).padStart(2,"0")+'</span><div><div class="ik-what">'+rFull(e.r)+'</div>'+
      ((e.eq&&!(obs&&!done))?'<div class="ik-eq">'+f(e.eq)+'</div>':"")+'<div class="ik-obs">'+rich(e.obs)+'</div>'+((e.to&&!(obs&&!done))?'<div class="ik-prod">'+fxBlock(e.to,e.al).replace('<div class="ik-fxwrap">','<div class="ik-fxwrap"><span class="ik-nm" style="color:var(--muted)">→</span>')+'</div>':"")+'</div></li>').join(""):
    '<p class="ik-empty">試薬を加えると、ここに観察結果と反応式が記録される．</p>';
}

function add(r){
  const id=cur();const t=(T[id]||{})[r];let rec;
  const key=id+">"+r,al=PAL[key]||null;
  if(t&&t[0]){S.hist.push(t[0]);S.names.push(al);rec={r,to:t[0],obs:t[1]+(PNOTE[key]||""),eq:t[2],al}}
  else{S.hist.push(id);S.names.push(S.names[S.names.length-1]);rec={r,to:null,obs:t?t[1]:(F[id].end?"これ以上の変化はこのゲームでは扱わない":"目立った変化は起こらない（このゲームで扱う範囲）"),eq:null}}
  S.log.push(rec);$("flash").innerHTML="";motion(r);
  if(!S.free&&!S.won&&!S.gave&&cur()===S.target){S.won=true;stats.solved++;stats.stars+=starsFor(S.hist.length-1,S.par);store.set("ikl-stats",stats)}
  render()}

document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.scope!=null){S.scope=+b.dataset.scope;S.free?freeLab():newProblem()}
  else if(b.dataset.diff!=null){S.diff=+b.dataset.diff;newProblem()}
  else if(b.dataset.r){add(b.dataset.r)}
  else if(b.dataset.next||b.id==="newBtn"){newProblem()}
  else if(b.id==="freeBtn"){S.free?newProblem():freeLab()}
  else if(b.id==="undo"){if(S.hist.length>1){S.hist.pop();S.names.pop();S.log.pop();$("flash").textContent="";render()}}
  else if(b.id==="reset"){S.hist=[S.start];S.names=[null];S.log=[];$("flash").textContent="";render()}
  else if(b.id==="hint"){if(S.free||S.won||S.gave)return;
    const p=path(cur(),S.target,shelf());
    $("flash").innerHTML=p?'次の一手の候補：'+rFull(p[0][1])+'　残り最少 '+p.length+'手':"この状態からは目標に戻れない．「1手戻す」を使おう"}
  else if(b.id==="giveup"){if(S.free||S.won)return;S.gave=true;$("flash").textContent="";render()}
});
document.addEventListener("change",e=>{
  if(e.target.id==="obsMode")render();
  if(e.target.id==="freeChap")freeLab(null,+e.target.value);
  if(e.target.id==="freeStart")freeLab(e.target.value,S.ci)});

newProblem();
})();
