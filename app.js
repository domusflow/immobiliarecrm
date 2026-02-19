const API_URL = "https://script.google.com/a/macros/domusflowimmobiliare.com/s/AKfycbxdSeuCRzY-V4ySFbIj2NluLdfULNZo1boTBzPYBf5Oq6wwYiLLHUeS1uOZBZ7v2iF4/exec";

let session = { token:null, username:null, ruolo:null };

const $ = (id)=>document.getElementById(id);
function show(el,on=true){ el.classList.toggle("hidden", !on); }
function setMsg(id, txt){ $(id).textContent = txt || ""; }
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function api(action, data = {}) {
  const form = new URLSearchParams();
  form.set("action", action);
  if (session.token) form.set("token", session.token);
  Object.entries(data).forEach(([k,v])=>{
    if (v===undefined || v===null) return;
    form.set(k, String(v));
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString()
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Errore API");
  return json.data;
}

/** Tabs */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    ["clienti","immobili","calendario"].forEach(x=> show($("tab-"+x), x===t));
  });
});

/** Modal */
function modalOpen(title, bodyHtml, actionsHtml=""){
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHtml;
  $("modalActions").innerHTML = actionsHtml;
  $("modalMsg").textContent = "";
  show($("modal"), true);
}
function modalClose(){ show($("modal"), false); }
$("btnModalClose").onclick = modalClose;
$("modal").addEventListener("click",(e)=>{ if(e.target.id==="modal") modalClose(); });

/** LOGIN */
$("btnLogin").onclick = async ()=>{
  setMsg("loginMsg", "Accesso...");
  try{
    const username = $("loginUser").value.trim();
    const password = $("loginPass").value;
    const data = await api("login", { username, password });
    session.token = data.token;
    session.username = data.username;
    session.ruolo = data.ruolo;

    $("whoami").textContent = `${session.username} (${session.ruolo})`;
    show($("btnLogout"), true);
    show($("viewLogin"), false);
    show($("viewApp"), true);

    await refreshClienti();
    await refreshImmobili();
    await refreshEventi();
    setMsg("loginMsg", "");
  }catch(e){
    setMsg("loginMsg", e.message);
  }
};

$("btnLogout").onclick = ()=>{
  session = { token:null, username:null, ruolo:null };
  $("whoami").textContent = "";
  show($("btnLogout"), false);
  show($("viewApp"), false);
  show($("viewLogin"), true);
};

