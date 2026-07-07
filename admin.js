import { db, auth } from "./firebase-config.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const loginArea = document.getElementById("loginArea");
const painelAdmin = document.getElementById("painelAdmin");
const emailInput = document.getElementById("emailInput");
const senhaInput = document.getElementById("senhaInput");
const loginBtn = document.getElementById("loginBtn");
const loginErro = document.getElementById("loginErro");
const logoutBtn = document.getElementById("logoutBtn");

const adminAtendimento = document.getElementById("adminAtendimento");
const adminFila = document.getElementById("adminFila");
const finalizados = document.getElementById("finalizados");
const naoCompareceram = document.getElementById("naoCompareceram");

const statusBarbeariaAdmin = document.getElementById("statusBarbeariaAdmin");
const abrirBarbeariaBtn = document.getElementById("abrirBarbeariaBtn");
const fecharBarbeariaBtn = document.getElementById("fecharBarbeariaBtn");

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const senha = senhaInput.value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    loginErro.textContent = "";
  } catch (error) {
    console.error("Erro no login:", error.code, error.message);
    loginErro.textContent = "Erro: " + error.code;
  }
});

logoutBtn.addEventListener("click", async () => {
  const confirmar = confirm("Deseja realmente sair do painel?");

  if (!confirmar) return;

  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginArea.classList.add("escondido");
    painelAdmin.classList.remove("escondido");
    iniciarPainel();
  } else {
    loginArea.classList.remove("escondido");
    painelAdmin.classList.add("escondido");
  }
});

function iniciarPainel() {
  const configRef = doc(db, "config", "barbearia");

  onSnapshot(configRef, (docSnap) => {
    if (!docSnap.exists()) {
      statusBarbeariaAdmin.innerHTML = "Configuração não encontrada.";
      return;
    }

    const aberta = docSnap.data().aberta === true;

    if (aberta) {
      statusBarbeariaAdmin.innerHTML = "🟢 Status atual: BARBEARIA ABERTA";
      abrirBarbeariaBtn.disabled = true;
      fecharBarbeariaBtn.disabled = false;
    } else {
      statusBarbeariaAdmin.innerHTML = "🔴 Status atual: BARBEARIA FECHADA";
      abrirBarbeariaBtn.disabled = false;
      fecharBarbeariaBtn.disabled = true;
    }
  });

  abrirBarbeariaBtn.addEventListener("click", async () => {
    await updateDoc(configRef, {
      aberta: true
    });
  });

  fecharBarbeariaBtn.addEventListener("click", async () => {
    const confirmar = confirm("Tem certeza que deseja fechar a barbearia?");

    if (!confirmar) return;

    await updateDoc(configRef, {
      aberta: false
    });
  });

  const filaQuery = query(collection(db, "fila"), orderBy("criadoEm", "asc"));

  onSnapshot(filaQuery, (snapshot) => {
    const todos = [];

    snapshot.forEach((docSnap) => {
      todos.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    const aguardando = todos.filter(p => p.status === "aguardando");
    const atendimento = todos.find(p => p.status === "em_atendimento");
    const listaFinalizados = todos.filter(p => p.status === "finalizado");
    const listaNaoCompareceram = todos.filter(p => p.status === "nao_apareceu");

    atualizarAtendimento(atendimento);
    atualizarFila(aguardando, atendimento);
    atualizarHistorico(listaFinalizados, listaNaoCompareceram);
  });
}

function formatarHora(timestamp) {
  if (!timestamp) return "--:--";

  const data = timestamp.toDate();

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function atualizarAtendimento(pessoa) {
  if (!pessoa) {
    adminAtendimento.innerHTML = "Nenhum atendimento iniciado.";
    return;
  }

  adminAtendimento.innerHTML = `
    <div class="item-fila item-atendimento">
      <strong>${pessoa.nome}</strong>
      <div class="status-texto">
        Entrada: ${formatarHora(pessoa.criadoEm)}<br>
        Início: ${formatarHora(pessoa.inicioAtendimento)}
      </div>

      <button onclick="finalizarCorte('${pessoa.id}')">
        Finalizar corte
      </button>
    </div>
  `;
}

function atualizarFila(aguardando, atendimento) {
  if (aguardando.length === 0) {
    adminFila.innerHTML = "Nenhuma pessoa aguardando.";
    return;
  }

  adminFila.innerHTML = "";

  aguardando.forEach((pessoa, index) => {
    const item = document.createElement("div");
    item.className = "item-fila";

    const podeIniciar = !atendimento;

    item.innerHTML = `
      <strong>${index + 1}º - ${pessoa.nome}</strong>
      <div class="status-texto">
        Entrada: ${formatarHora(pessoa.criadoEm)}
      </div>

      ${
        podeIniciar
          ? `<button class="btn-azul" onclick="iniciarAtendimento('${pessoa.id}')">Iniciar atendimento</button>`
          : `<button disabled>Já existe atendimento em andamento</button>`
      }

      <button class="btn-vermelho" onclick="naoApareceu('${pessoa.id}')">
        Não apareceu
      </button>
    `;

    adminFila.appendChild(item);
  });
}

function atualizarHistorico(listaFinalizados, listaNaoCompareceram) {
  document.getElementById("tituloFinalizados").textContent =
    `✅ Cortes finalizados: ${listaFinalizados.length}`;

  document.getElementById("tituloNaoCompareceram").textContent =
    `⚠️ Não compareceram: ${listaNaoCompareceram.length}`;

  finalizados.innerHTML = "";

  if (listaFinalizados.length === 0) {
    finalizados.innerHTML = "Nenhum corte finalizado hoje.";
  } else {
    listaFinalizados.forEach((pessoa) => {
      const item = document.createElement("div");
      item.className = "item-fila item-finalizado";

      item.innerHTML = `
        <strong>${pessoa.nome}</strong>
        <div class="status-texto">
          Entrada: ${formatarHora(pessoa.criadoEm)}<br>
          Início: ${formatarHora(pessoa.inicioAtendimento)}<br>
          Finalizado: ${formatarHora(pessoa.fimAtendimento)}
        </div>
      `;

      finalizados.appendChild(item);
    });
  }

  naoCompareceram.innerHTML = "";

  if (listaNaoCompareceram.length === 0) {
    naoCompareceram.innerHTML = "Nenhuma ausência registrada.";
  } else {
    listaNaoCompareceram.forEach((pessoa) => {
      const item = document.createElement("div");
      item.className = "item-fila item-nao";

      item.innerHTML = `
        <strong>${pessoa.nome}</strong>
        <div class="status-texto">
          Entrada: ${formatarHora(pessoa.criadoEm)}
        </div>
      `;

      naoCompareceram.appendChild(item);
    });
  }
}

window.iniciarAtendimento = async function(id) {
  try {
    await updateDoc(doc(db, "fila", id), {
      status: "em_atendimento",
      inicioAtendimento: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    alert("Erro ao iniciar atendimento.");
  }
};

window.finalizarCorte = async function(id) {
  try {
    await updateDoc(doc(db, "fila", id), {
      status: "finalizado",
      fimAtendimento: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    alert("Erro ao finalizar corte.");
  }
};

window.naoApareceu = async function(id) {
  const confirmar = confirm("Tem certeza que deseja marcar como não apareceu?");

  if (!confirmar) return;

  try {
    await updateDoc(doc(db, "fila", id), {
      status: "nao_apareceu",
      fimAtendimento: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    alert("Erro ao marcar ausência.");
  }
};