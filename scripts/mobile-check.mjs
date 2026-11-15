import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.resolve(ROOT, "docs/mobile-check");
mkdirSync(OUT, { recursive: true });

const CATEGORIES = [
  ["cat-goods", "Compra de mineral", "expense", "#d9a441", "gem", 0],
  ["cat-assay", "Análisis de ley", "expense", "#c99ab0", "flask-conical", 0],
  ["cat-freight", "Fletes y transporte", "expense", "#8aa9c9", "truck", 0],
  ["cat-fuel", "Combustible", "expense", "#d98a7d", "fuel", 0],
  ["cat-rent", "Alquiler del local", "expense", "#b08d6a", "store", 2],
  ["cat-electricity", "Luz", "expense", "#d9c27a", "zap", 1],
  ["cat-wifi", "Wifi", "expense", "#8aa9c9", "wifi", 1],
  ["cat-utilities", "Servicios", "expense", "#d9c27a", "zap", 0],
  ["cat-payroll", "Sueldos", "expense", "#a99bc9", "users", 0],
  ["cat-taxes", "Impuestos y regalías", "expense", "#9db8d6", "landmark", 0],
  ["cat-marketing", "Publicidad", "expense", "#c99ab0", "megaphone", 0],
  ["cat-maintenance", "Maquinaria y mantenimiento", "expense", "#9a968f", "wrench", 0],
  ["cat-fees", "Comisiones y bancos", "expense", "#b8a27a", "percent", 0],
  ["cat-other", "Otros gastos", "expense", "#9a968f", "circle-ellipsis", 0],
  ["cat-sales", "Ventas de mineral", "income", "#8fb996", "shopping-bag", 1],
  ["cat-collections", "Cobranzas", "income", "#8aa9c9", "hand-coins", 0],
  ["cat-other-income", "Otros ingresos", "income", "#9db8d6", "plus-circle", 0],
].map(([id, name, kind, color, icon, usage]) => ({
  id,
  name,
  kind,
  color,
  icon,
  budgetCents: null,
  monthly: false,
  dueDay: null,
  reminderDays: 3,
  usageCount: usage,
  lastUsed: usage ? "2026-11-10" : null,
  lastAmountCents: usage ? 85000 : null,
  lastMethod: usage ? "qr" : null,
  archived: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  deviceId: "dev-mock",
}));

const recent = [
  {
    id: "tx-1",
    kind: "expense",
    amountCents: 60000,
    date: "2026-11-14",
    accountId: "acc-cash",
    toAccountId: null,
    categoryId: "cat-goods",
    note: "Compra de mineral",
    recurringId: null,
    createdAt: "2026-11-14T10:00:00Z",
    updatedAt: "2026-11-14T10:00:00Z",
    categoryName: "Compra de mineral",
    categoryColor: "#d9a441",
    categoryIcon: "gem",
    accountName: "Efectivo",
    toAccountName: null,
    paymentMethod: "cash",
  },
  {
    id: "tx-2",
    kind: "income",
    amountCents: 1000000,
    date: "2026-11-13",
    accountId: "acc-bank",
    toAccountId: null,
    categoryId: "cat-sales",
    note: "Venta de mineral",
    recurringId: null,
    createdAt: "2026-11-13T10:00:00Z",
    updatedAt: "2026-11-13T10:00:00Z",
    categoryName: "Ventas de mineral",
    categoryColor: "#8fb996",
    categoryIcon: "shopping-bag",
    accountName: "Banco",
    toAccountName: null,
    paymentMethod: "qr",
  },
  {
    id: "tx-3",
    kind: "expense",
    amountCents: 85000,
    date: "2026-11-10",
    accountId: "acc-bank",
    toAccountId: null,
    categoryId: "cat-electricity",
    note: "Luz",
    recurringId: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    categoryName: "Luz",
    categoryColor: "#d9c27a",
    categoryIcon: "zap",
    accountName: "Banco",
    toAccountName: null,
    paymentMethod: "qr",
  },
  {
    id: "tx-4",
    kind: "expense",
    amountCents: 30000,
    date: "2026-11-10",
    accountId: "acc-cash",
    toAccountId: null,
    categoryId: "cat-wifi",
    note: "Wifi",
    recurringId: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    categoryName: "Wifi",
    categoryColor: "#8aa9c9",
    categoryIcon: "wifi",
    accountName: "Efectivo",
    toAccountName: null,
    paymentMethod: "cash",
  },
  {
    id: "tx-5",
    kind: "expense",
    amountCents: 120000,
    date: "2026-11-01",
    accountId: "acc-cash",
    toAccountId: null,
    categoryId: "cat-rent",
    note: "Alquiler",
    recurringId: null,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    categoryName: "Alquiler del local",
    categoryColor: "#b08d6a",
    categoryIcon: "store",
    accountName: "Efectivo",
    toAccountName: null,
    paymentMethod: "cash",
  },
];