/** CLIENTI */
$("btnSearchClienti").onclick = refreshClienti;
async function refreshClienti(){
  const q = $("qCliente").value.trim();
  const tipo = $("tipoCliente").value.trim();
  const rows = await api("searchClienti", { q, tipo });
  const tb = $("tblClienti").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_CLIENTE)}</td>
      <td><span class="badge">${esc(r.TIPO_CLIENTE)}</span></td>
      <td>${esc(r.NOME)}</td>
      <td>${esc(r.COGNOME)}</td>
      <td>${esc(r.TELEFONO)}</td>
      <td>${esc(r.EMAIL)}</td>
      <td>${esc(r.OWNER_AGENT)}</td>
      <td class="actions">
        <button class="btn btn-ghost" data-act="edit">Modifica</button>
        <button class="btn btn-ghost" data-act="addAct">+ Attività</button>
        <button class="btn btn-ghost" data-act="viewAct">Vedi attività</button>
      </td>`;
    tr.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> onClienteAction(b.dataset.act, r));
    });
    tb.appendChild(tr);
  });
}

$("btnOpenAddCliente").onclick = ()=>{
  modalOpen("Aggiungi Cliente", `
    <div class="grid2">
      <label>Tipo
        <select id="mTipoCliente">
          <option>Generale</option><option>Informatore</option><option>Partner</option>
        </select>
      </label>
      <label>Owner Agent <input id="mOwner" placeholder="es. Mario Rossi" /></label>
      <label>Nome <input id="mNome" /></label>
      <label>Cognome <input id="mCognome" /></label>
      <label>Telefono <input id="mTel" /></label>
      <label>Email <input id="mEmail" /></label>
      <label>Città <input id="mCitta" /></label>
      <label>Zona <input id="mZona" /></label>
    </div>
    <label>Note <textarea id="mNote"></textarea></label>
  `, `<button id="mSave" class="btn">Salva</button>`);
  $("mSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      await api("addCliente", {
        tipoCliente: $("mTipoCliente").value,
        owner: $("mOwner").value,
        nome: $("mNome").value,
        cognome: $("mCognome").value,
        telefono: $("mTel").value,
        email: $("mEmail").value,
        citta: $("mCitta").value,
        zona: $("mZona").value,
        note: $("mNote").value
      });
      $("modalMsg").textContent="OK ✅";
      await refreshClienti();
      setTimeout(modalClose, 350);
    }catch(e){ $("modalMsg").textContent=e.message; }
  };
};

let currentClienteId = null;
async function onClienteAction(act, row){
  if (act==="viewAct"){
    currentClienteId = row.ID_CLIENTE;
    $("clienteActTitle").textContent = `Attività Cliente — ${row.NOME} ${row.COGNOME} (${row.ID_CLIENTE})`;
    show($("clienteActivities"), true);
    await refreshActClienti();
  }
  if (act==="addAct"){
    currentClienteId = row.ID_CLIENTE;
    openAddActCliente(row.ID_CLIENTE);
  }
  if (act==="edit"){
    modalOpen("Modifica Cliente (base)", `
      <div class="grid2">
        <label>Telefono <input id="eTel" value="${esc(row.TELEFONO)}"/></label>
        <label>Email <input id="eEmail" value="${esc(row.EMAIL)}"/></label>
        <label>Owner <input id="eOwner" value="${esc(row.OWNER_AGENT)}"/></label>
        <label>Zona <input id="eZona" value="${esc(row.ZONA)}"/></label>
      </div>
      <label>Note <textarea id="eNote">${esc(row.NOTE)}</textarea></label>
    `, `<button id="eSave" class="btn">Salva</button>`);
    $("eSave").onclick = async ()=>{
      try{
        $("modalMsg").textContent="Salvataggio...";
        await api("updateClienteBase", {
          idCliente: row.ID_CLIENTE,
          telefono: $("eTel").value,
          email: $("eEmail").value,
          owner: $("eOwner").value,
          zona: $("eZona").value,
          note: $("eNote").value
        });
        $("modalMsg").textContent="OK ✅";
        await refreshClienti();
        setTimeout(modalClose, 350);
      }catch(e){ $("modalMsg").textContent=e.message; }
    };
  }
}

$("btnCloseClienteAct").onclick = ()=> show($("clienteActivities"), false);
$("btnAddActCliente").onclick = ()=> openAddActCliente(currentClienteId);

async function refreshActClienti(){
  const rows = await api("listAttivitaCliente", { idCliente: currentClienteId });
  const tb = $("tblActClienti").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_ATTIVITA)}</td>
      <td>${esc(r.TIPO_ATTIVITA)}</td>
      <td>${esc(r.ESITO)}</td>
      <td>${esc(r.DATA)}</td>
      <td>${esc(r.ORA)}</td>
      <td>${esc(r.AGENTE)}</td>
      <td>${esc(r.NOTE)}</td>`;
    tb.appendChild(tr);
  });
}

function openAddActCliente(idCliente){
  modalOpen("Aggiungi Attività Cliente", `
    <p class="muted">Cliente: <b>${esc(idCliente)}</b></p>
    <div class="grid2">
      <label>Tipo
        <select id="aTipo">
          <option>Chiamata</option><option>WhatsApp</option><option>Email</option>
          <option>Incontro</option><option>Follow-up</option><option>Altro</option>
        </select>
      </label>
      <label>Esito <input id="aEsito" /></label>
      <label>Data <input id="aData" type="date"/></label>
      <label>Ora <input id="aOra" type="time"/></label>
    </div>
    <label>Note <textarea id="aNote"></textarea></label>
  `, `<button id="aSave" class="btn">Salva</button>`);
  $("aSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      await api("addAttivitaCliente", {
        idCliente,
        tipoAttivita: $("aTipo").value,
        esito: $("aEsito").value,
        data: $("aData").value,
        ora: $("aOra").value,
        note: $("aNote").value
      });
      $("modalMsg").textContent="OK ✅";
      if (currentClienteId===idCliente) await refreshActClienti();
      setTimeout(modalClose, 350);
    }catch(e){ $("modalMsg").textContent=e.message; }
  };
}

