'use strict';
(() => {
  const STORE = 'growth-compass-v1';
  const ENTRY = 'growth-compass-entry-v1';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateNumber = s => Date.parse(s + 'T00:00:00Z');
  const addDays = (s,n) => new Date(dateNumber(s)+n*86400000).toISOString().slice(0,10);
  const shortDate = s => s.slice(5).replace('-', '.');
  const money = n => n === '' || n === null ? '待填写' : '¥' + Number(n).toLocaleString('zh-CN', {maximumFractionDigits:0});
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const emptyInterview = title => ({title,headline:'',context:'',role:'',action:'',result:'',learning:''});
  const reviewTemplate = () => ({wins:'',obstacle:'',lesson:'',next:'',energy:'',updated:''});
  function defaults() {
    return {profile:{name:'',start:'2026-11-09',goal:'在 HR 工作中运用 AI，积累可验证的成果，探索内容创作。',balance:'',expense:'',city:'',hours:5},checks:{},interviews:[emptyInterview('一次有效交付'),emptyInterview('一次困难处理'),emptyInterview('一次流程改进')],ai:{title:'招聘进度同步 / 周报改进',problem:'',role:'',actions:'',result:'',boundary:'',link:''},evidence:[],contents:[],opportunities:[],reviews:{}};
  }
  let state = defaults(), page='overview', studio='interview', selectedWeek=1, initialized=false, entryKey='', confirmResolve;
  let storageOK=true;
  const phaseData = [
    {a:1,b:2,title:'先站稳，再出发',desc:'梳理真实经历，明确预算；选定一个 AI 项目，建立基线。',deliver:'3 个经历提纲 + 项目基线'},
    {a:3,b:6,title:'做出一个完整案例',desc:'持续记录效果，练习结构化表达；把实践变成内容。',deliver:'项目案例初稿 + 4 条内容'},
    {a:7,b:10,title:'用成果争取机会',desc:'完善作品，针对性投递；根据真实反馈调整求职方向。',deliver:'作品说明 + 求职反馈记录'},
    {a:11,b:12,title:'复盘，再选择',desc:'核对积蓄、机会与成长；确定下一阶段投入方向。',deliver:'12 周复盘 + 下一阶段计划'}
  ];
  const weekTitles=['盘点现状，收拢目标','提炼经历，建立基线','打通流程，开始实测','完成首轮案例','核对效果，补上判断','整理成可展示作品','带着案例定向求职','按面试反馈修订','把有效做法讲明白','比较机会，控制节奏','检查积蓄与成长','完成复盘，选择下一程'];
  const weeklyAI=['选一个反复发生的招聘问题，记录现有耗时和错误。','画出流程，明确你负责的部分；收集真实基线。','做最小可用版本，保留人工核对环节。','在可比任务中实测，记录耗时、错误和修正。','检查异常情况，补充使用边界和失败记录。','整理问题、行动、证据、结果，完成一页案例。','根据招聘方关心的问题调整案例展示。','补充一个真实失败及修复过程，完善说明。','请同事试用或反馈，记录实际意见。','核对效果能否重复，删除无法证实的表述。','整理作品与操作说明，补齐证据记录。','总结哪些能力能够迁移到下一份工作。'];
  const weeklyInterview=['写下二面原问题与自己的原回答，找出三处表达卡点。','准备交付、困难、改进三个真实案例，分别练习 90 秒表达。','用“主要困难—判断依据—优先行动”重讲一个案例。','模拟一次追问：你本人做了什么，结果如何核对？','补一个招聘专业问题，用实际工作解释判断。','录音复盘三段经历，删去过长背景和空泛评价。','针对目标 JD，挑出最相关的两段经历。','复盘面试追问，更新一条表达或判断。','向不了解项目的人讲清楚 AI 案例，检查是否听懂。','练习求职动机：岗位内容、成长期待和个人贡献。','检查履历时间与业绩数字是否真实、一致。','选出最有说服力的三个案例，保存最终版本。'];
  function tasks(w) { return [
    {id:'interview',title:'面试表达 · 先给结论，再讲证据',desc:weeklyInterview[w-1],time:50},
    {id:'ai',title:'AI 实践 · 把一个项目做完整',desc:weeklyAI[w-1],time:90},
    {id:'content',title:'内容创作 · 每周一条实践记录',desc:w===1?'选定主要平台，写一条选题；有精力再发布。':'围绕本周实践写一条内容，记录发布与反馈；忙时保留草稿即可。',time:45},
    {id:'job',title:'求职行动 · 少量、匹配、留记录',desc:w<=2?'梳理目标岗位与带教要求，收藏 2—3 个匹配机会。':'选择 2—3 个匹配岗位投递或跟进；记录岗位内容、成本和反馈。',time:30},
    {id:'thesis',title:'毕业论文 · 保持最低推进',desc:'安排两次 30 分钟，推进导师当前要求的一项任务；临近节点优先增加论文时间。',time:60},
    {id:'review',title:'每周复盘 · 留下一个下周重点',desc:'更新余额与本周记录，写下一个成果、一个阻碍、一个调整。',time:15}
  ]; }
  function currentWeek(){ return Math.max(1,Math.min(12,Math.floor((dateNumber(today())-dateNumber(state.profile.start))/604800000)+1)); }
  function weekRange(w){ const a=addDays(state.profile.start,(w-1)*7); return shortDate(a)+' — '+shortDate(addDays(a,6)); }
  const checked = w => tasks(w).filter(t => state.checks[w]?.[t.id]).length;
  const completed = () => Array.from({length:12},(_,i)=>checked(i+1)).reduce((a,b)=>a+b,0);
  const phaseFor = w => phaseData.find(p=>w>=p.a&&w<=p.b);
  const phaseCount = p => Array.from({length:p.b-p.a+1},(_,i)=>checked(p.a+i)).reduce((a,b)=>a+b,0);
  function toast(message){ $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
  function persist(){
    try {localStorage.setItem(STORE,JSON.stringify({format:'growth-compass',version:1,state}));storageOK=true;$('#save-status').textContent='已保存 · 当前浏览器';$('#save-status').classList.remove('error');}
    catch(e){storageOK=false;$('#save-status').textContent='未保存，请立即导出';$('#save-status').classList.add('error');toast('浏览器未能保存。请导出备份，避免丢失本次记录。');}
  }
  function heading(kicker,title,subtitle,picker=false){return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${picker?weekPicker():''}</div>`;}
  function weekPicker(){return `<div class="week-picker"><button class="icon-button" data-action="prev-week" aria-label="上一周" ${selectedWeek===1?'disabled':''}>‹</button><label><span class="visually-hidden">选择计划周</span><select id="week-select">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${selectedWeek===i+1?'selected':''}>第 ${i+1} 周</option>`).join('')}</select></label><button class="icon-button" data-action="next-week" aria-label="下一周" ${selectedWeek===12?'disabled':''}>›</button></div>`;}
  function metric(label,value,hint,unit=''){return `<div class="metric"><div class="label">${label}</div><div class="value">${value}${unit?`<small>${unit}</small>`:''}</div><div class="hint">${hint}</div></div>`;}
  function progress(value,total,label){return `<div class="progress-label"><span>${label}</span><span>${value} / ${total}</span></div><div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}"><span style="width:${100*value/total}%"></span></div>`;}
  function taskList(){return `<div class="task-list">${tasks(selectedWeek).map(t=>`<label class="task ${state.checks[selectedWeek]?.[t.id]?'done':''}"><input type="checkbox" data-task="${t.id}" ${state.checks[selectedWeek]?.[t.id]?'checked':''}><span class="task-copy"><span class="task-title">${t.title}</span><span class="task-desc">${t.desc}</span></span><span class="task-time">${t.time} 分钟</span></label>`).join('')}</div>`;}
  function overview(){
    const w=selectedWeek,p=phaseFor(w),published=state.contents.filter(c=>c.status==='已发布').length;
    const balance=state.profile.balance===''?'待填写':money(state.profile.balance);
    return heading('YOUR NEXT CHAPTER',`${state.profile.name?esc(state.profile.name)+'，':''}慢慢生长，步步有据。`,'以 HR 为职业主线，让 AI 实践和内容创作相互促进。',true)+
      (!initialized?`<div class="welcome"><strong>欢迎来到你的成长工作台。</strong> 可先填写现状，再开始执行。已有专属入口或备份时，请用完整入口链接打开，或导入备份。<br><button class="button small" data-action="settings">填写个人资料</button> <button class="button small" data-action="import">导入已有计划</button></div>`:'')+
      `<section class="hero"><div><div class="eyebrow">WEEK ${String(w).padStart(2,'0')} · ${weekRange(w)} · ${p.title}</div><h2>${weekTitles[w-1]}</h2><p>${esc(state.profile.goal)}</p><div class="hero-tags"><span>在职寻找机会</span><span>真实成果优先</span><span>每周约 ${esc(state.profile.hours)} 小时</span></div></div><div class="hero-side"><span class="big-number">${Math.round(completed()/72*100)}<small>%</small></span><small>12 周行动完成度</small></div></section>`+
      `<div class="metrics">${metric('可支配结余',balance,'余额手动更新，不代表每月收入')}${metric('本周行动',checked(w)+'<small>/ 6</small>',weekRange(w))}${metric('项目证据',state.evidence.length,'每次实测都留一条记录','条')}${metric('内容发布',published,'从每周一条开始，忙时可减量','条')}</div>`+
      `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>这一周，做这几件事</h2><p>建议合计 4 小时 50 分钟；可拆成短时段完成。</p></div><span class="badge">第 ${w} 周</span></div>${progress(checked(w),6,'本周进度')}${taskList()}<div class="button-row"><button class="button" data-nav="review">记录本周复盘 ↗</button><button class="button ghost" data-nav="roadmap">查看完整路线</button></div></section><div><section class="panel"><div class="panel-head"><h2>眼下的优先级</h2><span class="badge warm">先稳，再进</span></div><div class="focus-line"><span class="step-number">1</span><div><p>保留收入与选择空间</p><small>在职求职；核对书面录用、入职日和搬迁成本后再决定离职。</small></div></div><div class="focus-line"><span class="step-number">2</span><div><p>把经历讲清，把成果做实</p><small>准备三个真实案例；AI 项目持续记录耗时、质量与人工修正。</small></div></div><div class="focus-line"><span class="step-number">3</span><div><p>给自媒体一个小规模试验</p><small>围绕同一个项目记录实践，四周后看投入和反馈是否值得。</small></div></div><div class="note-card"><strong>忙的时候，允许缩小计划。</strong><p>先保住工作、论文与作息；自媒体改存草稿，AI 项目只推进一个小步骤。不用靠补打卡追赶。</p></div></section><section class="panel"><p class="eyebrow">THIS WEEK'S REFLECTION</p><h3>这周最想解决的一件事？</h3><p class="subtitle">${esc(state.reviews[w]?.next||'先完成一次复盘，再给下一周留一个清晰重点。')}</p><div class="button-row"><button class="text-button" data-nav="review">去写复盘 →</button></div></section></div></div>`;
  }
  function roadmap(){return heading('A 12-WEEK EXPERIMENT','给成长一点时间。',`${esc(state.profile.start)} 至 ${addDays(state.profile.start,83)} · 计划随真实反馈调整，阶段交付是建议目标。`)+
    `<div class="phase-grid">${phaseData.map((p,i)=>`<section class="phase ${currentWeek()>=p.a&&currentWeek()<=p.b?'current':''}"><span class="phase-index">0${i+1}</span><div class="range">第 ${p.a}—${p.b} 周</div><h3>${p.title}</h3><p>${p.desc}</p>${progress(phaseCount(p),(p.b-p.a+1)*6,'行动进度')}<small>阶段交付：${p.deliver}</small></section>`).join('')}</div><section class="panel"><div class="panel-head"><div><h2>每周一小步</h2><p>选择某一周，查看并跟进它的具体行动。</p></div><button class="button small" data-action="current-week">回到当前周</button></div><div class="week-grid">${weekTitles.map((t,i)=>`<button class="week-card ${i+1===selectedWeek?'selected':''}" data-week="${i+1}"><span class="eyebrow">WEEK ${String(i+1).padStart(2,'0')} · ${weekRange(i+1)}</span><strong>${t}</strong><p>${weeklyAI[i]}</p>${progress(checked(i+1),6,'已完成')}</button>`).join('')}</div></section><div class="note-card"><strong>关于时间投入</strong><p>默认任务合计每周 4 小时 50 分钟。修改“每周时间预算”只记录你的可用时间，不会自动删减任务；预算较少时，请主动优先处理工作、论文和本周最关键的一项成长行动。</p></div>`;}
  function field(label,path,value,placeholder='',type='textarea',full=false){return `<label class="field ${full?'full':''}"><span>${label}</span>${type==='textarea'?`<textarea data-bind="${path}" placeholder="${esc(placeholder)}" maxlength="10000">${esc(value)}</textarea>`:`<input data-bind="${path}" type="${type}" ${type==='number'?'min="0" max="100000000" step="any"':''} value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="300">`}</label>`;}
  function formField(label,name,placeholder='',type='text',required=false){return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" placeholder="${esc(placeholder)}" ${required?'required':''} ${type==='number'?'min="0" max="100000000" step="any"':''} maxlength="300"></label>`;}
  function studioView(){return heading('BUILD YOUR EVIDENCE','让能力，有迹可循。','练习表达，记录实践，把真实积累变成可以展示的作品。')+`<div class="tabs" role="tablist" aria-label="成长方向">${[['interview','面试训练'],['ai','AI 项目'],['content','自媒体试验']].map(([id,label])=>`<button class="tab ${studio===id?'active':''}" role="tab" aria-selected="${studio===id}" id="tab-${id}" aria-controls="studio-panel" data-studio="${id}">${label}</button>`).join('')}</div><div id="studio-panel" role="tabpanel" aria-labelledby="tab-${studio}">${studio==='interview'?interviewView():studio==='ai'?aiView():contentView()}</div>`;}
  function interviewView(){
    const storedIndex=Number(sessionStorageSafe('interview-index')||0),i=[0,1,2].includes(storedIndex)?storedIndex:0,item=state.interviews[i];
    return `<div class="two-col"><section class="panel"><div class="panel-head"><h2>三个真实案例</h2><span class="badge">每个练成 90 秒</span></div><label class="field"><span>正在整理的案例</span><select id="interview-select">${state.interviews.map((it,n)=>`<option value="${n}" ${n===i?'selected':''}>${n+1}. ${it.title}</option>`).join('')}</select></label><hr class="divider"><div class="form-grid">${field('一句话结论',`interviews.${i}.headline`,item.headline,'这段经历最能说明我具备什么能力？','text',true)}${field('背景：只保留必要信息',`interviews.${i}.context`,item.context,'当时要解决什么问题？约束是什么？')}${field('职责：明确自己的贡献',`interviews.${i}.role`,item.role,'哪些是我负责，哪些是同事或 AI 完成？')}${field('行动：突出关键判断',`interviews.${i}.action`,item.action,'最主要的困难是什么？为什么先处理它？我做了什么？')}${field('结果：给可核对的依据',`interviews.${i}.result`,item.result,'结果、记录、反馈分别是什么？没测量的数据不补写。')}${field('反思：下次如何改进',`interviews.${i}.learning`,item.learning,'如果再做一次，我会调整什么？','textarea',true)}</div></section><div><section class="panel"><div class="panel-head"><h2>这次要修正的三个习惯</h2></div><div class="mini-list"><div class="mini-item"><span>01</span><p>把“人性化、氛围好”说具体。<small>目标清楚、反馈直接、相互尊重、能获得什么带教；同时说明你愿意贡献什么。</small></p></div><div class="mini-item"><span>02</span><p>先用一句话告诉对方重点。<small>背景简短，重点留给你的判断、行动和结果。</small></p></div><div class="mini-item"><span>03</span><p>困难要有主次和依据。<small>两件事都难，也要说明哪一件更影响交付，以及你为什么先做它。</small></p></div></div><div class="quote">“主要困难是……因为它影响……所以我先……最后通过……核对结果。”</div><p class="muted small-text">表达框架帮助组织真实经历，不需要背诵，也不补造数据。</p></section><section class="panel"><h3>录音后检查</h3><div class="focus-line"><span class="step-number">✓</span><p>前 15 秒能听出重点吗？</p></div><div class="focus-line"><span class="step-number">✓</span><p>我的个人贡献是否明确？</p></div><div class="focus-line"><span class="step-number">✓</span><p>结果有依据，困难有主次吗？</p></div><div class="focus-line"><span class="step-number">✓</span><p>遇到追问，能停顿后再回答吗？</p></div></section></div></div>`;
  }
  function aiView(){
    const totalBefore=state.evidence.reduce((s,e)=>s+e.before,0),totalAfter=state.evidence.reduce((s,e)=>s+e.after,0),delta=totalBefore-totalAfter;
    return `<div class="two-col"><section class="panel"><div class="panel-head"><h2>一个项目，从问题走到结果</h2><span class="badge">持续维护</span></div><div class="form-grid">${field('项目名称','ai.title',state.ai.title,'例如：招聘周报流程改进','text',true)}${field('问题与原流程','ai.problem',state.ai.problem,'原来怎么做？为什么值得改？')}${field('我的职责','ai.role',state.ai.role,'我独立完成什么？谁提供了支持？')}${field('关键行动','ai.actions',state.ai.actions,'工具只是其中一部分：流程、核对和异常处理如何设计？')}${field('实际结果','ai.result',state.ai.result,'使用下方实测记录作为依据，说明质量与时间变化。')}${field('适用边界与失败情况','ai.boundary',state.ai.boundary,'哪些输入不可靠？哪些步骤必须人工复核？','textarea',true)}${field('作品 / 说明链接','ai.link',state.ai.link,'仅记录可分享的链接；对外演示使用模拟或合适处理后的数据。','text',true)}</div></section><section class="panel"><div class="panel-head"><div><h2>效果要有记录</h2><p>在范围可比的任务中比较，保留质量检查结果。</p></div></div><div class="metrics" style="grid-template-columns:1fr 1fr">${metric('可比实测',state.evidence.length,'手动录入','次')}${metric('累计时间差',state.evidence.length?Math.round(delta):'—','原耗时减改进后耗时','分钟')}</div><form id="evidence-form"><div class="form-grid">${formField('日期','date','','date',true)}${formField('任务 / 样本范围','task','例如：同一批 20 条记录', 'text',true)}${formField('原耗时（分钟）','before','如实记录','number',true)}${formField('改进后耗时（分钟）','after','含人工核对时间','number',true)}<label class="field full"><span>质量、错误与人工修正</span><textarea name="quality" required maxlength="3000" placeholder="核对了什么？发现几处问题？有何差异？"></textarea></label></div><div class="button-row"><button class="button primary" type="submit">添加实测记录</button></div></form><div class="section-gap">${state.evidence.length?state.evidence.slice().reverse().map(e=>`<div class="record"><div><div class="meta">${esc(e.date)} · ${e.before} → ${e.after} 分钟</div><h3>${esc(e.task)}</h3><p>${esc(e.quality)}</p></div><button class="text-button" data-delete="evidence" data-id="${esc(e.id)}">删除</button></div>`).join(''):'<div class="empty">暂无实测。先记录基线，再谈效率提升。</div>'}</div></section></div>`;
  }
  function contentView(){return `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>记录一个年轻 HR 的 AI 实践</h2><p>每周一条是试验节奏，忙的时候可以只留草稿。</p></div></div><form id="content-form"><div class="form-grid">${formField('选题','title','这次实践，解决了什么具体问题？','text',true)}${formField('平台','platform','选择一个你熟悉的平台')}<label class="field"><span>进度</span><select name="status"><option>选题</option><option>草稿</option><option>已发布</option></select></label>${formField('计划 / 发布日期','date','','date')}<label class="field full"><span>核心内容</span><textarea name="note" maxlength="5000" placeholder="问题 → 我的尝试 → 真实结果 → 一个教训"></textarea></label></div><div class="button-row"><button class="button primary" type="submit">加入内容记录</button></div></form><div class="section-gap">${state.contents.length?state.contents.slice().reverse().map(c=>`<div class="record"><div><div class="meta">${esc(c.platform||'平台待定')} · ${esc(c.date||'日期待定')}</div><h3>${esc(c.title)}</h3><p>${esc(c.note)}</p><label class="field section-gap"><span>实际反馈 / 发布链接</span><input data-array="contents" data-id="${esc(c.id)}" data-key="feedback" value="${esc(c.feedback)}" placeholder="记录具体问题、互动或链接，无需追逐播放量"></label></div><div class="record-actions"><select aria-label="${esc(c.title)}的发布状态" data-content-status="${esc(c.id)}">${['选题','草稿','已发布'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select><button class="text-button" data-delete="contents" data-id="${esc(c.id)}">删除</button></div></div>`).join(''):'<div class="empty">还没有内容记录。先写下一个值得分享的小问题。</div>'}</div></section><section class="panel"><h2>四周，验证一个方向</h2><div class="focus-line"><span class="step-number">1</span><div><p>哪些招聘重复工作值得自动化？</p><small>从一个具体场景开始，避免笼统介绍工具。</small></div></div><div class="focus-line"><span class="step-number">2</span><div><p>流程跑通了，结果为什么还会错？</p><small>用模拟案例解释一次真实教训。</small></div></div><div class="focus-line"><span class="step-number">3</span><div><p>招聘实习生怎么核对 AI 输出？</p><small>讲清判断标准与人工核对步骤。</small></div></div><div class="focus-line"><span class="step-number">4</span><div><p>做完这个项目，我真正学会了什么？</p><small>展示你的能力变化，而不只展示工具。</small></div></div><div class="note-card"><strong>四周后再决定是否加量</strong><p>看能否稳定产出、是否吸引目标读者、是否带来具体交流，以及是否影响工作和论文。</p></div><p class="muted small-text section-gap">候选人资料与公司内部信息不直接用于公开内容。演示使用明确标注的模拟数据。</p></section></div>`;}
  function financeView(){
    const b=state.profile.balance,e=state.profile.expense,valid=e!==''&&Number(e)>0,target=valid?Number(e)*3:null,months=valid&&b!==''?(Number(b)/Number(e)).toFixed(1):'—';
    return heading('KEEP YOUR OPTIONS OPEN','先有余地，再做选择。','用真实开支比较机会，给成长保留经济上的选择空间。')+`<div class="metrics">${metric('当前可支配结余',money(b),'不包含尚未到账的收入')}${metric('每月必要开支',money(e),'请填写你真实需要承担的支出')}${metric('可覆盖生活',months,valid?'当前结余 ÷ 必要月开支':'填写月开支后计算','个月')}${metric('三个月备用金',target===null?'待计算':money(target),'规划目标，可随实际情况调整')}</div><div class="two-col"><section class="panel"><div class="panel-head"><h2>更新资金现状</h2><span class="badge">手动更新</span></div><div class="form-grid">${field('可支配结余（元）','profile.balance',b,'例如 4000','number')}${field('每月必要开支（元）','profile.expense',e,'饮食、通勤、住宿等实际支出','number')}</div><div class="section-gap" id="reserve-progress">${valid&&b!==''?progress(Math.min(Number(b),target),target,'备用金覆盖（元）'):'<p class="muted small-text">先核对一个月真实支出。未填写前，不估算你能支撑多久。</p>'}</div><div class="note-card"><strong>换工作前，核对四件事</strong><p>书面录用与入职日期；补贴 / 薪资到账时间；住宿、搬迁与押金；扣除迁移成本后的现金余额。</p></div></section><section class="panel"><h2>机会怎么选</h2><div class="focus-line"><span class="step-number">1</span><p>能接触需求分析、人才判断和业务沟通吗？</p></div><div class="focus-line"><span class="step-number">2</span><p>有具体带教，允许参与数据或流程改进吗？</p></div><div class="focus-line"><span class="step-number">3</span><p>扣除住宿与通勤成本，现金流能承受吗？</p></div><div class="focus-line"><span class="step-number">4</span><p>工作安排能兼顾论文与基本休息吗？</p></div><p class="muted small-text">具体团队与工作内容，需要通过面试和沟通核实。</p></section></div><section class="panel section-gap"><div class="panel-head"><div><h2>求职机会记录</h2><p>记录实际信息和反馈，避免只凭公司名气判断。</p></div></div><form id="opportunity-form"><div class="form-grid">${formField('公司 / 团队','company','公司和具体团队','text',true)}${formField('岗位','role','招聘实习生 / 人力资源等','text',true)}<label class="field"><span>阶段</span><select name="stage">${stages().map(s=>`<option>${s}</option>`).join('')}</select></label>${formField('预计月收入（元）','income','未知可留空','number')}${formField('预计必要月开支（元）','cost','含新城市住宿等','number')}${formField('一次性迁移成本（元）','move','搬家、押金等','number')}<label class="field full"><span>岗位内容 / 带教 / 反馈 / 下一步</span><textarea name="note" maxlength="5000" placeholder="把已确认信息和待核实问题分别写清楚。"></textarea></label></div><div class="button-row"><button class="button primary" type="submit">记录一个机会</button></div></form><div class="section-gap">${state.opportunities.length?state.opportunities.slice().reverse().map(o=>`<div class="record"><div><div class="meta">${esc(o.role)} · ${esc(o.date)}</div><h3>${esc(o.company)}</h3><p>${o.income!==''&&o.cost!==''?'预计月结余 '+money(o.income-o.cost):'月结余待核实'}${o.move!==''?' · 一次性成本 '+money(o.move):''}</p><p>${esc(o.note)}</p></div><div class="record-actions"><select aria-label="${esc(o.company)}的求职阶段" data-opportunity-stage="${esc(o.id)}">${stages().map(s=>`<option ${s===o.stage?'selected':''}>${s}</option>`).join('')}</select><button class="text-button" data-delete="opportunities" data-id="${esc(o.id)}">删除</button></div></div>`).join(''):'<div class="empty">暂无机会记录。遇到匹配岗位时再加入。</div>'}</div></section>`;
  }
  function stages(){return ['待了解','已投递','一面','二面','后续面试','已录用','未通过','已放弃'];}
  function reviewView(){const w=selectedWeek,r=state.reviews[w]||reviewTemplate();return heading('PAUSE & REFLECT','每周 15 分钟，校准一次。','复盘事实和下一步，不给自己打一个笼统的分数。',true)+`<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>第 ${w} 周复盘</h2><p>${weekRange(w)} · 本周行动 ${checked(w)} / 6</p></div><span class="badge">写下就会保存</span></div><div class="form-grid">${field('本周一个具体成果',`reviews.${w}.wins`,r.wins,'发生了什么？有什么记录或反馈？','textarea',true)}${field('最大的阻碍',`reviews.${w}.obstacle`,r.obstacle,'选一个主要问题，说清为什么它更影响进展。','textarea',true)}${field('一个判断或教训',`reviews.${w}.lesson`,r.lesson,'我改变了什么看法？下次要怎么做？','textarea',true)}${field('下周只抓住的一个重点',`reviews.${w}.next`,r.next,'写成一个能实际完成的动作。','textarea',true)}${field('精力与生活状态',`reviews.${w}.energy`,r.energy,'工作、睡眠、运动或论文负担有什么变化？','textarea',true)}</div><div class="button-row"><button class="button primary" data-action="finish-review">保存复盘并完成本周复盘行动</button></div></section><div><section class="panel"><h2>过去留下的记录</h2><div class="review-history">${Object.keys(state.reviews).sort((a,b)=>b-a).filter(k=>Object.values(state.reviews[k]).some(Boolean)).map(k=>`<details ${Number(k)===w?'open':''}><summary>第 ${k} 周 · ${weekRange(Number(k))}</summary><p><strong>成果</strong> ${esc(state.reviews[k].wins||'尚未填写')}</p><p><strong>下一步</strong> ${esc(state.reviews[k].next||'尚未填写')}</p><button class="text-button section-gap" data-review-week="${k}">查看完整复盘 →</button></details>`).join('')||'<div class="empty">第一条记录，从这一周开始。</div>'}</div></section><section class="panel"><h3>四周时，停下来看看</h3><p class="prompt section-gap">HR：能否更清楚地讲出自己的判断与贡献？<br>AI：项目有没有可核对的时间与质量记录？<br>内容：产出能否持续，是否带来具体交流？<br>生活：积蓄、论文和精力是否受到影响？</p><button class="text-button" data-action="export">导出一份阶段备份 ↗</button></section></div></div>`;}
  function render(){
    document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));
    $('#main').innerHTML=({overview,roadmap,studio:studioView,finance:financeView,review:reviewView})[page]();
    document.querySelectorAll('form input[type=date]').forEach(i=>{if(!i.value)i.value=today();});
    $('.avatar').textContent=state.profile.name?Array.from(state.profile.name)[0]:'我';
  }
  function navigate(next){if(!['overview','roadmap','studio','finance','review'].includes(next))return;page=next;render();window.scrollTo({top:0,behavior:'instant'});}
  function sessionStorageSafe(k,v){try {if(v!==undefined)sessionStorage.setItem(k,v);return sessionStorage.getItem(k);}catch{return null;}}
  function changeBound(el){
    const parts=el.dataset.bind.split('.');let target=state;
    if(parts[0]==='reviews'&&!state.reviews[parts[1]])state.reviews[parts[1]]=reviewTemplate();
    for(let i=0;i<parts.length-1;i++)target=target[parts[i]];
    target[parts.at(-1)]=el.type==='number'?(el.value===''?'':Math.min(100000000,Math.max(0,Number(el.value)||0))):el.value;
    if(parts[0]==='reviews')state.reviews[parts[1]].updated=today();
    initialized=true;persist();
  }
  function confirmAction(message){$('#confirm-message').textContent=message;$('#confirm-dialog').showModal();return new Promise(resolve=>{confirmResolve=resolve;});}
  function closeConfirm(value){$('#confirm-dialog').close();if(confirmResolve){confirmResolve(value);confirmResolve=null;}}
  $('#confirm-ok').addEventListener('click',()=>closeConfirm(true));$('#confirm-cancel').addEventListener('click',()=>closeConfirm(false));
  $('#confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();closeConfirm(false);});
  function showSettings(){
    const p=state.profile;
    $('#settings-fields').innerHTML=`${formField('称呼','name','你希望怎么称呼自己')}${formField('城市','city','当前常住城市')}${formField('计划开始日期','start','','date',true)}${formField('每周时间预算（小时）','hours','建议约 5 小时','number',true)}<label class="field full"><span>这一阶段，我想实现什么</span><textarea name="goal" required maxlength="3000"></textarea></label>`;
    for(const k of ['name','city','start','hours','goal'])$('#settings-form').elements[k].value=p[k];
    $('#settings-dialog').showModal();
  }
  function exportBackup(){
    const data={format:'growth-compass',version:1,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`growth-plan-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已生成。换设备时导入这份最新文件。');
  }
  const txt=(x,n=10000)=>typeof x==='string'?x.slice(0,n):'';
  const num=x=>x===''||x===null||x===undefined?'':typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100000000?x:'';
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(dateNumber(x))&&new Date(dateNumber(x)).toISOString().slice(0,10)===x;
  function normalizeBackup(input){
    if(!input||input.format!=='growth-compass'||input.version!==1||!input.state||typeof input.state!=='object'||Array.isArray(input.state))throw Error('文件不是受支持的成长计划备份。');
    const s=input.state,d=defaults(),p=s.profile;
    if(!p||!validDate(p.start)||Number(p.start.slice(0,4))<2000||Number(p.start.slice(0,4))>2100)throw Error('计划开始日期无效。');
    d.profile={name:txt(p.name,100),start:p.start,goal:txt(p.goal,3000),balance:num(p.balance),expense:num(p.expense),city:txt(p.city,100),hours:Math.min(40,Math.max(.5,num(p.hours)||5))};
    for(let w=1;w<=12;w++){if(s.checks?.[w]){d.checks[w]={};for(const t of tasks(w))d.checks[w][t.id]=s.checks[w][t.id]===true;}}
    if(Array.isArray(s.interviews))s.interviews.slice(0,3).forEach((it,i)=>{if(it&&typeof it==='object')for(const key of ['headline','context','role','action','result','learning'])d.interviews[i][key]=txt(it[key]);});
    if(s.ai&&typeof s.ai==='object')for(const key of Object.keys(d.ai))d.ai[key]=txt(s.ai[key]);
    const array=(key,convert)=>{if(!Array.isArray(s[key]))return;if(s[key].length>2000)throw Error('备份记录过多，请分阶段保存。');d[key]=s[key].filter(v=>v&&typeof v==='object').map(convert);};
    array('evidence',v=>({id:uid(),date:validDate(v.date)?v.date:today(),task:txt(v.task,300),before:num(v.before)===''?0:num(v.before),after:num(v.after)===''?0:num(v.after),quality:txt(v.quality,3000)}));
    array('contents',v=>({id:uid(),date:validDate(v.date)?v.date:'',title:txt(v.title,300),platform:txt(v.platform,300),note:txt(v.note,5000),status:['选题','草稿','已发布'].includes(v.status)?v.status:'选题',feedback:txt(v.feedback,3000)}));
    array('opportunities',v=>({id:uid(),date:validDate(v.date)?v.date:today(),company:txt(v.company,300),role:txt(v.role,300),stage:stages().includes(v.stage)?v.stage:'待了解',income:num(v.income),cost:num(v.cost),move:num(v.move),note:txt(v.note,5000)}));
    for(let w=1;w<=12;w++)if(s.reviews?.[w]&&typeof s.reviews[w]==='object'){d.reviews[w]=reviewTemplate();for(const key of Object.keys(d.reviews[w]))d.reviews[w][key]=txt(s.reviews[w][key]);}
    return d;
  }
  document.addEventListener('input',e=>{
    if(e.target.dataset.bind)changeBound(e.target);
    if(e.target.dataset.array){const a=state[e.target.dataset.array];const item=Array.isArray(a)?a.find(x=>x.id===e.target.dataset.id):null;if(item&&e.target.dataset.key==='feedback'){item.feedback=e.target.value;persist();}}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.task){state.checks[selectedWeek]??={};state.checks[selectedWeek][el.dataset.task]=el.checked;initialized=true;persist();render();}
    if(el.id==='week-select'){selectedWeek=Number(el.value);render();}
    if(el.id==='interview-select'){sessionStorageSafe('interview-index',el.value);render();}
    if(el.dataset.contentStatus){const item=state.contents.find(c=>c.id===el.dataset.contentStatus);if(item){item.status=el.value;persist();}}
    if(el.dataset.opportunityStage){const item=state.opportunities.find(c=>c.id===el.dataset.opportunityStage);if(item){item.stage=el.value;persist();}}
    if(el.dataset.bind?.startsWith('profile.'))render();
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button,a.brand');if(!b)return;
    if(b.matches('a.brand')){e.preventDefault();navigate('overview');return;}
    if(b.dataset.nav){navigate(b.dataset.nav);return;}
    if(b.dataset.studio){studio=b.dataset.studio;render();return;}
    if(b.dataset.week){selectedWeek=Number(b.dataset.week);navigate('overview');return;}
    if(b.dataset.reviewWeek){selectedWeek=Number(b.dataset.reviewWeek);render();return;}
    if(b.dataset.delete){const key=b.dataset.delete;if(!['evidence','contents','opportunities'].includes(key))return;if(await confirmAction('删除这条记录？此操作只影响当前浏览器，已导出的备份仍可恢复。')){state[key]=state[key].filter(x=>x.id!==b.dataset.id);persist();render();}return;}
    switch(b.dataset.action){
      case 'settings':showSettings();break;
      case 'close-dialog':$('#settings-dialog').close();break;
      case 'export':exportBackup();break;
      case 'import':$('#import-file').click();break;
      case 'prev-week':selectedWeek=Math.max(1,selectedWeek-1);render();break;
      case 'next-week':selectedWeek=Math.min(12,selectedWeek+1);render();break;
      case 'current-week':selectedWeek=currentWeek();navigate('overview');break;
      case 'copy-entry':{
        const link=location.href.split('#')[0]+(entryKey?'#key='+entryKey:'');
        try{await navigator.clipboard.writeText(link);toast(entryKey?'专属入口已复制。该链接只载入起始资料，请自己保管。':'网页地址已复制。换设备需另行导入进度。');}catch{toast('复制失败，请从地址栏复制完整网页地址。');}break;
      }
      case 'finish-review':state.reviews[selectedWeek]??=reviewTemplate();if(!state.reviews[selectedWeek].wins.trim()&&!state.reviews[selectedWeek].next.trim()){toast('先写一个具体成果或下周重点，再完成复盘。');break;}state.reviews[selectedWeek].updated=today();state.checks[selectedWeek]??={};state.checks[selectedWeek].review=true;persist();render();toast('本周复盘已保存。给下一周留一点余地。');break;
    }
  });
  document.addEventListener('submit',e=>{
    const form=e.target;if(!['settings-form','evidence-form','content-form','opportunity-form'].includes(form.id))return;e.preventDefault();const data=Object.fromEntries(new FormData(form));
    if(form.id==='settings-form'){
      if(!validDate(data.start)||Number(data.start.slice(0,4))<2000||Number(data.start.slice(0,4))>2100){toast('请输入 2000—2100 年之间的有效开始日期。');return;}
      const hours=Number(data.hours);if(!Number.isFinite(hours)||hours<.5||hours>40){toast('每周时间预算请填写 0.5—40 小时。');return;}
      Object.assign(state.profile,{name:data.name.trim(),city:data.city.trim(),start:data.start,hours,goal:data.goal.trim()});initialized=true;selectedWeek=currentWeek();persist();$('#settings-dialog').close();render();toast('资料已更新，计划可以随时调整。');return;
    }
    if(form.id==='evidence-form'){
      if(!validDate(data.date)||!data.task.trim()||!data.quality.trim()||![data.before,data.after].every(v=>v!==''&&Number.isFinite(Number(v))&&Number(v)>=0)){toast('请填写有效日期、可比任务、非负耗时和质量记录。');return;}
      state.evidence.push({id:uid(),date:data.date,task:data.task.trim(),before:Number(data.before),after:Number(data.after),quality:data.quality.trim()});
    }
    if(form.id==='content-form'){
      if(!data.title.trim()){toast('请先写下一个具体选题。');return;}
      state.contents.push({id:uid(),date:data.date,title:data.title.trim(),platform:data.platform.trim(),status:data.status,note:data.note.trim(),feedback:''});
    }
    if(form.id==='opportunity-form'){
      if(!data.company.trim()||!data.role.trim()){toast('请填写公司 / 团队与岗位。');return;}
      const getNumber=k=>data[k]===''?'':Number(data[k]);state.opportunities.push({id:uid(),date:today(),company:data.company.trim(),role:data.role.trim(),stage:data.stage,income:getNumber('income'),cost:getNumber('cost'),move:getNumber('move'),note:data.note.trim()});
    }
    initialized=true;persist();render();toast('记录已添加。');
  });
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2000000){toast('文件超过 2 MB，请检查是否选中了正确的备份。');return;}
    try{const restored=normalizeBackup(JSON.parse(await file.text()));
      if($('#settings-dialog').open)$('#settings-dialog').close();
      if(!await confirmAction('导入会替换当前浏览器的全部进度。建议先导出当前记录，再继续。确认导入？'))return;
      state=restored;initialized=true;selectedWeek=currentWeek();persist();render();toast('备份已导入，当前浏览器已更新。');
    }catch(error){toast(error instanceof SyntaxError?'文件不是有效的 JSON 备份。':error.message);}
  });
  window.addEventListener('storage',e=>{if(e.key===STORE&&e.newValue){try{state=normalizeBackup(JSON.parse(e.newValue));initialized=true;render();toast('已载入同一浏览器另一标签页的最新进度。');}catch{toast('其他标签页的数据无法读取，请检查备份。');}}});
  async function decodeSeed(key){
    const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    const cryptoKey=await crypto.subtle.importKey('raw',bytes(key),{name:'AES-GCM'},false,['decrypt']);
    const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(window.GROWTH_SEED.iv)},cryptoKey,bytes(window.GROWTH_SEED.data));
    return normalizeBackup(JSON.parse(new TextDecoder().decode(decrypted)));
  }
  async function boot(){
    $('#today-label').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(new Date());
    let raw=null;try{raw=localStorage.getItem(STORE);entryKey=localStorage.getItem(ENTRY)||'';if(raw){state=normalizeBackup(JSON.parse(raw));initialized=true;}}catch(error){storageOK=false;toast('本地记录读取失败。请导入备份；暂不覆盖原记录。');}
    const key=new URLSearchParams(location.hash.slice(1)).get('key');
    if(key){
      entryKey=key;
      if(!initialized&&!raw){try{state=await decodeSeed(key);initialized=true;persist();toast('专属起始计划已载入。之后的修改保存在当前浏览器。');}catch(error){toast('专属入口无法解锁。请检查完整链接，或导入计划备份。');}}
      try{localStorage.setItem(ENTRY,key);}catch{}
    }
    selectedWeek=currentWeek();render();
    if(storageOK){$('#save-status').textContent=initialized?'已保存 · 当前浏览器':'当前浏览器 · 待填写资料';}else{$('#save-status').textContent='保存不可用，请导出备份';$('#save-status').classList.add('error');}
  }
  boot();
})();
