
/* Gerenciador Financeiro — dados salvos localmente neste navegador */

const KEYS = {
  transactions: "gerenciadorFinanceiroTransacoes",
  budgets: "gerenciadorFinanceiroOrcamentos",
  goals: "gerenciadorFinanceiroMetas",
  bills: "gerenciadorFinanceiroContas",
  settings: "gerenciadorFinanceiroConfiguracoes"
};

function read(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

let transactions = read(KEYS.transactions);
let budgets = read(KEYS.budgets);
let goals = read(KEYS.goals);
let bills = read(KEYS.bills);
let settings = read(KEYS.settings, {
  name: "Amiga",
  currency: "BRL"
});

if (!Array.isArray(transactions)) transactions = [];
if (!Array.isArray(budgets)) budgets = [];
if (!Array.isArray(goals)) goals = [];
if (!Array.isArray(bills)) bills = [];

let activeView = "Início";
let searchTerm = "";
let typeFilter = "all";
let monthFilter = todayMonth();
let reportMonth = todayMonth();

const categories = [
  "Salário",
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Cartomancia",
  "Contas",
  "Compras",
  "Outros"
];

const money = n =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: settings.currency || "BRL"
  });

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const uid = () =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayMonth() {
  return today().slice(0, 7);
}

const monthOf = date => String(date || "").slice(0, 7);