/** IMMOBILI */
$("btnSearchImmobili").onclick = refreshImmobili;
async function refreshImmobili(){
  const q = $("qImmobile").value.trim();
  const tipo = $("tipoImmobile").value.trim();
  const rows = await api("searchImmobili", { q, tipo });
  const tb = $("tblImmobili").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_IMMOBILE)}</td>
      <td><span class="badge">${esc(r.TIPO_IMMOBILE)}</span></td>
      <td>${esc(r.INDIRIZZO)}</td>
      <td>${esc(r.CITTA)}</td>
      <td>${esc(r.ZONA)}</td>
      <td>${esc(r.TIPOLOGIA)}</td>
      <td>${esc(r.MQ)}</td>
      <td>${esc(r.RESPONSABILE)}</td>
      <td class="actions">
        <button class="btn btn-ghost" data-act="edit">Modifica</button>
        <button class="btn btn-ghost" data-act="addAct">+ Attività</button>
        <button class="btn btn-ghost" data-act="viewAct">Vedi attività</button>
      </td>`;
    tr.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> onImmobileAction(b.dataset.act, r));
    });
    tb.appendChild(tr);
  });
}

$("btnOpenAddImmobile").onclick = ()=>{
  modalOpen("Aggiungi Immobile", `
    <div class="grid2">
      <label>Tipo
        <select id="imTipo">
          <option>Normale</option><option>Traccia</option><option>Futura Notizia</option>
          <option>Ex Notizia</option><option>Notizia</option>
        </select>
      </label>
      <label>Responsabile <input id="imResp" placeholder="es. Mario Rossi"/></label>
      <label>Indirizzo <input id="imInd" /></label>
      <label>Città <input id="imCitta" /></label>
      <label>Zona <input id="imZona" /></label>
      <label>Tipologia <input id="imTipoLogia" /></label>
      <label>MQ <input id="imMq" type="number" /></label>
    </div>
    <label>Note <textarea id="imNote"></textarea></label>
  `, `<button id="imSave" class="btn">Salva</button>`);
  $("imSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      await api("addImmobile", {
        tipoImmobile: $("imTipo").value,
        responsabile: $("imResp").value,
        indirizzo: $("imInd").value,
        citta: $("imCitta").value,
        zona: $("imZona").value,
        tipologia: $("imTipoLogia").value,
        mq: $("imMq").value,
        note: $("imNote").value
      });
      $("modalMsg").textContent="OK ✅";
      await refreshImmobili();
      setTimeout(modalClose, 350);
    }catch(e){ $("modalMsg").textContent=e.message; }
  };
};

let currentImmobileId = null;
async function onImmobileAction(act, row){
  if (act==="viewAct"){
    currentImmobileId = row.ID_IMMOBILE;
    $("immobileActTitle").textContent = `Attività Immobile — ${row.INDIRIZZO} (${row.ID_IMMOBILE})`;
    show($("immobileActivities"), true);
    await refreshActImmobili();
  }
  if (act==="addAct"){
    currentImmobileId = row.ID_IMMOBILE;
    openAddActImmobile(row.ID_IMMOBILE);
  }
  if (act==="edit"){
    modalOpen("Modifica Immobile (base)", `
      <div class="grid2">
        <label>Responsabile <input id="ieResp" value="${esc(row.RESPONSABILE)}"/></label>
        <label>Zona <input id="ieZona" value="${esc(row.ZONA)}"/></label>
        <label>MQ <input id="ieMq" type="number" value="${esc(row.MQ)}"/></label>
        <label>Tipologia <input id="ieTipo" value="${esc(row.TIPOLOGIA)}"/></label>
      </div>
      <label>Note <textarea id="ieNote">${esc(row.NOTE_IMMOBILE)}</textarea></label>
    `, `<button id="ieSave" class="btn">Salva</button>`);
    $("ieSave").onclick = async ()=>{
      try{
        $("modalMsg").textContent="Salvataggio...";
        await api("updateImmobileBase", {
          idImmobile: row.ID_IMMOBILE,
          responsabile: $("ieResp").value,
          zona: $("ieZona").value,
          mq: $("ieMq").value,
          tipologia: $("ieTipo").value,
          note: $("ieNote").value
        });
        $("modalMsg").textContent="OK ✅";
        await refreshImmobili();
        setTimeout(modalClose, 350);
      }catch(e){ $("modalMsg").textContent=e.message; }
    };
  }
}

$("btnCloseImmobileAct").onclick = ()=> show($("immobileActivities"), false);
$("btnAddActImmobile").onclick = ()=> openAddActImmobile(currentImmobileId);

async function refreshActImmobili(){
  const rows = await api("listAttivitaImmobile", { idImmobile: currentImmobileId });
  const tb = $("tblActImmobili").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_ATTIVITA)}</td>
      <td>${esc(r.TIPO_ATTIVITA)}</td>
      <td>${esc(r.ESITO)}</td>
      <td>${esc(r.DATA)}</td>
      <td>${esc(r.ORA)}</td>
      <td>${esc(r.AGENTE)}</td>
      <td>${esc(r.NOTE)}</td>`;
    tb.appendChild(tr);
  });
}