const budgetLines = [
  ["cat-goods", "Compra de mineral", "#d9a441", "gem", 60000],
  ["cat-rent", "Alquiler del local", "#b08d6a", "store", 120000],
  ["cat-electricity", "Luz", "#d9c27a", "zap", 85000],
  ["cat-wifi", "Wifi", "#8aa9c9", "wifi", 30000],
].map(([categoryId, name, color, icon, spentCents], index) => ({
  categoryId,
  name,
  color,
  icon,
  budgetCents: index === 0 ? 300000 : 0,
  spentCents,
  isOverride: false,
}));

const monthlyConcepts = [
  {
    conceptId: "cat-rent",
    name: "Alquiler del local",
    kind: "expense",
    color: "#b08d6a",
    icon: "store",
    dueDate: "2026-11-01",
    status: "pending",
    paidAmountCents: null,
    transactionId: null,
    lastAmountCents: 120000,
    lastMethod: "cash",
    reminderDays: 3,
  },
  {
    conceptId: "cat-electricity",
    name: "Luz",
    kind: "expense",
    color: "#d9c27a",
    icon: "zap",
    dueDate: "2026-11-05",
    status: "pending",
    paidAmountCents: null,
    transactionId: null,
    lastAmountCents: 85000,
    lastMethod: "qr",
    reminderDays: 3,
  },
  {
    conceptId: "cat-wifi",
    name: "Wifi",
    kind: "expense",
    color: "#8aa9c9",
    icon: "wifi",
    dueDate: "2026-11-10",
    status: "paid",
    paidAmountCents: 30000,
    transactionId: "tx-4",
    lastAmountCents: 30000,
    lastMethod: "cash",
    reminderDays: 3,
  },
  {
    conceptId: "cat-utilities",
    name: "Servicios",
    kind: "expense",
    color: "#d9c27a",
    icon: "zap",
    dueDate: "2026-11-15",
    status: "skipped",
    paidAmountCents: null,
    transactionId: null,
    lastAmountCents: 45000,
    lastMethod: "cash",
    reminderDays: 3,
  },
];

const plannedPayments = [
  {
    id: "pp-1",
    conceptId: "cat-goods",
    amountCents: 250000,
    dueDate: "2026-11-15",
    note: "Proveedor de mineral",
    reminderDays: 1,
    status: "pending",
    transactionId: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    deletedAt: null,
    deviceId: "dev-mock",
    conceptName: "Compra de mineral",
    conceptColor: "#d9a441",
    conceptIcon: "gem",
    method: "cash",
  },
  {
    id: "pp-2",
    conceptId: "cat-freight",
    amountCents: 80000,
    dueDate: "2026-11-22",
    note: "Flete a Oruro",
    reminderDays: 1,
    status: "pending",
    transactionId: null,
    createdAt: "2026-11-11T10:00:00Z",
    updatedAt: "2026-11-11T10:00:00Z",
    deletedAt: null,
    deviceId: "dev-mock",
    conceptName: "Fletes y transporte",
    conceptColor: "#8aa9c9",
    conceptIcon: "truck",
    method: "qr",
  },
];

const reminders = [
  {
    kind: "planned",
    conceptId: "cat-goods",
    name: "Compra de mineral",
    dueDate: "2026-11-15",
    daysLeft: 1,
    amountCents: 250000,
    method: "cash",
    reminderDays: 1,
  },
];

const dashboard = {
  today: "2026-11-14",
  weekStart: "2026-11-09",
  monthStart: "2026-11-01",
  monthLabel: "noviembre 2026",
  todayCents: 60000,
  weekCents: 60000,
  monthCents: 295000,
  yearCents: 295000,
  prevMonthCents: 0,
  monthIncomeCents: 1000000,
  dailyAverageCents: 21071,
  budgetTotalCents: 300000,
  budgetSpentCents: 295000,
  accounts: [],
  categories: budgetLines,
  week: [
    { date: "2026-11-09", cents: 0 },
    { date: "2026-11-10", cents: 115000 },
    { date: "2026-11-11", cents: 0 },
    { date: "2026-11-12", cents: 0 },
    { date: "2026-11-13", cents: 0 },
    { date: "2026-11-14", cents: 60000 },
    { date: "2026-11-15", cents: 0 },
  ],
  recent,
};

