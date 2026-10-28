export const CATEGORIES = [
  "Amigos",
  "Pareja",
  "Víveres/Reabastecimiento de Alacena",
  "Cena con Mamá",
  "Antojos",
];
export const METHODS = ["Efectivo/Débito", "Tarjeta de Crédito"];
export const INITIAL_STATE = {capital: 2500000, expenses: []};

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseAmount(value) {
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(value.trim())) {
    return null;
  }
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}

export function validateExpense(expense) {
  if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0) {
    return "Ingresa un monto mayor a cero con hasta dos decimales.";
  }
  if (!expense.description.trim()) {
    return "Agrega una descripción del gasto.";
  }
  if (!validDate(expense.date) || expense.date > localDate()) {
    return "Usa una fecha válida que no sea futura (AAAA-MM-DD).";
  }
  if (!METHODS.includes(expense.method)) {
    return "Selecciona un método de pago.";
  }
  if (!CATEGORIES.includes(expense.category)) {
    return "Selecciona una de las cinco categorías.";
  }
  return null;
}

export function financeReducer(state, action) {
  if (action.type !== "expense/add" || validateExpense(action.expense)) {
    return state;
  }
  const expense = action.expense;
  if (state.expenses.some(item => item.id === expense.id)) {
    return state;
  }
  return {
    ...state,
    capital:
      state.capital - (expense.method === METHODS[0] ? expense.amount : 0),
    expenses: [expense, ...state.expenses],
  };
}

export function monthSummary(state, month) {
  const expenses = state.expenses.filter(
    item => item.date.slice(0, 7) === month,
  );
  const totals = CATEGORIES.map(category => ({
    category,
    amount: expenses
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + item.amount, 0),
  }));
  return {
    expenses,
    totals,
    total: totals.reduce((sum, item) => sum + item.amount, 0),
    debt: expenses
      .filter(item => item.method === METHODS[1])
      .reduce((sum, item) => sum + item.amount, 0),
  };
}

export const money = cents =>
  `L ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function subscriptions(today = new Date()) {
  return [
    {name: "Netflix", amount: 24900, day: 5},
    {name: "Spotify", amount: 12900, day: 12},
    {name: "AWS", amount: 45000, day: 28},
  ]
    .map(item => {
      const next = new Date(today.getFullYear(), today.getMonth(), item.day);
      if (localDate(next) < localDate(today)) {
        next.setMonth(next.getMonth() + 1);
      }
      return {...item, next: localDate(next)};
    })
    .sort((a, b) => a.next.localeCompare(b.next));
}

export function nextSubscriptionDate(day, today = new Date()) {
  function inMonth(offset) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return localDate(new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay)));
  }
  const current = inMonth(0);
  return current < localDate(today) ? inMonth(1) : current;
}