function openAddActImmobile(idImmobile){
  modalOpen("Aggiungi Attività Immobile", `
    <p class="muted">Immobile: <b>${esc(idImmobile)}</b></p>
    <div class="grid2">
      <label>Tipo
        <select id="iaTipo">
          <option>Sopralluogo</option><option>Telefonata proprietario</option><option>Verifica documenti</option>
          <option>Foto</option><option>Visita cliente</option><option>Altro</option>
        </select>
      </label>
      <label>Esito <input id="iaEsito" /></label>
      <label>Data <input id="iaData" type="date"/></label>
      <label>Ora <input id="iaOra" type="time"/></label>
    </div>
    <label>Note <textarea id="iaNote"></textarea></label>
  `, `<button id="iaSave" class="btn">Salva</button>`);
  $("iaSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      await api("addAttivitaImmobile", {
        idImmobile,
        tipoAttivita: $("iaTipo").value,
        esito: $("iaEsito").value,
        data: $("iaData").value,
        ora: $("iaOra").value,
        note: $("iaNote").value
      });
      $("modalMsg").textContent="OK ✅";
      if (currentImmobileId===idImmobile) await refreshActImmobili();
      setTimeout(modalClose, 350);
    }catch(e){ $("modalMsg").textContent=e.message; }
  };
}

/** CALENDARIO */
$("btnSearchEventi").onclick = refreshEventi;
async function refreshEventi(){
  const q = $("qEvento").value.trim();
  const stato = $("statoEvento").value.trim();
  const rows = await api("listEventi", { q, stato });
  const tb = $("tblEventi").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_EVENTO)}</td>
      <td><span class="badge">${esc(r.TIPO_EVENTO)}</span></td>
      <td>${esc(r.TITOLO)}</td>
      <td>${esc(r.DATA_INIZIO)} ${esc(r.ORA_INIZIO)}</td>
      <td>${esc(r.DATA_FINE)} ${esc(r.ORA_FINE)}</td>
      <td>${esc(r.AGENTE)}</td>
      <td>${esc(r.ID_CLIENTE)}</td>
      <td>${esc(r.ID_IMMOBILE)}</td>
      <td><span class="badge">${esc(r.STATO_EVENTO)}</span></td>
      <td class="actions">
        <button class="btn btn-ghost" data-act="Fatto">Segna fatto</button>
        <button class="btn btn-ghost" data-act="Annullato">Annulla</button>
      </td>`;
    tr.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> updateEventoStato(r.ID_EVENTO, b.dataset.act));
    });
    tb.appendChild(tr);
  });
}

$("btnOpenAddEvento").onclick = ()=>{
  modalOpen("Nuovo Evento (genera attività)", `
    <div class="grid2">
      <label>Tipo evento
        <select id="evTipo">
          <option>Appuntamento vendita</option><option>Appuntamento acquisizione</option>
          <option>Follow-up</option><option>Visita</option><option>Altro</option>
        </select>
      </label>
      <label>Titolo <input id="evTit" /></label>
      <label>ID Cliente (opz.) <input id="evCli" placeholder="CL-000001"/></label>
      <label>ID Immobile (opz.) <input id="evImm" placeholder="IM-000001"/></label>
      <label>Data inizio <input id="evDi" type="date"/></label>
      <label>Ora inizio <input id="evOi" type="time"/></label>
      <label>Data fine <input id="evDf" type="date"/></label>
      <label>Ora fine <input id="evOf" type="time"/></label>
    </div>
    <label>Luogo <input id="evLuogo" /></label>
    <label>Note <textarea id="evNote"></textarea></label>
    <label class="row"><input id="evGen" type="checkbox" checked /> Crea attività automaticamente</label>
  `, `<button id="evSave" class="btn">Salva evento</button>`);
  $("evSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      await api("addEvento", {
        tipoEvento: $("evTipo").value,
        titolo: $("evTit").value,
        idCliente: $("evCli").value.trim(),
        idImmobile: $("evImm").value.trim(),
        dataInizio: $("evDi").value,
        oraInizio: $("evOi").value,
        dataFine: $("evDf").value,
        oraFine: $("evOf").value,
        luogo: $("evLuogo").value,
        note: $("evNote").value,
        generaAttivita: $("evGen").checked ? "SI" : "NO"
      });
      $("modalMsg").textContent="OK ✅";
      await refreshEventi();
      setTimeout(modalClose, 350);
    }catch(e){ $("modalMsg").textContent=e.message; }
  };
};

async function updateEventoStato(idEvento, stato){
  await api("updateEventoStato", { idEvento, stato });
  await refreshEventi();
}