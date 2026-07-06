import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const nomeInput = document.getElementById("nomeInput");
const entrarBtn = document.getElementById("entrarBtn");
const filaLista = document.getElementById("filaLista");
const emAtendimento = document.getElementById("emAtendimento");
const meuStatus = document.getElementById("meuStatus");
const sairFilaArea = document.getElementById("sairFilaArea");
const sairFilaBtn = document.getElementById("sairFilaBtn");
const statusBarbeariaPublico = document.getElementById("statusBarbeariaPublico");

const TEMPO_CORTE = 20;

let barbeariaAberta = true;
let meuId = localStorage.getItem("meuIdBarbearia20Bib");
let meuNomeSalvo = localStorage.getItem("meuNomeBarbearia20Bib");
let todosGlobal = [];

async function limparSistemaNovoDia() {
 const hoje = "07/07/2026";
  const controleRef = doc(db, "config", "controleDia");

  try {
    const controleSnap = await getDoc(controleRef);
    const ultimoDia = controleSnap.exists()
      ? controleSnap.data().ultimoDia
      : null;

    if (ultimoDia === hoje) {
      return;
    }

    const filaSnapshot = await getDocs(collection(db, "fila"));
    const batch = writeBatch(db);

    filaSnapshot.forEach((registro) => {
      batch.delete(doc(db, "fila", registro.id));
    });

    await batch.commit();

    await setDoc(controleRef, {
      ultimoDia: hoje
    });

    localStorage.removeItem("meuIdBarbearia20Bib");
    localStorage.removeItem("meuNomeBarbearia20Bib");

    meuId = null;
    meuNomeSalvo = null;

    console.log("Sistema zerado automaticamente para um novo dia.");
  } catch (erro) {
    console.error("Erro ao limpar sistema do novo dia:", erro);
  }
}

await limparSistemaNovoDia();

if (meuNomeSalvo) {
  nomeInput.value = meuNomeSalvo;
}

onSnapshot(doc(db, "config", "barbearia"), (docSnap) => {
  if (docSnap.exists()) {
    barbeariaAberta = docSnap.data().aberta === true;
  }

  atualizarStatusBarbearia();
});

function atualizarStatusBarbearia() {
  if (barbeariaAberta) {
    statusBarbeariaPublico.className = "card destaque";
    statusBarbeariaPublico.innerHTML = `
      <h2>🟢 Barbearia aberta</h2>
      <p>Você pode entrar na fila normalmente.</p>
    `;
    entrarBtn.disabled = false;
  } else {
    statusBarbeariaPublico.className = "card destaque alerta";
    statusBarbeariaPublico.innerHTML = `
      <h2>🔴 Barbearia fechada</h2>
      <p>O atendimento está encerrado no momento.</p>
    `;
    entrarBtn.disabled = true;
  }
}

entrarBtn.addEventListener("click", async () => {
  if (!barbeariaAberta) {
    alert("A barbearia está fechada no momento.");
    return;
  }

  const nome = nomeInput.value.trim();

  if (!nome) {
    alert("Digite seu nome e graduação.");
    return;
  }

  const jaEstaNaFila = todosGlobal.some(p =>
    p.nome.toLowerCase() === nome.toLowerCase() &&
    (p.status === "aguardando" || p.status === "em_atendimento")
  );

  if (jaEstaNaFila) {
    alert("Você já está na fila.");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "fila"), {
      nome: nome,
      status: "aguardando",
      criadoEm: serverTimestamp(),
      inicioAtendimento: null,
      fimAtendimento: null
    });

    meuId = docRef.id;

    localStorage.setItem("meuIdBarbearia20Bib", meuId);
    localStorage.setItem("meuNomeBarbearia20Bib", nome);

    alert("Você entrou na fila!");
  } catch (error) {
    console.error(error);
    alert("Erro ao entrar na fila.");
  }
});

