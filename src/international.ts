import { cities } from './content';

/** User-supplied travel list plus documented study and competition experiences. */
export const internationalExperiences=[
 {id:'berkeley',name:'伯克利',kind:'学期交流',date:'2024.08 — 2024.12',description:'加州大学伯克利分校 · 文理学院，学习定价、AI 与媒体、语言学。',magnet:'berkeley',photo:'',photoLabel:'伯克利校园 / 交流生活照片待补充'},
 {id:'hong-kong',name:'香港',kind:'硕士学习',date:'2026.08 — 2027.06',description:'香港大学 · 商业人工智能。',magnet:'hong-kong',photo:'',photoLabel:'香港校园 / 学习生活照片待补充'},
 ...cities.map(city=>({id:city.id,name:city.name,kind:city.id==='singapore'?'国际比赛 · 旅行':'旅行',date:city.id==='singapore'?'2023.06':'',description:city.id==='singapore'?'新加坡管理大学 ESG 挑战赛 · 队长，与多国成员协作，在 30+ 国际小组中获得冠军。':`${city.country} · 旅行记忆`,magnet:city.id,photo:'',photoLabel:`${city.name}旅行照片待补充`}))
];
