/* Shared by Hugo and React. All directory operations work without map tiles. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = u => /^https?:\/\//i.test(u || '') ? esc(u) : '#';
  const names = { 'core-nuclear':['Core nuclear physics','核心核物理'], 'rare-isotope':['Rare isotopes','稀有同位素'], 'penning-trap':['Penning traps','彭宁阱'], 'mr-tof':['MR-TOF','多次反射飞行时间'], 'research-reactor':['Research reactors','研究堆'], 'neutron':['Neutron science','中子科学'], 'accelerator-neutron':['Accelerator neutrons','加速器中子'], 'radionuclide':['Radionuclide production','放射性核素生产'], 'cyclotron':['Cyclotrons','回旋加速器'], 'electrostatic':['Electrostatic accelerators','静电加速器'], 'historical':['Historical source','历史来源'], 'storage-ring':['Storage rings','储存环'], 'spallation':['Spallation neutrons','散裂中子'], 'synchrotron':['Synchrotrons','同步加速器'], 'xfel':['X ray free electron lasers','X 射线自由电子激光'], 'bnct':['Neutron capture therapy','硼中子俘获治疗'], 'nuclear-rd':['Nuclear research','核研究'] };
  const group = {core:['core-nuclear'],rare:['rare-isotope'],precision:['penning-trap','mr-tof','storage-ring'],neutron:['neutron','accelerator-neutron','spallation'],reactor:['research-reactor']};
  window.mountFacilityAtlas = async (root, supplied) => {
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = '1';
    const zh = (root.dataset.lang || '').startsWith('zh');
    const tr = (en,cn) => zh ? cn : en;
    const base = root.dataset.root || '/';
    const locale = root.dataset.locale || base;
    root.innerHTML = `<p class="atlas-loading" role="status">${tr('Loading facility directory…','正在加载设施目录…')}</p>`;
    let doc;
    try { doc = supplied || await fetch(base+'data/facilities.json').then(r => {if(!r.ok)throw Error(r.status);return r.json();}); }
    catch { root.innerHTML = `<p role="alert">${tr('Directory could not load. Reload or download the data file.','目录加载失败。请重新加载或下载数据文件。')} <a href="${base}data/facilities.json">JSON</a></p>`; delete root.dataset.mounted; return; }
    const fs = doc.facilities, params = new URLSearchParams(location.search);
    const label = c => (names[c] || [c,c])[zh?1:0];
    const filters = ['preset','category','technique','status','continent','country','verification'];
    const options = {preset:['all','core','rare','precision','neutron','reactor'],category:[...new Set(fs.flatMap(f=>f.categories))].sort(),technique:[...new Set(fs.flatMap(f=>f.techniques||[]))].sort(),status:[...new Set(fs.map(f=>f.status))].sort(),continent:[...new Set(fs.map(f=>f.continent||'Unresolved'))].sort(),country:[...new Set(fs.map(f=>f.country))].sort(),verification:[...new Set(fs.map(f=>f.verification_status))].sort()};
    const labels = {preset:tr('Preset','预设'),category:tr('Category','类别'),technique:tr('Technique','技术'),status:tr('Status','状态'),continent:tr('Continent','大洲'),country:tr('Country','国家'),verification:tr('Verification','核实状态')};
    const presets = {all:tr('All facilities','所有设施'),core:tr('Core nuclear physics','核心核物理'),rare:tr('Rare isotopes','稀有同位素'),precision:tr('Precision mass / ion traps','精密质量 / 离子阱'),neutron:tr('Neutron science','中子科学'),reactor:tr('Reactors','反应堆')};
    root.innerHTML = `<div class="atlas-coverage"><strong>${doc.coverage.facilities_programs||fs.length}</strong> ${tr('documented facility / program records','有来源的设施 / 项目记录')} · ${doc.coverage.machines} ${tr('machines','台设备')} · ${doc.coverage.confirmed_campuses||0} ${tr('confirmed campuses','已确认园区')}<br><small>${tr('Historical and unresolved records remain searchable. Map pins show verified coordinates; city approximations are labeled.','历史及未定位记录仍可搜索。地图仅显示已核实坐标，并明确标注城市近似位置。')}</small></div>
    <div class="atlas-filters"><label>${tr('Search','搜索')}<input name="q" type="search" placeholder="${tr('Name, city, capability or source ID','名称、城市、用途或来源编号')}" value="${esc(params.get('q')||'')}"></label>${filters.map(k=>`<label>${labels[k]}<select name="${k}"><option value="all">${tr('All','全部')}</option>${options[k].filter(v=>v!=='all').map(v=>`<option value="${esc(v)}">${esc(k==='preset'?presets[v]:k==='category'?label(v):v)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="atlas-actions"><button type="button" data-action="reset">${tr('Reset','重置')}</button><button type="button" data-action="csv">${tr('Download filtered CSV','下载筛选 CSV')}</button><button type="button" data-action="json">${tr('Download filtered JSON','下载筛选 JSON')}</button><a href="mailto:zhuang.z.ge@jyu.fi?subject=Facility%20correction">${tr('Suggest a correction','提交更正')}</a></div>
    <p class="atlas-count" role="status" aria-live="polite"></p><p class="atlas-map-status" role="status"></p>
    <div class="atlas-map" role="region" aria-label="${tr('Facility map','设施地图')}"></div>
    <div class="atlas-layout"><div><ol class="atlas-directory"></ol><div class="atlas-pagination"><button type="button" data-action="prev">${tr('Previous','上一页')}</button><span class="atlas-page"></span><button type="button" data-action="next">${tr('Next','下一页')}</button></div></div><aside class="atlas-detail" aria-label="${tr('Selected facility','所选设施')}">${tr('Select a facility to see its sources and machines.','选择设施以查看来源与设备。')}</aside></div>`;
    filters.forEach(k=>{if(options[k].includes(params.get(k)))root.querySelector(`[name="${k}"]`).value=params.get(k);});
    let map, cluster, selected='', page=0, filtered=[]; const markers=new Map();
    const status = root.querySelector('.atlas-map-status');
    if (window.L) {
      try {
        map=L.map(root.querySelector('.atlas-map'),{scrollWheelZoom:false}).setView([25,10],2);
        let failures=0;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{if(++failures>=2)status.textContent=tr('Map tiles unavailable. The directory and filters remain usable.','地图瓦片不可用；目录与筛选仍可使用。');}).addTo(map);
        cluster=L.markerClusterGroup?L.markerClusterGroup({chunkedLoading:true}):L.layerGroup(); map.addLayer(cluster);
        status.textContent=tr('City approximation pins identify the city, not the facility address.','城市近似标记指向城市，不能用作设施地址。');
      } catch { status.textContent=tr('Map unavailable; use the directory below.','地图不可用，请使用下方目录。'); }
    } else { root.querySelector('.atlas-map').hidden=true; status.textContent=tr('Map library unavailable; the directory is ready.','地图库不可用，目录仍可使用。'); }
    const title=f=>f.name[zh?'zh':'en']||f.name.en;
    const card=f=>`<h3>${esc(title(f))}</h3><p>${esc(f.city)} · ${esc(f.country)}<br>${esc(f.status)} · ${esc(f.verification_status)}</p><p>${esc((f.description||{})[zh?'zh':'en']||(f.description||{}).en||'')}</p><p>${f.categories.map(label).map(esc).join(' · ')}</p><p>${tr('Location evidence','位置证据')}: ${esc(f.coordinate_precision)} · ${f.coordinate_verified?tr('verified','已核实'):tr('not mapped','不显示地图标记')}${f.coordinate_precision==='city_approx'?`<br><strong>${tr('City approximation — not an exact facility location','城市近似位置，非设施精确位置')}</strong>`:''}</p><p>${tr('Source checked','来源检查日期')}: ${esc(f.source_checked)}</p><ul>${f.source_urls.map(u=>`<li><a href="${safe(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join('')}</ul><p>${tr('Source records','来源编号')}: ${f.source_records.map(esc).join(', ')}</p><h4>${tr('Machines / instruments','设备 / 仪器')}</h4><ul>${(f.machines||[]).map(m=>`<li>${esc(m.model||m.reactor_type||m.name||m.id)} ${esc(m.proton_energy_mev?m.proton_energy_mev+' MeV':'')}</li>`).join('')}</ul><a href="${locale}facilities/${f.id}/">${tr('Open facility page','打开设施页面')}</a> · <a href="${locale}daily/?facility=${f.id}&period=all">${tr('Related Daily entries','相关每日条目')}</a>`;
    const select=id=>{const f=fs.find(f=>f.id===id); if(!f)return; selected=id; root.querySelector('.atlas-detail').innerHTML=card(f); params.set('selected',id);history.replaceState(null,'','?'+params); if(map&&markers.has(id)){map.setView([f.latitude,f.longitude],f.coordinate_precision==='city_approx'?10:15);const marker=markers.get(id);if(cluster.zoomToShowLayer)cluster.zoomToShowLayer(marker,()=>marker.openPopup());else marker.openPopup();}root.querySelectorAll('[data-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));};
    const render=()=>{
      const values=Object.fromEntries([...root.querySelectorAll('[name]')].map(e=>[e.name,e.value]));
      filters.concat('q').forEach(k=>{if(values[k]&&values[k]!=='all')params.set(k,values[k]);else params.delete(k);});history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
      const q=values.q.toLocaleLowerCase(); filtered=fs.filter(f=>(!q||JSON.stringify(f).toLocaleLowerCase().includes(q))&&(!group[values.preset]||f.categories.some(c=>group[values.preset].includes(c)))&&(values.category==='all'||f.categories.includes(values.category))&&(values.technique==='all'||(f.techniques||[]).includes(values.technique))&&(values.status==='all'||f.status===values.status)&&(values.continent==='all'||f.continent===values.continent)&&(values.country==='all'||f.country===values.country)&&(values.verification==='all'||f.verification_status===values.verification));
      const mapped=filtered.filter(f=>f.coordinate_verified&&f.latitude!=null);
      root.querySelector('.atlas-count').textContent=tr(`${filtered.length} matching records · ${mapped.length} mapped · ${filtered.length-mapped.length} without pins`,`${filtered.length} 条匹配 · ${mapped.length} 条已定位 · ${filtered.length-mapped.length} 条无标记`);
      page=Math.max(0,Math.min(page,Math.ceil(filtered.length/40)-1)); const slice=filtered.slice(page*40,page*40+40);
      root.querySelector('.atlas-directory').start=page*40+1;
      root.querySelector('.atlas-directory').innerHTML=slice.map(f=>`<li><button type="button" data-id="${f.id}" aria-pressed="${selected===f.id}">${esc(title(f))}</button><small>${esc(f.city)} · ${esc(f.country)} · ${f.categories.map(label).map(esc).join(' / ')}<br>${f.coordinate_verified?esc(f.coordinate_precision):tr('Location unresolved — no pin','位置未核实，无标记')}</small></li>`).join('')||`<li>${tr('No matching facilities. Adjust the filters.','没有匹配设施，请调整筛选。')}</li>`;
      root.querySelector('.atlas-page').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/40))}`;
      root.querySelector('[data-action="prev"]').disabled=page===0;root.querySelector('[data-action="next"]').disabled=(page+1)*40>=filtered.length;
      if(cluster){cluster.clearLayers();markers.clear();mapped.forEach(f=>{const marker=L.marker([f.latitude,f.longitude],{title:title(f),keyboard:true,icon:L.divIcon({className:"atlas-pin",html:"●",iconSize:[24,24]})}).bindPopup(esc(title(f))+'<br>'+esc(f.coordinate_precision));marker.on('click',()=>select(f.id));markers.set(f.id,marker);cluster.addLayer(marker);});}
      if(selected && !filtered.some(f=>f.id===selected)){selected='';root.querySelector('.atlas-detail').textContent=tr('Selected record is outside the current filters.','当前筛选不包含原选定记录。');params.delete('selected');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
    };
    root.addEventListener('input',e=>{if(e.target.name==='q'){page=0;render();}});
    root.addEventListener('change',e=>{if(e.target.name){page=0;render();}});
    root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.id){select(b.dataset.id);return;}const a=b.dataset.action;if(a==='prev'||a==='next'){page+=a==='next'?1:-1;render();}if(a==='reset'){root.querySelectorAll('select').forEach(s=>s.value='all');root.querySelector('[name="q"]').value='';selected='';page=0;render();}if(a==='csv'||a==='json'){const csvrow=xs=>xs.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',');const data=a==='json'?JSON.stringify({coverage:{filtered:filtered.length},facilities:filtered},null,2):[csvrow(['id','name','country','city','categories','status','coordinate_precision','coordinate_verified','latitude','longitude','source_urls']),...filtered.map(f=>csvrow([f.id,title(f),f.country,f.city,f.categories.join(';'),f.status,f.coordinate_precision,f.coordinate_verified,f.coordinate_verified?f.latitude:'',f.coordinate_verified?f.longitude:'',f.source_urls.join(';')]))].join('\r\n');const u=URL.createObjectURL(new Blob([a==='csv'?'\ufeff'+data:data],{type:a==='csv'?'text/csv;charset=utf-8':'application/json'}));const link=document.createElement('a');link.href=u;link.download='facilities-filtered.'+a;link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});
    render();if(params.get('selected'))select(params.get('selected'));
    return {count:()=>filtered.length, select, render};
  };
  document.querySelectorAll('[data-facility-atlas]').forEach(r=>window.mountFacilityAtlas(r));
})();