sairFilaBtn.addEventListener("click", async () => {
  if (!meuId) return;

  const confirmar = confirm("Tem certeza que deseja sair da fila?");
  if (!confirmar) return;

  try {
    await updateDoc(doc(db, "fila", meuId), {
      status: "desistiu",
      fimAtendimento: serverTimestamp()
    });

    localStorage.removeItem("meuIdBarbearia20Bib");
    meuId = null;

    alert("Você saiu da fila.");
  } catch (error) {
    console.error(error);
    alert("Erro ao sair da fila.");
  }
});
function formatarHora(timestamp) {
  if (!timestamp) return "--:--";

  const data = timestamp.toDate();

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatarTempo(minutos) {
  if (minutos <= 0) return "Agora";
  if (minutos < 60) return `${minutos} minutos`;

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;

  return mins === 0 ? `${horas}h` : `${horas}h${mins}`;
}

const filaQuery = query(
  collection(db, "fila"),
  orderBy("criadoEm", "asc")
);

onSnapshot(filaQuery, (snapshot) => {
  const todos = [];

  snapshot.forEach((docItem) => {
    todos.push({
      id: docItem.id,
      ...docItem.data()
    });
  });

  todosGlobal = todos;

  const aguardando = todos.filter(
    p => p.status === "aguardando"
  );

  const atendimento = todos.find(
    p => p.status === "em_atendimento"
  );

  atualizarAtendimento(atendimento);
  atualizarFila(aguardando);
  atualizarMeuStatus(todos, aguardando, atendimento);
});

function atualizarAtendimento(pessoa) {
  if (!pessoa) {
    emAtendimento.innerHTML =
      "Nenhum atendimento iniciado.";
    return;
  }

  emAtendimento.innerHTML = `
    <div class="item-fila item-atendimento">
      <strong>${pessoa.nome}</strong>

      <div class="status-texto">
        Iniciado às ${formatarHora(
          pessoa.inicioAtendimento
        )}
      </div>

    </div>
  `;
}

function atualizarFila(aguardando) {

  if (aguardando.length === 0) {
    filaLista.innerHTML =
      "Nenhuma pessoa aguardando.";
    return;
  }

  filaLista.innerHTML = "";

  aguardando.forEach((pessoa, index) => {

    const item = document.createElement("div");

    item.className = "item-fila";

    item.innerHTML = `
      <strong>${index + 1}º - ${pessoa.nome}</strong>

      <div class="status-texto">
        Entrada:
        ${formatarHora(pessoa.criadoEm)}
      </div>
    `;

    filaLista.appendChild(item);

  });

}

function atualizarMeuStatus(
  todos,
  aguardando,
  atendimento
) {

  if (!meuId) {

    meuStatus.classList.add("escondido");
    sairFilaArea.classList.add("escondido");

    return;

  }

  const minhaPessoa = todos.find(
    p => p.id === meuId
  );

  if (!minhaPessoa) {

    meuStatus.classList.add("escondido");
    sairFilaArea.classList.add("escondido");

    return;

  }

  meuStatus.classList.remove("escondido");

  if (minhaPessoa.status === "aguardando") {

    sairFilaArea.classList.remove("escondido");

    const posicao =
      aguardando.findIndex(
        p => p.id === meuId
      ) + 1;

    const pessoasNaFrente =
      posicao - 1;

    const tempoEstimado =
      pessoasNaFrente * TEMPO_CORTE;

    if (posicao === 1 && !atendimento) {

      meuStatus.className =
        "card destaque alerta";

      meuStatus.innerHTML = `
        <h2>✂️ Você é o primeiro da fila</h2>

        <p>
          Aguarde o barbeiro iniciar
          o atendimento.
        </p>
      `;

      return;

    }

    if (posicao === 1 && atendimento) {

      meuStatus.className =
        "card destaque alerta";

      meuStatus.innerHTML = `
        <h2>🔔 ATENÇÃO!</h2>

        <p>
          Você será o próximo após
          o atendimento atual.
        </p>

        <p>
          Fique preparado para ir
          à barbearia.
        </p>
      `;

      return;

    }

    meuStatus.className =
      "card destaque";

    meuStatus.innerHTML = `
      <h2>Você está na fila</h2>

      <p><strong>Nome:</strong> ${minhaPessoa.nome}</p>

      <p><strong>Entrada:</strong>
      ${formatarHora(minhaPessoa.criadoEm)}</p>

      <p><strong>Posição:</strong>
      ${posicao}º</p>

      <p><strong>Pessoas na frente:</strong>
      ${pessoasNaFrente}</p>

      <p><strong>Tempo estimado:</strong>
      ${formatarTempo(tempoEstimado)}</p>

      <p><strong>Status:</strong>
      Aguardando</p>
    `;
  }

  if (minhaPessoa.status === "em_atendimento") {

    sairFilaArea.classList.add("escondido");

    meuStatus.className =
      "card destaque alerta";

    meuStatus.innerHTML = `
      <h2>✂️ Em atendimento</h2>

      <p>Seu corte começou.</p>
    `;
  }

  if (minhaPessoa.status === "finalizado") {

    sairFilaArea.classList.add("escondido");

    meuStatus.className =
      "card destaque";

    meuStatus.innerHTML = `
      <h2>✅ Atendimento concluído</h2>

      <p>Seu corte foi finalizado.</p>
    `;
  }

  if (minhaPessoa.status === "nao_apareceu") {

    sairFilaArea.classList.add("escondido");

    meuStatus.className =
      "card destaque alerta";

    meuStatus.innerHTML = `
      <h2>⚠️ Não compareceu</h2>

      <p>
        Você foi marcado como
        não compareceu.
      </p>
    `;
  }

  if (minhaPessoa.status === "desistiu") {

    sairFilaArea.classList.add("escondido");

    meuStatus.className =
      "card destaque";

    meuStatus.innerHTML = `
      <h2>🚪 Você saiu da fila</h2>

      <p>
        Para entrar novamente,
        digite seu nome e clique
        em entrar na fila.
      </p>
    `;
  }
}