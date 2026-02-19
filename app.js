const API_URL = "https://script.google.com/macros/s/AKfycbyYbaHrglaE0oRGEiRaCfGEjRcRtowwTK2TFYD74oxxIs0q65X23LZWX0t0gV0CZ_sM/exec";

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
    ["clienti","immobili"].forEach(x=> show($("tab-"+x), x===t));
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

/** =========================
 * CLIENTI
 * ========================= */
$("btnSearchClienti").onclick = refreshClienti;

async function refreshClienti(){
  const q = $("qCliente").value.trim();
  const tipo = $("tipoCliente").value.trim();
  const rows = await api("searchClienti", { q, tipo });
  const tb = $("tblClienti").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const res = [
      r.RESIDENZA_INDIRIZZO, r.RESIDENZA_CAP, r.RESIDENZA_CITTA, r.RESIDENZA_PROVINCIA
    ].filter(Boolean).join(" ");

    const immCount = Number(r.IMMOBILI_COUNT || 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_CLIENTE)}</td>
      <td><span class="badge">${esc(r.TIPO_CLIENTE)}</span></td>
      <td>${esc(r.NOME)}</td>
      <td>${esc(r.COGNOME)}</td>
      <td>${esc(r.TELEFONO)}</td>
      <td>${esc(r.EMAIL)}</td>
      <td class="small">${esc(res)}</td>
      <td>${immCount ? `<span class="badge">Immobili: ${immCount}</span>` : `<span class="badge">Immobili: 0</span>`}</td>
      <td>${esc(r.OWNER_AGENT)}</td>
      <td class="actions">
        <button class="btn btn-ghost" data-act="edit">Modifica</button>
        <button class="btn btn-ghost" data-act="addAct">+ Attività</button>
        <button class="btn btn-ghost" data-act="viewAct">Vedi attività</button>
        <button class="btn btn-ghost" data-act="props">Vedi immobili</button>
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

    <div class="card subtle" style="margin-top:12px">
      <h3 style="margin:0 0 10px 0">Residenza</h3>
      <div class="grid2">
        <label>Indirizzo <input id="rInd" /></label>
        <label>CAP <input id="rCap" /></label>
        <label>Città <input id="rCitta" /></label>
        <label>Provincia <input id="rProv" placeholder="es. MI, RM" /></label>
      </div>
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
        resIndirizzo: $("rInd").value,
        resCap: $("rCap").value,
        resCitta: $("rCitta").value,
        resProvincia: $("rProv").value,
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
    show($("clienteImmobiliBox"), false);
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

        <label>Residenza indirizzo <input id="eRInd" value="${esc(row.RESIDENZA_INDIRIZZO||"")}"/></label>
        <label>Residenza CAP <input id="eRCap" value="${esc(row.RESIDENZA_CAP||"")}"/></label>
        <label>Residenza città <input id="eRCitta" value="${esc(row.RESIDENZA_CITTA||"")}"/></label>
        <label>Residenza provincia <input id="eRProv" value="${esc(row.RESIDENZA_PROVINCIA||"")}"/></label>
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
          resIndirizzo: $("eRInd").value,
          resCap: $("eRCap").value,
          resCitta: $("eRCitta").value,
          resProvincia: $("eRProv").value,
          note: $("eNote").value
        });
        $("modalMsg").textContent="OK ✅";
        await refreshClienti();
        setTimeout(modalClose, 350);
      }catch(e){ $("modalMsg").textContent=e.message; }
    };
  }
  if (act==="props"){
    currentClienteId = row.ID_CLIENTE;
    show($("clienteActivities"), true);
    show($("clienteImmobiliBox"), true);
    $("clienteImmobiliTitle").textContent = `Immobili di proprietà — ${row.NOME} ${row.COGNOME} (${row.ID_CLIENTE})`;
    await refreshClienteImmobili(row.ID_CLIENTE);
  }
}

$("btnCloseClienteAct").onclick = ()=> show($("clienteActivities"), false);
$("btnCloseClienteImmobili").onclick = ()=> show($("clienteImmobiliBox"), false);
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