const reports = {
  months: [
    {
      month: "2026-11",
      label: "noviembre",
      expenseCents: 295000,
      incomeCents: 1000000,
    },
  ],
  categories: budgetLines,
  accounts: [],
  methods: [
    { method: "cash", expenseCents: 210000, incomeCents: 0 },
    { method: "qr", expenseCents: 85000, incomeCents: 1000000 },
  ],
};

const mock = {
  categories: CATEGORIES,
  transactions: recent,
  monthlyConcepts,
  plannedPayments,
  reminders,
  dashboard,
  reports,
  budgets: budgetLines,
  sync: {
    role: "hub",
    configured: true,
    url: null,
    lastSync: "2026-11-14T12:00:00Z",
    pending: 0,
    lastError: null,
    serverRunning: true,
    serverUrls: ["http://100.0.0.1:8787"],
    pairCode: null,
    pairExpires: null,
    serverSeq: 10,
    deviceId: "dev-mock",
  },
  info: { version: "0.2.4", dataDir: "/datos/notex", deviceId: "dev-mock" },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  try {
    const filePath = path.join(ROOT, "dist", pathname);
    const data = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(data);
  } catch {
    const data = await readFile(path.join(ROOT, "dist", "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(data);
  }
});
await new Promise((resolve) => server.listen(4174, "127.0.0.1", resolve));

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/home/anthony/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => candidate) ?? candidates[0];
}

try {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-BO",
  });
  await context.addInitScript((data) => {
    window.__NOTEX_MOCK__ = data;
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        const d = window.__NOTEX_MOCK__;
        if (command === "list_categories") {
          return args?.kind
            ? d.categories.filter((item) => item.kind === args.kind)
            : d.categories;
        }
        if (command === "list_accounts") return [];
        if (command === "get_settings") return { largeText: "false" };
        if (command === "sync_status") return d.sync;
        if (command === "dashboard") return d.dashboard;
        if (command === "list_transactions") return d.transactions;
        if (command === "reports") return d.reports;
        if (command === "list_budgets") return d.budgets;
        if (command === "monthly_concepts") return d.monthlyConcepts;
        if (command === "planned_payments") return d.plannedPayments;
        if (command === "reminders") return d.reminders;
        if (command === "app_info") return d.info;
        if (command === "list_recurring") return [];
        if (command.startsWith("plugin:notification|")) {
          if (command.endsWith("request_permission")) return "granted";
          if (command.endsWith("is_permission_granted")) return true;
          return null;
        }
        if (command === "sync_now") return d.sync;
        return null;
      },
      transformCallback: (callback) => {
        const id = Math.floor(Math.random() * 1e9);
        window[`_${id}`] = callback;
        return id;
      },
      unregisterCallback: (id) => {
        delete window[`_${id}`];
      },
      convertFileSrc: (filePath) => filePath,
    };
  }, mock);

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    console.log(`${name}: overflow=${overflow}`);
  };

  const nav = async (label) => {
    await page
      .locator("nav.safe-bottom button")
      .filter({ hasText: label })
      .first()
      .click();
    await page.waitForTimeout(350);
  };

  await shot("01-resumen");
  await nav("Pendientes");
  await shot("02-pendientes");
  await page
    .locator("main")
    .getByRole("button", { name: /Pagados y saltados/ })
    .click();
  await page.waitForTimeout(250);
  await shot("03-pendientes-pagados");
  await page
    .locator("main")
    .getByRole("button", { name: /Agregar pendiente/ })
    .first()
    .click();
  await page.waitForTimeout(250);
  await shot("04-pendiente-formulario");

  await nav("Agregar");
  await shot("05-agregar");
  await page.getByText("Nuevo", { exact: true }).last().click();
  await page.waitForTimeout(250);
  await shot("06-concepto-modal");
  await page.getByRole("button", { name: "Cerrar" }).click();

  await nav("Ajustes");
  await shot("07-ajustes");
  await page
    .locator("main")
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await page.waitForTimeout(250);
  await shot("08-ajustes-modal");
  await page.getByRole("button", { name: "Cerrar" }).click();

  await nav("Movimientos");
  await shot("09-movimientos");

  await nav("Resumen");
  await page
    .locator("main")
    .getByRole("button", { name: /Reportes/ })
    .first()
    .click();
  await page.waitForTimeout(350);
  await shot("10-reportes");

  await nav("Resumen");
  await page.locator("main").getByRole("button", { name: "Ver", exact: true }).click();
  await page.waitForTimeout(350);
  await shot("11-presupuestos");

  console.log("errors:", errors.length ? errors : "ninguno");
  await browser.close();
} finally {
  server.close();
}