function monthName(month) {
  if (!month) return "todos os meses";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

const monthTransactions = month =>
  transactions.filter(t => monthOf(t.date) === month);

const sum = (items, type) =>
  items
    .filter(t => !type || t.type === type)
    .reduce((a, t) => a + Number(t.value || 0), 0);

const dateBR = date =>
  date ? String(date).split("-").reverse().join("/") : "—";

function persist() {
  localStorage.setItem(KEYS.transactions, JSON.stringify(transactions));
  localStorage.setItem(KEYS.budgets, JSON.stringify(budgets));
  localStorage.setItem(KEYS.goals, JSON.stringify(goals));
  localStorage.setItem(KEYS.bills, JSON.stringify(bills));
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

function navItems() {
  return [
    "Início",
    "Transações",
    "Orçamentos",
    "Metas financeiras",
    "Calendário de contas",
    "Relatórios",
    "Configurações"
  ];
}

function ensureUI() {
  const search = document.querySelector(".search-box");

  if (search && search.tagName !== "INPUT") {
    const input = document.createElement("input");
    input.className = "search-box";
    input.type = "search";
    input.placeholder = "⌕  Buscar transações...";

    input.addEventListener("input", e => {
      searchTerm = e.target.value.toLowerCase();
      if (activeView === "Transações") renderView();
    });

    search.replaceWith(input);
  }

  const nav = document.querySelector(".sidebar nav");

  if (nav) {
    nav.innerHTML = navItems().map((name, i) =>
      `<button type="button" class="nav-item ${name === activeView ? "active" : ""}" data-view="${name}">
        <span class="nav-icon">${["⌂", "↕", "▣", "♡", "▦", "▥", "⚙"][i]}</span>
        ${name}
      </button>`
    ).join("");

    // Navegação ligada diretamente ao menu, sem depender do clique no documento.
    nav.addEventListener("click", event => {
      const button = event.target.closest("button[data-view]");
      if (!button || !nav.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      activeView = button.dataset.view;
      renderView();
    });
  }

  let area = document.getElementById("dynamic-view");

  if (!area) {
    area = document.createElement("section");
    area.id = "dynamic-view";
    area.style.marginTop = "22px";
    document.querySelector(".main-area")?.appendChild(area);
  }

  document.getElementById("transaction-list")?.remove();

  const add = document.getElementById("add-transaction");
  if (add) add.addEventListener("click", () => openTransaction());

  updateDashboard();
  renderView();
}

function updateDashboard() {
  const current = todayMonth();
  const items = monthTransactions(current);

  const balance =
    sum(transactions, "income") - sum(transactions, "expense");

  const income = sum(items, "income");
  const expense = sum(items, "expense");

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("total-balance", money(balance));
  set("total-income", money(income));
  set("total-expenses", money(expense));
  set("monthly-result", money(income - expense));

  const empty = document.querySelector(
    ".content-grid .panel .empty-state"
  );

  if (empty) {
    empty.style.display = transactions.length ? "none" : "block";
  }

  const panel = document.querySelector(".content-grid .panel");

  if (panel) {
    let list = document.getElementById("transaction-list");

    if (!list) {
      list = document.createElement("div");
      list.id = "transaction-list";
      panel.appendChild(list);
    }

    list.innerHTML = [...transactions]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 5)
      .map(t => transactionRow(t, false))
      .join("");
  }

  const secondPanel =
    document.querySelectorAll(".content-grid .panel")[1];

  if (secondPanel) {
    const openBills = bills.filter(b => !b.paid).length;

    const upcoming = [...bills]
      .filter(b => !b.paid)
      .sort((a, b) =>
        (a.dueDate || "").localeCompare(b.dueDate || "")
      )
      .slice(0, 3);

    secondPanel.innerHTML = `
      <h3>Organização financeira ♡</h3>
      <p class="panel-description">
        Um passo de cada vez, no seu ritmo.
      </p>

      <div class="summary-grid"
        style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px">
        ${miniCard("Orçamentos", budgets.length)}
        ${miniCard("Metas", goals.length)}
        ${miniCard("Contas em aberto", openBills)}
      </div>

      <h3 style="margin-top:20px">Próximas contas</h3>

      ${upcoming.length
        ? upcoming.map(b => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <strong>${esc(b.name)}</strong>
            <div style="color:var(--secondary);font-size:12px;margin-top:4px">
              Vence ${dateBR(b.dueDate)} · ${money(b.value)}
            </div>
          </div>
        `).join("")
        : emptyState("♡", "Nenhuma conta pendente cadastrada.")
      }

      <button class="secondary-button"
        style="margin-top:12px"
        data-view="Calendário de contas">
        Ver calendário de contas
      </button>
    `;
  }
}

function transactionRow(t, showEdit = true) {
  return `
    <div class="transaction-row"
      style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid var(--border)">

      <div style="min-width:0">
        <strong>${esc(t.description)}</strong>
        <div style="color:var(--secondary);font-size:12px;margin-top:4px">
          ${esc(t.category)} · ${dateBR(t.date)}
        </div>
      </div>

      <div style="text-align:right;flex-shrink:0">
        <strong style="color:${t.type === "income" ? "var(--green)" : "var(--red)"}">
          ${t.type === "income" ? "+" : "−"} ${money(t.value)}
        </strong>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:5px">
          ${showEdit
            ? `<button class="text-action" data-edit="${esc(t.id)}">Editar</button>`
            : ""}
          <button class="text-action" data-delete="${esc(t.id)}">Excluir</button>
        </div>
      </div>
    </div>
  `;
}

function miniCard(label, value) {
  return `
    <div class="summary-card">
      <div class="card-top">${esc(label)}</div>
      <h3>${esc(value)}</h3>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><span>${icon}</span>${text}</div>`;
}

function panelHead(title, description, buttonLabel, action) {
  return `
    <div class="section-head">
      <div>
        <h3>${title}</h3>
        <p class="panel-description">${description}</p>
      </div>
      <button class="primary-button" data-action="${action}">
        ${buttonLabel}
      </button>
    </div>
  `;
}

function renderView() {
  const area = document.getElementById("dynamic-view");
  if (!area) return;

  // Ao entrar em uma seção, esconda os painéis fixos do Início para que
  // a tela selecionada apareça imediatamente, sem ficar abaixo do dashboard.
  const isHome = activeView === "Início";
  const main = document.querySelector(".main-area");
  if (main) {
    [".welcome", ".summary-grid", ".content-grid"].forEach(selector => {
      const section = main.querySelector(`:scope > ${selector}`);
      if (section) section.style.display = isHome ? "" : "none";
    });
  }
  area.style.display = "block";

  document.querySelectorAll(".sidebar nav .nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === activeView);
  });

  if (activeView === "Início") {
    area.innerHTML = `
      <article class="panel">
        <h3>Visão geral ♡</h3>
        <p class="panel-description">
          Resumo de ${esc(monthName(todayMonth()))}.
        </p>

        <div class="summary-grid"
          style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          ${miniCard("Transações", transactions.length)}
          ${miniCard("Orçamentos", budgets.length)}
          ${miniCard("Metas", goals.length)}
          ${miniCard("Contas pendentes", bills.filter(b => !b.paid).length)}
        </div>

        <p style="margin-top:16px;color:var(--secondary)">
          Seus dados ficam salvos neste navegador.
          Use o menu para organizar suas finanças.
        </p>
      </article>
    `;
  } else if (activeView === "Transações") {
    const items = transactions
      .filter(t =>
        (!searchTerm ||
          `${t.description} ${t.category} ${t.notes || ""}`
            .toLowerCase().includes(searchTerm)) &&
        (typeFilter === "all" || t.type === typeFilter) &&
        (!monthFilter || monthOf(t.date) === monthFilter)
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    area.innerHTML = `
      <article class="panel">
        ${panelHead(
          "Transações ♡",
          "Cadastre, pesquise, filtre, edite ou exclua movimentações.",
          "+ Nova transação",
          "add-transaction"
        )}

        <div class="filters">
          <input id="transaction-search" type="search"
            placeholder="Pesquisar descrição ou categoria"
            value="${esc(searchTerm)}">

          <select id="type-filter">
            <option value="all">Todos os tipos</option>
            <option value="income" ${typeFilter === "income" ? "selected" : ""}>Receitas</option>
            <option value="expense" ${typeFilter === "expense" ? "selected" : ""}>Despesas</option>
          </select>

          <input id="month-filter" type="month" value="${esc(monthFilter)}">

          <button class="secondary-button" data-action="clear-filters">
            Limpar filtros
          </button>

          <button class="secondary-button" data-action="export-csv">
            Exportar CSV
          </button>
        </div>

        <p class="panel-description">
          ${items.length} transação(ões) encontrada(s).
        </p>

        ${items.length
          ? items.map(t => transactionRow(t, true)).join("")
          : emptyState("🌷", "Nenhuma transação encontrada.")
        }
      </article>
    `;

    area.querySelector("#transaction-search").addEventListener("input", e => {
      searchTerm = e.target.value.toLowerCase();
      const pos = e.target.selectionStart;
      renderView();

      const el = area.querySelector("#transaction-search");
      el.focus();
      el.setSelectionRange(pos, pos);
    });

    area.querySelector("#type-filter").addEventListener("change", e => {
      typeFilter = e.target.value;
      renderView();
    });

    area.querySelector("#month-filter").addEventListener("change", e => {
      monthFilter = e.target.value;
      renderView();
    });

  } else if (activeView === "Orçamentos") {
    area.innerHTML = `
      <article class="panel">
        ${panelHead(
          "Orçamentos mensais ♡",
          "Defina limites por categoria e acompanhe os gastos do mês atual.",
          "+ Novo orçamento",
          "add-budget"
        )}

        ${budgets.length
          ? budgets.map(b => {
              const spent = sum(
                monthTransactions(todayMonth()).filter(
                  t => t.category === b.category
                ),
                "expense"
              );

              const pct = b.limit
                ? Math.min(100, spent / b.limit * 100)
                : 0;

              return `
                <div style="padding:15px 0;border-bottom:1px solid var(--border)">
                  <div class="section-head">
                    <strong>${esc(b.category)}</strong>
                    <span>${money(spent)} / ${money(b.limit)}</span>
                  </div>

                  <div class="progress-track">
                    <div class="progress-fill"
                      style="width:${pct}%;background:${spent > b.limit ? "var(--red)" : ""}">
                    </div>
                  </div>

                  <p class="panel-description" style="margin:7px 0 0">
                    ${spent > b.limit
                      ? "⚠️ Limite ultrapassado"
                      : `Restam ${money(Math.max(0, b.limit - spent))}`}
                    · ${Math.round(pct)}%
                  </p>

                  <div style="display:flex;gap:10px">
                    <button class="text-action" data-edit-budget="${esc(b.id)}">
                      Editar limite
                    </button>
                    <button class="text-action" data-delete-budget="${esc(b.id)}">
                      Excluir orçamento
                    </button>
                  </div>
                </div>
              `;
            }).join("")
          : emptyState("🌷", "Você ainda não criou orçamentos.")
        }
      </article>
    `;

  } else if (activeView === "Metas financeiras") {
    area.innerHTML = `
      <article class="panel">
        ${panelHead(
          "Metas financeiras ♡",
          "Defina objetivos, acompanhe o progresso e registre contribuições.",
          "+ Nova meta",
          "add-goal"
        )}

        ${goals.length
          ? goals.map(g => {
              const pct = g.target
                ? Math.min(100, g.saved / g.target * 100)
                : 0;

              return `
                <div style="padding:15px 0;border-bottom:1px solid var(--border)">
                  <div class="section-head">
                    <strong>${esc(g.name)}</strong>
                    <span>${Math.round(pct)}%</span>
                  </div>

                  <div class="progress-track">
                    <div class="progress-fill" style="width:${pct}%"></div>
                  </div>

                  <p class="panel-description" style="margin:7px 0">
                    ${money(g.saved)} guardados de ${money(g.target)}
                    ${g.deadline ? ` · prazo ${dateBR(g.deadline)}` : ""}
                  </p>

                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="secondary-button" data-contribute="${esc(g.id)}">
                      + Adicionar valor
                    </button>
                    <button class="text-action" data-edit-goal="${esc(g.id)}">
                      Editar
                    </button>
                    <button class="text-action" data-delete-goal="${esc(g.id)}">
                      Excluir
                    </button>
                  </div>
                </div>
              `;
            }).join("")
          : emptyState("♡", "Crie sua primeira meta financeira.")
        }
      </article>
    `;

  } else if (activeView === "Calendário de contas") {
    const sorted = [...bills].sort((a, b) =>
      (a.dueDate || "").localeCompare(b.dueDate || "")
    );

    area.innerHTML = `
      <article class="panel">
        ${panelHead(
          "Calendário de contas ♡",
          "Cadastre vencimentos e marque contas como pagas.",
          "+ Nova conta",
          "add-bill"
        )}

        <div class="filters">
          <select id="bill-filter">
            <option value="all">Todas as contas</option>
            <option value="open">Pendentes</option>
            <option value="paid">Pagas</option>
            <option value="overdue">Atrasadas</option>
          </select>
        </div>

        <div id="bill-list">${renderBills(sorted, "all")}</div>
      </article>
    `;

    area.querySelector("#bill-filter").addEventListener("change", e => {
      area.querySelector("#bill-list").innerHTML =
        renderBills(sorted, e.target.value);
    });

  } else if (activeView === "Relatórios") {
    const items = monthTransactions(reportMonth);
    const inc = sum(items, "income");
    const exp = sum(items, "expense");

    area.innerHTML = `
      <article class="panel">
        <h3>Relatórios financeiros ♡</h3>
        <p class="panel-description">
          Analise suas receitas, despesas e categorias por mês.
        </p>

        <div class="filters">
          <label style="align-self:center">
            Mês do relatório
            <input id="report-month" type="month" value="${esc(reportMonth)}">
          </label>

          <button class="secondary-button" data-action="export-csv">
            Exportar transações CSV
          </button>
        </div>

        <p style="color:var(--secondary);margin:8px 0 16px">
          ${esc(monthName(reportMonth))}
        </p>

        <div class="summary-grid"
          style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          ${miniCard("Receitas", money(inc))}
          ${miniCard("Despesas", money(exp))}
          ${miniCard("Resultado", money(inc - exp))}
        </div>

        <h3 style="margin-top:24px">Despesas por categoria</h3>
        ${categoryReport(reportMonth)}

        <h3 style="margin-top:24px">Resumo das movimentações</h3>

        ${items.length
          ? [...items]
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .map(t => transactionRow(t, false))
              .join("")
          : emptyState("🌷", "Cadastre transações neste mês para gerar o relatório.")
        }
      </article>
    `;

    area.querySelector("#report-month").addEventListener("change", e => {
      reportMonth = e.target.value || todayMonth();
      renderView();
    });

  } else {
    area.innerHTML = `
      <article class="panel">
        <h3>Configurações ♡</h3>
        <p class="panel-description">
          Personalize suas preferências.
        </p>

        <form id="settings-form" class="modal-card"
          style="max-width:none;box-shadow:none;padding:0;border:0;background:transparent">

          <label>
            Como gostaria de ser chamada?
            <input name="name" maxlength="50"
              value="${esc(settings.name || "")}" placeholder="Seu nome">
          </label>

          <label>
            Moeda utilizada
            <select name="currency">
              <option value="BRL" ${settings.currency === "BRL" ? "selected" : ""}>
                Real brasileiro (BRL)
              </option>
              <option value="USD" ${settings.currency === "USD" ? "selected" : ""}>
                Dólar americano (USD)
              </option>
              <option value="EUR" ${settings.currency === "EUR" ? "selected" : ""}>
                Euro (EUR)
              </option>
            </select>
          </label>

          <button class="primary-button" type="submit">
            Salvar preferências
          </button>
        </form>
      </article>
    `;

    area.querySelector("#settings-form").addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(e.target);

      settings = {
        ...settings,
        name: String(f.get("name") || "").trim(),
        currency: String(f.get("currency") || "BRL")
      };

      persist();
      updateDashboard();
      renderView();
      alert("Preferências salvas!");
    });
  }
}

function renderBills(items, filter) {
  const filtered = items.filter(b =>
    filter === "all" ||
    (filter === "paid" && b.paid) ||
    (filter === "open" && !b.paid) ||
    (filter === "overdue" && !b.paid && b.dueDate < today())
  );

  if (!filtered.length) {
    return emptyState("🌷", "Nenhuma conta corresponde a este filtro.");
  }

  return filtered.map(b => {
    const overdue = !b.paid && b.dueDate < today();

    return `
      <div style="padding:15px 0;border-bottom:1px solid var(--border)">
        <div class="section-head">
          <div>
            <strong>${esc(b.name)}</strong>
            <div style="font-size:12px;color:var(--secondary);margin-top:5px">
              ${esc(b.category || "Contas")} · Vencimento: ${dateBR(b.dueDate)}
            </div>
          </div>

          <strong style="color:${b.paid ? "var(--green)" : overdue ? "var(--red)" : "var(--text)"}">
            ${money(b.value)}
          </strong>
        </div>

        ${b.notes
          ? `<p class="panel-description" style="margin:6px 0">${esc(b.notes)}</p>`
          : ""
        }

        <p style="font-size:12px;margin:8px 0;color:${b.paid ? "var(--green)" : overdue ? "var(--red)" : "var(--secondary)"}">
          ${b.paid ? "✓ Paga" : overdue ? "⚠ Atrasada" : "○ Pendente"}
        </p>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${!b.paid
            ? `<button class="secondary-button" data-pay-bill="${esc(b.id)}">Marcar como paga</button>`
            : `<button class="secondary-button" data-unpay-bill="${esc(b.id)}">Marcar como pendente</button>`
          }

          <button class="text-action" data-edit-bill="${esc(b.id)}">
            Editar
          </button>

          <button class="text-action" data-delete-bill="${esc(b.id)}">
            Excluir
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function categoryReport(month) {
  const totals = {};

  monthTransactions(month)
    .filter(t => t.type === "expense")
    .forEach(t => {
      totals[t.category] =
        (totals[t.category] || 0) + Number(t.value || 0);
    });

  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  const max = Math.max(1, ...entries.map(e => e[1]));

  return entries.length
    ? entries.map(([category, value]) => `
        <div style="margin:12px 0">
          <div class="section-head">
            <span>${esc(category)}</span>
            <strong>${money(value)}</strong>
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${value / max * 100}%"></div>
          </div>
        </div>
      `).join("")
    : `<p class="panel-description">Ainda não há despesas neste mês.</p>`;
}

function openModal(title, fields, onSave, submitLabel = "Salvar") {
  document.getElementById("app-modal")?.remove();

  const modal = document.createElement("div");
  modal.className = "app-modal";
  modal.id = "app-modal";

  modal.innerHTML = `
    <form class="modal-card">
      <h2>${title}</h2>
      ${fields}

      <div class="modal-actions">
        <button class="primary-button" type="submit">
          ${submitLabel}
        </button>

        <button class="secondary-button" type="button" data-action="close-modal">
          Cancelar
        </button>
      </div>
    </form>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", e => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector("form").addEventListener("submit", e => {
    e.preventDefault();
    onSave(new FormData(e.target), modal);
  });

  modal.querySelector("input,select,textarea")?.focus();

  return modal;
}

function openTransaction(id = null) {
  const old = transactions.find(t => t.id === id);

  const fields = `
    <label>
      Descrição
      <input name="description" maxlength="80" required
        value="${esc(old?.description || "")}"
        placeholder="Ex.: Salário, mercado">
    </label>

    <label>
      Valor
      <input name="value" type="number" min="0.01" step="0.01"
        required value="${old?.value ?? ""}" placeholder="0,00">
    </label>

    <label>
      Tipo
      <select name="type">
        <option value="expense" ${old?.type !== "income" ? "selected" : ""}>
          Despesa
        </option>
        <option value="income" ${old?.type === "income" ? "selected" : ""}>
          Receita
        </option>
      </select>
    </label>

    <label>
      Categoria
      <select name="category">
        ${categories.map(c =>
          `<option ${old?.category === c ? "selected" : ""}>${esc(c)}</option>`
        ).join("")}
      </select>
    </label>

    <label>
      Data
      <input name="date" type="date" required value="${esc(old?.date || today())}">
    </label>

    <label>
      Forma de pagamento (opcional)
      <input name="payment" maxlength="40"
        value="${esc(old?.payment || "")}"
        placeholder="Pix, cartão, dinheiro...">
    </label>

    <label>
      Observações (opcional)
      <textarea name="notes" rows="2" maxlength="300">${esc(old?.notes || "")}</textarea>
    </label>
  `;

  openModal(old ? "Editar transação ♡" : "Nova transação ♡", fields, (f, modal) => {
    const value = Number(f.get("value"));
    const description = String(f.get("description") || "").trim();

    if (!description || !f.get("date") || !Number.isFinite(value) || value <= 0) {
      return alert("Confira a descrição, a data e informe um valor maior que zero.");
    }

    const data = {
      id: old?.id || uid(),
      description,
      value,
      type: f.get("type"),
      category: f.get("category"),
      date: f.get("date"),
      payment: f.get("payment"),
      notes: f.get("notes")
    };

    if (old) {
      transactions = transactions.map(t => t.id === id ? data : t);
    } else {
      transactions.push(data);
    }

    persist();
    modal.remove();
    refresh();
  });
}

function openBudget(id = null) {
  const old = budgets.find(b => b.id === id);

  const fields = `
    <label>
      Categoria
      <select name="category">
        ${categories.map(c =>
          `<option ${old?.category === c ? "selected" : ""}>${esc(c)}</option>`
        ).join("")}
      </select>
    </label>

    <label>
      Limite mensal
      <input name="limit" type="number" min="0.01" step="0.01"
        required value="${old?.limit ?? ""}">
    </label>
  `;

  openModal(old ? "Editar orçamento ♡" : "Novo orçamento ♡", fields, (f, modal) => {
    const limit = Number(f.get("limit"));
    const category = String(f.get("category"));

    if (!Number.isFinite(limit) || limit <= 0) {
      return alert("Informe um limite maior que zero.");
    }

    const duplicate = budgets.find(b => b.category === category && b.id !== id);

    if (duplicate) {
      return alert("Já existe um orçamento para essa categoria. Edite o existente.");
    }

    if (old) {
      budgets = budgets.map(b => b.id === id ? { ...b, category, limit } : b);
    } else {
      budgets.push({ id: uid(), category, limit });
    }

    persist();
    modal.remove();
    refresh();
  });
}

function openGoal(id = null) {
  const old = goals.find(g => g.id === id);

  const fields = `
    <label>
      Nome da meta
      <input name="name" maxlength="80" required
        value="${esc(old?.name || "")}"
        placeholder="Ex.: Reserva de emergência">
    </label>

    <label>
      Valor desejado
      <input name="target" type="number" min="0.01" step="0.01"
        required value="${old?.target ?? ""}">
    </label>

    <label>
      Valor já guardado
      <input name="saved" type="number" min="0" step="0.01"
        value="${old?.saved ?? 0}" required>
    </label>

    <label>
      Prazo (opcional)
      <input name="deadline" type="date" value="${esc(old?.deadline || "")}">
    </label>
  `;

  openModal(old ? "Editar meta ♡" : "Nova meta financeira ♡", fields, (f, modal) => {
    const name = String(f.get("name") || "").trim();
    const target = Number(f.get("target"));
    const saved = Number(f.get("saved"));

    if (!name || !Number.isFinite(target) || target <= 0 ||
        !Number.isFinite(saved) || saved < 0) {
      return alert("Confira os dados e os valores informados.");
    }

    const data = {
      id: old?.id || uid(),
      name,
      target,
      saved,
      deadline: f.get("deadline")
    };

    if (old) {
      goals = goals.map(g => g.id === id ? data : g);
    } else {
      goals.push(data);
    }

    persist();
    modal.remove();
    refresh();
  });
}

function openBill(id = null) {
  const old = bills.find(b => b.id === id);

  const billCategories = [
    "Moradia", "Alimentação", "Transporte", "Saúde",
    "Educação", "Contas", "Assinaturas", "Outros"
  ];

  const fields = `
    <label>
      Nome da conta
      <input name="name" maxlength="80" required
        value="${esc(old?.name || "")}" placeholder="Ex.: Conta de luz">
    </label>

    <label>
      Valor
      <input name="value" type="number" min="0.01" step="0.01"
        required value="${old?.value ?? ""}">
    </label>

    <label>
      Categoria
      <select name="category">
        ${billCategories.map(c =>
          `<option ${old?.category === c ? "selected" : ""}>${esc(c)}</option>`
        ).join("")}
      </select>
    </label>

    <label>
      Data de vencimento
      <input name="dueDate" type="date" required
        value="${esc(old?.dueDate || today())}">
    </label>

    <label>
      Observações (opcional)
      <textarea name="notes" rows="2" maxlength="250">${esc(old?.notes || "")}</textarea>
    </label>

    <label style="display:flex;align-items:center;gap:8px">
      <input name="paid" type="checkbox" ${old?.paid ? "checked" : ""}
        style="width:auto;margin:0">
      Esta conta já está paga
    </label>
  `;

  openModal(old ? "Editar conta ♡" : "Nova conta a pagar ♡", fields, (f, modal) => {
    const name = String(f.get("name") || "").trim();
    const value = Number(f.get("value"));
    const dueDate = String(f.get("dueDate") || "");

    if (!name || !dueDate || !Number.isFinite(value) || value <= 0) {
      return alert("Informe nome, vencimento e um valor maior que zero.");
    }

    const data = {
      id: old?.id || uid(),
      name,
      value,
      category: f.get("category"),
      dueDate,
      notes: f.get("notes"),
      paid: f.get("paid") === "on"
    };

    if (old) {
      bills = bills.map(b => b.id === id ? data : b);
    } else {
      bills.push(data);
    }

    persist();
    modal.remove();
    refresh();
  });
}

function exportCSV() {
  const header = [
    "Descrição", "Valor", "Tipo", "Categoria",
    "Data", "Forma de pagamento", "Observações"
  ];

  const rows = transactions.map(t => [
    t.description,
    t.value,
    t.type === "income" ? "Receita" : "Despesa",
    t.category,
    t.date,
    t.payment || "",
    t.notes || ""
  ]);

  const csv = [header, ...rows]
    .map(row =>
      row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")
    )
    .join("\r\n");

  download(
    "transacoes-financeiras.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function refresh() {
  updateDashboard();
  renderView();
}

/* Eventos dos botões criados dinamicamente */

document.addEventListener("click", e => {
  const nav = e.target.closest("[data-view]");

  if (nav) {
    activeView = nav.dataset.view;
    renderView();
    return;
  }

  const action = e.target.closest("[data-action]")?.dataset.action;

  if (action === "add-transaction") return openTransaction();
  if (action === "add-budget") return openBudget();
  if (action === "add-goal") return openGoal();
  if (action === "add-bill") return openBill();

  if (action === "close-modal") {
    document.getElementById("app-modal")?.remove();
    return;
  }

  if (action === "clear-filters") {
    searchTerm = "";
    typeFilter = "all";
    monthFilter = "";
    renderView();
    return;
  }

  if (action === "export-csv") return exportCSV();


  const edit = e.target.closest("[data-edit]");
  if (edit) return openTransaction(edit.dataset.edit);

  const del = e.target.closest("[data-delete]");

  if (del) {
    if (confirm("Excluir esta transação?")) {
      transactions = transactions.filter(t => t.id !== del.dataset.delete);
      persist();
      refresh();
    }
    return;
  }

  const editB = e.target.closest("[data-edit-budget]");
  if (editB) return openBudget(editB.dataset.editBudget);

  const delB = e.target.closest("[data-delete-budget]");

  if (delB) {
    if (confirm("Excluir este orçamento?")) {
      budgets = budgets.filter(b => b.id !== delB.dataset.deleteBudget);
      persist();
      refresh();
    }
    return;
  }

  const editG = e.target.closest("[data-edit-goal]");
  if (editG) return openGoal(editG.dataset.editGoal);

  const delG = e.target.closest("[data-delete-goal]");

  if (delG) {
    if (confirm("Excluir esta meta?")) {
      goals = goals.filter(g => g.id !== delG.dataset.deleteGoal);
      persist();
      refresh();
    }
    return;
  }

  const contribution = e.target.closest("[data-contribute]");

  if (contribution) {
    const g = goals.find(x => x.id === contribution.dataset.contribute);
    if (!g) return;

    const raw = prompt(`Quanto deseja adicionar à meta “${g.name}”? (R$)`);
    if (raw === null) return;

    const amount = Number(raw.replace(",", "."));

    if (Number.isFinite(amount) && amount > 0) {
      g.saved += amount;
      persist();
      refresh();
    } else {
      alert("Digite um valor maior que zero.");
    }
    return;
  }

  const editBill = e.target.closest("[data-edit-bill]");
  if (editBill) return openBill(editBill.dataset.editBill);

  const delBill = e.target.closest("[data-delete-bill]");

  if (delBill) {
    if (confirm("Excluir esta conta?")) {
      bills = bills.filter(b => b.id !== delBill.dataset.deleteBill);
      persist();
      refresh();
    }
    return;
  }

  const pay = e.target.closest("[data-pay-bill]");

  if (pay) {
    const b = bills.find(x => x.id === pay.dataset.payBill);

    if (b) {
      b.paid = true;
      persist();
      refresh();
    }
    return;
  }

  const unpay = e.target.closest("[data-unpay-bill]");

  if (unpay) {
    const b = bills.find(x => x.id === unpay.dataset.unpayBill);

    if (b) {
      b.paid = false;
      persist();
      refresh();
    }
    return;
  }
});

/* Inicializa o sistema */
ensureUI();