async function refreshClienteImmobili(idCliente){
  const rows = await api("listImmobiliByCliente", { idCliente });
  const tb = $("tblClienteImmobili").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_IMMOBILE)}</td>
      <td>${esc(r.TIPO_IMMOBILE)}</td>
      <td>${esc(r.INDIRIZZO)}</td>
      <td>${esc(r.CITTA)}</td>
      <td>${esc(r.PROVINCIA)}</td>
      <td>${esc(r.ZONA)}</td>
      <td>${esc(r.TIPOLOGIA)}</td>`;
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

/** =========================
 * IMMOBILI
 * ========================= */
$("btnSearchImmobili").onclick = refreshImmobili;

async function refreshImmobili(){
  const q = $("qImmobile").value.trim();
  const tipo = $("tipoImmobile").value.trim();
  const rows = await api("searchImmobili", { q, tipo });
  const tb = $("tblImmobili").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r=>{
    const owners = (r.PROPRIETARI_NOMI || "").trim() || "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(r.ID_IMMOBILE)}</td>
      <td><span class="badge">${esc(r.TIPO_IMMOBILE)}</span></td>
      <td>${esc(r.INDIRIZZO)}</td>
      <td>${esc(r.CITTA)}</td>
      <td>${esc(r.PROVINCIA)}</td>
      <td>${esc(r.ZONA)}</td>
      <td>${esc(r.TIPOLOGIA)}</td>
      <td class="small">${esc(owners)}</td>
      <td>${esc(r.RESPONSABILE)}</td>
      <td class="actions">
        <button class="btn btn-ghost" data-act="edit">Modifica</button>
        <button class="btn btn-ghost" data-act="owners">Proprietari</button>
        <button class="btn btn-ghost" data-act="addAct">+ Attività</button>
        <button class="btn btn-ghost" data-act="viewAct">Vedi attività</button>
      </td>`;
    tr.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> onImmobileAction(b.dataset.act, r));
    });
    tb.appendChild(tr);
  });
}

let selectedOwners = []; // [{id, nome, cognome}]
function ownersSummary(){
  if (!selectedOwners.length) return "-";
  return selectedOwners.map(o=>`${o.nome} ${o.cognome}`.trim()).filter(Boolean).join(", ");
}

async function openOwnerPicker(){
  modalOpen("Seleziona Proprietari (max 5)", `
    <div class="filters">
      <input id="pQ" placeholder="Cerca cliente (nome/cognome/telefono/email)..." />
      <button id="pSearch" class="btn btn-ghost" type="button">Cerca</button>
    </div>

    <div class="card subtle" style="margin-top:12px">
      <b>Selezionati:</b>
      <div id="pSelected" class="row"></div>
    </div>

    <div class="tableWrap" style="margin-top:12px">
      <table class="table">
        <thead><tr><th>Nome</th><th>Cognome</th><th>Telefono</th><th>Email</th><th></th></tr></thead>
        <tbody id="pTB"></tbody>
      </table>
    </div>
    <p class="muted" style="margin-top:10px">Clicca “Aggiungi” per selezionare (max 5).</p>
  `, `<button id="pDone" class="btn">Fatto</button>`);

  const renderSelected = ()=>{
    const box = $("pSelected");
    box.innerHTML = "";
    selectedOwners.forEach((o, idx)=>{
      const chip = document.createElement("span");
      chip.className="badge";
      chip.style.cursor="pointer";
      chip.textContent = `${o.nome} ${o.cognome} ✕`;
      chip.onclick = ()=>{
        selectedOwners.splice(idx,1);
        renderSelected();
      };
      box.appendChild(chip);
    });
    if (!selectedOwners.length) {
      const s = document.createElement("span");
      s.className="muted";
      s.textContent="Nessuno";
      box.appendChild(s);
    }
  };

  const render = (rows)=>{
    const tb = $("pTB");
    tb.innerHTML = "";
    rows.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(r.NOME)}</td>
        <td>${esc(r.COGNOME)}</td>
        <td>${esc(r.TELEFONO)}</td>
        <td>${esc(r.EMAIL)}</td>
        <td><button class="btn btn-ghost" type="button">Aggiungi</button></td>
      `;
      tr.querySelector("button").onclick = ()=>{
        if (selectedOwners.length >= 5) { $("modalMsg").textContent="Hai già 5 proprietari."; return; }
        const id = String(r.ID_CLIENTE).trim();
        const already = selectedOwners.some(x=>String(x.id).trim()===id);
        if (already) { $("modalMsg").textContent="Già selezionato."; return; }
        selectedOwners.push({ id, nome: r.NOME||"", cognome: r.COGNOME||"" });
        $("modalMsg").textContent="Aggiunto ✅";
        renderSelected();
      };
      tb.appendChild(tr);
    });
  };

  $("pSearch").onclick = async ()=>{
    $("modalMsg").textContent = "Cerco…";
    const q = $("pQ").value.trim();
    const rows = await api("searchClienti", { q, tipo: "" });
    render(rows);
    $("modalMsg").textContent = "";
  };

  $("pDone").onclick = ()=> modalClose();

  renderSelected();
  const rows = await api("searchClienti", { q: "", tipo: "" });
  render(rows);
}

$("btnOpenAddImmobile").onclick = ()=>{
  selectedOwners = [];
  modalOpen("Aggiungi Immobile", `
    <div class="grid2">
      <label>Tipo
        <select id="imTipo">
          <option>Normale</option><option>Traccia</option><option>Futura Notizia</option>
          <option>Ex Notizia</option><option>Notizia</option>
        </select>
      </label>

      <label>Responsabile
        <input id="imResp" placeholder="es. Mario Rossi"/>
      </label>

      <label>Indirizzo <input id="imInd" /></label>
      <label>Città <input id="imCitta" /></label>

      <label>Provincia <input id="imProv" placeholder="es. MI, RM"/></label>
      <label>Zona <input id="imZona" /></label>

      <label>Tipologia
        <select id="imTipologia">
          <option>Casa</option>
          <option>Appartamento</option>
          <option>Terreno</option>
          <option>Rustico</option>
          <option>Palazzina</option>
        </select>
      </label>

      <label>Dati catastali
        <input id="imCat" placeholder="Foglio / Particella / Subalterno..." />
      </label>
    </div>

    <div class="card subtle" style="margin-top:12px">
      <div class="panelHead">
        <h3 style="margin:0">Proprietari (max 5)</h3>
        <button id="btnPickOwner" class="btn btn-ghost" type="button">Seleziona clienti</button>
      </div>
      <p class="muted">Selezionati: <span id="ownSummary">-</span></p>
    </div>

    <label>Note <textarea id="imNote"></textarea></label>
  `, `<button id="imSave" class="btn">Salva</button>`);

  $("btnPickOwner").onclick = async ()=>{
    await openOwnerPicker();
    $("ownSummary").textContent = ownersSummary();
  };

  $("imSave").onclick = async ()=>{
    try{
      $("modalMsg").textContent="Salvataggio...";
      const owners = selectedOwners.map(o=>o.id);
      await api("addImmobile", {
        tipoImmobile: $("imTipo").value,
        responsabile: $("imResp").value,
        indirizzo: $("imInd").value,
        citta: $("imCitta").value,
        provincia: $("imProv").value,
        zona: $("imZona").value,
        tipologia: $("imTipologia").value,
        datiCatastali: $("imCat").value,
        proprietario1: owners[0] || "",
        proprietario2: owners[1] || "",
        proprietario3: owners[2] || "",
        proprietario4: owners[3] || "",
        proprietario5: owners[4] || "",
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
  if (act==="owners"){
    modalOpen("Proprietari immobile", `
      <p><b>Immobile:</b> ${esc(row.ID_IMMOBILE)} - ${esc(row.INDIRIZZO)}</p>
      <p><b>Proprietari:</b> ${esc(row.PROPRIETARI_NOMI || "-")}</p>
      <p class="muted">Per modificarli: apri “Modifica” e re-seleziona i clienti.</p>
    `, `<button class="btn btn-ghost" id="mOk">OK</button>`);
    $("mOk").onclick = modalClose;
  }
  if (act==="edit"){
    selectedOwners = Array.isArray(row.PROPRIETARI_LIST)
      ? row.PROPRIETARI_LIST.map(o=>({id:o.id, nome:o.nome, cognome:o.cognome}))
      : [];

    modalOpen("Modifica Immobile (base)", `
      <div class="grid2">
        <label>Responsabile <input id="ieResp" value="${esc(row.RESPONSABILE)}"/></label>
        <label>Zona <input id="ieZona" value="${esc(row.ZONA)}"/></label>

        <label>Provincia <input id="ieProv" value="${esc(row.PROVINCIA||"")}"/></label>
        <label>Tipologia
          <select id="ieTipo">
            <option ${row.TIPOLOGIA==="Casa"?"selected":""}>Casa</option>
            <option ${row.TIPOLOGIA==="Appartamento"?"selected":""}>Appartamento</option>
            <option ${row.TIPOLOGIA==="Terreno"?"selected":""}>Terreno</option>
            <option ${row.TIPOLOGIA==="Rustico"?"selected":""}>Rustico</option>
            <option ${row.TIPOLOGIA==="Palazzina"?"selected":""}>Palazzina</option>
          </select>
        </label>

        <label>Dati catastali <input id="ieCat" value="${esc(row.DATI_CATASTALI||"")}"/></label>
      </div>

      <div class="card subtle" style="margin-top:12px">
        <div class="panelHead">
          <h3 style="margin:0">Proprietari (max 5)</h3>
          <button id="btnPickOwner2" class="btn btn-ghost" type="button">Seleziona clienti</button>
        </div>
        <p class="muted">Selezionati: <span id="ownSummary2">${esc(ownersSummary())}</span></p>
      </div>

      <label>Note <textarea id="ieNote">${esc(row.NOTE_IMMOBILE||"")}</textarea></label>
    `, `<button id="ieSave" class="btn">Salva</button>`);

    $("btnPickOwner2").onclick = async ()=>{
      await openOwnerPicker();
      $("ownSummary2").textContent = ownersSummary();
    };

    $("ieSave").onclick = async ()=>{
      try{
        $("modalMsg").textContent="Salvataggio...";
        const owners = selectedOwners.map(o=>o.id);
        await api("updateImmobileBase", {
          idImmobile: row.ID_IMMOBILE,
          responsabile: $("ieResp").value,
          zona: $("ieZona").value,
          provincia: $("ieProv").value,
          tipologia: $("ieTipo").value,
          datiCatastali: $("ieCat").value,
          proprietario1: owners[0] || "",
          proprietario2: owners[1] || "",
          proprietario3: owners[2] || "",
          proprietario4: owners[3] || "",
          proprietario5: owners[4] || "",
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
